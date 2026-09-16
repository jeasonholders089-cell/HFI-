/**
 * 一次性提取（docs/08 §3.7）：
 *   tmp/cmc_data.json                  → data/colleges.csv
 *                                      → data/__fixtures__/reference-xy.json
 *
 * 提取之后这四份文件就是新的真源，源 JSON 不再参与构建。
 * 本脚本保留在仓库里是为了**可追溯**（数据从哪来、怎么映射的），不为了重跑。
 *
 * 运行：pnpm build:extract
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { COLUMNS, CollegeRow, NUMERIC_COLUMNS, type CollegeRow as Row } from "../lib/colleges-schema";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..");
const SRC_JSON = path.join(REPO, "tmp", "cmc_data.json");
const OUT_CSV = path.join(REPO, "data", "colleges.csv");
const OUT_FIXTURE = path.join(REPO, "data", "__fixtures__", "reference-xy.json");

type Source = Record<string, unknown>;

/** 数组 → 竖线分隔；字符串原样；null/undefined → null。 */
function pipe(v: unknown): string | null {
  if (v == null) return null;
  if (Array.isArray(v)) return v.length ? v.join("|") : null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function text(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** CSV 转义：含逗号/引号/换行时用双引号包起来，内部引号翻倍。 */
function csvCell(raw: string): string {
  return /[",\n\r]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
}

function mapRow(s: Source): Row {
  const idef = (s.idef ?? null) as { c?: string; t?: string; s?: string } | null;
  const ivw = (s.ivw ?? null) as { c?: string; al?: unknown; iv?: string; t?: string; s?: string } | null;
  const essays = Array.isArray(s.essays) ? s.essays : [];

  return {
    en: String(s.en).trim(),
    zh: String(s.zh).trim(),
    ab: pipe(s.ab),
    city: String(s.city).trim(),
    st: String(s.st).trim(),
    lat: Number(s.lat),
    lng: Number(s.lng),

    rg: s.rg as Row["rg"],
    type: s.type as Row["type"],
    pub: Number(s.pub) === 1 ? 1 : 0,
    rank: Number(s.rank),
    chg: num(s.chg),
    qs: text(s.qs),

    acc: String(s.acc).trim(),
    er: text(s.er),
    rr: text(s.rr),
    tr: text(s.tr),
    apps: num(s.apps),
    sat: text(s.sat),
    gpa: text(s.gpa),
    toefl: text(s.toefl) ?? "未设线",
    ielts: text(s.ielts) ?? "未设线",
    intl: String(s.intl).trim(),
    tuition: text(s.tuition),
    test: s.test as Row["test"],
    rounds: pipe(s.rounds) ?? "RD",
    ea: text(s.ea),
    rdd: text(s.rdd),
    mf: text(s.mf),

    alert: text(s.alert_zh),
    idef_c: (idef?.c as Row["idef_c"]) ?? null,
    // 部分来源缺 https:// 前缀（如 admission.princeton.edu/faqs）——构建期补全
    idef_src: text(idef?.s),
    ivw_c: (ivw?.c as Row["ivw_c"]) ?? null,
    ivw_al: ivw?.al == null ? null : ivw.al ? 1 : 0,
    ivw_iv: (ivw?.iv as Row["ivw_iv"]) ?? null,
    ivw_src: text(ivw?.s),

    cz: text(s.cz) ?? "",
    ce: text(s.ce) ?? "",
    tz: pipe(s.tz) ?? "",
    te: pipe(s.te) ?? "",
    nz: text(s.nz) ?? "",
    ne: text(s.ne) ?? "",
    essays: JSON.stringify(essays),
    idef_t: text(idef?.t),
    ivw_t: text(ivw?.t),

    cds_src: String(s.cds_src).trim(),
  };
}

function main() {
  const raw = JSON.parse(fs.readFileSync(SRC_JSON, "utf8")) as Source[];
  console.log(`源数据：${raw.length} 条`);

  const rows = raw.map(mapRow);

  // 用 schema 校验每一条；任何一条不合法就整体中止（闸 2 的前置）
  const problems: string[] = [];
  rows.forEach((r, i) => {
    const parsed = CollegeRow.safeParse(r);
    if (!parsed.success) problems.push(`  第 ${i + 1} 条 ${r.en}：${parsed.error.issues.map((x) => `${x.path.join(".")} ${x.message}`).join("; ")}`);
  });
  if (problems.length) {
    console.error("提取失败，以下行不符合 schema：\n" + problems.join("\n"));
    process.exit(1);
  }

  // 写 CSV
  const header = COLUMNS.join(",");
  const body = rows.map((r) =>
    COLUMNS.map((c) => {
      const v = r[c];
      if (v === null || v === undefined) return "";
      return csvCell(String(v));
    }).join(","),
  );
  fs.mkdirSync(path.dirname(OUT_CSV), { recursive: true });
  fs.writeFileSync(OUT_CSV, [header, ...body].join("\n") + "\n", "utf8");
  console.log(`已写出 ${OUT_CSV}（${rows.length} 行 × ${COLUMNS.length} 列）`);

  // 写坐标回归基准
  const fixture = Object.fromEntries(raw.map((s) => [String(s.en), { x: s.x, y: s.y }]));
  fs.mkdirSync(path.dirname(OUT_FIXTURE), { recursive: true });
  fs.writeFileSync(OUT_FIXTURE, JSON.stringify(fixture, null, 1) + "\n", "utf8");
  console.log(`已写出 ${OUT_FIXTURE}（${Object.keys(fixture).length} 条坐标基准）`);

  // 空值统计（供 3.5 闸 3 的基线比对）
  const nullCounts: Record<string, number> = {};
  for (const c of COLUMNS) nullCounts[c] = rows.filter((r) => r[c] === null || r[c] === "").length;
  const notable = Object.entries(nullCounts).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  console.log("\n空值统计：");
  for (const [c, n] of notable) console.log(`  ${c.padEnd(10)} ${n}`);
}

void NUMERIC_COLUMNS; // 保持导出被引用（构建脚本读 CSV 时用）
main();
