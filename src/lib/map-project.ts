/**
 * 投影与画布尺寸 —— 选校地图与现场全景共用（docs/11 §1.3）。
 *
 * 从 `lib/colleges-project.ts` 抽出，那边 re-export，所以现有 import 与测试零改动。
 * 抽出来的理由很实在：现场全景的梦想院校地图要用**同一套投影和同一块底图**，
 * 复制一份的话两块地图会慢慢画歪。
 *
 * 纯函数，不依赖 React。
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
