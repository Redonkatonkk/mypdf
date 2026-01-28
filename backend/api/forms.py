"""PDF表单处理API"""
import os
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

from services.form_handler import get_form_fields, fill_form_fields
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


class FormFieldsResponse(BaseModel):
    """表单字段响应"""
    fields: List[FormField]
    hasForm: bool


class FillFormRequest(BaseModel):
    """填充表单请求"""
    fields: Dict[str, Any]


class FillFormResponse(BaseModel):
    """填充表单响应"""
    fileId: str
    pdfUrl: str
    message: str


@router.get("/forms/{file_id}/fields", response_model=FormFieldsResponse)
async def get_pdf_form_fields(file_id: str):
    """获取PDF表单字段"""
    pdf_path = get_pdf_path(UPLOAD_DIR, file_id)

    if not os.path.exists(pdf_path):
        raise HTTPException(status_code=404, detail="文件不存在")

    fields = get_form_fields(pdf_path)

    return FormFieldsResponse(
        fields=[FormField(**f) for f in fields],
        hasForm=len(fields) > 0
    )


@router.post("/forms/{file_id}/fill", response_model=FillFormResponse)
async def fill_pdf_form(file_id: str, request: FillFormRequest):
    """填充PDF表单"""
    pdf_path = get_pdf_path(UPLOAD_DIR, file_id)

    if not os.path.exists(pdf_path):
        raise HTTPException(status_code=404, detail="文件不存在")

    # 生成新的文件ID
    new_file_id = generate_file_id()
    output_path = get_pdf_path(UPLOAD_DIR, new_file_id)

    # 填充表单
    success = fill_form_fields(pdf_path, output_path, request.fields)

    if not success:
        raise HTTPException(status_code=500, detail="表单填充失败")

    return FillFormResponse(
        fileId=new_file_id,
        pdfUrl=f"/api/file/{new_file_id}",
        message="表单填充成功"
    )


class ExportRequest(BaseModel):
    """导出请求"""
    fileId: str
    annotations: List[Dict[str, Any]] = []


@router.post("/export")
async def export_pdf(request: ExportRequest):
    """
    导出PDF（包含标注）
    注：标注合并主要在前端使用pdf-lib完成
    此接口预留用于服务端处理
    """
    pdf_path = get_pdf_path(UPLOAD_DIR, request.fileId)

    if not os.path.exists(pdf_path):
        raise HTTPException(status_code=404, detail="文件不存在")

    # 目前直接返回原PDF
    # 后续可扩展在服务端合并标注
    return FileResponse(
        pdf_path,
        media_type="application/pdf",
        filename=f"export_{request.fileId}.pdf"
    )
