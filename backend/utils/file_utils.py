"""文件处理工具函数"""
import os
import uuid
from typing import Tuple


def generate_file_id() -> str:
    """生成唯一文件ID"""
    return str(uuid.uuid4())


def get_file_extension(filename: str) -> str:
    """获取文件扩展名（小写）"""
    return os.path.splitext(filename)[1].lower()


def is_allowed_file(filename: str) -> bool:
    """检查文件类型是否允许"""
    allowed_extensions = {'.pdf', '.doc', '.docx'}
    return get_file_extension(filename) in allowed_extensions


def get_upload_path(upload_dir: str, file_id: str, extension: str) -> str:
    """获取上传文件的存储路径"""
    return os.path.join(upload_dir, f"{file_id}{extension}")


def get_pdf_path(upload_dir: str, file_id: str) -> str:
    """获取PDF文件路径"""
    return os.path.join(upload_dir, f"{file_id}.pdf")
