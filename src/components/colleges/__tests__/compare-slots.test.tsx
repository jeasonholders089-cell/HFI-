// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CompareSlots } from "../compare-slots";
import { COLLEGES } from "@/lib/colleges-data";

const noop = () => {};

describe("CompareSlots（紧凑槽）", () => {
  it("没有选中时渲染 3 个空槽，且不显示并排对比按钮", () => {
    render(
      <CompareSlots colleges={COLLEGES} slots={[]} canCompare={false} onPick={noop} onRemove={noop} onClear={noop} onCompare={noop} />,
    );
    expect(screen.getAllByText("空")).toHaveLength(3);
    expect(screen.queryByText(/并排对比/)).toBeNull();
    expect(screen.getByText("对比位（0/3）")).toBeTruthy();
  });

  it("加入两所后显示校名、剩余 1 个空槽，并出现并排对比按钮", () => {
    const [a, b] = COLLEGES;
    render(
      <CompareSlots
        colleges={COLLEGES}
        slots={[a.en, b.en]}
        canCompare
        onPick={noop}
        onRemove={noop}
        onClear={noop}
        onCompare={noop}
      />,
    );
    expect(screen.getByText(a.zh)).toBeTruthy();
    expect(screen.getByText(b.zh)).toBeTruthy();
    expect(screen.getAllByText("空")).toHaveLength(1);
    expect(screen.getByText("并排对比（2）")).toBeTruthy();
  });

  it("点槽位触发 onPick（切回浏览位），点 ✕ 触发 onRemove", async () => {
    const [a] = COLLEGES;
    const onPick = vi.fn();
    const onRemove = vi.fn();
    render(
      <CompareSlots
        colleges={COLLEGES}
        slots={[a.en]}
        canCompare={false}
        onPick={onPick}
        onRemove={onRemove}
        onClear={noop}
        onCompare={noop}
      />,
    );
    screen.getByText(a.zh).click();
    expect(onPick).toHaveBeenCalledWith(a.en);
    screen.getByLabelText(`从对比位移除 ${a.zh}`).click();
    expect(onRemove).toHaveBeenCalledWith(a.en);
  });

  it("满 3 所时不显示空槽", () => {
    const slots = COLLEGES.slice(0, 3).map((c) => c.en);
    render(
      <CompareSlots colleges={COLLEGES} slots={slots} canCompare onPick={noop} onRemove={noop} onClear={noop} onCompare={noop} />,
    );
    expect(screen.queryByText("空")).toBeNull();
    expect(screen.getByText("对比位（3/3）")).toBeTruthy();
  });
});
