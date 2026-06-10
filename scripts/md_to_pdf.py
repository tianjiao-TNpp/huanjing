# -*- coding: utf-8 -*-
"""把说明书 markdown 转成中文 PDF（用 reportlab + 微软雅黑）。
支持：# / ## / ### 标题、--- 分隔线、> 引用、- 列表、1. 列表、
      | 表格 |、``` 代码块、**粗体**、`行内代码`、[文字](链接)。
不支持的彩色 emoji 会被自动去掉（字体没有这些字形）。
用法: python scripts/md_to_pdf.py 源.md 输出.pdf
"""
import sys, os, re
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
                                Preformatted, HRFlowable)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

FONT, FONT_B = "YaHei", "YaHei-Bold"
pdfmetrics.registerFont(TTFont(FONT, r"C:\Windows\Fonts\msyh.ttc", subfontIndex=0))
pdfmetrics.registerFont(TTFont(FONT_B, r"C:\Windows\Fonts\msyhbd.ttc", subfontIndex=0))

GREEN = colors.HexColor("#1f8a5b")
DARK = colors.HexColor("#1b1f1d")
SUB = colors.HexColor("#5b6b63")
LIGHT = colors.HexColor("#eef3f0")
LINE = colors.HexColor("#d7e0db")

# 去掉彩色 emoji / 不支持的符号（保留箭头→、方框│、几何▼）
EMOJI = re.compile(
    "[\U0001F000-\U0001FAFF\U00002600-\U000027BF\U00002B00-\U00002BFF"
    "\U0001F1E6-\U0001F1FF\U0000FE0F\U0000200D\U00002190\U00002191\U00002193]")
# (注：把 ←↑↓ 也去了，但保留 → U+2192，下面单独加回)

def strip_emoji(s):
    s = s.replace("→", "\x00ARROW\x00")  # 临时保护 →
    s = EMOJI.sub("", s)
    s = s.replace("\x00ARROW\x00", "→")
    return re.sub(r"  +", " ", s).strip()

def inline(text):
    text = strip_emoji(text)
    # 先转义
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    # [文字](链接) -> 文字
    text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r"\1", text)
    # **粗体**
    text = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", text)
    # `行内代码` -> 绿色
    text = re.sub(r"`([^`]+)`", r'<font color="#1f8a5b">\1</font>', text)
    return text

# 样式
S = {
    "h1": ParagraphStyle("h1", fontName=FONT_B, fontSize=19, leading=26, textColor=GREEN, spaceAfter=10, spaceBefore=2),
    "h2": ParagraphStyle("h2", fontName=FONT_B, fontSize=15, leading=21, textColor=DARK, spaceBefore=14, spaceAfter=6),
    "h3": ParagraphStyle("h3", fontName=FONT_B, fontSize=12.5, leading=18, textColor=GREEN, spaceBefore=9, spaceAfter=4),
    "body": ParagraphStyle("body", fontName=FONT, fontSize=10.5, leading=16.5, textColor=DARK, spaceAfter=4),
    "bullet": ParagraphStyle("bullet", fontName=FONT, fontSize=10.5, leading=16, textColor=DARK,
                             leftIndent=16, bulletIndent=4, spaceAfter=2),
    "quote": ParagraphStyle("quote", fontName=FONT, fontSize=10, leading=15, textColor=SUB,
                            leftIndent=12, spaceBefore=3, spaceAfter=6),
    "cell": ParagraphStyle("cell", fontName=FONT, fontSize=9.5, leading=14, textColor=DARK),
    "cellh": ParagraphStyle("cellh", fontName=FONT_B, fontSize=9.5, leading=14, textColor=DARK),
    "code": ParagraphStyle("code", fontName=FONT, fontSize=9, leading=13.5, textColor=DARK),
}

def make_table(rows):
    head, body = rows[0], rows[1:]
    ncol = len(head)
    avail = A4[0] - 36 * mm
    if ncol == 2: ws = [avail * 0.30, avail * 0.70]
    elif ncol == 3: ws = [avail * 0.30, avail * 0.35, avail * 0.35]
    else: ws = [avail / ncol] * ncol
    data = [[Paragraph(inline(c), S["cellh"]) for c in head]]
    for r in body:
        data.append([Paragraph(inline(c), S["cell"]) for c in r])
    t = Table(data, colWidths=ws, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), LIGHT),
        ("GRID", (0, 0), (-1, -1), 0.5, LINE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
    ]))
    return t

def code_block(text):
    pre = Preformatted(text.rstrip("\n"), S["code"])
    t = Table([[pre]], colWidths=[A4[0] - 36 * mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f5f7f6")),
        ("BOX", (0, 0), (-1, -1), 0.5, LINE),
        ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("LEFTPADDING", (0, 0), (-1, -1), 9), ("RIGHTPADDING", (0, 0), (-1, -1), 9),
    ]))
    return t

def parse(md):
    lines = md.split("\n")
    flow = []
    i, n = 0, len(lines)
    while i < n:
        ln = lines[i]
        st = ln.strip()
        # 代码块
        if st.startswith("```"):
            i += 1; buf = []
            while i < n and not lines[i].strip().startswith("```"):
                buf.append(lines[i]); i += 1
            i += 1
            flow.append(code_block("\n".join(buf)))
            continue
        # 表格
        if "|" in ln and st.startswith("|"):
            tb = []
            while i < n and lines[i].strip().startswith("|"):
                row = [c.strip() for c in lines[i].strip().strip("|").split("|")]
                tb.append(row); i += 1
            tb = [r for r in tb if not re.match(r"^[-:\s|]+$", "|".join(r))]  # 去掉分隔行
            if tb: flow.append(make_table(tb)); flow.append(Spacer(1, 6))
            continue
        # 空行
        if st == "":
            i += 1; continue
        # 分隔线
        if re.match(r"^([-*_=]){3,}$", st) or set(st) <= set("═-"):
            flow.append(Spacer(1, 4))
            flow.append(HRFlowable(width="100%", thickness=0.7, color=LINE, spaceBefore=2, spaceAfter=8))
            i += 1; continue
        # 标题
        m = re.match(r"^(#{1,3})\s+(.*)$", st)
        if m:
            lvl = len(m.group(1)); txt = inline(m.group(2))
            flow.append(Paragraph(txt, S["h%d" % lvl])); i += 1; continue
        # 引用
        if st.startswith(">"):
            flow.append(Paragraph(inline(st.lstrip("> ").strip()), S["quote"])); i += 1; continue
        # 无序列表
        m = re.match(r"^[-*]\s+(.*)$", st)
        if m:
            flow.append(Paragraph(inline(m.group(1)), S["bullet"], bulletText="•")); i += 1; continue
        # 有序列表
        m = re.match(r"^(\d+)\.\s+(.*)$", st)
        if m:
            flow.append(Paragraph(inline(m.group(2)), S["bullet"], bulletText=m.group(1) + ".")); i += 1; continue
        # 普通段落
        flow.append(Paragraph(inline(st), S["body"])); i += 1
    return flow

def convert(src, out):
    md = open(src, encoding="utf-8").read()
    doc = SimpleDocTemplate(out, pagesize=A4,
                            leftMargin=18 * mm, rightMargin=18 * mm,
                            topMargin=16 * mm, bottomMargin=16 * mm,
                            title=os.path.splitext(os.path.basename(src))[0])

    def footer(canvas, d):
        canvas.saveState()
        canvas.setFont(FONT, 8)
        canvas.setFillColor(SUB)
        canvas.drawCentredString(A4[0] / 2, 10 * mm, "环境百词斩 · 第 %d 页" % d.page)
        canvas.restoreState()

    doc.build(parse(md), onFirstPage=footer, onLaterPages=footer)
    print("生成:", out)

if __name__ == "__main__":
    convert(sys.argv[1], sys.argv[2])
