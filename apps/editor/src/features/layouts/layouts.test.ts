import { createImageLayer, createScene, createTextLayer, FORMATS, type Layer, LayerSchema } from "@app/schema";
import { describe, expect, it } from "vitest";
import { type ContentItem, resolveRoles, sceneToContent, type TextItem } from "./content";
import { bestGrid, fitInside, fitTextStack, polaroidInside, rect, wrapLines } from "./fit";
import { LAYOUTS } from "./library";
import { applicableLayouts, proposeAll, proposeLayouts, relayoutScene, suggestedDurationSeconds } from "./propose";

const photo = (id: string, aspect = 1.5): ContentItem => ({
  kind: "image",
  id,
  src: `/files/${id}.jpg`,
  aspect,
  name: id,
});
const text = (id: string, t: string, role: TextItem["role"] = null): TextItem => ({ kind: "text", id, text: t, role });

const inside = (l: Layer, w: number, h: number) => {
  const t = l.transform;
  // Les polaroids éparpillés et les médaillons peuvent dépasser un peu (rotation, chevauchement).
  const slack = Math.min(w, h) * 0.08;
  return t.x >= -slack && t.y >= -slack && t.x + t.width <= w + slack && t.y + t.height <= h + slack;
};

describe("rôles des textes", () => {
  it("premier texte court = titre, second = sous-titre, long = texte", () => {
    const r = resolveRoles([
      text("a", "Vacances 2026"),
      text("b", "En famille"),
      text("c", "Une semaine au bord de la mer, avec des glaces tous les jours et beaucoup de soleil."),
    ]);
    expect(r.map((t) => t.role)).toEqual(["title", "subtitle", "body"]);
  });
  it("respecte un rôle choisi à la main", () => {
    const r = resolveRoles([text("a", "Court"), text("b", "Mon vrai titre", "title")]);
    expect(r.map((t) => t.role)).toEqual(["subtitle", "title"]);
  });
  it("un texte long seul devient le titre", () => {
    const r = resolveRoles([text("a", "x ".repeat(60))]);
    expect(r[0]?.role).toBe("title");
  });
});

describe("géométrie", () => {
  it("coupe les lignes aux espaces", () => {
    expect(wrapLines("un deux trois", 20)).toBe(1);
    expect(wrapLines("un deux trois", 7)).toBe(2);
    expect(wrapLines("a\nb", 10)).toBe(2);
  });
  it("réduit la police jusqu'à ce que la pile tienne", () => {
    const spec = { weight: 1, lineHeight: 1.2, charWidth: 0.55 };
    const short = fitTextStack([{ ...spec, text: "Titre" }], { width: 1000, height: 300 }, 120, 20);
    expect(short.fits).toBe(true);
    expect(short.fontSizes[0]).toBe(120);
    const long = fitTextStack([{ ...spec, text: "mot ".repeat(80) }], { width: 1000, height: 300 }, 120, 20);
    expect(long.fits).toBe(true);
    expect(long.fontSizes[0]).toBeLessThan(60);
    expect(long.total).toBeLessThanOrEqual(300);
  });
  it("ne coupe jamais un mot : la police est réduite pour que le plus long tienne", () => {
    const spec = { weight: 1, lineHeight: 1.1, charWidth: 0.58 };
    const r = fitTextStack([{ ...spec, text: "Nos vacances extraordinaires" }], { width: 300, height: 1000 }, 120, 10);
    expect(r.fontSizes[0] as number).toBeLessThanOrEqual(300 / (13 * 0.58));
    const impossible = fitTextStack(
      [{ ...spec, text: "Anticonstitutionnellement" }],
      { width: 100, height: 100 },
      120,
      40,
    );
    expect(impossible.fits).toBe(false);
    expect(Number.isFinite(impossible.total)).toBe(true);
  });
  it("loge une photo entière dans une zone", () => {
    const r = fitInside(rect(0, 0, 1000, 500), 1);
    expect(r).toEqual({ x: 250, y: 0, width: 500, height: 500 });
  });
  it("la fenêtre d'un polaroid garde le ratio de la photo", () => {
    const card = polaroidInside(rect(0, 0, 800, 800), 1.5);
    const m = Math.min(card.width, card.height) * 0.06;
    const ratio = (card.width - 2 * m) / (card.height - m - card.height * 0.2);
    expect(ratio).toBeCloseTo(1.5, 1);
  });
  it("choisit une grille sans ligne vide", () => {
    expect(bestGrid(rect(0, 0, 1800, 900), 4, 10, 1.5)).toHaveLength(4);
    const five = bestGrid(rect(0, 0, 1800, 900), 5, 0, 1);
    expect(five).toHaveLength(5);
  });
});

describe("propositions", () => {
  const contents: Record<string, ContentItem[]> = {
    "texte seul": [text("t", "Bonjour")],
    "1 photo": [photo("a")],
    "1 photo + titre": [photo("a"), text("t", "Nos vacances")],
    "2 photos + 2 textes": [photo("a"), photo("b", 0.75), text("t", "Été"), text("s", "Bretagne")],
    "3 photos + texte long": [photo("a"), photo("b"), photo("c"), text("t", "Un long souvenir ".repeat(10))],
    "6 photos": ["a", "b", "c", "d", "e", "f"].map((id) => photo(id)),
  };

  for (const format of [FORMATS.landscape, FORMATS.portrait, FORMATS.square]) {
    for (const [label, content] of Object.entries(contents)) {
      it(`${label} en ${format.width}×${format.height} : scènes valides, dans l'image`, () => {
        const all = proposeAll(content, format, null);
        expect(all.length).toBeGreaterThan(0);
        for (const p of all) {
          const mediaCount = p.scene.layers.filter((l) => l.type === "image" || l.type === "video").length;
          const bgPhoto = p.scene.background.type === "image" && p.layoutId === "photo-background" ? 1 : 0;
          expect(mediaCount + bgPhoto).toBe(content.filter((c) => c.kind !== "text").length);
          for (const l of p.scene.layers) {
            expect(() => LayerSchema.parse(l)).not.toThrow();
            if (!l.name.includes("déborde"))
              expect(inside(l, format.width, format.height), `${p.key} ${l.name}`).toBe(true);
          }
          const textCount = p.scene.layers.filter((l) => l.type === "text").length;
          expect(textCount).toBe(content.filter((c) => c.kind === "text").length);
        }
      });
    }
  }

  it("ne propose que les dispositions qui acceptent le nombre de photos", () => {
    const ids = applicableLayouts([photo("a"), photo("b")]).map((l) => l.id);
    expect(ids).toContain("grid");
    expect(ids).not.toContain("bleed-bottom");
    expect(ids).not.toContain("fan");
    expect(applicableLayouts([])).toEqual([]);
  });

  it("première page : dispositions toutes différentes", () => {
    const page = proposeLayouts([photo("a"), text("t", "Titre")], FORMATS.landscape, null, 0, 6);
    expect(new Set(page.map((p) => p.layoutId)).size).toBe(page.length);
  });

  it("« Autres idées » change les propositions puis revient au début", () => {
    const content = [photo("a"), photo("b"), photo("c")];
    const all = proposeAll(content, FORMATS.landscape, null);
    const pages = Math.ceil(all.length / 6);
    const first = proposeLayouts(content, FORMATS.landscape, null, 0).map((p) => p.key);
    const second = proposeLayouts(content, FORMATS.landscape, null, 1).map((p) => p.key);
    expect(second).not.toEqual(first);
    expect(proposeLayouts(content, FORMATS.landscape, null, pages).map((p) => p.key)).toEqual(first);
  });

  it("une photo paysage préfère la pleine page en paysage, pas en portrait", () => {
    const content = [photo("a", 1.6), text("t", "Titre")];
    const land = proposeLayouts(content, FORMATS.landscape, null)[0];
    expect(land?.layoutId).toMatch(/^bleed|half/);
    const portraitBleed = proposeAll(content, FORMATS.portrait, null).find((p) => p.layoutId === "bleed-bottom");
    const landBleed = proposeAll(content, FORMATS.landscape, null).find((p) => p.layoutId === "bleed-bottom");
    expect((portraitBleed?.score ?? 0) < (landBleed?.score ?? 0)).toBe(true);
  });

  it("prend les couleurs et polices du thème", () => {
    const theme = {
      name: "T",
      colors: { background: "#111111", background2: "#222222", accent: "#ff0000", title: "#abcdef", text: "#fedcba" },
      headingFont: "Playfair Display",
      bodyFont: "Lora",
    };
    const p = proposeAll(
      [text("t", "Titre"), text("b", "Un texte plus long pour le corps de la page.")],
      FORMATS.square,
      theme,
    ).find((x) => x.layoutId === "text-center");
    const [title, body] = p?.scene.layers.filter((l) => l.type === "text") ?? [];
    expect(title).toMatchObject({ fontFamily: "Playfair Display", color: "#abcdef" });
    expect(body).toMatchObject({ fontFamily: "Lora", color: "#fedcba" });
  });

  it("chaque disposition de la bibliothèque est atteignable", () => {
    const counts = new Set<string>();
    for (let n = 0; n <= 6; n++) {
      const c = [...Array.from({ length: n }, (_, i) => photo(`p${i}`)), text("t", "Titre")];
      for (const p of proposeAll(c, FORMATS.landscape, null)) counts.add(p.layoutId);
    }
    expect([...counts].sort()).toEqual(LAYOUTS.map((l) => l.id).sort());
  });

  it("durée : plus longue avec du texte, au moins la vidéo", () => {
    expect(suggestedDurationSeconds([], [])).toBe(3);
    expect(suggestedDurationSeconds([], [text("t", "mot ".repeat(30))])).toBeGreaterThan(8);
    const video = { kind: "video" as const, id: "v", src: "/v.webm", aspect: 1.7, name: "v", durationSeconds: 9 };
    expect(suggestedDurationSeconds([video], [])).toBe(9);
  });

  it("durée choisie par l'utilisateur : appliquée aux nouvelles pages, sans couper une vidéo", () => {
    expect(suggestedDurationSeconds([], [text("t", "mot ".repeat(30))], 2)).toBe(2);
    const video = { kind: "video" as const, id: "v", src: "/v.webm", aspect: 1.7, name: "v", durationSeconds: 9 };
    expect(suggestedDurationSeconds([video], [], 2)).toBe(9);
    const content = [photo("p0"), text("t", "Titre")];
    const fps = FORMATS.landscape.fps;
    for (const p of proposeAll(content, { ...FORMATS.landscape, sceneSeconds: 2 }, null)) {
      expect(p.scene.durationInFrames).toBe(2 * fps);
    }
  });
});

describe("changer de mise en page", () => {
  const scene = createScene({
    name: "Ma scène",
    durationInFrames: 200,
    transitionIn: { kind: "iris", durationInFrames: 12 },
    layers: [
      createTextLayer({ text: "Petit texte", fontSize: 40, transform: { x: 0, y: 900, width: 800, height: 80 } }),
      createImageLayer({
        src: "/files/b.jpg",
        imageAspect: 0.8,
        transform: { x: 900, y: 100, width: 400, height: 500 },
      }),
      createTextLayer({ text: "Grand titre", fontSize: 120, transform: { x: 0, y: 50, width: 800, height: 150 } }),
      createImageLayer({
        src: "/files/a.jpg",
        imageAspect: 1.5,
        transform: { x: 100, y: 100, width: 600, height: 400 },
      }),
      createImageLayer({ src: "data:image/svg+xml,<svg/>", transform: { x: 0, y: 0, width: 50, height: 50 } }),
    ],
  });

  it("retrouve photos (sans les stickers) et textes avec leur rôle", () => {
    const content = sceneToContent(scene);
    expect(content.filter((c) => c.kind === "image").map((c) => (c as { src: string }).src)).toEqual([
      "/files/a.jpg",
      "/files/b.jpg",
    ]);
    const texts = content.filter((c): c is TextItem => c.kind === "text");
    expect(texts.map((t) => [t.text, t.role])).toEqual([
      ["Grand titre", "title"],
      ["Petit texte", "subtitle"],
    ]);
  });

  it("relire une page générée redonne les photos dans le même ordre (la n° 1 reste en avant)", () => {
    for (const format of [FORMATS.landscape, FORMATS.portrait]) {
      for (let n = 1; n <= 6; n++) {
        const content = [
          ...Array.from({ length: n }, (_, i) => photo(`p${i}`, [1.5, 0.75, 1][i % 3])),
          text("t", "Titre"),
        ];
        for (const p of proposeAll(content, format, null)) {
          if (p.layoutId === "photo-background") continue;
          const srcs = sceneToContent(p.scene)
            .filter((c) => c.kind === "image")
            .map((c) => (c as { src: string }).src);
          expect(srcs, `${p.key} ${format.width}`).toEqual(
            content.filter((c) => c.kind === "image").map((c) => (c as { src: string }).src),
          );
        }
      }
    }
  });

  it("garde l'identité de la scène", () => {
    const [p] = proposeLayouts(sceneToContent(scene), FORMATS.landscape, null);
    const copy = structuredClone(scene);
    relayoutScene(copy, p as NonNullable<typeof p>);
    expect(copy).toMatchObject({ id: scene.id, name: "Ma scène", durationInFrames: 200 });
    expect(copy.transitionIn.kind).toBe("iris");
    expect(copy.layers.filter((l) => l.type === "image")).toHaveLength(2);
  });
});
