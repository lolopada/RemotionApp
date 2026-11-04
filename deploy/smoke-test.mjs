#!/usr/bin/env node
/**
 * Test complet de Montage sur l'environnement réel (derrière Nginx Proxy Manager, en HTTPS).
 * Aucune dépendance : Node ≥ 22. Tout ce qui est créé est supprimé à la fin.
 *
 *   node deploy/smoke-test.mjs https://montage.paada.fr --user test --password '…'
 *
 * Options
 *   --user / --password   compte dédié aux tests (recommandé). Sans eux : un compte « smoke-xxxx »
 *                         est créé (impossible si les inscriptions sont fermées).
 *   --big-mb N            taille du MP4 d'essai envoyé (défaut 60). Mets 300 ou plus pour vérifier
 *                         client_max_body_size et les délais d'expiration de NPM.
 *   --browser             ajoute un vrai export vidéo dans Chromium (nécessite « playwright »).
 *   --no-ratelimit        saute le test de limitation des essais de connexion.
 *   --insecure            accepte un certificat invalide / http (diagnostic uniquement).
 *
 * Code de sortie : 0 = tout passe, 1 = au moins un échec.
 */
import { createHash, randomBytes, randomFillSync } from "node:crypto";
import { createRequire } from "node:module";
import tls from "node:tls";

// ---------- Arguments ----------
const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : d;
};
const BASE = (args.find((a) => /^https?:\/\//.test(a)) ?? "").replace(/\/+$/, "");
if (!BASE || flag("help")) {
  console.log("Usage : node deploy/smoke-test.mjs https://montage.paada.fr [--user U --password P] [--big-mb 60] [--browser] [--no-ratelimit]");
  process.exit(BASE ? 0 : 2);
}
if (flag("insecure")) process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const URL_ = new URL(BASE);
const IS_HTTPS = URL_.protocol === "https:";
const BIG_MB = Number(opt("big-mb", 60));

// ---------- Affichage ----------
const tty = process.stdout.isTTY;
const c = (code, s) => (tty ? `\x1b[${code}m${s}\x1b[0m` : s);
const results = [];
let section = "";
const head = (t) => {
  section = t;
  console.log(`\n${c("1", t)}`);
};
const record = (status, name, detail = "") => {
  results.push({ status, section, name, detail });
  const icon = status === "ok" ? c("32", "✓") : status === "warn" ? c("33", "!") : status === "skip" ? c("90", "–") : c("31", "✗");
  console.log(`  ${icon} ${name}${detail ? c("90", `  ${detail}`) : ""}`);
};
/** Exécute un contrôle ; une exception = échec. Retourne true si OK. */
async function check(name, fn, { warnOnly = false } = {}) {
  try {
    const detail = await fn();
    record("ok", name, typeof detail === "string" ? detail : "");
    return true;
  } catch (err) {
    record(warnOnly ? "warn" : "fail", name, err instanceof Error ? err.message : String(err));
    return false;
  }
}
const expect = (cond, msg) => {
  if (!cond) throw new Error(msg);
};
const sha = (buf) => createHash("sha256").update(buf).digest("hex");
const mb = (n) => `${(n / 1048576).toFixed(1)} Mo`;

// ---------- Client HTTP avec cookies ----------
class Client {
  constructor(label) {
    this.label = label;
    this.cookie = "";
    this.ip = `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
  }
  async req(path, { method = "GET", json, body, headers = {}, raw = false, redirect = "manual", origin = BASE, fakeIp = false } = {}) {
    const h = { ...headers };
    if (this.cookie) h.cookie = this.cookie;
    if (json !== undefined) h["content-type"] = "application/json";
    if (method !== "GET" && method !== "HEAD" && origin) h.origin = origin;
    if (fakeIp) h["x-forwarded-for"] = this.ip;
    const res = await fetch(path.startsWith("http") ? path : BASE + path, {
      method,
      headers: h,
      body: json !== undefined ? JSON.stringify(json) : body,
      redirect,
      duplex: body && typeof body.pipe === "function" ? "half" : undefined,
    });
    const set = res.headers.getSetCookie?.() ?? [];
    for (const sc of set) {
      const [pair] = sc.split(";");
      if (pair.startsWith("montage_session=")) this.cookie = pair;
    }
    res.setCookies = set;
    if (raw) return res;
    const text = await res.text();
    res.text_ = text;
    try {
      res.json_ = JSON.parse(text);
    } catch {
      res.json_ = null;
    }
    return res;
  }
}

// ---------- Données de test ----------
const stamp = Date.now().toString(36);
const minimalProject = (name) => {
  const now = new Date().toISOString();
  const id = `smoke${stamp}${randomBytes(3).toString("hex")}`.slice(0, 16);
  return {
    version: 1,
    id,
    name,
    width: 1280,
    height: 720,
    fps: 30,
    scenes: [
      {
        id: `s${stamp}a`,
        durationInFrames: 60,
        background: { type: "gradient", colors: ["#1e1b4b", "#7c3aed"], angle: 135 },
        layers: [
          {
            id: `l${stamp}a`,
            type: "shape",
            shape: "circle",
            fill: "#facc15",
            transform: { x: 440, y: 160, width: 400, height: 400 },
            animation: { enter: "zoom" },
          },
        ],
      },
      {
        id: `s${stamp}b`,
        durationInFrames: 60,
        background: { type: "color", color: "#0f766e" },
        layers: [],
        transitionIn: { kind: "fade", durationInFrames: 15 },
      },
    ],
    audio: [],
    createdAt: now,
    updatedAt: now,
  };
};
/** PNG 64×64 valide (dégradé) fabriqué à la main, sans dépendance. */
function makePng() {
  const w = 64;
  const h = 64;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const o = y * (w * 3 + 1) + 1 + x * 3;
      raw[o] = x * 4;
      raw[o + 1] = y * 4;
      raw[o + 2] = 160;
    }
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let k = n;
    for (let i = 0; i < 8; i++) k = k & 1 ? 0xedb88320 ^ (k >>> 1) : k >>> 1;
    return k >>> 0;
  });
  const crc = (buf) => {
    let k = 0xffffffff;
    for (const b of buf) k = crcTable[(k ^ b) & 0xff] ^ (k >>> 8);
    return (k ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const cr = Buffer.alloc(4);
    cr.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, cr]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const { deflateSync } = awaitZlib;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
const awaitZlib = await import("node:zlib");
/** WAV mono 1 s (440 Hz). */
function makeWav() {
  const rate = 8000;
  const n = rate;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write("WAVEfmt ", 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * i) / rate) * 12000), 44 + i * 2);
  return buf;
}
/** Faux MP4 de `size` octets : en-tête « ftyp » valide puis octets aléatoires (le serveur ne l'ouvre pas). */
function makeFakeMp4(size) {
  const buf = Buffer.allocUnsafe(size);
  const block = randomBytes(1 << 20);
  for (let off = 0; off < size; off += block.length) {
    randomFillSync(block, 0, 64); // varie un peu chaque tour
    block.copy(buf, off, 0, Math.min(block.length, size - off));
  }
  Buffer.from([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0, 0, 2, 0, 0x69, 0x73, 0x6f, 0x6d, 0x6d, 0x70, 0x34, 0x31]).copy(buf, 0);
  return buf;
}
const multipart = (name, type, data) => {
  const form = new FormData();
  form.append("file", new File([data], name, { type }));
  return form;
};

// ---------- Nettoyage ----------
const created = { projects: [], assets: [], videos: [], templates: [] };
let main;
async function cleanup() {
  if (!main?.cookie) return;
  for (const id of created.projects) await main.req(`/api/projects/${id}`, { method: "DELETE" }).catch(() => {});
  for (const id of created.assets) await main.req(`/api/assets/${id}`, { method: "DELETE" }).catch(() => {});
  for (const id of created.videos) await main.req(`/api/videos/${id}`, { method: "DELETE" }).catch(() => {});
  for (const id of created.templates) await main.req(`/api/templates/${id}`, { method: "DELETE" }).catch(() => {});
}

// =====================================================================
console.log(c("1", `Montage — test complet de ${BASE}`));
console.log(c("90", `Début : ${new Date().toLocaleString("fr-FR")} · fichier d'essai : ${BIG_MB} Mo`));
const t0 = Date.now();

// ---------- 1. Réseau, HTTPS, proxy ----------
head("1. Réseau et HTTPS");
await check("le site répond", async () => {
  const t = Date.now();
  const res = await fetch(`${BASE}/api/health`);
  expect(res.ok, `HTTP ${res.status}`);
  return `${Date.now() - t} ms`;
});
if (IS_HTTPS) {
  await check("certificat TLS valide", async () => {
    const info = await new Promise((resolve, reject) => {
      const s = tls.connect({ host: URL_.hostname, port: Number(URL_.port || 443), servername: URL_.hostname }, () => {
        const cert = s.getPeerCertificate();
        const authorized = s.authorized;
        s.end();
        resolve({ cert, authorized, error: s.authorizationError });
      });
      s.on("error", reject);
      s.setTimeout(10_000, () => reject(new Error("délai dépassé")));
    });
    expect(info.authorized, `certificat refusé : ${info.error}`);
    const days = Math.floor((new Date(info.cert.valid_to).getTime() - Date.now()) / 86_400_000);
    expect(days > 7, `expire dans ${days} jours`);
    return `expire dans ${days} jours (${info.cert.issuer?.O ?? "?"})`;
  });
  await check("http:// redirige vers https://", async () => {
    const res = await fetch(`http://${URL_.host}/`, { redirect: "manual" });
    expect([301, 302, 307, 308].includes(res.status), `HTTP ${res.status} (active « Force SSL » dans NPM)`);
    expect((res.headers.get("location") ?? "").startsWith("https://"), `redirige vers ${res.headers.get("location")}`);
    return `${res.status} → ${res.headers.get("location")}`;
  }, { warnOnly: true });
} else {
  const local = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(URL_.hostname);
  record(local ? "ok" : "warn", "connexion en http", local ? "localhost est un contexte sécurisé" : "l'export vidéo exige HTTPS (WebCodecs) : à corriger avant usage");
}

// ---------- 2. Application ----------
head("2. Application");
await check("la page d'accueil est l'éditeur", async () => {
  const res = await fetch(`${BASE}/`);
  const html = await res.text();
  expect(res.ok && /id="root"/.test(html), "index.html inattendu (build manquant ?)");
  expect((res.headers.get("content-type") ?? "").includes("text/html"), `type ${res.headers.get("content-type")}`);
  return `${html.length} octets`;
});
await check("le JavaScript de l'éditeur se charge (bon type MIME)", async () => {
  const html = await (await fetch(`${BASE}/`)).text();
  const m = html.match(/<script[^>]+src="([^"]+\.js)"/);
  expect(m, "aucun <script> trouvé");
  const res = await fetch(new URL(m[1], `${BASE}/`));
  const type = res.headers.get("content-type") ?? "";
  expect(res.ok, `HTTP ${res.status} pour ${m[1]}`);
  expect(/javascript/.test(type), `type « ${type} » : un vieux index.html est servi (redémarre le service après un build)`);
  const body = await res.arrayBuffer();
  return `${m[1]} · ${mb(body.byteLength)}`;
});
await check("une route de l'éditeur (/p/…) renvoie l'éditeur", async () => {
  const res = await fetch(`${BASE}/p/test-inexistant`);
  expect(res.ok && /id="root"/.test(await res.text()), `HTTP ${res.status}`);
});
await check("API /api/auth/config", async () => {
  const res = await fetch(`${BASE}/api/auth/config`);
  const j = await res.json();
  expect(typeof j.allowSignup === "boolean", "réponse inattendue");
  return j.allowSignup ? "inscriptions ouvertes" : "inscriptions fermées";
});
const signupOpen = await fetch(`${BASE}/api/auth/config`).then((r) => r.json()).then((j) => j.allowSignup).catch(() => false);

// ---------- 3. Sécurité sans compte ----------
head("3. Sécurité (sans compte)");
const anon = new Client("anonyme");
for (const path of ["/api/projects", "/api/assets", "/api/videos", "/api/templates", "/api/auth/me", "/files/inexistant.jpg"]) {
  await check(`${path} refuse sans connexion`, async () => {
    const res = await anon.req(path);
    expect(res.status === 401, `HTTP ${res.status} (attendu 401)`);
  });
}
await check("une requête venant d'un autre site est refusée (CSRF)", async () => {
  const res = await anon.req("/api/auth/login", { method: "POST", json: { username: "x", password: "y" }, origin: "https://evil.example" });
  expect(res.status === 403, `HTTP ${res.status} (attendu 403) : X-Forwarded-Host mal transmis par le proxy ?`);
});
await check("mauvais identifiants refusés", async () => {
  const res = await anon.req("/api/auth/login", { method: "POST", json: { username: `nobody-${stamp}`, password: "mauvais-mot-de-passe" }, fakeIp: true });
  expect(res.status === 401 || res.status === 400, `HTTP ${res.status}`);
});

// ---------- 4. Compte ----------
head("4. Compte et session");
main = new Client("principal");
let user = opt("user");
let password = opt("password");
let tempAccount = false;
let loggedIn = false;
if (user && password) {
  loggedIn = await check(`connexion de « ${user} »`, async () => {
    const res = await main.req("/api/auth/login", { method: "POST", json: { username: user, password }, fakeIp: true });
    expect(res.ok, `HTTP ${res.status} : ${res.json_?.error ?? res.text_.slice(0, 80)}`);
    return "ok";
  });
} else if (signupOpen) {
  user = `smoke-${stamp}`;
  password = randomBytes(12).toString("base64url");
  tempAccount = true;
  loggedIn = await check(`création du compte temporaire « ${user} »`, async () => {
    const res = await main.req("/api/auth/register", { method: "POST", json: { username: user, password }, fakeIp: true });
    expect(res.status === 201, `HTTP ${res.status} : ${res.json_?.error ?? ""}`);
  });
} else {
  record("fail", "aucun compte utilisable", "inscriptions fermées : relance avec --user et --password");
}
if (loggedIn) {
  await check("cookie de session sécurisé", async () => {
    const res = await new Client("c").req("/api/auth/login", { method: "POST", json: { username: user, password }, fakeIp: true });
    const cookie = (res.setCookies ?? []).find((s) => s.startsWith("montage_session="));
    expect(cookie, "pas de cookie de session");
    expect(/HttpOnly/i.test(cookie), "HttpOnly manquant");
    expect(/SameSite=Lax/i.test(cookie), "SameSite manquant");
    if (IS_HTTPS) expect(/Secure/i.test(cookie), "« Secure » manquant : NPM doit transmettre X-Forwarded-Proto");
    return IS_HTTPS ? "HttpOnly · Secure · SameSite=Lax" : "HttpOnly · SameSite=Lax";
  });
  await check("/api/auth/me", async () => {
    const res = await main.req("/api/auth/me");
    expect(res.ok && res.json_?.username === user, `HTTP ${res.status}`);
  });
}

if (loggedIn) {
  // ---------- 5. Projets ----------
  head("5. Projets, versions, modèles");
  const project = minimalProject(`Test ${stamp}`);
  created.projects.push(project.id);
  await check("créer un projet (PUT)", async () => {
    const res = await main.req(`/api/projects/${project.id}`, { method: "PUT", json: project });
    expect(res.ok, `HTTP ${res.status} : ${JSON.stringify(res.json_?.issues ?? res.json_ ?? res.text_.slice(0, 100))}`);
  });
  await check("relire le projet à l'identique", async () => {
    const res = await main.req(`/api/projects/${project.id}`);
    expect(res.ok, `HTTP ${res.status}`);
    expect(res.json_.scenes.length === 2 && res.json_.width === 1280, "contenu différent");
    expect(res.json_.scenes[0].layers[0].animation.loop, "valeurs par défaut du schéma absentes");
  });
  await check("le projet apparaît dans la liste (avec vignette)", async () => {
    const res = await main.req("/api/projects");
    const item = res.json_.find((p) => p.id === project.id);
    expect(item, "absent de la liste");
    expect(item.sceneCount === 2 && item.previewScene, "résumé incomplet");
  });
  await check("modifier et enregistrer à nouveau", async () => {
    const res = await main.req(`/api/projects/${project.id}`, { method: "PUT", json: { ...project, name: `Test ${stamp} (v2)`, updatedAt: new Date().toISOString() } });
    expect(res.ok, `HTTP ${res.status}`);
  });
  await check("un projet invalide est refusé (400)", async () => {
    const res = await main.req(`/api/projects/${project.id}`, { method: "PUT", json: { ...project, width: -5 } });
    expect(res.status === 400, `HTTP ${res.status}`);
  });
  await check("l'id du corps doit correspondre à l'URL", async () => {
    const res = await main.req(`/api/projects/autre-id`, { method: "PUT", json: project });
    expect(res.status === 400, `HTTP ${res.status}`);
  });
  await check("historique des versions", async () => {
    const res = await main.req(`/api/projects/${project.id}/versions`);
    expect(res.ok && Array.isArray(res.json_), `HTTP ${res.status}`);
    const named = await main.req(`/api/projects/${project.id}/versions`, { method: "POST", json: { name: "Version de test" } });
    expect(named.ok || named.status === 201, `création HTTP ${named.status}`);
    return `${res.json_.length} version(s)`;
  });
  await check("Mes modèles : créer, lister, supprimer", async () => {
    const res = await main.req("/api/templates", {
      method: "POST",
      json: { name: `Modèle ${stamp}`, scene: project.scenes[0], width: 1280, height: 720, fps: 30 },
    });
    expect(res.status === 201 || res.ok, `création HTTP ${res.status} : ${res.text_.slice(0, 100)}`);
    created.templates.push(res.json_.id);
    const list = await main.req("/api/templates");
    expect(list.json_.some((t) => t.id === res.json_.id), "absent de la liste");
    const del = await main.req(`/api/templates/${res.json_.id}`, { method: "DELETE" });
    expect(del.status === 204, `suppression HTTP ${del.status}`);
    created.templates.pop();
  });

  // ---------- 6. Médias ----------
  head("6. Photos, musiques, fichiers privés");
  const png = makePng();
  const wav = makeWav();
  let pngAsset;
  let wavAsset;
  await check("envoyer une photo (PNG)", async () => {
    const res = await main.req("/api/assets", { method: "POST", body: multipart("test.png", "image/png", png) });
    expect(res.status === 201, `HTTP ${res.status} : ${res.json_?.error ?? res.text_.slice(0, 100)}`);
    pngAsset = res.json_;
    created.assets.push(pngAsset.id);
    expect(pngAsset.kind === "image" && pngAsset.url.startsWith("/files/"), "réponse inattendue");
  });
  await check("envoyer une musique (WAV)", async () => {
    const res = await main.req("/api/assets", { method: "POST", body: multipart("test.wav", "audio/wav", wav) });
    expect(res.status === 201, `HTTP ${res.status} : ${res.json_?.error ?? ""}`);
    wavAsset = res.json_;
    created.assets.push(wavAsset.id);
  });
  await check("un type de fichier non accepté est refusé (415)", async () => {
    const res = await main.req("/api/assets", { method: "POST", body: multipart("virus.exe", "application/x-msdownload", Buffer.from("MZ")) });
    expect(res.status === 415, `HTTP ${res.status}`);
  });
  await check("lister les médias par type", async () => {
    const imgs = (await main.req("/api/assets?kind=image")).json_;
    const auds = (await main.req("/api/assets?kind=audio")).json_;
    expect(imgs.some((a) => a.id === pngAsset?.id) && auds.some((a) => a.id === wavAsset?.id), "média absent de la liste");
  });
  if (pngAsset) {
    await check("télécharger la photo : octets identiques", async () => {
      const res = await main.req(pngAsset.url, { raw: true });
      expect(res.ok, `HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      expect(sha(buf) === sha(png), "contenu modifié");
      expect((res.headers.get("content-type") ?? "").includes("image/png"), `type ${res.headers.get("content-type")}`);
      expect(/private/.test(res.headers.get("cache-control") ?? ""), "Cache-Control: private attendu");
      return `${buf.length} octets`;
    });
    await check("fichier privé : sans cookie → 401", async () => {
      const res = await anon.req(pngAsset.url);
      expect(res.status === 401, `HTTP ${res.status}`);
    });
  }
  if (wavAsset) {
    await check("lecture partielle (Range) pour la vidéo/audio", async () => {
      const res = await main.req(wavAsset.url, { headers: { range: "bytes=0-99" }, raw: true });
      expect(res.status === 206, `HTTP ${res.status} (attendu 206) : le proxy bloque les requêtes Range ?`);
      const buf = Buffer.from(await res.arrayBuffer());
      expect(buf.length === 100, `${buf.length} octets reçus`);
      expect((res.headers.get("content-range") ?? "").startsWith("bytes 0-99/"), `Content-Range : ${res.headers.get("content-range")}`);
    });
  }
  // Isolation entre comptes : un second compte ne voit rien du premier.
  if (pngAsset && (signupOpen || opt("user2"))) {
    const other = new Client("second");
    const u2 = opt("user2") ?? `smoke2-${stamp}`;
    const p2 = opt("password2") ?? randomBytes(12).toString("base64url");
    const okLogin = opt("user2")
      ? (await other.req("/api/auth/login", { method: "POST", json: { username: u2, password: p2 }, fakeIp: true })).ok
      : (await other.req("/api/auth/register", { method: "POST", json: { username: u2, password: p2 }, fakeIp: true })).status === 201;
    if (okLogin) {
      await check("isolation : un autre compte ne peut pas lire mes fichiers", async () => {
        const res = await other.req(pngAsset.url);
        expect(res.status === 404 || res.status === 403, `HTTP ${res.status} : fuite de données !`);
      });
      await check("isolation : un autre compte ne voit pas mes projets", async () => {
        const list = (await other.req("/api/projects")).json_;
        expect(!list.some((p) => p.id === project.id), "mon projet est visible !");
        const res = await other.req(`/api/projects/${project.id}`);
        expect(res.status === 404, `HTTP ${res.status} (attendu 404)`);
        const put = await other.req(`/api/projects/${project.id}`, { method: "PUT", json: project });
        expect(put.status === 404, `écrasement HTTP ${put.status} (attendu 404)`);
      });
    } else {
      record("skip", "isolation entre comptes", "second compte impossible à créer");
    }
  } else {
    record("skip", "isolation entre comptes", "inscriptions fermées : ajoute --user2 / --password2 pour la tester");
  }
  await check("supprimer un média puis vérifier qu'il a disparu", async () => {
    const id = wavAsset.id;
    const del = await main.req(`/api/assets/${id}`, { method: "DELETE" });
    expect(del.status === 204, `HTTP ${del.status}`);
    created.assets = created.assets.filter((a) => a !== id);
    const after = await main.req(wavAsset.url);
    expect(after.status === 404, `le fichier répond encore (HTTP ${after.status})`);
  });

  // ---------- 7. Export vidéo (gros fichier) ----------
  head(`7. Envoi d'une vidéo exportée (${BIG_MB} Mo)`);
  const sizeBytes = Math.max(1, BIG_MB) * 1048576;
  const mp4 = makeFakeMp4(sizeBytes);
  let video;
  await check(`envoyer ${BIG_MB} Mo de MP4 (client_max_body_size, délais, flux)`, async () => {
    const t = Date.now();
    const res = await main.req(`/api/videos?name=${encodeURIComponent(`Test ${stamp}`)}&width=1280&height=720&duration=2`, {
      method: "POST",
      body: mp4,
      headers: { "content-type": "video/mp4" },
    });
    if (res.status === 413) {
      throw new Error(/nginx/i.test(res.text_) ? "413 de Nginx : ajoute « client_max_body_size 2g; » dans l'onglet Advanced de NPM" : `413 : ${res.json_?.error ?? ""} (MAX_EXPORT_MB trop bas ?)`);
    }
    if (res.status === 502 || res.status === 504 || res.status === 499) {
      throw new Error(`HTTP ${res.status} : délai du proxy dépassé (proxy_read_timeout / proxy_send_timeout)`);
    }
    expect(res.status === 201, `HTTP ${res.status} : ${res.json_?.error ?? res.text_.slice(0, 100)}`);
    video = res.json_;
    created.videos.push(video.id);
    const s = (Date.now() - t) / 1000;
    return `${s.toFixed(1)} s · ${(BIG_MB / s).toFixed(1)} Mo/s`;
  });
  if (video) {
    await check("la vidéo est dans « Mes vidéos » avec la bonne taille", async () => {
      const list = (await main.req("/api/videos")).json_;
      const item = list.find((v) => v.id === video.id);
      expect(item, "absente de la liste");
      expect(item.size === sizeBytes, `taille ${item.size} ≠ ${sizeBytes}`);
    });
    await check("re-télécharger : octets identiques (empreinte SHA-256)", async () => {
      const t = Date.now();
      const res = await main.req(video.url, { raw: true });
      expect(res.ok, `HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      expect(buf.length === sizeBytes, `${buf.length} octets reçus au lieu de ${sizeBytes}`);
      expect(sha(buf) === sha(mp4), "contenu altéré en route");
      return `${((Date.now() - t) / 1000).toFixed(1)} s`;
    });
    await check("renommer la vidéo", async () => {
      const res = await main.req(`/api/videos/${video.id}`, { method: "PATCH", json: { name: `Test ${stamp} renommée` } });
      expect(res.ok && res.json_.name.endsWith("renommée"), `HTTP ${res.status}`);
    });
  }
  await check("un format non MP4/WebM est refusé (415)", async () => {
    const res = await main.req("/api/videos?name=x", { method: "POST", body: Buffer.from("x"), headers: { "content-type": "application/pdf" } });
    expect(res.status === 415, `HTTP ${res.status}`);
  });

  // ---------- 8. Export réel dans un navigateur ----------
  if (flag("browser")) {
    head("8. Export vidéo réel dans Chromium");
    let pw;
    try {
      // Cherche playwright à côté du script, puis dans le dossier où tu lances la commande.
      try {
        pw = await import("playwright");
      } catch {
        pw = createRequire(`${process.cwd()}/`)("playwright");
      }
    } catch {
      record("fail", "playwright introuvable", "mkdir ~/e2e && cd ~/e2e && npm i playwright && npx playwright install chromium --with-deps, puis lance le test depuis ce dossier");
    }
    if (pw) {
      let browser;
      try {
        browser = await pw.chromium.launch();
        const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, acceptDownloads: true, ignoreHTTPSErrors: flag("insecure") });
        await ctx.addCookies([{ name: "montage_session", value: main.cookie.split("=")[1], url: BASE, httpOnly: true, secure: IS_HTTPS, sameSite: "Lax" }]);
        const page = await ctx.newPage();
        const errors = [];
        page.on("pageerror", (e) => errors.push(e.message));
        const exp = minimalProject(`Export ${stamp}`);
        created.projects.push(exp.id);
        const put = await main.req(`/api/projects/${exp.id}`, { method: "PUT", json: exp });
        expect(put.ok, "création du projet d'export");
        await check("l'éditeur s'ouvre sans erreur JavaScript", async () => {
          await page.goto(`${BASE}/p/${exp.id}`, { waitUntil: "networkidle", timeout: 60_000 });
          await page.getByRole("button", { name: /Exporter MP4/ }).waitFor({ timeout: 30_000 });
          expect(errors.length === 0, errors[0] ?? "");
        });
        await check("contexte sécurisé + WebCodecs disponibles", async () => {
          const caps = await page.evaluate(() => ({ secure: window.isSecureContext, enc: typeof VideoEncoder, dec: typeof VideoDecoder }));
          expect(caps.secure, "contexte non sécurisé (HTTPS requis)");
          expect(caps.enc === "function" && caps.dec === "function", "WebCodecs absent");
        });
        await check("export MP4 complet (720p) enregistré dans « Mes vidéos »", async () => {
          const before = (await main.req("/api/videos")).json_.length;
          await page.getByRole("button", { name: /Exporter MP4/ }).click();
          await page.getByRole("button", { name: /^720p/ }).click();
          const download = page.waitForEvent("download", { timeout: 240_000 });
          await page.getByRole("button", { name: "Lancer l'export" }).click();
          await page.getByText("Vidéo enregistrée dans « Mes vidéos ».").waitFor({ timeout: 240_000 });
          await page.getByRole("button", { name: "Télécharger" }).click();
          const dl = await download;
          const path = await dl.path();
          const { statSync, readFileSync } = await import("node:fs");
          const size = statSync(path).size;
          expect(size > 5_000, `fichier téléchargé trop petit (${size} octets)`);
          expect(readFileSync(path).subarray(4, 8).toString() === "ftyp", "ce n'est pas un MP4");
          const list = (await main.req("/api/videos")).json_;
          expect(list.length === before + 1, "la vidéo n'a pas été enregistrée sur le serveur");
          const saved = list.find((v) => !created.videos.includes(v.id));
          if (saved) created.videos.push(saved.id);
          return `${mb(size)}`;
        });
      } catch (err) {
        record("fail", "test navigateur", err instanceof Error ? err.message : String(err));
      } finally {
        await browser?.close();
      }
    }
  } else {
    record("skip", "export réel dans un navigateur", "ajoute --browser pour le tester (Playwright requis)");
  }
}

// ---------- 9. Limitation des essais ----------
if (!flag("no-ratelimit")) {
  head("9. Protection contre les essais de mots de passe");
  await check("trop d'essais de connexion → 429", async () => {
    // Sans fakeIp : on mesure ce que voit vraiment le serveur derrière NPM.
    const c2 = new Client("rl");
    let got429 = false;
    for (let i = 0; i < 14 && !got429; i++) {
      const res = await c2.req("/api/auth/login", { method: "POST", json: { username: `rl-${stamp}`, password: "x" } });
      got429 = res.status === 429;
    }
    expect(got429, "aucun blocage après 14 essais : X-Forwarded-For n'est pas transmis ?");
    return "blocage actif (réessaie dans 1 minute)";
  }, { warnOnly: true });
}

// ---------- Nettoyage ----------
head("Nettoyage");
await cleanup();
record("ok", "projets, médias, vidéos et modèles de test supprimés");
if (tempAccount) {
  record("warn", `le compte « ${user} » reste en base`, "il n'y a pas de suppression de compte dans l'appli : utilise un compte dédié avec --user pour éviter ça");
}

// ---------- Bilan ----------
const fails = results.filter((r) => r.status === "fail");
const warns = results.filter((r) => r.status === "warn");
const oks = results.filter((r) => r.status === "ok");
console.log(`\n${c("1", "Bilan")} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
console.log(`  ${c("32", `${oks.length} réussis`)} · ${c("33", `${warns.length} avertissement(s)`)} · ${fails.length ? c("31", `${fails.length} échec(s)`) : "0 échec"}`);
if (fails.length) {
  console.log(`\n${c("31", "À corriger :")}`);
  for (const f of fails) console.log(`  ✗ [${f.section}] ${f.name}${f.detail ? ` — ${f.detail}` : ""}`);
}
if (warns.length) {
  console.log(`\n${c("33", "À surveiller :")}`);
  for (const w of warns) console.log(`  ! [${w.section}] ${w.name}${w.detail ? ` — ${w.detail}` : ""}`);
}
process.exit(fails.length ? 1 : 0);
