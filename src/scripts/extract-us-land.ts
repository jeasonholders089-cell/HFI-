/**
 * 一次性提取（与 `extract-colleges.ts` 同一个套路）：
 *   CMC 会员版 HTML 的 `<svg id="usmap">`  →  data/us-land.json
 *
 * 提取之后 `data/us-land.json` 就是新的真源，桌面上的那份 HTML 不再参与构建。
 * 本脚本留在仓库里是为了**可追溯**（这几条路径从哪来、怎么认出来的），不为了重跑。
 *
 * 运行：pnpm build:land
 *
 * 背景（为什么需要它）：底图原来只有 49 条美国州界，美国以外的区域是空的 ——
 * 陆地与海洋糊成一整块，邻国看不见，阿拉斯加与夏威夷根本没画。
 * 参考实现的底图里除了 49 条州界，还多出 8 条路径，正是我们缺的那几块。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { STATE_PATHS } from "../lib/us-map-paths";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..");
const SRC_HTML =
  process.env.CMC_MAP_HTML ??
  "c:/Users/13353/Desktop/CMC师说-美国大学选校地图_会员版0810.html";
const OUT = path.join(REPO, "data", "us-land.json");

type Box = { minX: number; minY: number; maxX: number; maxY: number };
type Extra = { id: string; d: string; box: Box; chars: number };

/** 取路径的包围盒（只用来认路，不参与渲染）。 */
function bbox(d: string): Box {
  const nums = d.match(/-?\d+(?:\.\d+)?/g) ?? [];
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
  return { minX, minY, maxX, maxY };
}

/**
 * 认路的规则表。**顺序有意义**，每条给出可验证的判定条件，
 * 靠的是包围盒 —— 参考实现那 57 条 `<path>` 全都没有 `id` / `class` / `data-*`，
 * 除了几何位置没有别的信息可用。
 */
const RULES: readonly { id: string; why: string; hit: (b: Box) => boolean }[] = [
  {
    id: "canada",
    why: "从画布上方很远处一直压到美加边境（y 的最大值 ≈ 221）",
    hit: (b) => b.minY < -100 && b.maxY > 100 && b.maxY < 300 && b.maxX - b.minX > 800,
  },
  {
    id: "mexico",
    why: "在德克萨斯/加州以南，从画布左边一直铺到中部并向下延伸出画布",
    hit: (b) => b.minY > 350 && b.maxY > 700 && b.minX < 200 && b.maxX > 600,
  },
  {
    id: "alaska",
    why: "在左下角，横向不超过 x=250（被画布左边裁掉了一部分）",
    hit: (b) => b.maxX < 250 && b.minY > 400 && b.maxX - b.minX > 200,
  },
  {
    id: "hawaii",
    why: "在阿拉斯加右侧、画布下缘的小块群岛",
    hit: (b) => b.minX > 200 && b.maxX < 400 && b.minY > 500,
  },
  {
    id: "cuba",
    why: "佛罗里达以南、基本贴着画布下缘",
    hit: (b) => b.minY > 600 && b.minX > 600 && b.minX < 800 && b.maxX > 700,
  },
  {
    id: "bahamas",
    why: "佛罗里达东南侧的小块岛屿",
    hit: (b) => b.minX > 800 && b.minY > 500 && b.maxY < 620 && b.maxX < 950,
  },
];

/** 明确不要的：完全在画布外的碎片（加勒比的小岛），画上去也看不见。 */
const DROP: readonly { why: string; hit: (b: Box) => boolean }[] = [
  { why: "整块在画布外（x > 975）", hit: (b) => b.minX > 975 },
  { why: "整块在画布下方（y > 610）", hit: (b) => b.minY > 610 },
];

function main() {
  const html = fs.readFileSync(SRC_HTML, "utf8");
  const start = html.indexOf('<svg id="usmap"');
  if (start < 0) {
    console.error("在源 HTML 里找不到 <svg id=\"usmap\">");
    process.exit(1);
  }
  const svg = html.slice(start, html.indexOf("</svg>", start));
  const paths = [...svg.matchAll(/<path\b[^>]*\sd="([^"]*)"/g)].map((m) => m[1]);
  if (paths.length < 50) {
    console.error(`源 SVG 里的 path 数量不对：${paths.length}`);
    process.exit(1);
  }

  // 先排掉美国的 49 个州（bbox 与我们的产物对得上就算州）
  const states = STATE_PATHS.map((s) => {
    const b = bbox(s.d);
    return { st: s.st, cx: (b.minX + b.maxX) / 2, cy: (b.minY + b.maxY) / 2, w: b.maxX - b.minX, h: b.maxY - b.minY };
  });

  const extras: Extra[] = [];
  const dropped: string[] = [];

  for (const d of paths) {
    const b = bbox(d);
    const cx = (b.minX + b.maxX) / 2;
    const cy = (b.minY + b.maxY) / 2;
    const isState = states.some(
      (s) => Math.hypot(s.cx - cx, s.cy - cy) < 6 && Math.abs(s.w - (b.maxX - b.minX)) < 8,
    );
    if (isState) continue;

    const rule = RULES.find((r) => r.hit(b));
    if (rule) {
      extras.push({ id: rule.id, d, box: b, chars: d.length });
      continue;
    }
    const drop = DROP.find((r) => r.hit(b));
    if (drop) {
      dropped.push(`bbox=[${b.minX.toFixed(0)},${b.minY.toFixed(0)}]..[${b.maxX.toFixed(0)},${b.maxY.toFixed(0)}]（${drop.why}）`);
      continue;
    }
    console.error(
      `有一条路径既不是州、也没命中任何规则：bbox=[${b.minX.toFixed(0)},${b.minY.toFixed(0)}]..[${b.maxX.toFixed(0)},${b.maxY.toFixed(0)}]`,
    );
    process.exit(1);
  }

  // 六块必须各命中一次 —— 少了说明规则失效，多了说明规则太宽
  const expected = ["canada", "mexico", "alaska", "hawaii", "cuba", "bahamas"];
  for (const id of expected) {
    const n = extras.filter((e) => e.id === id).length;
    if (n !== 1) {
      console.error(`「${id}」期望命中 1 条，实际 ${n} 条`);
      process.exit(1);
    }
  }
  if (extras.length !== expected.length) {
    console.error(`额外路径总数不对：期望 ${expected.length}，实际 ${extras.length}`);
    process.exit(1);
  }

  const order = new Map(expected.map((id, i) => [id, i]));
  extras.sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99));

  const payload = {
    source: "CMC师说-美国大学选校地图_会员版0810.html（<svg id=\"usmap\"> 的 <path>）",
    projection: "与 src/lib/us-map-paths.ts 同一套（Albers，参数见 colleges-project.ts）",
    viewBox: "0 0 975 610",
    note: "这些路径已经是投影后的 viewBox 坐标，可直接使用；坐标指令为绝对 M/L。",
    paths: extras.map((e) => ({
      id: e.id,
      chars: e.chars,
      bbox: [Math.round(e.box.minX), Math.round(e.box.minY), Math.round(e.box.maxX), Math.round(e.box.maxY)],
      d: e.d,
    })),
  };

  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2), "utf8");
  console.log(`源 path 总数：${paths.length}`);
  console.log(`已识别为州：${paths.length - extras.length - dropped.length}`);
  console.log(`已识别为额外陆地：${extras.length}`);
  for (const e of extras) {
    const rule = RULES.find((r) => r.id === e.id)!;
    console.log(
      `  ${e.id.padEnd(8)} chars=${String(e.chars).padStart(6)} bbox=[${e.box.minX.toFixed(0)},${e.box.minY.toFixed(0)}]..[${e.box.maxX.toFixed(0)},${e.box.maxY.toFixed(0)}]  ← ${rule.why}`,
    );
  }
  console.log(`已丢弃：${dropped.join("; ") || "（无）"}`);
  console.log(`已写出 ${OUT}`);
}

main();
