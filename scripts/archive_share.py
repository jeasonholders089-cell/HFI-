"""把 ChatGPT 分享页的 HTML 转成可长期保存的纯文本存档。

用法：
    python scripts/archive_share.py <share_html> <output_md> <share_url>

说明：分享页的内容由前端渲染，直接请求 HTML 拿不到正文，
需先通过可执行 JS 的阅读器（如 r.jina.ai，X-Return-Format: html）取回渲染后的 HTML。
"""

import re
import sys

from lxml import html as LH


def extract(html_text: str) -> str:
    doc = LH.fromstring(html_text)
    for bad in doc.xpath("//script | //style | //noscript"):
        bad.getparent().remove(bad)

    nodes = doc.xpath("//*[@data-message-author-role]")
    parts = []
    for node in nodes:
        role = node.get("data-message-author-role")
        label = {"assistant": "ChatGPT", "user": "用户"}.get(role, role)
        body = re.sub(r"\n{3,}", "\n\n", node.text_content()).strip()
        parts.append(f"### {label}\n\n{body}\n")

    return "\n".join(parts) if parts else re.sub(r"\n{3,}", "\n\n", doc.text_content()).strip()


def main() -> None:
    src, dst, url = sys.argv[1], sys.argv[2], sys.argv[3]
    html_text = open(src, encoding="utf-8").read()
    body = extract(html_text)

    header = (
        "# 原始对话记录（存档）\n\n"
        f"- 来源：{url}\n"
        "- 抓取方式：r.jina.ai 渲染后取 HTML，再抽正文\n"
        "- 用途：需求追溯。本文件只读，不做修改，修订结论写入 01/02 号文档。\n\n"
        "---\n\n"
    )
    open(dst, "w", encoding="utf-8").write(header + body + "\n")
    print("wrote", dst, len(body), "chars")


if __name__ == "__main__":
    main()
