"use client";

import { useEffect, useState } from "react";

import { useLang, useT } from "@/components/colleges/colleges-context";
import {
  MATCH_ORDER,
  SAT_MAX,
  SAT_MIN,
  isValidSat,
  matchDisclaimer,
  matchLabel,
} from "@/lib/colleges-match";

/**
 * 黑马匹配弹窗（docs/05 H 组 / docs/08 §6.11）。
 *
 * 三条边界约束的落点：
 *   - 只出现在 /colleges（本组件只被该页引用）；
 *   - 局限说明**常驻**在这个弹窗里，不折叠；
 *   - 输入的分数只留在本地状态，不落服务端（§6.11 第 3 条）。
 */
type Props = {
  current: number | null;
  onApply: (sat: number) => void;
  onClear: () => void;
  onClose: () => void;
};

export function MatchModal({ current, onApply, onClear, onClose }: Props) {
  const t = useT();
  const lang = useLang();
  const [raw, setRaw] = useState(current != null ? String(current) : "");
  const [error, setError] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const apply = () => {
    const v = Number(raw);
    if (!isValidSat(v)) {
      setError(t("mt.error", { lo: SAT_MIN, hi: SAT_MAX }));
      return;
    }
    setError("");
    onApply(v);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("mt.title")}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/45 p-4 py-[8vh]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-[520px] rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#d6d2c7] px-5 py-4">
          <h2 className="text-lg font-medium text-[#17382f]">{t("mt.title")}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("mt.close")}
            className="h-8 w-8 rounded-md bg-[#f0e6d8] text-sm text-[#68786e] hover:bg-[#e6e0d5]"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-5">
          <p className="text-sm leading-6 text-[#50645b]">
            {t("mt.intro")}
            {MATCH_ORDER.map((tag) => matchLabel(tag, lang)).join(" / ")}
            {t("mt.introEnd")}
          </p>

          <label className="mt-4 block text-sm">
            {t("mt.field", { lo: SAT_MIN, hi: SAT_MAX })}
            <input
              type="number"
              inputMode="numeric"
              value={raw}
              onChange={(e) => {
                setRaw(e.target.value);
                setError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") apply();
              }}
              className="mt-2 w-full rounded-lg border border-[#d6d2c7] px-3 py-2.5 text-base outline-none focus:border-[#8b6f45]"
            />
          </label>
          {error && (
            <p role="alert" className="mt-2 text-sm text-[#a26047]">
              {error}
            </p>
          )}

          {/* 局限说明：常驻，不折叠（H8） */}
          <p className="mt-4 rounded-lg bg-[#f5ecdf] px-3 py-2.5 text-[0.75rem] leading-6 text-[#a26047]">
            ⚠ {matchDisclaimer(lang)}
          </p>

          <div className="mt-5 flex justify-end gap-3">
            {current != null && (
              <button
                type="button"
                onClick={onClear}
                className="rounded-lg border border-[#aeb7ad] px-4 py-2.5 text-sm text-[#50645b]"
              >
                {t("mt.clear")}
              </button>
            )}
            <button
              type="button"
              onClick={apply}
              className="rounded-lg bg-[#1e4b3b] px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
            >
              {t("mt.apply")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
