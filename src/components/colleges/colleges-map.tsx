"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { College } from "@/lib/colleges-data";
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
import { STATE_PATHS } from "@/lib/us-map-paths";
import { MATCH_LABEL, type MatchTag } from "@/lib/colleges-match";

/** 州的缩写 → 中文名，用于州名标注。 */
const STATE_ZH: Record<string, string> = {
  AL: "阿拉巴马", AK: "阿拉斯加", AZ: "亚利桑那", AR: "阿肯色", CA: "加州",
  CO: "科罗拉多", CT: "康涅狄格", DE: "特拉华", DC: "华盛顿特区", FL: "佛州",
  GA: "佐治亚", HI: "夏威夷", ID: "爱达荷", IL: "伊利诺伊", IN: "印第安纳",
  IA: "爱荷华", KS: "堪萨斯", KY: "肯塔基", LA: "路易斯安那", ME: "缅因",
  MD: "马里兰", MA: "麻萨诸塞", MI: "密歇根", MN: "明尼苏达", MS: "密西西比",
  MO: "密苏里", MT: "蒙大拿", NE: "内布拉斯加", NV: "内华达", NH: "新罕布什尔",
  NJ: "新泽西", NM: "新墨西哥", NY: "纽约州", NC: "北卡", ND: "北达科他",
  OH: "俄亥俄", OK: "俄克拉荷马", OR: "俄勒冈", PA: "宾州", RI: "罗德岛",
  SC: "南卡", SD: "南达科他", TN: "田纳西", TX: "德州", UT: "犹他",
  VT: "佛蒙特", VA: "弗吉尼亚", WA: "华盛顿州", WV: "西弗吉尼亚",
  WI: "威斯康星", WY: "怀俄明",
};

/** 州名标注的锚点（用路径包围盒中心近似，够用且零成本）。 */
const STATE_ANCHOR: Record<string, [number, number]> = {};
for (const s of STATE_PATHS) {
  const nums = s.d.match(/-?\d+(?:\.\d+)?/g) ?? [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i + 1 < nums.length; i += 2) {
    const x = Number(nums[i]);
    const y = Number(nums[i + 1]);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  STATE_ANCHOR[s.st] = [(minX + maxX) / 2, (minY + maxY) / 2];
}

/** 点色（按类型）。色值只在 globals.css 里定义。 */
const DOT_FILL: Record<College["typeKey"], string> = {
  uni: "var(--dot-uni)",
  pub: "var(--dot-pub)",
  lac: "var(--dot-lac)",
};

type Props = {
  colleges: readonly College[];
  selected: string | null;
  slots: readonly string[];
  /** 黑马匹配的档位映射；开启后地图上的悬停提示会带档位（H3 的三处同步之一） */
  matchTags?: ReadonlyMap<string, string | null> | null;
  onSelect: (en: string) => void;
};

export function CollegesMap({ colleges, selected, slots, matchTags, onSelect }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [vb, setVb] = useState<ViewBox>({ ...HOME_VIEW });
  const [hovered, setHovered] = useState<string | null>(null);
  const drag = useRef<{ active: boolean; px: number; py: number; moved: boolean; id: number | null }>({
    active: false,
    px: 0,
    py: 0,
    moved: false,
    id: null,
  });

  const k = zoomScale(vb);
  const slotSet = useMemo(() => new Set(slots), [slots]);

  /** 只把过滤结果的 x/y 传进拾取 —— 被筛掉的点不能被选中（docs/08 §6.2）。 */
  const candidates = useMemo(
    () => colleges.map((c) => ({ en: c.en, x: c.x, y: c.y })),
    [colleges],
  );

  const applyZoom = useCallback((cx: number, cy: number, f: number) => {
    setVb((prev) => zoomAt(prev, cx, cy, f));
  }, []);

  /** 以视口中心为锚点缩放（缩放按钮用）。 */
  const zoomFromCenter = useCallback(
    (f: number) => setVb((prev) => zoomAt(prev, prev.x + prev.w / 2, prev.y + prev.h / 2, f)),
    [],
  );

  const resetView = useCallback(() => setVb({ ...HOME_VIEW }), []);

  // 滚轮缩放：以光标为锚点。passive:false 才能 preventDefault（docs/08 §6.3）
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      const [cx, cy] = screenToViewBox(e.clientX, e.clientY, rect, vb);
      applyZoom(cx, cy, 1.0016 ** -e.deltaY);
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [vb, applyZoom]);

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    svg.setPointerCapture(e.pointerId);
    drag.current = { active: true, px: e.clientX, py: e.clientY, moved: false, id: e.pointerId };
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();

    if (drag.current.active && drag.current.id === e.pointerId) {
      const dxPx = e.clientX - drag.current.px;
      const dyPx = e.clientY - drag.current.py;
      if (Math.abs(dxPx) > 2 || Math.abs(dyPx) > 2) drag.current.moved = true;
      if (drag.current.moved) {
        // 屏幕位移 → 视口位移（方向相反：拖地图往右，视口往左）
        const dvx = (dxPx / rect.width) * vb.w;
        const dvy = (dyPx / rect.height) * vb.h;
        setVb((prev) => clampView({ ...prev, x: prev.x - dvx, y: prev.y - dvy }));
        drag.current.px = e.clientX;
        drag.current.py = e.clientY;
      }
      return;
    }

    // 悬停拾取
    const [px, py] = screenToViewBox(e.clientX, e.clientY, rect, vb);
    const hit = nearestSchool(candidates, px, py, pickThreshold(vb, rect.width));
    setHovered(hit ? hit.en : null);
  };

  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    const moved = drag.current.moved;
    drag.current = { active: false, px: 0, py: 0, moved: false, id: null };
    if (moved) return;

    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const [px, py] = screenToViewBox(e.clientX, e.clientY, rect, vb);
    const hit = nearestSchool(candidates, px, py, pickThreshold(vb, rect.width));
    if (hit) onSelect(hit.en);
  };

  const hoveredCollege = hovered ? colleges.find((c) => c.en === hovered) ?? null : null;
  const showSchoolLabels = k >= LABEL_K_SCHOOL && colleges.length <= LABEL_SCHOOL_MAX;
  const showStateLabels = k >= LABEL_K_STATE;

  return (
    <div className="relative h-full w-full overflow-hidden" style={{ background: "var(--map-ocean)" }}>
      <svg
        ref={svgRef}
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        className="h-full w-full touch-none select-none"
        role="img"
        aria-label="美国院校分布地图"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => {
          setHovered(null);
          drag.current = { active: false, px: 0, py: 0, moved: false, id: null };
        }}
      >
        {/* 州界 */}
        <g>
          {STATE_PATHS.map((s) => (
            <path
              key={s.st}
              d={s.d}
              fill="var(--map-land)"
              stroke="var(--map-land-line)"
              strokeWidth={0.8 / Math.max(1, k ** 0.5)}
              strokeLinejoin="round"
            />
          ))}
        </g>

        {/* 州名 */}
        {showStateLabels && (
          <g aria-hidden>
            {STATE_PATHS.map((s) => {
              const a = STATE_ANCHOR[s.st];
              if (!a) return null;
              return (
                <text
                  key={s.st}
                  x={a[0]}
                  y={a[1]}
                  textAnchor="middle"
                  fontSize={9 / Math.max(1, k ** 0.55)}
                  fill="#667d70"
                  pointerEvents="none"
                >
                  {STATE_ZH[s.st] ?? s.st}
                </text>
              );
            })}
          </g>
        )}

        {/* 院校圆点 */}
        <g>
          {colleges.map((c) => {
            const r = dotRadius(baseRadius(c.rank), k);
            const isSel = c.en === selected;
            const inSlot = slotSet.has(c.en);
            return (
              <g key={c.en}>
                {/* 对比位中的院校：外圈环（形状做二次区分，与图例同源） */}
                {inSlot && (
                  <circle
                    cx={c.x}
                    cy={c.y}
                    r={r + 3}
                    fill="none"
                    stroke="var(--dot-uni)"
                    strokeWidth={1.6 / Math.max(1, k ** 0.5)}
                    pointerEvents="none"
                  />
                )}
                <circle
                  cx={c.x}
                  cy={c.y}
                  r={isSel ? r + 1 : r}
                  fill={DOT_FILL[c.typeKey]}
                  fillOpacity={0.9}
                  stroke={isSel || hovered === c.en ? "#211d18" : "#ffffff"}
                  strokeWidth={(isSel ? 2 : 1.2) / Math.max(1, k ** 0.5)}
                  pointerEvents="none"
                />
              </g>
            );
          })}
        </g>

        {/* 院校名（放大到一定程度才显示，且数量受限） */}
        {showSchoolLabels && (
          <g aria-hidden>
            {colleges.map((c) => (
              <text
                key={c.en}
                x={c.x + dotRadius(baseRadius(c.rank), k) + 2}
                y={c.y + 3}
                fontSize={9.5 / Math.max(1, k ** 0.55)}
                fill="#211d18"
                pointerEvents="none"
              >
                {c.zh}
              </text>
            ))}
          </g>
        )}
      </svg>

      {/* 缩放控件（docs/08 6.13 / 6.18 A4） */}
      <div className="absolute left-4 top-4 flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => zoomFromCenter(1.35)}
          aria-label="放大"
          className="h-9 w-9 rounded-lg border border-[#d6d2c7] bg-white/95 text-lg leading-none text-[#17382f] shadow-sm hover:border-[#8b6f45] hover:text-[#8b6f45]"
        >
          ＋
        </button>
        <button
          type="button"
          onClick={() => zoomFromCenter(1 / 1.35)}
          aria-label="缩小"
          className="h-9 w-9 rounded-lg border border-[#d6d2c7] bg-white/95 text-lg leading-none text-[#17382f] shadow-sm hover:border-[#8b6f45] hover:text-[#8b6f45]"
        >
          －
        </button>
        <button
          type="button"
          onClick={resetView}
          aria-label="复位视图"
          className="h-9 w-9 rounded-lg border border-[#d6d2c7] bg-white/95 text-base leading-none text-[#17382f] shadow-sm hover:border-[#8b6f45] hover:text-[#8b6f45]"
        >
          ⟲
        </button>
      </div>

      {/* 悬停提示（docs/08 5.14 / 6.18 A7） */}
      {hoveredCollege && (
        <div className="pointer-events-none absolute bottom-4 left-4 rounded-lg border border-[#d6d2c7] bg-white/95 px-3 py-2 text-xs shadow-sm">
          <b className="text-[#17382f]">{hoveredCollege.zh}</b>
          <span className="ml-2 text-[#68786e]">
            {hoveredCollege.type === "lac" ? "文理" : hoveredCollege.pub === 1 ? "公立" : "私立"} · 第{" "}
            {hoveredCollege.rank} 名
          </span>
          {matchTags?.get(hoveredCollege.en) ? (
            <span className="ml-2 rounded bg-[#f5ecdf] px-1.5 py-0.5 text-[10px] text-[#8b6f45]">
              {MATCH_LABEL[matchTags.get(hoveredCollege.en) as MatchTag]}
            </span>
          ) : null}
        </div>
      )}

      {/* 缩放倍率（调试与验收用，很小不影响观感） */}
      <div className="pointer-events-none absolute bottom-4 right-4 text-[10px] text-[#9aa59c]">
        {k.toFixed(1)}× · {MAP_W}×{MAP_H}
      </div>
    </div>
  );
}

export { MAP_VIEWBOX };
