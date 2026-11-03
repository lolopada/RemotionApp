import { createHash, randomBytes } from "node:crypto";
import { newId, type User } from "@app/schema";
import type { Db } from "../db";
import { hashPassword, verifyPassword } from "./password";

export const USERNAME_RE = /^[A-Za-z0-9_.-]{3,32}$/;
export const MIN_PASSWORD = 8;

export class AuthError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 401 | 403 | 409 = 400,
  ) {
    super(message);
  }
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/**
 * Comptes minimalistes : nom d'utilisateur + mot de passe, pas d'e-mail.
 * Les sessions sont des jetons aléatoires ; seule leur empreinte est stockée.
 */
export function createAccounts(db: Db, opts: { sessionDays: number }) {
  const q = {
    insertUser: db.prepare("INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)"),
    userByName: db.prepare("SELECT * FROM users WHERE username = ?"),
    userById: db.prepare("SELECT * FROM users WHERE id = ?"),
    setPassword: db.prepare("UPDATE users SET password_hash = ? WHERE id = ?"),
    insertSession: db.prepare("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)"),
    session: db.prepare(
      "SELECT s.expires_at, u.id, u.username, u.created_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?",
    ),
    touchSession: db.prepare("UPDATE sessions SET expires_at = ? WHERE token_hash = ?"),
    deleteSession: db.prepare("DELETE FROM sessions WHERE token_hash = ?"),
    deleteUserSessions: db.prepare("DELETE FROM sessions WHERE user_id = ? AND token_hash != ?"),
    purge: db.prepare("DELETE FROM sessions WHERE expires_at < ?"),
  };

  type UserRow = { id: string; username: string; password_hash: string; created_at: string };
  const toUser = (r: { id: string; username: string; created_at: string }): User => ({
    id: r.id,
    username: r.username,
    createdAt: r.created_at,
  });
  const expiry = () => new Date(Date.now() + opts.sessionDays * 86_400_000).toISOString();

  function checkPassword(password: unknown): asserts password is string {
    if (typeof password !== "string" || password.length < MIN_PASSWORD || password.length > 200) {
      throw new AuthError(`Le mot de passe doit faire au moins ${MIN_PASSWORD} caractères.`);
    }
  }

  return {
    async register(username: unknown, password: unknown): Promise<User> {
      if (typeof username !== "string" || !USERNAME_RE.test(username)) {
        throw new AuthError("Nom d'utilisateur : 3 à 32 caractères (lettres, chiffres, . _ -).");
      }
      checkPassword(password);
      if (q.userByName.get(username)) throw new AuthError("Ce nom d'utilisateur est déjà pris.", 409);
      const user = { id: newId(), username, createdAt: new Date().toISOString() };
      q.insertUser.run(user.id, user.username, await hashPassword(password), user.createdAt);
      return user;
    },

    async login(username: unknown, password: unknown): Promise<User> {
      const row = typeof username === "string" ? (q.userByName.get(username) as UserRow | undefined) : undefined;
      // On vérifie quand même un hash si l'utilisateur n'existe pas (temps constant).
      const ok = await verifyPassword(
        typeof password === "string" ? password : "",
        row?.password_hash ?? "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      );
      if (!row || !ok) throw new AuthError("Nom d'utilisateur ou mot de passe incorrect.", 401);
      return toUser(row);
    },

    async changePassword(userId: string, current: unknown, next: unknown, keepToken: string) {
      const row = q.userById.get(userId) as UserRow | undefined;
      if (!row || typeof current !== "string" || !(await verifyPassword(current, row.password_hash))) {
        throw new AuthError("Mot de passe actuel incorrect.", 403);
      }
      checkPassword(next);
      q.setPassword.run(await hashPassword(next), userId);
      // Déconnecte les autres appareils.
      q.deleteUserSessions.run(userId, sha256(keepToken));
    },

    /** Crée une session et renvoie le jeton à mettre dans le cookie. */
    createSession(userId: string): string {
      const token = randomBytes(32).toString("base64url");
      q.insertSession.run(sha256(token), userId, new Date().toISOString(), expiry());
      return token;
    },

    /** Utilisateur de la session, ou null. Prolonge la session (expiration glissante). */
    userForToken(token: string | undefined): User | null {
      if (!token) return null;
      const hash = sha256(token);
      const row = q.session.get(hash) as
        | { expires_at: string; id: string; username: string; created_at: string }
        | undefined;
      if (!row) return null;
      if (row.expires_at < new Date().toISOString()) {
        q.deleteSession.run(hash);
        return null;
      }
      q.touchSession.run(expiry(), hash);
      return toUser(row);
    },

    deleteSession(token: string | undefined) {
      if (token) q.deleteSession.run(sha256(token));
    },

    purgeExpiredSessions() {
      q.purge.run(new Date().toISOString());
    },
  };
}

export type Accounts = ReturnType<typeof createAccounts>;
