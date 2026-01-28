/**
 * PDF网页处理应用 - 主组件
 */
import { useState, useCallback, useRef } from 'react';
import { FileUploader } from './components/FileUploader';
import { PDFViewer } from './components/PDFViewer';
import { PDFEditor } from './components/PDFEditor';
import type { SelectedTextInfo } from './types';
import { TextFormatToolbar } from './components/TextFormatToolbar';
import { SignatureModal } from './components/SignatureModal';
import { Toolbar } from './components/Toolbar';
import { usePDFDocument } from './hooks/usePDFDocument';
import { useAnnotations } from './hooks/useAnnotations';
import { mergeAnnotationsToPdf, downloadPdf, printPdf } from './utils/pdfUtils';
import { isAllowedFile } from './utils/fileUtils';
import type { ToolType } from './types';

function App() {
  const [currentTool, setCurrentTool] = useState<ToolType>('select');
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectedText, setSelectedText] = useState<SelectedTextInfo | null>(null);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [pendingSignaturePos, setPendingSignaturePos] = useState<{ x: number; y: number } | null>(null);

  const pdfDoc = usePDFDocument();
  const annotationManager = useAnnotations();

  const containerRef = useRef<HTMLDivElement>(null);

  // 显示消息
  const showMessage = useCallback((type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  }, []);

  // 处理文件上传
  const handleUpload = useCallback(async (file: File) => {
    if (!isAllowedFile(file)) {
      showMessage('error', '不支持的文件格式，请上传PDF、DOC或DOCX文件');
      return;
    }

    try {
      const response = await pdfDoc.uploadFile(file);
      showMessage('success', response.message);
      annotationManager.clear();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '上传失败';
      showMessage('error', errorMessage);
    }
  }, [pdfDoc, annotationManager, showMessage]);

  // 处理页面渲染完成
  const handlePageRender = useCallback((canvas: HTMLCanvasElement) => {
    setPageSize({
      width: canvas.width,
      height: canvas.height,
    });
  }, []);

  // 处理下载
  const handleDownload = useCallback(async () => {
    if (!pdfDoc.pdfUrl) return;

    try {
      const pdfBytes = await mergeAnnotationsToPdf(pdfDoc.pdfUrl, annotationManager.annotations);
      downloadPdf(pdfBytes, `${pdfDoc.fileName || 'document'}_edited.pdf`);
      showMessage('success', '下载成功');
    } catch (error) {
      console.error('下载失败:', error);
      showMessage('error', '下载失败');
    }
  }, [pdfDoc.pdfUrl, pdfDoc.fileName, annotationManager.annotations, showMessage]);

  // 处理打印
  const handlePrint = useCallback(async () => {
    if (!pdfDoc.pdfUrl) return;

    try {
      const pdfBytes = await mergeAnnotationsToPdf(pdfDoc.pdfUrl, annotationManager.annotations);
      printPdf(pdfBytes);
    } catch (error) {
      console.error('打印失败:', error);
      showMessage('error', '打印失败');
    }
  }, [pdfDoc.pdfUrl, annotationManager.annotations, showMessage]);

  // 新建/重新上传
  const handleNewFile = useCallback(() => {
    pdfDoc.reset();
    annotationManager.clear();
    setPageSize({ width: 0, height: 0 });
    setSelectedText(null);
  }, [pdfDoc, annotationManager]);

  // 处理文本格式变化
  const handleTextFormatChange = useCallback((property: string, value: string | number | boolean) => {
    const updateFn = (window as unknown as { updateSelectedTextFormat?: (p: string, v: string | number | boolean) => void }).updateSelectedTextFormat;
    if (updateFn) {
      updateFn(property, value);
    }
  }, []);

  // 处理签名工具点击
  const handleSignatureClick = useCallback((x: number, y: number, _page: number, _pageWidth: number, _pageHeight: number) => {
    setPendingSignaturePos({ x, y });
    setShowSignatureModal(true);
  }, []);

  // 处理签名确认
  const handleSignatureConfirm = useCallback((imageData: string, width: number, height: number) => {
    if (!pendingSignaturePos) return;

    // 创建签名标注
    const annotation = annotationManager.addAnnotation(
      'signature',
      pendingSignaturePos.x,
      pendingSignaturePos.y,
      pdfDoc.currentPage,
      pageSize.width / pdfDoc.scale,
      pageSize.height / pdfDoc.scale,
      {
        imageData,
        width,
        height,
      }
    );

    console.log('签名已添加:', annotation);

    // 重置状态
    setShowSignatureModal(false);
    setPendingSignaturePos(null);
    setCurrentTool('select');
  }, [pendingSignaturePos, annotationManager, pdfDoc.currentPage, pdfDoc.scale, pageSize]);

  // 处理签名取消
  const handleSignatureCancel = useCallback(() => {
    setShowSignatureModal(false);
    setPendingSignaturePos(null);
  }, []);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* 顶部导航栏 */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold text-gray-800">PDF 处理工具</h1>
            {pdfDoc.fileName && (
              <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                {pdfDoc.fileName}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {pdfDoc.pdfUrl && (
              <button
                onClick={handleNewFile}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              >
                重新上传
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 消息提示 */}
      {message && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg ${message.type === 'success'
              ? 'bg-green-500 text-white'
              : 'bg-red-500 text-white'
            }`}
        >
          {message.text}
        </div>
      )}

      {/* 文本格式化工具栏 */}
      {selectedText && (
        <TextFormatToolbar
          visible={true}
          initialValues={{
            fontFamily: selectedText.fontFamily,
            fontSize: selectedText.fontSize,
            fill: selectedText.fill,
            fontWeight: selectedText.fontWeight,
            underline: selectedText.underline,
          }}
          onChange={handleTextFormatChange}
        />
      )}

      {/* 签名弹窗 */}
      <SignatureModal
        visible={showSignatureModal}
        onConfirm={handleSignatureConfirm}
        onCancel={handleSignatureCancel}
      />

      {/* 主内容区 */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {!pdfDoc.pdfUrl ? (
          /* 上传区域 */
          <div className="max-w-xl mx-auto mt-20">
            <FileUploader
              onUpload={handleUpload}
              isLoading={pdfDoc.isLoading}
            />

            {pdfDoc.error && (
              <p className="mt-4 text-center text-red-500">{pdfDoc.error}</p>
            )}
          </div>
        ) : (
          /* 编辑区域 */
          <div className="flex flex-col gap-4">
            {/* 顶部工具栏 */}
            <div className="flex justify-center">
              <Toolbar
                currentTool={currentTool}
                onToolChange={setCurrentTool}
                onUndo={annotationManager.undo}
                onRedo={annotationManager.redo}
                onDownload={handleDownload}
                onPrint={handlePrint}
                canUndo={annotationManager.canUndo}
                canRedo={annotationManager.canRedo}
              />
            </div>

            {/* PDF预览和编辑区 */}
            <div className="flex-1 flex flex-col items-center">
              {/* PDF查看器 */}
              <div
                ref={containerRef}
                className="relative bg-gray-200 rounded-lg overflow-auto"
                style={{ maxHeight: 'calc(100vh - 200px)' }}
              >
                <div className="relative inline-block">
                  <PDFViewer
                    url={pdfDoc.pdfUrl}
                    page={pdfDoc.currentPage}
                    scale={pdfDoc.scale}
                    onLoadSuccess={pdfDoc.setTotalPages}
                    onPageRender={handlePageRender}
                  />

                  {/* 编辑层 */}
                  {pageSize.width > 0 && (
                    <PDFEditor
                      width={pageSize.width}
                      height={pageSize.height}
                      scale={pdfDoc.scale}
                      currentTool={currentTool}
                      annotations={annotationManager.annotations}
                      currentPage={pdfDoc.currentPage}
                      onAddAnnotation={annotationManager.addAnnotation}
                      onUpdateAnnotation={annotationManager.updateAnnotation}
                      onRemoveAnnotation={annotationManager.removeAnnotation}
                      onToolChange={setCurrentTool}
                      onTextSelect={setSelectedText}
                      onSignatureClick={handleSignatureClick}
                    />
                  )}
                </div>
              </div>

              {/* 页面控制 - 固定在视口底部 */}
              <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-4 bg-white px-4 py-2 rounded-lg shadow-lg">
                <button
                  onClick={pdfDoc.prevPage}
                  disabled={pdfDoc.currentPage <= 1}
                  className="px-3 py-1 text-gray-600 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ◀
                </button>

                <span className="text-sm text-gray-600">
                  第 {pdfDoc.currentPage} / {pdfDoc.totalPages} 页
                </span>

                <button
                  onClick={pdfDoc.nextPage}
                  disabled={pdfDoc.currentPage >= pdfDoc.totalPages}
                  className="px-3 py-1 text-gray-600 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ▶
                </button>

                <div className="border-l border-gray-300 h-6 mx-2" />

                <button
                  onClick={pdfDoc.zoomOut}
                  disabled={pdfDoc.scale <= 0.5}
                  className="px-3 py-1 text-gray-600 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  −
                </button>

                <span className="text-sm text-gray-600 min-w-[60px] text-center">
                  {Math.round(pdfDoc.scale * 100)}%
                </span>

                <button
                  onClick={pdfDoc.zoomIn}
                  disabled={pdfDoc.scale >= 3}
                  className="px-3 py-1 text-gray-600 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
