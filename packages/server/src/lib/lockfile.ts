import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const LOCKFILE_PATH = join(tmpdir(), "agent-canvas.lock");

export interface LockfileData {
  pid: number;
  port: number;
  url: string;
}

export function readLockfile(): LockfileData | null {
  try {
    if (!existsSync(LOCKFILE_PATH)) return null;

    const data = JSON.parse(readFileSync(LOCKFILE_PATH, "utf-8")) as LockfileData;

    // Check if process is still running
    try {
      process.kill(data.pid, 0);
      return data;
    } catch {
      // Process not running, clean up stale lockfile
      unlinkSync(LOCKFILE_PATH);
      return null;
    }
  } catch {
    return null;
  }
}

export function writeLockfile(data: LockfileData): void {
  writeFileSync(LOCKFILE_PATH, JSON.stringify(data));
}

export function removeLockfile(): void {
  try {
    unlinkSync(LOCKFILE_PATH);
  } catch {
    // Ignore errors
  }
}
