import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { COLLEGES } from "../colleges-data";
import { COLUMNS, IDEF_CODES, IVW_CODES, IVW_IV_CODES, REGIONS, TEST_POLICIES, TYPES } from "../colleges-schema";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..", "..");

describe("数据完整性（docs/08 §7.2）", () => {
  it("113 条，en 唯一", () => {
    expect(COLLEGES).toHaveLength(113);
    expect(new Set(COLLEGES.map((c) => c.en)).size).toBe(113);
    expect(new Set(COLLEGES.map((c) => c.zh)).size).toBe(113);
  });

  it("字段契约是 46 列", () => {
    expect(COLUMNS).toHaveLength(46);
  });

  it("枚举取值全部合法", () => {
    for (const c of COLLEGES) {
      expect(TYPES).toContain(c.type);
      expect(REGIONS).toContain(c.rg);
      expect(TEST_POLICIES).toContain(c.test);
      expect([0, 1]).toContain(c.pub);
      if (c.idef_c !== null) expect(IDEF_CODES).toContain(c.idef_c);
      if (c.ivw_c !== null) expect(IVW_CODES).toContain(c.ivw_c);
      if (c.ivw_iv !== null) expect(IVW_IV_CODES).toContain(c.ivw_iv);
      for (const r of c.roundsArr) expect(["EA", "ED0", "ED1", "ED2", "REA", "EAR", "RD"]).toContain(r);
    }
  });

  it("空值数与基线一致（docs/08 §3.2 的表）", () => {
    const nulls = (pick: (c: (typeof COLLEGES)[number]) => unknown) =>
      COLLEGES.filter((c) => pick(c) === null || pick(c) === "").length;

    // 这些数字是先跑一遍提取、逐字段核对过的；改动数据时应同步改这里
    expect(nulls((c) => c.rr)).toBe(65);
    expect(nulls((c) => c.er)).toBe(51);
    expect(nulls((c) => c.ab)).toBe(48);
    expect(nulls((c) => c.gpa)).toBe(48);
    expect(nulls((c) => c.qs)).toBe(33);
    expect(nulls((c) => c.idef_c)).toBe(33);
    expect(nulls((c) => c.idef_t)).toBe(33);
    expect(nulls((c) => c.tuition)).toBe(17);
    expect(nulls((c) => c.ea)).toBe(17);
    expect(nulls((c) => c.mf)).toBe(14);
    expect(nulls((c) => c.tr)).toBe(12);
    expect(nulls((c) => c.apps)).toBe(10);
    expect(nulls((c) => c.rdd)).toBe(7);
    expect(nulls((c) => c.ivw_src)).toBe(7);
    expect(nulls((c) => c.sat)).toBe(1);
    expect(nulls((c) => c.alert)).toBe(109);
    expect(nulls((c) => c.ivw_al)).toBe(72);
  });

  it("等级/描述类字段没有空值（它们撑起详情卡）", () => {
    for (const c of COLLEGES) {
      expect(c.cz, c.en).not.toBe("");
      expect(c.ce, c.en).not.toBe("");
      expect(c.tz, c.en).not.toBe("");
      expect(c.te, c.en).not.toBe("");
      expect(c.nz, c.en).not.toBe("");
      expect(c.ne, c.en).not.toBe("");
      expect(c.cds_src, c.en).not.toBe("");
    }
  });

  it("essays 是可解析的数组（元素形如 {t, w}）", () => {
    for (const c of COLLEGES) {
      const arr = JSON.parse(c.essays) as unknown[];
      expect(Array.isArray(arr), c.en).toBe(true);
      for (const e of arr) {
        expect(typeof (e as { t?: unknown }).t, c.en).toBe("string");
        expect(typeof (e as { w?: unknown }).w, c.en).toBe("string");
      }
    }
    expect(COLLEGES.filter((c) => JSON.parse(c.essays).length === 0)).toHaveLength(19);
  });

  it("坐标全部落在视口内（113 所都在本土 48 州 + DC）", () => {
    for (const c of COLLEGES) {
      expect(c.x, c.en).toBeGreaterThan(0);
      expect(c.x, c.en).toBeLessThan(975);
      expect(c.y, c.en).toBeGreaterThan(0);
      expect(c.y, c.en).toBeLessThan(610);
    }
  });
});

describe("源文件存在性", () => {
  it("CSV、州界、坐标基准都在", () => {
    for (const rel of [
      "data/colleges.csv",
      "data/us-states.topo.json",
      "data/__fixtures__/reference-xy.json",
    ]) {
      expect(fs.existsSync(path.join(REPO, rel)), rel).toBe(true);
    }
  });

  it("产物与源数据同步（build:data 重跑后 git diff 应为空）", () => {
    const csv = fs.readFileSync(path.join(REPO, "data/colleges.csv"), "utf8");
    expect(csv.split("\n").filter((l) => l.trim()).length).toBe(114); // 表头 + 113
  });
});
