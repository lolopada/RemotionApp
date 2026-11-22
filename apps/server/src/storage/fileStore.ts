import { createWriteStream } from "node:fs";
import { mkdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { type FileKind, newId, type StoredFile } from "@app/schema";
import type { Db } from "../db";

/**
 * Types acceptés. Pas de SVG : servi depuis la même origine, il pourrait
 * exécuter du script.
 */
const MIME: Record<string, { ext: string; kind: Exclude<FileKind, "export"> }> = {
  "image/jpeg": { ext: "jpg", kind: "image" },
  "image/png": { ext: "png", kind: "image" },
  "image/webp": { ext: "webp", kind: "image" },
  "image/gif": { ext: "gif", kind: "image" },
  "image/avif": { ext: "avif", kind: "image" },
  "audio/mpeg": { ext: "mp3", kind: "audio" },
  "audio/mp4": { ext: "m4a", kind: "audio" },
  "audio/x-m4a": { ext: "m4a", kind: "audio" },
  "audio/aac": { ext: "aac", kind: "audio" },
  "audio/ogg": { ext: "ogg", kind: "audio" },
  "audio/wav": { ext: "wav", kind: "audio" },
  "audio/x-wav": { ext: "wav", kind: "audio" },
  "video/mp4": { ext: "mp4", kind: "video" },
  "video/webm": { ext: "webm", kind: "video" },
};
const EXPORT_MIME: Record<string, string> = { "video/mp4": "mp4", "video/webm": "webm" };

export const isAcceptedMedia = (mime: string) => mime in MIME;
export const isAcceptedExport = (mime: string) => mime in EXPORT_MIME;

export class TooLargeError extends Error {}

/** Écrit un flux dans `file`, sans dépasser `maxBytes` (fichier supprimé en cas d'erreur). */
async function writeLimited(body: ReadableStream<Uint8Array>, file: string, maxBytes: number): Promise<number> {
  let size = 0;
  const counter = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      size += chunk.length;
      cb(size > maxBytes ? new TooLargeError() : null, chunk);
    },
  });
  try {
    await pipeline(Readable.fromWeb(body as WebReadableStream), counter, createWriteStream(file));
  } catch (err) {
    await rm(file, { force: true });
    throw err;
  }
  return size;
}

type Row = {
  id: string;
  user_id: string;
  kind: FileKind;
  name: string;
  mime: string;
  size: number;
  filename: string;
  project_id: string | null;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  created_at: string;
  source_key: string | null;
  source_url: string | null;
  credit: string | null;
};

/**
 * Fichiers des utilisateurs : sur disque dans `dir`, référencés en base.
 * Ils sont servis sous /files/<nom> uniquement à leur propriétaire.
 */
export function createFileStore(db: Db, dir: string, publicPrefix = "/files") {
  const q = {
    insert: db.prepare(
      `INSERT INTO files (id, user_id, kind, name, mime, size, filename, project_id, width, height, duration_seconds, created_at,
                          source_key, source_url, credit)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ),
    list: db.prepare("SELECT * FROM files WHERE user_id = ? AND kind = ? ORDER BY created_at DESC"),
    get: db.prepare("SELECT * FROM files WHERE id = ? AND user_id = ?"),
    byFilename: db.prepare("SELECT * FROM files WHERE filename = ?"),
    bySource: db.prepare("SELECT * FROM files WHERE user_id = ? AND source_key = ?"),
    remove: db.prepare("DELETE FROM files WHERE id = ? AND user_id = ?"),
    rename: db.prepare("UPDATE files SET name = ? WHERE id = ? AND user_id = ?"),
  };

  const toFile = (r: Row): StoredFile => ({
    id: r.id,
    kind: r.kind,
    name: r.name,
    mime: r.mime,
    size: r.size,
    url: `${publicPrefix}/${r.filename}`,
    projectId: r.project_id,
    width: r.width,
    height: r.height,
    durationSeconds: r.duration_seconds,
    createdAt: r.created_at,
    credit: r.credit ?? null,
    sourceUrl: r.source_url ?? null,
  });

  function record(
    userId: string,
    kind: FileKind,
    name: string,
    mime: string,
    size: number,
    filename: string,
    extra: Extra,
  ) {
    const row: Row = {
      id: filename.split(".")[0] as string,
      user_id: userId,
      kind,
      name: name.slice(0, 200) || "Sans titre",
      mime,
      size,
      filename,
      project_id: extra.projectId ?? null,
      width: extra.width ?? null,
      height: extra.height ?? null,
      duration_seconds: extra.durationSeconds ?? null,
      created_at: new Date().toISOString(),
      source_key: extra.sourceKey ?? null,
      source_url: extra.sourceUrl ?? null,
      credit: extra.credit ?? null,
    };
    q.insert.run(
      row.id,
      row.user_id,
      row.kind,
      row.name,
      row.mime,
      row.size,
      row.filename,
      row.project_id,
      row.width,
      row.height,
      row.duration_seconds,
      row.created_at,
      row.source_key,
      row.source_url,
      row.credit,
    );
    return toFile(row);
  }

  interface Extra {
    projectId?: string | null;
    width?: number | null;
    height?: number | null;
    durationSeconds?: number | null;
    sourceKey?: string | null;
    sourceUrl?: string | null;
    credit?: string | null;
  }

  return {
    list: (userId: string, kind: FileKind) => (q.list.all(userId, kind) as Row[]).map(toFile),

    /** Média importé (photo, musique…), reçu en multipart. */
    async saveMedia(userId: string, file: File): Promise<StoredFile> {
      const type = MIME[file.type];
      if (!type) throw new Error(`Type non accepté : ${file.type || "inconnu"}`);
      await mkdir(dir, { recursive: true });
      const filename = `${newId()}.${type.ext}`;
      const tmp = path.join(dir, `${filename}.part`);
      await pipeline(Readable.fromWeb(file.stream() as WebReadableStream), createWriteStream(tmp));
      await rename(tmp, path.join(dir, filename));
      return record(userId, type.kind, file.name, file.type, file.size, filename, {});
    },

    /**
     * Média téléchargé depuis un service (musique Jamendo) : écrit au fil de l'eau, plafonné
     * à `maxBytes`, avec son origine (crédit, page, clé anti-doublon).
     */
    async saveDownloaded(
      userId: string,
      body: ReadableStream<Uint8Array>,
      mime: string,
      maxBytes: number,
      meta: { name: string } & Extra,
    ): Promise<StoredFile> {
      const type = MIME[mime];
      if (!type) throw new Error(`Type non accepté : ${mime || "inconnu"}`);
      await mkdir(dir, { recursive: true });
      const filename = `${newId()}.${type.ext}`;
      const tmp = path.join(dir, `${filename}.part`);
      const size = await writeLimited(body, tmp, maxBytes);
      await rename(tmp, path.join(dir, filename));
      return record(userId, type.kind, meta.name, mime, size, filename, meta);
    },

    /** Fichier déjà importé depuis la même source (ex. « jamendo:123 »). */
    findBySource(userId: string, sourceKey: string): StoredFile | null {
      const row = q.bySource.get(userId, sourceKey) as Row | undefined;
      return row ? toFile(row) : null;
    },

    /**
     * Vidéo exportée, reçue en flux brut et écrite au fil de l'eau :
     * même un gros fichier ne passe jamais entièrement en mémoire.
     */
    async saveExport(
      userId: string,
      body: ReadableStream<Uint8Array>,
      mime: string,
      maxBytes: number,
      meta: { name: string } & Extra,
    ): Promise<StoredFile> {
      const ext = EXPORT_MIME[mime];
      if (!ext) throw new Error(`Type non accepté : ${mime}`);
      await mkdir(dir, { recursive: true });
      const filename = `${newId()}.${ext}`;
      const tmp = path.join(dir, `${filename}.part`);
      const size = await writeLimited(body, tmp, maxBytes);
      await rename(tmp, path.join(dir, filename));
      return record(userId, "export", meta.name, mime, size, filename, meta);
    },

    rename(userId: string, id: string, name: string): StoredFile | null {
      q.rename.run(name.slice(0, 200), id, userId);
      const row = q.get.get(id, userId) as Row | undefined;
      return row ? toFile(row) : null;
    },

    async remove(userId: string, id: string): Promise<boolean> {
      const row = q.get.get(id, userId) as Row | undefined;
      if (!row) return false;
      q.remove.run(id, userId);
      await rm(path.join(dir, row.filename), { force: true });
      return true;
    },

    /** Propriétaire d'un fichier servi, pour le contrôle d'accès. */
    ownerOf(filename: string): string | null {
      return (q.byFilename.get(filename) as Row | undefined)?.user_id ?? null;
    },
  };
}

export type FileStore = ReturnType<typeof createFileStore>;
