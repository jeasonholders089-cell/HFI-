"use client";

import { useLang, useT } from "@/components/colleges/colleges-context";
import type { College } from "@/lib/colleges-data";
import {
  applicantsText,
  dateTerm,
  formatFieldL,
  genderName,
  idefName,
  ivwName,
  leverText,
  nameOf,
  pair,
  subNameOf,
  testName,
} from "@/lib/colleges-l10n";
import { visibleSignals } from "@/lib/colleges-signals";
import { isExtrapolated } from "@/lib/colleges-format";

/**
 * 浏览位：15 节档案（docs/06 第五节 / docs/08 §6.19）。
 *
 * 纪律：
 *   - 节顺序照原样，不重排、不删节；某一节没内容时按空值规则处理，**不是整节消失**
 *     （唯一例外是第 15 节）；
 *   - 空值统一走 formatFieldL，不写 `value || "未公布"`；
 *   - 第 15 节是唯一条件渲染的一节，上限 6 条；
 *   - 单语字段（essays / idef_t / ivw_t）在英文模式下照原样显示中文 + 一行说明（§6.15）；
 *   - 节里**不得出现**任何第三方导流话术（评审 M2；禁令清单见 colleges-guards.test.ts，
 *     这里不复述，免得清单本身也违反扫描）。
 */
type Props = {
  college: College;
  inSlot: boolean;
  slotsFull: boolean;
  isFav: boolean;
  /** 黑马匹配的档位标签；未开启匹配时为 null。**已按当前语言取好词** */
  matchLabel: string | null;
  /** 悬停徽标可见的判断依据 */
  matchWhyText: string | null;
  onToggleSlot: () => void;
  onToggleFav: () => void;
  onClose: () => void;
};

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-dashed border-[#d6d2c7] px-4 py-3 first:border-t-0">
      <h3 className="flex items-baseline gap-2 text-[0.8125rem] font-medium text-[#17382f]">
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded bg-[#f0e6d8] px-1 text-[0.6875rem] font-bold text-[#8b6f45]">
          {n}
        </span>
        {title}
      </h3>
      <div className="mt-2 text-[0.8125rem] leading-5 text-[#17382f]">{children}</div>
    </section>
  );
}

function Cell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-[#f2ede4] px-2.5 py-1.5">
      <div className="text-[0.6875rem] text-[#68786e]">{label}</div>
      <div className="mt-0.5 font-medium">{value}</div>
    </div>
  );
}

/** 单语字段的说明行 —— 英文模式下才出现（§6.15）。 */
function ZhOnlyNote() {
  const t = useT();
  const lang = useLang();
  if (lang !== "en") return null;
  return <p className="mt-1 text-[0.625rem] leading-5 text-[#9aa59c]">{t("zhOnly.section")}</p>;
}

export function SchoolProfile({
  college: c,
  inSlot,
  slotsFull,
  isFav,
  matchLabel,
  matchWhyText,
  onToggleSlot,
  onToggleFav,
  onClose,
}: Props) {
  const t = useT();
  const lang = useLang();
  const signals = visibleSignals(c, lang);
  let essays: { t: string; w: string }[] = [];
  try {
    essays = JSON.parse(c.essays) as { t: string; w: string }[];
  } catch {
    essays = [];
  }

  const slotButtonText = inSlot ? t("slots.added") : slotsFull ? t("slots.full") : t("slots.add");

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-[#d6d2c7] bg-[#17382f] px-5 py-3 text-white">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg leading-tight">{nameOf(c, lang)}</h2>
            {subNameOf(c, lang) && (
              <p className="mt-0.5 text-[0.6875rem] text-white/70">{subNameOf(c, lang)}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {matchLabel && (
              <span
                title={matchWhyText ?? undefined}
                className="cursor-help rounded bg-white/15 px-2 py-1 text-[0.6875rem] text-white/90"
              >
                {matchLabel}
              </span>
            )}
            <button
              type="button"
              onClick={onToggleFav}
              aria-label={isFav ? t("fav.remove") : t("fav.add")}
              aria-pressed={isFav}
              className={`h-7 w-7 rounded-md text-sm ${
                isFav ? "bg-[#8b6f45] text-white" : "bg-white/15 text-white/80 hover:bg-white/25"
              }`}
            >
              {isFav ? "★" : "☆"}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label={t("mt.close")}
              className="h-7 w-7 rounded-md bg-white/15 text-sm text-white/80 hover:bg-white/25"
            >
              ✕
            </button>
          </div>
        </div>
        {/* 政策提醒（`alert` 列，全库仅 4 所有）—— 只在有值时出现 */}
        {c.alert && (
          <>
            <p className="mt-2 rounded bg-white/10 px-2 py-1 text-[0.6875rem] leading-5 text-white/85">
              ⚠ {c.alert}
            </p>
            {lang === "en" && (
              <p className="mt-1 text-[0.625rem] leading-5 text-white/60">{t("zhOnly.section")}</p>
            )}
          </>
        )}
      </header>

      <div className="flex-1 overflow-auto">
        <Section n={1} title={t("sec.1")}>
          <div className="grid grid-cols-2 gap-2">
            <Cell
              label={t("data.rankThisYear")}
              value={`#${c.rank} · ${t(c.type === "uni" ? "data.rankUni" : "data.rankLac")}`}
            />
            <Cell
              label={t("data.rankQs")}
              value={c.qs ? `#${c.qs}` : t(c.type === "lac" ? "data.qsNa" : "data.unranked")}
            />
          </div>
          {/* H4：档位徽标悬停可见判断依据 */}
          {matchLabel && matchWhyText && (
            <div className="mt-2">
              <span
                title={matchWhyText}
                className="cursor-help rounded bg-[#f5ecdf] px-2 py-1 text-[0.6875rem] font-medium text-[#8b6f45]"
              >
                {t("pf.band", { band: matchLabel })}
              </span>
            </div>
          )}
        </Section>

        <Section n={2} title={t("sec.2")}>
          <b>
            {c.city}, {c.st}
          </b>{" "}
          · {pair(c.cz, c.ce, lang)}
        </Section>

        <Section n={3} title={t("sec.3")}>
          <b>{formatFieldL(c.tuition, "text", lang)}</b>
        </Section>

        <Section n={4} title={t("sec.4")}>
          <div className="flex flex-wrap gap-1.5">
            {c.roundsArr.map((r) => (
              <span key={r} className="rounded bg-[#e8ded0] px-2 py-0.5 text-xs font-medium text-[#8b6f45]">
                {r}
              </span>
            ))}
          </div>
        </Section>

        <Section n={5} title={t("sec.5")}>
          <div className="grid grid-cols-2 gap-2">
            <Cell
              label={t("pf.earlyDdl")}
              value={dateTerm(
                c.ea ?? (c.singleRound ? t("data.noEarly") : null),
                lang,
              )}
            />
            <Cell label={t("pf.rdDdl")} value={dateTerm(c.rdd, lang)} />
          </div>
        </Section>

        <Section n={6} title={t("sec.6")}>
          <div className="grid grid-cols-2 gap-2">
            <Cell label={t("pf.er")} value={formatFieldL(c.er, "percent", lang)} />
            <Cell
              label={t("pf.rr")}
              value={
                <>
                  {formatFieldL(c.rr, "percent", lang)}
                  {isExtrapolated(c.rr) ? (
                    <span className="ml-1 text-[0.625rem] font-normal text-[#a26047]">
                      {t("pf.extrapolated")}
                    </span>
                  ) : null}
                </>
              }
            />
            <Cell label={t("pf.acc")} value={formatFieldL(c.acc, "percent", lang)} />
            <Cell label={t("pf.tr")} value={formatFieldL(c.tr, "percent", lang)} />
            {c.lever != null && <Cell label={t("pf.lever")} value={leverText(c, lang)} />}
          </div>
        </Section>

        <Section n={7} title={t("sec.7")}>
          <b>{applicantsText(c, lang)}</b>
        </Section>

        <Section n={8} title={t("sec.8")}>
          <b>{genderName(c.mf, lang)}</b>
        </Section>

        <Section n={9} title={t("sec.9")}>
          <b>{formatFieldL(c.intl, "percent", lang)}</b>
          {c.idef_t ? (
            <>
              <div className="mt-2 text-[0.6875rem] font-bold text-[#68786e]">{t("data.idefTitle")}</div>
              <div className="mt-1">
                <span className="rounded bg-[#f0e6d8] px-2 py-0.5 text-[0.6875rem] font-bold text-[#8b6f45]">
                  {idefName(c.idef_c, lang)}
                </span>
              </div>
              <p className="mt-1.5 text-[0.8125rem] leading-5 text-[#50645b]">{c.idef_t}</p>
              <ZhOnlyNote />
              {c.idef_src && (
                <p className="mt-1 text-[0.625rem] text-[#9aa59c]">{t("data.srcNote", { url: c.idef_src })}</p>
              )}
            </>
          ) : null}
        </Section>

        <Section n={10} title={t("sec.10")}>
          <div className="space-y-1">
            <div>
              {t("pf.toefl")}：{dateTerm(c.toefl, lang)}
            </div>
            <div>
              {t("pf.ielts")}：{dateTerm(c.ielts, lang)}
            </div>
            <div>
              {t("pf.satPolicy")}：{testName(c.test, lang)}
              {" · "}
              {t("pf.satMid")}：<b>{formatFieldL(c.sat, "text", lang)}</b>
            </div>
          </div>
        </Section>

        <Section n={11} title={t("sec.11")}>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded bg-[#e8ded0] px-2 py-0.5 text-xs font-medium text-[#8b6f45]">
              {ivwName(c.ivw_c, lang)}
            </span>
            {c.ivw_iv === "rec" && (
              <span className="rounded bg-[#e8e6dc] px-2 py-0.5 text-xs font-medium text-[#50645b]">
                {t("data.ivwThirdParty")}
              </span>
            )}
          </div>
          {c.ivw_t ? (
            <>
              <p className="mt-2 text-[0.8125rem] leading-5 text-[#50645b]">{c.ivw_t}</p>
              <ZhOnlyNote />
              {c.ivw_src && (
                <p className="mt-1 text-[0.625rem] text-[#9aa59c]">{t("data.srcNote", { url: c.ivw_src })}</p>
              )}
            </>
          ) : null}
        </Section>

        <Section n={12} title={t("sec.12")}>
          {essays.length ? (
            <>
              <ul className="space-y-2">
                {essays.map((e, i) => (
                  <li key={i} className="rounded-lg bg-[#f2ede4] px-3 py-2 text-[0.8125rem] leading-5">
                    {e.t}
                    <span className="ml-2 rounded bg-white px-1.5 py-0.5 text-[0.625rem] text-[#8b6f45]">
                      {e.w}
                    </span>
                  </li>
                ))}
              </ul>
              <ZhOnlyNote />
            </>
          ) : (
            <span className="text-[#68786e]">{t("data.noEssay")}</span>
          )}
        </Section>

        <Section n={13} title={t("sec.13")}>
          <div className="flex flex-wrap gap-1.5">
            {pair(c.tz, c.te, lang)
              .split("|")
              .map((tag) => (
                <span key={tag} className="rounded-full border border-[#c9cfc6] px-2.5 py-0.5 text-xs">
                  {tag}
                </span>
              ))}
          </div>
        </Section>

        <Section n={14} title={t("sec.14")}>
          <p className="text-[0.8125rem] leading-5">{pair(c.nz, c.ne, lang)}</p>
        </Section>

        {signals.length > 0 && (
          <Section n={15} title={t("sec.15")}>
            <p className="mb-2 text-[0.6875rem] text-[#68786e]">{t("sig.head")}</p>
            <ul className="space-y-1.5">
              {signals.map((s) => (
                <li key={s.key} className="rounded-lg bg-[#f2ede4] px-3 py-2 text-[0.8125rem] leading-5">
                  {s.text}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* 档案底部的口径说明（§6.19）：数据来源 / 排名口径 / 推算值标注 / 更新时间 */}
        <section className="border-t border-dashed border-[#d6d2c7] bg-[#f2ede4] px-5 py-3">
          <p className="text-[0.625rem] leading-5 text-[#68786e]">{t("pf.caliber")}</p>
          <p className="mt-1 text-[0.625rem] leading-5 text-[#9aa59c]">{c.cds_src}</p>
        </section>
      </div>

      {/* 按钮区：常驻底部（docs/05 3.3 的第三段） */}
      <div className="border-t border-[#d6d2c7] px-5 py-3">
        <button
          type="button"
          onClick={onToggleSlot}
          disabled={!inSlot && slotsFull}
          aria-disabled={!inSlot && slotsFull}
          className={`w-full rounded-lg border px-4 py-2 text-[0.8125rem] font-medium transition-colors ${
            inSlot
              ? "border-[#8b6f45] bg-[#f5ecdf] text-[#8b6f45]"
              : slotsFull
                ? "cursor-not-allowed border-[#d6d2c7] text-[#9aa59c]"
                : "border-[#8b6f45] text-[#8b6f45] hover:bg-[#f5ecdf]"
          }`}
        >
          {slotButtonText}
        </button>
        {/* 对比位已满时的一行说明（原版是 alert 弹窗，§6.16） */}
        {!inSlot && slotsFull && (
          <p className="mt-1.5 text-center text-[0.625rem] leading-5 text-[#68786e]">{t("slots.fullNote")}</p>
        )}
      </div>
    </div>
  );
}
