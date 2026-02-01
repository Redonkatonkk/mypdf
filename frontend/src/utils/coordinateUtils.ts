/**
 * PDF 坐标转换工具
 *
 * PDF 坐标系统：左下角为原点，y 轴向上
 * 浏览器坐标系统：左上角为原点，y 轴向下
 */

export interface PDFRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScreenRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * 将 PDF 坐标转换为屏幕坐标
 *
 * @param pdfRect - PDF 中的矩形位置（左下角为原点）
 * @param pageHeight - PDF 页面高度（scale=1 时）
 * @param scale - 当前缩放比例
 * @returns 屏幕坐标（左上角为原点）
 */
export function pdfToScreen(
  pdfRect: PDFRect,
  pageHeight: number,
  scale: number
): ScreenRect {
  return {
    left: pdfRect.x * scale,
    top: (pageHeight - pdfRect.y - pdfRect.height) * scale,
    width: pdfRect.width * scale,
    height: pdfRect.height * scale,
  };
}

/**
 * 将屏幕坐标转换为 PDF 坐标
 *
 * @param screenRect - 屏幕坐标（左上角为原点）
 * @param pageHeight - PDF 页面高度（scale=1 时）
 * @param scale - 当前缩放比例
 * @returns PDF 坐标（左下角为原点）
 */
export function screenToPdf(
  screenRect: ScreenRect,
  pageHeight: number,
  scale: number
): PDFRect {
  const width = screenRect.width / scale;
  const height = screenRect.height / scale;
  const x = screenRect.left / scale;
  const y = pageHeight - (screenRect.top / scale) - height;

  return { x, y, width, height };
}
