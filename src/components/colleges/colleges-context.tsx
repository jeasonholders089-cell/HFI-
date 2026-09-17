"use client";

import { createContext, useContext } from "react";

import { t, type Lang, type TextKey } from "@/lib/colleges-i18n";

// 语言与字号的上下文。
// 用 context 而不是逐层传 prop：需要文案的组件有六七个，
// 每个都穿透传 lang 会让签名变噪。
type Ctx = { lang: Lang; font: 0 | 1 | 2 };

const CollegesCtx = createContext<Ctx>({ lang: "zh", font: 0 });

export function CollegesProvider({ lang, font, children }: Ctx & { children: React.ReactNode }) {
  return <CollegesCtx.Provider value={{ lang, font }}>{children}</CollegesCtx.Provider>;
}

export function useLang(): Lang {
  return useContext(CollegesCtx).lang;
}

export function useFont(): 0 | 1 | 2 {
  return useContext(CollegesCtx).font;
}

/** 取当前语言的文案。用法：const t = useT(); t("toolbar.map") */
export function useT(): (key: TextKey, vars?: Record<string, string | number>) => string {
  const { lang } = useContext(CollegesCtx);
  return (key, vars) => t(lang, key, vars);
}

/** 字号三档 → `html[data-font]` 的取值（docs/08 §6.14）。 */
export const FONT_ATTR: Record<0 | 1 | 2, "md" | "lg" | "xl"> = {
  0: "md",
  1: "lg",
  2: "xl",
};
