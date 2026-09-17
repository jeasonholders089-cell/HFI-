import { describe, expect, it } from "vitest";

import { COLLEGES } from "../colleges-data";
import { TEXT, t, type TextKey } from "../colleges-i18n";

/**
 * 词条表的完整性（docs/08 §6.15 / §7.6）。
 *
 * 这张表是 G1 的唯一真源：漏一条键，英文模式下就会露出中文；
 * 漏一个枚举取值，切换语言时那一格会变成 `undefined`。
 */
const KEYS = Object.keys(TEXT) as TextKey[];

/** 已知允许中文为空的词条（本身就是「英文模式才显示」的说明行）。 */
const ZH_MAY_BE_EMPTY: readonly TextKey[] = ["note.zhOnly", "zhOnly.section"];

describe("中英词条表（§6.15）", () => {
  it("每条词条两种语言都有内容（除个别英文专用说明行）", () => {
    for (const k of KEYS) {
      const e = TEXT[k];
      expect(e.en.trim().length, `${k} 缺英文`).toBeGreaterThan(0);
      if (!ZH_MAY_BE_EMPTY.includes(k)) {
        expect(e.zh.trim().length, `${k} 缺中文`).toBeGreaterThan(0);
      }
    }
  });

  it("第 1–15 节的标题一条不缺（§6.19：不重排、不删节）", () => {
    for (let n = 1; n <= 15; n++) {
      const key = `sec.${n}` as TextKey;
      expect(KEYS, `缺 sec.${n}`).toContain(key);
      expect(TEXT[key].zh.length).toBeGreaterThan(0);
    }
  });

  it("23 个表格列名一条不缺", () => {
    for (const key of [
      "col.rank", "col.school", "col.city", "col.qs", "col.acc", "col.er", "col.rr", "col.tr",
      "col.apps", "col.intl", "col.idef", "col.mf", "col.gpa", "col.lang", "col.sat", "col.test",
      "col.ivw", "col.rounds", "col.ddl", "col.tuition", "col.tags", "col.note",
    ] as TextKey[]) {
      expect(KEYS, `缺 ${key}`).toContain(key);
    }
    expect(KEYS).toContain("tbl.detail");
  });

  it("数据里出现过的枚举取值都有对应词条（漏一个就会显示 undefined）", () => {
    const tests = new Set(COLLEGES.map((c) => c.test));
    for (const v of tests) expect(KEYS, `缺 data.test.${v}`).toContain(`data.test.${v}` as TextKey);

    const ivws = new Set(COLLEGES.map((c) => c.ivw_c ?? "unv"));
    for (const v of ivws) expect(KEYS, `缺 data.ivw.${v}`).toContain(`data.ivw.${v}` as TextKey);

    const idefs = new Set(COLLEGES.map((c) => c.idef_c ?? "id"));
    for (const v of idefs) expect(KEYS, `缺 data.idef.${v}`).toContain(`data.idef.${v}` as TextKey);
  });

  it("五档档位都有词条", () => {
    for (const b of ["r", "rm", "m", "s", "h"]) {
      expect(KEYS, `缺 band.${b}`).toContain(`band.${b}` as TextKey);
    }
  });

  it("占位符替换：同名占位多次出现全部替换，未提供的占位保持原样", () => {
    expect(t("zh", "page.count", { n: 113 })).toBe("共 113 所院校");
    expect(t("en", "page.count", { n: 113 })).toBe("113 schools");
    expect(t("zh", "ctx.fromChild", { direction: "艺术" })).toBe("来自成长画像 · 艺术方向");
    expect(t("en", "page.count")).toContain("{n}");
  });

  it("整页文案里没有第三方导流话术（评审 M2 / 7.6 第 7 条）", () => {
    const banned = ["小助手", "顾问", "私信", "定位报告", "CMC", "会员"];
    for (const k of KEYS) {
      for (const lang of ["zh", "en"] as const) {
        const s = TEXT[k][lang];
        for (const b of banned) {
          expect(s.includes(b), `${k}(${lang}) 里出现了「${b}」：${s}`).toBe(false);
        }
      }
    }
  });
});
