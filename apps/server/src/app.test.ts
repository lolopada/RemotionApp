import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createProject } from "@app/schema";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "./app";

const dataDir = mkdtempSync(path.join(tmpdir(), "montage-test-"));
const { app, close } = createApp({
  dataDir,
  maxUploadBytes: 5 * 1024 * 1024,
  maxExportBytes: 1024,
  allowSignup: true,
  sessionDays: 30,
});
afterAll(() => {
  close();
  rmSync(dataDir, { recursive: true, force: true });
});

/** Petit client qui garde le cookie de session, comme un navigateur. */
function client() {
  let cookie = "";
  return async (url: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    if (cookie) headers.set("cookie", cookie);
    const res = await app.request(url, { ...init, headers });
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0] ?? "";
    return res;
  };
}
const json = (body: unknown, method = "POST") => ({
  method,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

describe("comptes", () => {
  const alice = client();

  it("refuse l'accès sans session", async () => {
    expect((await alice("/api/projects")).status).toBe(401);
  });

  it("valide nom et mot de passe", async () => {
    expect((await alice("/api/auth/register", json({ username: "a", password: "12345678" }))).status).toBe(400);
    expect((await alice("/api/auth/register", json({ username: "alice", password: "court" }))).status).toBe(400);
  });

  it("inscrit, connecte et déconnecte", async () => {
    const res = await alice("/api/auth/register", json({ username: "alice", password: "motdepasse" }));
    expect(res.status).toBe(201);
    expect(res.headers.get("set-cookie")).toContain("HttpOnly");
    expect(((await (await alice("/api/auth/me")).json()) as { username: string }).username).toBe("alice");

    expect((await alice("/api/auth/register", json({ username: "ALICE", password: "motdepasse" }))).status).toBe(409);

    await alice("/api/auth/logout", { method: "POST" });
    expect((await alice("/api/auth/me")).status).toBe(401);
    expect((await alice("/api/auth/login", json({ username: "alice", password: "mauvais!!" }))).status).toBe(401);
    expect((await alice("/api/auth/login", json({ username: "Alice", password: "motdepasse" }))).status).toBe(200);
  });

  it("bloque les requêtes venant d'une autre origine", async () => {
    const res = await alice("/api/auth/logout", {
      method: "POST",
      headers: { origin: "https://pirate.example", host: "montage.local" },
    });
    expect(res.status).toBe(403);
  });
});

describe("projets et fichiers", () => {
  const alice = client();
  const bob = client();
  const project = createProject({ name: "Vacances" });

  it("crée des comptes", async () => {
    await alice("/api/auth/register", json({ username: "alice2", password: "motdepasse" }));
    await bob("/api/auth/register", json({ username: "bob", password: "motdepasse" }));
  });

  it("enregistre et liste les projets de l'utilisateur", async () => {
    expect((await alice(`/api/projects/${project.id}`, json(project, "PUT"))).status).toBe(200);
    const list = (await (await alice("/api/projects")).json()) as { id: string; sceneCount: number }[];
    expect(list).toHaveLength(1);
    expect(list[0]?.sceneCount).toBe(1);
  });

  it("isole les projets entre utilisateurs", async () => {
    expect((await bob(`/api/projects/${project.id}`)).status).toBe(404);
    expect((await bob(`/api/projects/${project.id}`, json({ ...project, name: "volé" }, "PUT"))).status).toBe(404);
    expect(await (await bob("/api/projects")).json()).toEqual([]);
    const mine = (await (await alice(`/api/projects/${project.id}`)).json()) as { name: string };
    expect(mine.name).toBe("Vacances");
  });

  it("stocke une vidéo exportée en flux et la sert seulement à son propriétaire", async () => {
    const res = await alice(`/api/videos?name=Test&projectId=${project.id}&duration=2`, {
      method: "POST",
      headers: { "content-type": "video/mp4" },
      body: new Uint8Array(100),
    });
    expect(res.status).toBe(201);
    const video = (await res.json()) as { url: string; size: number; durationSeconds: number };
    expect(video.size).toBe(100);
    expect(video.durationSeconds).toBe(2);
    expect((await alice(video.url)).status).toBe(200);
    expect((await bob(video.url)).status).toBe(404);
  });

  it("refuse une vidéo trop lourde", async () => {
    const res = await alice("/api/videos?name=Gros", {
      method: "POST",
      headers: { "content-type": "video/mp4" },
      body: new Uint8Array(5000),
    });
    expect(res.status).toBe(413);
  });

  it("importe un média et le supprime", async () => {
    const form = new FormData();
    form.append("file", new File([new Uint8Array([137, 80, 78, 71])], "x.png", { type: "image/png" }));
    const res = await alice("/api/assets", { method: "POST", body: form });
    expect(res.status).toBe(201);
    const asset = (await res.json()) as { id: string; url: string };
    expect((await (await alice("/api/assets?kind=image")).json()) as unknown[]).toHaveLength(1);
    expect((await alice(`/api/assets/${asset.id}`, { method: "DELETE" })).status).toBe(204);
    expect((await alice(asset.url)).status).toBe(404);
  });
});
