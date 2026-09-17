/**
 * 坐标表构建闸自身的测试（docs/11 §6.2 E / §2.6）。
 *
 * 与 `build-gate.test.ts` 同一套路：把 CSV 的某一列名故意改错一位，
 * 构建**必须以退出码 1 失败，且不覆盖旧产物**。
 * 没有这条，「字段一致性校验」可能形同虚设。
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.resolve(HERE, "..", "..");
const REPO = path.resolve(SRC_ROOT, "..");
const GOOD_CSV = path.join(REPO, "data", "university-coords.csv");

function runBuild(csvPath: string, outPath: string) {
  try {
    const stdout = execFileSync("pnpm", ["exec", "tsx", "scripts/build-coords.ts"], {
      cwd: SRC_ROOT,
      env: { ...process.env, UNIVERSITY_COORDS_CSV: csvPath, UNIVERSITY_COORDS_OUT: outPath },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
    });
    return { code: 0, out: stdout };
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    return { code: err.status ?? -1, out: `${err.stdout ?? ""}${err.stderr ?? ""}` };
  }
}

describe("坐标表构建闸（闸 1 / 闸 3 / 闸 4）", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "hfi-coords-gate-"));

  it("列名正确时构建成功，产物是纯数据（闸 4：零 import）", () => {
    const out = path.join(tmp, "ok.ts");
    const r = runBuild(GOOD_CSV, out);
    expect(r.code, r.out).toBe(0);
    const text = fs.readFileSync(out, "utf8");
    expect(text).not.toMatch(/^\s*import\b/m);
    expect(text).toContain("export const COORD_ROWS");
    expect(text).toContain("export const COORD_OVERRIDES");
  });

  it("把某一列名改错一位 → 退出码 1，且旧的产物 mtime 不变", () => {
    const lines = fs.readFileSync(GOOD_CSV, "utf8").split("\n");
    const header = lines[0].split(",");
    const at = header.indexOf("st");
    expect(at).toBeGreaterThan(-1);
    header[at] = "stx";
    lines[0] = header.join(",");

    const badCsv = path.join(tmp, "bad-column.csv");
    const badOut = path.join(tmp, "guard.ts");
    fs.writeFileSync(badCsv, lines.join("\n"), "utf8");
    fs.writeFileSync(badOut, "// 旧产物\n", "utf8");
    const before = fs.statSync(badOut).mtimeMs;

    const r = runBuild(badCsv, badOut);
    expect(r.code, "校验没有拦住改错的列名").toBe(1);
    expect(r.out).toContain("表头与约定不一致");
    expect(fs.readFileSync(badOut, "utf8")).toBe("// 旧产物\n");
    expect(fs.statSync(badOut).mtimeMs).toBe(before);
  });

  it("把某一行的纬度写成越界值 → 退出码 1", () => {
    const lines = fs.readFileSync(GOOD_CSV, "utf8").split("\n");
    const header = lines[0].split(",");
    const at = header.indexOf("lat");
    const cells = lines[1].split(",");
    cells[at] = "128.5";
    lines[1] = cells.join(",");

    const badCsv = path.join(tmp, "bad-lat.csv");
    fs.writeFileSync(badCsv, lines.join("\n"), "utf8");

    const r = runBuild(badCsv, path.join(tmp, "bad-lat.ts"));
    expect(r.code).toBe(1);
    expect(r.out).toContain("lat 越界");
  });

  it("行数掉到 2000 以下 → 退出码 1（闸 3 防产物变空）", () => {
    const lines = fs.readFileSync(GOOD_CSV, "utf8").split("\n");
    const badCsv = path.join(tmp, "short.csv");
    fs.writeFileSync(badCsv, [lines[0], ...lines.slice(1, 200)].join("\n"), "utf8");

    const r = runBuild(badCsv, path.join(tmp, "short.ts"));
    expect(r.code).toBe(1);
    expect(r.out).toContain("闸 3");
  });
});
