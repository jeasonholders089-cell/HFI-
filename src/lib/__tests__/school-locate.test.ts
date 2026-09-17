/**
 * 院校名 → 坐标匹配的单测（docs/11 §6.2 A 的 12 条）。
 *
 * 这一组里最值钱的是 A-1（别名表 69/69）与 A-6（歧义闸）：
 * 一个证明「孩子常用写法都能落到地图上」，一个证明「拿不准的时候宁可不打点」。
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { MAP_H, MAP_W, project } from "../colleges-project";
import {
  buildCoordIndex,
  buildOverrideMap,
  locateSchool,
  normalizeName,
  type SchoolHit,
} from "../school-locate";
import { COORD_OVERRIDES, COORD_ROWS } from "../university-coords";
import { ALIAS_ENTRIES } from "../university-names";

const index = buildCoordIndex(COORD_ROWS);
const overrides = buildOverrideMap(COORD_OVERRIDES);

const locate = (name: string) => locateSchool(name, index, overrides);
const mustHit = (name: string): SchoolHit => {
  const hit = locate(name);
  if (!hit) throw new Error(`应当命中却未命中：${name}`);
  return hit;
};

/** 一组归一化后同名的机构（>=2 条），这些整组不进索引。 */
function duplicateGroups(): string[][] {
  const groups = new Map<string, string[]>();
  for (const row of COORD_ROWS) {
    const k = normalizeName(row[0]);
    groups.set(k, [...(groups.get(k) ?? []), row[0]]);
  }
  return [...groups.values()].filter((g) => g.length > 1);
}

describe("locateSchool —— 别名表覆盖率（核心验收）", () => {
  it("A-1 别名表每一条规范名都能定位到坐标（69/69）", () => {
    const missed = ALIAS_ENTRIES.map(([canonical]) => canonical).filter((c) => !locate(c));
    expect(missed, `未命中的规范名：${missed.join("、")}`).toEqual([]);
    // 69 条是评审前的规模；2026-09-17 按评审 M6 补了对齐 `data/colleges.csv` 的 57 条，
    // 现在是 126 条（69 + 57）。条数本身不是契约，**全部命中**才是。
    expect(ALIAS_ENTRIES.length).toBe(126);
  });

  it("A-2 10 所艺术 / 音乐院校逐一命中，且标明来源", () => {
    const cases: [string, string, string][] = [
      ["罗德岛设计学院", "Rhode Island School of Design", "alias"],
      ["帕森斯设计学院", "The New School", "override"],
      ["纽约视觉艺术学院", "School of Visual Arts", "alias"],
      ["芝加哥艺术学院", "School of the Art Institute of Chicago", "alias"],
      ["普瑞特艺术学院", "Pratt Institute-Main", "alias"],
      ["加州艺术学院（CalArts）", "California Institute of the Arts", "alias"],
      ["加州艺术学院（CCA）", "California College of the Arts", "alias"],
      ["萨凡纳艺术与设计学院", "Savannah College of Art and Design", "alias"],
      ["伯克利音乐学院", "Berklee College of Music", "alias"],
      ["茱莉亚学院", "The Juilliard School", "alias"],
    ];
    for (const [zh, en, via] of cases) {
      const hit = mustHit(zh);
      expect(hit.nameEn, zh).toBe(en);
      expect(hit.via, zh).toBe(via);
    }
  });

  it("A-3 帕森斯走人工覆盖表（The New School 是它的母体）", () => {
    const hit = mustHit("帕森斯设计学院");
    expect(hit.nameEn).toBe("The New School");
    expect(hit.via).toBe("override");
    expect(hit.st).toBe("NY");
  });

  it("A-4 Pratt Institute 命中主校区（去掉 -Main 后精确唯一）", () => {
    const hit = mustHit("Pratt Institute");
    expect(hit.nameEn).toBe("Pratt Institute-Main");
    expect(hit.st).toBe("NY");
  });

  it("A-5 University of Washington 命中西雅图主校区，不是 Bothell / Tacoma", () => {
    const hit = mustHit("University of Washington");
    expect(hit.nameEn).toBe("University of Washington-Seattle Campus");
    expect(hit.via).toBe("alias");
    expect(mustHit("华盛顿大学").nameEn).toBe(hit.nameEn);
  });

  it("A-6 Lincoln University 未命中（三个州各一所，歧义闸生效）", () => {
    expect(locate("Lincoln University")).toBeNull();
    expect(index.has("lincolnuniversity")).toBe(false);
  });

  it("A-7 全角 / 大小写 / 标点变体命中同一所", () => {
    const forms = ["ＲＩＳＤ", "risd", "Rhode Island School of Design.", "RISD "];
    const names = forms.map((f) => mustHit(f).nameEn);
    expect(new Set(names).size).toBe(1);
    expect(names[0]).toBe("Rhode Island School of Design");
  });

  it("A-8 空串 / 只有空格 / 纯标点返回 null，不抛异常", () => {
    for (const bad of ["", "   ", ".", "、", "·）", "\n"]) {
      expect(() => locate(bad)).not.toThrow();
      expect(locate(bad), JSON.stringify(bad)).toBeNull();
    }
  });

  it("A-9 重名机构整组不进索引", () => {
    const groups = duplicateGroups();
    expect(groups.length).toBe(15);
    for (const group of groups) {
      for (const name of group) expect(index.has(normalizeName(name)), name).toBe(false);
    }
  });

  it("A-10 非主校区不进索引（Pratt Manhattan 已被 MAIN=1 过滤掉）", () => {
    const keys = [...index.keys()];
    expect(keys.some((k) => k.includes("prattmanhattan"))).toBe(false);
    expect(COORD_ROWS.some((r) => r[0].includes("Pratt Manhattan"))).toBe(false);
    // 华盛顿大学只剩西雅图主校区：Bothell / Tacoma 是 MAIN=0，已被提取阶段滤掉
    expect(keys.filter((k) => k.startsWith("universityofwashington"))).toEqual([
      "universityofwashingtonseattlecampus",
    ]);
  });

  it("A-11 别名表定位到的坐标投影后全部落在画布内", () => {
    const outside: string[] = [];
    for (const [canonical] of ALIAS_ENTRIES) {
      const hit = mustHit(canonical);
      const [x, y] = project(hit.lat, hit.lng);
      if (!(x >= 0 && x <= 975 && y >= 0 && y <= 610)) outside.push(`${canonical} → ${x},${y}`);
    }
    expect(outside, `越界的：${outside.join("；")}`).toEqual([]);
  });

  it("A-12 via 的来源标注与命中级一致", () => {
    expect(mustHit("MIT").via).toBe("alias"); // ① 别名表
    expect(mustHit("Hampshire College").via).toBe("exact"); // ② 精确
    expect(mustHit("University of Washington Seattle").via).toBe("contain"); // ③ 唯一包含
    expect(mustHit("帕森斯设计学院").via).toBe("override"); // ④ 人工覆盖
    expect(locate("霍格沃茨")).toBeNull(); // 全不命中
  });
});

describe("normalizeName —— 只做四件事", () => {
  it("NFKC / 小写 / 去标点 / 去结尾的 main campus", () => {
    expect(normalizeName("  Georgia Institute of Technology-Main Campus ")).toBe(
      "georgiainstituteoftechnology",
    );
    expect(normalizeName("Pratt Institute-Main")).toBe("prattinstitute");
    expect(normalizeName("ＲＩＳＤ")).toBe("risd");
    expect(normalizeName("Brown University")).toBe("brownuniversity");
  });

  it("不去 The 前缀、不去 University 后缀（避免误合并）", () => {
    expect(normalizeName("The New School")).toBe("thenewschool");
    expect(normalizeName("Boston University")).not.toBe(normalizeName("Boston College"));
  });
});

describe("buildCoordIndex", () => {
  it("索引里只留唯一的机构，条数少于坐标表行数", () => {
    expect(COORD_ROWS.length).toBe(2468);
    expect(index.size).toBeLessThan(COORD_ROWS.length);
    expect(index.size).toBeGreaterThan(2400);
  });

  it("人工覆盖表的键归一化后可查到", () => {
    expect(overrides.get(normalizeName("帕森斯设计学院"))).toBeDefined();
  });
});

/**
 * A-13（v1.1 评审 M6 / docs/11 §0 更正 14）：**我们自己展示的中文校名必须都能定位**。
 *
 * 为什么单列一组：家长会从 `/colleges`（全站唯一展示院校中文名的页面）抄中文名填问卷。
 * 实测修之前只有 56/113 命中——雪城、杜兰、凯斯西储、威廉玛丽、布林茅尔这些
 * 都会在大屏地图上**凭空消失**，而页面上看不出任何异常。
 *
 * 这条守住的是"我们展示过的名字，一定定位得到"这个承诺，不是"别名表有多少条"。
 */
describe("A-13 · data/colleges.csv 的 113 个中文校名（评审 M6）", () => {
  /** 只切前两列，正确处理带引号的字段（英文校名里有逗号）。 */
  function firstTwo(line: string): [string, string] {
    const out: string[] = [];
    let cur = "";
    let quoted = false;
    for (let i = 0; i < line.length && out.length < 2; i++) {
      const ch = line[i];
      if (quoted) {
        if (ch === '"') {
          if (line[i + 1] === '"') {
            cur += '"';
            i++;
          } else quoted = false;
        } else cur += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ",") {
        out.push(cur);
        cur = "";
      } else cur += ch;
    }
    out.push(cur);
    return [out[0] ?? "", out[1] ?? ""];
  }

  const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
  const csv = readFileSync(path.join(REPO, "data", "colleges.csv"), "utf8");
  const zhNames = csv
    .split(/\r?\n/)
    .slice(1)
    .filter((l) => l.trim())
    .map((l) => firstTwo(l)[1])
    .filter(Boolean);

  it("113 个中文名逐条都能定位到坐标", () => {
    expect(zhNames).toHaveLength(113);
    const missed = zhNames.filter((zh) => !locate(zh));
    expect(missed, `未命中的中文校名：${missed.join("、")}`).toEqual([]);
  });

  it("定位到的坐标都能投影进画布（否则等于没定位）", () => {
    for (const zh of zhNames) {
      const hit = locate(zh);
      expect(hit, `${zh} 未命中`).not.toBeNull();
      const [x, y] = project(hit!.lat, hit!.lng);
      expect(x, `${zh} 的 x 越界`).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(MAP_W);
      expect(y, `${zh} 的 y 越界`).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(MAP_H);
    }
  });

  it("同一所学校的不同中文写法归到同一个规范名（不产生两个展示名）", () => {
    // 卡耐基梅隆 / 卡内基梅隆、厄本那 / 厄巴纳 这类一字之差的译名
    expect(locate("卡耐基梅隆大学")?.name).toBe(locate("卡内基梅隆大学")?.name);
    expect(locate("伊利诺伊大学厄本那-香槟分校")?.name).toBe(
      locate("伊利诺伊大学厄巴纳-香槟分校")?.name,
    );
    expect(locate("华盛顿大学(西雅图)")?.name).toBe(locate("华盛顿大学")?.name);
  });
});
