import { describe, expect, it } from "vitest";

import {
  BULK_FIELDS,
  buildHeaderMap,
  checkBulkRows,
  normalizeHeader,
  normalizeRow,
  FIELD_LABEL,
  templateRows,
} from "../bulk-import";

/**
 * 批量导入的列名归位（2026-09-18 修）。
 *
 * 这一组的由来是一个真实事故：工作人员上传自己做的 Excel，**12 行全部报"缺少全部字段"**，
 * 报错还刷了一屏。原因是接口只认英文键名，而任何自己做的表都用中文列名——
 * **Excel 通道对它的目标用户是坏的**。所以这里用**用户那张表的真实表头**当用例。
 */
describe("列名归一", () => {
  it("去掉括号内容、空格、下划线，并转小写", () => {
    expect(normalizeHeader("梦想职业（选填）")).toBe("梦想职业");
    expect(normalizeHeader("English Name")).toBe("englishname");
    expect(normalizeHeader("english_name")).toBe("englishname");
    expect(normalizeHeader(" 年龄 ")).toBe("年龄");
  });

  it("别名表没有冲突（同一个列名不能指向两个字段）", () => {
    expect(() => buildHeaderMap()).not.toThrow();
  });
});

describe("认中文表头（用户那张 Excel 的真实表头）", () => {
  it("八个中文列名全部能归位", () => {
    const row = normalizeRow({
      "孩子的英文名": "Ethan",
      "年龄": 9,
      "梦想学校": "成都七中",
      "兴趣": "机器人, 烘焙",
      "喜欢的活动": "观星",
      "孩子自我描述": "我有点马虎",
      "家长观察": "精力旺",
      "梦想职业（选填）": "人工智能工程师",
    });
    expect(row.englishName).toBe("Ethan");
    expect(row.age).toBe("9");
    expect(row.dreamSchool).toBe("成都七中");
    expect(row.dreamCareer).toBe("人工智能工程师");
  });

  it("英文键名（老写法）继续能用 —— 不能为了修中文把原来的弄坏", () => {
    const row = normalizeRow({ englishName: "Emma", age: "12", dreamSchool: "RISD" });
    expect(row.englishName).toBe("Emma");
    expect(row.age).toBe("12");
  });

  it("认不出的列直接忽略，不会塞错字段", () => {
    const row = normalizeRow({ "孩子的英文名": "Ethan", "备注": "随便写" });
    expect(row.englishName).toBe("Ethan");
    expect(Object.keys(row)).toEqual(["englishName"]);
  });

  it("数字型单元格（年龄是数字不是字符串）也能读成文本", () => {
    expect(normalizeRow({ 年龄: 9 }).age).toBe("9");
  });
});

describe("校验与报错", () => {
  const okRow = {
    "孩子的英文名": "Ethan",
    "年龄": 9,
    "梦想学校": "成都七中",
    "兴趣": "机器人",
    "喜欢的活动": "观星",
    "孩子自我描述": "我有点马虎",
    "家长观察": "精力旺",
  };

  it("中文表头 + 完整数据 → 通过，年龄转成数字串", () => {
    const r = checkBulkRows([okRow]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.rows).toHaveLength(1);
      expect(r.rows[0].englishName).toBe("Ethan");
      expect(r.rows[0].dreamCareer).toBe(""); // 选填没给就是空串
    }
  });

  it("**每一行都缺同样的必填项 → 判定为表头问题**，报一条能照着改的错", () => {
    const bad = [{ Name: "Ethan", School: "成都七中" }, { Name: "Olivia", School: "雅礼" }];
    const r = checkBulkRows(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("表头没对上");
      expect(r.error).toContain("孩子的英文名");
      // 不能把每行都列一遍（那正是原来刷一屏的原因）
      expect(r.error).not.toContain("第 1 条");
      expect(r.error).not.toContain("第 2 条");
    }
  });

  it("只有个别行缺字段 → 逐条点名（这时逐条报才是有用的）", () => {
    const r = checkBulkRows([okRow, { ...okRow, "兴趣": "" }]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("第 2 条数据缺少：兴趣");
      expect(r.error).not.toContain("表头没对上");
    }
  });

  it("年龄不是 1–100 的整数 → 报出来", () => {
    const r = checkBulkRows([{ ...okRow, "年龄": "很大" }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("年龄");
  });

  it("空数组 / 没有数据行 → 明确报错，不是静默成功", () => {
    expect(checkBulkRows([]).ok).toBe(false);
  });

  it("输出的八个字段与 BULK_FIELDS 完全一致（不漏字段）", () => {
    const r = checkBulkRows([okRow]);
    if (r.ok) expect(Object.keys(r.rows[0]).sort()).toEqual([...BULK_FIELDS].sort());
  });
});

/**
 * 下载的导入模板（2026-09-18 加）。
 *
 * 模板不是静态文件、而是**从字段定义生成**的——目的就是不让它和导入端漂移。
 * 所以这里最值钱的一条是：**把模板自己喂回校验，必须能过**。
 */
describe("导入模板", () => {
  it("第一行就是导入端认的那八个中文列名（与字段定义同源）", () => {
    expect(templateRows()[0]).toEqual(BULK_FIELDS.map((f) => FIELD_LABEL[f]));
  });

  it("模板自己能导入：把示例行按表头转成对象 → 校验通过", () => {
    const [header, ...examples] = templateRows();
    const objects = examples.map((row) => Object.fromEntries(header.map((h, i) => [h, row[i] ?? ""])));
    const r = checkBulkRows(objects);
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (r.ok) expect(r.rows).toHaveLength(examples.length);
  });

  it("示例里给了「梦想职业」和留空两种情况 —— 让用户看到它是选填", () => {
    const rows = templateRows().slice(1);
    expect(rows.some((r) => r[BULK_FIELDS.indexOf("dreamCareer")])).toBe(true);
    expect(rows.some((r) => !r[BULK_FIELDS.indexOf("dreamCareer")])).toBe(true);
  });
});
