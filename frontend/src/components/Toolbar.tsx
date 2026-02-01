/**
 * 工具栏组件 - 使用 SVG 矢量图标
 */
import type { ToolType } from '../types';

// SVG 图标组件
const Icons = {
  // 选择光标
  select: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
      <path d="M13 13l6 6" />
    </svg>
  ),
  // 文本
  text: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 7 4 4 20 4 20 7" />
      <line x1="9" y1="20" x2="15" y2="20" />
      <line x1="12" y1="4" x2="12" y2="20" />
    </svg>
  ),
  // 勾选
  check: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 12 9 17 20 6" />
    </svg>
  ),
  // 叉号
  cross: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="5" x2="19" y2="19" />
      <line x1="19" y1="5" x2="5" y2="19" />
    </svg>
  ),
  // 签名
  signature: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
      <path d="M15 5l4 4" />
    </svg>
  ),
  // 撤销
  undo: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7v6h6" />
      <path d="M3 13a9 9 0 0 1 15.36-6.36L21 9" />
    </svg>
  ),
  // 重做
  redo: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 7v6h-6" />
      <path d="M21 13a9 9 0 0 0-15.36-6.36L3 9" />
    </svg>
  ),
  // 下载
  download: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  ),
  // 打印
  print: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </svg>
  ),
};

// 带 Tooltip 的按钮组件
interface TooltipButtonProps {
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  tooltip: string;
  children: React.ReactNode;
}

function TooltipButton({ onClick, disabled, active, tooltip, children }: TooltipButtonProps) {
  return (
    <div className="relative group">
      <button
        onClick={onClick}
        disabled={disabled}
        className={`
          w-10 h-10 flex items-center justify-center rounded-lg
          transition-colors
          ${active
            ? 'bg-blue-500 text-white'
            : disabled
              ? 'bg-gray-50 text-gray-300 cursor-not-allowed'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-pointer'
          }
        `}
      >
        {children}
      </button>
      {/* Tooltip */}
      <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none">
        {tooltip}
        {/* 小三角 */}
        <div className="absolute left-1/2 -translate-x-1/2 -top-1 w-2 h-2 bg-gray-800 rotate-45" />
      </div>
    </div>
  );
}

interface ToolbarProps {
  currentTool: ToolType;
  onToolChange: (tool: ToolType) => void;
  onUndo: () => void;
  onRedo: () => void;
  onDownload: () => void;
  onPrint: () => void;
  canUndo: boolean;
  canRedo: boolean;
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
}: ToolbarProps) {
  const tools: { id: ToolType; label: string; icon: React.ReactNode }[] = [
    { id: 'select', label: '选择', icon: Icons.select },
    { id: 'text', label: '添加文本', icon: Icons.text },
    { id: 'check', label: '添加勾选', icon: Icons.check },
    { id: 'cross', label: '添加叉号', icon: Icons.cross },
    { id: 'signature', label: '添加签名', icon: Icons.signature },
  ];

  return (
    <div className="flex items-center gap-4 p-2 bg-white rounded-lg shadow-md">
      {/* 工具按钮 */}
      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-500 px-2">工具</span>
        {tools.map((tool) => (
          <TooltipButton
            key={tool.id}
            onClick={() => onToolChange(tool.id)}
            active={currentTool === tool.id}
            tooltip={tool.label}
          >
            {tool.icon}
          </TooltipButton>
        ))}
      </div>

      {/* 分隔线 */}
      <div className="border-l border-gray-200 h-8" />

      {/* 撤销/重做 */}
      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-500 px-2">编辑</span>
        <TooltipButton
          onClick={onUndo}
          disabled={!canUndo}
          tooltip="撤销"
        >
          {Icons.undo}
        </TooltipButton>
        <TooltipButton
          onClick={onRedo}
          disabled={!canRedo}
          tooltip="重做"
        >
          {Icons.redo}
        </TooltipButton>
      </div>

      {/* 分隔线 */}
      <div className="border-l border-gray-200 h-8" />

      {/* 导出按钮 */}
      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-500 px-2">导出</span>
        <TooltipButton
          onClick={onDownload}
          tooltip="下载 PDF"
        >
          {Icons.download}
        </TooltipButton>
        <TooltipButton
          onClick={onPrint}
          tooltip="打印"
        >
          {Icons.print}
        </TooltipButton>
      </div>
    </div>
  );
}
