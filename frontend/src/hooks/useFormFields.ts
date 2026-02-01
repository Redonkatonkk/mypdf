/**
 * 表单字段状态管理 Hook
 */
import { useState, useCallback } from 'react';
import type { FormField, FillFormResult } from '../types';
import { pdfService } from '../services/pdfService';

export interface UseFormFieldsReturn {
  fields: FormField[];
  values: Record<string, string | boolean>;
  isLoading: boolean;
  error: string | null;
  hasForm: boolean;
  loadFields: (fileId: string) => Promise<void>;
  setValue: (fieldId: string, value: string | boolean) => void;
  submitForm: (fileId: string) => Promise<FillFormResult>;
  reset: () => void;
}

export function useFormFields(): UseFormFieldsReturn {
  const [fields, setFields] = useState<FormField[]>([]);
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasForm, setHasForm] = useState(false);

  // 加载表单字段
  const loadFields = useCallback(async (fileId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await pdfService.getFormFields(fileId);
      setFields(response.fields);
      setHasForm(response.hasForm);

      // 初始化值
      const initialValues: Record<string, string | boolean> = {};
      response.fields.forEach((field) => {
        if (field.type === 'checkbox') {
          // 复选框：将值转换为布尔值
          // PDF 中复选框的选中值通常是 "/Yes", "Yes", "On", "1", true
          // 未选中值通常是 "/Off", "Off", "No", "0", false, null, undefined, ""
          const val = field.value;
          const isChecked = val === true ||
            val === '/Yes' ||
            val === 'Yes' ||
            val === 'On' ||
            val === '1';
          initialValues[field.id] = isChecked;
        } else if (field.value !== null && field.value !== undefined) {
          initialValues[field.id] = field.value;
        } else {
          initialValues[field.id] = '';
        }
      });
      setValues(initialValues);
    } catch (err) {
      const message = err instanceof Error ? err.message : '加载表单字段失败';
      setError(message);
      setFields([]);
      setHasForm(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 更新字段值
  const setValue = useCallback((fieldId: string, value: string | boolean) => {
    setValues((prev) => ({
      ...prev,
      [fieldId]: value,
    }));
  }, []);

  // 提交表单
  const submitForm = useCallback(async (fileId: string): Promise<FillFormResult> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await pdfService.fillForm(fileId, values);
      return {
        fileId: response.fileId,
        pdfUrl: response.pdfUrl,
        message: '表单填充成功',
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : '提交表单失败';
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  }, [values]);

  // 重置状态
  const reset = useCallback(() => {
    setFields([]);
    setValues({});
    setError(null);
    setHasForm(false);
  }, []);

  return {
    fields,
    values,
    isLoading,
    error,
    hasForm,
    loadFields,
    setValue,
    submitForm,
    reset,
  };
}
