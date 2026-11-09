import { ScenePreview } from "@app/composition";
import { applyThemeToScene, createScene, duplicateScene, type StoredFile } from "@app/schema";
import { Player } from "@remotion/player";
import clsx from "clsx";
import {
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  FilePlus2,
  ImagePlus,
  LayoutTemplate,
  LoaderCircle,
  Plus,
  Shuffle,
  Type,
  X,
} from "lucide-react";
import { memo, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../lib/api";
import { getImageSize, getVideoMeta } from "../../lib/media";
import { useEditor, useProject } from "../../store/editorStore";
import { useAssets } from "../library/useAssets";
import {
  type ContentItem,
  MAX_MEDIA,
  MAX_TEXTS,
  type MediaItem,
  resolveRoles,
  sceneToContent,
  type TextItem,
  type TextRole,
} from "./content";
import { type Proposal, proposeAll, relayoutScene } from "./propose";
import { useLayoutWizard, type WizardRequest } from "./wizardStore";

const PER_PAGE = 6;
const ROLE_LABELS: Record<TextRole, string> = { title: "Titre", subtitle: "Sous-titre", body: "Texte" };

let counter = 0;
const localId = () => `item-${Date.now().toString(36)}-${(counter++).toString(36)}`;

/** Photo ou vidéo du compte → élément de contenu (avec son ratio, mesuré si besoin). */
async function assetToItem(a: StoredFile): Promise<MediaItem> {
  if (a.kind === "video") {
    const meta = await getVideoMeta(a.url).catch(() => null);
    const aspect = meta?.width && meta.height ? meta.width / meta.height : 16 / 9;
    const duration = meta && meta.duration > 0 ? meta.duration : a.durationSeconds;
    return { kind: "video", id: localId(), src: a.url, aspect, name: a.name, durationSeconds: duration };
  }
  const size =
    a.width && a.height
      ? { width: a.width, height: a.height }
      : await getImageSize(a.url).catch(() => ({ width: 1, height: 1 }));
  return { kind: "image", id: localId(), src: a.url, aspect: size.width / size.height, name: a.name };
}

/** Fenêtre de création de page : on pose le contenu, le site propose des mises en page. */
export function LayoutWizard() {
  const request = useLayoutWizard((s) => s.request);
  if (!request) return null;
  return <WizardDialog key={request.mode === "relayout" ? request.sceneId : "new"} request={request} />;
}

function WizardDialog({ request }: { request: WizardRequest }) {
  const project = useProject();
  const close = useLayoutWizard((s) => s.close);
  const { addScene, updateScene } = useEditor.getState();
  const [items, setItems] = useState<ContentItem[]>(() => {
    if (request.mode !== "relayout") return [];
    const scene = useEditor.getState().project.scenes.find((s) => s.id === request.sceneId);
    return scene ? sceneToContent(scene) : [];
  });
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [showLibrary, setShowLibrary] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const media = items.filter((i): i is MediaItem => i.kind !== "text");
  const texts = items.filter((i): i is TextItem => i.kind === "text");
  const guessed = useMemo(() => new Map(resolveRoles(texts).map((t) => [t.id, t.role])), [texts]);

  // Les propositions suivent le contenu sans bloquer la saisie.
  const content = useDeferredValue(items);
  const { width, height, fps, theme } = project;
  const sceneSeconds = project.defaultSceneSeconds;
  const all = useMemo(
    () => proposeAll(content, { width, height, fps, sceneSeconds }, theme),
    [content, width, height, fps, sceneSeconds, theme],
  );
  const pageCount = Math.max(1, Math.ceil(all.length / PER_PAGE));
  const current = page % pageCount;
  const shown = all.slice(current * PER_PAGE, current * PER_PAGE + PER_PAGE);
  // biome-ignore lint/correctness/useExhaustiveDependencies: on revient aux meilleures idées quand le contenu change
  useEffect(() => setPage(0), [content]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  const addMedia = (added: MediaItem[]) =>
    setItems((prev) => {
      const room = MAX_MEDIA - prev.filter((i) => i.kind !== "text").length;
      return [...prev, ...added.slice(0, Math.max(0, room))];
    });

  const uploadFiles = async (files: File[]) => {
    const usable = files.filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"));
    if (usable.length === 0) return;
    setBusy(true);
    setProblem(null);
    try {
      for (const file of usable.slice(0, MAX_MEDIA - media.length)) {
        addMedia([await assetToItem(await api.uploadAsset(file))]);
      }
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "Envoi impossible");
    } finally {
      setBusy(false);
    }
  };

  const pickAsset = async (a: StoredFile) => {
    if (media.length >= MAX_MEDIA) return;
    setBusy(true);
    try {
      addMedia([await assetToItem(a)]);
    } finally {
      setBusy(false);
    }
  };

  const move = (id: string, dir: -1 | 1) =>
    setItems((prev) => {
      const list: ContentItem[] = prev.filter((i) => i.kind !== "text");
      const index = list.findIndex((i) => i.id === id);
      const to = index + dir;
      if (index < 0 || to < 0 || to >= list.length) return prev;
      [list[index], list[to]] = [list[to] as ContentItem, list[index] as ContentItem];
      return [...list, ...prev.filter((i) => i.kind === "text")];
    });
  const remove = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id));
  const updateText = (id: string, patch: Partial<TextItem>) =>
    setItems((prev) => prev.map((i) => (i.id === id && i.kind === "text" ? { ...i, ...patch } : i)));
  const addText = () => setItems((prev) => [...prev, { kind: "text", id: localId(), text: "", role: null }]);

  const pick = (p: Proposal) => {
    // Copie avec de nouveaux identifiants : la même proposition peut servir deux fois.
    const scene = duplicateScene(p.scene);
    if (request.mode === "new") addScene(scene, request.afterId);
    else updateScene(request.sceneId, (s) => relayoutScene(s, { ...p, scene }));
    close();
  };

  const blankPage = () => {
    const scene = createScene({ durationInFrames: Math.round((sceneSeconds ?? 4) * fps) });
    if (theme) applyThemeToScene(scene, theme);
    addScene(scene, request.mode === "new" ? request.afterId : undefined);
    close();
  };

  const portrait = height > width;
  const empty = media.length === 0 && texts.every((t) => !t.text.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4" role="presentation">
      <button type="button" aria-label="Fermer" className="absolute inset-0 cursor-default" onClick={close} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={request.mode === "new" ? "Nouvelle page" : "Changer de mise en page"}
        className="relative flex h-[88vh] w-full max-w-6xl overflow-hidden rounded-xl border border-line bg-panel shadow-2xl"
      >
        {/* ------------------------------------------------ Contenu */}
        <section
          aria-label="Contenu de la page"
          className={clsx(
            "flex w-80 shrink-0 flex-col border-line border-r",
            dragOver && "bg-accent-soft outline-2 outline-accent outline-dashed -outline-offset-4",
          )}
          onDragOver={(e) => {
            if (!e.dataTransfer.types.includes("Files")) return;
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            void uploadFiles(Array.from(e.dataTransfer.files));
          }}
        >
          <header className="border-line border-b px-4 py-3">
            <h2 className="flex items-center gap-2 font-semibold text-sm">
              <LayoutTemplate size={16} className="text-accent" />
              {request.mode === "new" ? "Nouvelle page" : "Changer de mise en page"}
            </h2>
            <p className="mt-1 text-[11px] text-ink-faint leading-snug">
              {request.mode === "new"
                ? "Pose ce que tu veux sur la page : le site te propose des mises en page."
                : "Ton contenu est repris : choisis une nouvelle disposition."}
            </p>
          </header>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3">
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <h3 className="font-semibold text-[11px] text-ink-faint uppercase tracking-wider">
                  Photos et vidéos ({media.length}/{MAX_MEDIA})
                </h3>
                {busy ? <LoaderCircle size={13} className="animate-spin text-ink-faint" /> : null}
              </div>
              {media.length > 0 ? (
                <ul className="mb-2 grid grid-cols-3 gap-1.5">
                  {media.map((m, i) => (
                    <li
                      key={m.id}
                      className="group relative aspect-square overflow-hidden rounded-md bg-black ring-1 ring-line"
                    >
                      {m.kind === "image" ? (
                        <img src={m.src} alt={m.name} className="size-full object-cover" />
                      ) : (
                        <>
                          <video src={`${m.src}#t=0.1`} muted preload="metadata" className="size-full object-cover" />
                          <Clapperboard size={12} className="absolute bottom-1 left-1 text-white drop-shadow" />
                        </>
                      )}
                      <span className="absolute top-1 left-1 rounded bg-black/60 px-1 text-[10px] text-white">
                        {i + 1}
                      </span>
                      <div className="absolute inset-x-0 bottom-0 hidden justify-between bg-black/60 group-hover:flex">
                        <button
                          type="button"
                          aria-label="Avancer"
                          className="p-0.5 text-white"
                          onClick={() => move(m.id, -1)}
                        >
                          <ChevronLeft size={13} />
                        </button>
                        <button
                          type="button"
                          aria-label="Retirer"
                          className="p-0.5 text-white hover:text-red-300"
                          onClick={() => remove(m.id)}
                        >
                          <X size={13} />
                        </button>
                        <button
                          type="button"
                          aria-label="Reculer"
                          className="p-0.5 text-white"
                          onClick={() => move(m.id, 1)}
                        >
                          <ChevronRight size={13} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="flex gap-1.5">
                <button
                  type="button"
                  disabled={busy || media.length >= MAX_MEDIA}
                  onClick={() => fileInput.current?.click()}
                  className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md bg-accent text-white text-xs transition hover:bg-accent-hover disabled:opacity-50"
                >
                  <ImagePlus size={14} /> Importer
                </button>
                <button
                  type="button"
                  disabled={media.length >= MAX_MEDIA}
                  onClick={() => setShowLibrary((v) => !v)}
                  className={clsx(
                    "flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md border text-xs transition disabled:opacity-50",
                    showLibrary
                      ? "border-accent text-ink"
                      : "border-line text-ink-muted hover:border-accent hover:text-ink",
                  )}
                >
                  Ma bibliothèque
                </button>
              </div>
              <input
                ref={fileInput}
                type="file"
                accept="image/*,video/mp4,video/webm"
                multiple
                hidden
                onChange={(e) => {
                  const files = Array.from(e.currentTarget.files ?? []);
                  e.currentTarget.value = "";
                  void uploadFiles(files);
                }}
              />
              <p className="mt-1.5 text-[10px] text-ink-faint">
                Ou glisse tes fichiers ici. La n° 1 est mise en avant.
              </p>
              {problem ? <p className="mt-1 text-[11px] text-red-300">{problem}</p> : null}
              {showLibrary ? (
                <LibraryPicker onPick={(a) => void pickAsset(a)} used={new Set(media.map((m) => m.src))} />
              ) : null}
            </div>

            <div>
              <h3 className="mb-1.5 font-semibold text-[11px] text-ink-faint uppercase tracking-wider">
                Textes ({texts.length}/{MAX_TEXTS})
              </h3>
              <div className="space-y-2">
                {texts.map((t, i) => (
                  <div key={t.id} className="rounded-md border border-line bg-canvas p-1.5">
                    <div className="mb-1 flex items-center gap-1">
                      <select
                        aria-label="Rôle du texte"
                        value={t.role ?? ""}
                        onChange={(e) => updateText(t.id, { role: (e.currentTarget.value || null) as TextRole | null })}
                        className="h-6 rounded bg-panel px-1 text-[11px] text-ink-muted outline-none ring-1 ring-line"
                      >
                        <option value="">Auto ({ROLE_LABELS[guessed.get(t.id) ?? "body"]})</option>
                        <option value="title">Titre</option>
                        <option value="subtitle">Sous-titre</option>
                        <option value="body">Texte</option>
                      </select>
                      <span className="flex-1" />
                      <button
                        type="button"
                        aria-label="Supprimer le texte"
                        className="rounded p-0.5 text-ink-faint hover:text-red-300"
                        onClick={() => remove(t.id)}
                      >
                        <X size={13} />
                      </button>
                    </div>
                    <textarea
                      // biome-ignore lint/a11y/noAutofocus: nouveau texte ajouté par un clic
                      autoFocus={t.text === "" && i === texts.length - 1}
                      aria-label="Texte"
                      rows={2}
                      value={t.text}
                      placeholder="Écris ton texte…"
                      onChange={(e) => updateText(t.id, { text: e.currentTarget.value })}
                      className="w-full resize-y rounded bg-transparent px-1 text-xs outline-none placeholder:text-ink-faint"
                    />
                  </div>
                ))}
              </div>
              <button
                type="button"
                disabled={texts.length >= MAX_TEXTS}
                onClick={addText}
                className="mt-2 flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-line border-dashed text-ink-muted text-xs transition hover:border-accent hover:text-ink disabled:opacity-40"
              >
                <Type size={13} /> Ajouter un texte
              </button>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------ Propositions */}
        <section aria-label="Propositions" className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center gap-2 border-line border-b px-4 py-2.5">
            <h3 className="font-semibold text-sm">Propositions</h3>
            {all.length > 0 ? (
              <span className="text-[11px] text-ink-faint tabular-nums">
                {pageCount > 1 ? `idées ${current + 1}/${pageCount}` : `${all.length} idées`}
              </span>
            ) : null}
            <span className="flex-1" />
            {pageCount > 1 ? (
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                className="flex h-8 items-center gap-1.5 rounded-md bg-accent px-3 text-white text-xs transition hover:bg-accent-hover"
              >
                <Shuffle size={13} /> Autres idées
              </button>
            ) : null}
            {request.mode === "new" ? (
              <button
                type="button"
                onClick={blankPage}
                className="flex h-8 items-center gap-1.5 rounded-md border border-line px-3 text-ink-muted text-xs transition hover:border-accent hover:text-ink"
              >
                <FilePlus2 size={13} /> Page vide
              </button>
            ) : null}
            <button
              type="button"
              aria-label="Fermer"
              onClick={close}
              className="flex size-8 items-center justify-center rounded-md text-ink-muted hover:bg-panel-hover hover:text-ink"
            >
              <X size={16} />
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {empty ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-ink-faint text-sm">
                <LayoutTemplate size={34} />
                <p className="max-w-sm">
                  Ajoute des photos, une vidéo ou un texte à gauche : les propositions de mise en page apparaissent ici.
                </p>
                <button
                  type="button"
                  onClick={addText}
                  className="flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-ink-muted text-xs hover:border-accent hover:text-ink"
                >
                  <Plus size={13} /> Commencer par un titre
                </button>
              </div>
            ) : (
              <div
                className={clsx("grid gap-4", portrait ? "grid-cols-3 lg:grid-cols-4" : "grid-cols-2 xl:grid-cols-3")}
              >
                {shown.map((p) => (
                  <ProposalCard key={p.key} proposal={p} width={width} height={height} fps={fps} onPick={pick} />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

/** Une proposition : la scène jouée en boucle par la même composition que l'aperçu. */
const ProposalCard = memo(function ProposalCard({
  proposal,
  width,
  height,
  fps,
  onPick,
}: {
  proposal: Proposal;
  width: number;
  height: number;
  fps: number;
  onPick: (p: Proposal) => void;
}) {
  const inputProps = useMemo(() => ({ scene: proposal.scene, showPlaceholders: false }), [proposal.scene]);
  return (
    <button
      type="button"
      onClick={() => onPick(proposal)}
      data-layout={proposal.layoutId}
      className="group text-left"
      title="Utiliser cette mise en page"
    >
      <div className="overflow-hidden rounded-lg ring-1 ring-line transition group-hover:ring-2 group-hover:ring-accent">
        <Player
          component={ScenePreview}
          inputProps={inputProps}
          durationInFrames={proposal.scene.durationInFrames}
          compositionWidth={width}
          compositionHeight={height}
          fps={fps}
          style={{ width: "100%", aspectRatio: `${width} / ${height}` }}
          autoPlay
          loop
          initiallyMuted
          controls={false}
          clickToPlay={false}
          doubleClickToFullscreen={false}
          spaceKeyToPlayOrPause={false}
          acknowledgeRemotionLicense
        />
      </div>
      <span className="mt-1.5 block truncate text-[11px] text-ink-muted">
        {proposal.layoutName} <span className="text-ink-faint">· {proposal.styleName}</span>
      </span>
    </button>
  );
});

/** Photos et vidéos déjà importées dans le compte. */
function LibraryPicker({ onPick, used }: { onPick: (a: StoredFile) => void; used: Set<string> }) {
  const images = useAssets("image");
  const videos = useAssets("video");
  const assets = [...images.assets, ...videos.assets];
  if (assets.length === 0) {
    return <p className="mt-2 text-[11px] text-ink-faint">Ta bibliothèque est vide pour l'instant.</p>;
  }
  return (
    <div className="mt-2 grid max-h-56 grid-cols-3 gap-1.5 overflow-y-auto rounded-md border border-line p-1.5">
      {assets.map((a) => (
        <button
          type="button"
          key={a.id}
          title={a.name}
          onClick={() => onPick(a)}
          className={clsx(
            "relative aspect-square overflow-hidden rounded bg-black ring-1 transition hover:ring-2 hover:ring-accent",
            used.has(a.url) ? "opacity-40 ring-accent" : "ring-line",
          )}
        >
          {a.kind === "video" ? (
            <video src={`${a.url}#t=0.1`} muted preload="metadata" className="size-full object-cover" />
          ) : (
            <img src={a.url} alt={a.name} loading="lazy" className="size-full object-cover" />
          )}
        </button>
      ))}
    </div>
  );
}
