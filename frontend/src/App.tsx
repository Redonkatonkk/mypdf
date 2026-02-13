/**
 * PDF网页处理应用 - 主组件
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { FileUploader } from './components/FileUploader';
import { PDFViewer } from './components/PDFViewer';
import { PDFEditor } from './components/PDFEditor';
import { FormFieldOverlay } from './components/FormFieldOverlay';
import { PageThumbnails } from './components/PageThumbnails';
import type { SelectedTextInfo } from './types';
import { TextFormatToolbar } from './components/TextFormatToolbar';
import { SignatureModal } from './components/SignatureModal';
import { Toolbar } from './components/Toolbar';
import { usePDFDocument } from './hooks/usePDFDocument';
import { useAnnotations } from './hooks/useAnnotations';
import { useFormFields } from './hooks/useFormFields';
import { mergeAnnotationsToPdf, downloadPdf, printPdf } from './utils/pdfUtils';
import { isAllowedFile } from './utils/fileUtils';
import { pdfService } from './services/pdfService';
import type { ToolType } from './types';

function App() {
  const [currentTool, setCurrentTool] = useState<ToolType>('select');
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });
  const [originalPageSize, setOriginalPageSize] = useState({ width: 0, height: 0 });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectedText, setSelectedText] = useState<SelectedTextInfo | null>(null);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [pendingSignaturePos, setPendingSignaturePos] = useState<{ x: number; y: number } | null>(null);

  // 表单模式状态
  const [isFormMode, setIsFormMode] = useState(false);

  const pdfDoc = usePDFDocument();
  const annotationManager = useAnnotations();
  const formFields = useFormFields();

  // Debug: 监控表单值变化
  console.log('[App] formFields.values:', formFields.values);

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
      formFields.reset();
      setIsFormMode(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '上传失败';
      showMessage('error', errorMessage);
    }
  }, [pdfDoc, annotationManager, formFields, showMessage]);

  // PDF 加载成功后检测表单
  useEffect(() => {
    if (pdfDoc.fileId) {
      formFields.loadFields(pdfDoc.fileId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfDoc.fileId]);

  // 自动进入表单模式（如果有可填写字段）
  useEffect(() => {
    if (formFields.hasForm) {
      setIsFormMode(true);
    }
  }, [formFields.hasForm]);

  // 处理页面渲染完成
  const handlePageRender = useCallback((canvas: HTMLCanvasElement) => {
    setPageSize({
      width: canvas.width,
      height: canvas.height,
    });
  }, []);

  // 处理页面尺寸变化（包含原始尺寸）
  const handlePageSizeChange = useCallback((size: {
    width: number;
    height: number;
    scaledWidth: number;
    scaledHeight: number;
  }) => {
    setOriginalPageSize({ width: size.width, height: size.height });
  }, []);

  // 获取填充后的 PDF URL（如果在表单模式下）
  const getFilledPdfUrl = useCallback(async (): Promise<string | null> => {
    if (!pdfDoc.fileId || !pdfDoc.pdfUrl) return null;

    // 如果在表单模式且有填写值，先提交表单获取填充后的 PDF
    if (isFormMode && Object.keys(formFields.values).length > 0) {
      try {
        console.log('[getFilledPdfUrl] Submitting form values:', formFields.values);
        const result = await pdfService.fillForm(pdfDoc.fileId, formFields.values);
        console.log('[getFilledPdfUrl] Fill result:', result);
        // 使用 Blob URL 绕过 IDM 拦截
        return await pdfService.getBlobUrl(result.fileId);
      } catch (error) {
        console.error('填充表单失败:', error);
        // 失败时使用原始 PDF
        return pdfDoc.pdfUrl;
      }
    }

    return pdfDoc.pdfUrl;
  }, [pdfDoc.fileId, pdfDoc.pdfUrl, isFormMode, formFields.values]);

  // 处理下载
  const handleDownload = useCallback(async () => {
    if (!pdfDoc.pdfUrl) return;

    try {
      // 获取填充后的 PDF URL
      const pdfUrl = await getFilledPdfUrl() || pdfDoc.pdfUrl;
      const pdfBytes = await mergeAnnotationsToPdf(pdfUrl, annotationManager.annotations);
      downloadPdf(pdfBytes, `${pdfDoc.fileName || 'document'}_edited.pdf`);
      showMessage('success', '下载成功');
    } catch (error) {
      console.error('下载失败:', error);
      showMessage('error', '下载失败');
    }
  }, [pdfDoc.pdfUrl, pdfDoc.fileName, annotationManager.annotations, showMessage, getFilledPdfUrl]);

  // 处理打印
  const handlePrint = useCallback(async () => {
    if (!pdfDoc.pdfUrl) return;

    try {
      // 获取填充后的 PDF URL
      const pdfUrl = await getFilledPdfUrl() || pdfDoc.pdfUrl;
      const pdfBytes = await mergeAnnotationsToPdf(pdfUrl, annotationManager.annotations);
      printPdf(pdfBytes);
    } catch (error) {
      console.error('打印失败:', error);
      showMessage('error', '打印失败');
    }
  }, [pdfDoc.pdfUrl, annotationManager.annotations, showMessage, getFilledPdfUrl]);

  // 新建/重新上传
  const handleNewFile = useCallback(() => {
    pdfDoc.reset();
    annotationManager.clear();
    formFields.reset();
    setPageSize({ width: 0, height: 0 });
    setOriginalPageSize({ width: 0, height: 0 });
    setSelectedText(null);
    setIsFormMode(false);
  }, [pdfDoc, annotationManager, formFields]);

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
            <div className="flex justify-center items-center gap-2 flex-wrap">
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
              {/* 文本格式化工具栏 - 选中文本时显示 */}
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
            </div>

            {/* PDF预览和编辑区 */}
            <div className="flex-1 flex">
              {/* 左侧缩略图预览 */}
              <PageThumbnails
                url={pdfDoc.pdfUrl}
                totalPages={pdfDoc.totalPages}
                currentPage={pdfDoc.currentPage}
                onPageSelect={pdfDoc.goToPage}
              />

              {/* PDF查看器 */}
              <div className="flex-1 flex flex-col items-center overflow-auto">
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
                    onPageSizeChange={handlePageSizeChange}
                  />

                  {/* 编辑层 - 始终显示以支持工具使用 */}
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
                      onUpdateAnnotations={annotationManager.updateAnnotations}
                      onRemoveAnnotation={annotationManager.removeAnnotation}
                      onToolChange={setCurrentTool}
                      onTextSelect={setSelectedText}
                      onSignatureClick={handleSignatureClick}
                    />
                  )}

                  {/* 表单覆盖层 - 表单模式 */}
                  {isFormMode && originalPageSize.height > 0 && (
                    <FormFieldOverlay
                      fields={formFields.fields}
                      values={formFields.values}
                      currentPage={pdfDoc.currentPage}
                      pageHeight={originalPageSize.height}
                      scale={pdfDoc.scale}
                      onValueChange={formFields.setValue}
                    />
                  )}
                </div>
              </div>
              </div>
            </div>

              {/* 页面控制 - 固定在视口底部 */}
              <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-4 bg-white px-4 py-2 rounded-lg shadow-lg">
                <div className="relative group">
                  <button
                    onClick={pdfDoc.prevPage}
                    disabled={pdfDoc.currentPage <= 1}
                    className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                  </button>
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none">
                    上一页
                    <div className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-2 h-2 bg-gray-800 rotate-45" />
                  </div>
                </div>

                <span className="text-sm text-gray-600">
                  第 {pdfDoc.currentPage} / {pdfDoc.totalPages} 页
                </span>

                <div className="relative group">
                  <button
                    onClick={pdfDoc.nextPage}
                    disabled={pdfDoc.currentPage >= pdfDoc.totalPages}
                    className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none">
                    下一页
                    <div className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-2 h-2 bg-gray-800 rotate-45" />
                  </div>
                </div>

                <div className="border-l border-gray-300 h-6 mx-2" />

                <div className="relative group">
                  <button
                    onClick={pdfDoc.zoomOut}
                    disabled={pdfDoc.scale <= 0.5}
                    className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                      <line x1="8" y1="11" x2="14" y2="11" />
                    </svg>
                  </button>
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none">
                    缩小
                    <div className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-2 h-2 bg-gray-800 rotate-45" />
                  </div>
                </div>

                <span className="text-sm text-gray-600 min-w-[60px] text-center">
                  {Math.round(pdfDoc.scale * 100)}%
                </span>

                <div className="relative group">
                  <button
                    onClick={pdfDoc.zoomIn}
                    disabled={pdfDoc.scale >= 3}
                    className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                      <line x1="11" y1="8" x2="11" y2="14" />
                      <line x1="8" y1="11" x2="14" y2="11" />
                    </svg>
                  </button>
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none">
                    放大
                    <div className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-2 h-2 bg-gray-800 rotate-45" />
                  </div>
                </div>
              </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
