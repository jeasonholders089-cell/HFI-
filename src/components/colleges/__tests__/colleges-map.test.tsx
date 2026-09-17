// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CollegesProvider } from "../colleges-context";
import { CollegesMap } from "../colleges-map";
import { COLLEGES } from "@/lib/colleges-data";
import { HOME_VIEW, MAP_H, MAP_W } from "@/lib/colleges-project";

/**
 * 地图的点选行为（docs/08 §6.2 / §6.3 / §7.3）。
 *
 * 这一组用例的由来：第一版把"拖拽判定阈值"写成 2px，触控板点一下手抖两三像素就被判成拖拽，
 * `pointerup` 直接 return —— **点圆点完全没反应**。所以这里把"点"和"拖"分成两条钉死。
 */
const W = 800;
const H = 500;

/** 视口坐标 → 屏幕坐标（用默认视口 0 0 975 610 反算）。 */
function toScreen(x: number, y: number) {
  return { clientX: (x / MAP_W) * W, clientY: (y / MAP_H) * H };
}

function renderMap(onSelect = vi.fn()) {
  const svgProto = SVGElement.prototype as unknown as {
    getBoundingClientRect: () => DOMRect;
  };
  const original = svgProto.getBoundingClientRect;
  svgProto.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: W, height: H, right: W, bottom: H, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;

  render(
    <CollegesProvider lang="zh" font={0}>
      <CollegesMap colleges={COLLEGES} selected={null} slots={[]} onSelect={onSelect} />
    </CollegesProvider>,
  );

  const svg = screen.getByRole("img", { name: "美国院校分布地图" });
  return { svg, onSelect, restore: () => void (svgProto.getBoundingClientRect = original) };
}

describe("CollegesMap 的点选（§6.2）", () => {
  it("原地按下再抬起 → 选中该院校", () => {
    const { svg, onSelect, restore } = renderMap();
    const p = COLLEGES[0];
    const { clientX, clientY } = toScreen(p.x, p.y);

    fireEvent.pointerDown(svg, { pointerId: 1, clientX, clientY });
    fireEvent.pointerUp(svg, { pointerId: 1, clientX, clientY });

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(p.en);
    restore();
  });

  it("手指/光标抬起时抖了 3px，仍然算点击（原 2px 阈值就是在这里失灵的）", () => {
    const { svg, onSelect, restore } = renderMap();
    const p = COLLEGES[0];
    const { clientX, clientY } = toScreen(p.x, p.y);

    fireEvent.pointerDown(svg, { pointerId: 2, clientX, clientY });
    fireEvent.pointerMove(svg, { pointerId: 2, clientX: clientX + 3, clientY: clientY + 1 });
    fireEvent.pointerUp(svg, { pointerId: 2, clientX: clientX + 3, clientY: clientY + 1 });

    expect(onSelect).toHaveBeenCalledTimes(1);
    restore();
  });

  it("真的拖动之后松手压在一个点上 → **不选中**（§6.3 的坑 1）", () => {
    const { svg, onSelect, restore } = renderMap();
    const p = COLLEGES[0];
    const { clientX, clientY } = toScreen(p.x, p.y);

    fireEvent.pointerDown(svg, { pointerId: 3, clientX, clientY });
    fireEvent.pointerMove(svg, { pointerId: 3, clientX: clientX + 40, clientY: clientY + 10 });
    fireEvent.pointerMove(svg, { pointerId: 3, clientX: clientX + 40, clientY: clientY + 10 });
    fireEvent.pointerUp(svg, { pointerId: 3, clientX, clientY });

    expect(onSelect).not.toHaveBeenCalled();
    restore();
  });

  it("点空白处（离所有点都很远）不选中任何院校", () => {
    const { svg, onSelect, restore } = renderMap();
    fireEvent.pointerDown(svg, { pointerId: 4, clientX: 8, clientY: 8 });
    fireEvent.pointerUp(svg, { pointerId: 4, clientX: 8, clientY: 8 });
    expect(onSelect).not.toHaveBeenCalled();
    restore();
  });
});

describe("CollegesMap 的州悬停高亮（§6.4）", () => {
  it("悬停某个州时只改那一条路径的填充，移开就恢复", () => {
    const { svg, restore } = renderMap();
    const svgEl = svg as unknown as SVGSVGElement;
    const paths = svgEl.querySelectorAll("path");
    expect(paths.length).toBeGreaterThan(0);

    const target = paths[0];
    const before = target.getAttribute("fill");
    fireEvent.pointerEnter(target);
    expect(target.getAttribute("fill")).not.toBe(before);
    expect(target.getAttribute("fill")).toContain("map-land-hover");

    fireEvent.pointerLeave(target);
    expect(target.getAttribute("fill")).toBe(before);
    restore();
  });

  it("缩放复位只动视口：复位按钮存在且可用，不改浏览位（A4）", () => {
    const { svg, restore } = renderMap();
    const zoomOut = screen.getByRole("button", { name: "缩小" });
    const reset = screen.getByRole("button", { name: "复位视图" });
    fireEvent.click(zoomOut);
    fireEvent.click(reset);
    // 复位后 viewBox 回到整图
    expect(svg.getAttribute("viewBox")).toBe(`${HOME_VIEW.x} ${HOME_VIEW.y} ${HOME_VIEW.w} ${HOME_VIEW.h}`);
    restore();
  });
});
