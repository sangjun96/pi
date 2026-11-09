import { expect, test, vi } from "vitest";
import { ensureFfmpeg, installerFor } from "../extensions/stt-installer.ts";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

function fixture(results: number[], approved = true) {
  const exec = vi.fn(async (_command: string, _args: string[]) => ({ code: results.shift() ?? 0, killed: false, stdout: "", stderr: "", truncated: false }));
  const ui = { confirm: vi.fn().mockResolvedValue(approved), notify: vi.fn() };
  return { exec, ui, run: (platform: NodeJS.Platform = "darwin", signal = new AbortController().signal) =>
    ensureFfmpeg(exec as unknown as ExtensionAPI["exec"], ui as unknown as ExtensionContext["ui"], platform, signal) };
}

test("does not install an existing ffmpeg", async () => {
  const f = fixture([0]);
  expect(await f.run()).toBe(true);
  expect(f.exec).toHaveBeenCalledTimes(1);
  expect(f.ui.confirm).not.toHaveBeenCalled();
});

test("installs on macOS only after consent and verifies the result", async () => {
  const f = fixture([1, 0, 0, 0]);
  expect(await f.run()).toBe(true);
  expect(f.exec.mock.calls.map((c) => c[0])).toEqual(["ffmpeg", "brew", "brew", "ffmpeg"]);
  expect(f.exec.mock.calls[2][1]).toEqual(["install", "ffmpeg"]);
});

test("declining installation, missing brew, and unsupported platforms do not install", async () => {
  const decline = fixture([1, 0], false);
  expect(await decline.run()).toBe(false);
  expect(decline.exec).toHaveBeenCalledTimes(2);
  const missing = fixture([1, 1]);
  expect(await missing.run()).toBe(false);
  expect(missing.ui.confirm).not.toHaveBeenCalled();
  const linux = fixture([1]);
  expect(await linux.run("linux")).toBe(false);
  expect(installerFor("win32")).toBeUndefined();
  expect(linux.exec).toHaveBeenCalledTimes(1);
});

test("handles installation failure and cancellation", async () => {
  const failed = fixture([1, 0, 1]);
  expect(await failed.run()).toBe(false);
  expect(failed.ui.notify).toHaveBeenCalledWith(expect.stringContaining("failed"), "error");
  const aborted = fixture([1]);
  const controller = new AbortController(); controller.abort();
  expect(await aborted.run("darwin", controller.signal)).toBe(false);
  expect(aborted.ui.confirm).not.toHaveBeenCalled();
});
