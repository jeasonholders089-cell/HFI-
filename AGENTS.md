# HFI 家长成长营 · 项目工作规范

> 本文件是本项目的最高约定。任何开发、文档、数据操作前先读这里。
> **本文件以实际代码为准书写**（2026-09-17 与 `src/` 逐项核对过）。
> 文档与代码冲突时，以代码为准，然后改文档——既不让文档跑到代码前面，也不让文档落后于代码。
> 规范的修改方式是：先改本文件，再改实践。

---

## 一、项目定位

**面向 C 端（家长）的产品**，线下活动是它的第一个使用场景。

家长通过两条并列路径之一，**看见孩子的成长方向**——从兴趣与特质出发，看到这些方向通向
哪些美国本科专业、哪些院校、未来可以怎么走；所有数据匿名汇总后，在现场大屏呈现出来。

**重心是成长探索与成长方向探索，不是升学规划。**
院校和专业是让方向"看得见"的落点，不是要去考的目标。

**产品的核心链条（任何设计都不能断掉这条链）：**

```
兴趣特质 → 成长方向 → 方向在世界上通向哪里（专业 / 院校 / 路径） → 地图
```

**不可逾越的底线：不预测录取结果，不使用"冲刺 / 匹配 / 保底"话术，不判定孩子适合什么。
只给路径，不给结论。**（唯一例外见第五节。）

**一期不建院校-专业库**：院校与专业由 AI 直接推荐，准确度靠 Prompt 约束 + "以官网为准" +
官网链接三道兜底。院校坐标表已导入（2026-09-17）：`data/university-coords.csv`（College
Scorecard 的 4 年制主校区，2468 所）→ `src/lib/university-coords.ts`，
匹配靠 `lib/university-names.ts` 的中英文别名表（69 条）+ `lib/school-locate.ts`
（别名 / 精确 / 唯一包含 / 人工覆盖四级，命中不唯一就算未命中）。

产品正式名称：**HFI 家长成长营**（英文名 HFI Family Growth Camp，用于英文界面与大屏）。

---

## 二、页面与接口（以代码为准）

| 路由 | 说明 | 状态 |
| --- | --- | --- |
| `/` | 首页：两条路径入口 + 实时摘要 + 批量录入 + AI 试用框 | 已建 |
| `/register` | 家长自助填写，单页八字段（英文名 / 年龄 / 梦想学校 / 兴趣 / 喜欢的活动 / 孩子自述 / 家长观察 / 梦想职业选填） | 已建 |
| `/explore` | 现场全景：方向统计、特质词云、逐条 AI 分析、数据清空 | 已建 |
| `/entry` | 工作人员单条访谈录入（需访问口令） | 未建 |
| `/child/[token]` | 孩子成长画像，凭短码回看 | 未建 |
| `/register/success` | 提交成功：轻画像 + 回看码 | 未建 |
| `/colleges` | 选校地图：地图 / 表格两个视图、5 个筛选器、洞察榜、黑马匹配、对比位、收藏与导出、中英切换、字号三档 | 已建 |

接口（全部已建）：`/api/health`、`/api/children`、`/api/children/bulk`、
`/api/children/analyze`、`/api/children/summary`、`/api/children/wordcloud`、
`/api/children/clear`、`/api/children/[id]`。

**两条用户路径：**

| 路径 | 当前入口 | 使用者 |
| --- | --- | --- |
| A · 家长自助填写 | `/register`，零注册 | 家长（手机） |
| B · 工作人员录入 | 首页的批量录入（Excel / 文本）；`/entry` 单条访谈录入页未建 | 工作人员（电脑） |

---

## 三、目录结构

```
AGENTS.md                # 本文件：项目规范
README.md                # 给接手的人看：定位、技术栈、本地起服务、部署
docs/                    # 需求、规格、界面草图、技术方案、评审记录
output/pdf/              # 面向外部的交付物成品（当前为空）
data/                    # 种子数据与构建产物输入（选校地图 CSV、州界 TopoJSON、
                         # 院校坐标表 university-coords.csv + 人工覆盖表）
scripts/                 # 开发辅助脚本（md_to_pdf.py、选校地图的构建脚本）
src/                     # 应用代码与部署配置（Next.js 项目根）
tmp/                     # 临时文件（已被 .gitignore 忽略）
```

**应用内部结构**（`src/`）：

```
app/                     # Next.js App Router
  page.tsx               # 首页（含批量录入、二维码、AI 试用）
  register/page.tsx      # 家长自助填写
  explore/page.tsx       # 现场全景
  colleges/page.tsx      # 选校地图（状态装配 + 布局 + 语境条 + 空态）
  api/children/...       # 数据接口
  layout.tsx globals.css
components/
  site-nav.tsx           # 四个页面共用的导航
  colleges/              # 选校地图的组件（地图 / 工具栏 / 档案 / 对比 / 表格 / 导出）
db/schema.ts             # 全部表结构定义（唯一）
drizzle/                 # 版本化迁移 SQL + meta（不要手改）
lib/                     # db / inference / 领域逻辑 / 选校地图的字段契约与产物
public/                  # 静态资源
compose.yaml Dockerfile  # 平台部署配置
```

**已完成改名**：应用目录 `HFI-a3e3bf9e/` → **`src/`**（2026-09-17），历史压缩包已移入 `tmp/`。

---

## 四、命名约定

| 类型 | 规则 | 示例 |
| --- | --- | --- |
| 文档 | `NN-主题.md`，编号即阅读顺序 | `05-选校地图模块.md` |
| 种子数据 | `snake_case` + 扩展名 | `university_coords.csv` |
| 数据库表 | `snake_case` 复数 | `children`、`app_meta` |
| 数据库字段 | 代码里 camelCase，库里 snake_case | `submissionKey` → `submission_key` |
| React 组件 | `PascalCase.tsx` | `UniversityMap.tsx` |
| 工具函数 | `camelCase.ts` | `growth-categories.ts` |
| commit | 英文，前缀 `feat/fix/docs/chore` | `feat: add registration form` |

---

## 五、不可逾越的产品边界

- 公开页面（大屏、首页）**不得**出现"孩子姓名 + 个人画像"的组合。
- AI 输出必须是"发展方向探索"，不得表述为"判定 / 适合 / 应该"。
- 单孩子画像页面**不得**使用可遍历的自增 ID，必须使用随机 token。
- 未获得家长知情同意前，不采集、不分析、不展示该儿童数据。
- **不采集真实姓名、手机号、微信、身份证、照片**。表单里的"英文名"是昵称性质，不要求真名。
- 删除类接口必须校验同源（现有 `/api/children/clear` 与 `/api/children/[id]` 都是这个做法）。

### 唯一的例外：`/colleges` 的黑马匹配

2026-09-17 产品决策：允许 `/colleges` 选校地图的「黑马匹配」把院校标注为
「偏冲 / 冲·适中 / 适中 / 较稳」四档。**这是全站唯一允许出现该话术的地方**，三条约束缺一不可：

1. **只出现在 `/colleges`**——首页、大屏 `/explore`、孩子画像 `/child/[token]` 不得出现；
2. **必须常驻显示局限说明**——仅基于「SAT 中位区间 × 整体录取率」两个维度，未纳入 GPA、
   课程难度、申请专业、国际生身份、资助需求、批次等因素，置信度低，不构成录取预测或承诺；
3. **不得与个体画像绑定**——不得出现"某个孩子的名字 + 匹配档位"的组合。

---

## 六、技术现状（以代码为准）

| 项 | 事实 |
| --- | --- |
| 框架 | Next.js 16.2.6（App Router）+ React 19.2.4 + TypeScript 5 |
| 样式 | Tailwind CSS 4；主题色定义在 `app/globals.css`（底色 `#f4f0e6`，主色 `#17382f`） |
| 包管理 | pnpm（Dockerfile 里 pin pnpm@10，配淘宝 registry 加速） |
| 数据库 | Postgres，经 Drizzle ORM（`drizzle-orm` 0.44.2 + `drizzle-kit` 0.31.4 + `pg`） |
| AI | `@inferencesh/sdk` 走**平台代理**调用；模型写死 `anthropic/claude-haiku-4-5` |
| 表格导入 | `xlsx`（首页的 Excel 批量录入） |
| 二维码 | `qrcode`（首页生成手机问卷二维码） |

### AI 接法的三条硬规矩

1. **key 永远不落前端**——走 `NEXT_PUBLIC_INFERENCE_PROXY_URL` 指向的平台代理，
   客户端不出现 apiKey。
2. **重试只在 `lib/inference.ts` 里做**——平台有并发闸（每用户同时 3 个任务），
   提交撞闸时按 3s / 6s / 12s 指数退避；业务代码禁止自写重试循环。
3. **AI 出参一律走容错解析**，且失败不阻断入库——现有做法是问卷先落库，AI 失败返回 202
   并提示"可在活动全景点击开始分析"。

### 方向分类体系（4 类，以代码为准）

`人文科学` · `社会科学` · `自然科学` · `艺术`（见 `lib/growth-categories.ts`）。
Prompt 里写死了归类规则：工程计算机归自然科学，商科归社会科学，设计归艺术。
AI 必须恰好输出 3 个方向，每个方向的 `category` 必须是这 4 类之一。

### 数据库纪律

- 表结构只在 `db/schema.ts` 声明；业务代码一律经 `lib/db.ts` 的 `getDb()` 读写，
  **禁止 `new Pool`、禁止手写 DDL**。
- 改 schema 后跑 `pnpm exec drizzle-kit generate` 产出 `drizzle/` 下的版本化 SQL，与代码一起提交。
- 应用与发布**只 apply 已生成的迁移**（平台按 `compose.yaml` 的 `luffy.migrate` 执行 `drizzle-kit migrate`）。
- **禁止 `drizzle-kit push` 打生产**——push 是开发期 sync，`--force` 会静默删列毁数据。

当前两张表：`children`（问卷 + AI 结果）、`app_meta`。AI 结果直接存在 `children` 的
`ai_directions` / `ai_traits` / `ai_summary` 三个字段里，没有独立的分析表。

### 部署

平台托管，**不要用 git push 部署**。配置写在 `compose.yaml` 的标签里：
`luffy.entrypoint` / `luffy.port=3000` / `luffy.database=postgres` /
`luffy.migrate=pnpm exec drizzle-kit migrate`。不要写 `ports` / `privileged` / host 网络。

### 环境变量

| 变量 | 用途 |
| --- | --- |
| `DATABASE_URL` | 平台注入的 Postgres 连接串（托管库带 `sslmode=require`，见 `lib/pg-dsn.ts`） |
| `NEXT_PUBLIC_INFERENCE_PROXY_URL` | 推理代理地址；build 期会被嵌进客户端 bundle |
| `LUFFY_PREVIEW_ORIGINS` | 沙箱预览反代域名，供 Next dev 放行跨源（见 `next.config.ts`） |

> **根目录已无 `.env`。** 之前那份 161 行的配置属于另一个项目（MySQL、云服务器 IP 明文、
> `PORT` / `FRONTEND_URL`），已于 2026-09-17 移到仓库外：
> `F:\AI_Agent\HFI家长成长营-根目录遗留.env`。本项目应用读的是 `src/.env`，
> 目前只有一行 `DATABASE_URL`，指向本地 Postgres（**注意端口是 5434 不是 5432**）。

---

## 七、工作规则

1. **先文档后代码**：需求变化先更新 `docs/`，再动代码。
2. **先数据后页面**：新功能先定义数据结构，再设计界面。
3. **数据最小化**：见第五节。
4. **密钥只放 `.env`**：任何密钥、Token 不写进代码，不提交到仓库。
5. **改完必验**：跑 `pnpm build` / `pnpm lint`，并手动走通该模块的关键路径。
6. **语言约定**：文档用中文；代码、变量名、commit message 用英文。
7. **一里程碑一提交**：每完成一个里程碑打一次 commit，保证可回退。
8. **面向现场设计**：任何功能先问"活动当天现场网络不稳、家长在排队、屏幕上正开着展示页"
   时还能不能用。

---

## 八、当前阶段

**已完成**

- 应用骨架跑通：Next.js App Router + Postgres + Drizzle 版本化迁移（4 个迁移）
- 家长自助填写 `/register`（单页八字段，含幂等提交与字段校验）
- 首页 `/`：两条路径入口 + 实时摘要 + 批量录入（Excel / 文本）+ 问卷二维码 + AI 试用框
- 现场全景 `/explore`：方向统计、特质词云、逐条 AI 分析（带进度与失败记录）、数据清空
- AI 接入：走平台代理，模型 `anthropic/claude-haiku-4-5`，4 类方向分类
- 8 个数据接口

**进行中**

- 选校地图的现场走查（`docs/09` 第 7.5 节十二条）：室内可自动化的部分已完成，
  剩下 375px 手机、Slow 3G、大屏与 8 小时长跑需要在真机上人工过一遍

**未开始**

- `/entry` 工作人员单条访谈录入
- `/child/[token]` 孩子成长画像（产品的价值交付页）
- `/register/success` 提交成功页
- 现场全景第一屏的梦想院校地图（坐标表与匹配管线已就绪，见 `docs/10` / `docs/11`）

**选校地图已完成的部分（按里程碑）**

- M1 数据管道：`scripts/extract-colleges.ts` / `build-us-map.ts` / `build-colleges.ts`，
  四道闸校验，`data/colleges.csv`（113 × 46）→ `lib/colleges-data.ts`
- M2 地图：底图三层（海洋渐变 / 邻国陆地 / 美国本土 49 州 + 阿拉斯加与夏威夷插图，
  美国这一层带投影）、113 个圆点、四类标注、缩放平移（含捏合与双击）、
  最近点拾取、点位散开、标签避让、州悬停高亮
- M3 详情与对比：15 节档案、三格对比位状态机、对比浮窗（23 行 / 8 行高亮）
- M4 筛选 / 搜索 / 排序 / 洞察榜 / 黑马匹配
- M5 收藏与导出：星标、只看收藏、健康度提示、A4 横向打印清单
- M6 收尾：中英切换、字号三档、空态与异常态、移动端抽屉、入口互通、共享导航

---

## 九、待归位（与本规范不符、尚未处理的现状）

1. ~~应用代码没进版本库~~ —— **已完成**。已在提交 `0f06eb3` 纳入 git（51 个文件）。
2. ~~目录改名~~ —— **已完成**。`HFI-a3e3bf9e/` → `src/`（2026-09-17），
   历史压缩包 `HFI-a3e3bf9e.tar.gz` 已移入 `tmp/`。
3. ~~根目录 `.env`~~ —— **已完成**（2026-09-17）。那份 161 行的配置属于另一个项目
   （MySQL + 云服务器 IP），已移到仓库外：`F:\AI_Agent\HFI家长成长营-根目录遗留.env`。
4. ~~`package.json` 的 `name`~~ —— **已完成**，已改为 `hfi-family-growth-camp`。

5. ~~未收尾的代码改动~~ —— **已收尾**（2026-09-17）。写库侧早已停止写 `aiTraits` /
   `aiSummary`；本次删掉了 `/api/children/summary` 里从废弃 `aiTraits` 聚合 `traits`
   的死代码（它永远返回 `{}`，且没有任何页面读它），以及 `/explore` 的类型残留。
   `children` 表的 `ai_traits` / `ai_summary` 两列**先留着当历史残留，不删**——
   删列是对生产库不可逆的操作，等 `/child/[token]` 画像页定型后再一次性决定。

6. **`/api/children/summary` 接口未脱敏（已登记的已知风险）**——它返回 `children: rows`
   全字段，`englishName` 和 `aiDirections` 一起发到浏览器。`/explore` 的界面虽然已经
   不渲染姓名，但打开 devtools 就能拿到「英文名 → 方向」的配对，**这正是第五节禁止的组合**。
   2026-09-17 决定一期不修（当前用不到），但这是规范层面的缺口，二期必须处理。
