"""把 Markdown 文档渲染成排版工整的 PDF。

用法：
    python scripts/md_to_pdf.py <input.md> <output.pdf> [--title "标题"]

做法：Markdown -> HTML -> Chromium 打印成 PDF。
选 Chromium 而不是 reportlab，是因为源文档里有大量中文表格、代码块和用制表符画的流程图，
HTML 排版引擎能原样还原，reportlab 需要自己写一套版式引擎，容易出表格截断和换行错乱。
"""

import argparse
import re
import sys
from pathlib import Path

from markdown_it import MarkdownIt
from playwright.sync_api import sync_playwright

CSS = """
@page {
  size: A4;
  margin: 18mm 16mm 20mm 16mm;
}

* { box-sizing: border-box; }

html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }

body {
  margin: 0;
  font-family: "Microsoft YaHei", "微软雅黑", "Segoe UI", "PingFang SC", sans-serif;
  font-size: 10.5pt;
  line-height: 1.7;
  color: #23302B;
  background: #FFFFFF;
  word-wrap: break-word;
}

/* ---------- 标题层级 ---------- */
h1, h2, h3, h4 {
  font-weight: 700;
  color: #16352A;
  line-height: 1.35;
  break-after: avoid-page;
}

h1 {
  font-size: 21pt;
  margin: 0 0 4mm 0;
  padding-bottom: 3mm;
  border-bottom: 2.5pt solid #1F4D3A;
  letter-spacing: 0.2pt;
}

h2 {
  font-size: 14.5pt;
  margin: 9mm 0 3mm 0;
  padding: 0 0 1.6mm 0;
  border-bottom: 1pt solid #BFD3CA;
}

h3 {
  font-size: 12pt;
  margin: 6mm 0 2mm 0;
  color: #1F4D3A;
}

h4 {
  font-size: 10.8pt;
  margin: 4.5mm 0 1.5mm 0;
  color: #35664F;
}

/* ---------- 正文 ---------- */
p { margin: 0 0 2.4mm 0; }

strong { color: #12352A; font-weight: 700; }

hr {
  border: none;
  border-top: 1pt solid #DCE6E1;
  margin: 6mm 0;
}

/* ---------- 列表 ---------- */
ul, ol { margin: 0 0 2.6mm 0; padding-left: 6mm; }
li { margin: 0 0 1.2mm 0; }
li > ul, li > ol { margin-top: 1.2mm; }

/* 任务清单：去掉圆点，保留方框 */
li.task-list-item { list-style: none; margin-left: -4mm; }
li.task-list-item input { margin-right: 1.5mm; }

/* ---------- 表格 ---------- */
table {
  width: 100%;
  border-collapse: collapse;
  margin: 2mm 0 4mm 0;
  font-size: 9pt;
  line-height: 1.55;
}

thead { display: table-header-group; }

th, td {
  border: 0.6pt solid #C6D8D0;
  padding: 1.5mm 2mm;
  text-align: left;
  vertical-align: top;
  /* 中文不要在词中间断行，实在放不下再断 */
  word-break: keep-all;
  overflow-wrap: break-word;
}

th {
  background: #E9F1ED;
  color: #16352A;
  font-weight: 700;
  vertical-align: middle;
}

tbody tr { break-inside: avoid; }
tbody tr:nth-child(even) { background: #F7FAF9; }

td code, th code { font-size: 8.3pt; }

/* ---------- 代码块 ---------- */
pre {
  background: #F3F7F5;
  border-left: 2.5pt solid #3E7A5E;
  border-radius: 1mm;
  padding: 2.5mm 3mm;
  margin: 2mm 0 3.5mm 0;
  overflow: visible;
  white-space: pre-wrap;
  font-family: "Cascadia Mono", Consolas, "Microsoft YaHei", monospace;
  font-size: 8.2pt;
  line-height: 1.5;
  color: #1D3A2E;
}

pre code {
  background: none;
  border: none;
  padding: 0;
  font-size: inherit;
  white-space: inherit;
}

/* ---------- 行内代码 ---------- */
code {
  font-family: "Cascadia Mono", Consolas, "Microsoft YaHei", monospace;
  font-size: 9pt;
  background: #EDF3F0;
  border: 0.5pt solid #DCE6E1;
  border-radius: 0.8mm;
  padding: 0.3mm 1.2mm;
  color: #1D4A38;
}

/* ---------- 引用块 ---------- */
blockquote {
  margin: 2.5mm 0 3.5mm 0;
  padding: 2mm 3.5mm;
  border-left: 2.5pt solid #8FB8A4;
  background: #F6FAF8;
  color: #37473F;
}

blockquote p:last-child { margin-bottom: 0; }

/* ---------- 链接 ---------- */
a { color: #1F6B4C; text-decoration: none; }
"""

HTML_SHELL = """<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>{title}</title>
<style>{css}</style>
</head>
<body>
{body}
</body>
</html>
"""


def build_html(markdown_text: str, title: str) -> str:
    md = MarkdownIt("gfm-like", {"html": False, "linkify": False, "typographer": False})
    body = md.render(markdown_text)
    return HTML_SHELL.format(title=title, css=CSS, body=body)


def render(html: str, out_pdf: Path, footer_text: str) -> None:
    footer = (
        '<div style="width:100%;font-family:Microsoft YaHei,sans-serif;'
        'font-size:8pt;color:#7C8F87;padding:0 16mm;display:flex;'
        'justify-content:space-between;align-items:center;">'
        f"<span>{footer_text}</span>"
        '<span>第 <span class="pageNumber"></span> / <span class="totalPages"></span> 页</span>'
        "</div>"
    )
    header = '<div style="height:0;"></div>'

    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        page = browser.new_page()
        page.set_content(html, wait_until="load")
        page.emulate_media(media="print")
        page.pdf(
            path=str(out_pdf),
            format="A4",
            print_background=True,
            display_header_footer=True,
            header_template=header,
            footer_template=footer,
            margin={"top": "16mm", "right": "16mm", "bottom": "18mm", "left": "16mm"},
        )
        browser.close()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("input")
    ap.add_argument("output")
    ap.add_argument("--title", default=None)
    args = ap.parse_args()

    src = Path(args.input)
    dst = Path(args.output)
    if not src.is_file():
        print(f"input not found: {src}", file=sys.stderr)
        return 1

    text = src.read_text(encoding="utf-8")

    # 非换行连字符在个别字体里会缺字形，统一换成普通连字符。
    text = text.replace("\u2011", "-")

    title = args.title or (re.search(r"^#\s+(.+)$", text, re.M) or [None, src.stem])[1]

    dst.parent.mkdir(parents=True, exist_ok=True)
    html = build_html(text, title)
    render(html, dst, title)
    print(f"wrote {dst} ({dst.stat().st_size / 1024:.0f} KB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
