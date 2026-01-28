"""Word文档转PDF服务"""
import os
from io import BytesIO
from docx import Document
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont


def register_chinese_font():
    """注册中文字体"""
    # macOS系统字体路径
    font_paths = [
        "/System/Library/Fonts/PingFang.ttc",
        "/System/Library/Fonts/STHeiti Light.ttc",
        "/Library/Fonts/Arial Unicode.ttf",
    ]

    for font_path in font_paths:
        if os.path.exists(font_path):
            try:
                pdfmetrics.registerFont(TTFont('ChineseFont', font_path, subfontIndex=0))
                return 'ChineseFont'
            except:
                continue

    # 如果没有找到中文字体，使用默认字体
    return 'Helvetica'


def convert_docx_to_pdf(docx_path: str, pdf_path: str) -> bool:
    """
    将Word文档转换为PDF

    Args:
        docx_path: Word文档路径
        pdf_path: 输出PDF路径

    Returns:
        是否转换成功
    """
    try:
        # 读取Word文档
        doc = Document(docx_path)

        # 注册中文字体
        font_name = register_chinese_font()

        # 创建PDF文档
        pdf_doc = SimpleDocTemplate(
            pdf_path,
            pagesize=A4,
            leftMargin=2*cm,
            rightMargin=2*cm,
            topMargin=2*cm,
            bottomMargin=2*cm
        )

        # 创建样式
        styles = getSampleStyleSheet()
        normal_style = ParagraphStyle(
            'ChineseNormal',
            parent=styles['Normal'],
            fontName=font_name,
            fontSize=12,
            leading=18,
        )

        # 转换内容
        story = []
        for para in doc.paragraphs:
            if para.text.strip():
                # 转义XML特殊字符
                text = para.text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
                story.append(Paragraph(text, normal_style))
                story.append(Spacer(1, 6))

        # 如果文档为空，添加空白页
        if not story:
            story.append(Paragraph("（空白文档）", normal_style))

        # 生成PDF
        pdf_doc.build(story)
        return True

    except Exception as e:
        print(f"Word转PDF失败: {e}")
        return False


def convert_doc_to_pdf(doc_path: str, pdf_path: str) -> bool:
    """
    将旧版Word文档(.doc)转换为PDF
    注：.doc格式支持有限，建议用户使用.docx格式
    """
    # .doc格式需要额外的库支持，这里返回失败提示用户使用.docx
    print("暂不支持.doc格式，请将文件另存为.docx格式")
    return False
