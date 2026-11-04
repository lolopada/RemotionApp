import { describe, expect, it } from "vitest";
import {
  type Box,
  boundingBox,
  boxCenter,
  normalizeAngle,
  resizeBox,
  resizeCursor,
  rotateVec,
  rotationFromPointer,
  snapMove,
} from "./transformMath";

const box: Box = { x: 100, y: 100, width: 200, height: 100, rotation: 0 };
const free = { keepRatio: false, fromCenter: false };

describe("redimensionnement", () => {
  it("tire le coin bas-droit : le coin haut-gauche reste fixe", () => {
    const r = resizeBox(box, { hx: 1, hy: 1 }, 400, 300, free);
    expect(r).toMatchObject({ x: 100, y: 100, width: 300, height: 200 });
  });

  it("tire le coin haut-gauche : le coin bas-droit reste fixe", () => {
    const r = resizeBox(box, { hx: -1, hy: -1 }, 50, 50, free);
    expect(r).toMatchObject({ x: 50, y: 50, width: 250, height: 150 });
  });

  it("une poignée de bord ne change qu'une dimension", () => {
    const r = resizeBox(box, { hx: 1, hy: 0 }, 500, 999, free);
    expect(r).toMatchObject({ x: 100, y: 100, width: 400, height: 100 });
  });

  it("garde les proportions sur un coin", () => {
    const r = resizeBox(box, { hx: 1, hy: 1 }, 500, 150, { keepRatio: true, fromCenter: false });
    expect(r.width / r.height).toBeCloseTo(2);
    expect(r.scale).toBeCloseTo(2);
    expect(r.x).toBe(100);
  });

  it("redimensionne depuis le centre", () => {
    const r = resizeBox(box, { hx: 1, hy: 1 }, 350, 250, { keepRatio: false, fromCenter: true });
    expect(boxCenter(r)).toEqual({ x: 200, y: 150 });
    expect(r).toMatchObject({ width: 300, height: 200 });
  });

  it("ne descend pas sous la taille minimale ni ne se retourne", () => {
    const r = resizeBox(box, { hx: 1, hy: 1 }, 0, 0, free);
    expect(r.width).toBe(8);
    expect(r.height).toBe(8);
    expect(r.x).toBe(100);
  });

  it("garde le coin opposé fixe à l'écran sur une boîte tournée", () => {
    const rotated: Box = { ...box, rotation: 30 };
    const c = boxCenter(rotated);
    const corner = (b: Box, sx: number, sy: number) => {
      const bc = boxCenter(b);
      const p = rotateVec((sx * b.width) / 2, (sy * b.height) / 2, b.rotation);
      return { x: bc.x + p.x, y: bc.y + p.y };
    };
    const before = corner(rotated, -1, -1);
    // On tire le coin bas-droit 60 px plus loin le long de l'axe du calque.
    const target = corner(rotated, 1, 1);
    const along = rotateVec(60, 0, 30);
    const r = resizeBox(rotated, { hx: 1, hy: 1 }, target.x + along.x, target.y + along.y, free);
    expect(r.width).toBeCloseTo(260);
    expect(r.height).toBeCloseTo(100);
    const after = corner(r, -1, -1);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
    expect(c.x).toBe(200);
  });
});

describe("rotation", () => {
  const center = { x: 200, y: 200 };
  it("0° quand le pointeur est au-dessus du centre", () => {
    expect(rotationFromPointer(center, 200, 50)).toBe(0);
  });
  it("90° quand le pointeur est à droite", () => {
    expect(rotationFromPointer(center, 400, 200)).toBe(90);
  });
  it("-90° à gauche, 180° en dessous", () => {
    expect(rotationFromPointer(center, 0, 200)).toBe(-90);
    expect(rotationFromPointer(center, 200, 400)).toBe(180);
  });
  it("s'aimante sur 45° et arrondit au pas demandé", () => {
    expect(rotationFromPointer(center, 200 + 100, 200 - 97)).toBe(45);
    expect(rotationFromPointer(center, 200 + 100, 200 - 60, 15)).toBe(60);
  });
  it("normalise les angles", () => {
    expect(normalizeAngle(190)).toBe(-170);
    expect(normalizeAngle(-180)).toBe(180);
    expect(normalizeAngle(720)).toBe(0);
  });
});

describe("aimantation", () => {
  const frame = { width: 1920, height: 1080 };
  it("centre le calque sur l'image", () => {
    const b: Box = { x: 862, y: 478, width: 200, height: 100, rotation: 0 };
    const s = snapMove(b, frame, 10);
    expect(s.dx).toBe(-2);
    expect(s.dy).toBe(0); // 12 px d'écart au centre vertical : hors du seuil de 10 px
    expect(s.guides).toEqual([{ axis: "x", at: 960 }]);
  });
  it("colle un bord au bord de l'image", () => {
    const s = snapMove({ x: 6, y: 300, width: 200, height: 100, rotation: 0 }, frame, 10);
    expect(s.dx).toBe(-6);
    expect(s.guides).toContainEqual({ axis: "x", at: 0 });
  });
  it("ne fait rien hors du seuil", () => {
    expect(snapMove({ x: 300, y: 300, width: 200, height: 100, rotation: 0 }, frame, 10)).toEqual({
      dx: 0,
      dy: 0,
      guides: [],
    });
  });
  it("utilise le rectangle englobant d'une boîte tournée", () => {
    const bb = boundingBox({ x: 0, y: 0, width: 200, height: 100, rotation: 90 });
    expect(bb.right - bb.left).toBeCloseTo(100);
    expect(bb.bottom - bb.top).toBeCloseTo(200);
  });
});

describe("curseurs", () => {
  it("suit la rotation", () => {
    expect(resizeCursor({ hx: 1, hy: 0 }, 0)).toBe("ew-resize");
    expect(resizeCursor({ hx: 1, hy: 0 }, 90)).toBe("ns-resize");
    expect(resizeCursor({ hx: 1, hy: 1 }, 0)).toBe("nwse-resize");
    expect(resizeCursor({ hx: 1, hy: -1 }, 0)).toBe("nesw-resize");
    expect(resizeCursor({ hx: 1, hy: 1 }, 90)).toBe("nesw-resize");
  });
});
