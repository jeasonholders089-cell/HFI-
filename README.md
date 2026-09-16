# HFI 家长成长营

线下活动现场用的成长探索工具。家长填写孩子的兴趣与回答，AI 勾勒出成长方向，
看到这些方向通向哪些美国本科专业与院校，所有数据匿名汇总后在现场大屏呈现。

**重心是成长探索，不是升学规划。** 院校和专业是让方向"看得见"的落点，不是要去考的目标。

---

## 现在做到哪了

| 模块 | 路由 | 状态 |
| --- | --- | --- |
| 首页（两条路径入口 + 实时摘要） | `/` | 可用 |
| 家长自助填写 | `/register` | 可用 |
| 现场全景（方向统计 / 词云 / AI 分析） | `/explore` | 可用 |
| 工作人员单条访谈录入 | `/entry` | 未开发 |
| 孩子成长画像 | `/child/[token]` | 未开发 |
| 提交成功页 | `/register/success` | 未开发 |
| 选校地图 | `/colleges` | 未开发，规格已定稿 |

活动当天现场还有一个用法：首页的**批量录入**支持 Excel 和文本两种方式，
工作人员可以先把访谈记录整理好一次性导入，再在 `/explore` 里逐条跑 AI 分析。

---

## 技术栈

- **框架**：Next.js 16（App Router）+ React 19 + TypeScript 5
- **样式**：Tailwind CSS 4，主题色写在 `app/globals.css`
- **数据库**：Postgres，经 Drizzle ORM 访问，迁移文件版本化在 `drizzle/`
- **AI**：`@inferencesh/sdk`，走平台代理调用，模型 `anthropic/claude-haiku-4-5`
- **包管理**：pnpm
- **部署**：平台托管（见 `compose.yaml`），不要用 git push 部署

---

## 本地跑起来

**前置**：Node 20+、pnpm、一个能连的 Postgres。

```bash
cd src                        # 应用目录
pnpm install
pnpm dev                 # http://localhost:3000
```

本地数据库的连接串在 `src/.env`，默认指向本机 Postgres 的 **5434** 端口：

```
DATABASE_URL=postgres://...@127.0.0.1:5434/...
```

> 要自己起一个本地 Postgres 的话，注意端口是 5434 而不是默认的 5432——
> 这是为了不和机器上已有的实例打架。

### 环境变量

| 变量 | 说明 |
| --- | --- |
| `DATABASE_URL` | Postgres 连接串。托管库带 `sslmode=require`，代码里已处理自签证书问题 |
| `NEXT_PUBLIC_INFERENCE_PROXY_URL` | AI 推理代理地址。**build 期会被打进客户端 bundle**，改完要重新 build |
| `LUFFY_PREVIEW_ORIGINS` | 预览反代域名，供 dev 模式放行跨源；由平台注入，本地不用管 |

**密钥不进代码。** AI 的 key 由平台代理持有，前端只拿代理地址，客户端不出现 apiKey。

### 数据库

改完 `db/schema.ts` 之后：

```bash
pnpm exec drizzle-kit generate     # 产出 drizzle/ 下的版本化 SQL，与代码一起提交
pnpm exec drizzle-kit migrate      # 应用迁移（平台发布时也会自动执行）
```

三条纪律，写在 `db/schema.ts` 和 `drizzle.config.ts` 的注释里，这里再强调一次：

1. 表结构**只在** `db/schema.ts` 声明，业务代码一律经 `lib/db.ts` 的 `getDb()` 读写；
2. 不要手写 `CREATE` / `ALTER` SQL；
3. **不要用 `drizzle-kit push` 打生产**——它是开发期 sync，`--force` 会静默删列。

---

## 部署

平台托管，配置在 `compose.yaml` 的标签里：

```
luffy.entrypoint=true       对外服务
luffy.port=3000             端口
luffy.database=postgres     平台供给托管 Postgres 并注入 DATABASE_URL
luffy.migrate=...           切换新版前执行一次迁移
```

不要写 `ports` / `privileged` / host 网络，平台会自己处理资源限制和反代。

---

## 目录说明

```
AGENTS.md           项目规范（最高约定，动手前先读）
README.md           本文件
docs/               需求、规格、界面草图
output/pdf/         对外交付物
scripts/            开发辅助脚本
tmp/                临时文件（不进版本库）
src/                应用代码（Next.js 项目根）
```

应用内部：

```
app/                页面与接口（App Router）
  page.tsx          首页
  register/         家长自助填写
  explore/          现场全景
  api/children/     数据接口
db/schema.ts        全部表结构（唯一来源）
drizzle/            版本化迁移 SQL（不要手改）
lib/                db / inference / 领域逻辑
```

---

## 几件要知道的事

**根目录的 `.env` 不是这个项目的。** 它内容是另一个项目（MySQL + 云服务器）的配置，
本项目应用读的是 `src/.env`。这个文件没进版本库，但放在这里会误导人，
后续应当移走。

**应用代码已纳入 git**（提交 `0f06eb3`）。目录已从 `HFI-a3e3bf9e/` 改名为 `src/`。

**第一版规划的文档已归档**，放在项目外的 `F:\AI_Agent\HFI一版文档\`，里面有四份：
需求梳理、产品 PRD、地图模块需求方案、全站界面草图，外加原始对话记录目录。
它们是第一版的记录，**不要当成当前规格用**；当前有效的只有 `docs/` 下的两份选校地图文档。

---

## 相关文档

- 项目规范与边界：[AGENTS.md](AGENTS.md)
- 选校地图规格：[docs/05-选校地图模块.md](docs/05-选校地图模块.md)
- 选校地图界面：[docs/06-选校地图-界面草图.md](docs/06-选校地图-界面草图.md)
