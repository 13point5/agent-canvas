import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, realpathSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

export const LEGACY_LOCKFILE_PATH = join(tmpdir(), "agent-canvas.lock");
// Backward-compatible alias for external imports.
export const LOCKFILE_PATH = LEGACY_LOCKFILE_PATH;
export const LOCKFILE_DIR = join(tmpdir(), "agent-canvas");
export const DEFAULT_INSTANCE_ID = "global";
export const INSTANCE_ENV_VAR = "AGENT_CANVAS_INSTANCE";

export interface LockfileData {
  pid: number;
  port: number;
  url: string;
  instanceId?: string;
  cwd?: string;
  startedAt?: string;
}

function hash(input: string): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 12);
}

function sanitizeInstanceId(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function safeRealpath(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    return resolve(path);
  }
}

function findGitRoot(startDir: string): string | null {
  let current = safeRealpath(startDir);

  while (true) {
    if (existsSync(join(current, ".git"))) {
      return current;
    }

    const parent = dirname(current);
    if (parent === current) {
      return null;
    }

    current = parent;
  }
}

export function getInstanceId(cwd = process.cwd()): string {
  const envInstance = process.env[INSTANCE_ENV_VAR];
  if (envInstance) {
    const sanitized = sanitizeInstanceId(envInstance);
    return sanitized || DEFAULT_INSTANCE_ID;
  }

  const gitRoot = findGitRoot(cwd);
  if (!gitRoot) {
    return DEFAULT_INSTANCE_ID;
  }

  return `repo-${hash(safeRealpath(gitRoot))}`;
}

export function getLockfilePath(instanceId = getInstanceId()): string {
  return join(LOCKFILE_DIR, `${sanitizeInstanceId(instanceId) || DEFAULT_INSTANCE_ID}.lock`);
}

function readLockfileAt(path: string): LockfileData | null {
  try {
    if (!existsSync(path)) return null;

    const data = JSON.parse(readFileSync(path, "utf-8")) as LockfileData;
    if (!data || typeof data.pid !== "number" || typeof data.port !== "number" || typeof data.url !== "string") {
      unlinkSync(path);
      return null;
    }

    // Check if process is still running
    try {
      process.kill(data.pid, 0);
      return data;
    } catch {
      // Process not running, clean up stale lockfile
      unlinkSync(path);
      return null;
    }
  } catch {
    return null;
  }
}

export function readLockfile(instanceId = getInstanceId()): LockfileData | null {
  const data = readLockfileAt(getLockfilePath(instanceId));
  if (data) {
    return data;
  }

  // Backward compatibility for pre-instance lockfiles.
  if (instanceId === DEFAULT_INSTANCE_ID) {
    return readLockfileAt(LEGACY_LOCKFILE_PATH);
  }

  return null;
}

export function writeLockfile(data: LockfileData, instanceId = getInstanceId()): void {
  mkdirSync(LOCKFILE_DIR, { recursive: true });
  writeFileSync(
    getLockfilePath(instanceId),
    JSON.stringify({
      ...data,
      instanceId,
      cwd: process.cwd(),
      startedAt: new Date().toISOString(),
    }),
  );
}

export function removeLockfile(instanceId = getInstanceId()): void {
  try {
    unlinkSync(getLockfilePath(instanceId));
  } catch {
    // Ignore errors
  }

  if (instanceId === DEFAULT_INSTANCE_ID) {
    try {
      unlinkSync(LEGACY_LOCKFILE_PATH);
    } catch {
      // Ignore errors
    }
  }
}
