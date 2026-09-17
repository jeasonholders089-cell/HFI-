// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Explore, { CLOUD_FONT_MAX, CLOUD_FONT_MIN, wordFontSize } from "../page";

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
  // 场次（docs/10 §3.7）：一天一场，按北京时间算日界
  session: {
    date: "2026-09-18",
    isToday: true,
    all: false,
    availableDates: ["2026-09-18", "2026-09-10"],
  },
  dreamSchools: [
    { name: "斯坦福大学", count: 2, matched: true, st: "CA", lat: 37.4275, lng: -122.1697 },
    { name: "罗德岛设计学院", count: 1, matched: true, st: "RI", lat: 41.82711, lng: -71.40931 },
    { name: "霍格沃茨", count: 1, matched: false, st: null, lat: null, lng: null },
  ],
};

/**
 * `cloud` 用来模拟词云缓存接口（`GET /api/children/wordcloud`）的返回 —— 按 URL 分流，
 * 因为页面会同时打 summary 与 wordcloud 两个接口。
 */
function mockFetch(body: unknown = SUMMARY, cloud: unknown = { cloud: null, sessionId: null }) {
  const fn = vi.fn(async (...args: [string, RequestInit?]) => {
    const url = String(args[0]);
    const payload = url.includes("/wordcloud") ? cloud : body;
    return { ok: true, status: 200, json: async () => payload } as unknown as Response;
  });
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
    // h1 现在包了一层（里面还有场次标签），所以往上一级找标题行容器
    const row = h1?.closest("div.mt-4");
    expect(row?.textContent).toContain("已录入孩子");
    expect(row?.textContent).toContain("已生成画像");
    expect(row?.textContent).toContain("待分析");
  });

  /**
   * 场次（docs/10 §3.7，一天一场）。
   *
   * 这是这次改动最容易做错的地方：默认**必须**不带 `date` 参数（由服务端按北京时间定"今天"），
   * 而不是由浏览器算日期——浏览器时区、机器时间都可能不对，把"今天"交给服务端才算得准。
   */
  describe("场次", () => {
    it("默认不带 date 参数（今天的场次由服务端按北京时间定）", async () => {
      const fn = mockFetch();
      render(<Explore />);
      await screen.findByText("梦想院校地图");
      expect(String(fn.mock.calls[0][0])).toBe("/api/children/summary");
      // 场次标签要出现在标题行，家长看"今天这一场"
      expect(screen.getByText(/今天的场次 · 2026-09-18/)).toBeTruthy();
    });

    it("切到某个历史场次 → 带 ?date= 重拉，标签跟着变", async () => {
      const fn = mockFetch();
      render(<Explore />);
      await screen.findByText("梦想院校地图");

      fireEvent.change(screen.getByRole("combobox"), { target: { value: "2026-09-10" } });

      await waitFor(() =>
        expect(fn.mock.calls.some((c) => String(c[0]).includes("date=2026-09-10"))).toBe(true),
      );
    });

  it("切到「全部场次」→ 带 date=all（复盘口径，等于改版前）", async () => {
      const fn = mockFetch();
      render(<Explore />);
      await screen.findByText("梦想院校地图");

      fireEvent.change(screen.getByRole("combobox"), { target: { value: "all" } });

      await waitFor(() => expect(fn.mock.calls.some((c) => String(c[0]).includes("date=all"))).toBe(true));
    });
  });

  /**
   * 词云缓存（docs/10 §3.8）。
   *
   * 为什么值得单独测：词云是现调 AI 算的、且**模型每次给的词都不一样**。
   * 不缓存的话，大屏一刷新那块就变成"尚未生成"，或者点两次整屏的词全变。
   * 所以"有缓存就直接显示"和"缓存不属于这一场就不显示"这两条必须钉住。
   */
  describe("词云缓存", () => {
    const CACHED = {
      cloud: {
        groups: [
          { word: "专注投入", count: 11 },
          { word: "观察敏锐", count: 9 },
        ],
        total: 48,
        generatedAt: "2026-09-18T02:00:00.000Z",
      },
      sessionId: "2026-09-18",
    };

    it("有缓存就直接显示，不用点「生成」", async () => {
      mockFetch(SUMMARY, CACHED);
      render(<Explore />);
      await screen.findByText("梦想院校地图");

      expect(await screen.findByText("专注投入")).toBeTruthy();
      expect(screen.getByText("观察敏锐")).toBeTruthy();
      expect(screen.getByText(/基于生成时的 48 位孩子/)).toBeTruthy();
      // 有词云时按钮是"重新生成"
      expect(screen.getByRole("button", { name: "重新生成" })).toBeTruthy();
    });

    it("缓存属于别的场次 → 不显示（否则家长看到的是别的场次的孩子）", async () => {
      mockFetch(SUMMARY, { ...CACHED, sessionId: "2026-09-10" });
      render(<Explore />);
      await screen.findByText("梦想院校地图");

      await waitFor(() => expect(screen.queryByText("专注投入")).toBeNull());
      expect(screen.getByRole("button", { name: "生成" })).toBeTruthy();
    });
  });

  /**
   * 词云的字号映射（docs/10 §3.9）。
   *
   * 为什么要测：字号是"现场一眼看上去对不对"的关键，而且**试过一版 30–104 被现场否掉**
   * （"不需要太大，正常就行"）。所以把"正常"这个区间钉住：别悄悄放大、也别缩到看不见。
   * 另外"所有人次相同"时不能假装有高低差——人数真的相同就该一样大。
   */
  describe("词云字号", () => {
    it("人次最低/最高分别对应字号下限/上限", () => {
      expect(wordFontSize(3, 3, 12)).toBe(CLOUD_FONT_MIN);
      expect(wordFontSize(12, 3, 12)).toBe(CLOUD_FONT_MAX);
    });

    it("人次多的字号更大（单调）", () => {
      const sizes = [3, 5, 7, 9, 11, 12].map((n) => wordFontSize(n, 3, 12));
      for (let i = 1; i < sizes.length; i++) expect(sizes[i]).toBeGreaterThan(sizes[i - 1]);
    });

    it("所有人次相同 → 统一字号，不假装有高低差", () => {
      expect(wordFontSize(9, 9, 9)).toBe(wordFontSize(9, 9, 9));
      expect(wordFontSize(9, 9, 9)).toBeGreaterThan(CLOUD_FONT_MIN);
      expect(wordFontSize(9, 9, 9)).toBeLessThan(CLOUD_FONT_MAX);
    });

    it("字号保持在「正常」区间：下限别缩到看不见，上限别放到喧宾夺主", () => {
      // 曾经试过 30–104，现场反馈"不需要太大"；18/64 是那个"正常"的档
      expect(CLOUD_FONT_MIN).toBeGreaterThanOrEqual(16);
      expect(CLOUD_FONT_MAX).toBeLessThanOrEqual(72);
      expect(CLOUD_FONT_MAX / CLOUD_FONT_MIN).toBeGreaterThan(2); // 还要看得出高低差
    });
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
    // 骨架说明（docs/10 §3.6 v1.3）：必须与屏幕上的八类一一对应 ——
    // 出现「职业」「跨学科」就说明有人照抄了最初那句，会与屏幕对不上
    expect(section.textContent).toContain("文理核心");
    expect(section.textContent).toContain("商科与管理");
    expect(section.textContent).not.toContain("跨学科");

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
