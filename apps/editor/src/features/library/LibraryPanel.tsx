import clsx from "clsx";
import { Clapperboard, Image, LayoutTemplate, Music, Palette, Proportions, Shapes, SwatchBook } from "lucide-react";
import { type ComponentType, useState } from "react";
import { AudioTab } from "./AudioTab";
import { BackgroundsTab } from "./BackgroundsTab";
import { ElementsTab } from "./ElementsTab";
import { FormatTab } from "./FormatTab";
import { MediaTab } from "./MediaTab";
import { TemplatesTab } from "./TemplatesTab";
import { ThemeTab } from "./ThemeTab";
import { VideoTab } from "./VideoTab";

/**
 * Bibliothèque (panneau gauche). Chaque onglet est un composant
 * indépendant : en ajouter un = une entrée dans TABS.
 */
const TABS: { id: string; label: string; icon: ComponentType<{ size?: number }>; Panel: ComponentType }[] = [
  { id: "templates", label: "Modèles", icon: LayoutTemplate, Panel: TemplatesTab },
  { id: "elements", label: "Éléments", icon: Shapes, Panel: ElementsTab },
  { id: "media", label: "Photos", icon: Image, Panel: MediaTab },
  { id: "video", label: "Vidéos", icon: Clapperboard, Panel: VideoTab },
  { id: "backgrounds", label: "Fonds", icon: Palette, Panel: BackgroundsTab },
  { id: "audio", label: "Musique", icon: Music, Panel: AudioTab },
  { id: "theme", label: "Thème", icon: SwatchBook, Panel: ThemeTab },
  { id: "format", label: "Format", icon: Proportions, Panel: FormatTab },
];

export function LibraryPanel() {
  const [tab, setTab] = useState("templates");
  const current = TABS.find((t) => t.id === tab) ?? TABS[0];

  return (
    <aside className="flex w-[300px] shrink-0 border-line border-r bg-panel">
      <nav className="flex w-[68px] shrink-0 flex-col gap-1 border-line border-r py-2">
        {TABS.map((t) => (
          <button
            type="button"
            key={t.id}
            onClick={() => setTab(t.id)}
            className={clsx(
              "mx-1.5 flex flex-col items-center gap-1 rounded-md py-2 text-[10px] transition",
              t.id === tab ? "bg-accent-soft text-ink" : "text-ink-faint hover:bg-panel-hover hover:text-ink",
            )}
          >
            <t.icon size={18} />
            {t.label}
          </button>
        ))}
      </nav>
      <div className="min-w-0 flex-1 overflow-y-auto">{current ? <current.Panel /> : null}</div>
    </aside>
  );
}

export function TabHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="px-3 pt-3 pb-2">
      <h2 className="font-semibold text-sm">{title}</h2>
      {hint ? <p className="mt-0.5 text-[11px] text-ink-faint leading-snug">{hint}</p> : null}
    </div>
  );
}
