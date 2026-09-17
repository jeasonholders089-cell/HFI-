/**
 * 中英切换的词典表（docs/08 §6.15）。
 *
 * 为什么自建而不用 i18n 库：整页只有一份文案、运行时零依赖是硬约束。
 *
 * 范围（6.15 已确认）：
 *   - 界面文案、校名、枚举、日期类 → 完整双语；
 *   - **单语字段**（essays 文书提炼 / idef_t 认定原文 / ivw_t 面试概括）源数据只有中文，
 *     英文模式下显示中文原文 + 一行说明。
 */
export type Lang = "zh" | "en";

type Entry = { zh: string; en: string };

export const TEXT = {
  // —— 页面 ——
  "page.eyebrow": { zh: "US COLLEGE MAP · 2026", en: "US COLLEGE MAP · 2026" },
  "page.title": { zh: "美国有哪些学校，都在哪儿", en: "Where are the schools?" },
  "page.count": { zh: "共 {n} 所院校", en: "{n} schools" },
  "page.uni": { zh: "综合性大学 {n}", en: "National universities {n}" },
  "page.lac": { zh: "文理学院 {n}", en: "Liberal arts colleges {n}" },
  "page.footer": {
    zh: "数据来源：各校 Common Data Set 与官方发布 · 排名口径 US News 2026 · RD 录取率标注「推算值」处为按 CDS 推算 · 录取率、标化等字段以官网为准 · 数据更新 2026-08-11",
    en: "Source: each school's Common Data Set and official releases · Rankings: US News 2026 · 「推算值」 marks an RD rate derived from CDS · verify all figures on the school's own site · data updated 2026-08-11",
  },

  // —— 工具栏 ——
  "toolbar.map": { zh: "地图视图", en: "Map" },
  "toolbar.table": { zh: "表格视图", en: "Table" },
  "toolbar.search": { zh: "搜索学校（中 / 英文）…", en: "Search schools…" },
  "toolbar.typeAll": { zh: "全部类型", en: "All types" },
  "toolbar.typeUni": { zh: "综合性大学", en: "National university" },
  "toolbar.typeLac": { zh: "文理学院", en: "Liberal arts college" },
  "toolbar.regionAll": { zh: "全部地区", en: "All regions" },
  "toolbar.regionNE": { zh: "东北部", en: "Northeast" },
  "toolbar.regionS": { zh: "南部", en: "South" },
  "toolbar.regionMW": { zh: "中西部", en: "Midwest" },
  "toolbar.regionW": { zh: "西部", en: "West" },
  "toolbar.roundAll": { zh: "全部批次", en: "All rounds" },
  "toolbar.roundEA": { zh: "有 EA（含 EAR）", en: "Has EA (incl. EAR)" },
  "toolbar.roundED1": { zh: "有 ED1", en: "Has ED1" },
  "toolbar.roundED2": { zh: "有 ED2", en: "Has ED2" },
  "toolbar.roundREA": { zh: "限制性早申（REA / EAR）", en: "Restrictive early (REA/EAR)" },
  "toolbar.testAll": { zh: "全部标化政策", en: "All test policies" },
  "toolbar.testReq": { zh: "标化必交", en: "Tests required" },
  "toolbar.testOpt": { zh: "标化可选", en: "Test optional" },
  "toolbar.testFlex": { zh: "标化灵活", en: "Test flexible" },
  "toolbar.testBlind": { zh: "不看标化", en: "Test blind" },
  "toolbar.rankAll": { zh: "全部排名", en: "All ranks" },
  "toolbar.favBtn": { zh: "我的收藏{fav}", en: "My list{fav}" },
  "toolbar.matchBtn": { zh: "SAT 初步区间", en: "SAT bands" },
  "toolbar.matchOn": { zh: "SAT {sat} 匹配中", en: "SAT {sat} applied" },
  "toolbar.reset": { zh: "清除筛选", en: "Reset filters" },
  "toolbar.insights": { zh: "洞察榜", en: "Signals" },
  "toolbar.bandAll": { zh: "全部", en: "All" },
  "toolbar.legendUni": { zh: "私立综合", en: "Private" },
  "toolbar.legendPub": { zh: "公立综合", en: "Public" },
  "toolbar.legendLac": { zh: "文理学院", en: "LAC" },
  "toolbar.legendCity": { zh: "主要城市", en: "City" },

  // —— 洞察榜标签 ——
  "insight.ed": { zh: "早申倍数高", en: "High early leverage" },
  "insight.intl": { zh: "国际生占比高", en: "High intl share" },
  "insight.tr": { zh: "转学率较高", en: "High transfer rate" },
  "insight.calm": { zh: "申请池较小", en: "Smaller applicant pool" },
  "insight.blind": { zh: "不看标化", en: "Test blind" },

  // —— 匹配档位 ——
  "band.r": { zh: "偏冲", en: "Stretch" },
  "band.rm": { zh: "冲·适中", en: "Stretch–mid" },
  "band.m": { zh: "适中", en: "Mid" },
  "band.s": { zh: "较稳", en: "Steadier" },
  "band.h": { zh: "看综合", en: "Holistic" },

  // —— 侧栏 ——
  "slots.title": { zh: "对比位（{n}/3）", en: "Compare ({n}/3)" },
  "slots.clear": { zh: "清空", en: "Clear" },
  "slots.empty": { zh: "空", en: "empty" },
  "slots.remove": { zh: "从对比位移除 {name}", en: "Remove {name} from compare" },
  "slots.compare": { zh: "并排对比（{n}）", en: "Compare {n}" },
  "slots.add": { zh: "加入对比", en: "Add to compare" },
  "slots.added": { zh: "已加入对比位", en: "In compare" },
  "slots.full": { zh: "对比位已满（3/3）", en: "Compare full (3/3)" },
  "slots.fullNote": {
    zh: "对比位已满，请先移除一所再加入",
    en: "Compare slots are full — remove one first",
  },
  "fav.add": { zh: "收藏", en: "Add to my list" },
  "fav.remove": { zh: "取消收藏", en: "Remove from my list" },
  "pane.empty1": { zh: "点地图上的圆点", en: "Click a dot on the map" },
  "pane.empty2": { zh: "查看院校详情", en: "to see the school" },

  // —— 第 15 节的开头说明与档案口径说明 ——
  "sig.head": {
    zh: "公开数据中的观察信号，自动生成 · 非录取预测，仅供参考",
    en: "Observations from public data, generated automatically · not an admission prediction, for reference only",
  },
  "pf.caliber": {
    zh: "口径：数据来源为各校 Common Data Set 与官方发布（年份见下方）· 排名口径 US News 2026 · 录取率标注「推算值」处为按 CDS 推算 · 录取率、标化等字段以官网为准 · 数据更新 2026-08-11",
    en: "Notes: data comes from each school's Common Data Set and official releases (year below) · rankings: US News 2026 · “derived” marks a figure inferred from CDS · verify acceptance and testing figures on the school's own site · data updated 2026-08-11",
  },

  // —— 详情档案 15 节的标题 ——
  "sec.1": { zh: "排名", en: "Ranking" },
  "sec.2": { zh: "所在城市与州", en: "City & state" },
  "sec.3": { zh: "学费（不含食宿）", en: "Tuition (excl. room & board)" },
  "sec.4": { zh: "申请批次", en: "Application rounds" },
  "sec.5": { zh: "最近申请季截止日期", en: "Deadlines (latest cycle)" },
  "sec.6": { zh: "录取率（最近申请季）", en: "Admission rates (latest cycle)" },
  "sec.7": { zh: "申请人数（最近申请季）", en: "Applicants (latest cycle)" },
  "sec.8": { zh: "在读本科男女比例（男:女）", en: "Undergrad gender ratio (M:F)" },
  "sec.9": { zh: "本科国际生比例", en: "International share" },
  "sec.10": { zh: "语言要求与标化", en: "Language & testing" },
  "sec.11": { zh: "面试政策", en: "Interview policy" },
  "sec.12": { zh: "小文书", en: "Supplemental essays" },
  "sec.13": { zh: "院校气质", en: "Character" },
  "sec.14": { zh: "一句话点评", en: "One-line note" },
  "sec.15": { zh: "数据信号", en: "Data signals" },

  // —— 6.15 的已知限制：单语字段在英文模式下显示中文 + 一行说明 ——
  "note.zhOnly": {
    zh: "",
    en: "(This section is only available in Chinese.)",
  },

  // —— 对比浮窗 ——
  "cmp.title": { zh: "院校对比", en: "Compare schools" },
  "cmp.school": { zh: "学校", en: "School" },
  "cmp.band": { zh: "初步区间", en: "SAT band" },

  // —— 表格 ——
  "tbl.hint": {
    zh: "拖动滑块横向滚动 · 或点两侧箭头整屏平移 · 前两列冻结 · 点表头排序 · 点行回到地图",
    en: "Drag the slider or the arrows to scroll · first two columns frozen · click headers to sort · click a row to jump to the map",
  },
  "tbl.rows": { zh: "共 {n} 行 · 前两列冻结", en: "{n} rows · first two columns frozen" },
  "tbl.detail": { zh: "详情", en: "Detail" },

  // —— 地图 ——
  "map.hint": { zh: "滚轮缩放 · 拖拽平移 · 点击圆点看卡片", en: "Scroll to zoom · drag to pan · click a dot" },
  "map.hintTouch": { zh: "双指缩放 · 拖动平移 · 点击圆点看卡片", en: "Pinch to zoom · drag to pan · tap a dot" },
  "map.zoomIn": { zh: "放大", en: "Zoom in" },
  "map.zoomOut": { zh: "缩小", en: "Zoom out" },
  "map.zoomReset": { zh: "复位视图", en: "Reset view" },
  "map.aria": { zh: "美国院校分布地图", en: "Map of US colleges" },
  "map.empty": { zh: "没有符合条件的学校", en: "No schools match the filters" },
  "map.dismiss": { zh: "知道了", en: "Got it" },

  // —— 语境条（6.17 入口互通）——
  "ctx.fromChild": { zh: "来自成长画像 · {direction}方向", en: "From the growth profile · {direction}" },
  "ctx.fromChildNoDir": { zh: "来自成长画像", en: "From the growth profile" },
  "ctx.fromExplore": { zh: "来自现场全景", en: "From the live overview" },
  "ctx.note": {
    zh: "这里不按方向筛院校——数据里没有院校与方向的映射，硬筛等于编数据",
    en: "Schools are not filtered by direction — the dataset has no school-to-direction mapping",
  },
  "ctx.clear": { zh: "清除", en: "Clear" },

  // —— 空态与异常态（6.16）——
  "empty.filtered": { zh: "没有符合条件的学校", en: "No schools match the filters" },
  "empty.favs": { zh: "还没有收藏学校", en: "No schools in my list yet" },
  "empty.search": {
    zh: "本期收录 113 所 TOP 榜单院校，暂未收录该校。可试试相近校名",
    en: "This release covers 113 top-ranked schools and does not include that one. Try a similar name",
  },
  "empty.reset": { zh: "清除筛选", en: "Reset filters" },
  "empty.loading": { zh: "数据准备中", en: "Preparing data" },
  "empty.loadingHint": {
    zh: "页面数据在构建期编译进前端，若持续如此请联系活动工作人员重新构建",
    en: "Data is compiled at build time. If this persists, ask the event team to rebuild",
  },
  "empty.pane1": { zh: "点地图上的圆点", en: "Click a dot on the map" },
  "empty.pane2": { zh: "查看院校详情", en: "to see the school" },
  "drawer.open": { zh: "展开详情", en: "Open details" },
  "drawer.close": { zh: "收起详情", en: "Collapse details" },
  "warn.storage": {
    zh: "浏览器本地存储不可用：收藏、对比位与字号只在本次打开期间有效",
    en: "Local storage is unavailable: my-list, compare slots and font size last only for this session",
  },
  "warn.storageClose": { zh: "知道了", en: "Dismiss" },

  // —— 收藏健康度（6.13 D3）——
  "hint.title": { zh: "收藏健康度", en: "List check" },
  "hint.noBaseline": {
    zh: "清单里没有「较稳」档的院校，底盘偏空",
    en: "No “Steadier” school in the list — the base is thin",
  },
  "hint.restrictive":
    {
      zh: "清单里同时有限制性早申（REA / EAR）与 ED 院校：早申只能选一个，二者会互相占用名额",
      en: "The list mixes restrictive early (REA/EAR) and ED schools: you can only use one early option",
    },
  "hint.needSat": { zh: "输入 SAT 后可评估「较稳」档", en: "Enter an SAT score to check the “Steadier” band" },

  // —— 导出清单（6.13 D4）——
  "exp.button": { zh: "导出清单", en: "Export list" },
  "exp.title": { zh: "家庭选校清单", en: "Family shortlist" },
  "exp.subtitle": { zh: "自选院校 · 共 {n} 所", en: "Selected schools · {n} total" },
  "exp.back": { zh: "返回选校地图", en: "Back to the map" },
  "exp.print": { zh: "打印 / 存为 PDF", en: "Print / save as PDF" },
  "exp.empty": { zh: "还没有收藏学校。回到地图，点院校卡片或表格行里的星标即可加入。", en: "No schools in the list yet. Star a school on the map or in the table first." },
  "exp.col.rank": { zh: "排名", en: "Rank" },
  "exp.col.school": { zh: "学校", en: "School" },
  "exp.col.city": { zh: "城市", en: "City" },
  "exp.col.acc": { zh: "录取率", en: "Acceptance" },
  "exp.col.ddl": { zh: "截止日期", en: "Deadlines" },
  "exp.col.sat": { zh: "SAT 中位 50%", en: "SAT mid 50%" },
  "exp.col.tuition": { zh: "学费", en: "Tuition" },
  "exp.col.note": { zh: "家庭备注", en: "Family notes" },
  "exp.footer": {
    zh: "数据来源：各校 Common Data Set（2024-25 / 2025-26）与官方发布 · 排名口径 US News 2026 · 标注「推算值」处为按 CDS 推算 · 录取率、标化等字段以官网为准 · 数据更新 2026-08-11",
    en: "Source: each school's Common Data Set (2024-25 / 2025-26) and official releases · Rankings: US News 2026 · “derived” marks a figure inferred from CDS · verify all figures on the school's own site · data updated 2026-08-11",
  },

  // —— 数据值（枚举 / 空值 / 单位）——
  "data.na": { zh: "未公布", en: "Not published" },
  "data.unranked": { zh: "未上榜", en: "Not ranked" },
  "data.dash": { zh: "—", en: "—" },
  "data.women": { zh: "女子学院", en: "Women's college" },
  "data.womenShort": { zh: "女校", en: "Women's" },
  "data.noEarly": { zh: "无早申（单轮申请）", en: "No early round (single round)" },
  "data.noEarlyShort": { zh: "无早申", en: "No early round" },
  "data.noEssay": { zh: "N/A（无小文书）", en: "N/A (no supplemental essay)" },
  "data.seeSite": { zh: "见官网", en: "See school site" },
  "data.people": { zh: "{n} 人", en: "{n}" },
  "data.rankUni": { zh: "综合大学榜", en: "National universities" },
  "data.rankLac": { zh: "文理学院榜", en: "Liberal arts colleges" },
  "data.rankThisYear": { zh: "US News 2026（全美）", en: "US News 2026 (national)" },
  "data.rankQs": { zh: "QS 世界大学排名 2026", en: "QS World 2026" },
  "data.qsNa": { zh: "文理学院不参与主榜", en: "LACs are not ranked in the main QS table" },
  "data.typeUniPri": { zh: "私立综合性大学", en: "Private national university" },
  "data.typeUniPub": { zh: "公立综合性大学", en: "Public national university" },
  "data.typeLac": { zh: "文理学院", en: "Liberal arts college" },
  "data.typeShortPri": { zh: "私立", en: "Private" },
  "data.typeShortPub": { zh: "公立", en: "Public" },
  "data.typeShortLac": { zh: "文理", en: "LAC" },
  "data.test.req": { zh: "标化必交", en: "Tests required" },
  "data.test.opt": { zh: "标化可选", en: "Test optional" },
  "data.test.flex": { zh: "标化灵活", en: "Test flexible" },
  "data.test.blind": { zh: "不看标化", en: "Test blind" },
  "data.testShort.req": { zh: "必交", en: "Required" },
  "data.testShort.opt": { zh: "可选", en: "Optional" },
  "data.testShort.flex": { zh: "灵活", en: "Flexible" },
  "data.testShort.blind": { zh: "不看", en: "Blind" },
  "data.ivw.req": { zh: "必须面试", en: "Interview required" },
  "data.ivw.rec": { zh: "官方推荐", en: "Recommended" },
  "data.ivw.opt": { zh: "可选", en: "Optional" },
  "data.ivw.inv": { zh: "仅邀请", en: "By invitation only" },
  "data.ivw.none": { zh: "无面试", en: "No interview" },
  "data.ivw.unv": { zh: "未核实", en: "Not verified" },
  "data.ivwShort.req": { zh: "必须", en: "Required" },
  "data.ivwShort.rec": { zh: "官方推荐", en: "Recomm." },
  "data.ivwShort.opt": { zh: "可选", en: "Optional" },
  "data.ivwShort.inv": { zh: "仅邀请", en: "Invite" },
  "data.ivwShort.none": { zh: "无面试", en: "None" },
  "data.ivwShort.unv": { zh: "未核实", en: "Unverified" },
  "data.ivwThirdParty": { zh: "官方鼓励第三方面试", en: "Third-party interview encouraged" },
  "data.idef.id": { zh: "按国籍/永居身份区分", en: "By citizenship / permanent residency" },
  "data.idef.hs": { zh: "按高中所在地区分", en: "By location of high school" },
  "data.idef.both": { zh: "既按国籍/永居，又按高中所在地", en: "By citizenship and by high-school location" },
  "data.idefShort.id": { zh: "按国籍", en: "Citizenship" },
  "data.idefShort.hs": { zh: "按高中地", en: "High school" },
  "data.idefShort.both": { zh: "两者兼看", en: "Both" },
  "data.rounds": { zh: "申请批次", en: "Rounds" },
  "data.idefTitle": { zh: "该校如何认定「国际生」", en: "How this school defines “international”" },
  "data.srcNote": { zh: "官网来源：{url} · 2026.8 核查", en: "Source: {url} · verified Aug 2026" },

  // —— 详情档案的分节小标签（15 节内部）——
  "pf.earlyDdl": { zh: "早申截止", en: "Early deadline" },
  "pf.rdDdl": { zh: "RD 截止", en: "RD deadline" },
  "pf.er": { zh: "早申录取率", en: "Early acceptance" },
  "pf.rr": { zh: "RD 录取率", en: "RD acceptance" },
  "pf.acc": { zh: "整体录取率", en: "Overall acceptance" },
  "pf.tr": { zh: "转学录取率", en: "Transfer acceptance" },
  "pf.lever": { zh: "早申杠杆（早申 ÷ RD）", en: "Early leverage (early ÷ RD)" },
  "pf.extrapolated": { zh: "推算值", en: "derived" },
  "pf.applicants": { zh: "申请人数", en: "Applicants" },
  "pf.satPolicy": { zh: "SAT 政策", en: "SAT policy" },
  "pf.satMid": { zh: "SAT 中位 50%", en: "SAT mid 50%" },
  "pf.toefl": { zh: "TOEFL", en: "TOEFL" },
  "pf.ielts": { zh: "IELTS", en: "IELTS" },
  "pf.band": { zh: "初步区间：{band}", en: "SAT band: {band}" },
  "pf.essayWords": { zh: "{w}", en: "{w}" },

  // —— 表格列名 ——
  "col.rank": { zh: "排名·较去年", en: "Rank (Δ)" },
  "col.school": { zh: "学校", en: "School" },
  "col.city": { zh: "所在城市", en: "City" },
  "col.qs": { zh: "QS世界", en: "QS" },
  "col.acc": { zh: "录取率", en: "Acceptance" },
  "col.er": { zh: "早申录取率", en: "Early acc." },
  "col.rr": { zh: "RD录取率", en: "RD acc." },
  "col.tr": { zh: "转学录取率", en: "Transfer acc." },
  "col.apps": { zh: "申请人数", en: "Applicants" },
  "col.intl": { zh: "国际生比例", en: "Intl share" },
  "col.idef": { zh: "国际生认定", en: "Intl defined by" },
  "col.mf": { zh: "男女比", en: "M:F" },
  "col.gpa": { zh: "平均GPA", en: "Avg GPA" },
  "col.lang": { zh: "TOEFL / IELTS", en: "TOEFL / IELTS" },
  "col.sat": { zh: "SAT中位50%", en: "SAT mid 50%" },
  "col.test": { zh: "标化政策", en: "Testing" },
  "col.ivw": { zh: "面试政策", en: "Interview" },
  "col.rounds": { zh: "申请批次", en: "Rounds" },
  "col.ddl": { zh: "截止日期", en: "Deadlines" },
  "col.tuition": { zh: "学费", en: "Tuition" },
  "col.tags": { zh: "院校气质", en: "Character" },
  "col.note": { zh: "一句话点评", en: "One-line note" },
  "tbl.shiftLeft": { zh: "向左平移", en: "Scroll left" },
  "tbl.shiftRight": { zh: "向右平移", en: "Scroll right" },

  // —— 黑马匹配的其余文案（H 组）——
  "mt.title": { zh: "SAT 初步区间", en: "SAT band" },
  "mt.intro": {
    zh: "输入孩子当前（或目标）的 SAT 成绩，全部 113 所院校会标注初步区间：",
    en: "Enter the student's current (or target) SAT score. All 113 schools get a band:",
  },
  "mt.introEnd": { zh: "。", en: "." },
  "mt.field": { zh: "SAT 成绩（{lo}–{hi}）", en: "SAT score ({lo}–{hi})" },
  "mt.error": { zh: "请输入 {lo} 到 {hi} 之间的整数", en: "Enter a whole number between {lo} and {hi}" },
  "mt.apply": { zh: "开始匹配", en: "Apply" },
  "mt.clear": { zh: "清除匹配", en: "Clear match" },
  "mt.close": { zh: "关闭", en: "Close" },
  "mt.whyHead": { zh: "判断依据", en: "How this band was derived" },
  "mt.whySatHigh": { zh: "SAT {sat} 高于中位区间上沿（该校 {band}）", en: "SAT {sat} is above the mid-50% top (school: {band})" },
  "mt.whySatUpper": { zh: "SAT {sat} 位于中位区间上半段（该校 {band}）", en: "SAT {sat} is in the upper half (school: {band})" },
  "mt.whySatLower": { zh: "SAT {sat} 位于中位区间下半段（该校 {band}）", en: "SAT {sat} is in the lower half (school: {band})" },
  "mt.whySatLow": { zh: "SAT {sat} 低于中位区间下沿（该校 {band}）", en: "SAT {sat} is below the mid-50% bottom (school: {band})" },
  "mt.whyNoBand": { zh: "该校不看标化或未公布 SAT 区间，仅按录取率参考", en: "This school is test-blind or publishes no SAT band; only acceptance rate is used" },
  "mt.whyAcc": { zh: "整体录取率 {acc}", en: "Overall acceptance {acc}" },
  "mt.whyAccLow": { zh: "整体录取率 {acc}（低于 10%，对所有人都不轻松）", en: "Overall acceptance {acc} (under 10% — demanding for everyone)" },
  "mt.whyExcluded": {
    zh: "未纳入：GPA 与课程体系 / 专业与学院 / 国际生身份 / 资助需求 / 申请批次",
    en: "Not included: GPA and curriculum / major and college / international status / financial need / application round",
  },
  "mt.whyConfidence": { zh: "置信度：低 · 仅供参考，不构成录取预测", en: "Confidence: low · reference only, not an admission prediction" },
  "mt.disclaimer": {
    zh: "「初步区间」仅基于「SAT 中位区间 × 整体录取率」两个维度，未纳入 GPA 与课程难度、申请专业与学院、国际生身份与就读高中位置、资助需求、ED/EA/RD 批次等关键因素，置信度低，不构成录取预测或承诺。",
    en: "The “band” uses only the SAT mid-50% and the overall acceptance rate. It excludes GPA and course rigour, intended major and college, international status and high-school location, financial need and application round, so confidence is low and it is not an admission prediction or promise.",
  },
  "mt.bandHead": { zh: "初步区间", en: "SAT band" },

  // —— 6.15：单语字段在英文模式下的说明 ——
  "zhOnly.section": {
    zh: "",
    en: "This section comes from Chinese-only source data and is shown in Chinese.",
  },

  // —— 全局 ——
  "global.backTop": { zh: "回到顶部", en: "Back to top" },
  "global.lang": { zh: "English", en: "中文" },
  "global.font": { zh: "字号", en: "Font size" },
} as const satisfies Record<string, Entry>;

export type TextKey = keyof typeof TEXT;

/** 取词条，并把 {n} / {sat} / {fav} 这类占位替换掉。 */
export function t(lang: Lang, key: TextKey, vars?: Record<string, string | number>): string {
  let s: string = TEXT[key][lang];
  if (vars) {
    for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  }
  return s;
}
