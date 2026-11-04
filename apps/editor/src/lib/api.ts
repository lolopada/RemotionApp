import type { FileKind, Project, ProjectSummary, ProjectVersion, SceneTemplate, StoredFile, User } from "@app/schema";

/**
 * Client de l'API (même origine : proxy Vite en dev, même serveur en prod).
 * La session est un cookie httpOnly : rien à stocker côté navigateur.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Appelé quand le serveur répond 401 (session expirée) : l'app revient à l'écran de connexion. */
let onUnauthorized: () => void = () => {};
export const setUnauthorizedHandler = (fn: () => void) => {
  onUnauthorized = fn;
};

async function request<T>(path: string, init?: RequestInit & { skipAuthRedirect?: boolean }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { credentials: "same-origin", ...init });
  } catch {
    throw new ApiError("Serveur injoignable", 0);
  }
  if (!res.ok) {
    if (res.status === 401 && !init?.skipAuthRedirect) onUnauthorized();
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(body?.error ?? `Erreur ${res.status}`, res.status);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const api = {
  // --- Compte
  authConfig: () => request<{ allowSignup: boolean }>("/api/auth/config"),
  me: () => request<User>("/api/auth/me", { skipAuthRedirect: true }),
  register: (username: string, password: string) =>
    request<User>("/api/auth/register", { ...json("POST", { username, password }), skipAuthRedirect: true }),
  login: (username: string, password: string) =>
    request<User>("/api/auth/login", { ...json("POST", { username, password }), skipAuthRedirect: true }),
  logout: () => request<void>("/api/auth/logout", { method: "POST" }),
  changePassword: (current: string, next: string) =>
    request<void>("/api/auth/password", { ...json("POST", { current, next }), skipAuthRedirect: true }),

  // --- Projets
  listProjects: () => request<ProjectSummary[]>("/api/projects"),
  getProject: (id: string) => request<Project>(`/api/projects/${id}`),
  saveProject: (project: Project, opts: { keepalive?: boolean } = {}) =>
    request<Project>(`/api/projects/${project.id}`, { ...json("PUT", project), keepalive: opts.keepalive }),
  deleteProject: (id: string) => request<void>(`/api/projects/${id}`, { method: "DELETE" }),

  // --- Historique des versions
  listVersions: (projectId: string) => request<ProjectVersion[]>(`/api/projects/${projectId}/versions`),
  getVersion: (projectId: string, versionId: string) =>
    request<Project>(`/api/projects/${projectId}/versions/${versionId}`),
  createVersion: (projectId: string, label: string | null) =>
    request<ProjectVersion>(`/api/projects/${projectId}/versions`, json("POST", { label })),
  labelVersion: (projectId: string, versionId: string, label: string) =>
    request<ProjectVersion>(`/api/projects/${projectId}/versions/${versionId}`, json("PATCH", { label })),
  deleteVersion: (projectId: string, versionId: string) =>
    request<void>(`/api/projects/${projectId}/versions/${versionId}`, { method: "DELETE" }),
  restoreVersion: (projectId: string, versionId: string) =>
    request<Project>(`/api/projects/${projectId}/versions/${versionId}/restore`, { method: "POST" }),

  // --- Médias importés
  listAssets: (kind?: Exclude<FileKind, "export">) =>
    request<StoredFile[]>(`/api/assets${kind ? `?kind=${kind}` : ""}`),
  uploadAsset: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<StoredFile>("/api/assets", { method: "POST", body: form });
  },
  deleteAsset: (id: string) => request<void>(`/api/assets/${id}`, { method: "DELETE" }),

  // --- Mes modèles (scènes réutilisables)
  listTemplates: () => request<SceneTemplate[]>("/api/templates"),
  createTemplate: (t: Omit<SceneTemplate, "id" | "createdAt">) =>
    request<SceneTemplate>("/api/templates", json("POST", t)),
  renameTemplate: (id: string, name: string) => request<SceneTemplate>(`/api/templates/${id}`, json("PATCH", { name })),
  deleteTemplate: (id: string) => request<void>(`/api/templates/${id}`, { method: "DELETE" }),

  // --- Vidéos exportées
  listVideos: () => request<StoredFile[]>("/api/videos"),
  renameVideo: (id: string, name: string) => request<StoredFile>(`/api/videos/${id}`, json("PATCH", { name })),
  deleteVideo: (id: string) => request<void>(`/api/videos/${id}`, { method: "DELETE" }),
  /** Envoi en flux brut, avec progression (fetch ne sait pas suivre l'envoi). */
  uploadVideo: (
    blob: Blob,
    meta: { name: string; projectId: string; width: number; height: number; duration: number },
    onProgress?: (fraction: number) => void,
  ) =>
    new Promise<StoredFile>((resolve, reject) => {
      const params = new URLSearchParams(Object.entries(meta).map(([k, v]) => [k, String(v)]));
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `/api/videos?${params}`);
      xhr.setRequestHeader("Content-Type", blob.type || "video/mp4");
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
      xhr.onload = () => {
        if (xhr.status === 401) onUnauthorized();
        if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText) as StoredFile);
        else reject(new ApiError(safeError(xhr.responseText) ?? `Erreur ${xhr.status}`, xhr.status));
      };
      xhr.onerror = () => reject(new ApiError("Serveur injoignable", 0));
      xhr.send(blob);
    }),
};

function safeError(text: string): string | null {
  try {
    return (JSON.parse(text) as { error?: string }).error ?? null;
  } catch {
    return null;
  }
}
