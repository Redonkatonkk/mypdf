"""
PDF 表单填充核心模块测试
"""
import os
import sys
import tempfile
import unittest
from pathlib import Path

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from services.form_filler import (
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


class TestChineseFontManager(unittest.TestCase):
    """中文字体管理器测试"""

    def test_contains_chinese_true(self):
        """测试中文检测 - 包含中文"""
        self.assertTrue(ChineseFontManager.contains_chinese("你好世界"))
        self.assertTrue(ChineseFontManager.contains_chinese("Hello 世界"))
        self.assertTrue(ChineseFontManager.contains_chinese("测试"))

    def test_contains_chinese_false(self):
        """测试中文检测 - 不包含中文"""
        self.assertFalse(ChineseFontManager.contains_chinese("Hello World"))
        self.assertFalse(ChineseFontManager.contains_chinese(""))
        self.assertFalse(ChineseFontManager.contains_chinese("12345"))

    def test_get_default_chinese_font(self):
        """测试获取默认中文字体"""
        font_name = ChineseFontManager.get_default_chinese_font()
        self.assertIsNotNone(font_name)
        self.assertIsInstance(font_name, str)


class TestFormType(unittest.TestCase):
    """表单类型枚举测试"""

    def test_form_type_values(self):
        """测试表单类型值"""
        self.assertEqual(FormType.NONE.value, "none")
        self.assertEqual(FormType.ACROFORM.value, "acroform")
        self.assertEqual(FormType.XFA_STATIC.value, "xfa_static")
        self.assertEqual(FormType.XFA_DYNAMIC.value, "xfa_dynamic")
        self.assertEqual(FormType.HYBRID.value, "hybrid")


class TestFieldType(unittest.TestCase):
    """字段类型枚举测试"""

    def test_field_type_values(self):
        """测试字段类型值"""
        self.assertEqual(FieldType.TEXT.value, "text")
        self.assertEqual(FieldType.CHECKBOX.value, "checkbox")
        self.assertEqual(FieldType.RADIO.value, "radio")
        self.assertEqual(FieldType.DROPDOWN.value, "dropdown")
        self.assertEqual(FieldType.SIGNATURE.value, "signature")


class TestFormFieldInfo(unittest.TestCase):
    """表单字段信息测试"""

    def test_default_values(self):
        """测试默认值"""
        field = FormFieldInfo(name="test", field_type=FieldType.TEXT)
        self.assertEqual(field.name, "test")
        self.assertEqual(field.field_type, FieldType.TEXT)
        self.assertIsNone(field.value)
        self.assertIsNone(field.rect)
        self.assertEqual(field.options, [])
        self.assertFalse(field.is_readonly)
        self.assertFalse(field.is_required)


class TestFillResult(unittest.TestCase):
    """填充结果测试"""

    def test_default_values(self):
        """测试默认值"""
        result = FillResult(success=True)
        self.assertTrue(result.success)
        self.assertIsNone(result.output_path)
        self.assertEqual(result.filled_fields, [])
        self.assertEqual(result.failed_fields, [])
        self.assertEqual(result.errors, [])
        self.assertEqual(result.warnings, [])


class TestPDFFormFillerWithoutPDF(unittest.TestCase):
    """不依赖实际 PDF 文件的测试"""

    def test_invalid_pdf_path(self):
        """测试无效 PDF 路径"""
        with self.assertRaises(ValueError):
            PDFFormFiller("/nonexistent/path.pdf")


class TestSaveMode(unittest.TestCase):
    """保存模式测试"""

    def test_save_mode_values(self):
        """测试保存模式值"""
        self.assertEqual(SaveMode.INCREMENTAL.value, "incremental")
        self.assertEqual(SaveMode.FULL_REWRITE.value, "full_rewrite")


# 如果有测试 PDF 文件，可以添加更多集成测试
class TestPDFFormFillerIntegration(unittest.TestCase):
    """集成测试（需要测试 PDF 文件）"""

    @classmethod
    def setUpClass(cls):
        """设置测试环境"""
        # 查找测试 PDF 文件
        uploads_dir = Path(__file__).parent.parent / "uploads"
        cls.test_pdfs = list(uploads_dir.glob("*.pdf"))[:1]  # 只取第一个

    def test_analyze_existing_pdf(self):
        """测试分析现有 PDF"""
        if not self.test_pdfs:
            self.skipTest("没有可用的测试 PDF 文件")

        pdf_path = str(self.test_pdfs[0])
        result = analyze_pdf_form(pdf_path)

        self.assertIsInstance(result, FormAnalysisResult)
        self.assertIsInstance(result.form_type, FormType)
        self.assertIsInstance(result.fields, dict)
        self.assertIsInstance(result.permissions, dict)

    def test_get_field_mapping(self):
        """测试获取字段映射"""
        if not self.test_pdfs:
            self.skipTest("没有可用的测试 PDF 文件")

        pdf_path = str(self.test_pdfs[0])
        fields = get_field_mapping(pdf_path)

        self.assertIsInstance(fields, dict)

    def test_fill_form(self):
        """测试填充表单"""
        if not self.test_pdfs:
            self.skipTest("没有可用的测试 PDF 文件")

        pdf_path = str(self.test_pdfs[0])
        analysis = analyze_pdf_form(pdf_path)

        if not analysis.fields:
            self.skipTest("PDF 没有表单字段")

        # 准备测试数据
        field_values = {}
        for name, info in analysis.fields.items():
            if info.field_type == FieldType.TEXT and not info.is_readonly:
                field_values[name] = "测试值 Test Value"
                break

        if not field_values:
            self.skipTest("没有可填充的文本字段")

        # 创建临时输出文件
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            output_path = tmp.name

        try:
            result = fill_pdf_form(
                pdf_path=pdf_path,
                output_path=output_path,
                field_values=field_values,
            )

            self.assertIsInstance(result, FillResult)
            if result.success:
                self.assertTrue(os.path.exists(output_path))
                self.assertGreater(os.path.getsize(output_path), 0)
        finally:
            if os.path.exists(output_path):
                os.unlink(output_path)


if __name__ == "__main__":
    unittest.main(verbosity=2)
