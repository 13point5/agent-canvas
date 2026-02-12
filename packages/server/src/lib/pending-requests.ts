import { getClientCount } from "./ws";

interface PendingRequest<T = unknown> {
  requestId: string;
  boardId: string;
  resolve: (result: T) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
  createdAt: number;
  /** When multiple clients are connected, we defer the first error to give other clients a chance to succeed. */
  errorGraceTimeout?: ReturnType<typeof setTimeout>;
  firstError?: string;
}

const pendingRequests = new Map<string, PendingRequest<unknown>>();

const REQUEST_TIMEOUT_MS = 10000; // 10 seconds
const ERROR_GRACE_MS = 2000; // Wait up to 2s for a success after first error

export function createPendingRequest<T = unknown>(
  requestId: string,
  boardId: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      const pending = pendingRequests.get(requestId);
      if (pending?.errorGraceTimeout) clearTimeout(pending.errorGraceTimeout);
      pendingRequests.delete(requestId);
      reject(new Error("TIMEOUT"));
    }, REQUEST_TIMEOUT_MS);

    pendingRequests.set(requestId, {
      requestId,
      boardId,
      resolve: resolve as (result: unknown) => void,
      reject,
      timeout,
      createdAt: Date.now(),
    });
  });
}

export function resolvePendingRequest<T = unknown>(
  requestId: string,
  result: T | null,
  error?: string,
): boolean {
  const pending = pendingRequests.get(requestId);
  if (!pending) {
    return false;
  }

  // Success — resolve immediately
  if (!error && result !== null) {
    if (pending.errorGraceTimeout) clearTimeout(pending.errorGraceTimeout);
    clearTimeout(pending.timeout);
    pendingRequests.delete(requestId);
    pending.resolve(result);
    return true;
  }

  // Error — if multiple clients are connected, defer rejection to give others a chance
  const errorMsg = error || "UNKNOWN_ERROR";

  if (getClientCount() > 1 && !pending.firstError) {
    pending.firstError = errorMsg;
    pending.errorGraceTimeout = setTimeout(() => {
      // Grace period expired with no success — reject with the error
      clearTimeout(pending.timeout);
      pendingRequests.delete(requestId);
      pending.reject(new Error(errorMsg));
    }, ERROR_GRACE_MS);
    return true;
  }

  // Single client, or already deferred once — reject now
  if (pending.errorGraceTimeout) clearTimeout(pending.errorGraceTimeout);
  clearTimeout(pending.timeout);
  pendingRequests.delete(requestId);
  pending.reject(new Error(errorMsg));
  return true;
}
