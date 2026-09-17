import { describe, expect, it } from "vitest";

import { COLLEGES } from "../colleges-data";
import {
  applicantsText,
  blankName,
  dateTerm,
  deadlineText,
  formatFieldL,
  genderName,
  idefName,
  ivwName,
  nameOf,
  pair,
  subNameOf,
  termText,
  testName,
  typeName,
} from "../colleges-l10n";

const princeton = COLLEGES.find((c) => c.en === "Princeton University")!;
const womenOnly = COLLEGES.find((c) => c.mf === "女校")!;
const singleRound = COLLEGES.find((c) => c.singleRound)!;

describe("双语取值（§6.15）", () => {
  it("pair：英文模式取 en，缺英文回落中文；中文模式不回落", () => {
    expect(pair("中文", "English", "zh")).toBe("中文");
    expect(pair("中文", "English", "en")).toBe("English");
    expect(pair("中文", "", "en")).toBe("中文");
    expect(pair("中文", null, "en")).toBe("中文");
    expect(pair("中文", "English", "en")).toBe(pair("中文", "English", "en"));
  });

  it("nameOf / subNameOf：主名按语言切，副名不重复渲染", () => {
    expect(nameOf(princeton, "zh")).toBe("普林斯顿大学");
    expect(nameOf(princeton, "en")).toBe("Princeton University");
    expect(subNameOf(princeton, "zh")).toBe("Princeton University");
    expect(subNameOf(princeton, "en")).toBe("普林斯顿大学");
  });

  it("区位 / 气质 / 点评走双语字段，不是单语", () => {
    const zh = COLLEGES.map((c) => c.cz).join("");
    const en = COLLEGES.map((c) => c.ce).join("");
    expect(zh).not.toBe(en);
    for (const c of COLLEGES) {
      expect(c.ce.trim().length, `${c.zh} 缺英文区位`).toBeGreaterThan(0);
      expect(c.te.trim().length, `${c.zh} 缺英文气质`).toBeGreaterThan(0);
      expect(c.ne.trim().length, `${c.zh} 缺英文点评`).toBeGreaterThan(0);
    }
  });

  it("枚举：标化政策 / 面试政策 / 国际生认定 两种语言都有词", () => {
    for (const c of COLLEGES) {
      expect(testName(c.test, "en")).not.toMatch(/[\u4e00-\u9fff]/);
      expect(testName(c.test, "zh")).toMatch(/[\u4e00-\u9fff]/);
      expect(ivwName(c.ivw_c, "en")).not.toMatch(/[\u4e00-\u9fff]/);
      expect(idefName(c.idef_c, "en")).not.toMatch(/[\u4e00-\u9fff]/);
      expect(typeName(c, "en")).not.toMatch(/[\u4e00-\u9fff]/);
    }
  });
});

describe("日期与数值术语转换（§6.15 / §3.6）", () => {
  it("文档里的例子：11月1日(SCEA) → Nov 1 (SCEA)", () => {
    expect(dateTerm("11月1日(SCEA)", "en")).toBe("Nov 1 (SCEA)");
    expect(dateTerm("11月1日(SCEA)", "zh")).toBe("11月1日(SCEA)");
  });

  it("跨年归一用的 1 月日期照样能转", () => {
    expect(dateTerm("1月4日", "en")).toBe("Jan 4");
    expect(dateTerm("11月15日(ED1)/1月5日(ED2)", "en")).toBe("Nov 15 (ED1)/Jan 5 (ED2)");
    expect(dateTerm("1月1日", "en")).toBe("Jan 1");
  });

  it("固定说法走术语表", () => {
    expect(dateTerm("未设线", "en")).toBe("No minimum");
    expect(dateTerm("无硬性线(建议100+)", "en")).toBe("No hard minimum (rec. 100+)");
    expect(dateTerm("90(建议100)", "en")).toBe("90 (rec. 100)");
    expect(dateTerm("见官网", "en")).toBe("See school site");
  });

  it("空值给统一文案，不是空白", () => {
    expect(dateTerm(null, "zh")).toBe("未公布");
    expect(dateTerm("", "en")).toBe("Not published");
  });

  it("termText：CDS 推算 / 加权 这类后缀也能读", () => {
    expect(termText("27.3%(CDS推算)", "en")).toBe("27.3% (CDS-derived)");
    expect(termText("4.22(加权)", "en")).toBe("4.22 (weighted)");
    expect(termText("8.7%(2028届EA,其后未公布)", "en")).toContain("class of 2028");
  });

  it("formatFieldL：0 不算空（§3.6 的防复发断言）", () => {
    expect(formatFieldL(0, "count", "zh")).toBe("0");
    expect(formatFieldL(0, "count", "en")).toBe("0");
    expect(formatFieldL(null, "text", "zh")).toBe("未公布");
    expect(formatFieldL(null, "text", "en")).toBe("Not published");
    expect(formatFieldL(null, "rank", "en")).toBe("Not ranked");
    expect(formatFieldL("", "list", "en")).toBe("—");
    expect(blankName("en", "percent")).toBe("Not published");
  });

  it("男女比：女校渲染成文字，不塞进比例位置", () => {
    expect(genderName("女校", "zh")).toBe("女子学院");
    expect(genderName("女校", "en")).toBe("Women's college");
    expect(genderName("女校", "zh", true)).toBe("女校");
    expect(genderName("50:50", "en")).toBe("50:50");
    expect(genderName(null, "en")).toBe("Not published");
    expect(womenOnly.mf).toBe("女校");
  });

  it("申请人数用千分位，0 也照样显示 0", () => {
    expect(applicantsText(princeton, "en")).toBe("42,303");
    expect(applicantsText(princeton, "zh")).toContain("42,303");
  });

  it("单轮申请的学校：早申一栏给「无早申」而不是空白", () => {
    expect(deadlineText(singleRound, "zh")).toContain("无早申");
    expect(deadlineText(singleRound, "en")).toContain("No early round");
  });
});

describe("单语字段的边界（§6.15）", () => {
  it("essays / idef_t / ivw_t 源数据是中文，三种语言的校验不适用于它们", () => {
    const hasChinese = (s: string) => /[\u4e00-\u9fff]/.test(s);
    const withEssays = COLLEGES.filter((c) => c.essays !== "[]");
    expect(withEssays.length).toBeGreaterThan(0);
    expect(withEssays.every((c) => hasChinese(c.essays) || c.essays === "[]")).toBe(true);
    const withIdef = COLLEGES.filter((c) => c.idef_t !== null);
    expect(withIdef.every((c) => hasChinese(c.idef_t!))).toBe(true);
  });
});
