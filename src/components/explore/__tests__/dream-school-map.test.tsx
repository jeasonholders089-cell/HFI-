// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DreamSchoolMap, bubbleRadius } from "../dream-school-map";
import { NEIGHBOR_LAND, US_INSETS } from "@/lib/us-map-paths";

const hit = (name: string, count: number, lat: number, lng: number) => ({
  name,
  count,
  matched: true,
  st: "CA",
  lat,
  lng,
});

const miss = (name: string, count: number) => ({
  name,
  count,
  matched: false,
  st: null,
  lat: null,
  lng: null,
});

describe("DreamSchoolMap", () => {
  it("底图三层照常画：海洋矩形 + 邻国陆地 + 美国（49 州 + 2 插图）", () => {
    const { container } = render(<DreamSchoolMap schools={[]} />);
    expect(container.querySelector("rect")?.getAttribute("fill")).toBe("var(--map-ocean)");
    const neighbors = [...container.querySelectorAll("path")].filter(
      (p) => p.getAttribute("fill") === "var(--map-neighbor)",
    );
    expect(neighbors).toHaveLength(NEIGHBOR_LAND.length);
    const usGroup = container.querySelector("g.land-shadow");
    expect(usGroup?.querySelectorAll("path").length).toBe(49 + US_INSETS.length);
  });

  it("只给命中坐标的学校画气泡，气泡里带「校名 · N 人」的悬停提示", () => {
    const { container } = render(
      <DreamSchoolMap
        schools={[hit("斯坦福大学", 3, 37.4275, -122.1697), hit("罗德岛设计学院", 1, 41.82711, -71.40931), miss("霍格沃茨", 2)]}
      />,
    );
    const dots = [...container.querySelectorAll("circle")];
    expect(dots).toHaveLength(2);
    const titles = dots.map((d) => d.querySelector("title")?.textContent);
    expect(titles).toContain("斯坦福大学 · 3 人");
    expect(titles).toContain("罗德岛设计学院 · 1 人");
    // 未命中的不进地图（它在名单与「未收录坐标」计数里）
    expect(titles.some((t) => t?.includes("霍格沃茨"))).toBe(false);
  });

  it("人次决定气泡半径，且封顶 15", () => {
    expect(bubbleRadius(1)).toBeCloseTo(7.7, 1);
    expect(bubbleRadius(4)).toBeCloseTo(10.9, 1);
    expect(bubbleRadius(9)).toBeCloseTo(14.1, 1);
    expect(bubbleRadius(400)).toBe(15);
  });

  it("标签最多 8 个，且带人次", () => {
    const many = Array.from({ length: 20 }, (_, i) => hit(`学校${i}`, 20 - i, 30 + i, -100 + i));
    const { container } = render(<DreamSchoolMap schools={many} />);
    const labels = [...container.querySelectorAll("g.dream-labels text")];
    expect(labels.length).toBeLessThanOrEqual(8);
    for (const l of labels) expect(l.textContent).toMatch(/ · \d+$/);
  });

  it("空态：没有数据时画底图并提示", () => {
    const { container } = render(<DreamSchoolMap schools={[]} />);
    expect(screen.getByText("还没有录入孩子的梦想院校")).toBeTruthy();
    expect(container.querySelector("g.land-shadow")).not.toBeNull();
  });

  it("有数据但一所都没命中坐标时，也是空态而不是白屏", () => {
    render(<DreamSchoolMap schools={[miss("霍格沃茨", 2)]} />);
    expect(screen.getByText("已录入的梦想院校都还没有收录坐标")).toBeTruthy();
  });

  it("地图上不出现任何姓名（只有校名与人次）", () => {
    const { container } = render(
      <DreamSchoolMap schools={[hit("斯坦福大学", 2, 37.4275, -122.1697)]} />,
    );
    const text = container.textContent ?? "";
    expect(text).toContain("斯坦福大学 · 2");
    // 组件的入参里根本没有姓名字段，这里再守一道：渲染出的文本里不该出现「人」以外的个体标识
    expect(text).not.toMatch(/英文名|姓名|孩子 [A-Z]/);
  });
});
