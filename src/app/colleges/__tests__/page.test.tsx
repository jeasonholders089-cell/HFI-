// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { COLLEGES } from "@/lib/colleges-data";
import { MAP_H, MAP_W } from "@/lib/colleges-project";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/colleges",
}));

import CollegesPage from "../page";

/**
 * 详情栏的显隐规则（2026-09-17 产品调整）。
 *
 * 这一组守的是版面规则，不是"好看不好看"：
 *   - 地图视图默认**铺满整行**，只有点了圆点才出现右侧详情栏；
 *   - 表格视图**不出**详情栏。
 *
 * 为什么值得写测试：这两条很容易在改布局时被无意改回去，而且回归时肉眼不一定看得出来
 * （地图窄 38% 也能用，只是不再"全屏"）。
 */
const W = 1200;
const H = 500;
const SCALE = Math.min(W / MAP_W, H / MAP_H);

function toScreen(x: number, y: number) {
  return {
    clientX: x * SCALE + (W - MAP_W * SCALE) / 2,
    clientY: y * SCALE + (H - MAP_H * SCALE) / 2,
  };
}

function renderPage() {
  const proto = SVGElement.prototype as unknown as { getBoundingClientRect: () => DOMRect };
  const original = proto.getBoundingClientRect;
  proto.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: W, height: H, right: W, bottom: H, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;

  const view = render(<CollegesPage />);
  return { ...view, restore: () => void (proto.getBoundingClientRect = original) };
}

describe("/colleges 的详情栏显隐", () => {
  it("地图视图默认全屏：没有详情栏、没有对比托盘、没有两栏 grid", () => {
    const { container, restore } = renderPage();

    expect(screen.getByRole("img", { name: "美国院校分布地图" })).toBeTruthy();
    expect(container.querySelector(".colleges-split")).toBeNull();
    expect(screen.queryByText(/对比位（/)).toBeNull();
    // 详情栏都没了，当然也没有"点击圆点查看详情"的空态提示
    expect(screen.queryByText("查看院校详情")).toBeNull();
    restore();
  });

  it("点地图圆点 → 出现右侧详情栏，版面切成左地图 / 右详情", () => {
    const { container, restore } = renderPage();
    const west = [...COLLEGES].sort((a, b) => a.x - b.x)[0];
    const { clientX, clientY } = toScreen(west.x, west.y);

    const svg = screen.getByRole("img", { name: "美国院校分布地图" });
    fireEvent.pointerDown(svg, { pointerId: 1, clientX, clientY });
    fireEvent.pointerUp(svg, { pointerId: 1, clientX, clientY });

    expect(container.querySelector(".colleges-split")).not.toBeNull();
    expect(screen.getByText(/对比位（0\/3）/)).toBeTruthy();
    // 详情栏里出现了这一所的档案（第 1 节「排名」）
    expect(screen.getByText("排名")).toBeTruthy();
    restore();
  });

  it("切到表格视图 → 详情栏消失，表格铺满整行", () => {
    const { container, restore } = renderPage();

    fireEvent.click(screen.getByRole("button", { name: /表格视图/ }));
    expect(container.querySelector(".colleges-split")).toBeNull();
    expect(screen.queryByText(/对比位（/)).toBeNull();
    // 表格本体在（"前两列冻结"在提示行和行数行各出现一次）
    expect(screen.getAllByText(/前两列冻结/).length).toBeGreaterThan(0);
    restore();
  });

  it("详情栏收起但对比位里有学校时，托盘挪到内容上方继续可见", () => {
    const { container, restore } = renderPage();
    const west = [...COLLEGES].sort((a, b) => a.x - b.x)[0];
    const { clientX, clientY } = toScreen(west.x, west.y);

    const svg = screen.getByRole("img", { name: "美国院校分布地图" });
    fireEvent.pointerDown(svg, { pointerId: 2, clientX, clientY });
    fireEvent.pointerUp(svg, { pointerId: 2, clientX, clientY });

    // 加入对比位
    fireEvent.click(screen.getByRole("button", { name: /^加入对比$/ }));
    expect(screen.getAllByText(/对比位（1\/3）/).length).toBeGreaterThan(0);

    // 收起详情栏 → 详情栏没了，但托盘还在（挪到内容区上方）
    fireEvent.click(screen.getByRole("button", { name: "关闭" }));
    expect(container.querySelector(".colleges-split")).toBeNull();
    expect(container.querySelector("aside")).toBeNull();
    expect(screen.getAllByText(/对比位（1\/3）/).length).toBeGreaterThan(0);
    restore();
  });
});
