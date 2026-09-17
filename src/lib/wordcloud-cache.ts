/**
 * 词云的落库缓存（docs/10 §3.8）。
 *
 * 为什么必须缓存：词云是**每次现调 AI 算**的，而模型每次给的词都不一样（实测三次三套词）。
 * 不缓存的话有两个真实问题：
 *   1. 大屏刷新一次词云就没了——家长正看着的那块变成"尚未生成"；
 *   2. 谁手一抖再点一次「生成」，整屏的词全变，看起来像系统坏了。
 * 缓存之后：**生成一次，一直显示**；点「生成」才覆盖。
 *
 * 存哪：`app_meta`（key/value 表，schema 里本来就有、此前没被用过）——**零迁移**。
 * 键按场次隔离：`wordcloud:2026-09-17` / `wordcloud:all`，切场次看各自那份。
 */
import { eq } from "drizzle-orm";

import { appMeta } from "@/db/schema";
import { getDb } from "./db";

export type WordCloudGroup = { word: string; count: number };

export type WordCloud = {
  groups: WordCloudGroup[];
  total: number;
  generatedAt: string;
  /** AI 用哪个模型生成的（便于排查） */
  model?: string;
};

/**
 * 缓存键。`date` 传 `null` 表示"全部场次"。
 *
 * 做成纯函数是为了能单测：键写错会导致"切换场次看到的还是上一场的词"，
 * 而这种错误在界面上看不出来（词都在，只是不对）。
 */
export function wordcloudKey(date: string | null): string {
  return date ? `wordcloud:${date}` : "wordcloud:all";
}

/** 读缓存；没有、或格式不对 → null（调用方按"尚未生成"处理）。 */
export async function readWordCloud(date: string | null): Promise<WordCloud | null> {
  const rows = await getDb().select({ value: appMeta.value }).from(appMeta).where(eq(appMeta.key, wordcloudKey(date)));
  const raw = rows[0]?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as WordCloud;
    if (!Array.isArray(parsed.groups)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** 写缓存（同一场次覆盖上一次的）。 */
export async function writeWordCloud(date: string | null, cloud: WordCloud): Promise<void> {
  const key = wordcloudKey(date);
  const value = JSON.stringify(cloud);
  await getDb()
    .insert(appMeta)
    .values({ key, value })
    .onConflictDoUpdate({ target: appMeta.key, set: { value } });
}
