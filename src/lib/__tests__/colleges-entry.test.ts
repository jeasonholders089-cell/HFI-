import { describe, expect, it } from "vitest";

import { entryContextText, parseEntryContext } from "../colleges-entry";
import { emptyKindFor } from "../colleges-filter";

describe("入口互通的 URL 契约（§6.17）", () => {
  it("解析 from=child + direction", () => {
    expect(parseEntryContext("?from=child&direction=艺术")).toEqual({
      from: "child",
      direction: "艺术",
    });
  });

  it("解析 from=explore", () => {
    expect(parseEntryContext("?from=explore")).toEqual({ from: "explore", direction: null });
  });

  it("无参数 / 未知来源 / 空 direction 都不算来源", () => {
    expect(parseEntryContext("")).toEqual({ from: null, direction: null });
    expect(parseEntryContext("?from=wechat")).toEqual({ from: null, direction: null });
    expect(parseEntryContext("?from=child&direction=%20").direction).toBeNull();
  });

  it("语境条文案按语言取，无来源时返回空串（不渲染）", () => {
    expect(entryContextText({ from: "child", direction: "艺术" }, "zh")).toBe(
      "来自成长画像 · 艺术方向",
    );
    expect(entryContextText({ from: "child", direction: "艺术" }, "en")).toContain("growth profile");
    expect(entryContextText({ from: "child", direction: null }, "zh")).toBe("来自成长画像");
    expect(entryContextText({ from: "explore", direction: null }, "zh")).toBe("来自现场全景");
    expect(entryContextText({ from: null, direction: null }, "zh")).toBe("");
  });
});

describe("空态判定（§6.16）", () => {
  it("有结果就没有空态", () => {
    expect(emptyKindFor({ resultCount: 3, favOnly: false, favCount: 0, q: "" })).toBeNull();
  });

  it("只看收藏但收藏为空 → 「还没有收藏学校」，与筛选无结果的文案不同", () => {
    expect(emptyKindFor({ resultCount: 0, favOnly: true, favCount: 0, q: "" })).toBe("favs");
  });

  it("搜索无结果 → 引导文案（优先级高于普通筛选）", () => {
    expect(emptyKindFor({ resultCount: 0, favOnly: false, favCount: 0, q: "某大学" })).toBe("search");
  });

  it("其余情况 → 「没有符合条件的学校」", () => {
    expect(emptyKindFor({ resultCount: 0, favOnly: false, favCount: 0, q: "" })).toBe("filtered");
  });

  it("只看收藏且收藏非空但被其他筛选清空 → 走普通筛选空态（不能误报收藏为空）", () => {
    expect(emptyKindFor({ resultCount: 0, favOnly: true, favCount: 4, q: "" })).toBe("filtered");
  });
});
