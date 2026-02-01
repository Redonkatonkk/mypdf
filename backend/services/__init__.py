"""PDF 处理服务模块"""
from .form_handler import (
    get_form_fields,
    fill_form_fields,
    fill_form_fields_advanced,
    analyze_form,
    flatten_pdf,
    check_form_permissions,
)
from .form_filler import (
    PDFFormFiller,
    FormAnalysisResult,
    FillResult,
    FormFieldInfo,
    FormType,
    FieldType,
    SaveMode,
    ChineseFontManager,
    analyze_pdf_form,
    fill_pdf_form,
    get_field_mapping,
)
from .converter import convert_docx_to_pdf

__all__ = [
    # form_handler
    "get_form_fields",
    "fill_form_fields",
    "fill_form_fields_advanced",
    "analyze_form",
    "flatten_pdf",
    "check_form_permissions",
    # form_filler
    "PDFFormFiller",
    "FormAnalysisResult",
    "FillResult",
    "FormFieldInfo",
    "FormType",
    "FieldType",
    "SaveMode",
    "ChineseFontManager",
    "analyze_pdf_form",
    "fill_pdf_form",
    "get_field_mapping",
    # converter
    "convert_docx_to_pdf",
]
