/**
 * PDF 页面缩略图预览组件
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

interface PageThumbnailsProps {
  url: string | null;
  totalPages: number;
  currentPage: number;
  onPageSelect: (page: number) => void;
}

const THUMBNAIL_WIDTH = 120;

export function PageThumbnails({
  url,
  totalPages,
  currentPage,
  onPageSelect,
}: PageThumbnailsProps) {
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [thumbnails, setThumbnails] = useState<Map<number, string>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentPageRef = useRef<HTMLDivElement>(null);

  // 加载 PDF 文档
  useEffect(() => {
    if (!url) {
      setPdfDoc(null);
      setThumbnails(new Map());
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    const loadingTask = pdfjsLib.getDocument(url);
    loadingTask.promise
      .then((doc) => {
        if (cancelled) {
          doc.destroy();
          return;
        }
        setPdfDoc(doc);
        setIsLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('缩略图加载失败:', err);
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
      loadingTask.destroy().catch(() => {});
    };
  }, [url]);

  // 渲染单个页面缩略图
  const renderThumbnail = useCallback(async (pageNum: number): Promise<string | null> => {
    if (!pdfDoc) return null;

    try {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1 });
      const scale = THUMBNAIL_WIDTH / viewport.width;
      const scaledViewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = scaledViewport.width;
      canvas.height = scaledViewport.height;

      const context = canvas.getContext('2d');
      if (!context) return null;

      await page.render({
        canvasContext: context,
        viewport: scaledViewport,
        canvas: canvas,
      }).promise;

      return canvas.toDataURL();
    } catch (err) {
      console.error(`渲染第 ${pageNum} 页缩略图失败:`, err);
      return null;
    }
  }, [pdfDoc]);

  // 渲染所有缩略图
  useEffect(() => {
    if (!pdfDoc || totalPages === 0) return;

    let cancelled = false;

    const renderAll = async () => {
      const newThumbnails = new Map<number, string>();

      for (let i = 1; i <= totalPages; i++) {
        if (cancelled) break;

        const dataUrl = await renderThumbnail(i);
        if (dataUrl) {
          newThumbnails.set(i, dataUrl);
          // 逐步更新以显示加载进度
          setThumbnails(new Map(newThumbnails));
        }
      }
    };

    renderAll();

    return () => {
      cancelled = true;
    };
  }, [pdfDoc, totalPages, renderThumbnail]);

  // 滚动到当前页
  useEffect(() => {
    if (currentPageRef.current) {
      currentPageRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [currentPage]);

  if (!url) return null;

  return (
    <div
      ref={containerRef}
      className="w-40 bg-gray-50 border-r border-gray-200 overflow-y-auto flex-shrink-0"
      style={{ maxHeight: 'calc(100vh - 120px)' }}
    >
      <div className="p-2 text-xs text-gray-500 font-medium border-b border-gray-200 sticky top-0 bg-gray-50 z-10">
        页面预览
      </div>

      {isLoading && thumbnails.size === 0 && (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      <div className="p-2 space-y-2">
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
          const thumbnail = thumbnails.get(pageNum);
          const isCurrentPage = pageNum === currentPage;

          return (
            <div
              key={pageNum}
              ref={isCurrentPage ? currentPageRef : null}
              onClick={() => onPageSelect(pageNum)}
              className={`
                cursor-pointer rounded-lg overflow-hidden transition-all
                ${isCurrentPage
                  ? 'ring-2 ring-blue-500 ring-offset-2'
                  : 'hover:ring-2 hover:ring-gray-300 hover:ring-offset-1'
                }
              `}
            >
              {thumbnail ? (
                <img
                  src={thumbnail}
                  alt={`第 ${pageNum} 页`}
                  className="w-full bg-white shadow-sm"
                />
              ) : (
                <div
                  className="w-full bg-gray-200 flex items-center justify-center"
                  style={{ aspectRatio: '0.707' }} // A4 比例
                >
                  <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              <div
                className={`
                  text-center text-xs py-1
                  ${isCurrentPage ? 'text-blue-600 font-medium' : 'text-gray-500'}
                `}
              >
                {pageNum}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
