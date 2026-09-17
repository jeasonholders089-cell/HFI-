"use client";

import { useLang, useT } from "@/components/colleges/colleges-context";
import type { College } from "@/lib/colleges-data";
import { nameOf } from "@/lib/colleges-l10n";

/**
 * 对比位（侧栏顶部常驻，docs/06 7.3 / 7.3.1）。
 *
 * 锁定项用「紧凑槽」：只显示校名 + ✕ 的一行标签，一行放得下三个。
 * 槽可点 —— 点了把那一所切回浏览位（docs/06 7.7）。
 */
type Props = {
  colleges: readonly College[];
  slots: readonly string[];
  canCompare: boolean;
  onPick: (en: string) => void;
  onRemove: (en: string) => void;
  onClear: () => void;
  onCompare: () => void;
};

const MAX = 3;

export function CompareSlots({ colleges, slots, canCompare, onPick, onRemove, onClear, onCompare }: Props) {
  const t = useT();
  const lang = useLang();
  const empty = Math.max(0, MAX - slots.length);

  return (
    <div className="border-b border-[#d6d2c7] bg-[#f8f5ed] px-4 py-3">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-xs font-bold text-[#8b6f45]">{t("slots.title", { n: slots.length })}</span>
        {slots.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="text-[0.6875rem] text-[#68786e] hover:text-[#a26047]"
          >
            {t("slots.clear")}
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {slots.map((en) => {
          const c = colleges.find((x) => x.en === en);
          const label = c ? nameOf(c, lang) : en;
          return (
            <span
              key={en}
              className="inline-flex items-center gap-1 rounded-md border border-[#8b6f45] bg-white px-2 py-1 text-xs text-[#8b6f45]"
            >
              <button type="button" onClick={() => onPick(en)} className="max-w-[7.5rem] truncate hover:underline">
                {label}
              </button>
              <button
                type="button"
                onClick={() => onRemove(en)}
                aria-label={t("slots.remove", { name: label })}
                className="text-[#a26047] hover:opacity-70"
              >
                ✕
              </button>
            </span>
          );
        })}
        {Array.from({ length: empty }).map((_, i) => (
          <span
            key={`empty-${i}`}
            className="rounded-md border border-dashed border-[#c9cfc6] px-2 py-1 text-xs text-[#9aa59c]"
          >
            {t("slots.empty")}
          </span>
        ))}
      </div>

      {canCompare && (
        <button
          type="button"
          onClick={onCompare}
          className="mt-2 w-full rounded-lg bg-[#1e4b3b] px-3 py-2 text-xs font-medium text-white hover:opacity-90"
        >
          {t("slots.compare", { n: slots.length })}
        </button>
      )}
    </div>
  );
}
