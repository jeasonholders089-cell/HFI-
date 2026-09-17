/**
 * 院校坐标产物构建（docs/11 §2.4 / §2.5 / §2.6）：
 *   data/university-coords.csv（+ 人工覆盖表）→ src/lib/university-coords.ts
 *
 * 四道闸，任何一道不过就**保持退出码 1 且不覆盖旧产物**：
 *   闸 1  表头与 COORD_COLUMNS 六列完全一致（多一列少一列都拦）
 *   闸 2  逐行类型可解析；lat/lng 在合法区间且非空；st 两位字母；unitid 唯一
 *   闸 3  行数量级 2000–3500（防上游换版本或筛选条件写错导致产物变空）
 *   闸 4  产物只含数据与类型，不 import 任何运行时依赖
 *
 * 人工覆盖表里的 name_en 在坐标表里解析不到、或命中不唯一 → 直接失败，
 * 不允许静默跳过（docs/11 §2.3）。
 *
 * 运行：pnpm build:coords
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { COORD_COLUMNS, SOURCE_URL, SOURCE_VERSION } from "./extract-university-coords";
import { normalizeName } from "../lib/school-locate";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..");

const SRC = path.resolve(
  process.env.UNIVERSITY_COORDS_CSV ?? path.join(REPO, "data", "university-coords.csv"),
);
const OVERRIDES_SRC = path.resolve(
  process.env.UNIVERSITY_COORDS_OVERRIDES ??
    path.join(REPO, "data", "university-coords.overrides.json"),
);
const OUT = path.resolve(
  process.env.UNIVERSITY_COORDS_OUT ?? path.join(REPO, "src", "lib", "university-coords.ts"),
);

const MIN_ROWS = 2000;
const MAX_ROWS = 3500;

type Override = { match: string; name_en: string; reason: string; source: string };
type Row = [string, string, string, number, number];

/* ---------------------------- CSV 解析 ---------------------------- */

/** RFC4180 风格解析：支持双引号包裹、内部引号翻倍。 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (c !== "\r") cell += c;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

function fail(code: number, message: string): never {
  console.error(message);
  process.exit(code);
}

/* ------------------------------- 主流程 ------------------------------- */

function main() {
  if (!fs.existsSync(SRC)) fail(1, `找不到 ${SRC}（闸 0）——先跑 pnpm build:extract-coords`);
  if (!fs.existsSync(OVERRIDES_SRC)) fail(1, `找不到人工覆盖表 ${OVERRIDES_SRC}（闸 0）`);

  // —— 闸 1：表头六列完全一致 ——
  const table = parseCsv(fs.readFileSync(SRC, "utf8"));
  if (table.length < 2) fail(1, "坐标表为空或只有表头（闸 1）");
  const header = table[0];
  const sameHeader =
    header.length === COORD_COLUMNS.length && header.every((h, i) => h === COORD_COLUMNS[i]);
  if (!sameHeader) {
    const missing = COORD_COLUMNS.filter((c) => !header.includes(c));
    const extra = header.filter((h) => !(COORD_COLUMNS as readonly string[]).includes(h));
    console.error("表头与约定不一致，构建中止（闸 1）");
    if (missing.length) console.error("  缺少列：" + missing.join(", "));
    if (extra.length) console.error("  多出列：" + extra.join(", "));
    if (!missing.length && !extra.length) console.error("  列名相同但顺序不一致");
    process.exit(1);
  }

  // —— 闸 2：逐行校验 ——
  const problems: string[] = [];
  const rows: Row[] = [];
  const seenUnit = new Set<string>();
  table.slice(1).forEach((cells, i) => {
    const lineNo = i + 2;
    if (cells.length !== COORD_COLUMNS.length) {
      problems.push(`  第 ${lineNo} 行：列数 ${cells.length}，期望 ${COORD_COLUMNS.length}`);
      return;
    }
    const [unitid, name, city, st, latRaw, lngRaw] = cells;
    if (!unitid.trim()) problems.push(`  第 ${lineNo} 行：unitid 为空`);
    else if (seenUnit.has(unitid)) problems.push(`  第 ${lineNo} 行：unitid 重复 ${unitid}`);
    else seenUnit.add(unitid);
    if (!name.trim()) problems.push(`  第 ${lineNo} 行：name_en 为空`);
    if (!city.trim()) problems.push(`  第 ${lineNo} 行：city 为空`);
    if (!/^[A-Z]{2}$/.test(st)) problems.push(`  第 ${lineNo} 行：st 不是两位大写字母（${st}）`);
    if (!latRaw.trim() || !lngRaw.trim()) problems.push(`  第 ${lineNo} 行：lat/lng 为空`);
    const lat = Number(latRaw);
    const lng = Number(lngRaw);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90)
      problems.push(`  第 ${lineNo} 行：lat 越界（${latRaw}）`);
    if (!Number.isFinite(lng) || lng < -180 || lng > 180)
      problems.push(`  第 ${lineNo} 行：lng 越界（${lngRaw}）`);
    if (problems.length > 40) return;
    rows.push([name, city, st, lat, lng]);
  });
  if (problems.length) {
    console.error("逐行校验失败，构建中止（闸 2）\n" + problems.slice(0, 40).join("\n"));
    process.exit(1);
  }

  // —— 闸 3：行数量级 ——
  if (rows.length < MIN_ROWS || rows.length > MAX_ROWS) {
    console.error(
      `行数 ${rows.length} 不在 ${MIN_ROWS}–${MAX_ROWS} 之间，构建中止（闸 3）——` +
        "上游换版本或筛选条件写错了？",
    );
    process.exit(1);
  }

  // —— 人工覆盖表：name_en 必须唯一解析到一行，否则失败 ——
  let overridesRaw: unknown;
  try {
    overridesRaw = JSON.parse(fs.readFileSync(OVERRIDES_SRC, "utf8"));
  } catch (e) {
    fail(1, `人工覆盖表不是合法 JSON：${e instanceof Error ? e.message : e}`);
  }
  if (!Array.isArray(overridesRaw)) fail(1, "人工覆盖表必须是数组");
  const overrides: Record<string, Row> = {};
  for (const raw of overridesRaw as Override[]) {
    for (const field of ["match", "name_en", "reason", "source"] as const) {
      if (typeof raw?.[field] !== "string" || !raw[field].trim())
        fail(1, `人工覆盖表每条都必须有非空的 ${field}：${JSON.stringify(raw)}`);
    }
    const key = normalizeName(raw.name_en);
    const hits = rows.filter((r) => normalizeName(r[0]) === key);
    if (hits.length !== 1) {
      fail(
        1,
        `人工覆盖表里的 name_en「${raw.name_en}」在坐标表里命中 ${hits.length} 条（要求恰好 1 条）：` +
          hits.map((h) => h[0]).join(" / "),
      );
    }
    if (overrides[raw.match]) fail(1, `人工覆盖表的 match「${raw.match}」重复`);
    overrides[raw.match] = hits[0];
    console.log(`人工覆盖：${raw.match} → ${hits[0][0]}（${hits[0][1]}, ${hits[0][2]}）`);
  }

  // —— 产物 ——
  const body = rows.map((r) => JSON.stringify(r)).join(",\n  ");
  const overrideBody = Object.entries(overrides)
    .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`)
    .join(",\n");
  const file = `// 本文件由 scripts/build-coords.ts 生成，请勿手改。
// 源：data/university-coords.csv（${rows.length} 行 × ${COORD_COLUMNS.length} 列）
// 来源、版本与提取条件见 data/university-coords-SOURCE.md

/** 坐标表的元信息：追溯用，不参与匹配。 */
export const COORD_SOURCE = {
  url: ${JSON.stringify(SOURCE_URL)},
  version: ${JSON.stringify(SOURCE_VERSION)},
  count: ${rows.length},
} as const;

/** [name_en, city, st, lat, lng] —— 元组形式是为了压体积。 */
export type CoordRow = readonly [string, string, string, number, number];

export const COORD_ROWS: CoordRow[] = [
  ${body},
];

/**
 * 人工覆盖表：键是别名表的规范中文名（匹配管线第 ① 级的上游产物）。
 * 每条都带 reason 与 source，见 data/university-coords.overrides.json。
 */
export const COORD_OVERRIDES: Record<string, CoordRow> = {
${overrideBody}
};
`;

  // —— 闸 4：产物不 import 任何东西 ——
  if (/^\s*import\b/m.test(file)) {
    console.error("产物里出现了 import，构建中止（闸 4）——它必须是纯数据 + 类型");
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, file, "utf8");
  console.log(`闸 1/2/3/4 通过：六列一致、逐行合法、${rows.length} 行、产物零 import`);
  console.log(`已写出 ${OUT}（${(file.length / 1024).toFixed(0)} KB）`);
}

main();
