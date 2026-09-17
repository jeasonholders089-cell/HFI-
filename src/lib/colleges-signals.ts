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
import type { Lang } from "./colleges-i18n";

/** 信号上限（docs/05 第六节第 3 条）。 */
export const SIGNAL_LIMIT = 6;

export type Signal = { key: string; text: string };

function intlOf(c: College): number | null {
  return c.intlNum;
}

/** 一条信号的双语文本，按 lang 取一份出来（§6.15 的第 15 节也要跟着切）。 */
function S(key: string, zh: string, en: string, lang: Lang): Signal {
  return { key, text: lang === "en" ? en : zh };
}

/** 12 条条件，按代码顺序求值。 */
export function dataSignals(c: College, lang: Lang = "zh"): Signal[] {
  const out: Signal[] = [];
  const lv = c.lever;
  const intl = intlOf(c);

  // ① 早申杠杆
  if (lv != null && lv >= 2.5) {
    if (c.hasED) {
      out.push(
        S(
          "lever-high-ed",
          `数据信号：该校早申录取率约为 RD 的 ${lv.toFixed(1)} 倍。早申池通常更强（校友子女、体育特长等），倍数不等于个人录取概率提升。`,
          `Early-round acceptance is about ${lv.toFixed(1)}× the RD rate. The early pool is usually stronger (legacy, athletic recruits), so the multiple is not a personal probability lift.`,
          lang,
        ),
      );
    } else if (c.hasEarly) {
      out.push(
        S(
          "lever-high-ea",
          `数据信号：该校早申录取率约为 RD 的 ${lv.toFixed(1)} 倍（含申请池自选择因素）。早申不绑定，但提前提交意味着放弃展示高三上的新成绩与新活动，材料是否成熟需要权衡。`,
          `Early-round acceptance is about ${lv.toFixed(1)}× the RD rate (includes self-selection). Early action is non-binding, but applying early means giving up new senior-year grades and activities — weigh whether the file is ready.`,
          lang,
        ),
      );
    }
  } else if (lv != null && lv >= 1.5) {
    if (c.hasED) {
      out.push(
        S(
          "lever-mid-ed",
          `数据信号：早申录取率约为 RD 的 ${lv.toFixed(1)} 倍（含申请池自选择因素），是否使用绑定早申建议综合评估。`,
          `Early-round acceptance is about ${lv.toFixed(1)}× the RD rate (includes self-selection). Whether to use a binding early option deserves a full review.`,
          lang,
        ),
      );
    } else if (c.hasEarly) {
      out.push(
        S(
          "lever-mid-ea",
          `数据信号：早申录取率约为 RD 的 ${lv.toFixed(1)} 倍（含自选择因素）。早申不绑定，材料成熟可以考虑提前提交。`,
          `Early-round acceptance is about ${lv.toFixed(1)}× the RD rate (includes self-selection). Early action is non-binding, so submitting early is reasonable once the file is ready.`,
          lang,
        ),
      );
    }
  }

  // ② 限制性早申
  if (c.hasREA) {
    out.push(
      S(
        "restrictive-early",
        "限制性早申：申请该校早申轮时，不可同时绑定其他学校的 ED。早申组合需要整体规划。",
        "Restrictive early action: you may not also file a binding ED elsewhere. Plan the whole early combination together.",
        lang,
      ),
    );
  }

  // ③ 国际生身份认定
  if (c.idef_c === "hs") {
    out.push(
      S(
        "idef-hs",
        "身份认定特殊：该校按「高中所在地」而非国籍区分国内与国际申请人 —— 美籍或绿卡学生在海外读高中，同样进国际生池审核。",
        "Status note: this school separates domestic and international applicants by where the high school is, not by citizenship — a US citizen or green-card holder studying abroad is reviewed in the international pool.",
        lang,
      ),
    );
  } else if (c.idef_c === "both") {
    out.push(
      S(
        "idef-both",
        "身份认定特殊：国籍与高中所在地兼看 —— 美国公民在境外读高中，也可能被按国际生审核，身份规划需提前确认。",
        "Status note: both citizenship and high-school location are considered — a US citizen studying abroad may still be reviewed as international. Confirm early.",
        lang,
      ),
    );
  }

  // ④ 面试政策
  if (c.ivw_c === "req") {
    out.push(
      S(
        "ivw-required",
        "面试信号：该校面试是必须环节（获安排后须完成）。尽早关注面试安排通知，提前做模拟准备。",
        "Interview: required — once scheduled it must be completed. Watch for the scheduling notice and rehearse early.",
        lang,
      ),
    );
  } else if (c.ivw_c === "rec") {
    out.push(
      S(
        "ivw-recommended",
        "面试信号：该校官方推荐或强烈建议面试。面试名额通常先到先得，建议开放后尽早预约。",
        "Interview: recommended or strongly encouraged. Slots are usually first-come-first-served — book as soon as they open.",
        lang,
      ),
    );
  }

  // ⑤ 第三方面试
  if (c.ivw_iv === "rec") {
    out.push(
      S(
        "ivw-third-party",
        "第三方面试：该校官方鼓励国际生提交 InitialView / Vericant。建议在申请截止前完成录制并送分。",
        "Third-party interview: the school encourages international applicants to submit InitialView / Vericant. Finish the recording and send the score before the deadline.",
        lang,
      ),
    );
  }

  // ⑥ 标化必交
  if (c.test === "req") {
    out.push(
      S(
        "test-required",
        `标化必交：SAT 中位区间 ${c.sat ?? "见官网"}。低于 25 分位时，其他维度需要明显过硬。`,
        `Tests required: SAT mid 50% is ${c.sat ?? "see school site"}. Below the 25th percentile, other dimensions need to be clearly strong.`,
        lang,
      ),
    );
  }

  // ⑦ 完全不看标化
  if (c.test === "blind") {
    out.push(
      S(
        "test-blind",
        "完全不看标化：GPA、课程难度、文书与活动的权重被放大。",
        "Test-blind: GPA, course rigour, essays and activities carry proportionally more weight.",
        lang,
      ),
    );
  }

  // ⑧ Test-Optional 且公布区间
  if (c.test === "opt" && c.sat) {
    out.push(
      S(
        "test-optional-band",
        `Test-Optional：建议达到中位区间（${c.sat}）上半段再提交，否则可以不交。`,
        `Test-optional: submit only if the score sits in the upper half of ${c.sat}; otherwise it can be withheld.`,
        lang,
      ),
    );
  }

  // ⑨ 国际生比例
  if (intl != null && intl <= 8) {
    out.push(
      S(
        "intl-low",
        `数据信号：在读国际生比例仅 ${c.intl}，国际生名额可能有限，差异化叙事更重要。`,
        `International students are only ${c.intl} of the class; seats may be limited, so a distinctive narrative matters more.`,
        lang,
      ),
    );
  } else if (intl != null && intl >= 18) {
    out.push(
      S(
        "intl-high",
        `数据信号：在读国际生比例达 ${c.intl}。比例高不等于国际生录取率更高或资助更友好，以该校国际生录取口径为准。`,
        `International students are ${c.intl} of the class. A high share does not mean a higher admit rate or friendlier aid — check the school's own international policy.`,
        lang,
      ),
    );
  }

  // ⑩ 转学率
  if (c.trNum != null && c.trNum >= 35) {
    out.push(
      S(
        "transfer-high",
        `数据信号：转学录取率 ${c.tr}，高于多数同层次学校。转学涉及学分转换、奖助与名额年际波动，不确定性大。`,
        `Transfer acceptance is ${c.tr}, high for this tier. Transferring involves credit transfer, aid and year-to-year seat swings, so uncertainty is high.`,
        lang,
      ),
    );
  }

  // ⑪ 单轮申请
  if (c.singleRound) {
    out.push(
      S(
        "single-round",
        "单轮申请无早申：没有批次选择的空间，材料质量与 GPA 是主要变量。",
        "Single round, no early option: there is no round to choose, so file quality and GPA are the main variables.",
        lang,
      ),
    );
  }

  // ⑫ 申请量
  if (c.apps != null && c.apps >= 100000) {
    out.push(
      S(
        "apps-huge",
        `数据信号：申请量约 ${c.apps.toLocaleString("en-US")} 人，初筛阶段更依赖硬指标，亮点需要前置表达。`,
        `Roughly ${c.apps.toLocaleString("en-US")} applicants: the first screen leans on hard metrics, so put your strongest point up front.`,
        lang,
      ),
    );
  }

  return out;
}

/** 按上限截断后的信号列表；空数组表示第 15 节整节不渲染。 */
export function visibleSignals(c: College, lang: Lang = "zh"): Signal[] {
  return dataSignals(c, lang).slice(0, SIGNAL_LIMIT);
}
