/**
 * 绘制工具栏组件
 * 用于设置笔画宽度和颜色
 */

interface DrawToolbarProps {
  visible: boolean;
  strokeWidth: number;
  strokeColor: string;
  onStrokeWidthChange: (width: number) => void;
  onStrokeColorChange: (color: string) => void;
}

const STROKE_WIDTHS = [1, 2, 3, 5, 8];
const PRESET_COLORS = [
  '#000000', // 黑色
  '#ef4444', // 红色
  '#3b82f6', // 蓝色
  '#22c55e', // 绿色
  '#f59e0b', // 橙色
  '#8b5cf6', // 紫色
];

export function DrawToolbar({
  visible,
  strokeWidth,
  strokeColor,
  onStrokeWidthChange,
  onStrokeColorChange,
}: DrawToolbarProps) {
  if (!visible) return null;

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-white px-4 py-2 rounded-lg shadow-lg border border-gray-200">
      {/* 笔画宽度 */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">粗细</span>
        <select
          value={strokeWidth}
          onChange={(e) => onStrokeWidthChange(Number(e.target.value))}
          className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {STROKE_WIDTHS.map((w) => (
            <option key={w} value={w}>
              {w}px
            </option>
          ))}
        </select>
      </div>

      {/* 分隔线 */}
      <div className="border-l border-gray-200 h-6" />

      {/* 颜色选择 */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">颜色</span>
        <div className="flex items-center gap-1">
          {PRESET_COLORS.map((color) => (
            <button
              key={color}
              onClick={() => onStrokeColorChange(color)}
              className={`w-6 h-6 rounded-full border-2 transition-transform ${
                strokeColor === color
                  ? 'border-blue-500 scale-110'
                  : 'border-gray-300 hover:scale-105'
              }`}
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
          {/* 自定义颜色选择器 */}
          <input
            type="color"
            value={strokeColor}
            onChange={(e) => onStrokeColorChange(e.target.value)}
            className="w-6 h-6 cursor-pointer border border-gray-300 rounded"
            title="自定义颜色"
          />
        </div>
      </div>
    </div>
  );
}
