/**
 * 内联表单输入组件
 *
 * 用于在 PDF 页面上渲染透明的表单输入元素
 */
import { useCallback } from 'react';
import type { FormField } from '../types';
import type { ScreenRect } from '../utils/coordinateUtils';

interface InlineFormInputProps {
  field: FormField;
  position: ScreenRect;
  value: string | boolean;
  onChange: (fieldId: string, value: string | boolean) => void;
  disabled?: boolean;
}

export function InlineFormInput({
  field,
  position,
  value,
  onChange,
  disabled = false,
}: InlineFormInputProps) {
  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      onChange(field.id, e.target.value);
    },
    [field.id, onChange]
  );

  const handleCheckboxChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(field.id, e.target.checked);
    },
    [field.id, onChange]
  );

  // 根据高度计算字体大小（自适应）
  const fontSize = Math.max(Math.min(position.height * 0.7, 16), 10);

  const baseStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${position.left}px`,
    top: `${position.top}px`,
    width: `${position.width}px`,
    height: `${position.height}px`,
    boxSizing: 'border-box',
    border: '1px solid rgba(59, 130, 246, 0.5)',
    borderRadius: '2px',
    outline: 'none',
    backgroundColor: disabled
      ? 'rgba(200, 200, 200, 0.3)'
      : 'rgba(255, 255, 255, 0.8)',
    transition: 'border-color 0.2s, background-color 0.2s',
  };

  // 文本输入框
  if (field.type === 'text') {
    return (
      <input
        type="text"
        value={typeof value === 'string' ? value : ''}
        onChange={handleTextChange}
        disabled={disabled || field.isReadonly}
        maxLength={field.maxLength}
        style={{
          ...baseStyle,
          fontSize: `${fontSize}px`,
          padding: '2px 4px',
          fontFamily: 'inherit',
          color: '#333',
        }}
        className="focus:border-blue-500 focus:bg-white hover:border-blue-400"
      />
    );
  }

  // 复选框
  if (field.type === 'checkbox') {
    const checkboxSize = Math.min(position.width, position.height) * 0.8;
    const isChecked = Boolean(value);

    console.log('[Checkbox] Render:', field.id, 'value:', value, 'isChecked:', isChecked);

    const handleToggle = () => {
      console.log('[Checkbox] Toggle:', field.id, 'current:', isChecked, 'new:', !isChecked);
      if (!disabled && !field.isReadonly) {
        onChange(field.id, !isChecked);
      }
    };

    return (
      <div
        style={{
          ...baseStyle,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: disabled || field.isReadonly ? 'not-allowed' : 'pointer',
        }}
        onClick={handleToggle}
      >
        {/* 使用自定义复选框样式避免原生 checkbox 的状态同步问题 */}
        <div
          style={{
            width: `${checkboxSize}px`,
            height: `${checkboxSize}px`,
            border: '2px solid #3b82f6',
            borderRadius: '3px',
            backgroundColor: isChecked ? '#3b82f6' : 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease',
          }}
        >
          {isChecked && (
            <svg
              width={checkboxSize * 0.7}
              height={checkboxSize * 0.7}
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="4 12 9 17 20 6" />
            </svg>
          )}
        </div>
      </div>
    );
  }

  // 下拉选择框
  if (field.type === 'dropdown') {
    return (
      <select
        value={typeof value === 'string' ? value : ''}
        onChange={handleTextChange}
        disabled={disabled || field.isReadonly}
        style={{
          ...baseStyle,
          fontSize: `${fontSize}px`,
          padding: '0 4px',
          fontFamily: 'inherit',
          color: '#333',
          cursor: disabled || field.isReadonly ? 'not-allowed' : 'pointer',
        }}
        className="focus:border-blue-500 focus:bg-white hover:border-blue-400"
      >
        <option value="">-- 请选择 --</option>
        {field.options?.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }

  // 签名字段（显示占位符）
  if (field.type === 'signature') {
    return (
      <div
        style={{
          ...baseStyle,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: `${fontSize}px`,
          color: '#999',
          backgroundColor: 'rgba(200, 200, 200, 0.3)',
          cursor: 'not-allowed',
        }}
      >
        签名
      </div>
    );
  }

  // 未知类型
  return (
    <div
      style={{
        ...baseStyle,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: `${fontSize * 0.8}px`,
        color: '#999',
        backgroundColor: 'rgba(200, 200, 200, 0.2)',
      }}
    >
      ?
    </div>
  );
}
