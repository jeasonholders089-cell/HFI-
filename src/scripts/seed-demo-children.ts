/**
 * 演示数据填充（开发/彩排用，不参与构建）。
 *
 * 为什么需要它：本机没有推理代理（`.env` 里没有 `NEXT_PUBLIC_INFERENCE_PROXY_URL`），
 * 走 `/api/children` 提交只会落库、AI 不会跑，于是大屏上「已分类 = 0」、方向统计全空。
 * 这个脚本直接把 `ai_directions` 一起写进去，模拟"AI 已经分析完"的状态，
 * 这样大屏的每一个区块都有真实量级的内容可看。
 *
 * 用法：
 *   pnpm exec tsx scripts/seed-demo-children.ts                  # 只预览，不写库
 *   pnpm exec tsx scripts/seed-demo-children.ts --yes            # 写入今天的场次
 *   pnpm exec tsx scripts/seed-demo-children.ts --count=60 --yes
 *   pnpm exec tsx scripts/seed-demo-children.ts --clear-today --yes   # 先清掉今天的，再重填
 *
 * 安全闸：
 *   - 没有 `--yes` 一律只打印不写库；
 *   - `DATABASE_URL` 不指向 127.0.0.1 / localhost 时**拒绝执行**（防误打托管库），除非 `--force`；
 *   - `--clear-today` 只删**今天这一场**（按北京时间的日界），不是删全表。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { and, gte, lt } from "drizzle-orm";

import { children } from "../db/schema";
import { getDb } from "../lib/db";
import { CATEGORIES } from "../lib/growth-categories";
import { beijingDayRange, beijingDate } from "../lib/school-session";

/* ------------------------------ 环境变量 ------------------------------ */

/** tsx 脚本不像 Next 那样自动加载 .env，这里手读一次（只补未设置的键）。 */
function loadEnvFile(): void {
  const here = path.dirname(fileURLToPath(import.meta.url));
  for (const file of [path.join(here, "..", ".env"), path.join(here, "..", "..", ".env")]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
      if (!m) continue;
      const [, key, rawValue] = m;
      if (process.env[key] !== undefined) continue;
      process.env[key] = rawValue.replace(/^["']|["']$/g, "");
    }
  }
}

/* ------------------------------ 参数 ------------------------------ */

const args = process.argv.slice(2);
const has = (flag: string) => args.includes(flag);
const num = (flag: string, fallback: number) => {
  const found = args.find((a) => a.startsWith(`${flag}=`));
  const v = found ? Number(found.split("=")[1]) : NaN;
  return Number.isFinite(v) && v > 0 ? v : fallback;
};

const COUNT = num("--count", 48);
const CONFIRMED = has("--yes");
const CLEAR_TODAY = has("--clear-today");
const FORCE = has("--force");

/* ------------------------------ 确定性随机 ------------------------------ */

/** 固定种子的线性同余：同一个种子每次生成同一批数据，演示可复现。 */
let seed = 20260918;
function rnd(): number {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
}
function pick<T>(list: readonly T[]): T {
  return list[Math.floor(rnd() * list.length)];
}
function pickMany<T>(list: readonly T[], n: number): T[] {
  const pool = [...list];
  const out: T[] = [];
  for (let i = 0; i < n && pool.length; i++) out.push(...pool.splice(Math.floor(rnd() * pool.length), 1));
  return out;
}

/* ------------------------------ 语料 ------------------------------ */

const NAMES = [
  "Emma", "Leo", "Mia", "Ethan", "Zoe", "Ryan", "Chloe", "Kevin", "Iris", "Aaron",
  "Nina", "Eric", "Sophie", "Jason", "Luna", "Oscar", "Vivian", "Henry", "Grace", "Daniel",
  "Cindy", "Peter", "Alice", "Sam", "Bella", "Tony", "Dora", "Jerry", "Coco", "Nathan",
  "Eva", "Marcus", "Fiona", "Leon", "Amber", "Victor", "Julia", "Owen", "Selina", "Bruce",
  "Kiki", "Eddie", "Nathan", "Rosie", "Wilbur", "Cathy", "Dylan", "Elsa",
] as const;

const INTERESTS = [
  "绘画与视觉日记", "机器人搭建与编程", "辩论与公众演讲", "篮球", "写小说", "天文学观测",
  "合唱与乐队", "摄影", "编程做小游戏", "历史纪录片", "动植物观察", "数学谜题",
  "志愿服务", "模型制作", "舞蹈", "陶艺", "国际象棋", "化学实验", "爬山与户外", "剪辑视频",
] as const;

const ACTIVITIES = [
  "校辩论队", "机器人社团", "校刊编辑", "篮球队", "戏剧社", "天文社",
  "编程兴趣班", "志愿者协会", "摄影社", "数学竞赛小组", "合唱团", "学生会",
] as const;

const SELF_DESCRIPTIONS = [
  "我喜欢把一个东西拆开看清楚它怎么运转。",
  "我常常把想到的故事写下来，画在旁边。",
  "我不太怕在很多人面前说话。",
  "我喜欢自己安排时间做完一件小事。",
  "我会为了搞懂一个问题查很久的资料。",
  "我喜欢和同学一起把想法做出来。",
  "我对数字和规律有耐心。",
  "我喜欢照顾小动物和植物。",
] as const;

const OBSERVATIONS = [
  "遇到感兴趣的事能连续投入好几个小时。",
  "会主动把课堂上的问题和生活里的现象联系起来。",
  "在小组里常常是那个把大家想法理清楚的人。",
  "对细节很敏感，做完一件事会自己回头检查。",
  "喜欢动手做，不太喜欢只听课。",
  "愿意尝试新东西，失败了也不太受影响。",
] as const;

const CAREERS = ["", "", "", "游戏设计师", "医生", "建筑师", "老师", "软件工程师", "记者", "科研工作者"] as const;

/** 梦想院校池：中文名（113 榜单里的）、英文名、以及**故意不在坐标表里**的几所。 */
const DREAM_SCHOOLS = [
  // 高频
  "斯坦福大学", "麻省理工学院", "哈佛大学", "加州大学伯克利分校", "加州大学洛杉矶分校",
  "纽约大学", "南加州大学", "卡内基梅隆大学", "康奈尔大学", "哥伦比亚大学",
  // 艺术 / 音乐（评审 M6 刚修好的那批）
  "罗德岛设计学院", "帕森斯设计学院", "纽约视觉艺术学院", "伯克利音乐学院", "普瑞特艺术学院",
  "加州艺术学院（CalArts）", "萨凡纳艺术与设计学院", "茱莉亚学院",
  // 文理学院
  "威廉姆斯学院", "阿默斯特学院", "斯沃斯莫尔学院", "波莫纳学院", "韦尔斯利学院",
  "史密斯学院", "瓦萨学院", "布林茅尔学院", "曼荷莲学院", "戴维森学院", "格林内尔学院",
  // 综合
  "杜克大学", "西北大学", "约翰斯·霍普金斯大学", "莱斯大学", "范德堡大学", "圣母大学",
  "密歇根大学安娜堡分校", "伊利诺伊大学厄巴纳-香槟分校", "佐治亚理工学院",
  "德州农工大学", "弗吉尼亚理工", "雪城大学", "杜兰大学", "凯斯西储大学", "威廉玛丽学院",
  // 英文写法（验英文输入也能命中）
  "Stanford University", "MIT", "UCLA", "NYU", "RISD", "UC Berkeley",
  // **故意未收录**：用来演示「另有 N 人次填了暂未收录的院校」
  "牛津大学", "剑桥大学", "东京大学", "多伦多大学", "苏黎世联邦理工学院", "巴布森学院",
] as const;

/** 方向池：8 类各若干条，附权重（越大越常被选中），让大屏的条形有真实的高低差。 */
const DIRECTIONS: { category: (typeof CATEGORIES)[number]; weight: number; items: [string, string][] }[] = [
  {
    category: "数学与计算",
    weight: 22,
    items: [
      ["计算机科学", "Computer Science"],
      ["数据科学", "Data Science"],
      ["应用数学", "Applied Mathematics"],
      ["人工智能", "Artificial Intelligence"],
    ],
  },
  {
    category: "工程与应用",
    weight: 18,
    items: [
      ["机械工程", "Mechanical Engineering"],
      ["电子工程", "Electrical Engineering"],
      ["生物医学工程", "Biomedical Engineering"],
      ["航空航天工程", "Aerospace Engineering"],
      ["建筑设计", "Architecture"],
    ],
  },
  {
    category: "艺术与设计",
    weight: 18,
    items: [
      ["视觉艺术", "Visual Arts"],
      ["工业设计", "Industrial Design"],
      ["交互设计", "Interaction Design"],
      ["音乐表演", "Music Performance"],
      ["影视制作", "Film Production"],
    ],
  },
  {
    category: "自然科学",
    weight: 12,
    items: [
      ["生物学", "Biology"],
      ["化学", "Chemistry"],
      ["物理学", "Physics"],
      ["环境科学", "Environmental Science"],
      ["神经科学", "Neuroscience"],
    ],
  },
  {
    category: "社会科学",
    weight: 12,
    items: [
      ["心理学", "Psychology"],
      ["国际关系", "International Relations"],
      ["社会学", "Sociology"],
      ["公共政策", "Public Policy"],
      ["新闻传播", "Journalism"],
    ],
  },
  {
    category: "商科与管理",
    weight: 10,
    items: [
      ["经济学", "Economics"],
      ["金融", "Finance"],
      ["市场营销", "Marketing"],
      ["创业学", "Entrepreneurship"],
    ],
  },
  {
    category: "人文科学",
    weight: 6,
    items: [
      ["历史学", "History"],
      ["哲学", "Philosophy"],
      ["文学", "Literature"],
      ["语言学", "Linguistics"],
    ],
  },
  {
    category: "健康与公共服务",
    weight: 4,
    items: [
      ["公共卫生", "Public Health"],
      ["护理学", "Nursing"],
      ["教育学", "Education"],
      ["运动科学", "Kinesiology"],
    ],
  },
];

/** 按权重抽 3 个**互不相同**的类别。 */
function pickCategories(n: number) {
  const pool = DIRECTIONS.flatMap((d) => Array<typeof d>(d.weight).fill(d));
  const chosen: typeof DIRECTIONS = [];
  while (chosen.length < n && pool.length) {
    const d = pick(pool);
    if (!chosen.includes(d)) chosen.push(d);
  }
  return chosen;
}

function buildDirections(interests: string): string {
  return JSON.stringify(
    pickCategories(3).map((d) => {
      const [name, nameEn] = pick(d.items);
      return {
        category: d.category,
        name,
        nameEn,
        // 依据必须"引用问卷里的具体回答"，且只描述、不判定（AGENTS.md 第五节）
        reason: `问卷里写到「${interests}」，与${name}常见的训练内容相近，可以作为继续探索的一个方向。`,
      };
    }),
  );
}

/* ------------------------------ 主流程 ------------------------------ */

function main(): void {
  loadEnvFile();
  const dsn = process.env.DATABASE_URL ?? "";
  if (!dsn) {
    console.error("DATABASE_URL 未设置：请在 src/.env 里配好，或先 export 再跑。");
    process.exit(1);
  }
  const isLocal = /@(127\.0\.0\.1|localhost)[:/]/.test(dsn);
  if (!isLocal && !FORCE) {
    console.error(
      "拒绝执行：DATABASE_URL 不指向本机（127.0.0.1 / localhost）。\n" +
        "这个脚本会写入演示数据，只应该跑在本地或沙箱库上。\n" +
        "确实要在远端跑，请显式加 --force。",
    );
    process.exit(1);
  }

  const today = beijingDate();
  const rows = Array.from({ length: Math.min(COUNT, NAMES.length) }, (_, i) => {
    const interests = pick(INTERESTS);
    const dreamCount = 1 + Math.floor(rnd() * 3); // 1–3 所
    return {
      englishName: `${NAMES[i % NAMES.length]}${i >= NAMES.length ? i : ""}`,
      age: 11 + Math.floor(rnd() * 5), // 11–15
      dreamSchool: pickMany(DREAM_SCHOOLS, dreamCount).join("、"),
      interests,
      activities: pick(ACTIVITIES),
      selfDescription: pick(SELF_DESCRIPTIONS),
      parentObservation: pick(OBSERVATIONS),
      dreamCareer: pick(CAREERS),
      aiDirections: buildDirections(interests),
      submissionKey: `demo-${today}-${String(i + 1).padStart(3, "0")}-${seed.toString(36)}`,
    };
  });

  // 场次分布小抄：让人能一眼看出大屏会显示什么
  const schoolCount = new Map<string, number>();
  for (const r of rows) {
    for (const s of String(r.dreamSchool).split("、")) schoolCount.set(s, (schoolCount.get(s) ?? 0) + 1);
  }
  const catCount = new Map<string, number>();
  for (const r of rows) {
    const cats = (JSON.parse(String(r.aiDirections)) as { category: string }[]).map((x) => x.category);
    for (const d of new Set<string>(cats)) {
      catCount.set(d, (catCount.get(d) ?? 0) + 1);
    }
  }

  console.log(`目标库：${dsn.replace(/:[^:@/]+@/, ":***@")}`);
  console.log(`场次：${today}（北京时间）`);
  console.log(`将写入 ${rows.length} 条孩子记录（含 ai_directions，模拟"已分析"）`);
  console.log(`  梦想院校涉及 ${schoolCount.size} 所；其中未收录坐标的写法会进「暂未收录」那行`);
  console.log(`  方向分布：${[...catCount.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(" · ")}`);
  console.log(`  样例：${rows[0].englishName} / ${rows[0].dreamSchool} / ${rows[0].aiDirections.slice(0, 60)}…`);

  if (!CONFIRMED) {
    console.log("\n这是预览。确实要写入，请加 --yes。");
    return;
  }

  void (async () => {
    const db = getDb();
    if (CLEAR_TODAY) {
      const { start, end } = beijingDayRange(today);
      const deleted = await db
        .delete(children)
        .where(and(gte(children.createdAt, start), lt(children.createdAt, end)))
        .returning({ id: children.id });
      console.log(`已清掉今天这一场的 ${deleted.length} 条记录`);
    }
    const inserted = await db.insert(children).values(rows).returning({ id: children.id });
    console.log(`已写入 ${inserted.length} 条`);
    console.log(`打开 /explore 看今天的场次；用「场次」切换器可以回看别的日期。`);
    process.exit(0);
  })().catch((e: unknown) => {
    console.error("写入失败：", e instanceof Error ? e.message : e);
    process.exit(1);
  });
}

main();
