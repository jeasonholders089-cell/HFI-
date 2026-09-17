"use client";

import { useEffect } from "react";

import { COMPARE_ROWS, bestIndex } from "@/lib/colleges-compare";
import type { College } from "@/lib/colleges-data";

/**
 * 并排对比浮窗（docs/08 §6.12）。
 *
 * - 行序照参考实现原样，23 行 + 条件行；
 * - 只有 8 行参与最优值高亮，且**并列时不亮**；
 * - 宽度按所数自适应（两所不撑满），上限 92vw；
 * - 手机端横向滚动（第一列字段名冻结）。
 */
type Props = {
  colleges: readonly College[];
  onClose: () => void;
  onRemove: (en: string) => void;
  /** 黑马匹配开启时在最前面插入「初步区间」行 */
  matchRow?: { label: string; text: (c: College) => string } | null;
};

export function CompareModal({ colleges, onClose, onRemove, matchRow }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const n = colleges.length;
  // 两所 624px、三所 861px 是参考实现的算法；我们放宽上限到 92vw
  const width = Math.min(typeof window === "undefined" ? 861 : window.innerWidth * 0.92, 104 + 237 * n + 46);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="院校对比"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/45 p-4 py-[4vh]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full rounded-2xl bg-white shadow-2xl" style={{ maxWidth: width }}>
        <div className="flex items-center justify-between border-b border-[#d6d2c7] px-5 py-4">
          <h2 className="text-lg font-medium text-[#17382f]">院校对比</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="h-8 w-8 rounded-md bg-[#f0e6d8] text-sm text-[#68786e] hover:bg-[#e6e0d5]"
          >
            ✕
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 w-[104px] min-w-[104px] border-b border-[#d6d2c7] bg-white px-4 py-3" />
                {colleges.map((c) => (
                  <th key={c.en} className="border-b border-[#d6d2c7] px-4 py-3 align-bottom">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium text-[#17382f]">{c.zh}</div>
                        <div className="mt-0.5 text-[11px] font-normal text-[#68786e]">{c.en}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemove(c.en)}
                        aria-label={`移除 ${c.zh}`}
                        className="text-xs text-[#9aa59c] hover:text-[#a26047]"
                      >
                        ✕
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matchRow && (
                <tr className="bg-[#f5ecdf]">
                  <th className="sticky left-0 z-10 bg-[#f5ecdf] px-4 py-2 text-xs font-bold text-[#8b6f45]">
                    {matchRow.label}
                  </th>
                  {colleges.map((c) => (
                    <td key={c.en} className="px-4 py-2 text-[#8b6f45]">
                      {matchRow.text(c)}
                    </td>
                  ))}
                </tr>
              )}
              {COMPARE_ROWS.map((row) => {
                const hi = bestIndex(colleges, row);
                return (
                  <tr key={row.key} className="border-t border-[#efebe3]">
                    <th className="sticky left-0 z-10 bg-white px-4 py-2.5 text-xs font-normal text-[#68786e]">
                      {row.label}
                    </th>
                    {colleges.map((c, i) => (
                      <td
                        key={c.en}
                        className={`whitespace-pre-line px-4 py-2.5 ${
                          i === hi ? "bg-[#f5ecdf] font-medium text-[#8b6f45]" : "text-[#17382f]"
                        }`}
                      >
                        {row.text(c)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
