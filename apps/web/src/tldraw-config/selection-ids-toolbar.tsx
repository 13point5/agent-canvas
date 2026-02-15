import { useCallback } from "react";
import {
  Box,
  type TLShapeId,
  TldrawUiButtonIcon,
  TldrawUiContextualToolbar,
  TldrawUiToolbarButton,
  useEditor,
  useToasts,
  useValue,
} from "tldraw";

function SelectionIdsToolbarInner({ selectedShapeIds }: { selectedShapeIds: TLShapeId[] }) {
  const editor = useEditor();
  const { addToast } = useToasts();

  const getSelectionBounds = useCallback(() => {
    const fullBounds = editor.getSelectionScreenBounds();
    if (!fullBounds) return undefined;

    return new Box(fullBounds.x, fullBounds.y, fullBounds.width, 0);
  }, [editor]);

  const handleCopyShapeIds = useCallback(async () => {
    const shapeIds = JSON.stringify(selectedShapeIds);

    try {
      await navigator.clipboard.writeText(shapeIds);
      addToast({
        title: "Copied shape IDs",
        description: `${selectedShapeIds.length} shape IDs copied to clipboard.`,
        severity: "success",
      });
    } catch {
      addToast({
        title: "Could not copy shape IDs",
        description: "Clipboard access is unavailable in this browser context.",
        severity: "error",
      });
    }
  }, [addToast, selectedShapeIds]);

  return (
    <TldrawUiContextualToolbar getSelectionBounds={getSelectionBounds} label="Selection tools">
      <TldrawUiToolbarButton
        type="menu"
        title="Copy selected shape IDs"
        data-testid="tool.selection-copy-shape-ids"
        onClick={() => {
          void handleCopyShapeIds();
        }}
      >
        <TldrawUiButtonIcon small icon="clipboard-copy" />
        <span>Copy IDs</span>
      </TldrawUiToolbarButton>
    </TldrawUiContextualToolbar>
  );
}

export function SelectionIdsToolbar() {
  const editor = useEditor();

  const selectedShapeIds = useValue("selected shape ids", () => editor.getSelectedShapeIds(), [editor]);
  const showToolbar = useValue(
    "show selection ids toolbar",
    () => editor.isInAny("select.idle", "select.pointing_shape"),
    [editor],
  );

  if (!showToolbar || selectedShapeIds.length < 2) return null;

  return <SelectionIdsToolbarInner selectedShapeIds={selectedShapeIds} />;
}
