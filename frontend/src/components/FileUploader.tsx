/**
 * 文件上传组件
 */
import { useCallback, useState } from 'react';

interface FileUploaderProps {
  onUpload: (file: File) => void;
  isLoading?: boolean;
  accept?: string;
}

export function FileUploader({
  onUpload,
  isLoading = false,
  accept = '.pdf,.doc,.docx'
}: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      onUpload(files[0]);
    }
  }, [onUpload]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onUpload(files[0]);
    }
    // 清空input以便重复选择同一文件
    e.target.value = '';
  }, [onUpload]);

  return (
    <div
      className={`
        relative border-2 border-dashed rounded-lg p-8
        flex flex-col items-center justify-center
        transition-colors cursor-pointer
        ${isDragging
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-300 hover:border-gray-400 bg-white'
        }
        ${isLoading ? 'opacity-50 pointer-events-none' : ''}
      `}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => document.getElementById('file-input')?.click()}
    >
      <input
        id="file-input"
        type="file"
        accept={accept}
        onChange={handleFileSelect}
        className="hidden"
        disabled={isLoading}
      />

      {isLoading ? (
        <div className="flex flex-col items-center">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-gray-600">正在处理...</p>
        </div>
      ) : (
        <>
          <svg
            className="w-12 h-12 text-gray-400 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <p className="text-gray-600 mb-2">
            拖拽文件到此处，或点击上传
          </p>
          <p className="text-gray-400 text-sm">
            支持 PDF、DOC、DOCX 格式
          </p>
        </>
      )}
    </div>
  );
}
