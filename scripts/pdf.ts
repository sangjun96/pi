#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import mupdf from "mupdf";

const MAX_PAGES = 50;
const MAX_TEXT = 200_000;

function usage() {
  throw new Error("Usage: pdf.ts info FILE | text FILE [START [END]] | render FILE PAGE OUTPUT.png (pages are 1-based)");
}

function pageNumber(value: string | undefined, count: number): number {
  if (!/^[1-9]\d*$/.test(value ?? "")) throw new Error("Page numbers must be positive integers");
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n > count) throw new Error(`Page ${value} is outside the document (1–${count})`);
  return n;
}

function main(args: string[]) {
  const [action, file, ...rest] = args;
  if (!file || !["info", "text", "render"].includes(action)) usage();
  if ((action === "info" && rest.length !== 0) || (action === "text" && rest.length > 2) || (action === "render" && rest.length !== 2)) usage();
  const doc = mupdf.Document.openDocument(readFileSync(file), "application/pdf");
  try {
    if (doc.needsPassword()) throw new Error("Password-protected PDFs are not supported by this script");
    const count = doc.countPages();
    if (action === "info") {
      console.log(JSON.stringify({ pages: count, title: doc.getMetaData("info:Title") || null, author: doc.getMetaData("info:Author") || null }, null, 2));
      return;
    }
    const start = pageNumber(rest[0] ?? (action === "text" ? "1" : undefined), count);
    if (action === "render") {
      const page = doc.loadPage(start - 1);
      try {
        const pixmap = page.toPixmap(mupdf.Matrix.scale(2, 2), mupdf.ColorSpace.DeviceRGB, false, true);
        try {
          writeFileSync(rest[1], pixmap.asPNG(), { flag: "wx" });
        } finally { pixmap.destroy(); }
      } finally { page.destroy(); }
      console.log(`Rendered page ${start} to ${rest[1]}`);
      return;
    }
    const end = pageNumber(rest[1] ?? String(start), count);
    if (end < start || end - start + 1 > MAX_PAGES) throw new Error(`Select an ascending range of at most ${MAX_PAGES} pages`);
    let length = 0;
    for (let n = start; n <= end; n++) {
      const page = doc.loadPage(n - 1);
      try {
        const text = page.toStructuredText("");
        try {
          const chunk = `--- Page ${n} ---\n${text.asText()}\n`;
          if (length + chunk.length > MAX_TEXT) throw new Error(`Text exceeds ${MAX_TEXT} characters; extract a smaller page range`);
          process.stdout.write(chunk);
          length += chunk.length;
        } finally { text.destroy(); }
      } finally { page.destroy(); }
    }
  } finally { doc.destroy(); }
}

try { main(process.argv.slice(2)); }
catch (error) { console.error(`PDF error: ${error instanceof Error ? error.message : String(error)}`); process.exitCode = 1; }
