"""PDF表单处理服务"""
from typing import List, Dict, Any, Optional
from pypdf import PdfReader, PdfWriter
from pypdf.generic import NameObject
import pdfplumber


def get_form_fields(pdf_path: str) -> List[Dict[str, Any]]:
    """
    获取PDF表单字段

    Args:
        pdf_path: PDF文件路径

    Returns:
        表单字段列表
    """
    fields = []

    try:
        reader = PdfReader(pdf_path)

        # 检查是否有AcroForm
        if reader.get_fields():
            for field_name, field_data in reader.get_fields().items():
                field_info = {
                    "id": field_name,
                    "name": field_name,
                    "type": _get_field_type(field_data),
                    "value": field_data.get("/V", ""),
                    "rect": None,  # 位置信息
                }

                # 获取字段位置
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
        print(f"读取表单字段失败: {e}")

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
    field_values: Dict[str, Any]
) -> bool:
    """
    填充PDF表单字段

    Args:
        pdf_path: 输入PDF路径
        output_path: 输出PDF路径
        field_values: 字段值字典 {field_name: value}

    Returns:
        是否成功
    """
    try:
        reader = PdfReader(pdf_path)
        writer = PdfWriter()

        # 复制所有页面
        for page in reader.pages:
            writer.add_page(page)

        # 填充表单字段
        writer.update_page_form_field_values(writer.pages[0], field_values)

        # 写入文件
        with open(output_path, "wb") as output_file:
            writer.write(output_file)

        return True

    except Exception as e:
        print(f"填充表单失败: {e}")
        return False


def flatten_pdf(pdf_path: str, output_path: str) -> bool:
    """
    将PDF表单扁平化（将表单字段转换为普通内容）

    Args:
        pdf_path: 输入PDF路径
        output_path: 输出PDF路径

    Returns:
        是否成功
    """
    try:
        reader = PdfReader(pdf_path)
        writer = PdfWriter()

        for page in reader.pages:
            writer.add_page(page)

        # 移除表单字段（扁平化）
        if "/AcroForm" in writer._root_object:
            del writer._root_object["/AcroForm"]

        with open(output_path, "wb") as output_file:
            writer.write(output_file)

        return True

    except Exception as e:
        print(f"扁平化PDF失败: {e}")
        return False
