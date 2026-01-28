/**
 * 文本格式化工具栏
 */
import { useState, useEffect } from 'react';

interface TextFormatToolbarProps {
  visible: boolean;
  initialValues: {
    fontFamily: string;
    fontSize: number;
    fill: string;
    fontWeight: string;
    underline: boolean;
  };
  onChange: (property: string, value: string | number | boolean) => void;
}

const FONTS = [
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Times New Roman', value: 'Times New Roman, serif' },
  { label: 'Courier New', value: 'Courier New, monospace' },
  { label: '思源黑体', value: '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif' },
  { label: '思源宋体', value: '"Noto Serif SC", "Songti SC", SimSun, serif' },
];

const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 36, 48];

export function TextFormatToolbar({
  visible,
  initialValues,
  onChange,
}: TextFormatToolbarProps) {
  const [fontFamily, setFontFamily] = useState(initialValues.fontFamily);
  const [fontSize, setFontSize] = useState(initialValues.fontSize);
  const [fill, setFill] = useState(initialValues.fill);
  const [isBold, setIsBold] = useState(initialValues.fontWeight === 'bold');
  const [isUnderline, setIsUnderline] = useState(initialValues.underline);

  // 同步外部值
  useEffect(() => {
    setFontFamily(initialValues.fontFamily);
    setFontSize(initialValues.fontSize);
    setFill(initialValues.fill);
    setIsBold(initialValues.fontWeight === 'bold');
    setIsUnderline(initialValues.underline);
  }, [initialValues]);

  if (!visible) return null;

  const handleFontFamilyChange = (value: string) => {
    setFontFamily(value);
    onChange('fontFamily', value);
  };

  const handleFontSizeChange = (value: number) => {
    setFontSize(value);
    onChange('fontSize', value);
  };

  const handleColorChange = (value: string) => {
    setFill(value);
    onChange('fill', value);
  };

  const handleBoldToggle = () => {
    const newValue = !isBold;
    setIsBold(newValue);
    onChange('fontWeight', newValue ? 'bold' : 'normal');
  };

  const handleUnderlineToggle = () => {
    const newValue = !isUnderline;
    setIsUnderline(newValue);
    onChange('underline', newValue);
  };

  return (
    <div
      className="fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-2 flex items-center gap-2 left-1/2 -translate-x-1/2"
      style={{
        top: 130,
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* 字体选择 */}
      <select
        value={fontFamily}
        onChange={(e) => handleFontFamilyChange(e.target.value)}
        className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500"
      >
        {FONTS.map((font) => (
          <option key={font.value} value={font.value}>
            {font.label}
          </option>
        ))}
      </select>

      {/* 字号选择 */}
      <select
        value={fontSize}
        onChange={(e) => handleFontSizeChange(Number(e.target.value))}
        className="px-2 py-1 border border-gray-300 rounded text-sm w-16 focus:outline-none focus:border-blue-500"
      >
        {FONT_SIZES.map((size) => (
          <option key={size} value={size}>
            {size}
          </option>
        ))}
      </select>

      {/* 分隔线 */}
      <div className="w-px h-6 bg-gray-300" />

      {/* 颜色选择 */}
      <input
        type="color"
        value={fill}
        onChange={(e) => handleColorChange(e.target.value)}
        className="w-8 h-8 border border-gray-300 rounded cursor-pointer"
        title="文字颜色"
      />

      {/* 分隔线 */}
      <div className="w-px h-6 bg-gray-300" />

      {/* 加粗 */}
      <button
        onClick={handleBoldToggle}
        className={`w-8 h-8 flex items-center justify-center rounded font-bold text-sm transition-colors ${isBold
          ? 'bg-blue-500 text-white'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        title="加粗"
      >
        B
      </button>

      {/* 下划线 */}
      <button
        onClick={handleUnderlineToggle}
        className={`w-8 h-8 flex items-center justify-center rounded text-sm transition-colors ${isUnderline
          ? 'bg-blue-500 text-white'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        title="下划线"
      >
        <span className="underline">U</span>
      </button>
    </div>
  );
}
