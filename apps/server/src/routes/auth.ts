import { Hono } from "hono";
import { type Accounts, AuthError } from "../auth/accounts";
import {
  type AppEnv,
  clearSessionCookie,
  getSessionToken,
  rateLimit,
  requireUser,
  setSessionCookie,
} from "../auth/middleware";

interface Credentials {
  username?: unknown;
  password?: unknown;
}

export function authRoutes(accounts: Accounts, opts: { allowSignup: boolean; sessionDays: number }) {
  const app = new Hono<AppEnv>();
  const limiter = rateLimit(10, 60_000);

  app.onError((err, c) => {
    if (err instanceof AuthError) return c.json({ error: err.message }, err.status);
    throw err;
  });

  app.get("/config", (c) => c.json({ allowSignup: opts.allowSignup }));

  app.post("/register", limiter, async (c) => {
    if (!opts.allowSignup) return c.json({ error: "Les inscriptions sont fermées." }, 403);
    const body = (await c.req.json().catch(() => ({}))) as Credentials;
    const user = await accounts.register(body.username, body.password);
    setSessionCookie(c, accounts.createSession(user.id), opts.sessionDays);
    return c.json(user, 201);
  });

  app.post("/login", limiter, async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as Credentials;
    const user = await accounts.login(body.username, body.password);
    setSessionCookie(c, accounts.createSession(user.id), opts.sessionDays);
    return c.json(user);
  });

  app.post("/logout", (c) => {
    accounts.deleteSession(getSessionToken(c));
    clearSessionCookie(c);
    return c.body(null, 204);
  });

  app.get("/me", requireUser(accounts), (c) => c.json(c.var.user));

  app.post("/password", requireUser(accounts), limiter, async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { current?: unknown; next?: unknown };
    await accounts.changePassword(c.var.user.id, body.current, body.next, getSessionToken(c) ?? "");
    return c.body(null, 204);
  });

  return app;
}
