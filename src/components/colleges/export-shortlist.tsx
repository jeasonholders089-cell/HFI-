"use client";

import { useEffect } from "react";

import { useLang, useT } from "@/components/colleges/colleges-context";
import type { College } from "@/lib/colleges-data";
import { deadlineText, nameOf, subNameOf } from "@/lib/colleges-l10n";
import { matchDisclaimer } from "@/lib/colleges-match";

/**
 * 导出收藏清单（docs/08 §6.13 D4）。
 *
 * 三个不能少的约束：
 *   1. **没有定位档位栏** —— 参考实现那一列是手写的三档定位标注，
 *      属于 `AGENTS.md` 不允许出现在导出物上的话术，我们改成「家庭备注」空栏；
 *   2. 页脚**必须**带局限说明与数据来源 —— 打印出来的纸也要能看到约束，否则它就成了一张没有语境的对比表；
 *   3. 参考实现页脚的品牌落款与导流二维码**全部去掉**。
 *
 * 打印走 CSS：`@media print` 只显示 `.print-area`（app/globals.css），页面本身是 A4 横向。
 */
type Props = {
  colleges: readonly College[];
  onClose: () => void;
};

export function ExportShortlist({ colleges, onClose }: Props) {
  const t = useT();
  const lang = useLang();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const cols: { head: string; cell: (c: College) => string }[] = [
    { head: t("exp.col.rank"), cell: (c) => `#${c.rank}` },
    { head: t("exp.col.school"), cell: (c) => `${nameOf(c, lang)}${subNameOf(c, lang) ? ` / ${subNameOf(c, lang)}` : ""}` },
    { head: t("exp.col.city"), cell: (c) => `${c.city}, ${c.st}` },
    { head: t("exp.col.acc"), cell: (c) => c.acc ?? t("data.dash") },
    { head: t("exp.col.ddl"), cell: (c) => deadlineText(c, lang, true) },
    { head: t("exp.col.sat"), cell: (c) => c.sat ?? t("data.dash") },
    { head: t("exp.col.tuition"), cell: (c) => c.tuition ?? t("data.dash") },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("exp.title")}
      className="fixed inset-0 z-50 overflow-y-auto bg-black/45 p-4 py-[4vh]"
    >
      <div className="print-area mx-auto w-full max-w-[1100px] rounded-2xl bg-white p-6 shadow-2xl">
        <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium text-[#17382f]">{t("exp.title")}</h2>
            <p className="mt-1 text-xs text-[#68786e]">{t("exp.subtitle", { n: colleges.length })}</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-lg bg-[#1e4b3b] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              {t("exp.print")}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[#aeb7ad] px-4 py-2 text-sm text-[#50645b]"
            >
              {t("exp.back")}
            </button>
          </div>
        </div>

        <h3 className="hidden text-lg font-medium text-[#17382f] print:block">{t("exp.title")}</h3>

        {colleges.length === 0 ? (
          <p className="py-10 text-center text-sm text-[#68786e]">{t("exp.empty")}</p>
        ) : (
          <table className="w-full border-collapse text-left text-[0.75rem]">
            <thead>
              <tr>
                {cols.map((c) => (
                  <th key={c.head} className="border-b border-[#d6d2c7] px-2 py-2 font-normal text-[#68786e]">
                    {c.head}
                  </th>
                ))}
                <th className="w-[18%] border-b border-[#d6d2c7] px-2 py-2 font-normal text-[#68786e]">
                  {t("exp.col.note")}
                </th>
              </tr>
            </thead>
            <tbody>
              {colleges.map((c) => (
                <tr key={c.en} className="border-b border-[#efebe3]">
                  {cols.map((col) => (
                    <td key={col.head} className="px-2 py-2 text-[#17382f]">
                      {col.cell(c)}
                    </td>
                  ))}
                  {/* 家庭备注：留白给家长手写，不放任何定位话术 */}
                  <td className="px-2 py-2 text-[#17382f]" />
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <p className="mt-4 border-t border-[#d6d2c7] pt-3 text-[0.625rem] leading-5 text-[#68786e]">
          {matchDisclaimer(lang)}
        </p>
        <p className="mt-1 text-[0.625rem] leading-5 text-[#68786e]">{t("exp.footer")}</p>
      </div>
    </div>
  );
}
