import { ensureFont } from "@app/composition";
import type { Theme, ThemeColorRole } from "@app/schema";
import clsx from "clsx";
import { Paintbrush } from "lucide-react";
import { useEffect } from "react";
import { FontPicker } from "../../components/FontPicker";
import { Button, Field } from "../../components/ui";
import { useEditor, useProject } from "../../store/editorStore";
import { THEME_PRESETS, THEME_ROLE_LABELS } from "../../templates/themes";
import { TabHeader } from "./LibraryPanel";

const sameTheme = (a: Theme | null, b: Theme) =>
  !!a && a.name === b.name && a.headingFont === b.headingFont && JSON.stringify(a.colors) === JSON.stringify(b.colors);

/**
 * Thème du projet : une palette (fond, fond 2, accent, titres, textes) et deux polices.
 * Choisir un thème l'applique à toutes les scènes ; on peut ensuite le retoucher et le réappliquer.
 */
export function ThemeTab() {
  const project = useProject();
  const { applyTheme, updateTheme } = useEditor.getState();
  const theme = project.theme;

  useEffect(() => {
    for (const t of THEME_PRESETS) {
      ensureFont(t.headingFont, 400);
      ensureFont(t.bodyFont, 400);
    }
  }, []);

  return (
    <div className="pb-4">
      <TabHeader
        title="Thème du projet"
        hint="Une palette et deux polices, appliquées d'un coup à toutes les scènes : fonds, titres, textes, formes et bandeaux. Les photos ne changent pas."
      />

      {theme ? (
        <div className="mx-3 mb-3 space-y-2 rounded-lg border border-line p-2.5">
          <p className="font-medium text-xs">Thème actuel : {theme.name}</p>
          <div className="grid grid-cols-5 gap-1.5">
            {(Object.keys(THEME_ROLE_LABELS) as ThemeColorRole[]).map((role) => (
              <label key={role} className="flex flex-col items-center gap-1 text-[10px] text-ink-muted">
                <input
                  type="color"
                  aria-label={`Couleur : ${THEME_ROLE_LABELS[role]}`}
                  className="h-8 w-full cursor-pointer rounded border border-line bg-transparent"
                  value={theme.colors[role]}
                  onChange={(e) => {
                    const v = e.currentTarget.value;
                    updateTheme((t) => void (t.colors[role] = v));
                  }}
                />
                {THEME_ROLE_LABELS[role]}
              </label>
            ))}
          </div>
          <Field label="Police titres">
            <FontPicker value={theme.headingFont} onChange={(v) => updateTheme((t) => void (t.headingFont = v))} />
          </Field>
          <Field label="Police textes">
            <FontPicker value={theme.bodyFont} onChange={(v) => updateTheme((t) => void (t.bodyFont = v))} />
          </Field>
          <Button variant="primary" size="sm" className="w-full" onClick={() => applyTheme(theme)}>
            <Paintbrush size={13} /> Appliquer à toutes les scènes
          </Button>
          <p className="text-[10px] text-ink-faint leading-snug">
            Les retouches faites à la main sur les couleurs et polices sont remplacées (Ctrl+Z pour revenir).
          </p>
        </div>
      ) : null}

      <TabHeader title="Thèmes prêts à l'emploi" hint="Clique pour l'appliquer à tout le projet." />
      <div className="grid grid-cols-2 gap-2 px-3">
        {THEME_PRESETS.map((preset) => (
          <button
            type="button"
            key={preset.name}
            onClick={() => applyTheme({ ...preset, colors: { ...preset.colors } })}
            className="group text-left"
          >
            <div
              className={clsx(
                "overflow-hidden rounded-md ring-1 transition group-hover:ring-2 group-hover:ring-accent",
                sameTheme(theme, preset) ? "ring-2 ring-accent" : "ring-line",
              )}
            >
              <div
                className="flex h-16 flex-col justify-center px-2"
                style={{
                  background: `linear-gradient(135deg, ${preset.colors.background}, ${preset.colors.background2})`,
                }}
              >
                <span
                  className="truncate text-lg leading-tight"
                  style={{ fontFamily: `"${preset.headingFont}"`, color: preset.colors.title }}
                >
                  Aa Titre
                </span>
                <span
                  className="truncate text-[10px]"
                  style={{ fontFamily: `"${preset.bodyFont}"`, color: preset.colors.text }}
                >
                  Un petit texte
                </span>
              </div>
              <div className="flex h-2.5">
                {Object.values(preset.colors).map((c, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: 5 rôles fixes
                  <span key={i} className="flex-1" style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
            <span className="mt-1 block text-[11px] text-ink-muted">{preset.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
