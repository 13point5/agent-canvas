import {
  NodeSqliteWrapper,
  SQLiteSyncStorage,
} from "@tldraw/sync-core";
import type { TLStoreSnapshot } from "@tldraw/editor";
import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import { readFile, rename } from "node:fs/promises";
import { join } from "node:path";
import { getBoardsDir, getDataDir, listDirs } from "./storage";

function getRoomsDir(): string {
  return join(getDataDir(), "rooms");
}

/**
 * Migrate existing board snapshots (JSON files) to SQLite sync storage.
 * This is a one-time migration: after migrating, snapshot.json is renamed
 * to snapshot.json.migrated to prevent re-processing.
 */
export async function migrateSnapshotsToSync() {
  const boardsDir = getBoardsDir();
  const roomsDir = getRoomsDir();
  mkdirSync(roomsDir, { recursive: true });

  const boardIds = await listDirs(boardsDir);
  let migrated = 0;

  for (const id of boardIds) {
    const snapshotPath = join(boardsDir, id, "snapshot.json");
    const migratedMarker = `${snapshotPath}.migrated`;
    const dbPath = join(roomsDir, `${id}.db`);

    // Skip if already migrated or no snapshot exists
    if (existsSync(migratedMarker)) continue;
    if (!existsSync(snapshotPath)) continue;

    // Skip if SQLite DB already exists (room already has sync data)
    if (existsSync(dbPath)) {
      // Mark as migrated so we don't check again
      try {
        await rename(snapshotPath, migratedMarker);
      } catch { /* ignore */ }
      continue;
    }

    try {
      const raw = await readFile(snapshotPath, "utf-8");
      const snapshot = JSON.parse(raw) as TLStoreSnapshot;

      // Create SQLite storage with the existing snapshot data
      const db = new Database(dbPath);
      const sql = new NodeSqliteWrapper(db);
      new SQLiteSyncStorage({ sql, snapshot });
      db.close();

      // Rename original file to mark as migrated
      await rename(snapshotPath, migratedMarker);
      migrated++;
      console.log(`[migrate] Board ${id}: snapshot.json → SQLite sync storage`);
    } catch (e) {
      console.warn(
        `[migrate] Failed to migrate board ${id}:`,
        e instanceof Error ? e.message : e,
      );
    }
  }

  if (migrated > 0) {
    console.log(`[migrate] Migrated ${migrated} board(s) to sync storage`);
  }
}
