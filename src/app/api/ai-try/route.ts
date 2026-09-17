import { NextResponse } from "next/server";

import { runInference } from "@/lib/inference";

/**
 * 首页的「AI 试用框」——**搬到服务端跑**（2026-09-17）。
 *
 * 为什么要搬：原来它在浏览器里调 `runInference`，走的是 `NEXT_PUBLIC_INFERENCE_PROXY_URL`
 * 那套公开代理。现在模型通道换成 `.env` 里的 AI98 key（服务端密钥），
 * **key 绝不能进浏览器**，所以这个演示功能必须挪到服务端。
 *
 * `app` 这个名字只对"平台代理"那条通道有意义；走 AI98 时用的是 `AI98_MODEL`。
 */
const APP = "anthropic/claude-haiku-4-5";

const SYSTEM_PROMPT = `你是HFI家长成长营的教育顾问。根据孩子的英文名、梦想学校和回答，输出 JSON：{"directions":[{"name":"方向","reason":"理由","path":"美国体系下的简短路径"}],"traits":["特质1","特质2"]}。只输出JSON。`;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { text?: unknown };
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    if (!text) return NextResponse.json({ error: "请先输入一点内容再试" }, { status: 400 });

    const task = await runInference(APP, { text, system_prompt: SYSTEM_PROMPT });
    const response = (task.output as { response?: string } | null)?.response ?? "";
    if (!response.trim()) return NextResponse.json({ error: "模型没有返回内容，请重试" }, { status: 502 });
    return NextResponse.json({ response });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "试跑失败，请重试" }, { status: 500 });
  }
}
