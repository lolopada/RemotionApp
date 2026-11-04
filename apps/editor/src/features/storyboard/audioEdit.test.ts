import { describe, expect, it } from "vitest";
import { type ClipGeom, moveClip, snapTo, trimClipEnd, trimClipStart } from "./audioEdit";

const clip: ClipGeom = { startFrame: 100, durationInFrames: 200, trimStartFrames: 50 };

describe("aimantation", () => {
  it("choisit le repère le plus proche dans le seuil", () => {
    expect(snapTo(97, [0, 100, 300], 5)).toBe(100);
    expect(snapTo(120, [0, 100, 300], 5)).toBe(120);
  });
});

describe("déplacement", () => {
  it("ne passe pas avant le début de la vidéo", () => {
    expect(moveClip(clip, -500, [], 0).startFrame).toBe(0);
  });
  it("aimante le début sur un changement de scène", () => {
    expect(moveClip(clip, 47, [150], 6).startFrame).toBe(150);
  });
  it("aimante la fin sur la fin de la vidéo", () => {
    // fin = 100+200+57 = 357 → 360 : le début passe à 160
    expect(moveClip(clip, 57, [360], 6).startFrame).toBe(160);
  });
});

describe("découpe du début", () => {
  it("avance le début et saute autant de fichier", () => {
    expect(trimClipStart(clip, 30, [], 0)).toEqual({ startFrame: 130, durationInFrames: 170, trimStartFrames: 80 });
  });
  it("reculer rend du fichier, jusqu'à son début", () => {
    expect(trimClipStart(clip, -30, [], 0)).toEqual({ startFrame: 70, durationInFrames: 230, trimStartFrames: 20 });
    expect(trimClipStart(clip, -500, [], 0)).toEqual({ startFrame: 50, durationInFrames: 250, trimStartFrames: 0 });
  });
  it("garde une durée minimale", () => {
    expect(trimClipStart(clip, 999, [], 0).durationInFrames).toBe(3);
  });
});

describe("découpe de la fin", () => {
  it("raccourcit et rallonge", () => {
    expect(trimClipEnd(clip, -50, null, [], 0).durationInFrames).toBe(150);
    expect(trimClipEnd(clip, 50, null, [], 0).durationInFrames).toBe(250);
  });
  it("ne dépasse pas la fin du fichier", () => {
    // fichier de 400 frames, 50 déjà sautées : 350 au plus
    expect(trimClipEnd(clip, 900, 400, [], 0).durationInFrames).toBe(350);
  });
  it("s'aimante sur un repère", () => {
    expect(trimClipEnd(clip, 3, null, [300 + 3 + 2], 4).durationInFrames).toBe(205);
  });
});
