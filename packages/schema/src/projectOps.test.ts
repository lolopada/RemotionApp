import { describe, expect, it } from "vitest";
import {
  adaptScene,
  applyTheme,
  createAudioClip,
  createBackground,
  createProject,
  createScene,
  createShapeLayer,
  createTextLayer,
  createVideoLayer,
  evenSize,
  getProjectDurationInFrames,
  headingLayerIds,
  ProjectSchema,
  projectHasSound,
  resizeProject,
  retimeProject,
  type Theme,
} from "./index";

const theme: Theme = {
  name: "Test",
  colors: { background: "#111111", background2: "#222222", accent: "#ff0000", title: "#ffffff", text: "#cccccc" },
  headingFont: "Playfair Display",
  bodyFont: "Lora",
};

describe("changement de format", () => {
  it("garde la position relative et fait tenir le calque dans l'image", () => {
    const shape = createShapeLayer({ transform: { x: 760, y: 340, width: 400, height: 400 } });
    const project = createProject({ scenes: [createScene({ layers: [shape] })] });
    resizeProject(project, { width: 1080, height: 1920 });
    const t = project.scenes[0]?.layers[0]?.transform;
    // Centré avant, centré après ; facteur min(1080/1920, 1920/1080) = 0.5625.
    expect(t?.width).toBeCloseTo(225);
    expect((t?.x ?? 0) + (t?.width ?? 0) / 2).toBeCloseTo(540);
    expect((t?.y ?? 0) + (t?.height ?? 0) / 2).toBeCloseTo(960);
    expect(ProjectSchema.safeParse(project).success).toBe(true);
  });

  it("garde un texte lisible : il passe à la ligne au lieu de rétrécir", () => {
    const text = createTextLayer({
      text: "Titre",
      fontSize: 100,
      transform: { x: 160, y: 440, width: 1600, height: 200 },
    });
    const project = createProject({ scenes: [createScene({ layers: [text] })] });
    resizeProject(project, { width: 1080, height: 1920 });
    const l = project.scenes[0]?.layers[0];
    expect(l?.type === "text" && l.fontSize).toBeCloseTo(100);
    expect(l?.transform.width).toBeCloseTo(993.6);
    expect(l?.transform.height).toBeGreaterThan(300);
    expect((l?.transform.x ?? 0) + (l?.transform.width ?? 0) / 2).toBeCloseTo(540);
  });

  it("garde plein cadre un calque plein cadre", () => {
    const shape = createShapeLayer({ transform: { x: 0, y: 0, width: 1920, height: 1080 } });
    const project = createProject({ scenes: [createScene({ layers: [shape] })] });
    resizeProject(project, { width: 1080, height: 1350 });
    expect(project.scenes[0]?.layers[0]?.transform).toMatchObject({ x: 0, y: 0, width: 1080, height: 1350 });
  });

  it("arrondit les tailles à des nombres pairs", () => {
    expect(evenSize(1081)).toBe(1082);
    expect(evenSize(5)).toBe(16);
    expect(evenSize(9999)).toBe(3840);
  });
});

describe("changement de cadence", () => {
  it("garde les mêmes durées en secondes", () => {
    const project = createProject({
      scenes: [
        createScene({ durationInFrames: 90 }),
        createScene({
          durationInFrames: 60,
          transitionIn: { kind: "fade", durationInFrames: 15 },
          layers: [createTextLayer({ animation: { enterDelayInFrames: 30, endAtFrame: 45 } })],
        }),
      ],
    });
    project.audio.push(createAudioClip({ src: "/a.mp3", durationInFrames: 135, startFrame: 3 }));
    const seconds = getProjectDurationInFrames(project) / project.fps;
    retimeProject(project, 60);
    expect(project.fps).toBe(60);
    expect(getProjectDurationInFrames(project) / 60).toBeCloseTo(seconds);
    expect(project.scenes[1]?.layers[0]?.animation).toMatchObject({ enterDelayInFrames: 60, endAtFrame: 90 });
    expect(project.audio[0]).toMatchObject({ startFrame: 6, durationInFrames: 270 });
    retimeProject(project, 24);
    expect(project.scenes[0]?.durationInFrames).toBe(72);
  });

  it("adapte un modèle venu d'un autre format et d'une autre cadence", () => {
    const scene = createScene({ durationInFrames: 120, layers: [createTextLayer()] });
    adaptScene(scene, { width: 1080, height: 1920, fps: 30 }, { width: 1920, height: 1080, fps: 60 });
    expect(scene.durationInFrames).toBe(240);
  });
});

describe("thème", () => {
  it("distingue titres et textes courants", () => {
    const title = createTextLayer({ fontSize: 120 });
    const sub = createTextLayer({ fontSize: 40 });
    expect([...headingLayerIds(createScene({ layers: [title, sub] }))]).toEqual([title.id]);
  });

  it("applique palette et polices à toutes les scènes", () => {
    const project = createProject({
      scenes: [
        createScene({
          background: createBackground({ type: "gradient", colors: ["#000000", "#ffffff", "#00ff00"] }),
          layers: [createTextLayer({ fontSize: 120 }), createTextLayer({ fontSize: 40 }), createShapeLayer()],
        }),
        createScene({ background: createBackground({ type: "color", color: "#abcdef" }) }),
      ],
    });
    applyTheme(project, theme);
    const [a, b] = project.scenes;
    expect(a?.background).toMatchObject({ colors: ["#111111", "#ff0000", "#222222"] });
    expect(b?.background).toMatchObject({ color: "#111111" });
    expect(a?.layers[0]).toMatchObject({ fontFamily: "Playfair Display", color: "#ffffff" });
    expect(a?.layers[1]).toMatchObject({ fontFamily: "Lora", color: "#cccccc" });
    expect(a?.layers[2]).toMatchObject({ fill: "#ff0000" });
    expect(project.theme?.name).toBe("Test");
    expect(ProjectSchema.safeParse(project).success).toBe(true);
  });
});

describe("calques vidéo", () => {
  it("suit le changement de format et de cadence", () => {
    const video = createVideoLayer({
      src: "/files/a.mp4",
      trimStartFrames: 30,
      transform: { x: 100, y: 100, width: 800, height: 450 },
      dropShadow: { enabled: true, blur: 40 },
    });
    const project = createProject({ scenes: [createScene({ layers: [video] })] });
    resizeProject(project, { width: 1080, height: 1920 });
    const l = project.scenes[0]?.layers[0];
    expect(l?.type === "video" && l.dropShadow.blur).toBeCloseTo(22.5);
    expect(l?.transform.width).toBeCloseTo(450);
    retimeProject(project, 60);
    expect(l?.type === "video" && l.trimStartFrames).toBe(60);
    expect(ProjectSchema.safeParse(project).success).toBe(true);
  });

  it("sait s'il y a du son à exporter", () => {
    const video = createVideoLayer({ src: "/files/a.mp4" });
    const project = createProject({ scenes: [createScene({ layers: [video] })] });
    expect(projectHasSound(project)).toBe(true);
    const inProject = project.scenes[0]?.layers[0];
    if (inProject?.type === "video") inProject.muted = true;
    expect(projectHasSound(project)).toBe(false);
    project.audio.push(createAudioClip({ src: "/a.mp3", durationInFrames: 30 }));
    expect(projectHasSound(project)).toBe(true);
  });

  it("a des valeurs par défaut sûres", () => {
    const v = createVideoLayer({ src: "/files/a.mp4" });
    expect(v).toMatchObject({ volume: 1, muted: false, loop: true, playbackRate: 1, trimStartFrames: 0, fit: "cover" });
  });
});
