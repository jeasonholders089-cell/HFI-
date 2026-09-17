/**
 * 院校坐标提取（一次性脚本，docs/11 §2.4 / §2.1）：
 *   College Scorecard 的 `Most-Recent-Cohorts-Institution.csv`
 *     →  data/university-coords.csv（六列：unitid,name_en,city,st,lat,lng）
 *
 * 筛选条件写死在这里，并在产物同目录的 SOURCE.md 里注明：
 *   ICLEVEL = 1（4 年制） AND MAIN = 1（主校区）
 *
 * 这份 CSV 是「人工可复核的原始层」——名字不做任何清洗，清洗放在匹配层
 * （lib/school-locate.ts）。它不参与日常构建，`pnpm build:coords` 只读它。
 *
 * 运行：
 *   pnpm build:extract-coords
 * 找不到源文件时会打印「下载 / 解压 / 重跑」三条命令，脚本自己**不下载**
 * （网络与解压工具交给环境）。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.resolve(HERE, "..");
const REPO = path.resolve(SRC_ROOT, "..");

/** 数据源版本与链接（随 Scorecard 发布更新，重跑时从数据页取当前链接）。 */
export const SOURCE_URL =
  "https://ed-public-download.scorecard.network/downloads/Most-Recent-Cohorts-Institution_06102026.zip";
export const SOURCE_PAGE = "https://collegescorecard.ed.gov/data/";
export const SOURCE_VERSION = "2026-06-10";

/** 六个输出列，顺序即产物表头（build-coords 的闸 1 就是拿它比对）。 */
export const COORD_COLUMNS = ["unitid", "name_en", "city", "st", "lat", "lng"] as const;

/** 源 CSV 里我们需要的列。缺任何一列直接失败，不做猜测。 */
export const SOURCE_COLUMNS = {
  unitid: "UNITID",
  name_en: "INSTNM",
  city: "CITY",
  st: "STABBR",
  lat: "LATITUDE",
  lng: "LONGITUDE",
  iclevel: "ICLEVEL",
  main: "MAIN",
} as const;

const DEFAULT_CSV = path.join(REPO, "tmp", "scorecard", "out", "Most-Recent-Cohorts-Institution.csv");
const ALT_CSV = path.join(REPO, "tmp", "Most-Recent-Cohorts-Institution.csv");

export function resolveSourceCsv(): string | null {
  const candidates = [
    process.env.SCORECARD_CSV,
    DEFAULT_CSV,
    ALT_CSV,
  ].filter((x): x is string => Boolean(x));
  for (const c of candidates) {
    const p = path.resolve(c);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function missingSourceMessage(): string {
  return [
    "找不到 Scorecard 的 Most-Recent-Cohorts-Institution.csv。先把数据准备好再重跑：",
    "",
    `  1. 下载  ${SOURCE_URL}`,
    "  2. 解压  Expand-Archive tmp/scorecard/institution.zip -DestinationPath tmp/scorecard/out -Force",
    "  3. 重跑  pnpm build:extract-coords",
    "",
    `  解压后的文件放这两个位置之一即可：${DEFAULT_CSV}（推荐）或 ${ALT_CSV}；`,
    "  也可以用 SCORECARD_CSV=<路径> 指定。",
    `  当前链接取自 ${SOURCE_PAGE}（版本 ${SOURCE_VERSION}）。`,
  ].join("\n");
}

/* ---------------------------- 流式 CSV 解析 ---------------------------- */

/**
 * 源文件 100MB / 3308 列 / 每格都可能带引号与逗号，整段读进内存在 Node 里
 * 会顶到默认堆上限，所以按块读、边读边吐行。
 *
 * 双引号翻倍（`""` → `"`）有可能被切在两块之间，用一个 pending 标志兜住。
 */
export async function* readCsvRows(file: string): AsyncGenerator<string[]> {
  const stream = fs.createReadStream(file, { encoding: "utf8", highWaterMark: 1 << 20 });
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let pendingQuote = false;
  let any = false;

  for await (const chunk of stream as AsyncIterable<string>) {
    const n = chunk.length;
    let i = 0;
    let start = 0;
    while (i < n) {
      const c = chunk[i];
      if (pendingQuote) {
        pendingQuote = false;
        if (c === '"') {
          // 跨块的 `""`：一个字面量引号，仍在引号段内
          cell += '"';
          i++;
          start = i;
          continue;
        }
        quoted = false; // 引号段结束，当前字符按普通字符继续处理
      }
      if (quoted) {
        if (c === '"') {
          cell += chunk.slice(start, i);
          i++;
          if (i < n) {
            if (chunk[i] === '"') {
              cell += '"'; // 翻倍引号 → 一个字面量引号
              i++;
              start = i;
            } else {
              quoted = false;
              start = i;
            }
          } else {
            pendingQuote = true; // 翻倍引号还是段落结束，看下一块的首字符
            start = i;
          }
          continue;
        }
        i++;
      } else if (c === '"') {
        cell += chunk.slice(start, i);
        quoted = true;
        any = true;
        i++;
        start = i;
      } else if (c === ",") {
        cell += chunk.slice(start, i);
        row.push(cell);
        cell = "";
        any = true;
        i++;
        start = i;
      } else if (c === "\n") {
        cell += chunk.slice(start, i);
        row.push(cell);
        yield row;
        row = [];
        cell = "";
        any = false;
        i++;
        start = i;
      } else if (c === "\r") {
        cell += chunk.slice(start, i);
        i++;
        start = i;
      } else {
        any = true;
        i++;
      }
    }
    cell += chunk.slice(start);
  }
  if (any || cell !== "" || row.length) {
    row.push(cell);
    yield row;
  }
}

/* ------------------------------- 输出 ------------------------------- */

export type CoordRecord = {
  unitid: string;
  name_en: string;
  city: string;
  st: string;
  lat: number;
  lng: number;
};

/** 单元格转义：只在必要时加引号（RFC4180）。 */
export function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(records: readonly CoordRecord[]): string {
  const lines = [COORD_COLUMNS.join(",")];
  for (const r of records) {
    lines.push(
      [
        r.unitid,
        csvCell(r.name_en),
        csvCell(r.city),
        csvCell(r.st),
        r.lat.toFixed(5),
        r.lng.toFixed(5),
      ].join(","),
    );
  }
  return lines.join("\n") + "\n";
}

/** 保留 5 位小数（docs/11 §2.1）：投影误差远小于 0.07px，够用且省体积。 */
export function round5(n: number): number {
  return Math.round(n * 1e5) / 1e5;
}

/* ------------------------------- 主流程 ------------------------------- */

export async function extract(sourceCsv: string): Promise<CoordRecord[]> {
  const iterator = readCsvRows(sourceCsv);
  const first = await iterator.next();
  if (first.done) throw new Error("源 CSV 是空文件");

  const header = first.value.map((h) => h.trim());
  const at: Record<string, number> = {};
  for (const [key, col] of Object.entries(SOURCE_COLUMNS)) {
    const i = header.indexOf(col);
    if (i < 0) {
      throw new Error(
        `源 CSV 缺少列 ${col}（表头共 ${header.length} 列）。Scorecard 换版本了？` +
          `当前链接取自 ${SOURCE_PAGE}，版本 ${SOURCE_VERSION}。`,
      );
    }
    at[key] = i;
  }

  const out: CoordRecord[] = [];
  const seenUnit = new Set<string>();
  let scanned = 0;
  for await (const cells of iterator) {
    if (cells.length === 1 && cells[0] === "") continue;
    scanned++;
    if (cells[at.iclevel]?.trim() !== "1") continue;
    if (cells[at.main]?.trim() !== "1") continue;
    const unitid = (cells[at.unitid] ?? "").trim();
    const name_en = (cells[at.name_en] ?? "").trim();
    const city = (cells[at.city] ?? "").trim();
    const st = (cells[at.st] ?? "").trim();
    const latRaw = (cells[at.lat] ?? "").trim();
    const lngRaw = (cells[at.lng] ?? "").trim();
    if (!unitid || !name_en || !latRaw || !lngRaw) continue;
    const lat = Number(latRaw);
    const lng = Number(lngRaw);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (seenUnit.has(unitid)) continue;
    seenUnit.add(unitid);
    out.push({ unitid, name_en, city, st, lat: round5(lat), lng: round5(lng) });
  }

  // 按 unitid 升序：重建时顺序稳定，产物才可以做「重跑无 diff」的断言
  out.sort((a, b) => (a.unitid < b.unitid ? -1 : a.unitid > b.unitid ? 1 : 0));

  const noCoord = out.filter((r) => !r.lat || !r.lng).length;
  console.log(
    `扫描 ${scanned} 条机构记录 → 4 年制主校区 ${out.length} 所` +
      (noCoord ? `（其中 ${noCoord} 所纬度/经度为 0，需人工复核）` : "（坐标无空值）"),
  );
  return out;
}

export function sourceDoc(records: readonly CoordRecord[]): string {
  return `# 院校坐标表 · 来源与版本

| 项 | 内容 |
| --- | --- |
| 数据源 | College Scorecard（美国教育部）· \`Most-Recent-Cohorts-Institution\` |
| 下载地址 | ${SOURCE_URL} |
| 数据页 | ${SOURCE_PAGE} |
| 版本日期 | ${SOURCE_VERSION} |
| 提取条件 | \`ICLEVEL = 1\`（4 年制） **AND** \`MAIN = 1\`（主校区） |
| 产物 | \`data/university-coords.csv\` —— ${records.length} 行 × 6 列（unitid / name_en / city / st / lat / lng） |
| 提取脚本 | \`src/scripts/extract-university-coords.ts\`（一次性，不参与日常构建） |

## 许可

美国联邦政府公开数据（U.S. Department of Education, College Scorecard）。
公开数据无版权限制，引用时注明来源与版本即可。

## 为什么筛 \`MAIN = 1\`

同一所学校在官方目录里会按校区出现多条（例：\`Pratt Institute-Main\` 与
\`Pratt Manhattan-A Division of Pratt Institute\`）。不过滤会在同一座城市重复打点。
只保留主校区后，4 年制机构剩 ${records.length} 所，坐标无空值。

## 重新生成

\`\`\`
pnpm build:extract-coords   # Scorecard CSV → data/university-coords.csv
pnpm build:coords           # data/university-coords.csv → src/lib/university-coords.ts
\`\`\`

Scorecard 换版本时，先更新 \`src/scripts/extract-university-coords.ts\` 顶部的
\`SOURCE_URL\` / \`SOURCE_VERSION\`，再从 ${SOURCE_PAGE} 取当前链接。
`;
}

async function main() {
  const sourceCsv = resolveSourceCsv();
  if (!sourceCsv) {
    console.error(missingSourceMessage());
    process.exit(1);
  }
  console.log(`源文件：${sourceCsv}`);

  const records = await extract(sourceCsv);
  const csvOut = path.resolve(process.env.COORDS_CSV_OUT ?? path.join(REPO, "data", "university-coords.csv"));
  fs.mkdirSync(path.dirname(csvOut), { recursive: true });
  fs.writeFileSync(csvOut, toCsv(records), "utf8");
  console.log(`已写出 ${csvOut}`);

  const docOut = path.join(path.dirname(csvOut), "university-coords-SOURCE.md");
  fs.writeFileSync(docOut, sourceDoc(records), "utf8");
  console.log(`已写出 ${docOut}`);
}

// 只有被当作脚本直接运行才执行（被测试 import 时不跑）
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
