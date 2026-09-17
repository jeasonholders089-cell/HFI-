/**
 * 方向分类（8 类，单轴：学科领域）。
 *
 * **这 8 个字符串是数据契约，不是文案**（docs/11 §1.7）：它们会存进数据库
 * （`children.ai_directions` 的 `category`）、写进 AI prompt、渲染成大屏标签，
 * 还决定统计的分桶。因此四个地方必须逐字一致：
 *   `lib/growth-categories.ts` · `app/api/children/analyze/route.ts` 的两处 prompt ·
 *   `docs/10` §2.1/§2.2 · `AGENTS.md` 第六节。
 *
 * **顺序也冻结**：`/api/children/summary` 按这个顺序初始化计数，条形图在人数相同时
 * 也按这个顺序排——顺序变了，大屏上并列的两条会互换位置。
 *
 * 刻意不设的两个桶（理由见 `docs/10` §2.1）：
 *   - **跨学科**：它是「结构属性」不是学科，同一个方向会在不同批次落到不同的桶，
 *     统计不可复现；而这件事方向名自己会说出来（认知科学、神经科学……）；
 *   - **职业**：中文语境里贴着「职校」，大屏上可能被读成降级，而它想覆盖的专业
 *     本来都有明确的学科归属。
 */
export const CATEGORIES = [
  '人文科学',
  '社会科学',
  '商科与管理',
  '自然科学',
  '数学与计算',
  '工程与应用',
  '艺术与设计',
  '健康与公共服务',
] as const;

/**
 * 归类规则（写进 prompt，不得留白）——docs/10 §2.2。
 * 单独抽出来是为了「prompt 与文档逐条对得上」，改一处就改这里。
 */
export const CATEGORY_RULES = [
  '工程、电子、机械、材料、航空航天、建筑 → 工程与应用',
  '纯数学、统计、数据科学、计算机、人工智能 → 数学与计算',
  '偏实现与系统的计算方向 → 工程与应用',
  '商科、金融、管理、市场营销、会计 → 商科与管理',
  '护理、公共卫生、运动科学、教育、社会工作、传媒 → 健康与公共服务',
  '设计（含工业设计、交互设计）→ 艺术与设计',
  '认知科学、神经科学、环境研究这类跨领域项目按其**主要**学科归属，不设「跨学科」桶',
].join('；') + '。';

/** 写进 prompt 的类别枚举（与 CATEGORIES 同源，避免两处各写一份）。 */
export const CATEGORY_ENUM = CATEGORIES.join('、');

export function categorized(raw: string | null) {
 try {const ds=JSON.parse(raw||'[]');return Array.isArray(ds)&&ds.length===3&&ds.every((d:{category?:string})=>CATEGORIES.includes(d.category as typeof CATEGORIES[number]));}catch{return false;}
}
