import { TransitionKindSchema } from "@app/schema";
import { describe, expect, it } from "vitest";
import { customTransitionFrame, getPresentation, TRANSITION_LABELS } from "./transitions";

const W = 1920;
const H = 1080;

describe("transitions", () => {
  it("a un libellé et une présentation pour chaque effet du schéma", () => {
    for (const kind of TransitionKindSchema.options) {
      expect(TRANSITION_LABELS[kind]).toBeTruthy();
      if (kind !== "none") expect(getPresentation(kind).component).toBeTruthy();
    }
  });

  it("fondu enchaîné : la scène entrante apparaît, la sortante ne bouge pas", () => {
    expect(customTransitionFrame("fade", "entering", 0.25, W, H).style.opacity).toBe(0.25);
    expect(customTransitionFrame("fade", "exiting", 0.25, W, H).style).toEqual({});
  });

  it("iris : le cercle grandit jusqu'à couvrir le cadre puis disparaît", () => {
    const mid = customTransitionFrame("iris", "entering", 0.5, W, H).style.clipPath ?? "";
    expect(mid).toMatch(/^circle\(/);
    expect(customTransitionFrame("iris", "entering", 1, W, H).style.clipPath).toBeUndefined();
    expect(customTransitionFrame("iris", "exiting", 0.5, W, H).style.clipPath).toBeUndefined();
  });

  it("horloge : rien au début, polygone au milieu, plein à la fin", () => {
    expect(customTransitionFrame("clock", "entering", 0, W, H).style.clipPath).toBe("inset(50%)");
    expect(customTransitionFrame("clock", "entering", 0.5, W, H).style.clipPath).toMatch(/^polygon\(/);
    expect(customTransitionFrame("clock", "entering", 1, W, H).style.clipPath).toBeUndefined();
  });

  it("diagonale : le polygone couvre tout le cadre à la fin", () => {
    expect(customTransitionFrame("wipe-diagonal", "entering", 0, W, H).style.clipPath).toBe("inset(50%)");
    expect(customTransitionFrame("wipe-diagonal", "entering", 0.5, W, H).style.clipPath).toMatch(/^polygon\(/);
    expect(customTransitionFrame("wipe-diagonal", "entering", 1, W, H).style.clipPath).toBeUndefined();
  });

  it("fondu au noir/blanc : voile opaque au milieu, une seule scène visible à la fois", () => {
    const mid = customTransitionFrame("fade-black", "entering", 0.5, W, H);
    expect(mid.overlay).toEqual({ color: "#000", opacity: 1 });
    expect(customTransitionFrame("fade-white", "entering", 0.5, W, H).overlay?.color).toBe("#fff");
    expect(customTransitionFrame("fade-black", "exiting", 0.25, W, H).style.opacity).toBe(1);
    expect(customTransitionFrame("fade-black", "entering", 0.25, W, H).style.opacity).toBe(0);
    expect(customTransitionFrame("fade-black", "entering", 0.75, W, H).style.opacity).toBe(1);
    expect(customTransitionFrame("fade-black", "exiting", 0.75, W, H).style.opacity).toBe(0);
    expect(customTransitionFrame("fade-black", "entering", 0, W, H).overlay?.opacity).toBe(0);
    expect(customTransitionFrame("fade-black", "entering", 1, W, H).overlay?.opacity).toBe(0);
  });

  it("retournement : la sortante se referme avant que l'entrante s'ouvre", () => {
    expect(customTransitionFrame("flip", "exiting", 0, W, H).style.transform).toBe("scaleX(1)");
    expect(customTransitionFrame("flip", "exiting", 0.5, W, H).style.opacity).toBe(0);
    expect(customTransitionFrame("flip", "entering", 0.25, W, H).style.opacity).toBe(0);
    expect(customTransitionFrame("flip", "entering", 1, W, H).style.transform).toBe("scaleX(1)");
  });

  it("zoom : la scène entrante finit à l'échelle 1 et pleinement opaque", () => {
    for (const kind of ["zoom-in", "zoom-out"] as const) {
      const end = customTransitionFrame(kind, "entering", 1, W, H).style;
      expect(end.transform).toBe("scale(1)");
      expect(end.opacity).toBe(1);
      expect(customTransitionFrame(kind, "entering", 0, W, H).style.opacity).toBe(0);
    }
  });
});
