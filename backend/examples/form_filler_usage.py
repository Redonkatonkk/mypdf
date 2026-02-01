"""
PDF 表单填充核心模块使用示例

此示例展示了如何使用 form_filler 模块的各种功能。
"""
import sys
from pathlib import Path

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from services.form_filler import (
    PDFFormFiller,
    FormType,
    FieldType,
    SaveMode,
    analyze_pdf_form,
    fill_pdf_form,
    get_field_mapping,
)


def example_basic_analysis(pdf_path: str):
    """
    示例 1: 基本表单分析

    分析 PDF 表单，获取表单类型、字段信息、权限等。
    """
    print("=" * 50)
    print("示例 1: 基本表单分析")
    print("=" * 50)

    # 使用便捷函数
    analysis = analyze_pdf_form(pdf_path)

    print(f"表单类型: {analysis.form_type.value}")
    print(f"是否有 XFA: {analysis.has_xfa}")
    print(f"是否加密: {analysis.is_encrypted}")
    print(f"字段数量: {len(analysis.fields)}")

    print("\n权限信息:")
    for perm, value in analysis.permissions.items():
        print(f"  - {perm}: {value}")

    if analysis.warnings:
        print("\n警告:")
        for warning in analysis.warnings:
            print(f"  - {warning}")

    if analysis.errors:
        print("\n错误:")
        for error in analysis.errors:
            print(f"  - {error}")

    print("\n字段列表:")
    for name, info in analysis.fields.items():
        print(f"  - {name}")
        print(f"    类型: {info.field_type.value}")
        print(f"    当前值: {info.value}")
        print(f"    只读: {info.is_readonly}")
        print(f"    必填: {info.is_required}")
        if info.rect:
            print(f"    位置: {info.rect}")
        print()


def example_field_mapping(pdf_path: str):
    """
    示例 2: 获取字段映射

    获取 FieldName 到字段信息的映射字典。
    """
    print("=" * 50)
    print("示例 2: 字段映射")
    print("=" * 50)

    fields = get_field_mapping(pdf_path)

    print(f"共有 {len(fields)} 个字段:\n")

    # 按类型分组显示
    type_groups = {}
    for name, info in fields.items():
        field_type = info.field_type.value
        if field_type not in type_groups:
            type_groups[field_type] = []
        type_groups[field_type].append((name, info))

    for field_type, items in type_groups.items():
        print(f"{field_type.upper()} 类型字段 ({len(items)} 个):")
        for name, info in items:
            print(f"  - {name}: {info.value or '(空)'}")
        print()


def example_fill_form(pdf_path: str, output_path: str):
    """
    示例 3: 填充表单

    填充 PDF 表单并保存，支持中文。
    """
    print("=" * 50)
    print("示例 3: 填充表单")
    print("=" * 50)

    # 首先获取字段映射
    fields = get_field_mapping(pdf_path)

    if not fields:
        print("此 PDF 没有表单字段")
        return

    # 准备填充数据（示例）
    field_values = {}
    for name, info in fields.items():
        if info.field_type == FieldType.TEXT and not info.is_readonly:
            # 使用中文和英文混合测试
            field_values[name] = f"测试内容 - {name}"
        elif info.field_type == FieldType.CHECKBOX and not info.is_readonly:
            field_values[name] = True

    if not field_values:
        print("没有可填充的字段")
        return

    print("将填充以下字段:")
    for name, value in field_values.items():
        print(f"  - {name}: {value}")

    # 执行填充
    result = fill_pdf_form(
        pdf_path=pdf_path,
        output_path=output_path,
        field_values=field_values,
        update_appearances=True,  # 更新外观流
        set_need_appearances=True,  # 设置 NeedAppearances 标记
        save_mode=SaveMode.FULL_REWRITE,  # 完全重写模式
    )

    print(f"\n填充结果: {'成功' if result.success else '失败'}")

    if result.success:
        print(f"输出文件: {result.output_path}")
        print(f"成功填充字段: {result.filled_fields}")

    if result.failed_fields:
        print(f"填充失败字段: {result.failed_fields}")

    if result.warnings:
        print("警告:")
        for warning in result.warnings:
            print(f"  - {warning}")

    if result.errors:
        print("错误:")
        for error in result.errors:
            print(f"  - {error}")


def example_advanced_usage(pdf_path: str, output_path: str):
    """
    示例 4: 高级用法

    使用 PDFFormFiller 类进行更精细的控制。
    """
    print("=" * 50)
    print("示例 4: 高级用法")
    print("=" * 50)

    # 创建填充器实例
    filler = PDFFormFiller(pdf_path)

    # 分析表单
    analysis = filler.analyze()

    # 根据表单类型采取不同策略
    if analysis.form_type == FormType.XFA_DYNAMIC:
        print("检测到动态 XFA 表单，建议使用 Adobe Acrobat 处理")
        return

    if analysis.form_type == FormType.HYBRID:
        print("检测到混合表单 (AcroForm + XFA)")
        print("将优先处理 AcroForm 部分")

    # 检查权限
    if not analysis.permissions.get("can_fill_forms", True):
        print("此 PDF 禁止表单填充")
        return

    # 筛选可填充字段
    fillable_fields = {
        name: info for name, info in analysis.fields.items()
        if not info.is_readonly and info.field_type == FieldType.TEXT
    }

    print(f"可填充的文本字段: {len(fillable_fields)} 个")

    if not fillable_fields:
        return

    # 准备数据
    field_values = {
        name: f"高级测试 - {name}"
        for name in list(fillable_fields.keys())[:3]  # 只填前3个
    }

    # 填充并扁平化
    result = filler.fill(
        field_values=field_values,
        output_path=output_path,
        save_mode=SaveMode.FULL_REWRITE,
        update_appearances=True,
        set_need_appearances=True,
        flatten=False,  # 设为 True 可扁平化（不可再编辑）
    )

    print(f"\n结果: {'成功' if result.success else '失败'}")
    if result.success:
        print(f"已保存到: {output_path}")


def example_xfa_detection(pdf_path: str):
    """
    示例 5: XFA 表单检测

    检测 PDF 是否包含 XFA 表单，并获取相关信息。
    """
    print("=" * 50)
    print("示例 5: XFA 表单检测")
    print("=" * 50)

    filler = PDFFormFiller(pdf_path)
    analysis = filler.analyze()

    print(f"表单类型: {analysis.form_type.value}")
    print(f"包含 XFA: {analysis.has_xfa}")

    if analysis.has_xfa:
        if analysis.form_type == FormType.XFA_STATIC:
            print("这是静态 XFA 表单，可以尝试处理")
        elif analysis.form_type == FormType.XFA_DYNAMIC:
            print("这是动态 XFA 表单，处理能力有限")
            print("建议：")
            print("  1. 使用 Adobe Acrobat 填充")
            print("  2. 或联系表单提供者获取 AcroForm 版本")

        if analysis.xfa_data:
            print(f"\nXFA 数据大小: {len(analysis.xfa_data)} 字节")
            # 显示 XFA 数据片段
            preview = analysis.xfa_data[:500]
            print(f"XFA 数据预览:\n{preview}...")


if __name__ == "__main__":
    import os

    # 使用 uploads 目录中的第一个 PDF 进行测试
    uploads_dir = Path(__file__).parent.parent / "uploads"
    pdf_files = list(uploads_dir.glob("*.pdf"))

    if not pdf_files:
        print("uploads 目录中没有 PDF 文件")
        print("请上传一个带有表单的 PDF 文件进行测试")
        sys.exit(1)

    test_pdf = str(pdf_files[0])
    output_pdf = str(uploads_dir / "filled_example.pdf")

    print(f"使用测试文件: {test_pdf}\n")

    # 运行示例
    example_basic_analysis(test_pdf)
    print("\n")

    example_field_mapping(test_pdf)
    print("\n")

    example_xfa_detection(test_pdf)
    print("\n")

    # 以下示例会生成输出文件
    # example_fill_form(test_pdf, output_pdf)
    # example_advanced_usage(test_pdf, output_pdf)
