// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CollegesProvider } from "../colleges-context";
import { SchoolProfile } from "../school-profile";
import { COLLEGES } from "@/lib/colleges-data";

const noop = () => {};

/** docs/06 第五节定的 15 节顺序 —— 不重排、不删节（docs/08 §6.19）。 */
const SECTION_ORDER = [
  "排名",
  "所在城市与州",
  "学费（不含食宿）",
  "申请批次",
  "最近申请季截止日期",
  "录取率（最近申请季）",
  "申请人数（最近申请季）",
  "在读本科男女比例（男:女）",
  "本科国际生比例",
  "语言要求与标化",
  "面试政策",
  "小文书",
  "院校气质",
  "一句话点评",
  "数据信号",
];

function renderProfile(en: string, lang: "zh" | "en" = "zh") {
  const c = COLLEGES.find((x) => x.en === en)!;
  return render(
    <CollegesProvider lang={lang} font={0}>
      <SchoolProfile
        college={c}
        inSlot={false}
        slotsFull={false}
        isFav={false}
        matchLabel={null}
        matchWhyText={null}
        onToggleSlot={noop}
        onToggleFav={noop}
        onClose={noop}
      />
    </CollegesProvider>,
  );
}

describe("SchoolProfile（15 节档案）", () => {
  it("节编号与标题顺序与 docs/06 第五节一致", () => {
    const c = COLLEGES.find((x) => x.en === "Princeton University")!;
    expect(c).toBeTruthy();
    renderProfile("Princeton University");
    const heads = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent ?? "");
    const titles = heads.map((h) => h.replace(/^\d+/, ""));
    // 第 15 节是条件渲染，命中信号时才会出现；普林斯顿命中早申杠杆等 → 应当出现
    const expected = SECTION_ORDER.filter((s) => titles.includes(s));
    expect(titles).toEqual(expected);
    expect(titles[0]).toBe("排名");
  });

  it("缺字段的院校显示「未公布」，不出现 null / undefined / NaN（§7.3）", () => {
    const c = COLLEGES.find((x) => x.tuition === null && x.rr === null)!;
    expect(c).toBeTruthy();
    renderProfile(c.en);
    const text = document.body.textContent ?? "";
    expect(text).toContain("未公布");
    expect(text).not.toContain("null");
    expect(text).not.toContain("undefined");
    expect(text).not.toContain("NaN");
  });

  it("对比位已满时按钮置灰 + 一行说明（原版是 alert 弹窗）", () => {
    const c = COLLEGES[0];
    render(
      <CollegesProvider lang="zh" font={0}>
        <SchoolProfile
          college={c}
          inSlot={false}
          slotsFull
          isFav={false}
          matchLabel={null}
          matchWhyText={null}
          onToggleSlot={noop}
          onToggleFav={noop}
          onClose={noop}
        />
      </CollegesProvider>,
    );
    const btn = screen.getByRole("button", { name: "对比位已满（3/3）" });
    expect(btn.hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("对比位已满，请先移除一所再加入")).toBeTruthy();
  });

  it("档案底部有口径说明（数据来源 / 排名口径 / 推算值 / 更新时间）", () => {
    renderProfile("Princeton University");
    const text = document.body.textContent ?? "";
    expect(text).toContain("数据来源为各校 Common Data Set");
    expect(text).toContain("US News 2026");
    expect(text).toContain("推算值");
    expect(text).toContain("2026-08-11");
    expect(text).toContain("CDS 2025-26");
  });

  it("档案全文不含第三方导流话术（评审 M2）", () => {
    const banned = ["小助手", "顾问", "私信", "定位报告", "点评报告", "CMC"];
    for (const c of [COLLEGES[0], COLLEGES.find((x) => x.type === "lac")!]) {
      const { unmount } = renderProfile(c.en);
      const text = document.body.textContent ?? "";
      for (const b of banned) expect(text.includes(b), `${c.zh} 出现「${b}」`).toBe(false);
      unmount();
    }
  });

  it("英文模式：界面与国际生认定原文分开处理 —— 面板标题切英文，中文原文保留并带说明", () => {
    renderProfile("Princeton University", "en");
    const text = document.body.textContent ?? "";
    expect(screen.queryByText("排名")).toBeNull();
    expect(text).toContain("Ranking");
    expect(text).toContain("City & state");
    // idef_t 是单语字段：保留中文原文 + 一行说明（§6.15）
    const princeton = COLLEGES.find((x) => x.en === "Princeton University")!;
    expect(text).toContain(princeton.idef_t!);
    expect(text).toContain("Chinese-only source data");
  });

  it("英文模式的区位 / 气质 / 点评换成英文（这三处是双语的，不受单语限制）", () => {
    const c = COLLEGES.find((x) => x.en === "Princeton University")!;
    renderProfile(c.en, "en");
    const text = document.body.textContent ?? "";
    expect(text).toContain(c.ce);
    expect(text).toContain(c.ne);
    expect(text).not.toContain(c.cz);
    expect(text).not.toContain(c.nz);
  });
});
