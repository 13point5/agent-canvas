import type { Editor, TLStoreSnapshot } from "tldraw";
import { loadSnapshot } from "tldraw";

const DEFAULT_TERMINAL_WIDTH = 680;
const DEFAULT_TERMINAL_HEIGHT = 420;

type MutableSnapshot = TLStoreSnapshot & {
  document?: {
    store?: Record<string, unknown>;
    schema?: {
      sequences?: Record<string, number>;
    };
  };
};

function patchTerminalShapes(snapshot: TLStoreSnapshot): TLStoreSnapshot {
  const next = structuredClone(snapshot) as MutableSnapshot;
  const store = next.document?.store;

  if (!store) {
    return next as TLStoreSnapshot;
  }

  for (const record of Object.values(store)) {
    if (!record || typeof record !== "object") {
      continue;
    }

    const shapeRecord = record as {
      type?: string;
      props?: { w?: unknown; h?: unknown; name?: unknown };
    };

    if (shapeRecord.type !== "terminal") {
      continue;
    }

    const props = shapeRecord.props ?? {};
    const w = typeof props.w === "number" && Number.isFinite(props.w) ? props.w : DEFAULT_TERMINAL_WIDTH;
    const h = typeof props.h === "number" && Number.isFinite(props.h) ? props.h : DEFAULT_TERMINAL_HEIGHT;
    const name = typeof props.name === "string" ? props.name : "Shell";

    shapeRecord.props = { ...props, w, h, name };
  }

  if (next.document?.schema?.sequences) {
    const terminalSequence = next.document.schema.sequences["com.tldraw.shape.terminal"];
    if (typeof terminalSequence !== "number") {
      next.document.schema.sequences["com.tldraw.shape.terminal"] = 2;
    }
  }

  return next as TLStoreSnapshot;
}

export function loadSnapshotSafely(editor: Editor, snapshot: TLStoreSnapshot, label: string): void {
  try {
    loadSnapshot(editor.store, snapshot);
  } catch (initialError) {
    try {
      const patchedSnapshot = patchTerminalShapes(snapshot);
      loadSnapshot(editor.store, patchedSnapshot);
    } catch (patchedError) {
      console.error(`[snapshot] Failed to load snapshot for ${label}`, {
        initialError,
        patchedError,
      });
    }
  }
}
