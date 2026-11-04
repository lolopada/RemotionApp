import { ensureFont, FONT_CATALOG, FONT_CATEGORIES, getFontInfo } from "@app/composition";
import clsx from "clsx";
import { Check, ChevronDown, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Popover } from "./Popover";

/** Charge toutes les polices (graisse normale) pour les aperçus de la liste. */
let previewsLoaded = false;
function loadPreviews() {
  if (previewsLoaded) return;
  previewsLoaded = true;
  for (const f of FONT_CATALOG) ensureFont(f.family, 400);
}

/** Sélecteur de police : classé par style, chaque nom écrit dans sa police, avec recherche. */
export function FontPicker({ value, onChange }: { value: string; onChange: (family: string) => void }) {
  const current = getFontInfo(value);
  useEffect(() => ensureFont(value, 400), [value]);

  return (
    <Popover
      className="w-72"
      trigger={({ toggle, open }) => (
        <button
          type="button"
          onClick={() => {
            loadPreviews();
            toggle();
          }}
          className={clsx(
            "flex h-8 w-full items-center gap-2 rounded-md border bg-canvas px-2 text-left text-sm",
            open ? "border-accent" : "border-line",
          )}
          aria-label="Choisir une police"
        >
          <span className="min-w-0 flex-1 truncate" style={{ fontFamily: `"${value}", sans-serif` }}>
            {current?.label ?? value}
          </span>
          <ChevronDown size={14} className="shrink-0 text-ink-faint" />
        </button>
      )}
    >
      {(close) => (
        <FontList
          value={value}
          onPick={(family) => {
            onChange(family);
            close();
          }}
        />
      )}
    </Popover>
  );
}

function FontList({ value, onPick }: { value: string; onPick: (family: string) => void }) {
  const [query, setQuery] = useState("");
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return FONT_CATEGORIES.map((cat) => ({
      cat,
      fonts: FONT_CATALOG.filter((f) => f.category === cat && (!q || f.label.toLowerCase().includes(q))),
    })).filter((g) => g.fonts.length > 0);
  }, [query]);

  return (
    <div>
      <div className="flex items-center gap-2 border-line border-b px-3 py-2">
        <Search size={13} className="text-ink-faint" />
        <input
          // biome-ignore lint/a11y/noAutofocus: la liste s'ouvre pour chercher
          autoFocus
          className="w-full bg-transparent text-xs outline-none"
          placeholder={`Rechercher parmi ${FONT_CATALOG.length} polices`}
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
        />
      </div>
      <div className="max-h-96 overflow-y-auto p-1">
        {groups.map((g) => (
          <div key={g.cat} className="mb-1">
            <p className="px-2 pt-2 pb-1 font-semibold text-[10px] text-ink-faint uppercase tracking-wider">{g.cat}</p>
            {g.fonts.map((f) => (
              <button
                type="button"
                key={f.family}
                onClick={() => onPick(f.family)}
                className={clsx(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition hover:bg-panel-hover",
                  f.family === value && "bg-accent-soft",
                )}
              >
                <span
                  className="min-w-0 flex-1 truncate text-lg leading-tight"
                  style={{ fontFamily: `"${f.family}", sans-serif` }}
                >
                  {f.label}
                </span>
                {f.family === value ? <Check size={13} className="shrink-0 text-accent" /> : null}
              </button>
            ))}
          </div>
        ))}
        {groups.length === 0 ? <p className="p-3 text-center text-ink-faint text-xs">Aucune police trouvée.</p> : null}
      </div>
    </div>
  );
}
