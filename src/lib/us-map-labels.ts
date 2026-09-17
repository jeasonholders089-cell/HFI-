/**
 * 底图标注的三份静态数据（docs/08 §6.4）。
 *
 * 来源：参考实现的 `STL` / `CITIES` / `GEOL` 三个常量 —— 它们是**地理事实**
 * （州名锚点、16 个主要城市、5 个海陆标注），不含任何 CMC 文案，因此照搬。
 * 提取脚本见 `tmp/audit-map.js`（一次性用，不进版本库）。
 *
 * 三条已知取舍：
 *   1. 州名标注只有 48 条 —— DE / RI / DC 太小放不下（参考实现的选择，沿用），
 *      但这三个州里的院校点照常渲染；
 *   2. 每州的基准字号 `f` 有 4 档（6.8 / 8 / 9.5 / 11），缩放时乘 `1/k^0.9`；
 *   3. 城市与海陆标注**无显示阈值**，恒显。
 */

export type StateLabel = {
  /** 州缩写，恒显 */
  a: string;
  /** 中文州名，`f >= 8 || k >= 1.6` 时才显 */
  z: string;
  x: number;
  y: number;
  /** 基准字号（4 档） */
  f: number;
};

export type CityLabel = { zh: string; en: string; x: number; y: number };
export type GeoLabel = { x: number; y: number; zh: string; en: string; land: boolean; f: number };

/** 48 个州名标注（缺 DE / RI / DC）。 */
export const STATE_LABELS: readonly StateLabel[] = [
  { a: "AL", z: "阿拉巴马", x: 672, y: 432, f: 9.5 },
  // AK / HI 的锚点跟着插图区的变换走（见 build-us-map.ts 的 INSET_TRANSFORM）：
  // 阿拉斯加右移 57 并缩到 0.86、夏威夷右移 20，文字要落在形状中心
  { a: "AK", z: "阿拉斯加", x: 149, y: 511, f: 9.5 },
  { a: "AZ", z: "亚利桑那", x: 208, y: 382, f: 11 },
  { a: "CO", z: "科罗拉多", x: 332, y: 290, f: 11 },
  { a: "FL", z: "佛州", x: 780, y: 516, f: 9.5 },
  { a: "GA", z: "佐治亚", x: 736, y: 428, f: 9.5 },
  { a: "IN", z: "印第安纳", x: 665, y: 269, f: 9.5 },
  { a: "KS", z: "堪萨斯", x: 456, y: 309, f: 9.5 },
  { a: "ME", z: "缅因", x: 919, y: 94, f: 9.5 },
  { a: "MA", z: "麻省", x: 903, y: 171, f: 6.8 },
  { a: "MN", z: "明尼苏达", x: 525, y: 140, f: 11 },
  { a: "NJ", z: "新泽西", x: 864, y: 232, f: 6.8 },
  { a: "NC", z: "北卡", x: 807, y: 353, f: 9.5 },
  { a: "ND", z: "北达科他", x: 429, y: 104, f: 9.5 },
  { a: "OK", z: "俄克拉荷马", x: 471, y: 376, f: 9.5 },
  { a: "PA", z: "宾州", x: 806, y: 226, f: 9.5 },
  { a: "SD", z: "南达科他", x: 430, y: 172, f: 9.5 },
  { a: "TX", z: "德州", x: 434, y: 469, f: 11 },
  { a: "WY", z: "怀俄明", x: 308, y: 195, f: 11 },
  { a: "CT", z: "康涅狄格", x: 886, y: 190, f: 6.8 },
  { a: "MO", z: "密苏里", x: 560, y: 312, f: 9.5 },
  { a: "WV", z: "西弗吉尼亚", x: 765, y: 289, f: 8 },
  { a: "IL", z: "伊利诺伊", x: 615, y: 270, f: 9.5 },
  { a: "NM", z: "新墨西哥", x: 311, y: 393, f: 11 },
  { a: "AR", z: "阿肯色", x: 564, y: 391, f: 9.5 },
  { a: "CA", z: "加州", x: 96, y: 310, f: 11 },
  { a: "HI", z: "夏威夷", x: 329, y: 579, f: 6.8 },
  { a: "IA", z: "爱荷华", x: 540, y: 227, f: 9.5 },
  { a: "KY", z: "肯塔基", x: 694, y: 323, f: 9.5 },
  { a: "MD", z: "马里兰", x: 828, y: 260, f: 6.8 },
  { a: "MI", z: "密歇根", x: 680, y: 193, f: 9.5 },
  { a: "MS", z: "密西西比", x: 618, y: 438, f: 9.5 },
  { a: "MT", z: "蒙大拿", x: 287, y: 100, f: 11 },
  { a: "NH", z: "新罕布什尔", x: 893, y: 140, f: 6.8 },
  { a: "NY", z: "纽约州", x: 816, y: 166, f: 9.5 },
  { a: "OH", z: "俄亥俄", x: 724, y: 253, f: 9.5 },
  { a: "OR", z: "俄勒冈", x: 103, y: 134, f: 11 },
  { a: "TN", z: "田纳西", x: 676, y: 361, f: 9.5 },
  { a: "UT", z: "犹他", x: 227, y: 269, f: 11 },
  { a: "VA", z: "弗吉尼亚", x: 809, y: 308, f: 9.5 },
  { a: "WA", z: "华盛顿州", x: 124, y: 59, f: 9.5 },
  { a: "WI", z: "威斯康星", x: 595, y: 167, f: 9.5 },
  { a: "NE", z: "内布拉斯加", x: 434, y: 239, f: 9.5 },
  { a: "SC", z: "南卡", x: 779, y: 392, f: 8 },
  { a: "ID", z: "爱达荷", x: 199, y: 157, f: 9.5 },
  { a: "NV", z: "内华达", x: 142, y: 252, f: 11 },
  { a: "VT", z: "佛蒙特", x: 873, y: 136, f: 6.8 },
  { a: "LA", z: "路易斯安那", x: 568, y: 478, f: 9.5 },
];

/** 16 个主要城市（恒显）。 */
export const CITY_LABELS: readonly CityLabel[] = [
  { zh: "纽约", en: "New York", x: 869.7, y: 215.7 },
  { zh: "波士顿", en: "Boston", x: 908.7, y: 167.1 },
  { zh: "费城", en: "Philadelphia", x: 854.2, y: 237.1 },
  { zh: "华盛顿", en: "Washington D.C.", x: 827.4, y: 267.3 },
  { zh: "亚特兰大", en: "Atlanta", x: 714.9, y: 405.1 },
  { zh: "迈阿密", en: "Miami", x: 822.8, y: 572.6 },
  { zh: "芝加哥", en: "Chicago", x: 638.2, y: 226.1 },
  { zh: "达拉斯", en: "Dallas", x: 482.9, y: 440.5 },
  { zh: "休斯敦", en: "Houston", x: 510.4, y: 509.2 },
  { zh: "丹佛", en: "Denver", x: 342.9, y: 273.9 },
  { zh: "洛杉矶", en: "Los Angeles", x: 86.9, y: 363.2 },
  { zh: "旧金山", en: "San Francisco", x: 34.8, y: 261.5 },
  { zh: "西雅图", en: "Seattle", x: 97.7, y: 46.2 },
  { zh: "凤凰城", en: "Phoenix", x: 197.3, y: 399.7 },
  { zh: "明尼阿波利斯", en: "Minneapolis", x: 541.8, y: 161 },
  { zh: "圣路易斯", en: "St. Louis", x: 599.8, y: 303.5 },
];

/** 5 个海陆标注（恒显）。`land` 为真表示陆地邻国（加拿大 / 墨西哥）。 */
export const GEO_LABELS: readonly GeoLabel[] = [
  { x: 490, y: 34, zh: "加 拿 大", en: "C A N A D A", land: true, f: 13 },
  { x: 520, y: 586, zh: "墨 西 哥", en: "M E X I C O", land: true, f: 12 },
  { x: 928, y: 428, zh: "大 西 洋", en: "ATLANTIC", land: false, f: 11 },
  { x: 57, y: 250, zh: "太 平 洋", en: "PACIFIC", land: false, f: 11 },
  { x: 640, y: 568, zh: "墨西哥湾", en: "GULF OF MEXICO", land: false, f: 10 },
];
