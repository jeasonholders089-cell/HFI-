// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Explore from "../page";

// 现场全景的版面契约（docs/10 §3.1 / docs/11 §4.2、§4.3）。
//
// 这一页改动的核心不是「多了什么」，而是顺序：大屏头三秒的注意力顺序必须是
// 地图 → 方向统计 → 名单。顺序被打乱的话验收就不通过，所以钉在这里。
vi.mock("next/navigation", () => ({ usePathname: () => "/explore" }));

const SUMMARY = {
  total: 3,
  classified: 2,
  directions: {
    人文科学: 1,
    社会科学: 0, // 0 人的不渲染
    商科与管理: 2,
    自然科学: 0,
    数学与计算: 1,
    工程与应用: 0,
    艺术与设计: 0,
    健康与公共服务: 0,
  },
  children: [],
  dreamSchools: [
    { name: "斯坦福大学", count: 2, matched: true, st: "CA", lat: 37.4275, lng: -122.1697 },
    { name: "罗德岛设计学院", count: 1, matched: true, st: "RI", lat: 41.82711, lng: -71.40931 },
    { name: "霍格沃茨", count: 1, matched: false, st: null, lat: null, lng: null },
  ],
};

function mockFetch(body: unknown = SUMMARY) {
  const fn = vi.fn(async () => ({ ok: true, status: 200, json: async () => body }) as unknown as Response);
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("/explore 的版面顺序与口径", () => {
  it("区块顺序是 梦想院校地图 → 发展方向统计 → 完整名单 → 词云 → 已录入的孩子", async () => {
    mockFetch();
    const { container } = render(<Explore />);
    await screen.findByText("梦想院校地图");

    const headings = [...container.querySelectorAll("h2")].map((h) => h.textContent);
    expect(headings).toEqual([
      "梦想院校地图",
      "发展方向统计",
      "梦想院校完整名单",
      "孩子们身上闪闪发光的特质",
      "已录入的孩子",
      "想看看这些方向通向哪些学校？",
    ]);
  });

  it("三个数字搬进标题行（与 h1 同一行容器内）", async () => {
    mockFetch();
    const { container } = render(<Explore />);
    await screen.findByText("梦想院校地图");
    const h1 = container.querySelector("h1");
    const row = h1?.parentElement;
    expect(row?.textContent).toContain("已录入孩子");
    expect(row?.textContent).toContain("已生成画像");
    expect(row?.textContent).toContain("待分析");
  });

  it("方向统计按人数降序，0 人的类别不渲染，也没有「艺术科学」这种特例", async () => {
    mockFetch();
    render(<Explore />);
    const section = (await screen.findByText("发展方向统计")).closest("section") as HTMLElement;

    // v1.1 起类目名后面跟着一行释义（docs/10 §3.6），所以断言改成"以类目名开头"。
    // 选择器必须是**直接子元素**：释义本身也是个 span，用 `span:first-child` 会一起选进来。
    const labels = [...section.querySelectorAll("div.flex.justify-between > span:first-child")].map(
      (s) => s.textContent ?? "",
    );
    const expected = ["商科与管理", "人文科学", "数学与计算"];
    expect(labels.slice(0, 3).map((t) => expected.findIndex((n) => t.startsWith(n)))).toEqual([0, 1, 2]);
    // 每一行都带「例如：…」的释义，且 0 人的类别连释义一起不渲染
    expect(section.textContent).toContain("例如：经济与金融");
    expect(section.textContent).not.toContain("例如：政治");
    expect(section.textContent).not.toContain("社会科学");
    expect(section.textContent).not.toContain("艺术科学");
    expect(section.textContent).toContain("固定八类");

    // 条形长度分母是已分类人数（2）：2 人 → 100%，1 人 → 50%
    const bars = [...section.querySelectorAll("div.h-1 > div")].map((d) => d.getAttribute("style"));
    expect(bars.some((s) => s?.includes("width: 100%"))).toBe(true);
    expect(bars.some((s) => s?.includes("width: 50%"))).toBe(true);
  });

  it("1 人的类别不会显示成「长度为 0 却有人」（最小宽度 2%）", async () => {
    mockFetch({
      ...SUMMARY,
      classified: 200,
      directions: { ...SUMMARY.directions, 人文科学: 1 },
    });
    render(<Explore />);
    const section = (await screen.findByText("发展方向统计")).closest("section") as HTMLElement;
    const bars = [...section.querySelectorAll("div.h-1 > div")].map((d) => d.getAttribute("style"));
    expect(bars.some((s) => s?.includes("width: 2%"))).toBe(true);
  });

  it("地图数量对不上时，图下写出人话版的「另有 N 人次…暂未收录」（评审 M4 / S4）", async () => {
    mockFetch();
    render(<Explore />);
    await screen.findByText("梦想院校地图");
    expect(screen.getByText(/另有 1 人次填了暂未收录的院校（1 所）/)).toBeTruthy();
    // 量词口径：跨校合计才用人次，并补半句说明
    expect(screen.getByText(/同一孩子的多所院校各计一次/)).toBeTruthy();
  });

  it("完整名单里，未收录的标注出来；已收录的不标注", async () => {
    mockFetch();
    render(<Explore />);
    const section = (await screen.findByText("梦想院校完整名单")).closest("section") as HTMLElement;
    const ghost = within(section).getByText("霍格沃茨").closest("div") as HTMLElement;
    expect(ghost.textContent).toContain("未收录坐标");
    const stanford = within(section).getByText("斯坦福大学").closest("div") as HTMLElement;
    expect(stanford.textContent).not.toContain("未收录坐标");
  });

  it("地图只出现校名与人次，不出现姓名", async () => {
    mockFetch();
    const { container } = render(<Explore />);
    await screen.findByText("梦想院校地图");
    const map = container.querySelector("svg") as SVGElement;
    expect(map.textContent).not.toMatch(/英文名|姓名/);
    expect(map.querySelector("title")?.textContent).toBe("斯坦福大学 · 2 人");
  });

  it("保留指向选校地图的入口（带 from=explore）", async () => {
    mockFetch();
    const { container } = render(<Explore />);
    await screen.findByText("梦想院校地图");
    expect(container.querySelector('a[href="/colleges?from=explore"]')).not.toBeNull();
  });

  it("接口失败时给出可行动的提示，而不是空白页", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 503, json: async () => ({ error: "x" }) }) as unknown as Response),
    );
    render(<Explore />);
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(screen.getByRole("alert").textContent).toContain("刷新数据");
  });
});
