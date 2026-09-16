"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * 全站共享导航（docs/08 §1.3）。
 *
 * 抽出来的理由：四个页面原来各写各的 header；加"选校地图"这一项时要同时改四处，
 * 任何一个漏改就会出现"某些页没有这一项"。
 */
const ITEMS = [
  { href: "/#about", label: "关于活动" },
  { href: "/explore", label: "探索全景" },
  { href: "/colleges", label: "选校地图" },
  { href: "/#entry", label: "工作人员入口" },
] as const;

export function SiteNav({ tone = "light" }: { tone?: "light" | "dark" }) {
  const pathname = usePathname();
  const muted = tone === "dark" ? "text-white/70" : "text-[#50645b]";
  const active = tone === "dark" ? "text-white" : "text-[#17382f]";

  return (
    <nav className="hidden gap-8 text-sm md:flex">
      {ITEMS.map((it) => {
        // 只有 /explore、/colleges 这种独立页会命中；带 # 的锚点一律不高亮
        const isActive = !it.href.includes("#") && pathname === it.href;
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={isActive ? "page" : undefined}
            className={`${isActive ? `${active} font-medium` : muted} transition-colors hover:opacity-80`}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
