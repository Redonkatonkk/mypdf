/**
 * PDF处理工具函数
 */
import { PDFDocument, rgb, StandardFonts, PDFFont } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { Annotation } from '../types';

// 中文字体 URL 映射（根据字体风格选择对应的中文字体）
const CHINESE_FONT_URLS: Record<string, string> = {
  // 思源黑体 - 用于无衬线字体（Arial, sans-serif 类）
  'sans': 'https://fonts.gstatic.com/s/notosanssc/v36/k3kCo84MPvpLmixcA63oeAL7Iqp5IZJF9bmaG9_EnYxNbPzS5HE.ttf',
  // 思源宋体 - 用于衬线字体（Times New Roman, serif 类）
  'serif': 'https://fonts.gstatic.com/s/notoserifsc/v22/H4c8BXePl9DZ0Xe7gG9cyOj7mm63SzZBEtERe7U.ttf',
  // 思源等宽 - 用于等宽字体（Courier New, monospace 类）
  'mono': 'https://fonts.gstatic.com/s/notosanssc/v36/k3kCo84MPvpLmixcA63oeAL7Iqp5IZJF9bmaG9_EnYxNbPzS5HE.ttf',
};

// 字体缓存
const fontCache: Record<string, ArrayBuffer> = {};

/**
 * 根据字体族名称判断字体类型
 */
function getFontType(fontFamily: string): 'sans' | 'serif' | 'mono' {
  const lowerFont = fontFamily.toLowerCase();
  if (lowerFont.includes('serif') && !lowerFont.includes('sans')) {
    return 'serif';
  }
  if (lowerFont.includes('mono') || lowerFont.includes('courier')) {
    return 'mono';
  }
  return 'sans';
}

/**
 * 加载中文字体
 */
async function loadChineseFont(fontType: 'sans' | 'serif' | 'mono'): Promise<ArrayBuffer> {
  if (fontCache[fontType]) {
    return fontCache[fontType];
  }

  const url = CHINESE_FONT_URLS[fontType];
  const response = await fetch(url);
  const fontBytes = await response.arrayBuffer();
  fontCache[fontType] = fontBytes;
  return fontBytes;
}

/**
 * 检查字符串是否包含非 ASCII 字符（如中文）
 */
function containsNonAscii(str: string): boolean {
  return /[^\x00-\x7F]/.test(str);
}

/**
 * 将标注合并到PDF
 */
export async function mergeAnnotationsToPdf(
  pdfUrl: string,
  annotations: Annotation[]
): Promise<Uint8Array> {
  // 获取PDF文件
  const response = await fetch(pdfUrl);
  const pdfBytes = await response.arrayBuffer();

  // 加载PDF文档
  const pdfDoc = await PDFDocument.load(pdfBytes);

  // 注册 fontkit
  pdfDoc.registerFontkit(fontkit);

  // 嵌入标准字体（用于 ASCII 文本）
  const standardFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const timesFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const courierFont = await pdfDoc.embedFont(StandardFonts.Courier);

  // 收集需要的中文字体类型
  const neededFontTypes = new Set<'sans' | 'serif' | 'mono'>();
  annotations.forEach(ann => {
    if (ann.type === 'text' && containsNonAscii(ann.content || '')) {
      neededFontTypes.add(getFontType(ann.fontFamily || 'Arial'));
    }
  });

  // 加载并嵌入需要的中文字体
  const chineseFonts: Record<string, PDFFont> = {};
  for (const fontType of neededFontTypes) {
    try {
      const fontBytes = await loadChineseFont(fontType);
      chineseFonts[fontType] = await pdfDoc.embedFont(fontBytes);
    } catch (error) {
      console.error(`加载${fontType}中文字体失败:`, error);
      chineseFonts[fontType] = standardFont;
    }
  }

  // 选择字体的辅助函数
  const selectFont = (fontFamily: string, hasNonAscii: boolean): PDFFont => {
    const fontType = getFontType(fontFamily);

    if (hasNonAscii && chineseFonts[fontType]) {
      return chineseFonts[fontType];
    }

    // 英文字体选择
    if (fontType === 'serif') return timesFont;
    if (fontType === 'mono') return courierFont;
    return standardFont;
  };

  // 获取所有页面
  const pages = pdfDoc.getPages();

  // 按页面分组标注
  const annotationsByPage = new Map<number, Annotation[]>();
  annotations.forEach(ann => {
    const pageAnns = annotationsByPage.get(ann.page) || [];
    pageAnns.push(ann);
    annotationsByPage.set(ann.page, pageAnns);
  });

  // 收集需要异步处理的签名标注
  const signatureAnnotations: Array<{
    ann: Annotation;
    page: import('pdf-lib').PDFPage;
    scaleX: number;
    scaleY: number;
    pageHeight: number;
  }> = [];

  // 在每个页面上绘制标注
  annotationsByPage.forEach((pageAnnotations, pageNum) => {
    const page = pages[pageNum - 1]; // 页码从1开始
    if (!page) return;

    const { width: pageWidth, height: pageHeight } = page.getSize();

    // 调试信息
    console.log(`PDF 页面 ${pageNum} 尺寸:`, { pageWidth, pageHeight });
    console.log(`页面 ${pageNum} 标注:`, pageAnnotations.map(a => ({
      type: a.type,
      x: a.x,
      y: a.y,
      width: a.width,
      height: a.height,
    })));

    pageAnnotations.forEach(ann => {
      // PDF坐标系原点在左下角，Y轴向上增长
      // 编辑器坐标系原点在左上角，Y轴向下增长

      // 计算编辑器页面尺寸与PDF页面尺寸的比例
      // 编辑器坐标基于 pdf.js viewport，PDF导出基于 pdf-lib page size
      const editorPageWidth = ann.pageWidth || pageWidth;
      const editorPageHeight = ann.pageHeight || pageHeight;
      const scaleX = pageWidth / editorPageWidth;
      const scaleY = pageHeight / editorPageHeight;

      console.log('坐标比例:', {
        editorSize: { w: editorPageWidth, h: editorPageHeight },
        pdfSize: { w: pageWidth, h: pageHeight },
        scale: { x: scaleX, y: scaleY }
      });

      if (ann.type === 'text') {
        const content = ann.content || '';
        const hasNonAscii = containsNonAscii(content);
        const useFont = selectFont(ann.fontFamily || 'Arial', hasNonAscii);
        const baseFontSize = ann.fontSize || 16;
        const fontSize = baseFontSize * scaleY;

        // 现在 annotation 中存储的是真实的边界框位置（通过 getBoundingRect 获取）
        // 直接使用边界框坐标进行转换
        const pdfX = ann.x * scaleX;

        // PDF drawText 的 y 参数是基线位置
        // 边界框顶部转换为 PDF 坐标，然后减去 ascender 得到基线
        // ascender ≈ fontSize * 0.8
        const ascender = fontSize * 0.8;
        const pdfY = pageHeight - (ann.y * scaleY) - ascender;

        console.log('Text 坐标转换:', {
          editorX: ann.x, editorY: ann.y,
          annHeight: ann.height,
          pdfX, pdfY, fontSize,
          ascender,
          scaleX, scaleY
        });

        page.drawText(content, {
          x: pdfX,
          y: pdfY,
          size: fontSize,
          font: useFont,
          color: hexToRgb(ann.color || '#000000'),
        });
      } else if (ann.type === 'check') {
        // 勾选符号
        const size = (ann.width || 20) * scaleX;
        const pdfX = ann.x * scaleX;
        // 符号的 y 坐标是顶部位置，转换为PDF坐标系（底部位置）
        const pdfY = pageHeight - (ann.y * scaleY) - size;

        console.log('Check 坐标转换:', {
          editorX: ann.x, editorY: ann.y,
          pdfX, pdfY, size,
          scaleX, scaleY
        });

        // 绘制勾选符号 ✓
        // 与编辑器中的 SVG 路径保持一致：M 0 10 L 7.5 20 L 20 0 (标准化到 0-20 边界框)
        const s = size / 20; // 缩放因子
        page.drawLine({
          start: { x: pdfX, y: pdfY + 10 * s },
          end: { x: pdfX + 7.5 * s, y: pdfY },
          thickness: 1.5,
          color: rgb(0, 0, 0),
        });
        page.drawLine({
          start: { x: pdfX + 7.5 * s, y: pdfY },
          end: { x: pdfX + 20 * s, y: pdfY + 20 * s },
          thickness: 1.5,
          color: rgb(0, 0, 0),
        });
      } else if (ann.type === 'cross') {
        // 叉号符号
        const size = (ann.width || 20) * scaleX;
        const pdfX = ann.x * scaleX;
        const pdfY = pageHeight - (ann.y * scaleY) - size;

        console.log('Cross 坐标转换:', {
          editorX: ann.x, editorY: ann.y,
          pdfX, pdfY, size,
          scaleX, scaleY
        });

        // 绘制叉号符号 ✗
        // 与编辑器中的 SVG 路径保持一致：M 0 0 L 20 20 M 20 0 L 0 20 (标准化到 0-20 边界框)
        const s = size / 20;
        page.drawLine({
          start: { x: pdfX, y: pdfY + 20 * s },
          end: { x: pdfX + 20 * s, y: pdfY },
          thickness: 1.5,
          color: rgb(0, 0, 0),
        });
        page.drawLine({
          start: { x: pdfX + 20 * s, y: pdfY + 20 * s },
          end: { x: pdfX, y: pdfY },
          thickness: 1.5,
          color: rgb(0, 0, 0),
        });
      } else if (ann.type === 'draw' && ann.pathData) {
        // 手绘路径
        console.log('Draw 坐标转换:', {
          editorX: ann.x, editorY: ann.y,
          width: ann.width, height: ann.height,
          strokeWidth: ann.strokeWidth,
          strokeColor: ann.strokeColor,
          scaleX, scaleY
        });

        drawPathToPdf(
          page,
          ann.pathData,
          ann.x,
          ann.y,
          ann.strokeColor || '#000000',
          ann.strokeWidth || 2,
          scaleX,
          scaleY,
          pageHeight
        );
      } else if (ann.type === 'signature' && ann.imageData) {
        // 签名图片 - 需要异步处理，收集到数组中
        signatureAnnotations.push({ ann, page, scaleX, scaleY, pageHeight });
      }
    });
  });

  // 处理签名图片（异步嵌入）
  for (const { ann, page, scaleX, scaleY, pageHeight } of signatureAnnotations) {
    try {
      // 从 base64 数据中提取图片字节
      const base64Data = ann.imageData!.split(',')[1];
      const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

      // 嵌入图片
      const image = await pdfDoc.embedPng(imageBytes);

      // 计算位置和尺寸
      const width = (ann.width || 100) * scaleX;
      const height = (ann.height || 50) * scaleY;
      const pdfX = ann.x * scaleX;
      const pdfY = pageHeight - (ann.y * scaleY) - height;

      console.log('Signature 坐标转换:', {
        editorX: ann.x, editorY: ann.y,
        width: ann.width, height: ann.height,
        pdfX, pdfY, pdfWidth: width, pdfHeight: height,
        scaleX, scaleY
      });

      // 绘制图片到页面
      page.drawImage(image, {
        x: pdfX,
        y: pdfY,
        width,
        height,
      });
    } catch (error) {
      console.error('嵌入签名图片失败:', error);
    }
  }

  // 保存并返回
  return pdfDoc.save();
}

/**
 * 下载PDF
 */
export function downloadPdf(data: Uint8Array, filename: string) {
  const blob = new Blob([new Uint8Array(data)], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

/**
 * 打印PDF
 */
export function printPdf(data: Uint8Array) {
  const blob = new Blob([new Uint8Array(data)], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);

  const printWindow = window.open(url, '_blank');
  if (printWindow) {
    printWindow.onload = () => {
      printWindow.print();
    };
  }

  // 延迟释放URL
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/**
 * 十六进制颜色转RGB
 */
function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    return rgb(
      parseInt(result[1], 16) / 255,
      parseInt(result[2], 16) / 255,
      parseInt(result[3], 16) / 255
    );
  }
  return rgb(0, 0, 0);
}

/**
 * 路径命令接口
 */
interface PathCommand {
  type: 'M' | 'L' | 'Q';
  x: number;
  y: number;
  cx?: number;
  cy?: number;
}

/**
 * 解析 SVG 路径数据
 * 支持 M (移动), L (直线), Q (二次贝塞尔曲线) 命令
 */
function parsePathData(pathData: string): PathCommand[] {
  const commands: PathCommand[] = [];
  // 分割命令：支持 "M x y" 或 "M x,y" 或 "M x y Q cx cy x y" 等格式
  const tokens = pathData.trim().split(/\s+/);

  let i = 0;
  while (i < tokens.length) {
    const cmd = tokens[i];

    if (cmd === 'M' || cmd === 'L') {
      // M x y 或 L x y
      const x = parseFloat(tokens[i + 1]);
      const y = parseFloat(tokens[i + 2]);
      commands.push({ type: cmd as 'M' | 'L', x, y });
      i += 3;
    } else if (cmd === 'Q') {
      // Q cx cy x y
      const cx = parseFloat(tokens[i + 1]);
      const cy = parseFloat(tokens[i + 2]);
      const x = parseFloat(tokens[i + 3]);
      const y = parseFloat(tokens[i + 4]);
      commands.push({ type: 'Q', x, y, cx, cy });
      i += 5;
    } else {
      // 未知命令，跳过
      i++;
    }
  }

  return commands;
}

/**
 * 计算路径的边界框（用于坐标转换）
 */
function getPathBounds(commands: PathCommand[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const cmd of commands) {
    minX = Math.min(minX, cmd.x);
    minY = Math.min(minY, cmd.y);
    maxX = Math.max(maxX, cmd.x);
    maxY = Math.max(maxY, cmd.y);
    if (cmd.cx !== undefined && cmd.cy !== undefined) {
      minX = Math.min(minX, cmd.cx);
      minY = Math.min(minY, cmd.cy);
      maxX = Math.max(maxX, cmd.cx);
      maxY = Math.max(maxY, cmd.cy);
    }
  }

  return { minX, minY, maxX, maxY };
}

/**
 * 将绘制路径渲染到 PDF 页面
 */
function drawPathToPdf(
  page: import('pdf-lib').PDFPage,
  pathData: string,
  annX: number,
  annY: number,
  strokeColor: string,
  strokeWidth: number,
  scaleX: number,
  scaleY: number,
  pageHeight: number
) {
  const commands = parsePathData(pathData);
  if (commands.length === 0) return;

  const color = hexToRgb(strokeColor);
  const bounds = getPathBounds(commands);

  let prevX = 0, prevY = 0;

  for (const cmd of commands) {
    if (cmd.type === 'M') {
      // 移动到点
      prevX = cmd.x;
      prevY = cmd.y;
    } else if (cmd.type === 'L') {
      // 直线
      // 将路径坐标转换为相对于边界框原点的坐标
      const x1 = annX + (prevX - bounds.minX);
      const y1 = annY + (prevY - bounds.minY);
      const x2 = annX + (cmd.x - bounds.minX);
      const y2 = annY + (cmd.y - bounds.minY);

      // 转换为 PDF 坐标
      const pdfX1 = x1 * scaleX;
      const pdfY1 = pageHeight - (y1 * scaleY);
      const pdfX2 = x2 * scaleX;
      const pdfY2 = pageHeight - (y2 * scaleY);

      page.drawLine({
        start: { x: pdfX1, y: pdfY1 },
        end: { x: pdfX2, y: pdfY2 },
        thickness: strokeWidth * scaleX,
        color,
      });

      prevX = cmd.x;
      prevY = cmd.y;
    } else if (cmd.type === 'Q') {
      // 二次贝塞尔曲线 - 用多段直线近似
      const segments = 10;
      const x0 = prevX, y0 = prevY;
      const cx = cmd.cx!, cy = cmd.cy!;
      const x2 = cmd.x, y2 = cmd.y;

      for (let j = 1; j <= segments; j++) {
        const t = j / segments;
        const t1 = 1 - t;

        // 二次贝塞尔曲线公式
        const qx = t1 * t1 * x0 + 2 * t1 * t * cx + t * t * x2;
        const qy = t1 * t1 * y0 + 2 * t1 * t * cy + t * t * y2;

        const prevT = (j - 1) / segments;
        const prevT1 = 1 - prevT;
        const prevQx = prevT1 * prevT1 * x0 + 2 * prevT1 * prevT * cx + prevT * prevT * x2;
        const prevQy = prevT1 * prevT1 * y0 + 2 * prevT1 * prevT * cy + prevT * prevT * y2;

        // 转换坐标
        const x1 = annX + (prevQx - bounds.minX);
        const y1 = annY + (prevQy - bounds.minY);
        const x2Final = annX + (qx - bounds.minX);
        const y2Final = annY + (qy - bounds.minY);

        // 转换为 PDF 坐标
        const pdfX1 = x1 * scaleX;
        const pdfY1 = pageHeight - (y1 * scaleY);
        const pdfX2 = x2Final * scaleX;
        const pdfY2 = pageHeight - (y2Final * scaleY);

        page.drawLine({
          start: { x: pdfX1, y: pdfY1 },
          end: { x: pdfX2, y: pdfY2 },
          thickness: strokeWidth * scaleX,
          color,
        });
      }

      prevX = x2;
      prevY = y2;
    }
  }
}
