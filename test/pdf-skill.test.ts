import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, expect, test } from "vitest";

const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "pi-pdf-")); dirs.push(dir);
  const stream = "BT /F1 18 Tf 72 720 Td (Hello PDF) Tj ET";
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>", `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"];
  let pdf = "%PDF-1.4\n"; const offsets = [0];
  objects.forEach((object, i) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${i + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${offsets.length}\n0000000000 65535 f \n` + offsets.slice(1).map(n => `${String(n).padStart(10, "0")} 00000 n \n`).join("") + `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  const file = join(dir, "test.pdf"); writeFileSync(file, pdf); return { dir, file };
}
function run(...args: string[]) { return spawnSync(process.execPath, [resolve("scripts/pdf.ts"), ...args], { encoding: "utf8" }); }
test("inspects, extracts, and renders a PDF without overwriting", () => {
  const { dir, file } = fixture();
  const info = run("info", file); expect(info.status).toBe(0); expect(JSON.parse(info.stdout).pages).toBe(1);
  const text = run("text", file); expect(text.status).toBe(0); expect(text.stdout).toContain("Hello PDF");
  const png = join(dir, "page.png"); expect(run("render", file, "1", png).status).toBe(0);
  expect(readFileSync(png).subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  expect(run("render", file, "1", png).status).not.toBe(0);
});
test("rejects invalid inputs and page ranges", () => {
  const { dir, file } = fixture();
  expect(run("text", file, "0").status).not.toBe(0);
  expect(run("text", file, "1", "2").status).not.toBe(0);
  const bad = join(dir, "bad.pdf"); writeFileSync(bad, "not a pdf");
  expect(run("info", bad).status).not.toBe(0);
});
