import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { MusicSearchResult, StoredFile } from "@app/schema";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../app";
import { creditFor, mapTrack, parseLicense } from "./jamendo";

/** Réponse type de l'API Jamendo v3 (/tracks). */
const raw = (id: number, extra: Record<string, unknown> = {}) => ({
  id: String(id),
  name: `Morceau ${id}`,
  duration: 151,
  artist_name: "Artiste",
  album_image: "http://usercontent.jamendo.com?type=album&id=1&width=100",
  audio: `https://prod-1.storage.jamendo.com/?trackid=${id}&format=mp32`,
  audiodownload: `https://prod-1.storage.jamendo.com/download/track/${id}/mp32/`,
  audiodownload_allowed: true,
  license_ccurl: "http://creativecommons.org/licenses/by-nc-sa/3.0/",
  shareurl: `https://www.jamendo.com/track/${id}`,
  musicinfo: { vocalinstrumental: "instrumental", tags: { genres: ["pop"], vartags: ["happy"] } },
  ...extra,
});

const calls: string[] = [];
const MP3 = new Uint8Array([0x49, 0x44, 0x33, 3, 0, 0, 0, 0, 0, 0, 1, 2, 3]);
const fakeFetch = async (input: string) => {
  calls.push(input);
  const url = new URL(input);
  if (url.pathname.includes("/download/track/")) {
    return new Response(MP3, { headers: { "content-type": "audio/mpeg", "content-length": String(MP3.length) } });
  }
  if (url.searchParams.get("client_id") !== "cle-test") {
    return Response.json({ headers: { status: "failed", code: 5, error_message: "Your credential is invalid" } });
  }
  const id = url.searchParams.get("id");
  if (id) {
    const results = id === "999" ? [] : [raw(Number(id), id === "7" ? { audiodownload_allowed: false } : {})];
    return Response.json({ headers: { status: "success", code: 0 }, results });
  }
  const offset = Number(url.searchParams.get("offset") ?? 0);
  return Response.json({
    headers: { status: "success", code: 0 },
    results: Array.from({ length: offset === 0 ? 20 : 3 }, (_, i) => raw(1000 + offset + i)),
  });
};

const dirs: string[] = [];
function make(clientId: string) {
  const dataDir = mkdtempSync(path.join(tmpdir(), "montage-music-"));
  dirs.push(dataDir);
  return createApp(
    {
      dataDir,
      maxUploadBytes: 1024 * 1024,
      maxExportBytes: 1024,
      allowSignup: true,
      sessionDays: 1,
      versionIntervalMs: 0,
      maxAutoVersions: 3,
      jamendoClientId: clientId,
      jamendoApiUrl: "https://api.jamendo.com/v3.0",
    },
    { fetch: fakeFetch },
  );
}
const instances = [make("cle-test"), make("")];
afterAll(() => {
  for (const i of instances) i.close();
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

function client(app: (typeof instances)[number]["app"]) {
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
const post = (body: unknown) => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

describe("lecture des réponses Jamendo", () => {
  it("licence lue depuis son adresse", () => {
    expect(parseLicense("http://creativecommons.org/licenses/by-nc-sa/3.0/")).toMatchObject({
      code: "by-nc-sa",
      label: "CC BY-NC-SA 3.0",
    });
    expect(parseLicense("https://creativecommons.org/publicdomain/zero/1.0/").code).toBe("cc0");
    expect(parseLicense("").label).toBe("Licence Creative Commons");
  });
  it("morceau : champs utiles, adresses en https, crédit", () => {
    const t = mapTrack(raw(42));
    expect(t).toMatchObject({
      id: "42",
      title: "Morceau 42",
      durationSeconds: 151,
      instrumental: true,
      downloadable: true,
      tags: ["pop", "happy"],
    });
    expect(t?.cover.startsWith("https://")).toBe(true);
    expect(creditFor(t as NonNullable<typeof t>)).toBe(
      "« Morceau 42 » par Artiste (Jamendo, CC BY-NC-SA 3.0) – https://www.jamendo.com/track/42",
    );
    expect(mapTrack({ name: "sans id" })).toBeNull();
  });
});

describe("propositions de musique", () => {
  const [on, off] = instances as [(typeof instances)[0], (typeof instances)[0]];
  const alice = client(on.app);

  it("réservé aux comptes connectés", async () => {
    expect((await on.app.request("/api/music/search?mood=joyeux")).status).toBe(401);
    await alice("/api/auth/register", post({ username: "alice", password: "motdepasse" }));
    expect((await alice("/api/music/status")).status).toBe(200);
  });

  it("sans clé Jamendo : désactivé, avec un message clair", async () => {
    const bob = client(off.app);
    await bob("/api/auth/register", post({ username: "bob", password: "motdepasse" }));
    expect(await (await bob("/api/music/status")).json()).toMatchObject({ enabled: false });
    const res = await bob("/api/music/search?mood=joyeux");
    expect(res.status).toBe(503);
  });

  it("recherche par ambiance : étiquettes, instrumental, durée, pages", async () => {
    calls.length = 0;
    const res = await alice("/api/music/search?mood=calme&instrumental=1&forSeconds=60");
    const body = (await res.json()) as MusicSearchResult;
    expect(body.tracks).toHaveLength(20);
    expect(body.nextOffset).toBe(20);
    const url = new URL(calls[0] as string);
    expect(url.searchParams.get("fuzzytags")).toBe("calm relaxing peaceful ambient");
    expect(calls[0]).toContain("fuzzytags=calm+relaxing+peaceful+ambient");
    expect(url.searchParams.get("vocalinstrumental")).toBe("instrumental");
    expect(url.searchParams.get("durationbetween")).toBe("60_300");
    expect(url.searchParams.get("order")).toBe("popularity_total");
    // La clé ne part jamais vers le navigateur.
    expect(JSON.stringify(body)).not.toContain("cle-test");

    const next = (await (
      await alice("/api/music/search?mood=calme&instrumental=1&forSeconds=60&offset=20")
    ).json()) as MusicSearchResult;
    expect(next.tracks).toHaveLength(3);
    expect(next.nextOffset).toBeNull();
  });

  it("met les recherches en cache", async () => {
    calls.length = 0;
    await alice("/api/music/search?q=piano");
    await alice("/api/music/search?q=piano");
    expect(calls).toHaveLength(1);
    expect(new URL(calls[0] as string).searchParams.get("search")).toBe("piano");
  });

  it("refuse une ambiance inconnue", async () => {
    expect((await alice("/api/music/search?mood=nimporte")).status).toBe(400);
  });

  it("importe un morceau dans la bibliothèque, avec son crédit, une seule fois", async () => {
    const res = await alice("/api/music/import", post({ trackId: "42" }));
    expect(res.status).toBe(201);
    const file = (await res.json()) as StoredFile;
    expect(file).toMatchObject({
      kind: "audio",
      mime: "audio/mpeg",
      name: "Morceau 42 – Artiste",
      durationSeconds: 151,
      sourceUrl: "https://www.jamendo.com/track/42",
    });
    expect(file.credit).toContain("CC BY-NC-SA 3.0");
    // Le fichier est servi comme une musique importée.
    const served = await alice(file.url);
    expect(served.status).toBe(200);
    expect(new Uint8Array(await served.arrayBuffer())).toEqual(MP3);
    // Dans la liste de la bibliothèque.
    const list = (await (await alice("/api/assets?kind=audio")).json()) as StoredFile[];
    expect(list.map((f) => f.id)).toContain(file.id);
    // Deuxième import : le même fichier, sans retélécharger.
    calls.length = 0;
    const again = (await (await alice("/api/music/import", post({ trackId: 42 }))).json()) as StoredFile;
    expect(again.id).toBe(file.id);
    expect(calls).toHaveLength(0);
  });

  it("respecte le choix de l'artiste et refuse les identifiants bizarres", async () => {
    expect((await alice("/api/music/import", post({ trackId: "7" }))).status).toBe(403);
    expect((await alice("/api/music/import", post({ trackId: "999" }))).status).toBe(404);
    expect((await alice("/api/music/import", post({ trackId: "../etc" }))).status).toBe(404);
    expect((await alice("/api/music/import", post({}))).status).toBe(400);
  });
});
