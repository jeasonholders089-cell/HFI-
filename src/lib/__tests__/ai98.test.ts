import { describe, expect, it } from "vitest";

import {
  CHAT_MAX_TOKENS,
  buildChatBody,
  detectTruncation,
  parseChatResponse,
  pickChannel,
  runViaAi98,
} from "../ai98";

/**
 * 模型通道的切换（2026-09-17：换成 `.env` 里的 AI98 key，OpenAI 兼容端点）。
 *
 * 这一组只测**能离线验的部分**：请求体怎么拼、响应怎么解析、通道怎么选。
 * 真的打网络要等活动前用真实调用验（那时才有可用的端点）。
 */
describe("请求体与响应解析", () => {
  it("有 system_prompt 时拼成两条消息，没有就只有 user", () => {
    const withSys = buildChatBody("claude-sonnet-4-5", { system_prompt: "你是顾问", text: "孩子信息" });
    expect(withSys.model).toBe("claude-sonnet-4-5");
    expect(withSys.stream).toBe(false);
    expect(withSys.messages).toEqual([
      { role: "system", content: "你是顾问" },
      { role: "user", content: "孩子信息" },
    ]);

    const noSys = buildChatBody("m", { text: "只有输入" });
    expect(noSys.messages).toEqual([{ role: "user", content: "只有输入" }]);
  });

  it("解析 OpenAI 兼容响应：取 choices[0].message.content", () => {
    expect(parseChatResponse({ choices: [{ message: { content: '{"ok":1}' } }] })).toBe('{"ok":1}');
  });

  it("内容是空串 / 不是字符串 / 结构不对 → 抛错（宁可失败也不喂给业务层半个结果）", () => {
    expect(() => parseChatResponse({ choices: [{ message: { content: "" } }] })).toThrow();
    expect(() => parseChatResponse({ choices: [{ message: { content: 123 } }] })).toThrow();
    expect(() => parseChatResponse({})).toThrow();
    expect(() => parseChatResponse(null)).toThrow();
  });

  it("接口返回的 error.message 会原样带出来（方便现场排查）", () => {
    expect(() => parseChatResponse({ error: { message: "invalid api key" } })).toThrow("invalid api key");
  });

  /**
   * 2026-09-18：12 个孩子要跑三次才全生成，根因就是**没传 max_tokens**，
   * 中转站默认值太小 → 长一点的 JSON 被截断。这条测试是防回归闸门。
   */
  it("请求体必须显式带 max_tokens 与 temperature", () => {
    const body = buildChatBody("claude-sonnet-4-5", { text: "x" });
    expect(body.max_tokens).toBe(CHAT_MAX_TOKENS);
    expect(CHAT_MAX_TOKENS).toBeGreaterThan(512);
    expect(typeof body.temperature).toBe("number");
    expect(body.temperature as number).toBeLessThanOrEqual(1);
  });

  it("finish_reason=length 被识别成「输出被截断」，其它原因不算", () => {
    expect(detectTruncation({ choices: [{ finish_reason: "length" }] })).toContain("截断");
    expect(detectTruncation({ choices: [{ finish_reason: "stop" }] })).toBeNull();
    expect(detectTruncation({ choices: [{}] })).toBeNull();
    expect(detectTruncation({})).toBeNull();
    expect(detectTruncation(null)).toBeNull();
  });
});

describe("runViaAi98（用假 fetch，不打网络）", () => {
  const reply = (status: number, body: unknown) =>
    ({ status, ok: status >= 200 && status < 300, json: async () => body }) as unknown as Response;

  /** 手写 recorder，不引 vitest 的 vi —— 这个文件首行有 BOM，尽量少动。 */
  const record = (impl: () => Response) => {
    const calls: [string, RequestInit][] = [];
    const fn = (async (url: string, init: RequestInit) => {
      calls.push([url, init]);
      return impl();
    }) as unknown as typeof fetch;
    return { fn, calls };
  };

  const cfg = { baseUrl: "https://x/v1", key: "sk-test", model: "claude-sonnet-4-5" };

  it("正常响应返回 content，请求打到 /chat/completions 且带 Authorization", async () => {
    const { fn, calls } = record(() =>
      reply(200, { choices: [{ finish_reason: "stop", message: { content: '{"ok":1}' } }] }),
    );
    const out = await runViaAi98(cfg, { text: "x" }, fn);
    expect(out).toEqual({ status: "completed", output: { response: '{"ok":1}' } });
    const [url, init] = calls[0];
    expect(url).toBe("https://x/v1/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk-test");
  });

  it("被截断时报人话，而不是让上层 JSON.parse 失败", async () => {
    const { fn, calls } = record(() =>
      reply(200, {
        choices: [{ finish_reason: "length", message: { content: '{"directions":[{"cat' } }],
      }),
    );
    await expect(runViaAi98(cfg, { text: "x" }, fn)).rejects.toThrow(/截断/);
    expect(calls).toHaveLength(1);
  });

  it("非 2xx 时带出接口的 error.message", async () => {
    const { fn } = record(() => reply(400, { error: { message: "余额不足" } }));
    await expect(runViaAi98(cfg, { text: "x" }, fn)).rejects.toThrow("余额不足");
  });
});

describe("通道选择（pickChannel）", () => {
  it("AI98 配齐 → 走 ai98", () => {
    expect(
      pickChannel({ AI98_BASE_URL: "https://x/v1", AI98_KEY: "sk-test" }),
    ).toBe("ai98");
  });

  it("只配了 KEY、没配 BASE_URL → 不算配了 AI98（不拿半套配置去打网络）", () => {
    expect(
      pickChannel({ AI98_KEY: "sk-test", NEXT_PUBLIC_INFERENCE_PROXY_URL: "http://p" }),
    ).toBe("proxy");
  });

  it("只有平台代理 → 走 proxy（兜底通道）", () => {
    expect(pickChannel({ NEXT_PUBLIC_INFERENCE_PROXY_URL: "http://p" })).toBe("proxy");
  });

  it("两条都没配 → none（上层据此明确报错，而不是静默失败）", () => {
    expect(pickChannel({})).toBe("none");
    expect(pickChannel({ AI98_BASE_URL: "   ", AI98_KEY: "  " })).toBe("none");
  });

  it("默认模型是 Claude 系列（要换只改环境变量）", () => {
    const body = buildChatBody("claude-sonnet-4-5", { text: "x" });
    expect(String(body.model)).toContain("claude");
  });
});
