/**
 * 选校地图的字段契约 —— 唯一真源（docs/08 §3.2 / §3.5 闸 1）。
 *
 * 纪律：
 *   - 列名、类型、可空、枚举取值**只在这里定义**；
 *   - CSV 读写、构建校验、TypeScript 类型全部由这里派生；
 *   - 改字段先改这个文件，再改 CSV，再跑 `pnpm build:data`。
 *
 * 只在构建期使用（scripts/*.ts）。**客户端不 import 本文件**，
 * 只 import 构建产物 `lib/colleges-data.ts`（纯数据 + 纯类型），
 * 这样 zod 不进客户端 bundle，维持"运行时零依赖"的约束（docs/08 §2.1）。
 */
import { z } from "zod";

/** 空值在 CSV 里写成空字符串，读入后统一转成 null（docs/08 §3.6）。 */
const nullableText = z.string().nullable();
const nullableNum = z.number().nullable();

/** 枚举：申请批次。数据里实际出现 7 种。 */
export const ROUNDS = ["EA", "ED0", "ED1", "ED2", "REA", "EAR", "RD"] as const;

/** 地区 */
export const REGIONS = ["NE", "S", "MW", "W"] as const;

/** 院校类型 */
export const TYPES = ["uni", "lac"] as const;

/** 标化政策 */
export const TEST_POLICIES = ["req", "opt", "flex", "blind"] as const;

/** 国际生认定口径 */
export const IDEF_CODES = ["id", "hs", "both"] as const;

/** 面试政策档位 */
export const IVW_CODES = ["req", "rec", "opt", "inv", "none", "unv"] as const;

/** 第三方面试 */
export const IVW_IV_CODES = ["rec", "acc", "no", "nm"] as const;

/**
 * `data/colleges.csv` 的一行。
 * 顺序即 CSV 的列顺序 —— 构建脚本按这个顺序写表头。
 */
export const CollegeRow = z.object({
  // —— 标识与位置 ——
  en: z.string().min(1), // 英文校名，主键，113 条唯一
  zh: z.string().min(1), // 中文校名
  ab: nullableText, // 别名，竖线分隔（如 MIT）；48 条为空
  city: z.string().min(1),
  st: z.string().length(2), // 州缩写
  lat: z.number(),
  lng: z.number(),

  // —— 分类与排名 ——
  rg: z.enum(REGIONS),
  type: z.enum(TYPES),
  pub: z.union([z.literal(0), z.literal(1)]),
  rank: z.number().int(),
  chg: z.number().int().nullable(), // 0 = 持平，不是缺失
  // QS 排名。**不是纯数字**：排名靠后的学校 QS 给的是区间，如 "791-800"。
  // 实测 9 所是区间、71 所是数字、33 所为空。所以按原文存字符串，
  // 需要数值排序/比较时用派生字段 qsNum（取首个数字）。
  qs: nullableText,

  // —— 录取与标化 ——
  acc: z.string().min(1), // 形如 4.4%
  er: nullableText, // 可能带后缀，如 8.7%(2028届EA,其后未公布)
  rr: nullableText, // 可能带 (CDS推算)
  tr: nullableText,
  apps: nullableNum,
  sat: nullableText, // 形如 1490-1560，也可能非区间
  gpa: nullableText, // 3.96 与 4.22(加权) 混排
  toefl: z.string().min(1), // 原文，含「未设线」等
  ielts: z.string().min(1),
  intl: z.string().min(1), // 形如 13%
  tuition: nullableText, // 形如 $68,454(26-27)
  test: z.enum(TEST_POLICIES),
  rounds: z.string().min(1), // 竖线分隔，如 ED1|ED2|RD
  ea: nullableText, // 截止日期原文，含 (SCEA) 等括注
  rdd: nullableText,
  mf: nullableText, // 50:50；"女校" 是特例

  // —— 政策 ——
  alert: nullableText, // 来源 alert_zh，仅 4 条有
  idef_c: z.enum(IDEF_CODES).nullable(),
  idef_src: nullableText, // 部分缺 https:// 前缀，构建期补全
  ivw_c: z.enum(IVW_CODES).nullable(),
  ivw_al: z.union([z.literal(0), z.literal(1)]).nullable(),
  ivw_iv: z.enum(IVW_IV_CODES).nullable(),
  ivw_src: nullableText,

  // —— 描述性内容（合规决定 A 已撤销，全部保留，见 docs/05 4.6）——
  cz: z.string().min(1), // 区位描述（中）
  ce: z.string().min(1), // 区位描述（英）
  tz: z.string().min(1), // 气质标签（中），竖线分隔
  te: z.string().min(1), // 气质标签（英）
  nz: z.string().min(1), // 一句话点评（中）
  ne: z.string().min(1), // 一句话点评（英）
  essays: z.string().min(1), // JSON 字符串：[{t,w}]；无小文书写 "[]"
  idef_t: nullableText, // 国际生认定说明（学校官网原文）
  ivw_t: nullableText, // 面试政策概括

  // —— 数据来源标注 ——
  cds_src: z.string().min(1), // 形如 CDS 2025-26
});

export type CollegeRow = z.infer<typeof CollegeRow>;

/** CSV 列顺序（= schema 的键顺序，构建脚本据此写表头）。 */
export const COLUMNS = Object.keys(CollegeRow.shape) as (keyof CollegeRow)[];

/** 数值型列 —— 读写 CSV 时要转成 number，其余按字符串处理。 */
export const NUMERIC_COLUMNS: ReadonlySet<string> = new Set([
  "lat",
  "lng",
  "pub",
  "rank",
  "chg",
  "apps",
  "ivw_al",
]);

/** 空字符串 → null（读 CSV 时用）。 */
export function emptyToNull(raw: string): string | null {
  return raw === "" ? null : raw;
}
