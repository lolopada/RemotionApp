import { describe, expect, it } from "vitest";
import { exportScale, exportSize } from "./quality";

describe("qualité d'export", () => {
  it("garde la taille du projet en 1080p pour un projet 1080p", () => {
    expect(exportScale(1920, 1080, "1080p")).toBe(1);
    expect(exportSize(1080, 1920, "4k")).toEqual({ width: 2160, height: 3840 });
  });

  it("fait tenir les formats larges dans la résolution choisie", () => {
    expect(exportSize(2520, 1080, "4k")).toEqual({ width: 3840, height: 1646 });
    expect(exportSize(1080, 1350, "720p")).toEqual({ width: 720, height: 900 });
    expect(exportSize(1920, 1080, "720p")).toEqual({ width: 1280, height: 720 });
  });
});
