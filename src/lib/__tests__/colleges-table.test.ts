import { describe, expect, it } from "vitest";

import { COLLEGES } from "../colleges-data";
import { COLUMNS, defaultDirection, nextSort, sortColleges } from "../colleges-table";

describe("表格列契约（docs/08 §6.8）", () => {
  it("23 列", () => {
    expect(COLUMNS).toHaveLength(23);
  });

  it("前两列冻结，其余不冻结", () => {
    expect(COLUMNS[0].frozen).toBe(true);
    expect(COLUMNS[1].frozen).toBe(true);
    expect(COLUMNS.slice(2).every((c) => !c.frozen)).toBe(true);
  });

  it("只有「院校气质 / 一句话点评 / 详情」三列不可排序", () => {
    const notSortable = COLUMNS.filter((c) => !c.sortable).map((c) => c.key);
    expect(notSortable).toEqual(["tags", "note", "detail"]);
  });

  it("每列都对 113 所能渲染出字符串", () => {
    for (const col of COLUMNS) {
      for (const c of COLLEGES) {
        expect(typeof col.text(c), `${col.key} / ${c.zh}`).toBe("string");
      }
    }
  });
});

describe("排序三细节", () => {
  it("表头三态：无 → 默认方向 → 反向 → 无", () => {
    expect(nextSort(null, "rank")).toEqual({ key: "rank", dir: "asc" });
    expect(nextSort({ key: "rank", dir: "asc" }, "rank")).toEqual({ key: "rank", dir: "desc" });
    expect(nextSort({ key: "rank", dir: "desc" }, "rank")).toBeNull();
    // 换一列则重新从该列的默认方向开始
    expect(nextSort({ key: "rank", dir: "desc" }, "acc")).toEqual({ key: "acc", dir: "desc" });
  });

  it("「越大越好」的列首次点击从降序开始", () => {
    for (const k of ["apps", "tuition", "sat", "gpa", "intl", "er", "rr", "tr", "acc"]) {
      expect(defaultDirection(k)).toBe("desc");
    }
    for (const k of ["rank", "school", "city", "qs"]) {
      expect(defaultDirection(k)).toBe("asc");
    }
  });

  it("缺数据的行在两个方向下都排最后", () => {
    for (const dir of ["asc", "desc"] as const) {
      const out = sortColleges(COLLEGES, { key: "tuition", dir });
      const firstNull = out.findIndex((c) => c.tuitionNum == null);
      if (firstNull >= 0) {
        expect(out.slice(firstNull).every((c) => c.tuitionNum == null), `${dir} 方向`).toBe(true);
      }
    }
  });

  it("默认排序：按 rank 升序，同排名按中文名", () => {
    const out = sortColleges(COLLEGES, null);
    expect(out[0].rank).toBe(1);
    for (let i = 1; i < out.length; i++) {
      expect(out[i].rank).toBeGreaterThanOrEqual(out[i - 1].rank);
    }
  });

  it("数值列升序时确实递增", () => {
    const out = sortColleges(COLLEGES, { key: "acc", dir: "asc" });
    const nums = out.map((c) => c.accNum).filter((v): v is number => v != null);
    for (let i = 1; i < nums.length; i++) expect(nums[i]).toBeGreaterThanOrEqual(nums[i - 1]);
  });

  it("批次列按个数排，不是字典序", () => {
    const out = sortColleges(COLLEGES, { key: "rounds", dir: "asc" });
    const lens = out.map((c) => c.roundsArr.length);
    for (let i = 1; i < lens.length; i++) expect(lens[i]).toBeGreaterThanOrEqual(lens[i - 1]);
  });

  it("国际生认定按枚举序 hs(0) → both(1) → id(2)", () => {
    const out = sortColleges(COLLEGES, { key: "idef", dir: "asc" });
    const seq = out.map((c) => c.idef_c).filter((v): v is "hs" | "both" | "id" => v != null);
    const rank: Record<string, number> = { hs: 0, both: 1, id: 2 };
    for (let i = 1; i < seq.length; i++) {
      expect(rank[seq[i]]).toBeGreaterThanOrEqual(rank[seq[i - 1]]);
    }
  });

  it("排序不改变总数，也不丢行", () => {
    for (const key of ["rank", "school", "acc", "tuition", "qs"]) {
      const out = sortColleges(COLLEGES, { key, dir: "desc" });
      expect(out).toHaveLength(113);
      expect(new Set(out.map((c) => c.en)).size).toBe(113);
    }
  });
});
