/**
 * PDF预览组件
 */
import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// 设置PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

interface PageSizeInfo {
  width: number;    // 原始宽度（scale=1）
  height: number;   // 原始高度（scale=1）
  scaledWidth: number;   // 缩放后宽度
  scaledHeight: number;  // 缩放后高度
}

interface PDFViewerProps {
  url: string | null;
  page: number;
  scale: number;
  onLoadSuccess?: (totalPages: number) => void;
  onLoadError?: (error: Error) => void;
  onPageRender?: (canvas: HTMLCanvasElement) => void;
  onPageSizeChange?: (size: PageSizeInfo) => void;
}

export function PDFViewer({
  url,
  page,
  scale,
  onLoadSuccess,
  onLoadError,
  onPageRender,
  onPageSizeChange,
}: PDFViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });

  // 使用 ref 存储回调，避免依赖变化
  const onLoadSuccessRef = useRef(onLoadSuccess);
  const onLoadErrorRef = useRef(onLoadError);
  const onPageRenderRef = useRef(onPageRender);
  const onPageSizeChangeRef = useRef(onPageSizeChange);

  useEffect(() => {
    onLoadSuccessRef.current = onLoadSuccess;
    onLoadErrorRef.current = onLoadError;
    onPageRenderRef.current = onPageRender;
    onPageSizeChangeRef.current = onPageSizeChange;
  });

  // 加载PDF文档
  useEffect(() => {
    if (!url) {
      setPdfDoc(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const loadingTask = pdfjsLib.getDocument(url);

    loadingTask.promise
      .then((doc) => {
        if (cancelled) {
          doc.destroy();
          return;
        }
        setPdfDoc(doc);
        onLoadSuccessRef.current?.(doc.numPages);
        setIsLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('PDF加载失败:', err);
        setError('PDF加载失败');
        onLoadErrorRef.current?.(err);
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
      loadingTask.destroy().catch(() => { });
    };
  }, [url]);

  // 渲染页面
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return;

    let cancelled = false;
    setIsLoading(true);

    pdfDoc.getPage(page).then((pdfPage) => {
      if (cancelled) return;

      const viewport = pdfPage.getViewport({ scale });
      // 获取 scale=1 时的原始尺寸
      const viewport1 = pdfPage.getViewport({ scale: 1 });

      console.log('PDFViewer 尺寸对比:', {
        currentScale: scale,
        viewportAtScale: { width: viewport.width, height: viewport.height },
        viewportAtScale1: { width: viewport1.width, height: viewport1.height },
      });

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      setPageSize({ width: viewport.width, height: viewport.height });

      // 通知页面尺寸变化（包含原始尺寸和缩放后尺寸）
      onPageSizeChangeRef.current?.({
        width: viewport1.width,
        height: viewport1.height,
        scaledWidth: viewport.width,
        scaledHeight: viewport.height,
      });

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
        canvas: canvas,
      };

      pdfPage.render(renderContext as Parameters<typeof pdfPage.render>[0]).promise.then(() => {
        if (cancelled) return;
        setIsLoading(false);
        onPageRenderRef.current?.(canvas);
      }).catch((err) => {
        if (cancelled) return;
        console.error('PDF渲染失败:', err);
      });
    }).catch((err) => {
      if (cancelled) return;
      console.error('获取页面失败:', err);
    });

    return () => {
      cancelled = true;
    };
  }, [pdfDoc, page, scale]);

  if (!url) {
    return null;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-100 rounded-lg">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-10">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      <canvas
        ref={canvasRef}
        className="shadow-lg"
        style={{
          width: pageSize.width ? `${pageSize.width}px` : 'auto',
          height: pageSize.height ? `${pageSize.height}px` : 'auto',
        }}
      />
    </>
  );
}
