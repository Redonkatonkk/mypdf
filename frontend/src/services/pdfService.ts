/**
 * PDF操作服务
 */
import { api } from './api';
import type { UploadResponse, FormFieldsResponse, Annotation } from '../types';

export const pdfService = {
  /**
   * 上传文件
   */
  async upload(file: File): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return api.postFormData<UploadResponse>('/upload', formData);
  },

  /**
   * 获取文件URL
   */
  getFileUrl(fileId: string): string {
    return api.getFileUrl(fileId);
  },

  /**
   * 获取表单字段
   */
  async getFormFields(fileId: string): Promise<FormFieldsResponse> {
    return api.get<FormFieldsResponse>(`/forms/${fileId}/fields`);
  },

  /**
   * 填充表单
   */
  async fillForm(fileId: string, fields: Record<string, unknown>): Promise<{ fileId: string; pdfUrl: string }> {
    return api.post(`/forms/${fileId}/fill`, { fields });
  },

  /**
   * 导出PDF（预留）
   */
  async exportPdf(fileId: string, annotations: Annotation[]): Promise<Blob> {
    const response = await fetch(`/api/export`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fileId, annotations }),
    });
    if (!response.ok) {
      throw new Error('导出失败');
    }
    return response.blob();
  },

  /**
   * 删除文件
   */
  async deleteFile(fileId: string): Promise<void> {
    return api.delete(`/file/${fileId}`);
  },
};
