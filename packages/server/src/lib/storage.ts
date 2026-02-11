import { existsSync } from "node:fs";
import { copyFile, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, extname, join } from "node:path";

export function getDataDir(): string {
  return join(homedir(), ".agent-canvas");
}

export function getBoardsDir(): string {
  return join(getDataDir(), "boards");
}

export function getBoardDir(id: string): string {
  return join(getBoardsDir(), id);
}

export async function ensureDir(path: string): Promise<void> {
  if (!existsSync(path)) {
    await mkdir(path, { recursive: true });
  }
}

export async function readJSON<T>(path: string): Promise<T | null> {
  try {
    const data = await readFile(path, "utf-8");
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
}

export async function writeJSON(path: string, data: unknown): Promise<void> {
  await ensureDir(dirname(path));
  await writeFile(path, JSON.stringify(data, null, 2));
}

export async function listDirs(path: string): Promise<string[]> {
  try {
    const entries = await readdir(path, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

export async function removeDir(path: string): Promise<void> {
  await rm(path, { recursive: true, force: true });
}

export function getBoardAssetsDir(boardId: string): string {
  return join(getBoardDir(boardId), "assets");
}

export async function copyToBoardAssets(
  localPath: string,
  boardId: string,
): Promise<{ filename: string; fullPath: string }> {
  const assetsDir = getBoardAssetsDir(boardId);
  await ensureDir(assetsDir);

  const originalName = basename(localPath);
  const ext = extname(originalName);
  const stem = originalName.slice(0, -ext.length || undefined);

  let filename = originalName;
  let destPath = join(assetsDir, filename);
  let counter = 1;
  while (existsSync(destPath)) {
    filename = `${stem}-${counter}${ext}`;
    destPath = join(assetsDir, filename);
    counter++;
  }

  await copyFile(localPath, destPath);
  return { filename, fullPath: destPath };
}
