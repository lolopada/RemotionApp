import { LayerAnimationSchema } from "@app/schema";
import { describe, expect, it } from "vitest";
import { applyEasing, computeAnimation } from "./animations";

const anim = (init: Record<string, unknown> = {}) => LayerAnimationSchema.parse(init);
const at = (init: Record<string, unknown>, frame: number, scene = 150) =>
  computeAnimation(anim(init), frame, 30, scene);

describe("timing précis", () => {
  it("cache le calque avant son apparition, même sans effet d'entrée", () => {
    const a = { enter: "none", enterDelayInFrames: 45 };
    expect(at(a, 44).hidden).toBe(true);
    expect(at(a, 45).hidden).toBe(false);
  });

  it("cache le calque à partir de l'instant de disparition", () => {
    const a = { enter: "none", endAtFrame: 90 };
    expect(at(a, 89).hidden).toBe(false);
    expect(at(a, 90).hidden).toBe(true);
  });

  it("sans moment de disparition, reste jusqu'à la fin de la scène", () => {
    expect(at({ enter: "none" }, 149).hidden).toBe(false);
  });

  it("la sortie se termine exactement à l'instant de disparition", () => {
    const a = { enter: "none", exit: "fade", exitDurationInFrames: 20, endAtFrame: 90 };
    expect(at(a, 69).opacity).toBe(1);
    expect(at(a, 80).opacity).toBeGreaterThan(0);
    expect(at(a, 80).opacity).toBeLessThan(1);
    expect(at(a, 89).opacity).toBeCloseTo(0, 5);
  });
});

describe("entrées", () => {
  it("un fondu va de 0 à 1 sur sa durée", () => {
    const a = { enter: "fade", enterDurationInFrames: 30, enterDelayInFrames: 10 };
    expect(at(a, 10).opacity).toBe(0);
    expect(at(a, 40).opacity).toBe(1);
  });

  it("le flou vers net finit net, sans filtre", () => {
    const a = { enter: "blur", enterDurationInFrames: 30 };
    expect(at(a, 0).filter).toMatch(/blur\(30px\)/);
    expect(at(a, 30).filter).toBeUndefined();
  });

  it("le volet ne laisse plus de clip-path une fois ouvert", () => {
    const a = { enter: "wipe-right", enterDurationInFrames: 30 };
    expect(at(a, 0).clipPath).toBe("inset(0 100% 0 0)");
    expect(at(a, 30).clipPath).toBeUndefined();
  });

  it("le retournement part aplati et finit à l'échelle 1", () => {
    const a = { enter: "flip", enterDurationInFrames: 30 };
    expect(at(a, 0).transform).toContain("scale(0.001, 1)");
    expect(at(a, 30).transform).toContain("scale(1, 1)");
  });

  it("la chute rebondit : elle arrive en bas puis remonte un peu", () => {
    const a = { enter: "bounce", enterDurationInFrames: 60 };
    const ty = (f: number) => Number(/translate\((-?[\d.]+)px, (-?[\d.]+)px\)/.exec(at(a, f).transform)?.[2]);
    expect(ty(0)).toBeLessThan(-200);
    expect(ty(60)).toBe(0);
    expect(Math.min(...Array.from({ length: 59 }, (_, i) => ty(i + 1)))).toBeLessThan(-5);
  });
});

describe("boucles", () => {
  it("commencent en douceur à l'apparition", () => {
    expect(at({ enter: "none", loop: { kind: "sway" } }, 0).transform).toContain("rotate(0deg)");
  });
  it("la rotation lente tourne dans le temps", () => {
    const r = (f: number) =>
      Number(/rotate\((-?[\d.]+)deg\)/.exec(at({ enter: "none", loop: { kind: "spin" } }, f).transform)?.[1]);
    expect(r(30)).toBeCloseTo(30, 1);
    expect(r(90)).toBeCloseTo(90, 1);
  });
});

describe("courbes", () => {
  it("toutes les courbes vont de 0 à 1", () => {
    for (const kind of ["smooth", "linear", "inout", "elastic"] as const) {
      for (const dir of ["in", "out"] as const) {
        expect(applyEasing(kind, 0, dir)).toBeCloseTo(0, 5);
        expect(applyEasing(kind, 1, dir)).toBeCloseTo(1, 5);
      }
    }
  });
  it("l'élastique dépasse 1 avant de se stabiliser", () => {
    const max = Math.max(...Array.from({ length: 100 }, (_, i) => applyEasing("elastic", (i + 1) / 100, "out")));
    expect(max).toBeGreaterThan(1.01);
  });
});
