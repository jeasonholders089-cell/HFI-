"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { useLang, useT } from "@/components/colleges/colleges-context";
import type { College } from "@/lib/colleges-data";
import { layoutLabels, spreadPoints } from "@/lib/colleges-labels";
import { nameOf, typeShort } from "@/lib/colleges-l10n";
import { matchLabel } from "@/lib/colleges-match";
import {
  HOME_VIEW,
  LABEL_K_SCHOOL,
  LABEL_K_STATE,
  LABEL_SCHOOL_MAX,
  MAP_H,
  MAP_VIEWBOX,
  MAP_W,
  baseRadius,
  clampView,
  dotRadius,
  nearestSchool,
  pickThreshold,
  screenToViewBox,
  zoomAt,
  zoomScale,
  type ViewBox,
} from "@/lib/colleges-project";
import { readFlag, writeFlag } from "@/lib/colleges-storage";
import { NEIGHBOR_LAND, STATE_PATHS, US_INSETS } from "@/lib/us-map-paths";
import { CITY_LABELS, GEO_LABELS, STATE_LABELS } from "@/lib/us-map-labels";

/**
 * 地图区（docs/08 §6.1–6.5 / §6.18）。
 *
 * 值得单独记住的四处：
 *   1. **拾取用原始坐标，散开只改渲染坐标**（§6.5）—— 否则点到的是假位置；
 *   2. 悬停**延迟 120ms**、接近右/下缘时翻转，平移过就立即隐藏（A7）；
 *   3. `hovered` 只存 `en`，坐标留在事件里（§6.18 的性能约定）；
 *   4. 首次进入的操作提示 3 秒淡出，写 `hfi.colleges.tipsSeen`（A10）。
 */
type Props = {
  colleges: readonly College[];
  selected: string | null;
  slots: readonly string[];
  favs?: ReadonlySet<string>;
  /** 黑马匹配的档位映射；开启后悬停提示会带档位（H3 的三处同步之一） */
  matchTags?: ReadonlyMap<string, string | null> | null;
  onSelect: (en: string) => void;
};

/** 对外暴露的能力：把某个院校定位到视口中心（表格行点击用，§6.9 E4）。 */
export type CollegesMapHandle = { focusOn: (en: string) => void };

/** 点色（按类型）。色值只在 globals.css 里定义。 */
const DOT_FILL: Record<College["typeKey"], string> = {
  uni: "var(--dot-uni)",
  pub: "var(--dot-pub)",
  lac: "var(--dot-lac)",
};

const HOVER_DELAY_MS = 120;
const TIP_MS = 3000;
/**
 * 判定「这是一次拖拽」的最小位移（屏幕像素）。
 *
 * 原来是 2px —— 触控板或鼠标按下去时手抖 2-3px 就会被判成拖拽，
 * 于是 `pointerup` 直接 return，**点圆点没有任何反应**。
 * 提到 6px：正常点击不会跨过它，真要拖地图也不会因为多走 4px 而变迟钝。
 */
const DRAG_MIN_PX = 6;

/** 只读的布尔外部存储（提示是否看过 / 是否触屏）。 */
function subscribeStatic(): () => void {
  return () => {};
}

export const CollegesMap = forwardRef<CollegesMapHandle, Props>(function CollegesMap(
  { colleges, selected, slots, favs, matchTags, onSelect },
  ref,
) {
  const t = useT();
  const lang = useLang();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [vb, setVb] = useState<ViewBox>({ ...HOME_VIEW });
  const [tip, setTip] = useState<{ en: string; x: number; y: number } | null>(null);
  const [dismissedTips, setDismissedTips] = useState(false);
  /** 容器渲染宽度 —— 散开与拾取阈值都要把屏幕像素换算成视口单位 */
  const [boxW, setBoxW] = useState(0);
  const [boxH, setBoxH] = useState(0);
  /** 鼠标悬停在哪一个州（§6.4 的位置反馈） */
  const [hoverState, setHoverState] = useState<string | null>(null);

  const drag = useRef<{
    active: boolean;
    /** 按下时的屏幕坐标（判定"是不是拖拽"用它，不用增量） */
    sx: number;
    sy: number;
    /** 上一次用于算增量的屏幕坐标 */
    px: number;
    py: number;
    moved: boolean;
    id: number | null;
  }>({ active: false, sx: 0, sy: 0, px: 0, py: 0, moved: false, id: null });
  const pinch = useRef<{ pts: Map<number, { x: number; y: number }>; dist: number }>({
    pts: new Map(),
    dist: 0,
  });
  const hoverTimer = useRef<number | null>(null);

  const tipsSeen = useSyncExternalStore(
    subscribeStatic,
    () => readFlag("tipsSeen"),
    () => true,
  );
  const coarse = useSyncExternalStore(
    subscribeStatic,
    () => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches,
    () => false,
  );

  // 操作提示：3 秒后淡出并写入标记；点击提示本身立即关闭并写入（A10）
  const closeTips = useCallback(() => {
    writeFlag("tipsSeen");
    setDismissedTips(true);
  }, []);

  useEffect(() => {
    if (tipsSeen || dismissedTips) return;
    const id = window.setTimeout(closeTips, TIP_MS);
    return () => window.clearTimeout(id);
  }, [tipsSeen, dismissedTips, closeTips]);

  useEffect(() => {
    return () => {
      if (hoverTimer.current !== null) window.clearTimeout(hoverTimer.current);
    };
  }, []);

  const k = zoomScale(vb);
  const slotSet = useMemo(() => new Set(slots), [slots]);
  const favSet = useMemo(() => favs ?? new Set<string>(), [favs]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const sync = () => {
      const r = el.getBoundingClientRect();
      setBoxW(r.width);
      setBoxH(r.height);
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /**
   * 屏幕像素 → 视口单位要用的「内容区宽度」。
   *
   * SVG 默认的 `preserveAspectRatio="xMidYMid meet"` 是**等比缩放 + 居中**：
   * 元素盒子的宽高比与 viewBox(975:610) 不一致时，左右或上下会留白（letterbox）。
   * 留白区不属于 viewBox，坐标换算必须扣掉它 —— 否则靠边的点会点不中。
   */
  const contentWidth = useMemo(() => {
    if (boxW <= 0 || boxH <= 0) return 0;
    return vb.w * Math.min(boxW / vb.w, boxH / vb.h);
  }, [boxW, boxH, vb.w, vb.h]);

  /** 渲染坐标：k ≥ 2.5 时散开。**不参与拾取**。 */
  const renderPts = useMemo(
    () => spreadPoints(colleges.map((c) => ({ en: c.en, x: c.x, y: c.y })), k, vb.w, contentWidth),
    [colleges, k, vb.w, contentWidth],
  );
  const renderXY = useMemo(() => {
    const m = new Map<string, { x: number; y: number }>();
    for (const p of renderPts) m.set(p.en, { x: p.x, y: p.y });
    return m;
  }, [renderPts]);

  useImperativeHandle(
    ref,
    () => ({
      /** 保持当前缩放级别，只改视口位置；改完过边界钳制。 */
      focusOn(en: string) {
        const c = colleges.find((x) => x.en === en);
        if (!c) return;
        setVb((prev) => clampView({ ...prev, x: c.x - prev.w / 2, y: c.y - prev.h / 2 }));
      },
    }),
    [colleges],
  );

  /** 只把过滤结果的 x/y 传进拾取 —— 被筛掉的点不能被选中（§6.2）。**用原始坐标**。 */
  const candidates = useMemo(
    () => colleges.map((c) => ({ en: c.en, x: c.x, y: c.y })),
    [colleges],
  );

  const applyZoom = useCallback((cx: number, cy: number, f: number) => {
    setVb((prev) => zoomAt(prev, cx, cy, f));
  }, []);

  /**
   * 取 SVG 的**内容区**（等比缩放居中之后的实际绘图区，绝对屏幕坐标）。
   * 所有「屏幕坐标 ↔ viewBox 坐标」的换算都必须用它，不能用元素盒子 ——
   * 元素盒子比内容区宽/高出来的那一圈是留白，点在留白上算出来的 viewBox 坐标是偏的。
   */
  const mapRect = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    const scale = Math.min(r.width / vb.w, r.height / vb.h) || 1;
    const w = vb.w * scale;
    const h = vb.h * scale;
    return {
      left: r.left + (r.width - w) / 2,
      top: r.top + (r.height - h) / 2,
      width: w,
      height: h,
    };
  }, [vb]);

  /** 以视口中心为锚点缩放（缩放按钮用，复用同一套变换，A4）。 */
  const zoomFromCenter = useCallback(
    (f: number) => setVb((prev) => zoomAt(prev, prev.x + prev.w / 2, prev.y + prev.h / 2, f)),
    [],
  );

  /** 复位**只重置视口**，不动浏览位 / 对比位 / 筛选（A4 的验收点）。 */
  const resetView = useCallback(() => setVb({ ...HOME_VIEW }), []);

  // 滚轮缩放：以光标为锚点。passive:false 才能 preventDefault（§6.3）
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = mapRect();
      if (!rect) return;
      const [cx, cy] = screenToViewBox(e.clientX, e.clientY, rect, vb);
      applyZoom(cx, cy, 1.0016 ** -e.deltaY);
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [vb, applyZoom, mapRect]);

  const hitAt = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current;
      if (!svg) return null;
      const rect = mapRect();
      if (!rect) return null;
      const [px, py] = screenToViewBox(clientX, clientY, rect, vb);
      return nearestSchool(candidates, px, py, pickThreshold(vb, rect.width));
    },
    [candidates, vb, mapRect],
  );

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    svg.setPointerCapture(e.pointerId);
    pinch.current.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current.pts.size === 1) {
      drag.current = {
        active: true,
        sx: e.clientX,
        sy: e.clientY,
        px: e.clientX,
        py: e.clientY,
        moved: false,
        id: e.pointerId,
      };
    } else {
      // 第二指落下 → 进入捏合，取消平移
      drag.current = { active: false, sx: 0, sy: 0, px: 0, py: 0, moved: true, id: null };
      const [a, b] = [...pinch.current.pts.values()];
      pinch.current.dist = Math.hypot(a.x - b.x, a.y - b.y);
    }
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = mapRect();
    if (!rect) return;

    if (pinch.current.pts.has(e.pointerId)) pinch.current.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // 双指捏合（§6.3）
    if (pinch.current.pts.size >= 2) {
      const [a, b] = [...pinch.current.pts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch.current.dist > 0 && d > 0) {
        const midX = (a.x + b.x) / 2;
        const midY = (a.y + b.y) / 2;
        const [cx, cy] = screenToViewBox(midX, midY, rect, vb);
        applyZoom(cx, cy, d / pinch.current.dist);
      }
      pinch.current.dist = d;
      return;
    }

    if (drag.current.active && drag.current.id === e.pointerId) {
      if (!drag.current.moved) {
        // 用「按下点 → 当前点」的总位移判定，而不是逐帧增量
        const far = Math.hypot(e.clientX - drag.current.sx, e.clientY - drag.current.sy) > DRAG_MIN_PX;
        if (!far) return;
        drag.current.moved = true;
        // 刚跨过阈值：把增量基准挪到当前位置，避免视口"跳一下"
        drag.current.px = e.clientX;
        drag.current.py = e.clientY;
        return;
      }
      // 屏幕位移 → 视口位移（方向相反：拖地图往右，视口往左）
      const dvx = ((e.clientX - drag.current.px) / rect.width) * vb.w;
      const dvy = ((e.clientY - drag.current.py) / rect.height) * vb.h;
      setVb((prev) => clampView({ ...prev, x: prev.x - dvx, y: prev.y - dvy }));
      drag.current.px = e.clientX;
      drag.current.py = e.clientY;
      // 本次指针序列发生过平移 → 立即隐藏悬停提示（A7）
      if (hoverTimer.current !== null) window.clearTimeout(hoverTimer.current);
      setTip(null);
      return;
    }

    // 悬停拾取：延迟 120ms 显示，避免快速划过时闪
    const hit = hitAt(e.clientX, e.clientY);
    const nextEn = hit?.en ?? null;
    if (tip?.en === nextEn) return;
    if (hoverTimer.current !== null) window.clearTimeout(hoverTimer.current);
    if (!nextEn) {
      setTip(null);
      return;
    }
    const x = e.clientX;
    const y = e.clientY;
    hoverTimer.current = window.setTimeout(() => setTip({ en: nextEn, x, y }), HOVER_DELAY_MS);
  };

  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    const moved = drag.current.moved || pinch.current.pts.size >= 2;
    const startX = drag.current.sx;
    const startY = drag.current.sy;
    pinch.current.pts.delete(e.pointerId);
    if (pinch.current.pts.size < 2) pinch.current.dist = 0;
    drag.current = { active: false, sx: 0, sy: 0, px: 0, py: 0, moved: false, id: null };
    if (moved) return;

    // 松手位置命中就够；命不中时退回按下位置再试一次（手指/光标抬起的瞬间会挪一点）
    const hit = hitAt(e.clientX, e.clientY) ?? hitAt(startX, startY);
    if (hit) onSelect(hit.en);
  };

  /** 双击放大（§6.3：f = 1.8）。 */
  const onDoubleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = mapRect();
    if (!rect) return;
    const [cx, cy] = screenToViewBox(e.clientX, e.clientY, rect, vb);
    applyZoom(cx, cy, 1.8);
  };

  const hoveredCollege = tip ? colleges.find((c) => c.en === tip.en) ?? null : null;
  const schoolFs = 11.5 / k;
  const showSchoolLabels = k >= LABEL_K_SCHOOL && colleges.filter((c) => {
    return c.x >= vb.x - 10 && c.x <= vb.x + vb.w + 10 && c.y >= vb.y - 10 && c.y <= vb.y + vb.h + 10;
  }).length <= LABEL_SCHOOL_MAX;

  const schoolLabels = useMemo(() => {
    if (!showSchoolLabels) return [];
    return layoutLabels(
      colleges.map((c) => {
        const p = renderXY.get(c.en) ?? { x: c.x, y: c.y };
        return { en: c.en, x: p.x, y: p.y, rank: c.rank, text: nameOf(c, lang) };
      }),
      schoolFs,
      vb,
      dotRadius(baseRadius(9), k) + 3,
      4,
    );
  }, [showSchoolLabels, colleges, renderXY, schoolFs, vb, k, lang]);

  /** 悬停提示的位置：跟随光标，接近右缘 / 下缘时翻到另一侧（A7）。 */
  const tipStyle = useMemo(() => {
    const w = wrapRef.current?.getBoundingClientRect();
    if (!tip || !w) return null;
    const x = tip.x - w.left;
    const y = tip.y - w.top;
    const flipX = x > w.width - 220;
    const flipY = y > w.height - 90;
    return {
      left: flipX ? undefined : x + 14,
      right: flipX ? w.width - x + 14 : undefined,
      top: flipY ? undefined : y + 16,
      bottom: flipY ? w.height - y + 12 : undefined,
    };
  }, [tip]);

  const showTips = !tipsSeen && !dismissedTips;

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden" style={{ background: "var(--map-ocean)" }}>
      <svg
        ref={svgRef}
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        className="h-full w-full touch-none select-none"
        role="img"
        aria-label={t("map.aria")}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDoubleClick={onDoubleClick}
        onPointerLeave={() => {
          if (hoverTimer.current !== null) window.clearTimeout(hoverTimer.current);
          setTip(null);
          pinch.current.pts.clear();
          drag.current = { active: false, sx: 0, sy: 0, px: 0, py: 0, moved: false, id: null };
        }}
      >
        {/*
          ① 海洋：整块矩形，**单一颜色**（最底层，其余都压在上面）。
          不用渐变：容器宽高比与 viewBox 宽高比不一致时，SVG 会在两侧或上下留白，
          渐变会在「内容区」与「留白区」之间露出一条接缝。纯色 + 和容器同色，
          接缝就不存在了 —— "陆地之外都是海洋"。
        */}
        <rect x={0} y={0} width={MAP_W} height={MAP_H} fill="var(--map-ocean)" pointerEvents="none" />

        {/* ② 邻国陆地（加拿大 / 墨西哥 / 巴哈马 / 古巴）：平涂，比美国本土深一档 */}
        <g aria-hidden>
          {NEIGHBOR_LAND.map((n) => (
            <path
              key={n.id}
              d={n.d}
              fill="var(--map-neighbor)"
              stroke="var(--map-neighbor-line)"
              strokeWidth={1 / Math.max(1, k ** 0.5)}
              strokeLinejoin="round"
              pointerEvents="none"
            />
          ))}
        </g>

        {/*
          ③ 美国：本土 49 州 + 阿拉斯加 / 夏威夷插图，整组带投影。
          投影是把它从邻国陆地上"抬起来"的那一下 —— 也是这三层里唯一的层级信号。
        */}
        <g className="land-shadow">
          {US_INSETS.map((ins) => (
            <g key={ins.st} transform={ins.transform}>
              <path
                d={ins.d}
                fill="var(--map-land)"
                stroke="var(--map-inset-line)"
                strokeWidth={1.1 / Math.max(1, k ** 0.5)}
                strokeLinejoin="round"
                pointerEvents="none"
              />
            </g>
          ))}
          {STATE_PATHS.map((s) => (
            <path
              key={s.st}
              d={s.d}
              fill={hoverState === s.st ? "var(--map-land-hover)" : "var(--map-land)"}
              stroke={hoverState === s.st ? "var(--map-land-hover-line)" : "var(--map-land-line)"}
              strokeWidth={(hoverState === s.st ? 1.2 : 1.1) / Math.max(1, k ** 0.5)}
              strokeLinejoin="round"
              onPointerEnter={() => setHoverState(s.st)}
              onPointerLeave={() => setHoverState((cur) => (cur === s.st ? null : cur))}
            />
          ))}
        </g>

        {/* 海陆标注（5 个，恒显）*/}
        <g aria-hidden>
          {GEO_LABELS.map((g) => (
            <text
              key={g.en}
              x={g.x}
              y={g.y}
              textAnchor="middle"
              fontSize={g.f / k ** 0.75}
              fill={g.land ? "#667d70" : "#9aa59c"}
              opacity={0.85}
              pointerEvents="none"
            >
              {lang === "en" ? g.en : g.zh}
            </text>
          ))}
        </g>

        {/* 州名标注：缩写恒显；中文名条件是 f ≥ 8 或 k ≥ 1.6；k > 4.5 整体降到 0.35 */}
        <g aria-hidden opacity={k > 4.5 ? 0.35 : 1}>
          {STATE_LABELS.map((s) => {
            const fs = s.f / k ** 0.9;
            const showZh = lang === "zh" && (s.f >= 8 || k >= LABEL_K_STATE);
            return (
              <g key={s.a} pointerEvents="none">
                <text x={s.x} y={s.y} textAnchor="middle" fontSize={fs} fill="#667d70">
                  {s.a}
                </text>
                {showZh && (
                  <text x={s.x} y={s.y + fs * 1.15} textAnchor="middle" fontSize={fs * 0.92} fill="#667d70">
                    {s.z}
                  </text>
                )}
              </g>
            );
          })}
        </g>

        {/* 城市标注（16 个，恒显）：菱形标记 + 名称 */}
        <g aria-hidden>
          {CITY_LABELS.map((c) => (
            <g key={c.en} pointerEvents="none">
              <rect
                x={c.x - (5 / k ** 0.82) / 2}
                y={c.y - (5 / k ** 0.82) / 2}
                width={5 / k ** 0.82}
                height={5 / k ** 0.82}
                fill="#68786e"
                transform={`rotate(45 ${c.x} ${c.y})`}
              />
              <text
                x={c.x}
                y={c.y - 7 / k ** 0.82}
                textAnchor="middle"
                fontSize={10 / k ** 0.78}
                fill="#50645b"
              >
                {lang === "en" ? c.en : c.zh}
              </text>
            </g>
          ))}
        </g>

        {/* 院校圆点 */}
        <g>
          {colleges.map((c) => {
            const p = renderXY.get(c.en) ?? { x: c.x, y: c.y };
            const r = dotRadius(baseRadius(c.rank), k);
            const isSel = c.en === selected;
            const inSlot = slotSet.has(c.en);
            const isFav = favSet.has(c.en);
            const stroke = (isSel ? 2 : 1.4) / k ** 0.82;
            return (
              <g key={c.en}>
                {/* 收藏环（§6.1 D1）：半径 base+3，金棕，线宽 2 */}
                {isFav && (
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={Math.max(4.4, (baseRadius(c.rank) + 3) / k ** 0.82)}
                    fill="none"
                    stroke="var(--dot-uni)"
                    strokeWidth={2 / k ** 0.82}
                    pointerEvents="none"
                  />
                )}
                {/* 对比位中的院校：虚线圈（与金棕实心环区分开） */}
                {inSlot && (
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={r + 6 / k ** 0.82}
                    fill="none"
                    stroke="var(--dot-lac)"
                    strokeWidth={1.4 / k ** 0.82}
                    strokeDasharray={`${2.5 / k ** 0.82} ${2 / k ** 0.82}`}
                    pointerEvents="none"
                  />
                )}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isSel ? r + 1 : r}
                  fill={DOT_FILL[c.typeKey]}
                  fillOpacity={0.9}
                  stroke={isSel || tip?.en === c.en ? "#211d18" : "#ffffff"}
                  strokeWidth={stroke}
                  pointerEvents="none"
                />
              </g>
            );
          })}
        </g>

        {/* 院校名（k ≥ 2.3 且视口内 ≤ 60 所，带碰撞避让）*/}
        {schoolLabels.length > 0 && (
          <g aria-hidden>
            {schoolLabels.map((l) => (
              <text
                key={l.en}
                x={l.x}
                y={l.y}
                fontSize={l.fs}
                fill="#211d18"
                pointerEvents="none"
              >
                {l.text}
              </text>
            ))}
          </g>
        )}
      </svg>

      {/* 缩放控件（§6.18 A4） */}
      <div className="absolute left-4 top-4 flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => zoomFromCenter(1.35)}
          aria-label={t("map.zoomIn")}
          className="h-9 w-9 rounded-lg border border-[#d6d2c7] bg-white/95 text-lg leading-none text-[#17382f] shadow-sm hover:border-[#8b6f45] hover:text-[#8b6f45]"
        >
          ＋
        </button>
        <button
          type="button"
          onClick={() => zoomFromCenter(1 / 1.35)}
          aria-label={t("map.zoomOut")}
          className="h-9 w-9 rounded-lg border border-[#d6d2c7] bg-white/95 text-lg leading-none text-[#17382f] shadow-sm hover:border-[#8b6f45] hover:text-[#8b6f45]"
        >
          －
        </button>
        <button
          type="button"
          onClick={resetView}
          aria-label={t("map.zoomReset")}
          className="h-9 w-9 rounded-lg border border-[#d6d2c7] bg-white/95 text-base leading-none text-[#17382f] shadow-sm hover:border-[#8b6f45] hover:text-[#8b6f45]"
        >
          ⟲
        </button>
      </div>

      {/* 首次进入的操作提示（A10）：role=note，3 秒淡出 */}
      {showTips && (
        <div
          role="note"
          onClick={closeTips}
          className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-[#d6d2c7] bg-white/95 px-4 py-2 text-[0.75rem] text-[#50645b] shadow-sm"
        >
          <span>{coarse ? t("map.hintTouch") : t("map.hint")}</span>
          <button
            type="button"
            onClick={closeTips}
            className="rounded-full border border-[#aeb7ad] px-2 py-0.5 text-[0.6875rem] hover:border-[#8b6f45]"
          >
            {t("map.dismiss")}
          </button>
        </div>
      )}

      {/* 悬停提示（A7）：跟随光标，接近边缘时翻转 */}
      {hoveredCollege && tipStyle && (
        <div
          className="pointer-events-none absolute z-20 max-w-[16rem] rounded-lg border border-[#d6d2c7] bg-white/95 px-3 py-2 text-xs shadow-sm"
          style={tipStyle}
        >
          <b className="text-[#17382f]">{nameOf(hoveredCollege, lang)}</b>
          <span className="ml-2 text-[#68786e]">
            {typeShort(hoveredCollege, lang)} · #{hoveredCollege.rank}
          </span>
          {matchTags?.get(hoveredCollege.en) ? (
            <span className="ml-2 rounded bg-[#f5ecdf] px-1.5 py-0.5 text-[0.625rem] text-[#8b6f45]">
              {matchLabel(matchTags.get(hoveredCollege.en) as "r", lang)}
            </span>
          ) : null}
        </div>
      )}

      {/* 缩放倍率（验收用，很小不影响观感）*/}
      <div className="pointer-events-none absolute bottom-4 right-4 text-[0.625rem] text-[#9aa59c]">
        {k.toFixed(1)}× · {MAP_W}×{MAP_H}
      </div>
    </div>
  );
});

export { MAP_VIEWBOX };
