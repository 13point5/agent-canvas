import { AtIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useCallback } from "react";
import { Box, type TLShapeId, TldrawUiContextualToolbar, useEditor, useToasts, useValue } from "tldraw";

import { Button } from "@/components/ui/button";

function SelectionIdsToolbarInner({ selectedShapeIds }: { selectedShapeIds: TLShapeId[] }) {
  const editor = useEditor();
  const { addToast } = useToasts();

  const getSelectionBounds = useCallback(() => {
    const pageBounds = editor.getSelectionPageBounds();
    if (!pageBounds) return undefined;

    const topLeft = editor.pageToScreen({ x: pageBounds.x, y: pageBounds.y });
    const bottomRight = editor.pageToScreen({
      x: pageBounds.maxX,
      y: pageBounds.maxY,
    });

    return new Box(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, 0);
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
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Copy selected shape IDs"
        title="Copy selected shape IDs"
        data-testid="tool.selection-copy-shape-ids"
        onClick={() => {
          void handleCopyShapeIds();
        }}
      >
        <HugeiconsIcon icon={AtIcon} strokeWidth={2} className="size-4" />
      </Button>
    </TldrawUiContextualToolbar>
  );
}

export function SelectionIdsToolbar() {
  const editor = useEditor();

  const selectedShapeIds = useValue("selected shape ids", () => editor.getSelectedShapeIds(), [editor]);

  if (selectedShapeIds.length < 1) return null;

  return <SelectionIdsToolbarInner selectedShapeIds={selectedShapeIds} />;
}
