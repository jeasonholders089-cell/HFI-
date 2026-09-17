# 院校坐标表 · 来源与版本

| 项 | 内容 |
| --- | --- |
| 数据源 | College Scorecard（美国教育部）· `Most-Recent-Cohorts-Institution` |
| 下载地址 | https://ed-public-download.scorecard.network/downloads/Most-Recent-Cohorts-Institution_06102026.zip |
| 数据页 | https://collegescorecard.ed.gov/data/ |
| 版本日期 | 2026-06-10 |
| 提取条件 | `ICLEVEL = 1`（4 年制） **AND** `MAIN = 1`（主校区） |
| 产物 | `data/university-coords.csv` —— 2468 行 × 6 列（unitid / name_en / city / st / lat / lng） |
| 提取脚本 | `src/scripts/extract-university-coords.ts`（一次性，不参与日常构建） |

## 许可

美国联邦政府公开数据（U.S. Department of Education, College Scorecard）。
公开数据无版权限制，引用时注明来源与版本即可。

## 为什么筛 `MAIN = 1`

同一所学校在官方目录里会按校区出现多条（例：`Pratt Institute-Main` 与
`Pratt Manhattan-A Division of Pratt Institute`）。不过滤会在同一座城市重复打点。
只保留主校区后，4 年制机构剩 2468 所，坐标无空值。

## 重新生成

```
pnpm build:extract-coords   # Scorecard CSV → data/university-coords.csv
pnpm build:coords           # data/university-coords.csv → src/lib/university-coords.ts
```

Scorecard 换版本时，先更新 `src/scripts/extract-university-coords.ts` 顶部的
`SOURCE_URL` / `SOURCE_VERSION`，再从 https://collegescorecard.ed.gov/data/ 取当前链接。
