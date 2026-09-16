import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.resolve(HERE, "..", "..");
const REPO = path.resolve(SRC_ROOT, "..");
const GOOD_CSV = path.join(REPO, "data", "colleges.csv");

/**
 * 「闸 2 自身的测试」（docs/08 §3.5 / §7.2 最后一行）——
 * 故意把列名改错一位，构建**必须以退出码 1 失败**。
 * 没有这条，"字段一致性校验"可能形同虚设。
 */
function runBuild(csvPath: string, outPath: string) {
  try {
    const stdout = execFileSync("pnpm", ["exec", "tsx", "scripts/build-colleges.ts"], {
      cwd: SRC_ROOT,
      env: { ...process.env, COLLEGES_CSV: csvPath, COLLEGES_OUT: outPath },
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

describe("构建校验（闸 2）", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "hfi-gate-"));
  const outOk = path.join(tmp, "ok.ts");

  it("列名正确时构建成功（退出码 0）", () => {
    const r = runBuild(GOOD_CSV, outOk);
    expect(r.code, r.out).toBe(0);
    expect(fs.existsSync(outOk)).toBe(true);
  });

  it("把某一列名改错一位 → 必须以退出码 1 失败，且不产出文件", () => {
    const lines = fs.readFileSync(GOOD_CSV, "utf8").split("\n");
    // 把 st（州缩写）改错一位
    const header = lines[0].split(",");
    const at = header.indexOf("st");
    expect(at).toBeGreaterThan(-1);
    header[at] = "stx";
    lines[0] = header.join(",");

    const badCsv = path.join(tmp, "bad-column.csv");
    const badOut = path.join(tmp, "bad.ts");
    fs.writeFileSync(badCsv, lines.join("\n"), "utf8");

    const r = runBuild(badCsv, badOut);
    expect(r.code, "校验没有拦住改错的列名").toBe(1);
    expect(r.out).toContain("表头与 schema 不一致");
    expect(fs.existsSync(badOut)).toBe(false);
  });

  it("缺少一列 → 退出码 1", () => {
    const lines = fs.readFileSync(GOOD_CSV, "utf8").split("\n");
    const header = lines[0].split(",");
    const at = header.indexOf("st");
    const body = lines.slice(1).map((l) => l.split(",").filter((_, i) => i !== at).join(","));
    const badCsv = path.join(tmp, "missing-column.csv");
    fs.writeFileSync(badCsv, [header.filter((_, i) => i !== at).join(","), ...body].join("\n"), "utf8");

    const r = runBuild(badCsv, path.join(tmp, "missing.ts"));
    // 缺列会同时触发「列名集合不一致」与「列数不符」，两种都算拦住
    expect(r.code).toBe(1);
  });

  it("把某一行的枚举值改错 → 退出码 1", () => {
    const lines = fs.readFileSync(GOOD_CSV, "utf8").split("\n");
    const header = lines[0].split(",");
    const typeIdx = header.indexOf("type");
    const cells = lines[1].split(",");
    cells[typeIdx] = "university"; // 合法值只有 uni / lac
    lines[1] = cells.join(",");

    const badCsv = path.join(tmp, "bad-enum.csv");
    fs.writeFileSync(badCsv, lines.join("\n"), "utf8");

    const r = runBuild(badCsv, path.join(tmp, "bad-enum.ts"));
    expect(r.code).toBe(1);
  });
});
