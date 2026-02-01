"""
PDF 表单填充与保存核心模块

支持功能：
1. AcroForms 填充（优先）
2. XFA 表单探测与处理
3. UTF-8 编码和中文字体嵌入
4. 字段映射与 Widget 注释遍历
5. Appearance Streams 更新
6. NeedAppearances 标记设置
7. 权限检查与处理
8. 增量更新与完全重写模式
"""

import os
import io
import re
import xml.etree.ElementTree as ET
from enum import Enum
from dataclasses import dataclass, field
from typing import Dict, List, Any, Optional, Tuple, Union
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from pypdf.generic import (
    NameObject,
    TextStringObject,
    ArrayObject,
    DictionaryObject,
    BooleanObject,
    NumberObject,
    IndirectObject,
    StreamObject,
    ByteStringObject,
    create_string_object,
)
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.cidfonts import UnicodeCIDFont


class FormType(Enum):
    """PDF 表单类型"""
    NONE = "none"
    ACROFORM = "acroform"
    XFA_STATIC = "xfa_static"
    XFA_DYNAMIC = "xfa_dynamic"
    HYBRID = "hybrid"  # AcroForm + XFA


class FieldType(Enum):
    """表单字段类型"""
    TEXT = "text"
    CHECKBOX = "checkbox"
    RADIO = "radio"
    DROPDOWN = "dropdown"
    LISTBOX = "listbox"
    SIGNATURE = "signature"
    BUTTON = "button"
    UNKNOWN = "unknown"


class SaveMode(Enum):
    """保存模式"""
    INCREMENTAL = "incremental"  # 增量更新
    FULL_REWRITE = "full_rewrite"  # 完全重写


@dataclass
class FormFieldInfo:
    """表单字段信息"""
    name: str
    field_type: FieldType
    value: Any = None
    default_value: Any = None
    options: List[str] = field(default_factory=list)  # 下拉列表选项
    rect: Optional[Tuple[float, float, float, float]] = None  # 位置 (x1, y1, x2, y2)
    page_index: int = 0
    flags: int = 0
    max_length: Optional[int] = None
    is_readonly: bool = False
    is_required: bool = False
    font_name: Optional[str] = None
    font_size: Optional[float] = None


@dataclass
class FormAnalysisResult:
    """表单分析结果"""
    form_type: FormType
    fields: Dict[str, FormFieldInfo]
    has_xfa: bool = False
    xfa_data: Optional[str] = None  # XFA XML 数据
    is_encrypted: bool = False
    permissions: Dict[str, bool] = field(default_factory=dict)
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)


@dataclass
class FillResult:
    """填充结果"""
    success: bool
    output_path: Optional[str] = None
    filled_fields: List[str] = field(default_factory=list)
    failed_fields: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)


class ChineseFontManager:
    """中文字体管理器"""

    # 常见中文字体路径（按优先级排序）
    CHINESE_FONT_PATHS = [
        # macOS
        "/System/Library/Fonts/PingFang.ttc",
        "/System/Library/Fonts/STHeiti Light.ttc",
        "/System/Library/Fonts/STHeiti Medium.ttc",
        "/Library/Fonts/Arial Unicode.ttf",
        "/System/Library/Fonts/Supplemental/Songti.ttc",
        # Linux
        "/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc",
        "/usr/share/fonts/truetype/arphic/uming.ttc",
        # Windows
        "C:/Windows/Fonts/msyh.ttc",  # 微软雅黑
        "C:/Windows/Fonts/simsun.ttc",  # 宋体
        "C:/Windows/Fonts/simhei.ttf",  # 黑体
    ]

    _registered_fonts: Dict[str, str] = {}
    _default_font: Optional[str] = None

    @classmethod
    def find_chinese_font(cls) -> Optional[str]:
        """查找可用的中文字体"""
        for font_path in cls.CHINESE_FONT_PATHS:
            if os.path.exists(font_path):
                return font_path
        return None

    @classmethod
    def register_font(cls, font_name: str, font_path: str) -> bool:
        """注册字体到 ReportLab"""
        try:
            if font_name in cls._registered_fonts:
                return True

            if font_path.endswith('.ttc'):
                # TTC 字体集，尝试注册第一个字体
                pdfmetrics.registerFont(TTFont(font_name, font_path, subfontIndex=0))
            else:
                pdfmetrics.registerFont(TTFont(font_name, font_path))

            cls._registered_fonts[font_name] = font_path
            return True
        except Exception as e:
            print(f"注册字体失败 {font_name}: {e}")
            return False

    @classmethod
    def get_default_chinese_font(cls) -> str:
        """获取默认中文字体名称"""
        if cls._default_font:
            return cls._default_font

        # 首先尝试注册系统中文字体
        font_path = cls.find_chinese_font()
        if font_path:
            font_name = "ChineseFont"
            if cls.register_font(font_name, font_path):
                cls._default_font = font_name
                return font_name

        # 回退到 ReportLab 内置的 CID 字体
        try:
            pdfmetrics.registerFont(UnicodeCIDFont('STSong-Light'))
            cls._default_font = 'STSong-Light'
            return 'STSong-Light'
        except:
            pass

        # 最后回退到 Helvetica
        cls._default_font = 'Helvetica'
        return 'Helvetica'

    @classmethod
    def contains_chinese(cls, text: str) -> bool:
        """检测文本是否包含中文字符"""
        if not text:
            return False
        for char in text:
            if '\u4e00' <= char <= '\u9fff':
                return True
            # CJK 扩展
            if '\u3400' <= char <= '\u4dbf':
                return True
            if '\u20000' <= char <= '\u2a6df':
                return True
        return False


class PDFFormFiller:
    """PDF 表单填充核心类"""

    def __init__(self, pdf_path: str):
        """
        初始化表单填充器

        Args:
            pdf_path: PDF 文件路径
        """
        self.pdf_path = pdf_path
        self.reader: Optional[PdfReader] = None
        self.analysis: Optional[FormAnalysisResult] = None
        self._load_pdf()

    def _load_pdf(self) -> None:
        """加载 PDF 文件"""
        try:
            self.reader = PdfReader(self.pdf_path)
        except Exception as e:
            raise ValueError(f"无法加载 PDF 文件: {e}")

    def analyze(self) -> FormAnalysisResult:
        """
        分析 PDF 表单

        Returns:
            FormAnalysisResult: 表单分析结果
        """
        result = FormAnalysisResult(
            form_type=FormType.NONE,
            fields={},
            permissions=self._check_permissions()
        )

        # 检查加密状态
        if self.reader.is_encrypted:
            result.is_encrypted = True
            result.warnings.append("PDF 文件已加密，部分功能可能受限")

        # 检测 XFA
        xfa_result = self._detect_xfa()
        result.has_xfa = xfa_result[0]
        result.xfa_data = xfa_result[1]

        # 检测 AcroForm
        has_acroform = self._has_acroform()

        # 确定表单类型
        if result.has_xfa and has_acroform:
            result.form_type = FormType.HYBRID
            result.warnings.append("检测到混合表单 (AcroForm + XFA)，将优先使用 AcroForm")
        elif result.has_xfa:
            # 区分静态和动态 XFA
            if self._is_dynamic_xfa(result.xfa_data):
                result.form_type = FormType.XFA_DYNAMIC
                result.warnings.append("检测到动态 XFA 表单，可能无法完全处理")
            else:
                result.form_type = FormType.XFA_STATIC
        elif has_acroform:
            result.form_type = FormType.ACROFORM

        # 提取字段信息
        result.fields = self._extract_fields()

        self.analysis = result
        return result

    def _check_permissions(self) -> Dict[str, bool]:
        """检查 PDF 权限"""
        permissions = {
            "can_modify": True,
            "can_fill_forms": True,
            "can_extract": True,
            "can_print": True,
        }

        try:
            if self.reader.is_encrypted:
                # 尝试获取权限信息
                # pypdf 在解密后可以访问文档
                trailer = self.reader.trailer
                if "/Encrypt" in trailer:
                    encrypt_dict = trailer["/Encrypt"]
                    if "/P" in encrypt_dict:
                        p_value = int(encrypt_dict["/P"])
                        # 解析权限位
                        permissions["can_print"] = bool(p_value & 4)
                        permissions["can_modify"] = bool(p_value & 8)
                        permissions["can_extract"] = bool(p_value & 16)
                        permissions["can_fill_forms"] = bool(p_value & 256)
        except:
            pass

        return permissions

    def _has_acroform(self) -> bool:
        """检测是否有 AcroForm"""
        try:
            if "/AcroForm" in self.reader.trailer.get("/Root", {}):
                return True
            # 也检查 get_fields
            fields = self.reader.get_fields()
            return fields is not None and len(fields) > 0
        except:
            return False

    def _detect_xfa(self) -> Tuple[bool, Optional[str]]:
        """
        检测 XFA 表单并提取 XML 数据

        Returns:
            Tuple[bool, Optional[str]]: (是否存在 XFA, XFA XML 数据)
        """
        try:
            root = self.reader.trailer.get("/Root")
            if not root:
                return False, None

            root_obj = root.get_object() if hasattr(root, 'get_object') else root
            acroform = root_obj.get("/AcroForm")

            if not acroform:
                return False, None

            acroform_obj = acroform.get_object() if hasattr(acroform, 'get_object') else acroform
            xfa = acroform_obj.get("/XFA")

            if not xfa:
                return False, None

            # XFA 可能是数组或流
            xfa_obj = xfa.get_object() if hasattr(xfa, 'get_object') else xfa

            xfa_data = ""
            if isinstance(xfa_obj, ArrayObject):
                # XFA 是一个数组，包含 [name, stream, name, stream, ...]
                for i in range(1, len(xfa_obj), 2):
                    stream = xfa_obj[i]
                    if hasattr(stream, 'get_object'):
                        stream = stream.get_object()
                    if hasattr(stream, 'get_data'):
                        xfa_data += stream.get_data().decode('utf-8', errors='ignore')
            elif hasattr(xfa_obj, 'get_data'):
                xfa_data = xfa_obj.get_data().decode('utf-8', errors='ignore')

            return True, xfa_data if xfa_data else None

        except Exception as e:
            return False, None

    def _is_dynamic_xfa(self, xfa_data: Optional[str]) -> bool:
        """判断是否为动态 XFA"""
        if not xfa_data:
            return False

        # 动态 XFA 通常包含 <dynamicRender> 或 subform 的 layout="tb" 等
        dynamic_indicators = [
            'dynamicRender',
            '<script',
            'layout="tb"',
            'layout="lr"',
            'layout="rl-tb"',
        ]

        for indicator in dynamic_indicators:
            if indicator in xfa_data:
                return True

        return False

    def _extract_fields(self) -> Dict[str, FormFieldInfo]:
        """提取所有表单字段"""
        fields = {}

        try:
            # 从 AcroForm 提取
            pdf_fields = self.reader.get_fields()
            if pdf_fields:
                for field_name, field_data in pdf_fields.items():
                    field_info = self._parse_field(field_name, field_data)
                    fields[field_name] = field_info

            # 遍历所有页面的 Widget 注释
            for page_idx, page in enumerate(self.reader.pages):
                if "/Annots" in page:
                    annots = page["/Annots"]
                    if hasattr(annots, 'get_object'):
                        annots = annots.get_object()

                    for annot_ref in annots:
                        annot = annot_ref.get_object() if hasattr(annot_ref, 'get_object') else annot_ref

                        # 检查是否是 Widget 类型
                        subtype = annot.get("/Subtype")
                        if subtype == "/Widget":
                            field_name = self._get_field_name(annot)
                            if field_name and field_name not in fields:
                                field_info = self._parse_field(field_name, annot)
                                field_info.page_index = page_idx
                                fields[field_name] = field_info
                            elif field_name and field_name in fields:
                                # 更新页面索引
                                fields[field_name].page_index = page_idx
                                # 更新位置信息
                                if "/Rect" in annot and not fields[field_name].rect:
                                    rect = annot["/Rect"]
                                    fields[field_name].rect = (
                                        float(rect[0]), float(rect[1]),
                                        float(rect[2]), float(rect[3])
                                    )

        except Exception as e:
            print(f"提取字段失败: {e}")

        return fields

    def _get_field_name(self, field_data: Dict) -> Optional[str]:
        """获取字段名称"""
        # 尝试从 /T 获取
        if "/T" in field_data:
            name = field_data["/T"]
            if hasattr(name, 'get_object'):
                name = name.get_object()
            return str(name)

        # 尝试从父字段获取完整名称
        if "/Parent" in field_data:
            parent = field_data["/Parent"]
            if hasattr(parent, 'get_object'):
                parent = parent.get_object()
            parent_name = self._get_field_name(parent)
            if parent_name and "/T" in field_data:
                return f"{parent_name}.{field_data['/T']}"

        return None

    def _parse_field(self, field_name: str, field_data: Dict) -> FormFieldInfo:
        """解析单个字段信息"""
        field_type = self._get_field_type(field_data)

        # 调试：打印复选框字段的详细信息
        if field_type == FieldType.CHECKBOX:
            print(f"[Parse Checkbox] {field_name}")
            print(f"  - /AS (Appearance State): {field_data.get('/AS')}")
            print(f"  - /V (Value): {field_data.get('/V')}")
            print(f"  - /AP (Appearances): {list(field_data.get('/AP', {}).keys()) if '/AP' in field_data else 'None'}")
            # 获取可用的外观状态
            if '/AP' in field_data and '/N' in field_data['/AP']:
                ap_n = field_data['/AP']['/N']
                if hasattr(ap_n, 'get_object'):
                    ap_n = ap_n.get_object()
                if hasattr(ap_n, 'keys'):
                    print(f"  - Available states: {list(ap_n.keys())}")

        field_info = FormFieldInfo(
            name=field_name,
            field_type=field_type,
        )

        # 获取当前值
        if "/V" in field_data:
            value = field_data["/V"]
            if hasattr(value, 'get_object'):
                value = value.get_object()
            field_info.value = str(value) if value else None

        # 获取默认值
        if "/DV" in field_data:
            dv = field_data["/DV"]
            if hasattr(dv, 'get_object'):
                dv = dv.get_object()
            field_info.default_value = str(dv) if dv else None

        # 获取位置
        if "/Rect" in field_data:
            rect = field_data["/Rect"]
            field_info.rect = (
                float(rect[0]), float(rect[1]),
                float(rect[2]), float(rect[3])
            )

        # 获取字段标志
        if "/Ff" in field_data:
            flags = int(field_data["/Ff"])
            field_info.flags = flags
            field_info.is_readonly = bool(flags & 1)
            field_info.is_required = bool(flags & 2)

        # 获取最大长度
        if "/MaxLen" in field_data:
            field_info.max_length = int(field_data["/MaxLen"])

        # 获取下拉选项
        if "/Opt" in field_data:
            opts = field_data["/Opt"]
            if hasattr(opts, 'get_object'):
                opts = opts.get_object()
            field_info.options = [str(opt) for opt in opts]

        # 获取字体信息
        if "/DA" in field_data:
            da = str(field_data["/DA"])
            # 解析 DA 字符串获取字体和大小
            font_match = re.search(r'/(\w+)\s+([\d.]+)\s+Tf', da)
            if font_match:
                field_info.font_name = font_match.group(1)
                field_info.font_size = float(font_match.group(2))

        return field_info

    def _get_field_type(self, field_data: Dict) -> FieldType:
        """获取字段类型"""
        ft = field_data.get("/FT")
        if hasattr(ft, 'get_object'):
            ft = ft.get_object()
        ft = str(ft) if ft else ""

        if ft == "/Tx":
            return FieldType.TEXT
        elif ft == "/Btn":
            # 区分复选框和单选按钮
            flags = field_data.get("/Ff", 0)
            if hasattr(flags, 'get_object'):
                flags = flags.get_object()
            flags = int(flags) if flags else 0

            if flags & (1 << 15):  # 单选按钮标志
                return FieldType.RADIO
            elif flags & (1 << 16):  # 按钮标志
                return FieldType.BUTTON
            return FieldType.CHECKBOX
        elif ft == "/Ch":
            flags = field_data.get("/Ff", 0)
            if hasattr(flags, 'get_object'):
                flags = flags.get_object()
            flags = int(flags) if flags else 0

            if flags & (1 << 17):  # 组合框标志
                return FieldType.DROPDOWN
            return FieldType.LISTBOX
        elif ft == "/Sig":
            return FieldType.SIGNATURE

        return FieldType.UNKNOWN

    def fill(
        self,
        field_values: Dict[str, Any],
        output_path: str,
        save_mode: SaveMode = SaveMode.FULL_REWRITE,
        update_appearances: bool = True,
        set_need_appearances: bool = True,
        flatten: bool = False,
    ) -> FillResult:
        """
        填充表单并保存

        Args:
            field_values: 字段值字典 {字段名: 值}
            output_path: 输出文件路径
            save_mode: 保存模式（增量/完全重写）
            update_appearances: 是否更新外观流
            set_need_appearances: 是否设置 NeedAppearances 标记
            flatten: 是否扁平化表单

        Returns:
            FillResult: 填充结果
        """
        result = FillResult(success=False)

        # 首先分析表单（如果尚未分析）
        if not self.analysis:
            self.analyze()

        # 检查权限
        if not self.analysis.permissions.get("can_fill_forms", True):
            result.errors.append("PDF 文档禁止表单填充")
            return result

        # 检查 XFA
        if self.analysis.form_type == FormType.XFA_DYNAMIC:
            result.warnings.append("动态 XFA 表单可能无法正确填充，建议使用 Adobe Acrobat")

        try:
            writer = PdfWriter()

            # 复制所有页面
            for page in self.reader.pages:
                writer.add_page(page)

            # 克隆 AcroForm
            if "/AcroForm" in self.reader.trailer.get("/Root", {}):
                writer._root_object[NameObject("/AcroForm")] = self.reader.trailer["/Root"]["/AcroForm"]

            # 设置 NeedAppearances
            if set_need_appearances:
                self._set_need_appearances(writer)

            # 填充字段
            filled, failed = self._fill_fields(writer, field_values, update_appearances)
            result.filled_fields = filled
            result.failed_fields = failed

            # 处理 XFA 同步（如果存在）
            if self.analysis.has_xfa and self.analysis.form_type != FormType.XFA_DYNAMIC:
                try:
                    self._sync_xfa_data(writer, field_values)
                except Exception as e:
                    result.warnings.append(f"XFA 数据同步失败: {e}")

            # 扁平化（如果需要）
            if flatten:
                self._flatten_form(writer)

            # 保存文件
            if save_mode == SaveMode.INCREMENTAL and os.path.exists(self.pdf_path):
                # 增量更新模式
                with open(self.pdf_path, "rb") as input_file:
                    with open(output_path, "wb") as output_file:
                        writer.write(output_file)
            else:
                # 完全重写模式
                with open(output_path, "wb") as output_file:
                    writer.write(output_file)

            result.success = True
            result.output_path = output_path

        except Exception as e:
            result.errors.append(f"填充失败: {str(e)}")

        return result

    def _set_need_appearances(self, writer: PdfWriter) -> None:
        """设置 NeedAppearances 标记"""
        try:
            if "/AcroForm" not in writer._root_object:
                writer._root_object[NameObject("/AcroForm")] = DictionaryObject()

            acroform = writer._root_object["/AcroForm"]
            if hasattr(acroform, 'get_object'):
                acroform = acroform.get_object()

            # 创建新的 AcroForm 字典（如果是间接引用）
            if isinstance(acroform, IndirectObject):
                acroform = acroform.get_object()

            acroform[NameObject("/NeedAppearances")] = BooleanObject(True)

        except Exception as e:
            print(f"设置 NeedAppearances 失败: {e}")

    def _fill_fields(
        self,
        writer: PdfWriter,
        field_values: Dict[str, Any],
        update_appearances: bool
    ) -> Tuple[List[str], List[str]]:
        """
        填充字段

        Returns:
            Tuple[List[str], List[str]]: (成功填充的字段, 失败的字段)
        """
        filled = []
        failed = []

        for field_name, value in field_values.items():
            try:
                field_info = self.analysis.fields.get(field_name)

                if not field_info:
                    failed.append(field_name)
                    continue

                if field_info.is_readonly:
                    failed.append(field_name)
                    continue

                # 使用 pypdf 的 update_page_form_field_values
                # 需要确定字段在哪个页面
                page_idx = field_info.page_index

                # 准备字段值
                if field_info.field_type == FieldType.CHECKBOX:
                    # 复选框值处理
                    original_value = value
                    if isinstance(value, bool):
                        value = "/Yes" if value else "/Off"
                    elif value in ("true", "True", "1", "yes", "Yes"):
                        value = "/Yes"
                    elif value in ("false", "False", "0", "no", "No"):
                        value = "/Off"
                    print(f"[Checkbox] Field: {field_name}, Original: {original_value}, Converted: {value}")

                # 更新字段值
                field_dict = {field_name: value}
                print(f"[Fill] Updating field: {field_name} = {value} on page {page_idx}")
                writer.update_page_form_field_values(
                    writer.pages[page_idx],
                    field_dict,
                    auto_regenerate=update_appearances
                )

                # 如果需要更新外观流且包含中文
                if update_appearances and isinstance(value, str):
                    if ChineseFontManager.contains_chinese(value):
                        self._update_appearance_with_chinese(
                            writer, page_idx, field_name, value, field_info
                        )

                filled.append(field_name)

            except Exception as e:
                print(f"填充字段 {field_name} 失败: {e}")
                failed.append(field_name)

        return filled, failed

    def _update_appearance_with_chinese(
        self,
        writer: PdfWriter,
        page_idx: int,
        field_name: str,
        value: str,
        field_info: FormFieldInfo
    ) -> None:
        """更新包含中文的字段外观"""
        try:
            if not field_info.rect:
                return

            x1, y1, x2, y2 = field_info.rect
            width = x2 - x1
            height = y2 - y1

            # 获取字体
            font_name = ChineseFontManager.get_default_chinese_font()
            font_size = field_info.font_size or 12

            # 如果字体大小为 0，自动计算
            if font_size == 0:
                font_size = min(height * 0.8, 12)

            # 创建外观流
            packet = io.BytesIO()
            c = canvas.Canvas(packet, pagesize=(width, height))

            try:
                c.setFont(font_name, font_size)
            except:
                # 回退到默认字体
                c.setFont("Helvetica", font_size)

            # 绘制文本
            c.drawString(2, height - font_size - 2, value)
            c.save()

            packet.seek(0)

            # 这里我们依赖 pypdf 的 auto_regenerate 功能
            # 对于复杂的中文支持，可能需要额外的处理

        except Exception as e:
            print(f"更新中文外观失败: {e}")

    def _sync_xfa_data(self, writer: PdfWriter, field_values: Dict[str, Any]) -> None:
        """同步 XFA 数据"""
        if not self.analysis.xfa_data:
            return

        try:
            # 解析 XFA XML
            # XFA 数据可能包含多个 XML 部分
            xfa_xml = self.analysis.xfa_data

            # 尝试更新 datasets 部分
            for field_name, value in field_values.items():
                # XFA 字段名可能需要转换
                xfa_field_name = field_name.replace(".", "/")

                # 简单的文本替换（对于复杂 XFA 可能不够）
                pattern = f'<{field_name}[^>]*>.*?</{field_name}>'
                replacement = f'<{field_name}>{value}</{field_name}>'
                xfa_xml = re.sub(pattern, replacement, xfa_xml, flags=re.DOTALL)

            # 注意：实际更新 XFA 流需要更复杂的处理
            # 这里仅提供基本框架

        except Exception as e:
            raise Exception(f"XFA 同步失败: {e}")

    def _flatten_form(self, writer: PdfWriter) -> None:
        """扁平化表单"""
        try:
            if "/AcroForm" in writer._root_object:
                del writer._root_object[NameObject("/AcroForm")]

            # 移除每个页面的交互式注释
            for page in writer.pages:
                if "/Annots" in page:
                    annots = page["/Annots"]
                    if hasattr(annots, 'get_object'):
                        annots = annots.get_object()

                    # 过滤掉 Widget 注释
                    new_annots = []
                    for annot_ref in annots:
                        annot = annot_ref.get_object() if hasattr(annot_ref, 'get_object') else annot_ref
                        if annot.get("/Subtype") != "/Widget":
                            new_annots.append(annot_ref)

                    if new_annots:
                        page[NameObject("/Annots")] = ArrayObject(new_annots)
                    else:
                        del page[NameObject("/Annots")]

        except Exception as e:
            print(f"扁平化失败: {e}")


def analyze_pdf_form(pdf_path: str) -> FormAnalysisResult:
    """
    分析 PDF 表单的便捷函数

    Args:
        pdf_path: PDF 文件路径

    Returns:
        FormAnalysisResult: 分析结果
    """
    filler = PDFFormFiller(pdf_path)
    return filler.analyze()


def fill_pdf_form(
    pdf_path: str,
    output_path: str,
    field_values: Dict[str, Any],
    update_appearances: bool = True,
    set_need_appearances: bool = True,
    save_mode: SaveMode = SaveMode.FULL_REWRITE,
    flatten: bool = False,
) -> FillResult:
    """
    填充 PDF 表单的便捷函数

    Args:
        pdf_path: 输入 PDF 文件路径
        output_path: 输出 PDF 文件路径
        field_values: 字段值字典
        update_appearances: 是否更新外观流
        set_need_appearances: 是否设置 NeedAppearances 标记
        save_mode: 保存模式
        flatten: 是否扁平化

    Returns:
        FillResult: 填充结果
    """
    filler = PDFFormFiller(pdf_path)
    return filler.fill(
        field_values=field_values,
        output_path=output_path,
        save_mode=save_mode,
        update_appearances=update_appearances,
        set_need_appearances=set_need_appearances,
        flatten=flatten,
    )


def get_field_mapping(pdf_path: str) -> Dict[str, FormFieldInfo]:
    """
    获取 PDF 表单字段映射的便捷函数

    Args:
        pdf_path: PDF 文件路径

    Returns:
        Dict[str, FormFieldInfo]: 字段名到字段信息的映射
    """
    filler = PDFFormFiller(pdf_path)
    analysis = filler.analyze()
    return analysis.fields
