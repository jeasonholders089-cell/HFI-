"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { SiteNav } from "@/components/site-nav";
import { DreamSchoolMap, type DreamSchoolMapItem } from "@/components/explore/dream-school-map";
import { categorized, CATEGORIES, CATEGORY_NOTES } from "@/lib/growth-categories";

/**
 * 现场全景（docs/10 §3.1 / docs/11 §4.2）。
 *
 * 区块编号与 docs/10 §3.1 一一对应，评审时不会出现两句「第 3 块」指的不是同一个东西：
 *   ① 标题行（左：标题 + 三个数字；右：工作人员按钮，收成浅色小按钮）
 *   ② 梦想院校地图（全行）
 *   ③ 发展方向统计（全行，最多 8 条）
 *   ④ 梦想院校完整名单（含未收录）
 *   ⑤ 特质词云
 *   ⑥ 已录入的孩子
 *
 * 改前是 `md:grid-cols-2` 把 ② ③ 挤在一行，大屏上一半宽度浪费、两边都紧。
 */
type Child = {
  id: number;
  englishName: string;
  age: number;
  dreamSchool: string;
  interests: string;
  aiDirections: string | null;
};

type Summary = {
  total: number;
  classified: number;
  children: Child[];
  directions: Record<string, number>;
  /** 服务端算好的**人数**与坐标（未命中的也返回，matched:false、坐标为 null） */
  dreamSchools: DreamSchoolMapItem[];
  /** 场次（docs/10 §3.7）：一天一场，按北京时间算日界 */
  session: {
    /** 当前场次的日期；「全部场次」时为 null */
    date: string | null;
    isToday: boolean;
    all: boolean;
    /** 有数据的场次（倒序），给切换器用 */
    availableDates: string[];
  };
};

type Cloud = { groups: { word: string; count: number }[]; total: number; generatedAt: string };

function hasProfile(c: Child) {
  try {
    return JSON.parse(c.aiDirections || "[]").length === 3;
  } catch {
    return false;
  }
}

/** 工作人员按钮：淡色小按钮，不占第一屏主体（docs/10 §3.1 的 ①）。 */
const BTN =
  "rounded border border-[#aeb7ad] px-3 py-1.5 text-xs text-[#17382f] hover:border-[#8b6f45] disabled:opacity-40";

/** 后台轮询周期（docs/11 §5.1：30–60 秒，取 45 秒）。 */
const POLL_MS = 45000;
/** 连续失败到这个次数，才在标题行提示"可能已过期"。 */
const STALE_AFTER = 3;

/** HH:MM —— 手写补零，不用 toLocaleTimeString（那依赖运行环境的 ICU）。 */
function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function Explore() {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [showClear, setShowClear] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [clearing, setClearing] = useState(false);
  const [clearError, setClearError] = useState("");
  const [notice, setNotice] = useState("");
  const [running, setRunning] = useState(false);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [progress, setProgress] = useState("");
  const [failures, setFailures] = useState<Record<number, string>>({});
  const [cloud, setCloud] = useState<Cloud | null>(null);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudError, setCloudError] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  /** 「更新于 HH:MM」——现场判断大屏是不是活的的唯一证据（docs/11 §5.1） */
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  /** 后台轮询连续失败次数；≥3 才在标题行提示"可能已过期" */
  const [staleCount, setStaleCount] = useState(0);
  /**
   * 场次选择（docs/10 §3.7）：`""` = 今天（由服务端按北京时间定）、
   * `YYYY-MM-DD` = 指定场次、`all` = 全部场次。
   */
  const [sessionDate, setSessionDate] = useState("");

  /** 场次查询串：不选 = 不带参数（服务端默认"今天"）。 */
  const sessionQuery = () => (sessionDate ? `?date=${encodeURIComponent(sessionDate)}` : "");
  /**
   * 轮询要跳过"正在进行的工作人员动作"。用 ref 而不是 state：
   * 定时器的回调不该因为 busy 变了就重建（那会重置计时）。
   */
  const busyRef = useRef(false);

  async function generateCloud() {
    if (cloudLoading) return;
    setCloudLoading(true);
    setCloudError("");
    try {
      const r = await fetch("/api/children/wordcloud", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // 词云也按场次（docs/10 §3.7）：混进历史就与地图/统计对不上了
        body: JSON.stringify({ date: sessionDate }),
      });
      const result = await r.json();
      if (!r.ok) throw Error(result.error || "词云生成失败");
      setCloud(result);
    } catch (e) {
      setCloudError(e instanceof Error ? e.message : "词云生成失败，请重试");
    } finally {
      setCloudLoading(false);
    }
  }

  async function deleteChild(child: Child) {
    if (running || clearing || deletingId !== null) return;
    if (
      !window.confirm(
        `确定删除记录 #${child.id} 吗？\n这将永久删除该条问卷及 AI 画像，无法撤销。其他孩子不受影响。`,
      )
    )
      return;
    setDeletingId(child.id);
    setError("");
    setNotice("");
    try {
      const r = await fetch(`/api/children/${child.id}`, { method: "DELETE" });
      const result = await r.json();
      if (!r.ok) throw Error(result.error || "删除失败");
      setCloud(null);
      setNotice(`已删除记录 #${child.id}。`);
      setFailures((prev) => {
        const next = { ...prev };
        delete next[child.id];
        return next;
      });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "删除失败，请重试");
    } finally {
      setDeletingId(null);
    }
  }

  async function analyzeChildren(list: Child[]) {
    if (running || clearing || deletingId !== null) return;
    setRunning(true);
    let success = 0;
    let failed = 0;
    try {
      for (let i = 0; i < list.length; i++) {
        const child = list[i];
        setActiveId(child.id);
        setProgress(`正在分析 ${i + 1}/${list.length}（记录 #${child.id}），请保持页面打开。`);
        setFailures((prev) => {
          const next = { ...prev };
          delete next[child.id];
          return next;
        });
        try {
          const response = await fetch("/api/children/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: child.id }),
          });
          const result = await response.json();
          if (!response.ok) throw Error(result.error || "分析失败");
          success++;
          await refresh();
        } catch (e) {
          failed++;
          setFailures((prev) => ({
            ...prev,
            [child.id]: e instanceof Error ? e.message : "连接失败，请重试",
          }));
        }
      }
    } finally {
      setRunning(false);
      setActiveId(null);
      setProgress(`本次完成：成功 ${success} 人，失败 ${failed} 人。失败记录可点击重试。`);
      await refresh();
    }
  }

  async function clearChildren() {
    if (clearing || confirmation !== "清空孩子数据") return;
    setClearing(true);
    setClearError("");
    setNotice("");
    try {
      const r = await fetch("/api/children/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation }),
      });
      const result = await r.json();
      if (!r.ok) throw Error(result.error || "清空失败");
      setShowClear(false);
      setConfirmation("");
      setCloud(null);
      setNotice(`已删除 ${result.deleted} 条孩子记录及对应 AI 画像。`);
      await refresh();
    } catch (e) {
      setClearError(e instanceof Error ? e.message : "清空失败，请重试");
    } finally {
      setClearing(false);
    }
  }

  async function refresh() { 
    setLoading(true);
    setError("");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const r = await fetch(`/api/children/summary${sessionQuery()}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!r.ok) throw Error("暂时无法读取数据库，请点击刷新数据重试");
      setData(await r.json());
      setUpdatedAt(new Date());
      setStaleCount(0);
    } catch (e) {
      setError(
        controller.signal.aborted
          ? "读取超过15秒，可能是预览服务或网络连接延迟。请点击“刷新数据”重试；已有数据不会丢失。"
          : e instanceof Error
            ? e.message
            : "读取失败，请点击刷新数据重试",
      );
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  }

 useEffect(() => {
  void refresh();
  // 切场次要重拉（docs/10 §3.7）
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionDate]);

  /**
   * 现场态：每 45 秒静默拉一次（docs/11 §5.1，评审 M1）。
   *
   * 为什么必须做：原来只在挂载时读一次，家长在 /register 新提交的问卷**不会**出现在大屏上，
   * 要工作人员手动点「刷新数据」。而且它**静默地报旧数字**——比报错更伤信任。
   *
   * 四条纪律（照 §5.1 写死）：
   *   1. 周期 30–60 秒，取 45 秒；
   *   2. 工作人员的动作进行中（AI 分析 / 清空弹窗 / 删除中）**跳过这一轮**；
   *   3. 失败**不清空数据、不写 error、不弹红字**，只累加 staleCount；
   *   4. **不翻转 `loading`** —— 它驱动「刷新数据」的按钮文案与禁用态，
   *      轮询走它会让大屏每 45 秒闪一次、并把工作人员手里的按钮锁住。
   */
  useEffect(() => {
    let cancelled = false;
    const id = setInterval(() => {
      if (busyRef.current) return;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      // 查询串在 effect 内部自己算，避免把每次渲染都新建的函数塞进依赖
      const qs = sessionDate ? `?date=${encodeURIComponent(sessionDate)}` : "";
      fetch(`/api/children/summary${qs}`, { cache: "no-store", signal: controller.signal })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error("bad status"))))
        .then((json) => {
          if (cancelled) return;
          setData(json);
          setUpdatedAt(new Date());
          setStaleCount(0);
        })
        .catch(() => {
          if (!cancelled) setStaleCount((n) => n + 1);
        })
        .finally(() => clearTimeout(timer));
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [sessionDate]);

  const rows = data?.children || [];
  const completed = rows.filter(hasProfile).length;
  const pendingCategories = rows.filter((c) => hasProfile(c) && !categorized(c.aiDirections));

  const words: [string, number][] = (cloud?.groups || []).map((g) => [g.word, g.count]);
  const maxFrequency = Math.max(1, ...words.map((w) => w[1]));
  const minFrequency = Math.min(maxFrequency, ...words.map((w) => w[1]));

  // ③ 方向统计：按人数降序，0 人的不渲染（大屏上一条空杆没有信息量）
  const directionRows = CATEGORIES.map((n) => [n, data?.directions[n] || 0] as const)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);

  const dreamSchools = data?.dreamSchools || [];
  const unmatched = dreamSchools.filter((s) => !s.matched);
  const unmatchedCount = unmatched.reduce((sum, s) => sum + s.count, 0);

  const busy = running || clearing || deletingId !== null;
  busyRef.current = busy;

  /** 场次标签（docs/10 §3.7）：家长看"今天这一场"，工作人员看日期。 */
  const sessionLabel = data?.session
    ? data.session.all
      ? "全部场次"
      : data.session.isToday
        ? `今天的场次 · ${data.session.date}`
        : `历史场次 · ${data.session.date}`
    : "";

  return (
    <main className="min-h-screen bg-[#f4f0e6] text-[#17382f]">
      <header className="mx-auto flex max-w-7xl justify-between px-8 py-7">
        <Link href="/" className="text-xl tracking-[.18em]">
          HFI 家长成长营
        </Link>
        <SiteNav />
      </header>

      <div className="mx-auto max-w-7xl px-4 pb-16 sm:px-8">
        <p className="text-xs tracking-[.3em] text-[#8b6f45]">COLLECTIVE PORTRAIT · 2026</p>

        {/* ① 标题行：左边是标题 + 三个数字，右边是工作人员按钮（浅色小按钮） */}
        <div className="mt-4 flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
          <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
            <div>
              <h1 className="text-4xl font-light">孩子们的成长全景</h1>
              {sessionLabel && <p className="mt-2 text-xs text-[#8b6f45]">{sessionLabel}</p>}
            </div>
            {data && (
              <div className="flex gap-8">
                {(
                  [
                    ["已录入孩子", data.total],
                    ["已生成画像", completed],
                    ["待分析", data.total - completed],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label}>
                    <p className="text-2xl leading-none">{value}</p>
                    <p className="mt-1.5 text-xs text-[#607168]">{label}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          {/*
            「人数最多的 3 个方向」（评审 M5）：1080p 下 8 类条形图整体在折线以下，
            而大屏没人会去滚——所以把"往哪走"的结论放一份到标题行，3 个短标签，不做条形。
          */}
          {data && directionRows.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-[#607168]">人数最多的方向</span>
              {directionRows.slice(0, 3).map(([n, v]) => (
                <span
                  key={n}
                  className="rounded-full border border-[#8b6f45] bg-white px-2.5 py-1 text-xs text-[#8b6f45]"
                >
                  {n} {v} 人
                </span>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {/* 「更新于 HH:MM」——现场判断"大屏是不是活的"的唯一证据（docs/11 §5.1） */}
            {/*
              场次切换（docs/10 §3.7，一天一场）：只有工作人员会用它，
              所以做成浅色小控件放在标题行右侧，不抢第一屏。
            */}
            {data?.session && data.session.availableDates.length > 0 && (
              <label className="flex items-center gap-1.5 text-xs text-[#607168]">
                场次
                <select
                  value={sessionDate || "today"}
                  onChange={(e) => setSessionDate(e.target.value === "today" ? "" : e.target.value)}
                  className="rounded border border-[#aeb7ad] bg-white px-2 py-1.5 text-xs text-[#17382f]"
                >
                  <option value="today">
                    今天{data.session.isToday && data.session.date ? `（${data.session.date}）` : ""}
                  </option>
                  {data.session.availableDates
                    .filter((d) => d !== data.session.date)
                    .map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  <option value="all">全部场次</option>
                </select>
              </label>
            )}
            {updatedAt && (
              <span
                className={`text-xs ${staleCount >= STALE_AFTER ? "text-[#a26047]" : "text-[#607168]"}`}
                title={staleCount >= STALE_AFTER ? "后台自动刷新连续失败，显示的是最后一次成功的数据" : undefined}
              >
                {staleCount >= STALE_AFTER
                  ? `数据可能已过期 · 最后更新 ${hhmm(updatedAt)}`
                  : `更新于 ${hhmm(updatedAt)}`}
              </span>
            )}
            <button
              type="button"
              disabled={busy || loading || rows.length === completed}
              onClick={() => analyzeChildren(rows.filter((c) => !hasProfile(c)))}
              className={BTN}
            >
              {running ? "AI 分析中…" : "分析全部待分析孩子"}
            </button>
            <button type="button" disabled={loading || clearing} onClick={refresh} className={BTN}>
              {loading ? "读取中…" : "刷新数据"}
            </button>
            <button
              type="button"
              disabled={cloudLoading || busy || loading || !data?.total}
              onClick={() => {
                setShowClear(true);
                setConfirmation("");
                setClearError("");
              }}
              className="rounded border border-red-300 px-3 py-1.5 text-xs text-red-800 hover:border-red-800 disabled:opacity-40"
            >
              清空孩子数据
            </button>
          </div>
        </div>

        {progress && (
          <p role="status" className="mt-6 border border-[#aeb7ad] p-4">
            {progress}
          </p>
        )}
        {notice && (
          <p role="status" className="mt-6">
            {notice}
          </p>
        )}
        {error && (
          <p role="alert" className="mt-6 text-red-700">
            {error}
          </p>
        )}

        {showClear && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-5">
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="clear-title"
              className="w-full max-w-lg bg-[#f8f5ed] p-8 shadow-xl"
            >
              <h2 id="clear-title" className="text-2xl">
                确认清空全部孩子数据？
              </h2>
              <p className="my-5 leading-7">
                此操作将永久删除库中所有孩子的问卷及 AI 画像，活动全景统计也将清空。无法撤销，请确认已备份需要的数据。
              </p>
              <label className="block text-sm">
                请输入“清空孩子数据”以确认
                <input
                  value={confirmation}
                  disabled={clearing}
                  onChange={(e) => setConfirmation(e.target.value)}
                  className="my-3 w-full border border-[#aeb7ad] bg-white p-3"
                />
              </label>
              {clearError && (
                <p role="alert" className="my-3 text-red-800">
                  {clearError}
                </p>
              )}
              <div className="mt-4 flex justify-end gap-3">
                <button
                  type="button"
                  disabled={clearing}
                  onClick={() => setShowClear(false)}
                  className="border border-[#aeb7ad] px-5 py-3"
                >
                  取消
                </button>
                <button
                  type="button"
                  disabled={clearing || confirmation !== "清空孩子数据"}
                  onClick={clearChildren}
                  className="bg-red-800 px-5 py-3 text-white disabled:opacity-40"
                >
                  {clearing ? "正在清空…" : "永久删除"}
                </button>
              </div>
            </section>
          </div>
        )}

        {data && (
          <>
            {/* ② 梦想院校地图（全行）——大屏头三秒要回答「今天现场有多少人、往哪走」 */}
            <section className="mt-10 border border-[#d6d2c7] bg-[#f8f5ed] p-5 sm:p-7">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="text-2xl">梦想院校地图</h2>
                <p className="text-xs text-[#607168]">
                  圆点大小按人数分档，悬停看「校名 · N 人」。只显示人数，不显示任何姓名。
                </p>
              </div>
              <div className="mt-5">
                <DreamSchoolMap schools={dreamSchools} />
              </div>
              {unmatchedCount > 0 && (
                <>
                  <p className="mt-3 text-sm text-[#8b6f45]">
                    另有 {unmatchedCount} 人次填了暂未收录的院校（{unmatched.length} 所），见下方名单。
                  </p>
                  <p className="mt-1 text-xs text-[#607168]">同一孩子的多所院校各计一次，所以这里用「人次」。</p>
                </>
              )}
            </section>

            {/* ③ 发展方向统计（全行，最多 8 条） */}
            <section className="mt-6 bg-[#1e4b3b] p-5 text-white sm:p-7">
              <h2 className="text-2xl">发展方向统计</h2>
              {/*
                骨架说明（docs/10 §3.6，v1.3）：屏幕上的八个类别看起来像随手分的，
                家长会犯嘀咕"美本不是分文理吗"。**注意这句必须与屏幕上的八类一一对应** ——
                不要把"职业 / 跨学科"写进来（那两个桶刻意不设，理由见 docs/10 §2.1）。
              */}
              <p className="mt-3 text-xs leading-5 text-[#dce4d9]">
                八类按美本常见的学院骨架划分：文理核心（人文 / 社科 / 自然）+ 数学与计算 +
                工程与应用 + 艺术与设计 + 商科与管理 + 健康与公共服务
              </p>
              <p className="my-4 text-sm">
                固定八类 · 同一个孩子在同一类别只计一次，可计入多个类别，因此人数之和可能超过孩子总数。已分类{" "}
                {data.classified} 人。
              </p>
              {pendingCategories.length > 0 && (
                <div className="mb-5 border border-[#527665] p-4">
                  <p className="mb-3">{pendingCategories.length} 位孩子的已有画像缺少八类标签，暂未计入统计。</p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => analyzeChildren(pendingCategories)}
                    className="border border-white px-4 py-2 disabled:opacity-40"
                  >
                    AI 补全分类
                  </button>
                </div>
              )}
              <div className="grid gap-x-10 gap-y-4 md:grid-cols-2">
                {directionRows.map(([n, v]) => (
                  <div key={n} className="my-1">
                    <div className="flex justify-between">
                      <span>
                        {n}
                        {/* 类目释义（docs/10 §3.6，评审 S1）：静态文案，不是专业推荐 */}
                        <span className="ml-2 text-xs text-[#dce4d9]">{CATEGORY_NOTES[n]}</span>
                      </span>
                      <span className="shrink-0 pl-3">{v} 人</span>
                    </div>
                    <div className="mt-2 h-1 bg-[#527665]">
                      <div
                        className="h-1 bg-[#d2a477]"
                        style={{ width: `${Math.max(2, Math.min(100, (v / Math.max(1, data.classified)) * 100))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              {!data.classified && <p>尚无 AI 分析结果。已导入的问卷保存在下方列表中。</p>}
            </section>

            {/* ④ 梦想院校完整名单（含未收录） */}
            <section className="mt-6 border border-[#d6d2c7] bg-[#f8f5ed] p-5 sm:p-7">
              <h2 className="text-2xl">梦想院校完整名单</h2>
              <p className="my-3 text-sm text-[#607168]">
                已收录的中英文全称与简称统一为中文校名，同一孩子同一院校仅计一次。未收录名称保留原文，避免误合并。
              </p>
              {dreamSchools.length ? (
                <div className="columns-1 gap-x-10 sm:columns-2">
                  {dreamSchools.map((s) => (
                    <div
                      key={s.name}
                      className="flex break-inside-avoid justify-between gap-5 border-b border-[#d6d2c7] py-2.5"
                    >
                      <span>
                        {s.name}
                        {!s.matched && (
                          <span className="ml-2 rounded bg-[#f0e6d8] px-1.5 py-0.5 text-[0.6875rem] text-[#8b6f45]">
                            未收录坐标
                          </span>
                        )}
                      </span>
                      <span className="shrink-0">{s.count} 人</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p>等待问卷录入</p>
              )}
            </section>

            {/* ⑤ 特质词云 */}
            <section className="mt-6 bg-[#e4eadf] p-8">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-2xl">孩子们身上闪闪发光的特质</h2>
                <button
                  type="button"
                  onClick={generateCloud}
                  disabled={cloudLoading || clearing || deletingId !== null || !rows.length}
                  className="bg-[#1e4b3b] px-6 py-3 text-sm text-white disabled:opacity-40"
                >
                  {cloudLoading ? "正在归纳特质…" : cloud ? "重新生成" : "生成"}
                </button>
              </div>
              <p className="mt-4 text-sm text-[#607168]">
                点击生成后，AI 根据这一场孩子的问卷归纳特质、合并近义词，最多显示 9 个词。
                字号按对应孩子人数缩放，同一个孩子在同一特质中只计一次。
              </p>
              {cloudLoading && (
                <p role="status" className="mt-4">
                  正在读取学生信息并合并相似特质，请稍候…
                </p>
              )}
              {cloudError && (
                <p role="alert" className="mt-4 text-red-800">
                  {cloudError}
                </p>
              )}
              {cloud && (
                <p className="mt-3 text-sm text-[#607168]">
                  基于生成时的 {cloud.total} 位孩子 · {new Date(cloud.generatedAt).toLocaleString("zh-CN")} ·
                  数据变化后请重新生成
                </p>
              )}
              <div
                className="mt-8 flex min-h-48 flex-wrap items-center justify-center gap-x-7 gap-y-4 py-6"
                aria-label="儿童特质词频云"
              >
                {words.map(([t, n], i) => (
                  <span
                    key={t}
                    title={`${t}：${n} 位孩子`}
                    aria-label={`${t}，${n} 位孩子`}
                    className="inline-block leading-tight"
                    style={{
                      fontSize:
                        minFrequency === maxFrequency
                          ? 30
                          : 18 + (46 * (n - minFrequency)) / (maxFrequency - minFrequency),
                      fontWeight: n === maxFrequency ? 600 : 400,
                      color: ["#1e4b3b", "#8b6f45", "#507b61", "#a26047"][i % 4],
                    }}
                  >
                    {t}
                  </span>
                ))}
              </div>
              {!cloud && !cloudLoading && (
                <p>{rows.length ? "尚未生成词云，请点击右上方“生成”。" : "请先录入孩子信息，再生成词云。"}</p>
              )}
            </section>

            {/* ⑥ 已录入的孩子 */}
            <section className="mt-6 border border-[#d6d2c7] bg-[#f8f5ed] p-6">
              <h2 className="text-2xl">已录入的孩子</h2>
              <p className="mt-3 text-sm text-[#607168]">
                Excel 与批量文本导入后即可在这里查看。此列表不含姓名、年龄与学校。待分析不代表数据丢失；点击“分析全部待分析孩子”，或使用每行的“开始分析”。任务依次处理，完成后自动保存并更新统计。
              </p>
              {rows.length ? (
                <div className="mt-6 overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead>
                      <tr>
                        {["兴趣", "画像状态 / 操作", "删除"].map((h) => (
                          <th className="border-b border-[#d6d2c7] p-3" key={h}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((c) => (
                        <tr key={c.id}>
                          <td className="p-3">{c.interests}</td>
                          <td className="p-3">
                            {hasProfile(c) ? (
                              <details>
                                <summary className="cursor-pointer">已生成 · 查看画像</summary>
                                {JSON.parse(c.aiDirections || "[]").map(
                                  (d: { name: string; nameEn: string; reason: string }, j: number) => (
                                    <div className="my-4 min-w-64" key={`${c.id}-${j}`}>
                                      <b>
                                        {d.name} · {d.nameEn}
                                      </b>
                                      <p className="mt-2">依据：{d.reason}</p>
                                    </div>
                                  ),
                                )}
                                <p>仅供兴趣探索参考，不是能力定论或录取预测。</p>
                              </details>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => analyzeChildren([c])}
                                  className="border border-[#aeb7ad] px-3 py-2 disabled:opacity-40"
                                >
                                  {activeId === c.id ? "正在分析…" : failures[c.id] ? "重试分析" : "开始分析"}
                                </button>
                                {failures[c.id] && (
                                  <p role="alert" className="mt-2 text-red-800">
                                    {failures[c.id]}
                                  </p>
                                )}
                              </>
                            )}
                          </td>
                          <td className="p-3">
                            <button
                              type="button"
                              aria-label={`删除记录 #${c.id}`}
                              title="删除该记录"
                              disabled={cloudLoading || busy || loading}
                              onClick={() => deleteChild(c)}
                              className="inline-flex h-10 w-10 items-center justify-center border border-red-300 text-lg font-semibold text-red-700 hover:bg-red-50 disabled:opacity-40"
                            >
                              {deletingId === c.id ? "…" : "X"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="py-8">尚未录入数据。请在首页完成导入，或填写家长问卷。</p>
              )}
            </section>

            <section className="mt-6 border border-[#d6d2c7] bg-[#f8f5ed] p-6">
              <h2 className="text-2xl">想看看这些方向通向哪些学校？</h2>
              <p className="mt-3 text-sm text-[#607168]">
                选校地图收录 113 所 TOP 榜单院校，可按类型、地区、申请批次与标化政策筛选，也可以输入 SAT
                看初步区间。地图不按方向筛院校——数据里没有院校与方向的映射，硬筛等于编数据。
              </p>
              <Link
                href="/colleges?from=explore"
                className="mt-5 inline-block border border-[#1e4b3b] px-5 py-3 text-sm text-[#1e4b3b]"
              >
                进入选校地图 →
              </Link>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
