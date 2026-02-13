"""文件上传API"""
import os
import shutil
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional

from utils.file_utils import (
    generate_file_id,
    get_file_extension,
    is_allowed_file,
    get_upload_path,
    get_pdf_path
)
from services.converter import convert_docx_to_pdf, convert_doc_to_pdf

router = APIRouter()

# 上传目录
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")


class UploadResponse(BaseModel):
    """上传响应"""
    fileId: str
    fileName: str
    fileType: str
    pdfUrl: str
    message: str


@router.post("/upload", response_model=UploadResponse)
async def upload_file(file: UploadFile = File(...)):
    """
    上传文件接口
    - 支持PDF、DOC、DOCX格式
    - Word文件自动转换为PDF
    """
    # 检查文件类型
    if not is_allowed_file(file.filename):
        raise HTTPException(
            status_code=400,
            detail="不支持的文件格式，请上传PDF、DOC或DOCX文件"
        )

    # 生成文件ID
    file_id = generate_file_id()
    extension = get_file_extension(file.filename)

    # 保存上传的文件
    upload_path = get_upload_path(UPLOAD_DIR, file_id, extension)
    with open(upload_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # 如果是Word文件，转换为PDF
    pdf_path = get_pdf_path(UPLOAD_DIR, file_id)

    if extension == '.pdf':
        # PDF文件直接使用，不需要复制（upload_path 和 pdf_path 相同）
        message = "PDF文件上传成功"
    elif extension == '.docx':
        # 转换DOCX到PDF
        success = convert_docx_to_pdf(upload_path, pdf_path)
        if not success:
            # 清理文件
            os.remove(upload_path)
            raise HTTPException(status_code=500, detail="Word文档转换失败")
        message = "Word文档已转换为PDF"
    elif extension == '.doc':
        # .doc格式支持有限
        os.remove(upload_path)
        raise HTTPException(
            status_code=400,
            detail="暂不支持.doc格式，请将文件另存为.docx格式后重新上传"
        )
    else:
        os.remove(upload_path)
        raise HTTPException(status_code=400, detail="不支持的文件格式")

    return UploadResponse(
        fileId=file_id,
        fileName=file.filename,
        fileType=extension[1:],  # 去掉点号
        pdfUrl=f"/api/file/{file_id}",
        message=message
    )


@router.get("/file/{file_id}")
async def get_file(file_id: str):
    """获取PDF文件"""
    pdf_path = get_pdf_path(UPLOAD_DIR, file_id)

    print(f"[DEBUG] Requested file_id: {file_id}")
    print(f"[DEBUG] PDF path: {pdf_path}")
    print(f"[DEBUG] File exists: {os.path.exists(pdf_path)}")
    print(f"[DEBUG] UPLOAD_DIR: {UPLOAD_DIR}")

    if not os.path.exists(pdf_path):
        raise HTTPException(status_code=404, detail="文件不存在")

    return FileResponse(
        pdf_path,
        media_type="application/octet-stream",  # 使用 octet-stream 避免 IDM 拦截
        headers={"Content-Disposition": "inline"}
    )


@router.delete("/file/{file_id}")
async def delete_file(file_id: str):
    """删除文件"""
    pdf_path = get_pdf_path(UPLOAD_DIR, file_id)

    # 删除可能存在的所有相关文件
    extensions = ['.pdf', '.doc', '.docx']
    deleted = False

    for ext in extensions:
        file_path = get_upload_path(UPLOAD_DIR, file_id, ext)
        if os.path.exists(file_path):
            os.remove(file_path)
            deleted = True

    if not deleted:
        raise HTTPException(status_code=404, detail="文件不存在")

    return {"message": "文件已删除"}
