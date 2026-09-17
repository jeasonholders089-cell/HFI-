"use client";

import { formatField, formatGenderRatio } from "@/lib/colleges-format";
import type { College } from "@/lib/colleges-data";
import { visibleSignals } from "@/lib/colleges-signals";

/**
 * 浏览位：15 节档案（docs/06 第五节 / docs/08 §6.19）。
 *
 * 纪律：
 *   - 节顺序照原样，不重排、不删节；
 *   - 空值统一走 formatField，不写 `value || "未公布"`；
 *   - 第 15 节是唯一条件渲染的一节（无信号时整节不出现），上限 6 条；
 *   - 节里**不得出现**「小助手 / 顾问 / 私信 / 定位报告」等第三方话术（评审 M2）。
 */
type Props = {
  college: College;
  inSlot: boolean;
  slotsFull: boolean;
  onToggleSlot: () => void;
  onClose: () => void;
};

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-dashed border-[#d6d2c7] px-5 py-4 first:border-t-0">
      <h3 className="flex items-baseline gap-2 text-sm font-medium text-[#17382f]">
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded bg-[#f0e6d8] px-1 text-[11px] font-bold text-[#8b6f45]">
          {n}
        </span>
        {title}
      </h3>
      <div className="mt-2 text-sm leading-6 text-[#17382f]">{children}</div>
    </section>
  );
}

function Cell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-[#f2ede4] px-3 py-2">
      <div className="text-[11px] text-[#68786e]">{label}</div>
      <div className="mt-0.5 font-medium">{value}</div>
    </div>
  );
}

export function SchoolProfile({ college: c, inSlot, slotsFull, onToggleSlot, onClose }: Props) {
  const signals = visibleSignals(c);
  const essays = JSON.parse(c.essays) as { t: string; w: string }[];

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-[#d6d2c7] bg-[#17382f] px-5 py-4 text-white">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl leading-tight">{c.zh}</h2>
            <p className="mt-1 text-xs text-white/70">{c.en}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="h-7 w-7 shrink-0 rounded-md bg-white/15 text-sm text-white/80 hover:bg-white/25"
          >
            ✕
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-auto">
        <Section n={1} title="排名">
          <div className="grid grid-cols-2 gap-2">
            <Cell label="US News 2026（全美）" value={`#${c.rank} · ${c.type === "uni" ? "综合大学榜" : "文理学院榜"}`} />
            <Cell label="QS 世界大学排名 2026" value={c.qs ? `#${c.qs}` : c.type === "lac" ? "文理学院不参与主榜" : "未上榜"} />
          </div>
        </Section>

        <Section n={2} title="所在城市与州">
          <b>
            {c.city}, {c.st}
          </b>{" "}
          · {c.cz}
        </Section>

        <Section n={3} title="学费（不含食宿）">
          <b>{formatField(c.tuition)}</b>
        </Section>

        <Section n={4} title="申请批次">
          <div className="flex flex-wrap gap-1.5">
            {c.roundsArr.map((r) => (
              <span key={r} className="rounded bg-[#e8ded0] px-2 py-0.5 text-xs font-medium text-[#8b6f45]">
                {r}
              </span>
            ))}
          </div>
        </Section>

        <Section n={5} title="最近申请季截止日期">
          <div className="grid grid-cols-2 gap-2">
            <Cell
              label="早申截止"
              value={formatField(c.ea ?? (c.singleRound ? "无早申（单轮申请）" : null))}
            />
            <Cell label="RD 截止" value={formatField(c.rdd)} />
          </div>
        </Section>

        <Section n={6} title="录取率（最近申请季）">
          <div className="grid grid-cols-2 gap-2">
            <Cell label="早申录取率" value={formatField(c.er, "percent")} />
            <Cell
              label="RD 录取率"
              value={
                <>
                  {formatField(c.rr, "percent")}
                  {c.rr && c.rr.includes("推算") ? (
                    <span className="ml-1 text-[10px] font-normal text-[#a26047]">推算值</span>
                  ) : null}
                </>
              }
            />
            <Cell label="整体录取率" value={formatField(c.acc, "percent")} />
            <Cell label="转学录取率" value={formatField(c.tr, "percent")} />
            {c.lever != null && <Cell label="早申杠杆（早申 ÷ RD）" value={`${c.lever.toFixed(1)}×`} />}
          </div>
        </Section>

        <Section n={7} title="申请人数（最近申请季）">
          <b>{c.apps != null ? `${c.apps.toLocaleString("en-US")} 人` : "未公布"}</b>
        </Section>

        <Section n={8} title="在读本科男女比例（男:女）">
          <b>{formatGenderRatio(c.mf)}</b>
        </Section>

        <Section n={9} title="本科国际生比例">
          <b>{formatField(c.intl, "percent")}</b>
          {c.idef_t ? (
            <>
              <div className="mt-2 text-[11px] font-bold text-[#68786e]">该校如何认定「国际生」</div>
              <div className="mt-1">
                <span className="rounded bg-[#f0e6d8] px-2 py-0.5 text-[11px] font-bold text-[#8b6f45]">
                  {({ id: "按国籍/永居身份区分", hs: "按高中所在地区分", both: "既按国籍/永居，又按高中所在地" } as const)[
                    c.idef_c ?? "id"
                  ]}
                </span>
              </div>
              <p className="mt-1.5 text-[13px] leading-6 text-[#50645b]">{c.idef_t}</p>
              {c.idef_src && (
                <p className="mt-1 text-[10px] text-[#9aa59c]">官网来源：{c.idef_src} · 2026.8 核查</p>
              )}
            </>
          ) : null}
        </Section>

        <Section n={10} title="语言要求与标化">
          <div className="space-y-1">
            <div>TOEFL：{c.toefl}</div>
            <div>IELTS：{c.ielts}</div>
            <div>
              SAT 政策：
              {({ req: "必须提交", opt: "可选", flex: "灵活", blind: "不看标化" } as const)[c.test]}
              {" · "}SAT 中位 50%：<b>{formatField(c.sat)}</b>
            </div>
          </div>
        </Section>

        <Section n={11} title="面试政策">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded bg-[#e8ded0] px-2 py-0.5 text-xs font-medium text-[#8b6f45]">
              {({ req: "必须面试", rec: "官方推荐", opt: "可选", inv: "仅邀请", none: "无面试", unv: "未核实" } as const)[
                c.ivw_c ?? "unv"
              ]}
            </span>
            {c.ivw_iv === "rec" && (
              <span className="rounded bg-[#e8e6dc] px-2 py-0.5 text-xs font-medium text-[#50645b]">
                官方鼓励第三方面试
              </span>
            )}
          </div>
          {c.ivw_t ? (
            <>
              <p className="mt-2 text-[13px] leading-6 text-[#50645b]">{c.ivw_t}</p>
              {c.ivw_src && (
                <p className="mt-1 text-[10px] text-[#9aa59c]">官网来源：{c.ivw_src} · 2026.8 核查</p>
              )}
            </>
          ) : null}
        </Section>

        <Section n={12} title="小文书">
          {essays.length ? (
            <ul className="space-y-2">
              {essays.map((e, i) => (
                <li key={i} className="rounded-lg bg-[#f2ede4] px-3 py-2 text-[13px] leading-6">
                  {e.t}
                  <span className="ml-2 rounded bg-white px-1.5 py-0.5 text-[10px] text-[#8b6f45]">{e.w}</span>
                </li>
              ))}
            </ul>
          ) : (
            <span className="text-[#68786e]">N/A（无小文书）</span>
          )}
        </Section>

        <Section n={13} title="院校气质">
          <div className="flex flex-wrap gap-1.5">
            {c.tz.split("|").map((t) => (
              <span key={t} className="rounded-full border border-[#c9cfc6] px-2.5 py-0.5 text-xs">
                {t}
              </span>
            ))}
          </div>
        </Section>

        <Section n={14} title="一句话点评">
          <p className="text-[13px] leading-6">{c.nz}</p>
        </Section>

        {signals.length > 0 && (
          <Section n={15} title="数据信号">
            <p className="mb-2 text-[11px] text-[#68786e]">
              公开数据中的观察信号，自动生成 · 非录取预测，仅供参考
            </p>
            <ul className="space-y-1.5">
              {signals.map((s) => (
                <li key={s.key} className="rounded-lg bg-[#f2ede4] px-3 py-2 text-[13px] leading-6">
                  {s.text}
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>

      {/* 按钮区：常驻底部（docs/05 3.3 的第三段） */}
      <div className="border-t border-[#d6d2c7] px-5 py-3">
        <button
          type="button"
          onClick={onToggleSlot}
          disabled={!inSlot && slotsFull}
          className={`w-full rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
            inSlot
              ? "border-[#8b6f45] bg-[#f5ecdf] text-[#8b6f45]"
              : slotsFull
                ? "cursor-not-allowed border-[#d6d2c7] text-[#9aa59c]"
                : "border-[#8b6f45] text-[#8b6f45] hover:bg-[#f5ecdf]"
          }`}
        >
          {inSlot ? "已加入对比位" : slotsFull ? "对比位已满（3/3）" : "加入对比"}
        </button>
      </div>
    </div>
  );
}
