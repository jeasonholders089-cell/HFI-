/**
 * 底图构建（docs/08 §4.2 / §4.3）：
 *   data/us-states.topo.json  →  lib/us-map-paths.ts
 *   data/us-land.json         →  同一份产物里的邻国陆地与 AK / HI 插图
 *
 * 投影在**构建期**做完，产物是纯字符串 —— 运行时零依赖、整页零网络请求（docs/08 §2.1）。
 *
 * 三层结构（2026-09-17 补，参考实现的同一套分层）：
 *   ① 海洋     —— 渲染侧画一个整块矩形 + 渐变，不在这个脚本里
 *   ② 邻国陆地 —— NEIGHBOR_LAND（加拿大 / 墨西哥 / 古巴 / 巴哈马），平涂
 *   ③ 美国     —— STATE_PATHS（49 条州界）+ US_INSETS（阿拉斯加 / 夏威夷），整组带投影
 *
 * 运行：pnpm build:map
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { project } from "../lib/colleges-project";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..");
const SRC = path.join(REPO, "data", "us-states.topo.json");
const SRC_LAND = path.join(REPO, "data", "us-land.json");
const OUT = path.join(REPO, "src", "lib", "us-map-paths.ts");

/** 视口（与 colleges-project.ts 的 MAP_W / MAP_H 一致）。 */
const VW = 975;
const VH = 610;

/* ------------------------------------------------------------------ *
 * TopoJSON 解码（只实现本文件需要的部分，不引 topojson-client）
 * ------------------------------------------------------------------ */
type Topology = {
  transform?: { scale: [number, number]; translate: [number, number] };
  arcs: number[][][];
  objects: Record<string, { type: string; geometries: Geometry[] }>;
};
type Geometry = { type: string; id?: string; arcs: unknown; properties?: { name?: string } };

/** 解出一条 arc 的绝对坐标序列（已应用 transform 的 delta 还原）。 */
function decodeArcs(topo: Topology): [number, number][][] {
  const { scale, translate } = topo.transform ?? { scale: [1, 1], translate: [0, 0] };
  return topo.arcs.map((arc) => {
    let x = 0;
    let y = 0;
    return arc.map(([dx, dy]) => {
      x += dx;
      y += dy;
      return [x * scale[0] + translate[0], y * scale[1] + translate[1]] as [number, number];
    });
  });
}

/** 按 arc 索引拼出一条环；负索引表示该 arc 反向。 */
function ringOf(arcs: [number, number][][], idxs: number[]): [number, number][] {
  const out: [number, number][] = [];
  for (const i of idxs) {
    const arc = i < 0 ? [...arcs[~i]].reverse() : arcs[i];
    // 相邻 arc 共享端点，跳过重复的第一个点
    for (let k = out.length ? 1 : 0; k < arc.length; k++) out.push(arc[k]);
  }
  return out;
}

/** FIPS → 州缩写（50 州 + DC）。 */
const FIPS_TO_ST: Record<string, string> = {
  "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO", "09": "CT",
  "10": "DE", "11": "DC", "12": "FL", "13": "GA", "15": "HI", "16": "ID", "17": "IL",
  "18": "IN", "19": "IA", "20": "KS", "21": "KY", "22": "LA", "23": "ME", "24": "MD",
  "25": "MA", "26": "MI", "27": "MN", "28": "MS", "29": "MO", "30": "MT", "31": "NE",
  "32": "NV", "33": "NH", "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND",
  "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD",
  "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA", "54": "WV",
  "55": "WI", "56": "WY",
};

/**
 * 不在这批拓扑里画的州：阿拉斯加、夏威夷，以及波多黎各等属地。
 *
 * 理由（2026-09-17 更新）：
 *   1. **113 所院校全部位于这 48 州 + DC 内**（数据实测），AK/HI 一个点都没有；
 *   2. 按本文件的大陆 Albers 投影，AK/HI 会落到画布外 —— 所以它们不走投影，
 *      改用 `US_INSETS` 的**插图区**方案（见下），几何来自 data/us-land.json；
 *   3. 波多黎各等属地一期不画（没有院校、也不在地图叙事的范围内）。
 */
const SKIP_STATES = new Set(["AK", "HI", "PR", "VI", "GU", "AS", "MP"]);

/**
 * 阿拉斯加 / 夏威夷插图区的摆放。
 *
 * 源几何（data/us-land.json，已经是 viewBox 坐标）：
 *   阿拉斯加 bbox = [-57,464]..[202,604]  —— 左边被画布裁掉了，直接用会"看不见左边"
 *   夏威夷   bbox = [216,528]..[332,603]
 *
 * 这里的 `transform` 是 SVG 变换字符串，渲染时套在 `<g>` 上。
 * **不重写路径字符串**：路径里可能有非 M/L 指令，重写容易出错，交给渲染器做变换更稳。
 *
 *   阿拉斯加：右移 57 让最左点落在 x=8，整体缩到 0.86 → 变换后 bbox ≈ [8,462]..[231,582]
 *   夏威夷：  右移 20 避让阿拉斯加 → bbox ≈ [236,528]..[352,603]
 *
 * 两个插图区必须**完全落在画布内且互不相交**，下面有断言。
 */
const INSET_TRANSFORM: Record<string, { transform: string; sx: number; tx: number; ty: number }> = {
  alaska: { transform: "translate(57,63) scale(0.86)", sx: 0.86, tx: 57, ty: 63 },
  hawaii: { transform: "translate(20,0)", sx: 1, tx: 20, ty: 0 },
};

/** 插图的州代码（源数据里的 id 是小写名字，这里映射成州缩写）。 */
const INSET_ST: Record<string, string> = { alaska: "AK", hawaii: "HI" };

/** 邻国陆地：id 与渲染顺序（先画远的，后画近的）。 */
const NEIGHBOR_ORDER = ["canada", "mexico", "bahamas", "cuba"] as const;

/** 路径的包围盒（变换前用一次，变换后再用一次做校验）。 */
function pathBox(d: string, t?: { sx: number; tx: number; ty: number }): {
  minX: number; minY: number; maxX: number; maxY: number;
} {
  const nums = d.match(/-?\d+(?:\.\d+)?/g) ?? [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i + 1 < nums.length; i += 2) {
    const x = Number(nums[i]) * (t?.sx ?? 1) + (t?.tx ?? 0);
    const y = Number(nums[i + 1]) * (t?.sx ?? 1) + (t?.ty ?? 0);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

type LandFile = { paths: { id: string; chars: number; bbox: number[]; d: string }[] };

/** 先做 1 位小数四舍五入，再去掉无意义的尾零，压缩产物体积。 */
function fmt(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

function main() {
  const topo = JSON.parse(fs.readFileSync(SRC, "utf8")) as Topology;
  const arcs = decodeArcs(topo);
  const states = topo.objects.states.geometries;

  const out: { st: string; name: string; d: string }[] = [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const g of states) {
    const fips = String(g.id ?? "");
    const st = FIPS_TO_ST[fips];
    if (!st || SKIP_STATES.has(st)) continue;
    const name = g.properties?.name ?? st;

    // 这批数据里 Polygon 与 MultiPolygon 混着：
    //   MultiPolygon → arcs = [ polygon, ... ]，polygon = [ ring, ... ]，ring = [ arcIndex, ... ]
    //   Polygon      → arcs = [ ring, ... ]
    // 统一成 polygon 数组之后，每个 polygon 取第 0 个 ring（外环）。
    // 只取外环 —— 检查过这批数据里没有需要挖洞的州（湖泊由 neighbor 图层承担）。
    // 层数：ring = number[]（arc 索引列表）；polygon = number[][]（ring 列表）；
    //      polys = number[][][]（polygon 列表）
    const raw = g.arcs as number[][] | number[][][];
    const polys = (g.type === "Polygon" ? [raw] : raw) as number[][][];
    let d = "";
    for (const poly of polys) {
      const ring = ringOf(arcs, poly[0]);
      if (ring.length < 3) continue;
      let started = false;
      for (const [lng, lat] of ring) {
        const [x, y] = project(lat, lng);
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        d += `${started ? "L" : "M"}${fmt(x)},${fmt(y)}`;
        started = true;
      }
      d += "Z";
    }
    if (d) out.push({ st, name, d });
  }

  out.sort((a, b) => a.st.localeCompare(b.st));

  // —— 校验（docs/08 §4.3）——
  if (out.length !== 49) {
    console.error(`州数量不对：期望 49（48 州 + DC），实际 ${out.length}`);
    process.exit(1);
  }
  if (out.some((s) => s.d.length < 20)) {
    console.error("有州的路径为空或过短");
    process.exit(1);
  }

  const totalChars = out.reduce((n, s) => n + s.d.length, 0);
  console.log(`州数量：${out.length}（48 州 + DC）`);
  console.log(`路径总字符：${totalChars}（量级校验 100–150KB）`);
  console.log(`包围盒：x ${minX.toFixed(1)}..${maxX.toFixed(1)}  y ${minY.toFixed(1)}..${maxY.toFixed(1)}`);
  if (minX < -5 || minY < -5 || maxX > 980 || maxY > 615) {
    console.warn("⚠ 有州超出视口 0..975 / 0..610，检查投影参数");
  }

  /* ---------------- 邻国陆地 + AK / HI 插图（data/us-land.json） ---------------- */
  const land = JSON.parse(fs.readFileSync(SRC_LAND, "utf8")) as LandFile;
  const byId = new Map(land.paths.map((p) => [p.id, p]));

  const neighbors = NEIGHBOR_ORDER.map((id) => {
    const p = byId.get(id);
    if (!p) {
      console.error(`data/us-land.json 里缺「${id}」`);
      process.exit(1);
    }
    return { id, d: p.d };
  });

  const insets = Object.keys(INSET_TRANSFORM).map((id) => {
    const p = byId.get(id);
    if (!p) {
      console.error(`data/us-land.json 里缺「${id}」`);
      process.exit(1);
    }
    const t = INSET_TRANSFORM[id];
    const box = pathBox(p.d, t);
    return { st: INSET_ST[id], id, transform: t.transform, d: p.d, box };
  });

  // 断言 1：插图必须完全落在画布内（参考实现里阿拉斯加左边被裁掉了，这里必须修掉）
  for (const ins of insets) {
    if (ins.box.minX < 0 || ins.box.minY < 0 || ins.box.maxX > VW || ins.box.maxY > VH) {
      console.error(
        `${ins.st} 变换后超出画布：bbox=[${ins.box.minX.toFixed(1)},${ins.box.minY.toFixed(1)}]..[${ins.box.maxX.toFixed(1)},${ins.box.maxY.toFixed(1)}]`,
      );
      process.exit(1);
    }
  }

  // 断言 2：两个插图不许重叠（重叠就分不清哪个是哪个）
  const [a0, a1] = insets;
  const overlap =
    a0.box.minX < a1.box.maxX && a1.box.minX < a0.box.maxX && a0.box.minY < a1.box.maxY && a1.box.minY < a0.box.maxY;
  if (overlap) {
    console.error(`${a0.st} 与 ${a1.st} 的插图区重叠，调整 INSET_TRANSFORM`);
    process.exit(1);
  }

  if (neighbors.length !== 4) {
    console.error(`邻国陆地数量不对：期望 4，实际 ${neighbors.length}`);
    process.exit(1);
  }

  console.log(`邻国陆地：${neighbors.map((n) => n.id).join(" / ")}`);
  for (const ins of insets) {
    console.log(
      `${ins.st} 插图：${ins.transform} → bbox=[${ins.box.minX.toFixed(0)},${ins.box.minY.toFixed(0)}]..[${ins.box.maxX.toFixed(0)},${ins.box.maxY.toFixed(0)}]`,
    );
  }

  const file = `// 本文件由 scripts/build-us-map.ts 生成，请勿手改。
// 源：data/us-states.topo.json（us-atlas，ISC 许可，见 data/us-atlas-LICENSE）
//     + data/us-land.json（邻国陆地与 AK / HI 插图，来源见该文件内的 source 字段）
// 投影：Albers 等距圆锥，参数见 scripts/build-us-map.ts 的 PROJECTION
// 视口：0 0 975 610

export type StatePath = { st: string; name: string; d: string };
export type LandPath = { id: string; d: string };
export type InsetPath = { st: string; id: string; transform: string; d: string };

export const MAP_VIEWBOX = "0 0 975 610";

export const STATE_PATHS: StatePath[] = [
${out.map((s) => `  { st: ${JSON.stringify(s.st)}, name: ${JSON.stringify(s.name)}, d: ${JSON.stringify(s.d)} },`).join("\n")}
];

/** 邻国陆地（加拿大 / 墨西哥 / 巴哈马 / 古巴）—— 平涂，压在美国下面。 */
export const NEIGHBOR_LAND: LandPath[] = [
${neighbors.map((n) => `  { id: ${JSON.stringify(n.id)}, d: ${JSON.stringify(n.d)} },`).join("\n")}
];

/** 阿拉斯加 / 夏威夷的插图区 —— 属于美国这一层，跟本土一起带投影。 */
export const US_INSETS: InsetPath[] = [
${insets.map((i) => `  { st: ${JSON.stringify(i.st)}, id: ${JSON.stringify(i.id)}, transform: ${JSON.stringify(i.transform)}, d: ${JSON.stringify(i.d)} },`).join("\n")}
];
`;
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, file, "utf8");
  console.log(`已写出 ${OUT}`);
}

main();
