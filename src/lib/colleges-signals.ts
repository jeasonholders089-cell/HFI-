/**
 * 第 15 节「数据信号」—— 12 条并列条件，命中任意一条即渲染，**上限 6 条**。
 *
 * 来源：docs/05 第六节 + docs/08 §6.19。两条纪律：
 *   1. 上限 6 而不是参考实现的 4 —— 实测每所命中 1–6 条，上限提到 6 等于不截断（2026-09-17 确认）；
 *   2. 顺序**保持条件的自然顺序**，不做"按重要度重排"（重排要先定义"什么算重要"，那是主观判断）。
 *
 * 文案里**不得出现**「小助手 / 顾问 / 私信 / 定位报告 / 点评」——
 * 参考实现这几条信号后面接的是导流话术（评审 M2），我们只留数据观察本身。
 */
import type { College } from "./colleges-data";

/** 信号上限（docs/05 第六节第 3 条）。 */
export const SIGNAL_LIMIT = 6;

export type Signal = { key: string; text: string };

function intlOf(c: College): number | null {
  return c.intlNum;
}

/** 12 条条件，按代码顺序求值。 */
export function dataSignals(c: College): Signal[] {
  const out: Signal[] = [];
  const lv = c.lever;
  const intl = intlOf(c);

  // ① 早申杠杆
  if (lv != null && lv >= 2.5) {
    if (c.hasED) {
      out.push({
        key: "lever-high-ed",
        text: `数据信号：该校早申录取率约为 RD 的 ${lv.toFixed(1)} 倍。早申池通常更强（校友子女、体育特长等），倍数不等于个人录取概率提升。`,
      });
    } else if (c.hasEarly) {
      out.push({
        key: "lever-high-ea",
        text: `数据信号：该校早申录取率约为 RD 的 ${lv.toFixed(1)} 倍（含申请池自选择因素）。早申不绑定，但提前提交意味着放弃展示高三上的新成绩与新活动，材料是否成熟需要权衡。`,
      });
    }
  } else if (lv != null && lv >= 1.5) {
    if (c.hasED) {
      out.push({
        key: "lever-mid-ed",
        text: `数据信号：早申录取率约为 RD 的 ${lv.toFixed(1)} 倍（含申请池自选择因素），是否使用绑定早申建议综合评估。`,
      });
    } else if (c.hasEarly) {
      out.push({
        key: "lever-mid-ea",
        text: `数据信号：早申录取率约为 RD 的 ${lv.toFixed(1)} 倍（含自选择因素）。早申不绑定，材料成熟可以考虑提前提交。`,
      });
    }
  }

  // ② 限制性早申
  if (c.hasREA) {
    out.push({
      key: "restrictive-early",
      text: "限制性早申：申请该校早申轮时，不可同时绑定其他学校的 ED。早申组合需要整体规划。",
    });
  }

  // ③ 国际生身份认定
  if (c.idef_c === "hs") {
    out.push({
      key: "idef-hs",
      text: "身份认定特殊：该校按「高中所在地」而非国籍区分国内与国际申请人 —— 美籍或绿卡学生在海外读高中，同样进国际生池审核。",
    });
  } else if (c.idef_c === "both") {
    out.push({
      key: "idef-both",
      text: "身份认定特殊：国籍与高中所在地兼看 —— 美国公民在境外读高中，也可能被按国际生审核，身份规划需提前确认。",
    });
  }

  // ④ 面试政策
  if (c.ivw_c === "req") {
    out.push({
      key: "ivw-required",
      text: "面试信号：该校面试是必须环节（获安排后须完成）。尽早关注面试安排通知，提前做模拟准备。",
    });
  } else if (c.ivw_c === "rec") {
    out.push({
      key: "ivw-recommended",
      text: "面试信号：该校官方推荐或强烈建议面试。面试名额通常先到先得，建议开放后尽早预约。",
    });
  }

  // ⑤ 第三方面试
  if (c.ivw_iv === "rec") {
    out.push({
      key: "ivw-third-party",
      text: "第三方面试：该校官方鼓励国际生提交 InitialView / Vericant。建议在申请截止前完成录制并送分。",
    });
  }

  // ⑥ 标化必交
  if (c.test === "req") {
    out.push({
      key: "test-required",
      text: `标化必交：SAT 中位区间 ${c.sat ?? "见官网"}。低于 25 分位时，其他维度需要明显过硬。`,
    });
  }

  // ⑦ 完全不看标化
  if (c.test === "blind") {
    out.push({
      key: "test-blind",
      text: "完全不看标化：GPA、课程难度、文书与活动的权重被放大。",
    });
  }

  // ⑧ Test-Optional 且公布区间
  if (c.test === "opt" && c.sat) {
    out.push({
      key: "test-optional-band",
      text: `Test-Optional：建议达到中位区间（${c.sat}）上半段再提交，否则可以不交。`,
    });
  }

  // ⑨ 国际生比例
  if (intl != null && intl <= 8) {
    out.push({
      key: "intl-low",
      text: `数据信号：在读国际生比例仅 ${c.intl}，国际生名额可能有限，差异化叙事更重要。`,
    });
  } else if (intl != null && intl >= 18) {
    out.push({
      key: "intl-high",
      text: `数据信号：在读国际生比例达 ${c.intl}。比例高不等于国际生录取率更高或资助更友好，以该校国际生录取口径为准。`,
    });
  }

  // ⑩ 转学率
  if (c.trNum != null && c.trNum >= 35) {
    out.push({
      key: "transfer-high",
      text: `数据信号：转学录取率 ${c.tr}，高于多数同层次学校。转学涉及学分转换、奖助与名额年际波动，不确定性大。`,
    });
  }

  // ⑪ 单轮申请
  if (c.singleRound) {
    out.push({
      key: "single-round",
      text: "单轮申请无早申：没有批次选择的空间，材料质量与 GPA 是主要变量。",
    });
  }

  // ⑫ 申请量
  if (c.apps != null && c.apps >= 100000) {
    out.push({
      key: "apps-huge",
      text: `数据信号：申请量约 ${c.apps.toLocaleString("en-US")} 人，初筛阶段更依赖硬指标，亮点需要前置表达。`,
    });
  }

  return out;
}

/** 按上限截断后的信号列表；空数组表示第 15 节整节不渲染。 */
export function visibleSignals(c: College): Signal[] {
  return dataSignals(c).slice(0, SIGNAL_LIMIT);
}
