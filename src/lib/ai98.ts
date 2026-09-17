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

/**
 * 输出长度上限。2026-09-18 加：不显式给 `max_tokens` 时由中转站决定默认值，
 * 一旦偏小，analyze 的三个方向 + 中文依据就会被截断，返回半个 JSON。
 *
 * 说明：它**不是**"12 个孩子要跑三次"的根因——那次抓到原始返回后确认，
 * 失败样本的 `finish_reason` 全是 `stop`，真正的问题在 `lib/model-json.ts`
 * （模型在 reason 里写了没转义的英文双引号）。这里定死长度属于顺手补的卫生习惯。
 */
export const CHAT_MAX_TOKENS = 2048;

/**
 * 采样温度。调低的原因：分类与特质归纳都要**稳定**，而不是每次换一套说法。
 * （词云即使温度低也不会完全重复，但它另有缓存兜底。）
 */
export const CHAT_TEMPERATURE = 0.3;

/** 拼 OpenAI 兼容的请求体（抽出来单测，不用真的打网络）。 */
export function buildChatBody(model: string, input: ChatInput): Record<string, unknown> {
  const messages: { role: string; content: string }[] = [];
  if (input.system_prompt) messages.push({ role: "system", content: input.system_prompt });
  messages.push({ role: "user", content: input.text ?? "" });
  return {
    model,
    messages,
    stream: false,
    max_tokens: CHAT_MAX_TOKENS,
    temperature: CHAT_TEMPERATURE,
  };
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
 * 取 `choices[0].finish_reason`。`"length"` 意味着**输出被 max_tokens 截断**，
 * 此时 `content` 多半是半个 JSON——直接报"格式异常"会让人以为模型不听话，
 * 其实只是长度没给够，所以单独识别成一句人话。
 */
export function detectTruncation(body: unknown): string | null {
  const finish = (body as { choices?: { finish_reason?: unknown }[] } | null)?.choices?.[0]
    ?.finish_reason;
  if (finish !== "length") return null;
  return `模型输出被截断（达到 ${CHAT_MAX_TOKENS} token 上限），请重试这一条`;
}

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
  // 截断要在这里拦下来：响应体只读一次，交给上层的就是完整的 JSON 字符串。
  const truncated = detectTruncation(body);
  if (truncated) throw new Error(truncated);
  return { status: "completed", output: { response: parseChatResponse(body) } };
}
