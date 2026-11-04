import { createProject, createScene, duplicateScene, FORMATS, newId, type Project } from "@app/schema";
import { api } from "../../lib/api";
import { createDemoProject } from "../../templates/sceneTemplates";

export type FormatKey = keyof typeof FORMATS;

export const FORMAT_LABELS: Record<FormatKey, string> = {
  landscape: "Paysage 16:9",
  portrait: "Portrait 9:16",
  square: "Carré 1:1",
  instagram: "Instagram 4:5",
  cinema: "Cinéma 21:9",
};

/** Cadences proposées (images par seconde). */
export const FPS_OPTIONS = [24, 30, 60] as const;

/** Crée un projet (vide ou démo) sur le serveur et renvoie son id. */
export async function createNewProject(format: FormatKey, start: "blank" | "demo"): Promise<string> {
  const f = FORMATS[format];
  const project =
    start === "demo"
      ? createDemoProject(f)
      : createProject({ name: "Nouveau montage", format: f, scenes: [createScene({ name: "Scène 1" })] });
  const saved = await api.saveProject(project);
  return saved.id;
}

/** Enregistre une copie complète d'un projet, avec de nouveaux identifiants partout. */
async function saveCopy(original: Project, name: string): Promise<string> {
  const now = new Date().toISOString();
  const copy: Project = {
    ...original,
    id: newId(),
    name,
    scenes: original.scenes.map(duplicateScene),
    audio: original.audio.map((clip) => ({ ...clip, id: newId() })),
    createdAt: now,
    updatedAt: now,
  };
  return (await api.saveProject(copy)).id;
}

export async function duplicateProject(id: string): Promise<string> {
  const original = await api.getProject(id);
  return saveCopy(original, `${original.name} (copie)`);
}

/** Nouveau projet à partir d'une ancienne version (le projet d'origine ne change pas). */
export async function projectFromVersion(projectId: string, versionId: string, when: string): Promise<string> {
  const version = await api.getVersion(projectId, versionId);
  return saveCopy(version, `${version.name} (version du ${when})`);
}

export async function renameProject(id: string, name: string) {
  const project = await api.getProject(id);
  await api.saveProject({ ...project, name });
}
