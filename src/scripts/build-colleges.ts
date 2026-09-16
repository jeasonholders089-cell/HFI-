/**
 * 院校数据构建（docs/08 §3.5 的四道闸 / §3.3 派生字段）：
 *   data/colleges.csv  →  lib/colleges-data.ts
 *
 * 四道闸：
 *   闸 2  表头与 schema 列名集合完全一致；每格类型可解析；枚举合法；en 唯一且 113 条
 *   闸 3  派生字段解析覆盖率与基线比对 —— 不一致只告警不阻断（数据会更新）
 *   闸 4  产物只含数据与类型，不含 zod（客户端零依赖）
 *
 * 运行：pnpm build:colleges
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { COLUMNS, CollegeRow, NUMERIC_COLUMNS, emptyToNull, type CollegeRow as Row } from "../lib/colleges-schema";
import { derive } from "../lib/colleges-derive";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..");
// 允许用环境变量覆盖输入输出 —— 7.2 的「故意改错列名必须以退出码 1 失败」
// 这条测试需要把脚本指到一个临时 CSV 上跑。
const SRC = process.env.COLLEGES_CSV ? path.resolve(process.env.COLLEGES_CSV) : path.join(REPO, "data", "colleges.csv");
const OUT = process.env.COLLEGES_OUT ? path.resolve(process.env.COLLEGES_OUT) : path.join(REPO, "src", "lib", "colleges-data.ts");

/** 派生字段的解析覆盖率基线（docs/08 §3.5 闸 3）。不一致只告警。 */
const COVERAGE_BASELINE: Record<string, number> = {
  accNum: 113,
  // sat 有 112 条非空，但其中 9 条是 "test-blind"（加州大学 8 所 + 罗格斯纽瓦克）——
  // 它们本来就没有中位区间，parseSat 返回 null 是正确行为。
  // 所以区间解析的覆盖率是 103，不是 112。M1 实施时更正了这条基线。
  satLo: 103,
  tuitionNum: 96,
  gpaNum: 65,
};

/* ---------------------------- CSV 解析 ---------------------------- */

/** RFC4180 风格解析：支持双引号包裹、内部引号翻倍、字段内换行。 */
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

/* --------------------------- 主流程 --------------------------- */

function main() {
  const text = fs.readFileSync(SRC, "utf8");
  const table = parseCsv(text);
  if (table.length < 2) {
    console.error("CSV 为空或只有表头");
    process.exit(1);
  }

  const header = table[0];
  const body = table.slice(1);

  // —— 闸 2a：列名集合完全一致（不多不少、顺序也一致）——
  const sameSet =
    header.length === COLUMNS.length && header.every((h, i) => h === COLUMNS[i]);
  if (!sameSet) {
    const missing = COLUMNS.filter((c) => !header.includes(c));
    const extra = header.filter((h) => !(COLUMNS as string[]).includes(h));
    console.error("表头与 schema 不一致，构建中止（闸 2）");
    if (missing.length) console.error("  CSV 缺少列：" + missing.join(", "));
    if (extra.length) console.error("  CSV 多出列：" + extra.join(", "));
    if (!missing.length && !extra.length) console.error("  列名相同但顺序不一致");
    process.exit(1);
  }

  // —— 闸 2b/2c：逐格类型解析 + schema 校验 ——
  const problems: string[] = [];
  const rows: Row[] = [];
  body.forEach((cells, i) => {
    const lineNo = i + 2;
    if (cells.length !== COLUMNS.length) {
      problems.push(`  第 ${lineNo} 行：列数 ${cells.length}，期望 ${COLUMNS.length}`);
      return;
    }
    const obj: Record<string, unknown> = {};
    COLUMNS.forEach((c, k) => {
      const raw = cells[k];
      if (NUMERIC_COLUMNS.has(c)) {
        if (raw === "") obj[c] = null;
        else {
          const n = Number(raw);
          if (!Number.isFinite(n)) problems.push(`  第 ${lineNo} 行 ${c}：${JSON.stringify(raw)} 不是数字`);
          obj[c] = n;
        }
      } else {
        obj[c] = emptyToNull(raw);
      }
    });
    const parsed = CollegeRow.safeParse(obj);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((x) => `${x.path.join(".")} ${x.message}`).join("; ");
      problems.push(`  第 ${lineNo} 行：${msg}`);
      return;
    }
    rows.push(parsed.data);
  });

  if (problems.length) {
    console.error("字段校验失败，构建中止（闸 2）\n" + problems.join("\n"));
    process.exit(1);
  }

  // —— 闸 2d：主键唯一 + 条数 ——
  const seen = new Set<string>();
  for (const r of rows) {
    if (seen.has(r.en)) {
      console.error(`主键重复：${r.en}（闸 2）`);
      process.exit(1);
    }
    seen.add(r.en);
  }
  if (rows.length !== 113) {
    console.error(`院校条数不对：期望 113，实际 ${rows.length}（闸 2）`);
    process.exit(1);
  }
  console.log("闸 2 通过：列名集合一致、类型可解析、枚举合法、en 唯一、113 条");

  // —— 派生字段 ——
  // 派生字段全部由 lib/colleges-derive.ts 计算（纯函数，有单独的单测）
  const colleges = rows.map((r) => ({ ...r, ...derive(r) }));

  // —— 闸 3：覆盖率与基线比对（只告警）——
  const coverage: Record<string, number> = {
    accNum: colleges.filter((c) => c.accNum != null).length,
    satLo: colleges.filter((c) => c.satLo != null).length,
    tuitionNum: colleges.filter((c) => c.tuitionNum != null).length,
    gpaNum: colleges.filter((c) => c.gpaNum != null).length,
  };
  console.log("\n派生字段覆盖率（闸 3）：");
  let drift = false;
  for (const [k, base] of Object.entries(COVERAGE_BASELINE)) {
    const now = coverage[k];
    const flag = now === base ? "" : `  ⚠ 基线 ${base}`;
    if (now !== base) drift = true;
    console.log(`  ${k.padEnd(12)} ${now}/113${flag}`);
  }
  for (const k of ["erNum", "rrNum", "trNum", "intlNum", "qsNum", "lever", "ddlNum"]) {
    console.log(`  ${k.padEnd(12)} ${colleges.filter((c) => (c as Record<string, unknown>)[k] != null).length}/113`);
  }
  if (drift) console.warn("⚠ 覆盖率与基线有差异 —— 数据可能已更新，不阻断构建");

  // —— 写产物（闸 4：只有数据与类型，不含 zod）——
  const file = `// 本文件由 scripts/build-colleges.ts 生成，请勿手改。
// 源：data/colleges.csv（113 所 × ${COLUMNS.length} 列）
// 派生字段的算法见 scripts/build-colleges.ts

import type { CollegeRow } from "./colleges-schema";

export type College = CollegeRow & {
  x: number;
  y: number;
  accNum: number | null;
  erNum: number | null;
  rrNum: number | null;
  trNum: number | null;
  intlNum: number | null;
  gpaNum: number | null;
  qsNum: number | null;
  satLo: number | null;
  satHi: number | null;
  tuitionNum: number | null;
  ddlNum: number | null;
  lever: number | null;
  roundsArr: string[];
  typeKey: "uni" | "pub" | "lac";
  singleRound: boolean;
  hasEarly: boolean;
  hasED: boolean;
  hasREA: boolean;
  abList: string[];
};

export const COLLEGES: College[] = ${JSON.stringify(colleges)};
`;
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, file, "utf8");
  console.log(`\n已写出 ${OUT}（${(file.length / 1024).toFixed(0)} KB）`);
}

main();
