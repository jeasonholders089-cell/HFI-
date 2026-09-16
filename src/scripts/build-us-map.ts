/**
 * 底图构建（docs/08 §4.2 / §4.3）：
 *   data/us-states.topo.json  →  lib/us-map-paths.ts
 *
 * 投影在**构建期**做完，产物是纯字符串 —— 运行时零依赖、整页零网络请求（docs/08 §2.1）。
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
const OUT = path.join(REPO, "src", "lib", "us-map-paths.ts");

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
 * 不画的州：阿拉斯加、夏威夷，以及波多黎各等属地。
 *
 * 理由（M1 实施记录，与 docs/08 §4.4 的初稿不同）：
 *   1. **113 所院校全部位于这 48 州 + DC 内**（数据实测），AK/HI 一个点都没有；
 *   2. 按本文件的大陆 Albers 投影，AK/HI 会落到画布外；
 *   3. 参考实现其实也画不出它们 —— 它的夏威夷路径 x 从 -57 开始，被视口裁掉一半，
 *      阿拉斯加在画布上不可见。所以"沿用插图区方案"并没有可沿用的东西。
 *   若将来要在 AK/HI 打点，需要为这两个州另定一套插图投影，再补这一段的处理。
 */
const SKIP_STATES = new Set(["AK", "HI", "PR", "VI", "GU", "AS", "MP"]);

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

  const file = `// 本文件由 scripts/build-us-map.ts 生成，请勿手改。
// 源：data/us-states.topo.json（us-atlas，ISC 许可，见 data/us-atlas-LICENSE）
// 投影：Albers 等距圆锥，参数见 scripts/build-us-map.ts 的 PROJECTION
// 视口：0 0 975 610

export type StatePath = { st: string; name: string; d: string };

export const MAP_VIEWBOX = "0 0 975 610";

export const STATE_PATHS: StatePath[] = [
${out.map((s) => `  { st: ${JSON.stringify(s.st)}, name: ${JSON.stringify(s.name)}, d: ${JSON.stringify(s.d)} },`).join("\n")}
];
`;
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, file, "utf8");
  console.log(`已写出 ${OUT}`);
}

main();
