import { describe, expect, it } from "vitest";
import { computePeaks, normalizePeaks, peakReference, slicePeaks, type Waveform } from "./waveform";

describe("pics audio", () => {
  it("garde la plus grande valeur absolue de chaque tranche", () => {
    const data = new Float32Array([0.1, -0.5, 0.2, 0.2, 0, 0.9, -0.3, 0.1]);
    expect([...computePeaks([data], 4)]).toEqual([0.5, 0.2, 0.9, 0.3].map((v) => Math.fround(v)));
  });

  it("prend le canal le plus fort", () => {
    const left = new Float32Array([0.2, 0.2]);
    const right = new Float32Array([0, -0.8]);
    expect(computePeaks([left, right], 1)[0]).toBeCloseTo(0.8);
  });

  it("gère un fichier vide", () => {
    expect(computePeaks([], 5).every((v) => v === 0)).toBe(true);
  });
});

describe("portion affichée", () => {
  // 10 s, un pic par seconde : 0,1,2…9 (en dixièmes)
  const wave: Waveform = { duration: 10, peaks: Float32Array.from({ length: 10 }, (_, i) => i / 10) };

  it("découpe une fenêtre", () => {
    expect([...slicePeaks(wave, 2, 5, 3)].map((v) => Math.round(v * 10))).toEqual([2, 3, 4]);
  });

  it("met à zéro ce qui dépasse du fichier", () => {
    const cols = [...slicePeaks(wave, -2, 2, 4)].map((v) => Math.round(v * 10));
    expect(cols).toEqual([0, 0, 0, 1]);
    expect([...slicePeaks(wave, 9, 12, 3)].map((v) => Math.round(v * 10))).toEqual([9, 0, 0]);
  });

  it("garde le maximum quand plusieurs pics tombent dans une colonne", () => {
    expect(slicePeaks(wave, 0, 10, 1)[0]).toBeCloseTo(0.9);
  });

  it("normalise sans dépasser 1", () => {
    const n = normalizePeaks(Float32Array.from([0.1, 0.4, 0.9]), 0.4);
    expect([...n].map((v) => Math.round(v * 100) / 100)).toEqual([0.25, 1, 1]);
  });

  it("ignore un claquement isolé dans la référence", () => {
    const peaks = new Float32Array(200).fill(0.3);
    peaks[10] = 1;
    expect(peakReference(peaks)).toBeCloseTo(0.3);
  });
});
