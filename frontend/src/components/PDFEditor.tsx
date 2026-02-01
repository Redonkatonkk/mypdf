/**
 * PDF编辑器组件
 * 基于Fabric.js实现标注功能
 */
import { useEffect, useRef, useCallback } from 'react';
import { Canvas, IText, FabricObject, Control, Path, Point, PencilBrush, FabricImage, ActiveSelection } from 'fabric';
import type { TPointerEventInfo } from 'fabric';
import type { Annotation, ToolType, AnnotationType, SelectedTextInfo, DrawingOptions } from '../types';

// 扩展FabricObject类型以支持annotationId
interface AnnotatedFabricObject extends FabricObject {
  annotationId?: string;
}

interface PDFEditorProps {
  width: number;
  height: number;
  scale: number;
  currentTool: ToolType;
  annotations: Annotation[];
  currentPage: number;
  onAddAnnotation: (type: AnnotationType, x: number, y: number, page: number, pageWidth: number, pageHeight: number) => Annotation;
  onUpdateAnnotation: (id: string, updates: Partial<Annotation>) => void;
  onUpdateAnnotations?: (updates: Array<{ id: string; changes: Partial<Annotation> }>) => void;
  onRemoveAnnotation: (id: string) => void;
  onToolChange?: (tool: ToolType) => void;
  onTextSelect?: (info: SelectedTextInfo | null) => void;
  onSignatureClick?: (x: number, y: number, page: number, pageWidth: number, pageHeight: number) => void;
  drawingOptions?: DrawingOptions;
}

export function PDFEditor({
  width,
  height,
  scale,
  currentTool,
  annotations,
  currentPage,
  onAddAnnotation,
  onUpdateAnnotation,
  onUpdateAnnotations,
  onRemoveAnnotation,
  onToolChange,
  onTextSelect,
  onSignatureClick,
  drawingOptions,
}: PDFEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const annotationMapRef = useRef<Map<string, FabricObject>>(new Map());
  const currentToolRef = useRef(currentTool);
  const currentPageRef = useRef(currentPage);
  const onAddAnnotationRef = useRef(onAddAnnotation);
  const onUpdateAnnotationRef = useRef(onUpdateAnnotation);
  const onUpdateAnnotationsRef = useRef(onUpdateAnnotations);
  const onRemoveAnnotationRef = useRef(onRemoveAnnotation);
  const onToolChangeRef = useRef(onToolChange);
  const onTextSelectRef = useRef(onTextSelect);
  const onSignatureClickRef = useRef(onSignatureClick);
  const scaleRef = useRef(scale);
  const drawingOptionsRef = useRef(drawingOptions);

  // 更新 refs
  useEffect(() => {
    currentToolRef.current = currentTool;
    currentPageRef.current = currentPage;
    onAddAnnotationRef.current = onAddAnnotation;
    onUpdateAnnotationRef.current = onUpdateAnnotation;
    onUpdateAnnotationsRef.current = onUpdateAnnotations;
    onRemoveAnnotationRef.current = onRemoveAnnotation;
    onToolChangeRef.current = onToolChange;
    onTextSelectRef.current = onTextSelect;
    onSignatureClickRef.current = onSignatureClick;
    scaleRef.current = scale;
    drawingOptionsRef.current = drawingOptions;
  });

  // 初始化Fabric.js Canvas
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const canvas = new Canvas(canvasRef.current, {
      width,
      height,
      selection: true,
      backgroundColor: 'transparent',
    });

    fabricRef.current = canvas;

    // 处理点击事件 - 添加新标注
    const handleMouseDown = (e: TPointerEventInfo) => {
      const tool = currentToolRef.current;

      // 选择模式不添加新标注
      if (tool === 'select') {
        return;
      }

      // 绘制模式由 PencilBrush 处理
      if (tool === 'draw') {
        return;
      }

      // 点击已有对象时不添加新标注
      if (e.target) {
        return;
      }

      const pointer = canvas.getScenePoint(e.e);
      if (!pointer) return;

      // 保存相对于 scale=1 的坐标
      const currentScale = scaleRef.current;
      const x = pointer.x / currentScale;
      const y = pointer.y / currentScale;
      // 计算 scale=1 时的页面尺寸
      const pageWidth = canvas.width! / currentScale;
      const pageHeight = canvas.height! / currentScale;

      // 签名工具：触发回调显示签名弹窗
      if (tool === 'signature') {
        onSignatureClickRef.current?.(x, y, currentPageRef.current, pageWidth, pageHeight);
        return;
      }

      const type: AnnotationType = tool === 'text' ? 'text' :
        tool === 'check' ? 'check' : 'cross';

      onAddAnnotationRef.current(type, x, y, currentPageRef.current, pageWidth, pageHeight);

      // 添加后自动切换回选择工具
      onToolChangeRef.current?.('select');
    };

    // 处理对象移动
    const handleObjectModified = (e: { target?: FabricObject }) => {
      const target = e.target;
      if (!target) return;

      const currentScale = scaleRef.current;

      // 检查是否是多选（ActiveSelection）
      if (target instanceof ActiveSelection) {
        // 获取多选组中的所有对象（复制数组）
        const objects = [...target.getObjects()] as AnnotatedFabricObject[];

        // 使用 setTimeout 延迟处理，避免干扰 Fabric.js 内部状态
        setTimeout(() => {
          // 收集位置更新
          const updates: Array<{ id: string; changes: Partial<Annotation> }> = [];

          objects.forEach((obj) => {
            if (!obj.annotationId) return;

            // 获取边界框
            const boundingRect = obj.getBoundingRect();

            updates.push({
              id: obj.annotationId,
              changes: {
                x: boundingRect.left / currentScale,
                y: boundingRect.top / currentScale,
                width: boundingRect.width / currentScale,
                height: boundingRect.height / currentScale,
              },
            });
          });

          // 使用批量更新函数一次性更新所有对象
          if (onUpdateAnnotationsRef.current && updates.length > 0) {
            onUpdateAnnotationsRef.current(updates);
          }
        }, 0);
      } else {
        // 单个对象 - 使用 getBoundingRect 获取位置
        const obj = target as AnnotatedFabricObject;
        if (!obj.annotationId) return;

        const boundingRect = obj.getBoundingRect();

        onUpdateAnnotationRef.current(obj.annotationId, {
          x: boundingRect.left / currentScale,
          y: boundingRect.top / currentScale,
          width: boundingRect.width / currentScale,
          height: boundingRect.height / currentScale,
        });
      }
    };

    // 处理文本编辑
    const handleTextChanged = (e: { target?: FabricObject }) => {
      const obj = e.target as IText & { annotationId?: string };
      if (!obj || !obj.annotationId) return;

      // 文本内容变化时，边界框尺寸也会变化，需要同步更新
      // 使用 getBoundingRect 获取真实的边界框尺寸
      const currentScale = scaleRef.current;
      const boundingRect = obj.getBoundingRect();

      onUpdateAnnotationRef.current(obj.annotationId, {
        content: obj.text || '',
        width: boundingRect.width / currentScale,
        height: boundingRect.height / currentScale,
      });
    };

    // 处理对象选中
    const handleSelection = () => {
      const activeObject = canvas.getActiveObject();
      if (activeObject && activeObject instanceof IText) {
        const obj = activeObject as IText & { annotationId?: string };
        if (obj.annotationId) {
          const boundingRect = obj.getBoundingRect();
          onTextSelectRef.current?.({
            id: obj.annotationId,
            position: {
              x: boundingRect.left,
              y: boundingRect.top - 50,
            },
            fontFamily: (obj.fontFamily as string) || 'Arial',
            fontSize: (obj.fontSize as number) || 16,
            fill: (obj.fill as string) || '#000000',
            fontWeight: (obj.fontWeight as string) || 'normal',
            underline: obj.underline || false,
          });
        }
      }
    };

    // 处理取消选中
    const handleDeselection = () => {
      onTextSelectRef.current?.(null);
    };

    // 处理绘制路径创建完成
    const handlePathCreated = (e: { path: FabricObject }) => {
      const path = e.path as Path;
      if (!path) return;

      // 获取路径数据
      const pathCommands = (path as unknown as { path: unknown[] }).path;
      const pathData = pathCommands.map((cmd: unknown) => (cmd as unknown[]).join(' ')).join(' ');

      // 获取边界框
      const boundingRect = path.getBoundingRect();
      const currentScale = scaleRef.current;
      const options = drawingOptionsRef.current;

      // 创建 annotation
      const annotation = onAddAnnotationRef.current(
        'draw',
        boundingRect.left / currentScale,
        boundingRect.top / currentScale,
        currentPageRef.current,
        canvas.width! / currentScale,
        canvas.height! / currentScale
      );

      // 更新路径数据
      onUpdateAnnotationRef.current(annotation.id, {
        pathData,
        width: boundingRect.width / currentScale,
        height: boundingRect.height / currentScale,
        strokeWidth: options?.strokeWidth || 2,
        strokeColor: options?.strokeColor || '#000000',
      });

      // 关联 annotation ID
      (path as AnnotatedFabricObject).annotationId = annotation.id;
      annotationMapRef.current.set(annotation.id, path);

      // 添加删除按钮控件
      path.controls.deleteControl = new Control({
        x: 0.5,
        y: -0.5,
        offsetX: 10,
        offsetY: -10,
        cursorStyle: 'pointer',
        mouseUpHandler: (_eventData, transform) => {
          const target = transform.target as AnnotatedFabricObject;
          if (target && target.annotationId) {
            onRemoveAnnotationRef.current(target.annotationId);
          }
          return true;
        },
        render: (ctx, left, top) => {
          const size = 20;
          ctx.save();
          ctx.translate(left, top);
          ctx.beginPath();
          ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
          ctx.fillStyle = '#ef4444';
          ctx.fill();
          ctx.strokeStyle = 'white';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(-4, -4);
          ctx.lineTo(4, 4);
          ctx.moveTo(4, -4);
          ctx.lineTo(-4, 4);
          ctx.stroke();
          ctx.restore();
        },
      });
    };

    canvas.on('mouse:down', handleMouseDown);
    canvas.on('object:modified', handleObjectModified);
    canvas.on('text:changed', handleTextChanged);
    canvas.on('selection:created', handleSelection);
    canvas.on('selection:updated', handleSelection);
    canvas.on('selection:cleared', handleDeselection);
    canvas.on('path:created', handlePathCreated);

    // 清理
    return () => {
      canvas.off('mouse:down', handleMouseDown);
      canvas.off('object:modified', handleObjectModified);
      canvas.off('text:changed', handleTextChanged);
      canvas.off('selection:created', handleSelection);
      canvas.off('selection:updated', handleSelection);
      canvas.off('selection:cleared', handleDeselection);
      canvas.off('path:created', handlePathCreated);
      canvas.dispose();
      fabricRef.current = null;
      annotationMapRef.current.clear();
    };
  }, []);

  // 切换绘制模式
  useEffect(() => {
    if (!fabricRef.current) return;
    const canvas = fabricRef.current;

    if (currentTool === 'draw') {
      canvas.isDrawingMode = true;
      const brush = new PencilBrush(canvas);
      brush.width = (drawingOptions?.strokeWidth || 2) * scale;
      brush.color = drawingOptions?.strokeColor || '#000000';
      canvas.freeDrawingBrush = brush;
    } else {
      canvas.isDrawingMode = false;
    }
  }, [currentTool, scale, drawingOptions]);

  // 暴露更新选中文本格式的方法
  useEffect(() => {
    (window as unknown as { updateSelectedTextFormat: (property: string, value: string | number | boolean) => void }).updateSelectedTextFormat = (property: string, value: string | number | boolean) => {
      if (!fabricRef.current) return;
      const activeObject = fabricRef.current.getActiveObject();
      if (activeObject && activeObject instanceof IText) {
        const wasEditing = activeObject.isEditing;

        // 如果正在编辑，先退出编辑模式以确保样式应用到整个文本
        if (wasEditing) {
          activeObject.exitEditing();
        }

        // 设置属性
        activeObject.set(property as keyof IText, value);

        // 强制标记为需要重新渲染
        activeObject.dirty = true;

        // 如果之前在编辑，重新进入编辑模式
        if (wasEditing) {
          activeObject.enterEditing();
        }

        fabricRef.current.renderAll();

        // 同步到 annotation
        const obj = activeObject as IText & { annotationId?: string };
        if (obj.annotationId) {
          // 将 Fabric.js 的 fill 属性映射到 annotation 的 color 属性
          const annotationProperty = property === 'fill' ? 'color' : property;
          onUpdateAnnotationRef.current(obj.annotationId, {
            [annotationProperty]: value,
          });

          // 更新上方信息栏的显示值
          const boundingRect = activeObject.getBoundingRect();
          onTextSelectRef.current?.({
            id: obj.annotationId,
            position: {
              x: boundingRect.left,
              y: boundingRect.top - 50,
            },
            fontFamily: (activeObject.fontFamily as string) || 'Arial',
            fontSize: (activeObject.fontSize as number) || 16,
            fill: (activeObject.fill as string) || '#000000',
            fontWeight: (activeObject.fontWeight as string) || 'normal',
            underline: activeObject.underline || false,
          });
        }
      }
    };

    return () => {
      delete (window as unknown as { updateSelectedTextFormat?: unknown }).updateSelectedTextFormat;
    };
  }, []);

  // 更新canvas尺寸
  useEffect(() => {
    if (!fabricRef.current) return;
    fabricRef.current.setDimensions({ width, height });
    fabricRef.current.renderAll();
  }, [width, height]);

  // 创建删除控件
  const createDeleteControl = useCallback(() => {
    return new Control({
      x: 0.5,
      y: -0.5,
      offsetX: 10,
      offsetY: -10,
      cursorStyle: 'pointer',
      mouseUpHandler: (_eventData, transform) => {
        const target = transform.target as AnnotatedFabricObject;
        if (target && target.annotationId) {
          onRemoveAnnotationRef.current(target.annotationId);
        }
        return true;
      },
      render: (ctx, left, top, _styleOverride, _fabricObject) => {
        const size = 20;
        ctx.save();
        ctx.translate(left, top);

        // 绘制红色圆形背景
        ctx.beginPath();
        ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
        ctx.fillStyle = '#ef4444';
        ctx.fill();

        // 绘制白色 X
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-4, -4);
        ctx.lineTo(4, 4);
        ctx.moveTo(4, -4);
        ctx.lineTo(-4, 4);
        ctx.stroke();

        ctx.restore();
      },
    });
  }, []);

  // 创建Fabric对象（根据当前 scale 调整位置和字体大小）
  // 返回 null 表示需要异步处理（如签名图片）
  const createFabricObject = useCallback((annotation: Annotation, currentScale: number): FabricObject | null => {
    let obj: FabricObject;

    // 根据 scale 调整位置
    const scaledX = annotation.x * currentScale;
    const scaledY = annotation.y * currentScale;

    // 签名类型需要异步加载，返回 null 由其他逻辑处理
    if (annotation.type === 'signature') {
      return null;
    }

    if (annotation.type === 'text') {
      // 使用 IText 支持双击编辑
      const baseFontSize = annotation.fontSize || 16;
      obj = new IText(annotation.content || '双击编辑', {
        // 不在这里设置 left/top，而是使用 setPositionByOrigin
        fontSize: baseFontSize * currentScale,
        fontFamily: annotation.fontFamily || 'Arial',
        fill: annotation.color || '#000000',
        selectable: true,
        evented: true,
        // 禁止缩放文本框，防止字体大小随缩放改变
        lockScalingX: true,
        lockScalingY: true,
        hasBorders: true,
        borderColor: '#3b82f6',
      });

      // 与 Path 一致，使用 setPositionByOrigin 确保精确定位
      obj.setPositionByOrigin(
        new Point(scaledX, scaledY),
        'left',
        'top'
      );

      // 隐藏默认缩放控制点，只保留自定义删除按钮
      obj.setControlsVisibility({
        tl: false,
        tr: false,
        bl: false,
        br: false,
        mt: false,
        mb: false,
        ml: false,
        mr: false,
        mtr: false,
      });
    } else if (annotation.type === 'draw' && annotation.pathData) {
      // 绘制路径
      const strokeWidth = (annotation.strokeWidth || 2) * currentScale;

      obj = new Path(annotation.pathData, {
        stroke: annotation.strokeColor || '#000000',
        strokeWidth: strokeWidth,
        fill: 'transparent',
        selectable: true,
        evented: true,
        strokeLineCap: 'round',
        strokeLineJoin: 'round',
      });

      obj.setPositionByOrigin(
        new Point(scaledX, scaledY),
        'left',
        'top'
      );

      // 隐藏缩放控制点
      obj.setControlsVisibility({
        tl: false,
        tr: false,
        bl: false,
        br: false,
        mt: false,
        mb: false,
        ml: false,
        mr: false,
        mtr: false,
      });
    } else {
      // 使用 SVG Path 绘制矢量勾选/叉号，避免 emoji 问题
      const baseSize = 20;
      // 使用 annotation 中保存的尺寸（用户可能已调整），而不是固定的 baseSize
      const annotationWidth = annotation.width || baseSize;
      const size = annotationWidth * currentScale;

      // 勾选 ✓ 的 SVG 路径 (标准化到 0-20 的边界框)
      // 叉号 ✗ 的 SVG 路径 (标准化到 0-20 的边界框)
      const checkPath = `M 0 10 L 7.5 20 L 20 0`;  // 勾选形状，边界框 0-20
      const crossPath = `M 0 0 L 20 20 M 20 0 L 0 20`;  // 叉号形状，边界框 0-20

      const pathData = annotation.type === 'check' ? checkPath : crossPath;

      obj = new Path(pathData, {
        stroke: '#000000',  // 黑色，无颜色区分
        strokeWidth: 1.5,  // 更细的线条
        fill: 'transparent',
        scaleX: size / baseSize,
        scaleY: size / baseSize,
        selectable: true,
        evented: true,
        strokeLineCap: 'round',
        strokeLineJoin: 'round',
        // 锁定比例缩放
        lockUniScaling: true,
      });

      // 设置位置：使用 setPositionByOrigin 确保精确定位
      // Path 对象的 left/top 是边界框位置，需要考虑路径偏移
      obj.setPositionByOrigin(
        new Point(scaledX, scaledY),
        'left',
        'top'
      );

      // 仅显示右下角缩放控制点，隐藏其他控制点
      obj.setControlsVisibility({
        tl: false,  // 左上角
        tr: false,  // 右上角
        bl: false,  // 左下角
        br: true,   // 右下角 - 保留
        mt: false,  // 上中
        mb: false,  // 下中
        ml: false,  // 左中
        mr: false,  // 右中
        mtr: false, // 旋转控制点
      });
    }

    // 存储annotation id
    (obj as AnnotatedFabricObject).annotationId = annotation.id;

    // 添加删除按钮控件
    obj.controls.deleteControl = createDeleteControl();

    return obj;
  }, [createDeleteControl]);

  // 异步创建签名图片对象
  const createSignatureObject = useCallback(async (
    annotation: Annotation,
    currentScale: number
  ): Promise<FabricObject | null> => {
    if (!annotation.imageData) return null;

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const scaledX = annotation.x * currentScale;
        const scaledY = annotation.y * currentScale;
        const scaledWidth = (annotation.width || 100) * currentScale;
        const scaledHeight = (annotation.height || 50) * currentScale;

        const fabricImg = new FabricImage(img, {
          selectable: true,
          evented: true,
          // 锁定比例缩放
          lockUniScaling: true,
        });

        // 设置缩放以匹配目标尺寸
        fabricImg.scaleX = scaledWidth / img.width;
        fabricImg.scaleY = scaledHeight / img.height;

        // 设置位置
        fabricImg.setPositionByOrigin(
          new Point(scaledX, scaledY),
          'left',
          'top'
        );

        // 仅显示右下角缩放控制点
        fabricImg.setControlsVisibility({
          tl: false,
          tr: false,
          bl: false,
          br: true,
          mt: false,
          mb: false,
          ml: false,
          mr: false,
          mtr: false,
        });

        // 存储 annotation id
        (fabricImg as AnnotatedFabricObject).annotationId = annotation.id;

        // 添加删除按钮控件
        fabricImg.controls.deleteControl = createDeleteControl();

        resolve(fabricImg);
      };
      img.onerror = () => resolve(null);
      img.src = annotation.imageData!;
    });
  }, [createDeleteControl]);

  // 同步标注到Canvas
  useEffect(() => {
    if (!fabricRef.current) return;

    const canvas = fabricRef.current;
    const pageAnnotations = annotations.filter(a => a.page === currentPage);
    const currentIds = new Set(pageAnnotations.map(a => a.id));
    const existingIds = new Set(annotationMapRef.current.keys());

    // 移除不存在的标注
    existingIds.forEach(id => {
      if (!currentIds.has(id)) {
        const obj = annotationMapRef.current.get(id);
        if (obj) {
          canvas.remove(obj);
          annotationMapRef.current.delete(id);
        }
      }
    });

    // 添加新标注
    pageAnnotations.forEach(annotation => {
      if (!annotationMapRef.current.has(annotation.id)) {
        // 签名类型需要异步处理
        if (annotation.type === 'signature') {
          createSignatureObject(annotation, scale).then(obj => {
            if (obj && fabricRef.current) {
              fabricRef.current.add(obj);
              annotationMapRef.current.set(annotation.id, obj);
              fabricRef.current.renderAll();
            }
          });
          return;
        }

        const obj = createFabricObject(annotation, scale);
        if (!obj) return;

        canvas.add(obj);
        annotationMapRef.current.set(annotation.id, obj);

        // 创建后立即用实际的边界框尺寸和位置更新 annotation
        // 使用 getBoundingRect 确保获取真实的边界框位置
        // 这确保导出时使用正确的坐标和尺寸
        const currentScale = scaleRef.current;
        const boundingRect = obj.getBoundingRect();
        onUpdateAnnotationRef.current(annotation.id, {
          x: boundingRect.left / currentScale,
          y: boundingRect.top / currentScale,
          width: boundingRect.width / currentScale,
          height: boundingRect.height / currentScale,
        });

        // 如果是文本，自动进入编辑模式
        if (annotation.type === 'text' && obj instanceof IText) {
          canvas.setActiveObject(obj);
          obj.enterEditing();
          obj.selectAll();
        }
      }
    });

    canvas.renderAll();
  }, [annotations, currentPage, createFabricObject, createSignatureObject, scale]);

  // 当 scale 变化时，更新所有对象的位置和字体大小
  useEffect(() => {
    if (!fabricRef.current) return;

    const canvas = fabricRef.current;
    const pageAnnotations = annotations.filter(a => a.page === currentPage);

    // 获取当前选中的对象 ID，跳过这些对象的位置更新
    // 避免与 ActiveSelection 的移动操作冲突
    const activeObject = canvas.getActiveObject();
    const selectedIds = new Set<string>();

    if (activeObject) {
      if (activeObject instanceof ActiveSelection) {
        activeObject.getObjects().forEach((obj) => {
          const annotatedObj = obj as AnnotatedFabricObject;
          if (annotatedObj.annotationId) {
            selectedIds.add(annotatedObj.annotationId);
          }
        });
      } else {
        const annotatedObj = activeObject as AnnotatedFabricObject;
        if (annotatedObj.annotationId) {
          selectedIds.add(annotatedObj.annotationId);
        }
      }
    }

    // 更新现有对象的位置和字体大小
    pageAnnotations.forEach(annotation => {
      // 跳过当前选中的对象
      if (selectedIds.has(annotation.id)) {
        return;
      }

      const obj = annotationMapRef.current.get(annotation.id);
      if (obj) {
        const scaledX = annotation.x * scale;
        const scaledY = annotation.y * scale;

        if (annotation.type === 'text') {
          const baseFontSize = annotation.fontSize || 16;
          obj.set({
            fontSize: baseFontSize * scale,
          });
          // 与 Path 一致，使用 setPositionByOrigin 确保精确定位
          obj.setPositionByOrigin(
            new Point(scaledX, scaledY),
            'left',
            'top'
          );
        } else if (annotation.type === 'draw') {
          // 绘制路径：更新笔画宽度和位置
          const strokeWidth = (annotation.strokeWidth || 2) * scale;
          obj.set({ strokeWidth });
          obj.setPositionByOrigin(
            new Point(scaledX, scaledY),
            'left',
            'top'
          );
        } else if (annotation.type === 'signature' && obj instanceof FabricImage) {
          // 签名图片：更新缩放和位置
          const scaledWidth = (annotation.width || 100) * scale;
          const scaledHeight = (annotation.height || 50) * scale;
          const img = obj.getElement() as HTMLImageElement;
          obj.set({
            scaleX: scaledWidth / img.width,
            scaleY: scaledHeight / img.height,
          });
          obj.setPositionByOrigin(
            new Point(scaledX, scaledY),
            'left',
            'top'
          );
        } else {
          // Path 对象使用 setPositionByOrigin 确保精确定位
          const baseSize = 20;
          // 使用 annotation 中保存的尺寸（用户可能已调整），而不是固定的 baseSize
          const annotationWidth = annotation.width || baseSize;
          const size = annotationWidth * scale;
          obj.set({
            scaleX: size / baseSize,
            scaleY: size / baseSize,
          });
          obj.setPositionByOrigin(
            new Point(scaledX, scaledY),
            'left',
            'top'
          );
        }
        obj.setCoords();
      }
    });

    canvas.renderAll();
  }, [scale, annotations, currentPage]);

  // 处理键盘删除事件
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!fabricRef.current) return;

        const activeObject = fabricRef.current.getActiveObject();
        const annotatedObj = activeObject as AnnotatedFabricObject | null;
        if (annotatedObj && annotatedObj.annotationId) {
          // 如果是正在编辑的文本框，不删除
          if (activeObject instanceof IText) {
            if (activeObject.isEditing) {
              return;
            }
          }
          onRemoveAnnotationRef.current(annotatedObj.annotationId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute top-0 left-0"
      style={{
        width,
        height,
        pointerEvents: 'auto',
        zIndex: 5,  // 低于 FormFieldOverlay (z-index: 10)
      }}
    >
      <canvas ref={canvasRef} />
    </div>
  );
}
