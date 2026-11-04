import clsx from "clsx";
import { LoaderCircle } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { Logo } from "../../components/Logo";
import { api } from "../../lib/api";
import { BUILD, formatBuild } from "../../lib/version";
import { useAuth } from "../../store/authStore";

/** Connexion / inscription : juste un nom d'utilisateur et un mot de passe. */
export function AuthScreen() {
  const setUser = useAuth((s) => s.setUser);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [allowSignup, setAllowSignup] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .authConfig()
      .then((c) => setAllowSignup(c.allowSignup))
      .catch(() => undefined);
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (mode === "register" && password !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setBusy(true);
    try {
      const user = mode === "login" ? await api.login(username, password) : await api.register(username, password);
      setUser(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
    }
  };

  const input =
    "h-10 w-full rounded-md border border-line bg-canvas px-3 text-sm text-ink outline-none focus:border-accent";

  return (
    <div className="flex min-h-full items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center gap-2.5">
          <Logo size={36} />
          <span className="font-semibold text-xl">Montage</span>
        </div>

        <div className="rounded-xl border border-line bg-panel p-6 shadow-2xl shadow-black/40">
          {allowSignup ? (
            <div className="mb-5 grid grid-cols-2 rounded-lg bg-canvas p-1 text-sm">
              {(["login", "register"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMode(m);
                    setError(null);
                  }}
                  className={clsx(
                    "rounded-md py-1.5 transition",
                    mode === m ? "bg-panel-hover text-ink" : "text-ink-faint hover:text-ink",
                  )}
                >
                  {m === "login" ? "Se connecter" : "Créer un compte"}
                </button>
              ))}
            </div>
          ) : (
            <h1 className="mb-5 font-semibold text-lg">Se connecter</h1>
          )}

          <form onSubmit={submit} className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-ink-muted text-xs">Nom d'utilisateur</span>
              <input
                className={input}
                value={username}
                onChange={(e) => setUsername(e.currentTarget.value)}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-ink-muted text-xs">Mot de passe</span>
              <input
                className={input}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
              />
            </label>
            {mode === "register" ? (
              <label className="block">
                <span className="mb-1 block text-ink-muted text-xs">Confirmer le mot de passe</span>
                <input
                  className={input}
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.currentTarget.value)}
                  autoComplete="new-password"
                  required
                />
                <span className="mt-1 block text-[11px] text-ink-faint">
                  8 caractères minimum. Pas d'e-mail : garde-le bien, il n'y a pas de récupération.
                </span>
              </label>
            ) : null}

            {error ? <p className="rounded-md bg-red-500/10 px-3 py-2 text-red-300 text-xs">{error}</p> : null}

            <button
              type="submit"
              disabled={busy}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-accent font-medium text-sm text-white transition hover:bg-accent-hover disabled:opacity-60"
            >
              {busy ? <LoaderCircle size={15} className="animate-spin" /> : null}
              {mode === "login" ? "Se connecter" : "Créer mon compte"}
            </button>
          </form>
        </div>
        <p className="mt-4 text-center text-[11px] text-ink-faint tabular-nums">Montage {formatBuild(BUILD)}</p>
      </div>
    </div>
  );
}
