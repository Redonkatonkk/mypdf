"""PDF 表单处理 API"""
import os
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

from services.form_handler import (
    get_form_fields,
    fill_form_fields,
    fill_form_fields_advanced,
    analyze_form,
    flatten_pdf,
    check_form_permissions,
)
from services.form_filler import FillResult
from utils.file_utils import get_pdf_path, generate_file_id

router = APIRouter()

# 上传目录
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")


class FormField(BaseModel):
    """表单字段"""
    id: str
    name: str
    type: str
    value: Any = None
    rect: Optional[Dict[str, float]] = None
    options: Optional[List[str]] = None
    isReadonly: Optional[bool] = False
    isRequired: Optional[bool] = False
    maxLength: Optional[int] = None


class FormFieldsResponse(BaseModel):
    """表单字段响应"""
    fields: List[FormField]
    hasForm: bool


class FormAnalysisResponse(BaseModel):
    """表单分析响应"""
    formType: str
    hasXfa: bool
    isEncrypted: bool
    permissions: Dict[str, bool]
    fieldCount: int
    fields: List[Dict[str, Any]]
    warnings: List[str]
    errors: List[str]


class FillFormRequest(BaseModel):
    """填充表单请求"""
    fields: Dict[str, Any]
    options: Optional[Dict[str, Any]] = None


class FillFormResponse(BaseModel):
    """填充表单响应"""
    fileId: str
    pdfUrl: str
    message: str
    filledFields: Optional[List[str]] = None
    failedFields: Optional[List[str]] = None
    warnings: Optional[List[str]] = None


class FlattenRequest(BaseModel):
    """扁平化请求"""
    pass


class PermissionsResponse(BaseModel):
    """权限响应"""
    canModify: bool
    canFillForms: bool
    canExtract: bool
    canPrint: bool


@router.get("/forms/{file_id}/fields", response_model=FormFieldsResponse)
async def get_pdf_form_fields(file_id: str):
    """获取 PDF 表单字段"""
    pdf_path = get_pdf_path(UPLOAD_DIR, file_id)

    if not os.path.exists(pdf_path):
        raise HTTPException(status_code=404, detail="文件不存在")

    fields = get_form_fields(pdf_path)

    return FormFieldsResponse(
        fields=[FormField(**f) for f in fields],
        hasForm=len(fields) > 0
    )


@router.get("/forms/{file_id}/analyze", response_model=FormAnalysisResponse)
async def analyze_pdf_form(file_id: str):
    """
    分析 PDF 表单

    返回表单类型、XFA 检测结果、权限信息等详细分析
    """
    pdf_path = get_pdf_path(UPLOAD_DIR, file_id)

    if not os.path.exists(pdf_path):
        raise HTTPException(status_code=404, detail="文件不存在")

    analysis = analyze_form(pdf_path)

    return FormAnalysisResponse(
        formType=analysis["formType"],
        hasXfa=analysis["hasXfa"],
        isEncrypted=analysis["isEncrypted"],
        permissions=analysis["permissions"],
        fieldCount=analysis["fieldCount"],
        fields=analysis["fields"],
        warnings=analysis["warnings"],
        errors=analysis["errors"],
    )


@router.get("/forms/{file_id}/permissions", response_model=PermissionsResponse)
async def get_pdf_permissions(file_id: str):
    """获取 PDF 权限信息"""
    pdf_path = get_pdf_path(UPLOAD_DIR, file_id)

    if not os.path.exists(pdf_path):
        raise HTTPException(status_code=404, detail="文件不存在")

    permissions = check_form_permissions(pdf_path)

    return PermissionsResponse(
        canModify=permissions.get("can_modify", True),
        canFillForms=permissions.get("can_fill_forms", True),
        canExtract=permissions.get("can_extract", True),
        canPrint=permissions.get("can_print", True),
    )


@router.post("/forms/{file_id}/fill", response_model=FillFormResponse)
async def fill_pdf_form(file_id: str, request: FillFormRequest):
    """
    填充 PDF 表单

    支持的选项 (options):
    - update_appearances: bool - 是否更新外观流，确保在所有阅读器中显示 (默认 True)
    - set_need_appearances: bool - 是否设置 NeedAppearances 标记 (默认 True)
    - save_mode: str - 保存模式 "incremental" 或 "full_rewrite" (默认 "full_rewrite")
    - flatten: bool - 是否扁平化表单，使其不可再编辑 (默认 False)
    """
    pdf_path = get_pdf_path(UPLOAD_DIR, file_id)

    if not os.path.exists(pdf_path):
        raise HTTPException(status_code=404, detail="文件不存在")

    # 检查权限
    permissions = check_form_permissions(pdf_path)
    if not permissions.get("can_fill_forms", True):
        raise HTTPException(status_code=403, detail="PDF 文档禁止表单填充")

    # 生成新的文件 ID
    new_file_id = generate_file_id()
    output_path = get_pdf_path(UPLOAD_DIR, new_file_id)

    # 填充表单（使用高级方法获取详细结果）
    result: FillResult = fill_form_fields_advanced(
        pdf_path,
        output_path,
        request.fields,
        request.options
    )

    if not result.success:
        # 清理可能生成的文件
        if os.path.exists(output_path):
            os.remove(output_path)

        error_msg = result.errors[0] if result.errors else "表单填充失败"
        raise HTTPException(status_code=500, detail=error_msg)

    return FillFormResponse(
        fileId=new_file_id,
        pdfUrl=f"/api/file/{new_file_id}",
        message="表单填充成功",
        filledFields=result.filled_fields,
        failedFields=result.failed_fields if result.failed_fields else None,
        warnings=result.warnings if result.warnings else None,
    )


@router.post("/forms/{file_id}/flatten", response_model=FillFormResponse)
async def flatten_pdf_form(file_id: str):
    """
    扁平化 PDF 表单

    将交互式表单字段转换为普通 PDF 内容，使其不可再编辑
    """
    pdf_path = get_pdf_path(UPLOAD_DIR, file_id)

    if not os.path.exists(pdf_path):
        raise HTTPException(status_code=404, detail="文件不存在")

    # 生成新的文件 ID
    new_file_id = generate_file_id()
    output_path = get_pdf_path(UPLOAD_DIR, new_file_id)

    # 扁平化
    success = flatten_pdf(pdf_path, output_path)

    if not success:
        if os.path.exists(output_path):
            os.remove(output_path)
        raise HTTPException(status_code=500, detail="扁平化失败")

    return FillFormResponse(
        fileId=new_file_id,
        pdfUrl=f"/api/file/{new_file_id}",
        message="扁平化成功",
    )


class ExportRequest(BaseModel):
    """导出请求"""
    fileId: str
    annotations: List[Dict[str, Any]] = []


@router.post("/export")
async def export_pdf(request: ExportRequest):
    """
    导出 PDF（包含标注）
    注：标注合并主要在前端使用 pdf-lib 完成
    此接口预留用于服务端处理
    """
    pdf_path = get_pdf_path(UPLOAD_DIR, request.fileId)

    if not os.path.exists(pdf_path):
        raise HTTPException(status_code=404, detail="文件不存在")

    return FileResponse(
        pdf_path,
        media_type="application/pdf",
        filename=f"export_{request.fileId}.pdf"
    )
