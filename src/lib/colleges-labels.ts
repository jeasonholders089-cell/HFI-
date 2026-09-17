/**
 * 地图标注的几何布局 —— 纯函数（docs/08 §6.4 院校名避让 / §6.5 点位散开）。
 *
 * 两个函数有一个共同前提：**它们只改「画在哪里」，不改「点在哪里」**。
 * 拾取（`nearestSchool`）必须拿原始 `x` / `y`，否则点到的是假位置。
 * 这条有单元测试守（§7.2「散开后拾取仍按原始坐标」）。
 */

export type Pt = { en: string; x: number; y: number };
export type Box = { x: number; y: number; w: number; h: number };

/** 散开的启动缩放（§6.5：k < 2.5 不散开，允许重叠）。 */
export const SPREAD_K = 2.5;
/** 目标最小间距（屏幕像素）。 */
export const SPREAD_MIN_PX = 12;
/** 外推上限（屏幕像素）。 */
export const SPREAD_MAX_PX = 24;

/**
 * 点位散开：只影响渲染坐标。
 *
 * 做法（与方案描述的"以簇质心外推"等价、但更稳定）：对屏幕距离小于 12px 的点对
 * 做松弛，各退一半，迭代到没有冲突或位移触到 24px 上限。
 * 用松弛而不是质心外推的原因：质心外推会改变整簇的位置，松弛只动冲突的那两个点。
 */
export function spreadPoints(
  pts: readonly Pt[],
  k: number,
  viewW: number,
  renderedWidth: number,
): Pt[] {
  const out = pts.map((p) => ({ ...p }));
  if (k < SPREAD_K || renderedWidth <= 0 || viewW <= 0) return out;

  const unit = viewW / renderedWidth; // 1 屏幕像素 = 多少视口单位
  const min = SPREAD_MIN_PX * unit;
  const cap = SPREAD_MAX_PX * unit;

  for (let iter = 0; iter < 8; iter++) {
    let moved = false;
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const dx = out[j].x - out[i].x;
        const dy = out[j].y - out[i].y;
        const d = Math.hypot(dx, dy);
        if (d >= min) continue;
        moved = true;
        const push = (min - d) / 2;
        // 完全重合时给一个确定方向，避免随机抖动导致每次渲染不一致
        const ux = d < 1e-6 ? 0 : dx / d;
        const uy = d < 1e-6 ? 1 : dy / d;
        out[i].x -= ux * push;
        out[i].y -= uy * push;
        out[j].x += ux * push;
        out[j].y += uy * push;
      }
    }
    if (!moved) break;
  }

  // 位移上限：再挤也不让点离开原位置超过 24 屏幕像素
  for (let i = 0; i < out.length; i++) {
    const dx = out[i].x - pts[i].x;
    const dy = out[i].y - pts[i].y;
    const d = Math.hypot(dx, dy);
    if (d > cap) {
      out[i].x = pts[i].x + (dx / d) * cap;
      out[i].y = pts[i].y + (dy / d) * cap;
    }
  }
  return out;
}

export type LabelInput = Pt & { rank: number; text: string };
export type PlacedLabel = { en: string; x: number; y: number; text: string; fs: number };

/** 五个候选垂直偏移位（§6.4）：0 → 上 1.15 → 下 1.15 → 上 2.3 → 下 2.3。 */
export const LABEL_OFFSETS = [0, -1.15, 1.15, -2.3, 2.3] as const;

/** 文字宽度的粗估：中日韩字符按 1 个字宽，其余按 0.55。宁可估宽一点。 */
function textWidth(s: string, fs: number): number {
  let w = 0;
  for (const ch of s) w += /[\u3000-\u9fff\uff00-\uffef]/.test(ch) ? 1 : 0.55;
  return w * fs;
}

function overlap(a: Box, b: Box): boolean {
  return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
}

/**
 * 院校名的碰撞避让（§6.4）。
 *
 * 1. 只取落在视口内（外扩 10 单位）的院校；
 * 2. **按 rank 升序**处理 —— 排名高的先占位；
 * 3. 每个标签试 5 个垂直偏移位，第一个不冲突的就用；
 * 4. 5 个都冲突就**放弃这个标签**（不显示，而不是叠上去）。
 */
export function layoutLabels(
  pts: readonly LabelInput[],
  fs: number,
  bounds: { x: number; y: number; w: number; h: number },
  offsetX: number,
  offsetY: number,
  limit = Infinity,
): PlacedLabel[] {
  const pad = 10;
  const inside = pts
    .filter(
      (p) =>
        p.x >= bounds.x - pad &&
        p.x <= bounds.x + bounds.w + pad &&
        p.y >= bounds.y - pad &&
        p.y <= bounds.y + bounds.h + pad,
    )
    .sort((a, b) => a.rank - b.rank);

  const placed: Box[] = [];
  const out: PlacedLabel[] = [];

  for (const p of inside) {
    if (out.length >= limit) break;
    const x = p.x + offsetX;
    const y = p.y + offsetY;
    const w = textWidth(p.text, fs);
    const h = fs * 1.1;
    for (const off of LABEL_OFFSETS) {
      const box: Box = { x, y: y + off * fs - h * 0.8, w, h };
      if (placed.some((q) => overlap(q, box))) continue;
      placed.push(box);
      out.push({ en: p.en, x, y: y + off * fs, text: p.text, fs });
      break;
    }
  }
  return out;
}
