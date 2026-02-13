/**
 * PDF文档管理Hook
 */
import { useState, useCallback } from 'react';
import { pdfService } from '../services/pdfService';
import type { PDFDocumentState } from '../types';

/**
 * 将 base64 编码的 PDF 数据转换为 Blob URL
 */
function base64ToBlobUrl(base64Data: string): string {
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: 'application/pdf' });
  return URL.createObjectURL(blob);
}

const initialState: PDFDocumentState = {
  fileId: null,
  fileName: null,
  pdfUrl: null,
  totalPages: 1,
  currentPage: 1,
  scale: 1.0,
  isLoading: false,
  error: null,
};

export function usePDFDocument() {
  const [state, setState] = useState<PDFDocumentState>(initialState);

  // 上传文件
  const uploadFile = useCallback(async (file: File) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await pdfService.upload(file);
      // 直接使用上传响应中的 base64 数据创建 Blob URL（完全绕过 IDM 拦截）
      const blobUrl = base64ToBlobUrl(response.pdfData);
      setState(prev => ({
        ...prev,
        fileId: response.fileId,
        fileName: response.fileName,
        pdfUrl: blobUrl,
        isLoading: false,
        currentPage: 1,
      }));
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : '上传失败';
      setState(prev => ({ ...prev, isLoading: false, error: message }));
      throw error;
    }
  }, []);

  // 设置总页数
  const setTotalPages = useCallback((pages: number) => {
    setState(prev => ({ ...prev, totalPages: pages }));
  }, []);

  // 切换页面
  const goToPage = useCallback((page: number) => {
    setState(prev => {
      const newPage = Math.max(1, Math.min(page, prev.totalPages));
      return { ...prev, currentPage: newPage };
    });
  }, []);

  // 上一页
  const prevPage = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentPage: Math.max(1, prev.currentPage - 1),
    }));
  }, []);

  // 下一页
  const nextPage = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentPage: Math.min(prev.totalPages, prev.currentPage + 1),
    }));
  }, []);

  // 缩放
  const setScale = useCallback((scale: number) => {
    setState(prev => ({
      ...prev,
      scale: Math.max(0.5, Math.min(3.0, scale)),
    }));
  }, []);

  // 放大
  const zoomIn = useCallback(() => {
    setState(prev => ({
      ...prev,
      scale: Math.min(3.0, prev.scale + 0.25),
    }));
  }, []);

  // 缩小
  const zoomOut = useCallback(() => {
    setState(prev => ({
      ...prev,
      scale: Math.max(0.5, prev.scale - 0.25),
    }));
  }, []);

  // 重置
  const reset = useCallback(() => {
    // 清理 Blob URL 防止内存泄漏
    if (state.pdfUrl && state.pdfUrl.startsWith('blob:')) {
      URL.revokeObjectURL(state.pdfUrl);
    }
    setState(initialState);
  }, [state.pdfUrl]);

  // 清除错误
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    uploadFile,
    setTotalPages,
    goToPage,
    prevPage,
    nextPage,
    setScale,
    zoomIn,
    zoomOut,
    reset,
    clearError,
  };
}
