import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createProject, createScene, createTextLayer } from "@app/schema";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "./app";

const dataDir = mkdtempSync(path.join(tmpdir(), "montage-test-"));
const { app, db, close } = createApp({
  dataDir,
  maxUploadBytes: 5 * 1024 * 1024,
  maxExportBytes: 1024,
  allowSignup: true,
  sessionDays: 30,
  versionIntervalMs: 0, // une version auto à chaque enregistrement, pour les tests
  maxAutoVersions: 3,
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

describe("historique des versions", () => {
  const alice = client();
  const bob = client();
  const project = createProject({ name: "v1" });
  type V = { id: string; kind: string; label: string | null; name: string };
  const versions = async () => (await (await alice(`/api/projects/${project.id}/versions`)).json()) as V[];
  const save = (name: string) => alice(`/api/projects/${project.id}`, json({ ...project, name }, "PUT"));

  it("crée des comptes", async () => {
    await alice("/api/auth/register", json({ username: "alice3", password: "motdepasse" }));
    await bob("/api/auth/register", json({ username: "bob3", password: "motdepasse" }));
  });

  it("garde l'état précédent à chaque enregistrement (sans doublon)", async () => {
    await save("v1");
    expect(await versions()).toHaveLength(0); // création : rien d'antérieur
    await save("v2");
    await save("v3");
    expect((await versions()).map((v) => v.name)).toEqual(["v2", "v1"]);
    await save("v3");
    await save("v3");
    expect((await versions()).map((v) => v.name)).toEqual(["v3", "v2", "v1"]);
  });

  it("limite les versions auto mais garde les versions nommées", async () => {
    const res = await alice(`/api/projects/${project.id}/versions`, json({ label: "Avant les gros changements" }));
    expect(res.status).toBe(201);
    for (const n of ["v4", "v5", "v6", "v7"]) await save(n);
    const list = await versions();
    expect(list.filter((v) => v.kind === "auto")).toHaveLength(3);
    expect(list.find((v) => v.kind === "manual")?.label).toBe("Avant les gros changements");
  });

  it("nommer une version la protège", async () => {
    const auto = (await versions()).find((v) => v.kind === "auto") as V;
    const res = await alice(`/api/projects/${project.id}/versions/${auto.id}`, json({ label: "Gardée" }, "PATCH"));
    expect(((await res.json()) as V).kind).toBe("manual");
  });

  it("restaure une version, et la restauration est elle-même annulable", async () => {
    const manual = (await versions()).find((v) => v.label === "Avant les gros changements") as V;
    const preview = (await (await alice(`/api/projects/${project.id}/versions/${manual.id}`)).json()) as {
      name: string;
    };
    expect(preview.name).toBe("v3");
    const res = await alice(`/api/projects/${project.id}/versions/${manual.id}/restore`, { method: "POST" });
    expect(((await res.json()) as { name: string }).name).toBe("v3");
    const current = (await (await alice(`/api/projects/${project.id}`)).json()) as { name: string };
    expect(current.name).toBe("v3");
    const before = (await versions()).find((v) => v.kind === "before-restore");
    expect(before?.name).toBe("v7");
  });

  it("isole l'historique entre comptes", async () => {
    const v = (await versions())[0] as V;
    expect((await bob(`/api/projects/${project.id}/versions`)).status).toBe(404);
    expect((await bob(`/api/projects/${project.id}/versions/${v.id}`)).status).toBe(404);
    expect((await bob(`/api/projects/${project.id}/versions/${v.id}/restore`, { method: "POST" })).status).toBe(404);
    expect((await bob(`/api/projects/${project.id}/versions/${v.id}`, { method: "DELETE" })).status).toBe(404);
  });

  it("supprime une version, puis tout l'historique avec le projet", async () => {
    const v = (await versions())[0] as V;
    expect((await alice(`/api/projects/${project.id}/versions/${v.id}`, { method: "DELETE" })).status).toBe(204);
    await alice(`/api/projects/${project.id}`, { method: "DELETE" });
    expect((await alice(`/api/projects/${project.id}/versions`)).status).toBe(404);
  });
});

describe("mes modèles", () => {
  const carol = client();
  const dave = client();
  const scene = createScene({ name: "Titre", layers: [createTextLayer({ text: "Bonjour" })] });

  it("crée des comptes", async () => {
    // Autre adresse : les inscriptions sont limitées à 10 par minute et par adresse.
    const from = (body: unknown) => ({
      ...json(body),
      headers: { "content-type": "application/json", "x-forwarded-for": "10.0.0.9" },
    });
    expect((await carol("/api/auth/register", from({ username: "carol", password: "motdepasse" }))).status).toBe(201);
    expect((await dave("/api/auth/register", from({ username: "dave", password: "motdepasse" }))).status).toBe(201);
    expect((await carol("/api/templates")).status).toBe(200);
  });

  it("enregistre, renomme et liste un modèle", async () => {
    const res = await carol("/api/templates", json({ name: "Mon titre", scene, width: 1080, height: 1920, fps: 30 }));
    expect(res.status).toBe(201);
    const created = (await res.json()) as { id: string };
    const renamed = await carol(`/api/templates/${created.id}`, json({ name: "Titre doré" }, "PATCH"));
    expect(((await renamed.json()) as { name: string }).name).toBe("Titre doré");
    const list = (await (await carol("/api/templates")).json()) as {
      name: string;
      height: number;
      scene: { layers: unknown[] };
    }[];
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ name: "Titre doré", height: 1920 });
    expect(list[0]?.scene.layers).toHaveLength(1);
  });

  it("refuse un modèle invalide", async () => {
    expect((await carol("/api/templates", json({ name: "", scene, width: 1080, height: 1080, fps: 30 }))).status).toBe(
      400,
    );
    expect(
      (await carol("/api/templates", json({ name: "x", scene: { id: "nope" }, width: 1080, height: 1080, fps: 30 })))
        .status,
    ).toBe(400);
  });

  it("isole les modèles entre comptes", async () => {
    const [t] = (await (await carol("/api/templates")).json()) as { id: string }[];
    expect(await (await dave("/api/templates")).json()).toEqual([]);
    expect((await dave(`/api/templates/${t?.id}`, { method: "DELETE" })).status).toBe(404);
    expect((await dave(`/api/templates/${t?.id}`, json({ name: "volé" }, "PATCH"))).status).toBe(404);
    expect((await carol(`/api/templates/${t?.id}`, { method: "DELETE" })).status).toBe(204);
    expect(await (await carol("/api/templates")).json()).toEqual([]);
  });

  it("refuse l'accès sans session", async () => {
    expect((await client()("/api/templates")).status).toBe(401);
  });

  it("complète la vignette d'un ancien projet avec les valeurs par défaut", async () => {
    const project = createProject({ name: "ancien", scenes: [scene] });
    await carol(`/api/projects/${project.id}`, json(project, "PUT"));
    // Vignette telle qu'enregistrée par une ancienne version (sans `loop` dans l'animation).
    const old = structuredClone(scene) as unknown as { layers: { animation: Record<string, unknown> }[] };
    for (const l of old.layers) delete l.animation.loop;
    db.prepare("UPDATE projects SET preview_scene = ? WHERE id = ?").run(JSON.stringify(old), project.id);
    const list = (await (await carol("/api/projects")).json()) as {
      id: string;
      previewScene: { layers: { animation: { loop: { kind: string } } }[] };
    }[];
    expect(list.find((p) => p.id === project.id)?.previewScene.layers[0]?.animation.loop.kind).toBe("none");
  });
});
