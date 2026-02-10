interface PendingRequest<T = unknown> {
  requestId: string;
  boardId: string;
  resolve: (result: T) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
  createdAt: number;
}

const pendingRequests = new Map<string, PendingRequest<unknown>>();

const REQUEST_TIMEOUT_MS = 10000; // 10 seconds

export function createPendingRequest<T = unknown>(
  requestId: string,
  boardId: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
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

  clearTimeout(pending.timeout);
  pendingRequests.delete(requestId);

  if (error || result === null) {
    pending.reject(new Error(error || "UNKNOWN_ERROR"));
  } else {
    pending.resolve(result);
  }

  return true;
}
