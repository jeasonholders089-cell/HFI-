/**
 * 本地存储的读写包装（docs/08 §6.1）。
 *
 * 一律 try/catch —— 隐私模式或配额满时不能把整页搞崩。
 * 键名带 hfi 前缀，避免与同域下其他应用（含参考实现用的 cmc_*）互相干扰。
 */
const KEYS = {
  favs: "hfi.colleges.favs",
  slots: "hfi.colleges.slots",
  sat: "hfi.colleges.sat",
  lang: "hfi.colleges.lang",
  font: "hfi.colleges.fontLevel",
  tipsSeen: "hfi.colleges.tipsSeen",
} as const;

export { KEYS };

/** 内存兜底：localStorage 不可用时降级成会话内有效。 */
const memory = new Map<string, string>();

function store(): Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const probe = "__hfi_probe__";
      window.localStorage.setItem(probe, "1");
      window.localStorage.removeItem(probe);
      return window.localStorage;
    }
  } catch {
    // 落到内存兜底
  }
  return {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => void memory.set(k, v),
    removeItem: (k: string) => void memory.delete(k),
  };
}

export function readJson<T>(key: keyof typeof KEYS, fallback: T): T {
  try {
    const raw = store().getItem(KEYS[key]);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(key: keyof typeof KEYS, value: unknown): void {
  try {
    store().setItem(KEYS[key], JSON.stringify(value));
  } catch {
    // 写不进去就算了，不影响页面可用
  }
}

export function removeKey(key: keyof typeof KEYS): void {
  try {
    store().removeItem(KEYS[key]);
  } catch {
    // 同上
  }
}

export function readFlag(key: keyof typeof KEYS): boolean {
  try {
    return store().getItem(KEYS[key]) === "1";
  } catch {
    return false;
  }
}

export function writeFlag(key: keyof typeof KEYS): void {
  try {
    store().setItem(KEYS[key], "1");
  } catch {
    // 同上
  }
}

/**
 * 本地存储是否真的可用（§6.16 的「本地存储不可用」一行）。
 *
 * 探针与 `store()` 里的同一套；不可用时页面顶部提示一次，
 * 收藏 / 对比位 / 字号降级为会话内有效 —— 功能不消失，只是刷新后不留。
 */
export function storageDegraded(): boolean {
  try {
    if (typeof window === "undefined" || !window.localStorage) return false;
    const probe = "__hfi_probe_flag__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return false;
  } catch {
    return true;
  }
}
