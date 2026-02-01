/**
 * 类型定义
 */

// 标注类型
export type AnnotationType = 'text' | 'check' | 'cross' | 'draw' | 'signature';

// 工具类型
export type ToolType = 'select' | 'text' | 'check' | 'cross' | 'draw' | 'signature';

// 标注对象
export interface Annotation {
  id: string;
  type: AnnotationType;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  content?: string; // 文本内容
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  // 创建时的页面尺寸（用于导出时坐标转换）
  pageWidth?: number;
  pageHeight?: number;
  // 绘制属性
  pathData?: string;      // SVG 路径字符串
  strokeWidth?: number;   // 笔画宽度 (默认 2)
  strokeColor?: string;   // 笔画颜色 (默认 #000000)
  // 签名属性
  imageData?: string;     // Base64 图片数据 (用于签名)
}

// 绘制选项
export interface DrawingOptions {
  strokeWidth: number;
  strokeColor: string;
}

// 上传响应
export interface UploadResponse {
  fileId: string;
  fileName: string;
  fileType: string;
  pdfUrl: string;
  message: string;
}

// 表单字段
export interface FormField {
  id: string;
  name: string;
  type: 'text' | 'checkbox' | 'dropdown' | 'signature' | 'unknown';
  value: string | boolean | null;
  rect?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  options?: string[];      // 下拉选项
  isReadonly?: boolean;
  isRequired?: boolean;
  maxLength?: number;
  pageIndex?: number;      // 字段所在页面
}

// 表单填充结果
export interface FillFormResult {
  fileId: string;
  pdfUrl: string;
  message: string;
  filledFields?: string[];
  warnings?: string[];
}

// 表单字段响应
export interface FormFieldsResponse {
  fields: FormField[];
  hasForm: boolean;
}

// PDF文档状态
export interface PDFDocumentState {
  fileId: string | null;
  fileName: string | null;
  pdfUrl: string | null;
  totalPages: number;
  currentPage: number;
  scale: number;
  isLoading: boolean;
  error: string | null;
}

// 编辑器历史记录（用于撤销/重做）
export interface EditorHistory {
  past: Annotation[][];
  present: Annotation[];
  future: Annotation[][];
}

// Canvas对象类型（Fabric.js）
export interface CanvasObject {
  id: string;
  type: string;
  left: number;
  top: number;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
  angle: number;
  data?: {
    annotationType: AnnotationType;
    page: number;
  };
}

// 选中文本信息
export interface SelectedTextInfo {
  id: string;
  position: { x: number; y: number };
  fontFamily: string;
  fontSize: number;
  fill: string;
  fontWeight: string;
  underline: boolean;
}
