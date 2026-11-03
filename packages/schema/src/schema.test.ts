import { describe, expect, it } from "vitest";
import {
  createImageLayer,
  createProject,
  createScene,
  createTextLayer,
  duplicateScene,
  getProjectDurationInFrames,
  getSceneAtFrame,
  getSceneTimings,
  ProjectSchema,
} from "./index";

describe("factories", () => {
  it("crée un projet valide avec les valeurs par défaut", () => {
    const project = createProject();
    expect(ProjectSchema.safeParse(project).success).toBe(true);
    expect(project.scenes).toHaveLength(1);
  });

  it("remplit les sous-objets par défaut des calques", () => {
    const layer = createImageLayer();
    expect(layer.mask).toEqual({ shape: "none", feather: 0, radius: 32 });
    expect(layer.animation.enter).toBe("fade");
    expect(createTextLayer().fontFamily).toBe("Inter");
  });

  it("duplique une scène avec de nouveaux ids", () => {
    const scene = createScene({ layers: [createTextLayer()] });
    const copy = duplicateScene(scene);
    expect(copy.id).not.toBe(scene.id);
    expect(copy.layers[0]?.id).not.toBe(scene.layers[0]?.id);
  });
});

describe("timing", () => {
  const scenes = [
    createScene({ durationInFrames: 100 }),
    createScene({ durationInFrames: 100, transitionIn: { kind: "fade", durationInFrames: 20 } }),
    createScene({ durationInFrames: 50, transitionIn: { kind: "none", durationInFrames: 20 } }),
  ];

  it("fait chevaucher les scènes pendant les transitions", () => {
    const t = getSceneTimings(scenes);
    expect(t.map((s) => s.startFrame)).toEqual([0, 80, 180]);
    expect(getProjectDurationInFrames({ scenes })).toBe(230);
  });

  it("limite une transition trop longue", () => {
    const short = [
      createScene({ durationInFrames: 10 }),
      createScene({ durationInFrames: 10, transitionIn: { kind: "fade", durationInFrames: 60 } }),
    ];
    expect(getSceneTimings(short)[1]?.transitionFrames).toBe(9);
  });

  it("retrouve la scène à une frame", () => {
    expect(getSceneAtFrame(scenes, 90)?.id).toBe(scenes[1]?.id);
    expect(getSceneAtFrame(scenes, 200)?.id).toBe(scenes[2]?.id);
  });
});
