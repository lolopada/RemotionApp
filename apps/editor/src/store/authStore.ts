import type { User } from "@app/schema";
import { create } from "zustand";
import { api, setUnauthorizedHandler } from "../lib/api";

type AuthState =
  | { status: "loading"; user: null }
  | { status: "anonymous"; user: null }
  | { status: "offline"; user: null }
  | { status: "authenticated"; user: User };

interface AuthStore {
  state: AuthState;
  check(): Promise<void>;
  setUser(user: User): void;
  logout(): Promise<void>;
}

export const useAuth = create<AuthStore>()((set) => ({
  state: { status: "loading", user: null },

  async check() {
    try {
      set({ state: { status: "authenticated", user: await api.me() } });
    } catch (err) {
      const offline = err instanceof Error && "status" in err && err.status === 0;
      set({ state: { status: offline ? "offline" : "anonymous", user: null } });
    }
  },

  setUser: (user) => set({ state: { status: "authenticated", user } }),

  async logout() {
    await api.logout().catch(() => undefined);
    set({ state: { status: "anonymous", user: null } });
  },
}));

// Session expirée pendant l'utilisation → retour à l'écran de connexion.
setUnauthorizedHandler(() => {
  if (useAuth.getState().state.status === "authenticated") {
    useAuth.setState({ state: { status: "anonymous", user: null } });
  }
});
