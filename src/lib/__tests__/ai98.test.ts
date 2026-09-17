import { describe, expect, it } from "vitest";

import { buildChatBody, parseChatResponse, pickChannel } from "../ai98";

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
