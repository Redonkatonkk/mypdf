/**
 * 工具栏组件
 */
import type { ToolType } from '../types';

interface ToolbarProps {
  currentTool: ToolType;
  onToolChange: (tool: ToolType) => void;
  onUndo: () => void;
  onRedo: () => void;
  onDownload: () => void;
  onPrint: () => void;
  canUndo: boolean;
  canRedo: boolean;
  disabled?: boolean;
}

export function Toolbar({
  currentTool,
  onToolChange,
  onUndo,
  onRedo,
  onDownload,
  onPrint,
  canUndo,
  canRedo,
  disabled = false,
}: ToolbarProps) {
  const tools: { id: ToolType; label: string; icon: string }[] = [
    { id: 'select', label: '选择', icon: '↖' },
    { id: 'text', label: '文本', icon: 'T' },
    { id: 'check', label: '勾选', icon: '\u2713' },  // ✓ 使用 Unicode 避免 emoji
    { id: 'cross', label: '叉号', icon: '\u2717' },  // ✗ 使用 Unicode 避免 emoji
    { id: 'signature', label: '签名', icon: '\u270D' },  // ✍ 签名图标
  ];

  return (
    <div className="flex items-center gap-4 p-2 bg-white rounded-lg shadow-md">
      {/* 工具按钮 */}
      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-500 px-2">工具</span>
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => onToolChange(tool.id)}
            disabled={disabled}
            className={`
              w-10 h-10 flex items-center justify-center rounded-lg
              text-lg font-medium transition-colors
              ${currentTool === tool.id
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
            title={tool.label}
          >
            {tool.icon}
          </button>
        ))}
      </div>

      {/* 分隔线 */}
      <div className="border-l border-gray-200 h-8" />

      {/* 撤销/重做 */}
      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-500 px-2">编辑</span>
        <button
          onClick={onUndo}
          disabled={disabled || !canUndo}
          className={`
            w-10 h-10 flex items-center justify-center rounded-lg
            text-lg transition-colors
            ${canUndo && !disabled
              ? 'bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-pointer'
              : 'bg-gray-50 text-gray-300 cursor-not-allowed'
            }
          `}
          title="撤销"
        >
          ↩
        </button>
        <button
          onClick={onRedo}
          disabled={disabled || !canRedo}
          className={`
            w-10 h-10 flex items-center justify-center rounded-lg
            text-lg transition-colors
            ${canRedo && !disabled
              ? 'bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-pointer'
              : 'bg-gray-50 text-gray-300 cursor-not-allowed'
            }
          `}
          title="重做"
        >
          ↪
        </button>
      </div>

      {/* 分隔线 */}
      <div className="border-l border-gray-200 h-8" />

      {/* 导出按钮 */}
      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-500 px-2">导出</span>
        <button
          onClick={onDownload}
          disabled={disabled}
          className={`
            w-10 h-10 flex items-center justify-center rounded-lg
            text-lg transition-colors
            ${!disabled
              ? 'bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-pointer'
              : 'bg-gray-50 text-gray-300 cursor-not-allowed'
            }
          `}
          title="下载"
        >
          ⬇
        </button>
        <button
          onClick={onPrint}
          disabled={disabled}
          className={`
            w-10 h-10 flex items-center justify-center rounded-lg
            text-lg transition-colors
            ${!disabled
              ? 'bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-pointer'
              : 'bg-gray-50 text-gray-300 cursor-not-allowed'
            }
          `}
          title="打印"
        >
          🖨
        </button>
      </div>
    </div>
  );
}
