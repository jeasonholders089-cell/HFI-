import { describe, expect, it } from "vitest";

import { escapeStrayQuotes, parseModelJson, sliceOutermostJson } from "../model-json";

/**
 * 2026-09-18：12 个孩子批量生成画像稳定失败 2–4 条，报「模型返回格式异常」。
 * 抓原始返回确认：**模型在 reason 里引用孩子原话时用了没转义的英文双引号**，
 * `finish_reason` 是 stop（不是截断）。这个文件的样本全部来自真实返回。
 */
describe("sliceOutermostJson", () => {
  it("剥掉 ```json 围栏", () => {
    expect(sliceOutermostJson('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it("剥掉前后解释性文字", () => {
    expect(sliceOutermostJson('好的，结果如下：{"a":1} 以上。')).toBe('{"a":1}');
  });

  it("数组也算（词云之类的场景）", () => {
    expect(sliceOutermostJson("```json\n[1,2]\n```")).toBe("[1,2]");
  });

  it("完全没有 JSON 就抛错（交给上层报人话）", () => {
    expect(() => sliceOutermostJson("模型今天不想说话")).toThrow();
  });
});

describe("escapeStrayQuotes", () => {
  it("真实失败样本：字符串里的裸引号被转义后能解析", () => {
    // 原始返回（截自实测）：reason 里 `自述"喜欢把…运转"` 是裸双引号
    const bad =
      '{"directions":[{"category":"工程与应用","name":"机器人工程与自动化","nameEn":"Robotics","reason":"参与机器人社团，自述"喜欢把一个东西拆开看清楚它怎么运转"体现出对机械结构的兴趣"},{"category":"社会科学","name":"传播学与媒体研究","nameEn":"Communication","reason":"校刊编辑经历结合辩论兴趣"},{"category":"人文科学","name":"创意写作","nameEn":"Creative Writing","reason":"写小说兴趣"}]}';
    expect(() => JSON.parse(bad)).toThrow();
    const fixed = JSON.parse(escapeStrayQuotes(bad)) as {
      directions: { reason: string }[];
    };
    expect(fixed.directions).toHaveLength(3);
    expect(fixed.directions[0].reason).toContain('自述"喜欢把一个东西拆开看清楚它怎么运转"');
  });

  it("正常的 JSON 一个字都不改（幂等）", () => {
    const good = '{"directions":[{"name":"创意写作","nameEn":"Creative Writing"}]}';
    expect(escapeStrayQuotes(good)).toBe(good);
  });

  it("已有转义序列不重复转义", () => {
    const s = '{"a":"他说\\"你好\\"","b":"换行\\n"}';
    expect(escapeStrayQuotes(s)).toBe(s);
  });

  it("字符串里的真实换行被转成 \\n", () => {
    const parsed = JSON.parse(escapeStrayQuotes('{"a":"第一行\n第二行"}')) as { a: string };
    expect(parsed.a).toBe("第一行\n第二行");
  });
});

describe("parseModelJson", () => {
  it("围栏 + 裸引号一起上也能解析", () => {
    const raw = '```json\n{"directions":[{"reason":"自述"拆东西"很有意思"}]}\n```';
    const parsed = parseModelJson<{ directions: { reason: string }[] }>(raw);
    expect(parsed.directions[0].reason).toBe('自述"拆东西"很有意思');
  });

  it("正常输出走原路，结果一致", () => {
    const parsed = parseModelJson<{ directions: unknown[] }>('{"directions":[1,2,3]}');
    expect(parsed.directions).toEqual([1, 2, 3]);
  });

  it("修不好就抛错，不返回半个结果", () => {
    expect(() => parseModelJson("完全不是 JSON")).toThrow();
  });
});
