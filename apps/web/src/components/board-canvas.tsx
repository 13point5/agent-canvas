import { useSync } from "@tldraw/sync";
import { useMemo } from "react";
import {
  type TLAssetStore,
  Tldraw,
  defaultBindingUtils,
  defaultShapeUtils,
} from "tldraw";
import { MarkdownShapeUtil } from "@/tldraw-shapes/markdown";
import { markdownOverrides } from "@/tldraw-config/markdown-overrides";
import {
  CustomToolbar,
  MarkdownDialogOverlay,
} from "@/tldraw-config/markdown-toolbar";

const customShapeUtils = [MarkdownShapeUtil];

// Asset store for images/videos — uses existing board assets API
const assetStore: TLAssetStore = {
  async upload(_asset, file) {
    // For now, return a data URL as a simple fallback
    // TODO: integrate with board-specific asset storage
    const reader = new FileReader();
    return new Promise((resolve) => {
      reader.onload = () => resolve({ src: reader.result as string });
      reader.readAsDataURL(file);
    });
  },
  resolve(asset) {
    return asset.props.src;
  },
};

interface BoardCanvasProps {
  boardId: string;
}

function getSyncUri(boardId: string): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws/sync/${boardId}`;
}

export function BoardCanvas({ boardId }: BoardCanvasProps) {
  // All shape utils: defaults + our custom markdown shape
  const allShapeUtils = useMemo(
    () => [...defaultShapeUtils, ...customShapeUtils],
    [],
  );

  const allBindingUtils = useMemo(() => [...defaultBindingUtils], []);

  // Connect to the tldraw sync server for this board
  const store = useSync({
    uri: getSyncUri(boardId),
    assets: assetStore,
    shapeUtils: allShapeUtils,
    bindingUtils: allBindingUtils,
  });

  return (
    <div className="h-full w-full" key={boardId}>
      <Tldraw
        store={store}
        shapeUtils={customShapeUtils}
        overrides={markdownOverrides}
        components={{
          Toolbar: CustomToolbar,
          InFrontOfTheCanvas: MarkdownDialogOverlay,
        }}
      />
    </div>
  );
}
