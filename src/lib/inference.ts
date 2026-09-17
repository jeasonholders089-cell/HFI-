import {
  inference,
  TaskStatusCompleted,
  TaskStatusFailed,
  TaskStatusCancelled,
} from "@inferencesh/sdk";
import type { TaskDTO } from "@inferencesh/sdk";

import { ai98Config, pickChannel, runViaAi98 } from "./ai98";

/**
 * 走哪条通道，按环境变量决定（密钥只放 `.env`，永不进代码）：
 *
 *   ① **AI98**（默认）—— OpenAI 兼容的 `/v1/chat/completions`，模型是 Claude 系列。
 *      需要 `AI98_BASE_URL` + `AI98_KEY`（+ 可选 `AI98_MODEL`）。
 *   ② **平台代理**（兜底）—— `NEXT_PUBLIC_INFERENCE_PROXY_URL`，走 `@inferencesh/sdk`。
 *
 * 为什么不把 key 写进代码：这是项目硬规矩（AGENTS.md 第七节）。
 * 为什么做成"两条都要"：活动当天哪条通就用哪条，改环境变量即可，不用改代码。
 */
/**
 * 创建走平台代理的 inference 客户端.
 * proxyUrl 运行时由平台注入沙箱 env (NEXT_PUBLIC_INFERENCE_PROXY_URL);
 * 本地验证时把该 env 指向本地 backend 的 inference_proxy.
 * 永远不在前端写 apiKey / 明文 key.
 */
export function createInferenceClient() {
  const proxyUrl = process.env.NEXT_PUBLIC_INFERENCE_PROXY_URL;
  if (!proxyUrl) throw new Error("当前环境缺少推理代理 URL");
  return inference({ proxyUrl, stream: false, pollIntervalMs: 2000 });
}

// 平台并发闸的两种 429 文案. 只认这两句 (平台侧与本文件同仓维护):
// 泛匹配 "429" 会把轮询阶段的上游限流也当成"未提交", 重试即重复提交重复扣费.
const GATE_LIMIT_MSG = "并发任务数已达上限";
const GATE_COOLDOWN_MSG = "请求过于频繁";

function isGateLimit(e: unknown): boolean {
  return e instanceof Error && e.message.includes(GATE_LIMIT_MSG);
}

function isGateCooldown(e: unknown): boolean {
  return e instanceof Error && e.message.includes(GATE_COOLDOWN_MSG);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * 跑一次 inference 任务, 阻塞到终态. 失败/取消/非完成态一律抛错, 返回完成的 TaskDTO.
 * 长任务 (视频) 可调大 maxReconnects.
 *
 * 提交撞上平台并发闸 (每用户同时 3 个任务) 时指数退避重试 (3s/6s/12s, 共 4 次
 * 提交尝试) — 任务终态后额度秒级归还, 短退避足够周转; 重试耗尽或处于风暴冷却期
 * 时把服务端中文文案原样抛出, 直接展示给用户即可. 禁止在此之外自写重试循环.
 */
export async function runInference(
  app: string,
  input: Record<string, unknown>,
  opts?: { maxReconnects?: number },
): Promise<TaskDTO> {
  // ① 配了 AI98 就走 AI98（服务端才有 key；浏览器里为 undefined，自动落到 ②）
  const channel = pickChannel();
  if (channel === "ai98") {
    const cfg = ai98Config();
    if (cfg) return (await runViaAi98(cfg, input)) as unknown as TaskDTO;
  }
  if (channel === "none") throw new Error("当前环境缺少推理代理 URL");

  // ② 兜底：平台推理代理
  const client = createInferenceClient();
  const maxSubmitAttempts = 4;
  for (let attempt = 0; ; attempt++) {
    let task: TaskDTO;
    try {
      task = (await client.run(
        { app, input },
        { stream: false, pollIntervalMs: 2000, maxReconnects: opts?.maxReconnects ?? 120 },
      )) as TaskDTO;
    } catch (e) {
      if (isGateLimit(e) && !isGateCooldown(e) && attempt < maxSubmitAttempts - 1) {
        await sleep(3000 * 2 ** attempt);
        continue;
      }
      throw e;
    }

    if (task.status === TaskStatusFailed) {
      throw new Error(task.error ? String(task.error) : "任务失败");
    }
    if (task.status === TaskStatusCancelled) throw new Error("任务被取消");
    if (task.status !== TaskStatusCompleted) {
      throw new Error(`任务进入非预期状态: status=${task.status}`);
    }
    return task;
  }
}
