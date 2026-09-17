import { describe, expect, it } from "vitest";

import {
  blankName,
  formatField,
  formatGenderRatio,
  formatPercent,
  isBlank,
  isExtrapolated,
} from "../colleges-format";
import { formatFieldL } from "../colleges-l10n";

describe("空值格式化（§3.6）", () => {
  it("isBlank 只认 null / undefined / 空串", () => {
    expect(isBlank(null)).toBe(true);
    expect(isBlank(undefined)).toBe(true);
    expect(isBlank("")).toBe(true);
    expect(isBlank(0)).toBe(false);
    expect(isBlank("0")).toBe(false);
    expect(isBlank(false)).toBe(false);
  });

  it("formatField：0 显示成 0，不是「未公布」", () => {
    expect(formatField(0, "count")).toBe("0");
    expect(formatField(0)).toBe("0");
    expect(formatField("", "text")).toBe("未公布");
    expect(formatField(null, "rank")).toBe("未上榜");
    expect(formatField(null, "list")).toBe("—");
  });

  it("formatField 支持语言：英文模式给英文空值文案", () => {
    expect(formatField("", "text", "en")).toBe("Not published");
    expect(formatField(null, "rank", "en")).toBe("Not ranked");
    expect(formatField(42303, "count", "en")).toBe("42,303");
    expect(formatField(42303, "count", "zh")).toBe("42,303");
  });

  it("blankName 三种 kind 各自的文案", () => {
    expect(blankName("zh", "text")).toBe("未公布");
    expect(blankName("zh", "rank")).toBe("未上榜");
    expect(blankName("zh", "list")).toBe("—");
    expect(blankName("en", "text")).toBe("Not published");
    // 默认 kind 是 text
    expect(blankName("zh")).toBe("未公布");
  });

  it("formatPercent 透传，空值给统一文案", () => {
    expect(formatPercent("13%")).toBe("13%");
    expect(formatPercent(null, "en")).toBe("Not published");
    expect(formatPercent("   ", "zh")).toBe("未公布");
  });

  it("isExtrapolated 认「推算」二字（RD 录取率必须常驻标注）", () => {
    expect(isExtrapolated("27.3%(CDS推算)")).toBe(true);
    expect(isExtrapolated("4.4%")).toBe(false);
    expect(isExtrapolated(null)).toBe(false);
  });

  it("formatGenderRatio：女校渲染成文字，默认与短文案两种", () => {
    expect(formatGenderRatio("女校")).toBe("女子学院");
    expect(formatGenderRatio("女校", "en")).toBe("Women's college");
    expect(formatGenderRatio("女校", "zh", true)).toBe("女校");
    expect(formatGenderRatio("女校", "en", true)).toBe("Women's");
    expect(formatGenderRatio("50:50")).toBe("50:50");
    expect(formatGenderRatio(null, "en")).toBe("Not published");
  });

  it("formatFieldL 在 formatField 之上叠加术语转换，中文模式原样", () => {
    expect(formatFieldL(null, "text", "zh")).toBe("未公布");
    expect(formatFieldL(null, "text", "en")).toBe("Not published");
    expect(formatFieldL("4.22(加权)", "text", "en")).toBe("4.22 (weighted)");
    expect(formatFieldL("4.22(加权)", "text", "zh")).toBe("4.22(加权)");
    expect(formatFieldL("27.3%(CDS推算)", "percent", "en")).toBe("27.3% (CDS-derived)");
  });
});
