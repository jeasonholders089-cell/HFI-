/**
 * 数据值的中英取词 —— 纯函数（docs/08 §6.15）。
 *
 * 分工：
 *   - 界面文案（按钮、表头、说明）走 colleges-i18n.ts 的词条表，组件里用 useT()；
 *   - 数据值（校名、枚举、日期、单位）走这里 —— 它要按 College 记录取值，
 *     不是一句静态文案。
 *
 * 单语字段（essays / idef_t / ivw_t）源数据只有中文，英文模式下照原样显示中文，
 * 由调用方在节里补一行说明（t("zhOnly.section")）—— 不藏着（§6.15）。
 */
import type { College } from "./colleges-data";
import {
  blankName,
  formatField,
  formatGenderRatio,
  formatPercent,
  type FieldKind,
} from "./colleges-format";
import { t, type Lang } from "./colleges-i18n";

export type { Lang };

/** 双语字段取值：英文模式取 en，缺英文回落中文；中文模式只认 zh。 */
export function pair(zh: string | null | undefined, en: string | null | undefined, lang: Lang): string {
  if (lang === "en") return (en ?? "").trim() || (zh ?? "");
  return zh ?? "";
}

/** 主校名（按语言）。 */
export function nameOf(c: College, lang: Lang): string {
  return lang === "en" ? c.en : c.zh;
}

/** 副校名（另一语种）；与主名相同时返回空串，避免重复渲染。 */
export function subNameOf(c: College, lang: Lang): string {
  const main = nameOf(c, lang);
  const other = lang === "en" ? c.zh : c.en;
  return other === main ? "" : other;
}

/** 院校类型（长文案）。 */
export function typeName(c: College, lang: Lang): string {
  if (c.type === "lac") return t(lang, "data.typeLac");
  return t(lang, c.pub === 1 ? "data.typeUniPub" : "data.typeUniPri");
}

/** 院校类型（图例 / 悬停里的短文案）。 */
export function typeShort(c: College, lang: Lang): string {
  if (c.type === "lac") return t(lang, "data.typeShortLac");
  return t(lang, c.pub === 1 ? "data.typeShortPub" : "data.typeShortPri");
}

/** 榜单名。 */
export function rankListName(c: College, lang: Lang): string {
  return t(lang, c.type === "uni" ? "data.rankUni" : "data.rankLac");
}

export function testName(code: College["test"], lang: Lang, short = false): string {
  return t(lang, `data.${short ? "testShort" : "test"}.${code}` as Parameters<typeof t>[1]);
}

export function ivwName(code: College["ivw_c"], lang: Lang, short = false): string {
  const key = code ?? "unv";
  return t(lang, `data.${short ? "ivwShort" : "ivw"}.${key}` as Parameters<typeof t>[1]);
}

export function idefName(code: College["idef_c"], lang: Lang, short = false): string {
  const key = code ?? "id";
  return t(lang, `data.${short ? "idefShort" : "idef"}.${key}` as Parameters<typeof t>[1]);
}

/** 男女比：女校是特例，渲染成文字而不是塞进比例位置（§3.6）。 */
export const genderName = formatGenderRatio;

/**
 * 数据值格式化：在 `formatField` 之上再过一道术语转换（§6.15）。
 * 中文模式下 termText 原样返回，所以这里等价于 `formatField`。
 */
export function formatFieldL(v: unknown, kind: FieldKind = "text", lang: Lang = "zh"): string {
  const raw = kind === "percent" ? formatPercent(v as string | null, lang) : formatField(v, kind, lang);
  return lang === "en" ? termText(raw, lang) : raw;
}

export { blankName };

const MONTH_EN = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

/** 逐词替换表：源数据里的固定说法到英文。顺序有意义（长的先替）。 */
const TERMS: readonly (readonly [string, string])[] = [
  ["无硬性线", "No hard minimum"],
  ["未设线", "No minimum"],
  ["未公布", "Not published"],
  ["见官网", "See school site"],
  ["无早申", "No early round"],
  ["可自愿提交", "optional"],
  ["自愿提交", "self-report optional"],
  ["CDS推算", "CDS-derived"],
  ["推算值", "derived"],
  ["推算", "derived"],
  ["录取者", "admitted"],
  ["加权", "weighted"],
  ["其后未公布", "not published since"],
  ["建议", "rec. "],
  ["月初", "early "],
  ["月中旬", "mid-"],
  ["月底", "late "],
  ["女校", "Women's college"],
  ["单轮申请", "single round"],
  ["不参与主榜", "not ranked in the main table"],
  ["（", " ("],
  ["）", ")"],
];

/**
 * 短数据值的术语转换（校名以外的字段）。中文模式原样返回。
 * 目的很窄：让 `27.3%(CDS推算)` / `4.22(加权)` / `90(建议100)` 这类值在英文模式下也能读。
 */
export function termText(s: string, lang: Lang): string {
  if (lang !== "en") return s;
  // 半角括号前补空格：`90(建议100)` → `90 (rec. 100)`。
  // URL 不经过这里（idef_src / ivw_src 单独渲染），所以不会改到路径。
  const out0 = s.replace(/(?<=[^\s(])(\()/g, " (");
  // 「2028届」这种写法换成 class of，并把年份后的连接词断开
  const out1 = out0.replace(/(\d{4})届/g, (_m, y: string) => `class of ${y} `);
  let out = out1;
  for (const [zh, en] of TERMS) out = out.split(zh).join(en);
  return out.replace(/\s{2,}/g, " ").replace(/\s+\)/g, ")").trim();
}

/**
 * 日期术语转换（§6.15）。中文模式原样返回；英文模式把「N月M日」换成 Nov 1，
 * 括号内的批次缩写（REA / ED1 / SCEA）本身就是术语，保持不动。
 */
export function dateTerm(s: string | null | undefined, lang: Lang): string {
  if (s === null || s === undefined || s.trim() === "") return t(lang, "data.na");
  if (lang === "zh") return s;

  let out = s.replace(/(\d{1,2})月(\d{1,2})日/g, (m, mo: string, d: string) => {
    const i = Number(mo);
    return i >= 1 && i <= 12 ? `${MONTH_EN[i - 1]} ${Number(d)}` : m;
  });
  out = out.replace(/(\d{1,2})月(?!\d)/g, (m, mo: string) => {
    const i = Number(mo);
    return i >= 1 && i <= 12 ? MONTH_EN[i - 1] : m;
  });
  return termText(out, lang);
}

/** 申请批次：roundsArr 里全是 ED0 / EA / ED1 / ED2 / RD 这类术语，两语通用。 */
export function roundsText(c: College, sep = " / "): string {
  return c.roundsArr.join(sep);
}

/** 截止日期一栏（早申 / RD）。 */
export function deadlineText(c: College, lang: Lang, short = false): string {
  const early =
    c.ea ?? (c.singleRound ? t(lang, short ? "data.noEarlyShort" : "data.noEarly") : t(lang, "data.dash"));
  return `${dateTerm(early, lang)} / ${dateTerm(c.rdd, lang)}`;
}

/** 申请人数：0 要显示成 0，不能显示成「未公布」（§3.6）。 */
export function applicantsText(c: College, lang: Lang): string {
  if (c.apps === null || c.apps === undefined) return t(lang, "data.na");
  return t(lang, "data.people", { n: c.apps.toLocaleString(lang === "en" ? "en-US" : "zh-CN") });
}

/** 早申杠杆（早申录取率 ÷ RD 录取率）的展示。 */
export function leverText(c: College, lang: Lang): string {
  return c.lever === null ? t(lang, "data.dash") : `${c.lever.toFixed(1)}×`;
}
