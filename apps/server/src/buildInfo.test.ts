import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createApp } from "./app";
import { readBuildInfo } from "./buildInfo";

describe("numéro de version", () => {
  const root = mkdtempSync(path.join(tmpdir(), "montage-version-"));
  writeFileSync(path.join(root, "package.json"), JSON.stringify({ version: "2.3.4" }));
  const dist = path.join(root, "dist");
  mkdirSync(dist);

  it("sans build : version du package.json, commit « dev »", () => {
    expect(readBuildInfo(dist, root)).toEqual({ version: "2.3.4", commit: "dev", builtAt: null });
  });

  it("avec build : lit dist/version.json", () => {
    writeFileSync(
      path.join(dist, "version.json"),
      JSON.stringify({ version: "2.3.5", commit: "abc1234", builtAt: "2026-11-04T18:00:00.000Z" }),
    );
    expect(readBuildInfo(dist, root)).toEqual({
      version: "2.3.5",
      commit: "abc1234",
      builtAt: "2026-11-04T18:00:00.000Z",
    });
  });

  it("/api/health renvoie la version, sans cache", async () => {
    const { app, close } = createApp(
      {
        dataDir: mkdtempSync(path.join(tmpdir(), "montage-data-")),
        maxUploadBytes: 1e6,
        maxExportBytes: 1e6,
        allowSignup: true,
        sessionDays: 1,
        versionIntervalMs: 0,
        maxAutoVersions: 5,
      },
      { buildInfo: { version: "2.3.5", commit: "abc1234", builtAt: null } },
    );
    const res = await app.request("/api/health");
    expect(await res.json()).toEqual({ ok: true, version: "2.3.5", commit: "abc1234", builtAt: null });
    expect(res.headers.get("cache-control")).toBe("no-store");
    close();
  });
});
