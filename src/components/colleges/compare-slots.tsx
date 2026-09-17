"use client";

import type { College } from "@/lib/colleges-data";

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
  const empty = MAX - slots.length;

  return (
    <div className="border-b border-[#d6d2c7] bg-[#f8f5ed] px-4 py-3">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-xs font-bold text-[#8b6f45]">
          对比位（{slots.length}/{MAX}）
        </span>
        {slots.length > 0 && (
          <button type="button" onClick={onClear} className="text-[11px] text-[#68786e] hover:text-[#a26047]">
            清空
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {slots.map((en) => {
          const c = colleges.find((x) => x.en === en);
          return (
            <span
              key={en}
              className="inline-flex items-center gap-1 rounded-md border border-[#8b6f45] bg-white px-2 py-1 text-xs text-[#8b6f45]"
            >
              <button type="button" onClick={() => onPick(en)} className="max-w-[7.5rem] truncate hover:underline">
                {c?.zh ?? en}
              </button>
              <button
                type="button"
                onClick={() => onRemove(en)}
                aria-label={`从对比位移除 ${c?.zh ?? en}`}
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
            空
          </span>
        ))}
      </div>

      {canCompare && (
        <button
          type="button"
          onClick={onCompare}
          className="mt-2 w-full rounded-lg bg-[#1e4b3b] px-3 py-2 text-xs font-medium text-white hover:opacity-90"
        >
          并排对比（{slots.length}）
        </button>
      )}
    </div>
  );
}
