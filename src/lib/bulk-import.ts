/**
 * 批量导入的列名归位与校验（2026-09-18 修：Excel 通道此前实际不可用）。
 *
 * **踩过的坑**：接口原来只认英文键名（englishName / dreamSchool…），
 * 而任何工作人员自己做的 Excel 用的都是中文列名（孩子的英文名 / 梦想学校…）——
 * 结果 12 行每一行都判"全字段缺失"，报错还刷了一屏。**Excel 通道对它的目标用户是坏的。**
 *
 * 这里把中文表头、带括号的表头、以及原英文键都归到内部字段上，并给出**能照着改**的报错。
 */

/** 内部字段（与 children 表一一对应）。 */
export const BULK_FIELDS = [
  "englishName",
  "age",
  "dreamSchool",
  "interests",
  "activities",
  "selfDescription",
  "parentObservation",
  "dreamCareer",
] as const;

export type BulkField = (typeof BULK_FIELDS)[number];
export type BulkRow = Record<BulkField, string>;

/** 每个字段能接受哪些列名（比较时会去掉空格、括号内容、大小写）。 */
const ALIASES: Record<BulkField, readonly string[]> = {
  englishName: ["englishname", "孩子的英文名", "孩子英文名", "英文名", "昵称", "name"],
  age: ["age", "年龄", "孩子年龄"],
  dreamSchool: ["dreamschool", "梦想学校", "梦校", "目标学校", "梦想院校"],
  interests: ["interests", "兴趣", "兴趣爱好", "兴趣特长"],
  activities: ["activities", "喜欢的活动", "活动", "参加的活动", "课外活动"],
  selfDescription: ["selfdescription", "孩子自我描述", "自我描述", "孩子自述", "孩子描述"],
  parentObservation: ["parentobservation", "家长观察", "家长的观察"],
  dreamCareer: ["dreamcareer", "梦想职业", "职业"],
};

/** 必填的 7 项（梦想职业选填）——与 UI 文案、接口报错共用一份定义。 */
export const REQUIRED_FIELDS = BULK_FIELDS.filter((f) => f !== "dreamCareer");

/** 字段 → 用户看得懂的中文（报错与表头提示里用）。 */
export const FIELD_LABEL: Record<BulkField, string> = {
  englishName: "孩子的英文名",
  age: "年龄",
  dreamSchool: "梦想学校",
  interests: "兴趣",
  activities: "喜欢的活动",
  selfDescription: "孩子自我描述",
  parentObservation: "家长观察",
  dreamCareer: "梦想职业（选填）",
};

/**
 * 列名归一：去掉首尾空格、去半角/全角括号里的内容（"梦想职业（选填）" → "梦想职业"）、
 * 去掉所有空格与下划线、转小写。**不**做模糊匹配——宁可报"这个列名不认识"，也不要猜错列。
 */
export function normalizeHeader(raw: string): string {
  return raw
    .trim()
    .replace(/[（(].*?[)）]/g, "")
    .replace(/[\s_\-]/g, "")
    .toLowerCase();
}

/** 建"归一列名 → 内部字段"的查表（导出是为了让测试能断言别名表没有冲突）。 */
export function buildHeaderMap(): Map<string, BulkField> {
  const map = new Map<string, BulkField>();
  for (const field of BULK_FIELDS) {
    for (const alias of ALIASES[field]) {
      const key = normalizeHeader(alias);
      if (!key) continue;
      const exist = map.get(key);
      if (exist && exist !== field) {
        // 别名撞车 = 会把某一列的数据写进另一个字段，属于必须当场发现的配置错误
        throw new Error(`列名别名冲突：「${alias}」同时指向 ${exist} 与 ${field}`);
      }
      map.set(key, field);
    }
  }
  return map;
}

const HEADER_MAP = buildHeaderMap();

/** 一行原始数据（键是 Excel/文本里写的列名） → 内部字段。认不出的列直接忽略。 */
export function normalizeRow(raw: Record<string, unknown>): Partial<BulkRow> {
  const out: Partial<BulkRow> = {};
  for (const [key, value] of Object.entries(raw ?? {})) {
    const field = HEADER_MAP.get(normalizeHeader(key));
    if (!field) continue;
    // 已填过就不覆盖：同一张表里出现两个"英文名"列时，以先出现的为准
    if (out[field] === undefined) out[field] = value == null ? "" : String(value).trim();
  }
  return out;
}

/** 把字段列表翻成一行中文，报错与提示里用。 */
export function fieldList(fields: readonly BulkField[]): string {
  return fields.map((f) => FIELD_LABEL[f]).join("、");
}

/**
 * 导入模板的行（第一行表头 + 两行示例）。
 *
 * 为什么**生成**而不是放一个静态 xlsx 进仓库：表头必须与导入端认的列名**同源**。
 * 静态文件迟早会和字段定义漂移——那时用户下载的模板自己导不进去，是最难查的一类问题。
 * 示例行也是真的能导进去的数据（有单测守着）。
 */
export function templateRows(): string[][] {
  const header = BULK_FIELDS.map((f) => FIELD_LABEL[f]);
  return [
    header,
    [
      "Emma",
      "12",
      "罗德岛设计学院（RISD）",
      "绘画、视觉日记",
      "校刊编辑、绘画社团",
      "我喜欢把想到的故事画下来，会自己记一本视觉日记。",
      "对细节敏感，做完一件作品会自己回头检查好几遍。",
      "插画师",
    ],
    [
      "Leo",
      "14",
      "卡内基梅隆大学",
      "机器人搭建、编程",
      "机器人社团、篮球",
      "我喜欢把一个东西拆开看清楚它怎么运转。",
      "遇到感兴趣的事能连续投入好几个小时，不太需要催。",
      "",
    ],
  ];
}

export type BulkCheck =
  | { ok: true; rows: BulkRow[] }
  | { ok: false; error: string };

/**
 * 校验并整理成入库形状。
 *
 * 关键的一条**报错设计**：如果每一行都缺同样的必填项，那问题在**表头**不在数据——
 * 这时给一句"这些列没对上，第一行应该这样写"，而不是把每行都列一遍。
 * 原来那种报错（截图里刷了一屏"第 N 条数据缺少…"）反而看不出真正的原因。
 */
export function checkBulkRows(rawRows: readonly Record<string, unknown>[]): BulkCheck {
  if (!rawRows.length) return { ok: false, error: "没有可导入的数据" };

  const rows = rawRows.map(normalizeRow);

  // 每行缺的必填项**完全一样**且都不为空缺 → 判定为表头问题
  const missingOf = (r: Partial<BulkRow>) => REQUIRED_FIELDS.filter((f) => !r[f]).join(",");
  const firstMissing = missingOf(rows[0]);
  if (firstMissing && rows.every((r) => missingOf(r) === firstMissing)) {
    const missing = REQUIRED_FIELDS.filter((f) => !rows[0][f]);
    return {
      ok: false,
      error:
        `这些列没读到：${fieldList(missing)}。多半是表头没对上——` +
        `第一行请按这个顺序写：${fieldList(REQUIRED_FIELDS)}、${FIELD_LABEL.dreamCareer}` +
        `（列名里带括号或空格不影响识别）。`,
    };
  }

  const errors: string[] = [];
  rows.forEach((r, i) => {
    const missing = REQUIRED_FIELDS.filter((f) => !r[f]);
    if (missing.length) errors.push(`第 ${i + 1} 条数据缺少：${fieldList(missing)}`);
    else if (!Number.isInteger(Number(r.age)) || Number(r.age) < 1 || Number(r.age) > 100)
      errors.push(`第 ${i + 1} 条数据的年龄应为 1 至 100 的整数`);
  });
  if (errors.length) {
    return { ok: false, error: `${errors.join("；")}。本次尚未导入，请修正后重试（梦想职业为选填）。` };
  }

  return {
    ok: true,
    rows: rows.map((r) => ({
      englishName: r.englishName ?? "",
      age: r.age ?? "",
      dreamSchool: r.dreamSchool ?? "",
      interests: r.interests ?? "",
      activities: r.activities ?? "",
      selfDescription: r.selfDescription ?? "",
      parentObservation: r.parentObservation ?? "",
      dreamCareer: r.dreamCareer ?? "",
    })),
  };
}
