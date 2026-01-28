/**
 * 签名弹窗组件
 * 支持绘制签名、透明背景、保存签名库
 */
import { useEffect, useRef, useState, useCallback } from 'react';

interface SignatureModalProps {
  visible: boolean;
  onConfirm: (imageData: string, width: number, height: number) => void;
  onCancel: () => void;
}

interface StrokeData {
  points: { x: number; y: number }[];
}

interface SavedSignature {
  id: string;
  imageData: string;
  width: number;
  height: number;
  createdAt: number;
}

const STORAGE_KEY = 'pdf-editor-signatures';

// 加载保存的签名
function loadSavedSignatures(): SavedSignature[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

// 保存签名到本地存储
function saveSignatureToStorage(signature: SavedSignature) {
  const signatures = loadSavedSignatures();
  signatures.unshift(signature); // 新签名放在最前面
  // 最多保存 10 个签名
  if (signatures.length > 10) {
    signatures.pop();
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(signatures));
}

// 删除保存的签名
function deleteSignatureFromStorage(id: string) {
  const signatures = loadSavedSignatures();
  const filtered = signatures.filter(s => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

// 签名字体列表
const SIGNATURE_FONTS = [
  { name: 'Great Vibes', label: 'Great Vibes' },
  { name: 'Bilbo Swash Caps', label: 'Bilbo Swash Caps' },
  { name: 'Caveat', label: 'Caveat' },
  { name: 'Sacramento', label: 'Sacramento' },
  { name: 'Stalemate', label: 'Stalemate' },
];

// 渲染文字签名为图片
function renderTextSignature(text: string, fontFamily: string): { data: string; width: number; height: number } | null {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const fontSize = 48;
  ctx.font = `${fontSize}px "${fontFamily}"`;
  const metrics = ctx.measureText(text);

  const padding = 10;
  canvas.width = Math.ceil(metrics.width) + padding * 2;
  canvas.height = Math.ceil(fontSize * 1.4) + padding * 2;

  // 重设字体（canvas 尺寸改变后需要重设）
  ctx.font = `${fontSize}px "${fontFamily}"`;
  ctx.fillStyle = '#000000';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, padding, canvas.height / 2);

  return {
    data: canvas.toDataURL('image/png'),
    width: canvas.width,
    height: canvas.height,
  };
}

export function SignatureModal({ visible, onConfirm, onCancel }: SignatureModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokes, setStrokes] = useState<StrokeData[]>([]);
  const [currentStroke, setCurrentStroke] = useState<{ x: number; y: number }[]>([]);
  const [undoStack, setUndoStack] = useState<StrokeData[]>([]);
  const [savedSignatures, setSavedSignatures] = useState<SavedSignature[]>([]);
  const [activeTab, setActiveTab] = useState<'draw' | 'type' | 'saved'>('draw');
  const [typedText, setTypedText] = useState('');
  const [selectedFont, setSelectedFont] = useState('Great Vibes');

  // 加载保存的签名
  useEffect(() => {
    if (visible) {
      setSavedSignatures(loadSavedSignatures());
    }
  }, [visible]);

  // 高 DPI 适配
  const getPixelRatio = () => {
    return Math.max(window.devicePixelRatio || 1, 1);
  };

  // 初始化画布
  useEffect(() => {
    if (!visible || !canvasRef.current || activeTab !== 'draw') return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 高 DPI 适配
    const ratio = getPixelRatio();
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    ctx.scale(ratio, ratio);

    // 设置绘制样式
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 清空画布（透明背景）
    ctx.clearRect(0, 0, rect.width, rect.height);
  }, [visible, activeTab]);

  // 重绘所有笔画
  const redrawCanvas = useCallback(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const ratio = getPixelRatio();
    const rect = canvas.getBoundingClientRect();

    // 清空画布（透明背景）
    ctx.clearRect(0, 0, rect.width, rect.height);

    // 设置绘制样式
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 重绘所有笔画
    strokes.forEach(stroke => {
      if (stroke.points.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x / ratio, stroke.points[0].y / ratio);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x / ratio, stroke.points[i].y / ratio);
      }
      ctx.stroke();
    });
  }, [strokes]);

  useEffect(() => {
    if (activeTab === 'draw') {
      redrawCanvas();
    }
  }, [redrawCanvas, activeTab]);

  // 获取鼠标/触摸位置
  const getPointerPosition = (e: React.MouseEvent | React.TouchEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 };

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const ratio = getPixelRatio();

    let clientX: number, clientY: number;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: (clientX - rect.left) * ratio,
      y: (clientY - rect.top) * ratio,
    };
  };

  // 开始绘制
  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDrawing(true);
    const pos = getPointerPosition(e);
    setCurrentStroke([pos]);
    setUndoStack([]); // 新绘制时清空重做栈
  };

  // 绘制中
  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !canvasRef.current) return;
    e.preventDefault();

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pos = getPointerPosition(e);
    const ratio = getPixelRatio();

    // 绘制线段
    if (currentStroke.length > 0) {
      const lastPoint = currentStroke[currentStroke.length - 1];
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(lastPoint.x / ratio, lastPoint.y / ratio);
      ctx.lineTo(pos.x / ratio, pos.y / ratio);
      ctx.stroke();
    }

    setCurrentStroke(prev => [...prev, pos]);
  };

  // 结束绘制
  const handlePointerUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (currentStroke.length > 1) {
      setStrokes(prev => [...prev, { points: currentStroke }]);
    }
    setCurrentStroke([]);
  };

  // 撤销
  const handleUndo = () => {
    if (strokes.length === 0) return;
    const newStrokes = [...strokes];
    const removed = newStrokes.pop()!;
    setStrokes(newStrokes);
    setUndoStack(prev => [...prev, removed]);
  };

  // 重做
  const handleRedo = () => {
    if (undoStack.length === 0) return;
    const newUndoStack = [...undoStack];
    const restored = newUndoStack.pop()!;
    setUndoStack(newUndoStack);
    setStrokes(prev => [...prev, restored]);
  };

  // 清除
  const handleClear = () => {
    setStrokes([]);
    setUndoStack([]);
    setCurrentStroke([]);
  };

  // 智能裁剪签名区域（透明背景）
  const cropSignature = (canvas: HTMLCanvasElement): { data: string; width: number; height: number } | null => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { data, width, height } = imageData;

    let minX = width, minY = height, maxX = 0, maxY = 0;
    let hasContent = false;

    // 扫描找到有内容的区域（检查 alpha 通道）
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const alpha = data[idx + 3];
        // 检测非透明像素
        if (alpha > 10) {
          hasContent = true;
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
    }

    if (!hasContent) return null;

    // 添加一些边距
    const padding = 10;
    minX = Math.max(0, minX - padding);
    minY = Math.max(0, minY - padding);
    maxX = Math.min(width - 1, maxX + padding);
    maxY = Math.min(height - 1, maxY + padding);

    const cropWidth = maxX - minX + 1;
    const cropHeight = maxY - minY + 1;

    // 创建裁剪后的画布（保持透明背景）
    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.width = cropWidth;
    croppedCanvas.height = cropHeight;
    const croppedCtx = croppedCanvas.getContext('2d');
    if (!croppedCtx) return null;

    // 复制裁剪区域（透明背景）
    croppedCtx.drawImage(
      canvas,
      minX, minY, cropWidth, cropHeight,
      0, 0, cropWidth, cropHeight
    );

    return {
      data: croppedCanvas.toDataURL('image/png'),
      width: cropWidth,
      height: cropHeight,
    };
  };

  // 确认签名（绘制模式）
  const handleConfirmDraw = () => {
    if (!canvasRef.current || strokes.length === 0) return;

    const result = cropSignature(canvasRef.current);
    if (result) {
      // 转换为显示尺寸（除以 pixel ratio）
      const ratio = getPixelRatio();
      const width = result.width / ratio;
      const height = result.height / ratio;

      // 保存到签名库
      const newSignature: SavedSignature = {
        id: `sig_${Date.now()}`,
        imageData: result.data,
        width,
        height,
        createdAt: Date.now(),
      };
      saveSignatureToStorage(newSignature);
      setSavedSignatures(loadSavedSignatures());

      onConfirm(result.data, width, height);
    }

    // 重置状态
    setStrokes([]);
    setUndoStack([]);
    setCurrentStroke([]);
  };

  // 使用已保存的签名
  const handleUseSavedSignature = (signature: SavedSignature) => {
    onConfirm(signature.imageData, signature.width, signature.height);
  };

  // 确认签名（文字输入模式）
  const handleConfirmType = () => {
    if (!typedText.trim()) return;

    const result = renderTextSignature(typedText, selectedFont);
    if (result) {
      // 保存到签名库
      const newSignature: SavedSignature = {
        id: `sig_${Date.now()}`,
        imageData: result.data,
        width: result.width,
        height: result.height,
        createdAt: Date.now(),
      };
      saveSignatureToStorage(newSignature);
      setSavedSignatures(loadSavedSignatures());

      onConfirm(result.data, result.width, result.height);
    }

    // 重置
    setTypedText('');
  };

  // 删除已保存的签名
  const handleDeleteSignature = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteSignatureFromStorage(id);
    setSavedSignatures(loadSavedSignatures());
  };

  // 取消
  const handleCancel = () => {
    setStrokes([]);
    setUndoStack([]);
    setCurrentStroke([]);
    setTypedText('');
    onCancel();
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-[520px] max-w-[90vw]">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-800">添加签名</h3>
          <button
            onClick={handleCancel}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* 标签页切换 */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('draw')}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              activeTab === 'draw'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            绘制签名
          </button>
          <button
            onClick={() => setActiveTab('type')}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              activeTab === 'type'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            输入签名
          </button>
          <button
            onClick={() => setActiveTab('saved')}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              activeTab === 'saved'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            已保存 ({savedSignatures.length})
          </button>
        </div>

        {/* 绘制签名标签页 */}
        {activeTab === 'draw' && (
          <>
            <div className="p-4">
              <div
                className="border-2 border-dashed border-gray-300 rounded-lg overflow-hidden"
                style={{
                  backgroundColor: '#f5f5f5',
                  backgroundImage: 'linear-gradient(45deg, #e0e0e0 25%, transparent 25%), linear-gradient(-45deg, #e0e0e0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e0e0e0 75%), linear-gradient(-45deg, transparent 75%, #e0e0e0 75%)',
                  backgroundSize: '20px 20px',
                  backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px'
                }}
              >
                <canvas
                  ref={canvasRef}
                  className="w-full h-[200px] cursor-crosshair touch-none"
                  style={{ backgroundColor: 'transparent' }}
                  onMouseDown={handlePointerDown}
                  onMouseMove={handlePointerMove}
                  onMouseUp={handlePointerUp}
                  onMouseLeave={handlePointerUp}
                  onTouchStart={handlePointerDown}
                  onTouchMove={handlePointerMove}
                  onTouchEnd={handlePointerUp}
                />
              </div>
              <p className="text-xs text-gray-400 mt-2 text-center">
                在上方区域绘制您的签名（透明背景）
              </p>
            </div>

            {/* 工具栏 */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleUndo}
                  disabled={strokes.length === 0}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                  title="撤销"
                >
                  ↩ 撤销
                </button>
                <button
                  onClick={handleRedo}
                  disabled={undoStack.length === 0}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                  title="重做"
                >
                  ↪ 重做
                </button>
                <button
                  onClick={handleClear}
                  disabled={strokes.length === 0}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                  title="清除"
                >
                  清除
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCancel}
                  className="px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded"
                >
                  取消
                </button>
                <button
                  onClick={handleConfirmDraw}
                  disabled={strokes.length === 0}
                  className="px-4 py-1.5 text-sm text-white bg-blue-500 hover:bg-blue-600 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  确认
                </button>
              </div>
            </div>
          </>
        )}

        {/* 输入签名标签页 */}
        {activeTab === 'type' && (
          <div className="p-4">
            {/* 文本输入 */}
            <input
              type="text"
              value={typedText}
              onChange={(e) => setTypedText(e.target.value)}
              placeholder="输入您的姓名"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
            />

            {/* 字体选择 */}
            <div className="mt-4">
              <p className="text-sm text-gray-600 mb-2">选择字体样式：</p>
              <div className="grid grid-cols-1 gap-2 max-h-[200px] overflow-y-auto">
                {SIGNATURE_FONTS.map(font => (
                  <button
                    key={font.name}
                    onClick={() => setSelectedFont(font.name)}
                    className={`p-3 text-left border rounded-lg transition-colors ${
                      selectedFont === font.name
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <span
                      style={{ fontFamily: font.name, fontSize: '28px' }}
                      className="block truncate"
                    >
                      {typedText || '签名预览'}
                    </span>
                    <span className="text-xs text-gray-400 mt-1 block">{font.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 确认按钮 */}
            <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-gray-200">
              <button
                onClick={handleCancel}
                className="px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded"
              >
                取消
              </button>
              <button
                onClick={handleConfirmType}
                disabled={!typedText.trim()}
                className="px-4 py-1.5 text-sm text-white bg-blue-500 hover:bg-blue-600 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                确认
              </button>
            </div>
          </div>
        )}

        {/* 已保存签名标签页 */}
        {activeTab === 'saved' && (
          <div className="p-4">
            {savedSignatures.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <p>暂无保存的签名</p>
                <p className="text-sm mt-1">绘制签名后会自动保存</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 max-h-[300px] overflow-y-auto">
                {savedSignatures.map(sig => (
                  <div
                    key={sig.id}
                    onClick={() => handleUseSavedSignature(sig)}
                    className="relative group border border-gray-200 rounded-lg p-3 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
                    style={{
                      backgroundColor: '#f9f9f9',
                      backgroundImage: 'linear-gradient(45deg, #eee 25%, transparent 25%), linear-gradient(-45deg, #eee 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #eee 75%), linear-gradient(-45deg, transparent 75%, #eee 75%)',
                      backgroundSize: '10px 10px',
                      backgroundPosition: '0 0, 0 5px, 5px -5px, -5px 0px'
                    }}
                  >
                    <img
                      src={sig.imageData}
                      alt="签名"
                      className="w-full h-16 object-contain"
                    />
                    <button
                      onClick={(e) => handleDeleteSignature(sig.id, e)}
                      className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                      title="删除"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end mt-4 pt-3 border-t border-gray-200">
              <button
                onClick={handleCancel}
                className="px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded"
              >
                取消
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
