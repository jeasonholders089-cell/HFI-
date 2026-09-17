import { describe, expect, it } from "vitest";

import { COLLEGES } from "../colleges-data";
import {
  SLOT_MAX,
  canCompare,
  checkInvariants,
  initialSlotState,
  slotReducer,
  slotsFull,
  type SlotAction,
  type SlotState,
} from "../colleges-slots";

const KNOWN = new Set(COLLEGES.map((c) => c.en));
const A = COLLEGES[0].en;
const B = COLLEGES[1].en;
const C = COLLEGES[2].en;
const D = COLLEGES[3].en;

const run = (actions: SlotAction[], from: SlotState = initialSlotState()): SlotState =>
  actions.reduce(slotReducer, from);

describe("对比位状态机（docs/08 §5.3）", () => {
  it("加入后追加到末尾，顺序保持", () => {
    const s = run([
      { type: "ADD", en: A },
      { type: "ADD", en: B },
      { type: "ADD", en: C },
    ]);
    expect(s.slots).toEqual([A, B, C]);
  });

  it("重复加入同一所无效", () => {
    const s = run([{ type: "ADD", en: A }, { type: "ADD", en: A }]);
    expect(s.slots).toEqual([A]);
  });

  it("第 4 所被拒绝（上限 3）", () => {
    const s = run([
      { type: "ADD", en: A },
      { type: "ADD", en: B },
      { type: "ADD", en: C },
      { type: "ADD", en: D },
    ]);
    expect(s.slots).toEqual([A, B, C]);
    expect(slotsFull(s)).toBe(true);
  });

  it("移除后剩余项顺序不变", () => {
    const s = run([
      { type: "ADD", en: A },
      { type: "ADD", en: B },
      { type: "ADD", en: C },
      { type: "REMOVE", en: B },
    ]);
    expect(s.slots).toEqual([A, C]);
  });

  it("清空后为空", () => {
    const s = run([
      { type: "ADD", en: A },
      { type: "ADD", en: B },
      { type: "CLEAR" },
    ]);
    expect(s.slots).toEqual([]);
    expect(canCompare(s)).toBe(false);
  });

  it("★ BROWSE 只改浏览位，slots 原样不动（核心不变量）", () => {
    const before = run([{ type: "ADD", en: A }, { type: "ADD", en: B }]);
    const after = run([{ type: "BROWSE", en: C }], before);
    expect(after.browsing).toBe(C);
    expect(after.slots).toEqual([A, B]);
    // 同一引用，说明真的没被重建
    expect(after.slots).toBe(before.slots);
    // 再浏览别的学校，slots 仍然不动
    const after2 = run([{ type: "BROWSE", en: D }], after);
    expect(after2.slots).toEqual([A, B]);
  });

  it("加入对比不影响浏览位", () => {
    const s = run([{ type: "BROWSE", en: A }, { type: "ADD", en: B }]);
    expect(s.browsing).toBe(A);
    expect(s.slots).toEqual([B]);
  });

  it("至少 2 所才能并排对比", () => {
    expect(canCompare(run([{ type: "ADD", en: A }]))).toBe(false);
    expect(canCompare(run([{ type: "ADD", en: A }, { type: "ADD", en: B }]))).toBe(true);
  });

  it("任意操作序列后不变量都成立", () => {
    const seqs: SlotAction[][] = [
      [{ type: "ADD", en: A }, { type: "ADD", en: B }, { type: "ADD", en: C }, { type: "ADD", en: D }],
      [{ type: "BROWSE", en: A }, { type: "ADD", en: A }, { type: "REMOVE", en: A }],
      [{ type: "CLEAR" }, { type: "ADD", en: D }, { type: "BROWSE", en: D }],
    ];
    for (const seq of seqs) {
      expect(checkInvariants(run(seq), KNOWN)).toEqual([]);
    }
  });

  it("上限常量与产品方案一致（3 所）", () => {
    expect(SLOT_MAX).toBe(3);
  });
});
