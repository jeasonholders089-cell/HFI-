/**
 * AI98（OpenAI 兼容）模型通道 —— 与应用原生的 `@inferencesh/sdk` 代理通道并列。
 *
 * 为什么单独一个文件：`@inferencesh/sdk` 的内部子路径导入在 vitest 的 node 环境里解析不了
 * （Next 打包时能处理），把它和纯逻辑混在一起就没法离线测。**这里不 import 那个 SDK**，
 * 于是 `buildChatBody` / `parseChatResponse` / `pickChannel` 这些都能直接单测。
 *
 * 密钥只从环境变量读，永不进代码（AGENTS.md 第七节）。
 */

export type ChatInput = { system_prompt?: string; text?: string };

export type Ai98Config = { baseUrl: string; key: string; model: string };

/** 只依赖"能按键取值"这一件事 —— 这样单测可以直接传一个普通对象，不用伪造整个 process.env。 */
export type EnvLike = Record<string, string | undefined>;

/** 读 AI98 的配置；少任何一项（或没配）都返回 null —— **不拿半套配置去打网络**。 */
export function ai98Config(env: EnvLike = process.env): Ai98Config | null {
  const baseUrl = (env.AI98_BASE_URL ?? "").trim().replace(/\/+$/, "");
  const key = (env.AI98_KEY ?? "").trim();
  if (!baseUrl || !key) return null;
  return { baseUrl, key, model: (env.AI98_MODEL ?? "claude-sonnet-4-5").trim() };
}

export type Channel = "ai98" | "proxy" | "none";

/**
 * 选哪条通道。抽成纯函数是为了能测——**"没配就应该明确报错"这条**在现场很关键：
 * 静默失败会让大屏一直空着而没人知道为什么。
 */
export function pickChannel(env: EnvLike = process.env): Channel {
  if (ai98Config(env)) return "ai98";
  if ((env.NEXT_PUBLIC_INFERENCE_PROXY_URL ?? "").trim()) return "proxy";
  return "none";
}

/** 拼 OpenAI 兼容的请求体（抽出来单测，不用真的打网络）。 */
export function buildChatBody(model: string, input: ChatInput): Record<string, unknown> {
  const messages: { role: string; content: string }[] = [];
  if (input.system_prompt) messages.push({ role: "system", content: input.system_prompt });
  messages.push({ role: "user", content: input.text ?? "" });
  return { model, messages, stream: false };
}

/** 从 OpenAI 兼容响应里取正文；取不到就抛（宁可失败也不喂给业务层半个结果）。 */
export function parseChatResponse(body: unknown): string {
  const content = (body as { choices?: { message?: { content?: unknown } }[] } | null)?.choices?.[0]?.message
    ?.content;
  if (typeof content === "string" && content.trim()) return content;
  const err = (body as { error?: { message?: unknown } } | null)?.error?.message;
  throw new Error(typeof err === "string" && err.trim() ? err : "模型没有返回内容");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * 调一次 AI98。返回体形状**对齐原 SDK 的 TaskDTO**（`{status, output:{response}}`），
 * 这样四条业务调用点（提交问卷 / 分析 / 补分类 / 词云）一行都不用改。
 */
export async function runViaAi98(cfg: Ai98Config, input: ChatInput, fetchImpl = fetch): Promise<{
  status: string;
  output: { response: string };
}> {
  const attempt = () =>
    fetchImpl(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.key}` },
      body: JSON.stringify(buildChatBody(cfg.model, input)),
    });

  let res = await attempt();
  // 429 / 5xx 退避重试（重试纪律只在这一层做，业务代码不许自写重试循环）
  for (let i = 0; (res.status === 429 || res.status >= 500) && i < 3; i++) {
    await sleep(3000 * 2 ** i);
    res = await attempt();
  }

  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = (body as { error?: { message?: unknown } } | null)?.error?.message;
    throw new Error(typeof msg === "string" && msg.trim() ? msg : `模型接口返回 ${res.status}`);
  }
  return { status: "completed", output: { response: parseChatResponse(body) } };
}
