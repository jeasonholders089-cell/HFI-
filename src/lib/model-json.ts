/**
 * 解析模型返回的 JSON —— **必须容忍模型的两种常见手抖**。
 *
 * 2026-09-18：现场实测 12 个孩子批量生成画像，稳定有 2–4 条报「模型返回格式异常」，
 * 要重试两三次才能全生成。抓了原始返回才看清根因：
 *
 * - 模型会在 `reason` 里直接引用孩子的原话，且用的是**英文直角双引号**：
 *   `"reason": "自述"喜欢把一个东西拆开看清楚它怎么运转"体现出…"` —— JSON 直接非法。
 * - 全部失败样本的 `finish_reason` 都是 `stop`，**不是截断**（长度上限另外修）。
 *
 * 修法不是"再点一次"，而是把它当成模型的正常行为来兜：
 * 1. 剥掉代码围栏与前后废话，只取最外层的 `{…}`；
 * 2. 直接 `JSON.parse`，成功就返回（绝大多数走这条，零开销）；
 * 3. 失败时把**字符串值内部没转义的双引号**补上反斜杠，再解析一次；
 * 4. 仍失败就抛出可读错误，交给上层报给工作人员。
 */

/** 取最外层的 JSON 对象（顺带剥掉 ```json 围栏与前后解释性文字）。 */
export function sliceOutermostJson(raw: string): string {
  const start = firstIndexOfAny(raw, ["{", "["]);
  const end = Math.max(raw.lastIndexOf("}"), raw.lastIndexOf("]"));
  if (start < 0 || end <= start) throw new Error("模型没有返回 JSON");
  return raw.slice(start, end + 1);
}

function firstIndexOfAny(text: string, needles: string[]): number {
  let best = -1;
  for (const n of needles) {
    const i = text.indexOf(n);
    if (i >= 0 && (best < 0 || i < best)) best = i;
  }
  return best;
}

/** 字符串值内部的 `"` 后面跟这些字符才算正常收尾，否则说明那个引号是内容本身。 */
const STRING_TERMINATORS = new Set([":", ",", "}", "]", ""]);

/**
 * 给**字符串值内部没转义的双引号**补反斜杠。
 *
 * 判定方式：走进字符串后遇到 `"`，往后看第一个非空白字符——是 `:` `,` `}` `]`
 * 或直接到结尾，说明这是正常的字符串收尾；否则就是模型在内容里写了引号，必须转义。
 */
export function escapeStrayQuotes(text: string): string {
  let out = "";
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (!inString) {
      out += ch;
      if (ch === '"') inString = true;
      continue;
    }
    if (ch === "\\") {
      // 已经是转义序列，原样带走下一个字符
      out += ch + (text[i + 1] ?? "");
      i++;
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      // 字符串值里出现真实换行同样非法（JSON 不允许裸控制字符），一并转义
      out += ch === "\n" ? "\\n" : "\\r";
      continue;
    }
    if (ch !== '"') {
      out += ch;
      continue;
    }
    let j = i + 1;
    while (j < text.length && /\s/.test(text[j])) j++;
    const next = text[j] ?? "";
    if (STRING_TERMINATORS.has(next)) {
      out += '"';
      inString = false;
    } else {
      out += '\\"';
    }
  }
  return out;
}

/** 解析模型返回的 JSON；解析不出来就抛，绝不返回半个结果。 */
export function parseModelJson<T = unknown>(raw: string): T {
  const json = sliceOutermostJson(raw);
  try {
    return JSON.parse(json) as T;
  } catch {
    // 只修一次：够覆盖"内容里有裸引号"这一种，修不好就交给上层报错
    return JSON.parse(escapeStrayQuotes(json)) as T;
  }
}
