/**
 * 投影与视口数学 —— 纯函数，不依赖 React，可直接单元测试（docs/08 §5.1 / §6.2 / §6.3）。
 */

// ---------------------------------------------------------------------------
// 投影：Albers 等距圆锥
//
// 参数与参考实现一致 —— 已用 113 个点反解验证，残差最大 0.069 像素。
// 这组参数是底图与打点共同的坐标系：改任何一项，州界和圆点会一起偏。
// ---------------------------------------------------------------------------
export const PROJECTION = {
  parallel1: 29.5,
  parallel2: 45.5,
  originLat: 37.5,
  centralLng: -96,
  scale: 1300,
  translateX: 498.02,
  translateY: 332.53,
} as const;

const rad = (d: number) => (d * Math.PI) / 180;

/** 经纬度 → 视口坐标（y 轴已翻转，与 SVG 一致）。 */
export function project(lat: number, lng: number): [number, number] {
  const { parallel1, parallel2, originLat, centralLng, scale, translateX, translateY } = PROJECTION;
  const n = (Math.sin(rad(parallel1)) + Math.sin(rad(parallel2))) / 2;
  const C = Math.cos(rad(parallel1)) ** 2 + 2 * n * Math.sin(rad(parallel1));
  const rho = Math.sqrt(C - 2 * n * Math.sin(rad(lat))) / n;
  const rho0 = Math.sqrt(C - 2 * n * Math.sin(rad(originLat))) / n;
  const theta = n * rad(lng - centralLng);
  const x = rho * Math.sin(theta);
  const y = rho0 - rho * Math.cos(theta);
  return [translateX + scale * x, translateY - scale * y];
}

// ---------------------------------------------------------------------------
// 视口
// ---------------------------------------------------------------------------
export const MAP_W = 975;
export const MAP_H = 610;
export const MAP_VIEWBOX = `0 0 ${MAP_W} ${MAP_H}`;

/** 缩放的宽度边界（docs/08 §6.3）。 */
export const MIN_VIEW_W = 110;

/** 复位后的视口。 */
export const HOME_VIEW = { x: 0, y: 0, w: MAP_W, h: MAP_H } as const;

export type ViewBox = { x: number; y: number; w: number; h: number };

/** 把视口钳制回合法范围；高度由宽度等比推出，不拉伸。 */
export function clampView(vb: ViewBox): ViewBox {
  const w = Math.min(MAP_W, Math.max(MIN_VIEW_W, vb.w));
  const h = (w * MAP_H) / MAP_W;
  const x = Math.max(0, Math.min(MAP_W - w, vb.x));
  const y = Math.max(0, Math.min(MAP_H - h, vb.y));
  return { x, y, w, h };
}

/** 以 (cx, cy) 为锚点缩放 f 倍。 */
export function zoomAt(vb: ViewBox, cx: number, cy: number, f: number): ViewBox {
  const w = vb.w / f;
  return clampView({ x: cx - (cx - vb.x) / f, y: cy - (cy - vb.y) / f, w, h: w });
}

/** 缩放倍率：1 表示整图。 */
export function zoomScale(vb: ViewBox): number {
  return MAP_W / vb.w;
}

/** 屏幕坐标 → 视口坐标。 */
export function screenToViewBox(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  vb: ViewBox,
): [number, number] {
  return [
    vb.x + ((clientX - rect.left) / rect.width) * vb.w,
    vb.y + ((clientY - rect.top) / rect.height) * vb.h,
  ];
}

// ---------------------------------------------------------------------------
// 圆点的尺寸
// ---------------------------------------------------------------------------

/** 基础半径：按排名分档（与参考实现一致，docs/08 §6.1）。 */
export function baseRadius(rank: number): number {
  return rank <= 10 ? 6.5 : rank <= 30 ? 5.5 : 4.6;
}

/**
 * 缩放后的实际半径。
 * 指数 0.82 是参考实现的效果参数 —— 放大时点会变小一点，但不会消失；
 * 2.4 是下限（docs/08 §6.1）。
 */
export function dotRadius(baseR: number, k: number): number {
  return Math.max(2.4, baseR / k ** 0.82);
}

// ---------------------------------------------------------------------------
// 最近点拾取
// ---------------------------------------------------------------------------
export type PickCandidate = { en: string; x: number; y: number };

/**
 * 在候选点里找离光标最近的（docs/08 §6.2）。
 *
 * - 阈值按屏幕像素换算成视口单位，且不小于 6，避免缩到最小时点不中；
 * - 只在传入的候选里找 —— 调用方传的是「当前过滤结果」，
 *   这样被筛掉的院校点不会被选中；
 * - 超出阈值返回 null。
 */
export function nearestSchool(
  candidates: readonly PickCandidate[],
  px: number,
  py: number,
  thrViewBox: number,
): PickCandidate | null {
  let best: PickCandidate | null = null;
  let bestD = Infinity;
  for (const c of candidates) {
    const d = Math.hypot(c.x - px, c.y - py);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  const limit = Math.max(thrViewBox, 6);
  return best && bestD <= limit ? best : null;
}

/** 屏幕像素阈值 → 视口单位。 */
export function pickThreshold(vb: ViewBox, renderedWidth: number): number {
  return Math.max(15 * (vb.w / renderedWidth), 6);
}

// ---------------------------------------------------------------------------
// 标注显示阈值
// ---------------------------------------------------------------------------

/** 州名（中文）的显示阈值。 */
export const LABEL_K_STATE = 1.6;
/** 院校名的显示阈值。 */
export const LABEL_K_SCHOOL = 2.3;
/** 视口内院校名超过这个数量时整体不显示（防糊成一片）。 */
export const LABEL_SCHOOL_MAX = 60;
