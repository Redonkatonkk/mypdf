/**
 * 表单字段覆盖层组件
 *
 * 在 PDF Canvas 上绝对定位覆盖 HTML 表单输入元素
 */
import { useMemo } from 'react';
import type { FormField } from '../types';
import { pdfToScreen } from '../utils/coordinateUtils';
import { InlineFormInput } from './InlineFormInput';

interface FormFieldOverlayProps {
  fields: FormField[];
  values: Record<string, string | boolean>;
  currentPage: number;
  pageHeight: number;  // PDF 页面高度（scale=1）
  scale: number;
  onValueChange: (fieldId: string, value: string | boolean) => void;
  disabled?: boolean;
}

export function FormFieldOverlay({
  fields,
  values,
  currentPage,
  pageHeight,
  scale,
  onValueChange,
  disabled = false,
}: FormFieldOverlayProps) {
  console.log('[FormFieldOverlay] Render, values:', values);
  // 过滤当前页面的字段
  const currentPageFields = useMemo(() => {
    return fields.filter((field) => {
      // pageIndex 从 0 开始，currentPage 从 1 开始
      const fieldPage = (field.pageIndex ?? 0) + 1;
      return fieldPage === currentPage && field.rect;
    });
  }, [fields, currentPage]);

  if (currentPageFields.length === 0) {
    return null;
  }

  return (
    <div
      className="form-field-overlay"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',  // 允许点击穿透到非输入区域
        zIndex: 10,
      }}
    >
      {currentPageFields.map((field) => {
        if (!field.rect) return null;

        const position = pdfToScreen(
          {
            x: field.rect.x,
            y: field.rect.y,
            width: field.rect.width,
            height: field.rect.height,
          },
          pageHeight,
          scale
        );

        const fieldValue = values[field.id];
        if (field.type === 'checkbox') {
          console.log('[FormFieldOverlay] Checkbox field:', field.id, 'value from values:', fieldValue);
        }

        return (
          <div
            key={field.id}
            style={{
              pointerEvents: 'auto',  // 重新启用输入元素的交互
            }}
          >
            <InlineFormInput
              field={field}
              position={position}
              value={fieldValue ?? ''}
              onChange={onValueChange}
              disabled={disabled}
            />
          </div>
        );
      })}
    </div>
  );
}
