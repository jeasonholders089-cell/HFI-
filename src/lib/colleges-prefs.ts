"use client";

import { useSyncExternalStore } from "react";

import { readJson, removeKey, writeJson } from "./colleges-storage";
import type { Lang } from "./colleges-i18n";

/**
 * 页面级偏好（收藏 / 匹配分数）的外部存储源。
 *
 * 为什么不用 useEffect + setState 恢复：那条路会触发级联渲染，
 * 被 react-hooks/set-state-in-effect 拦下（而且 SSR 首屏与客户端首帧不一致）。
 * useSyncExternalStore 是读外部存储的正规姿势：hydration 用 getServerSnapshot，
 * 之后自动切到客户端快照并重渲染一次。
 */
export type CollegePrefs = {
  favs: readonly string[];
  sat: number | null;
  lang: Lang;
  font: 0 | 1 | 2;
};

const EMPTY: CollegePrefs = { favs: [], sat: null, lang: "zh", font: 0 };

let cache: CollegePrefs = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function load(): CollegePrefs {
  const favs = readJson<string[]>("favs", []);
  const sat = readJson<number | null>("sat", null);
  return {
    favs: Array.isArray(favs) ? favs.filter((x) => typeof x === "string") : [],
    sat: typeof sat === "number" && Number.isFinite(sat) ? sat : null,
    lang: readJson<Lang>("lang", "zh") === "en" ? "en" : "zh",
    font: ([0, 1, 2] as const).includes(readJson<0 | 1 | 2>("font", 0)) ? readJson<0 | 1 | 2>("font", 0) : 0,
  };
}

/** 必须返回稳定引用，否则 useSyncExternalStore 会无限重渲染。 */
function getSnapshot(): CollegePrefs {
  if (!loaded) {
    cache = load();
    loaded = true;
  }
  return cache;
}

function getServerSnapshot(): CollegePrefs {
  return EMPTY;
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function emit(): void {
  cache = load();
  for (const l of listeners) l();
}

export function useCollegePrefs(): CollegePrefs {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function toggleFavPref(en: string): void {
  const cur = getSnapshot().favs;
  const next = cur.includes(en) ? cur.filter((x) => x !== en) : [...cur, en];
  writeJson("favs", next);
  emit();
}

export function setSatPref(sat: number | null): void {
  if (sat == null) removeKey("sat");
  else writeJson("sat", sat);
  emit();
}

export function setLangPref(lang: Lang): void {
  writeJson("lang", lang);
  emit();
}

export function setFontPref(font: 0 | 1 | 2): void {
  writeJson("font", font);
  emit();
}
