"""
PDF 表单处理服务

此模块提供 PDF 表单的高级处理功能，封装了 form_filler 核心模块。
"""
from typing import List, Dict, Any, Optional
from pypdf import PdfReader, PdfWriter
from pypdf.generic import NameObject
import pdfplumber

from .form_filler import (
    PDFFormFiller,
    FormAnalysisResult,
    FillResult,
    FormFieldInfo,
    FormType,
    FieldType,
    SaveMode,
    analyze_pdf_form,
    fill_pdf_form,
    get_field_mapping,
)


def get_form_fields(pdf_path: str) -> List[Dict[str, Any]]:
    """
    获取 PDF 表单字段

    Args:
        pdf_path: PDF 文件路径

    Returns:
        表单字段列表
    """
    fields = []

    try:
        # 使用新的核心模块进行分析
        analysis = analyze_pdf_form(pdf_path)

        for field_name, field_info in analysis.fields.items():
            field_dict = {
                "id": field_name,
                "name": field_name,
                "type": field_info.field_type.value,
                "value": field_info.value or "",
                "rect": None,
                "options": field_info.options,
                "isReadonly": field_info.is_readonly,
                "isRequired": field_info.is_required,
                "maxLength": field_info.max_length,
                "pageIndex": field_info.page_index,
            }

            # 转换位置信息
            if field_info.rect:
                x1, y1, x2, y2 = field_info.rect
                field_dict["rect"] = {
                    "x": x1,
                    "y": y1,
                    "width": x2 - x1,
                    "height": y2 - y1,
                }

            fields.append(field_dict)

    except Exception as e:
        print(f"读取表单字段失败: {e}")
        # 回退到简单方法
        fields = _get_form_fields_simple(pdf_path)

    return fields


def _get_form_fields_simple(pdf_path: str) -> List[Dict[str, Any]]:
    """简单方法获取表单字段（回退方案）"""
    fields = []

    try:
        reader = PdfReader(pdf_path)

        if reader.get_fields():
            for field_name, field_data in reader.get_fields().items():
                field_info = {
                    "id": field_name,
                    "name": field_name,
                    "type": _get_field_type(field_data),
                    "value": field_data.get("/V", ""),
                    "rect": None,
                }

                if "/Rect" in field_data:
                    rect = field_data["/Rect"]
                    field_info["rect"] = {
                        "x": float(rect[0]),
                        "y": float(rect[1]),
                        "width": float(rect[2]) - float(rect[0]),
                        "height": float(rect[3]) - float(rect[1]),
                    }

                fields.append(field_info)

    except Exception as e:
        print(f"简单方法读取表单字段失败: {e}")

    return fields


def _get_field_type(field_data: Dict) -> str:
    """获取字段类型"""
    field_type = field_data.get("/FT", "")

    if field_type == "/Tx":
        return "text"
    elif field_type == "/Btn":
        return "checkbox"
    elif field_type == "/Ch":
        return "dropdown"
    elif field_type == "/Sig":
        return "signature"
    else:
        return "unknown"


def fill_form_fields(
    pdf_path: str,
    output_path: str,
    field_values: Dict[str, Any],
    update_appearances: bool = True,
    set_need_appearances: bool = True,
) -> bool:
    """
    填充 PDF 表单字段

    Args:
        pdf_path: 输入 PDF 路径
        output_path: 输出 PDF 路径
        field_values: 字段值字典 {field_name: value}
        update_appearances: 是否更新外观流
        set_need_appearances: 是否设置 NeedAppearances 标记

    Returns:
        是否成功
    """
    try:
        result = fill_pdf_form(
            pdf_path=pdf_path,
            output_path=output_path,
            field_values=field_values,
            update_appearances=update_appearances,
            set_need_appearances=set_need_appearances,
            save_mode=SaveMode.FULL_REWRITE,
        )
        return result.success

    except Exception as e:
        print(f"填充表单失败: {e}")
        return False


def fill_form_fields_advanced(
    pdf_path: str,
    output_path: str,
    field_values: Dict[str, Any],
    options: Optional[Dict[str, Any]] = None,
) -> FillResult:
    """
    高级表单填充（返回详细结果）

    Args:
        pdf_path: 输入 PDF 路径
        output_path: 输出 PDF 路径
        field_values: 字段值字典
        options: 可选配置
            - update_appearances: bool - 是否更新外观流 (默认 True)
            - set_need_appearances: bool - 是否设置 NeedAppearances (默认 True)
            - save_mode: str - 保存模式 "incremental" 或 "full_rewrite" (默认 "full_rewrite")
            - flatten: bool - 是否扁平化 (默认 False)

    Returns:
        FillResult: 详细填充结果
    """
    options = options or {}

    save_mode_str = options.get("save_mode", "full_rewrite")
    save_mode = SaveMode.INCREMENTAL if save_mode_str == "incremental" else SaveMode.FULL_REWRITE

    return fill_pdf_form(
        pdf_path=pdf_path,
        output_path=output_path,
        field_values=field_values,
        update_appearances=options.get("update_appearances", True),
        set_need_appearances=options.get("set_need_appearances", True),
        save_mode=save_mode,
        flatten=options.get("flatten", False),
    )


def analyze_form(pdf_path: str) -> Dict[str, Any]:
    """
    分析 PDF 表单

    Args:
        pdf_path: PDF 文件路径

    Returns:
        表单分析结果字典
    """
    try:
        analysis = analyze_pdf_form(pdf_path)

        return {
            "formType": analysis.form_type.value,
            "hasXfa": analysis.has_xfa,
            "isEncrypted": analysis.is_encrypted,
            "permissions": analysis.permissions,
            "fieldCount": len(analysis.fields),
            "fields": [
                {
                    "name": name,
                    "type": info.field_type.value,
                    "value": info.value,
                    "isReadonly": info.is_readonly,
                    "isRequired": info.is_required,
                }
                for name, info in analysis.fields.items()
            ],
            "warnings": analysis.warnings,
            "errors": analysis.errors,
        }

    except Exception as e:
        return {
            "formType": "none",
            "hasXfa": False,
            "isEncrypted": False,
            "permissions": {},
            "fieldCount": 0,
            "fields": [],
            "warnings": [],
            "errors": [str(e)],
        }


def flatten_pdf(pdf_path: str, output_path: str) -> bool:
    """
    将 PDF 表单扁平化（将表单字段转换为普通内容）

    Args:
        pdf_path: 输入 PDF 路径
        output_path: 输出 PDF 路径

    Returns:
        是否成功
    """
    try:
        # 使用空字段值填充并扁平化
        result = fill_pdf_form(
            pdf_path=pdf_path,
            output_path=output_path,
            field_values={},
            flatten=True,
        )
        return result.success

    except Exception as e:
        print(f"扁平化 PDF 失败: {e}")
        return False


def check_form_permissions(pdf_path: str) -> Dict[str, bool]:
    """
    检查 PDF 表单权限

    Args:
        pdf_path: PDF 文件路径

    Returns:
        权限字典
    """
    try:
        analysis = analyze_pdf_form(pdf_path)
        return analysis.permissions
    except:
        return {
            "can_modify": True,
            "can_fill_forms": True,
            "can_extract": True,
            "can_print": True,
        }
