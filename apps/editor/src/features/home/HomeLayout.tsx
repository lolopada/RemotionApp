import clsx from "clsx";
import { ChevronDown, KeyRound, LogOut } from "lucide-react";
import { type FormEvent, type ReactNode, useState } from "react";
import { Logo } from "../../components/Logo";
import { MenuItem, Popover } from "../../components/Popover";
import { api } from "../../lib/api";
import { navigate, useRoute } from "../../lib/router";
import { useAuth } from "../../store/authStore";

/** En-tête commun aux pages « Mes projets » et « Mes vidéos ». */
export function HomeLayout({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  const route = useRoute();
  const tabs = [
    { path: "/", label: "Mes projets", active: route.name === "home" },
    { path: "/videos", label: "Mes vidéos", active: route.name === "videos" },
  ];

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center gap-6 border-line border-b bg-panel px-5">
        <div className="flex items-center gap-2">
          <Logo />
          <span className="font-semibold">Montage</span>
        </div>
        <nav className="flex gap-1">
          {tabs.map((t) => (
            <button
              type="button"
              key={t.path}
              onClick={() => void navigate(t.path)}
              className={clsx(
                "rounded-md px-3 py-1.5 text-sm transition",
                t.active ? "bg-accent-soft text-ink" : "text-ink-muted hover:bg-panel-hover hover:text-ink",
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          {actions}
          <AccountMenu />
        </div>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-5 py-8">{children}</div>
      </main>
    </div>
  );
}

function AccountMenu() {
  const user = useAuth((s) => s.state.user);
  const logout = useAuth((s) => s.logout);
  const [changing, setChanging] = useState(false);

  return (
    <Popover
      trigger={({ toggle }) => (
        <button
          type="button"
          onClick={toggle}
          className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-panel-hover"
        >
          <span className="flex size-7 items-center justify-center rounded-full bg-accent/30 font-semibold text-xs uppercase">
            {user?.username.slice(0, 1)}
          </span>
          <span className="text-ink-muted">{user?.username}</span>
          <ChevronDown size={14} className="text-ink-faint" />
        </button>
      )}
      className="w-72"
    >
      {(close) =>
        changing ? (
          <PasswordForm
            onDone={() => {
              setChanging(false);
              close();
            }}
          />
        ) : (
          <>
            <MenuItem onClick={() => setChanging(true)}>
              <KeyRound size={14} /> Changer le mot de passe
            </MenuItem>
            <MenuItem danger onClick={() => void logout()}>
              <LogOut size={14} /> Se déconnecter
            </MenuItem>
          </>
        )
      }
    </Popover>
  );
}

function PasswordForm({ onDone }: { onDone: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const input = "h-8 w-full rounded-md border border-line bg-canvas px-2 text-sm outline-none focus:border-accent";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.changePassword(current, next);
      setMessage({ ok: true, text: "Mot de passe changé. Les autres appareils sont déconnectés." });
      setTimeout(onDone, 1500);
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : "Erreur" });
    }
  };

  return (
    <form onSubmit={submit} className="space-y-2 p-2">
      <input
        className={input}
        type="password"
        placeholder="Mot de passe actuel"
        autoComplete="current-password"
        value={current}
        onChange={(e) => setCurrent(e.currentTarget.value)}
      />
      <input
        className={input}
        type="password"
        placeholder="Nouveau mot de passe (8+)"
        autoComplete="new-password"
        value={next}
        onChange={(e) => setNext(e.currentTarget.value)}
      />
      {message ? (
        <p className={clsx("text-xs", message.ok ? "text-emerald-300" : "text-red-300")}>{message.text}</p>
      ) : null}
      <button type="submit" className="h-8 w-full rounded-md bg-accent text-sm text-white hover:bg-accent-hover">
        Valider
      </button>
    </form>
  );
}
