import { describe, expect, it } from "vitest";

import {
  BULK_FIELDS,
  FIELD_LABEL,
  REQUIRED_FIELDS,
  buildHeaderMap,
  checkBulkRows,
  normalizeHeader,
  normalizeRow,
  parseTextBlock,
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
      expect(r.error).toContain("名字没对上");
      expect(r.error).toContain("孩子的英文名");
      // 不能把每行都列一遍（那正是原来刷一屏的原因）
      expect(r.error).not.toContain("第 1 条");
      expect(r.error).not.toContain("第 2 条");
    }
  });

  it("只有个别行缺字段 → 逐条点名（这时逐条报才是有用的）", () => {
    const r = checkBulkRows([okRow, { ...okRow, "喜欢的活动": "" }]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("第 2 条数据缺少：喜欢的活动");
      expect(r.error).not.toContain("名字没对上");
    }
  });

  /**
   * 2026-09-18：必填从 7 项收到 3 项（英文名 / 梦想学校 / 喜欢的活动）。
   * 现场家长常常只想填这两三样，卡在"年龄 / 自述 / 家长观察"上反而录不进来。
   */
  it("必填就是那三项，多一个少一个都算改契约", () => {
    expect([...REQUIRED_FIELDS]).toEqual(["englishName", "dreamSchool", "activities"]);
  });

  it("只填必填的三项 → 通过（其余留空）", () => {
    const r = checkBulkRows([
      { "孩子的英文名": "Emma", "梦想学校": "RISD", "喜欢的活动": "绘画、做手账" },
    ]);
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    if (r.ok) {
      expect(r.rows[0].age).toBe("");
      expect(r.rows[0].interests).toBe("");
      expect(r.rows[0].selfDescription).toBe("");
      expect(r.rows[0].parentObservation).toBe("");
      expect(r.rows[0].dreamCareer).toBe("");
    }
  });

  it("年龄留空不算错 —— 但填了就必须合法", () => {
    const withAge = checkBulkRows([{ ...okRow, "年龄": "" }]);
    expect(withAge.ok, withAge.ok ? "" : withAge.error).toBe(true);

    const badAge = checkBulkRows([{ ...okRow, "年龄": "0" }]);
    expect(badAge.ok).toBe(false);
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

  it("两行示例的必填三项都填了（否则示例自己就导不进去）", () => {
    for (const row of templateRows().slice(1)) {
      for (const f of REQUIRED_FIELDS) expect(row[BULK_FIELDS.indexOf(f)]).toBeTruthy();
    }
  });
});

/**
 * 批量文本录入的解析（2026-09-18 加）。
 *
 * 由来：必填收到 3 项后，按顺序那种写法要求"空字段也占一行"，
 * 对着一堆空行数位置太容易错——所以加了"字段名: 内容"的写法，两种都认。
 */
describe("parseTextBlock", () => {
  it("带字段名：一行一个，顺序随便，没写的字段不出现", () => {
    const row = parseTextBlock("梦想学校: RISD\n孩子的英文名: Emma\n喜欢的活动: 绘画、做手账");
    expect(row).toEqual({
      dreamSchool: "RISD",
      englishName: "Emma",
      activities: "绘画、做手账",
    });
  });

  it("字段名支持中英文键名与全角冒号", () => {
    const row = parseTextBlock("englishName：Leo\nDream School: Stanford");
    expect(row.englishName).toBe("Leo");
    expect(row.dreamSchool).toBe("Stanford");
  });

  it("老写法（一行一个字段、按固定顺序）继续能用", () => {
    const row = parseTextBlock("Emma\n12\nRISD\n绘画\n绘画社团\n我喜欢画画\n对细节在意\n插画师");
    expect(row.englishName).toBe("Emma");
    expect(row.age).toBe("12");
    expect(row.dreamSchool).toBe("RISD");
    expect(row.activities).toBe("绘画社团");
    expect(row.dreamCareer).toBe("插画师");
  });

  it("认不出字段名时按顺序读，不会把内容当字段名丢掉", () => {
    const row = parseTextBlock("Emma\n12\nRISD");
    expect(row.englishName).toBe("Emma");
    expect(row.dreamSchool).toBe("RISD");
  });

  it("带字段名的写法能直接过校验（只写必填三项）", () => {
    const checked = checkBulkRows([
      parseTextBlock("孩子的英文名: Emma\n梦想学校: RISD\n喜欢的活动: 绘画"),
    ]);
    expect(checked.ok, checked.ok ? "" : checked.error).toBe(true);
  });
});
