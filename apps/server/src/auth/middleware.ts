import type { User } from "@app/schema";
import type { Context, MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Accounts } from "./accounts";

export const SESSION_COOKIE = "montage_session";

export type AppEnv = { Variables: { user: User } };

/** Le cookie n'est marqué « Secure » qu'en HTTPS (y compris derrière un reverse proxy). */
const isHttps = (c: Context) =>
  c.req.header("x-forwarded-proto") === "https" || new URL(c.req.url).protocol === "https:";

export function setSessionCookie(c: Context, token: string, days: number) {
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "Lax",
    secure: isHttps(c),
    path: "/",
    maxAge: days * 86_400,
  });
}

export function clearSessionCookie(c: Context) {
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
}

export const getSessionToken = (c: Context) => getCookie(c, SESSION_COOKIE);

/** Refuse la requête si personne n'est connecté ; sinon met l'utilisateur dans c.var.user. */
export function requireUser(accounts: Accounts): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const user = accounts.userForToken(getSessionToken(c));
    if (!user) return c.json({ error: "Non connecté" }, 401);
    c.set("user", user);
    await next();
  };
}

/**
 * Protection CSRF légère : toute requête qui modifie des données doit venir
 * de la même origine (en plus du cookie SameSite=Lax).
 */
export const sameOrigin: MiddlewareHandler = async (c, next) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(c.req.method)) {
    const origin = c.req.header("origin");
    if (origin) {
      const host = c.req.header("x-forwarded-host") ?? c.req.header("host");
      if (new URL(origin).host !== host) return c.json({ error: "Origine refusée" }, 403);
    }
  }
  await next();
};

/** Limiteur très simple en mémoire (par IP), pour freiner les essais de mots de passe. */
export function rateLimit(max: number, windowMs: number): MiddlewareHandler {
  const hits = new Map<string, { count: number; reset: number }>();
  return async (c, next) => {
    const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? c.req.header("x-real-ip") ?? "local";
    const now = Date.now();
    const entry = hits.get(ip);
    if (!entry || entry.reset < now) {
      hits.set(ip, { count: 1, reset: now + windowMs });
      if (hits.size > 10_000) hits.clear();
    } else if (++entry.count > max) {
      return c.json({ error: "Trop d'essais, réessaie dans une minute." }, 429);
    }
    await next();
  };
}
