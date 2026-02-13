import { AtIcon, Cancel01Icon, File01Icon, FileUploadIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  DefaultToolbar,
  DefaultToolbarContent,
  ToolbarItem,
  useEditor,
  useValue,
  type TLShapeId,
} from "tldraw";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useChatComposerStore } from "@/stores/chat-composer-store";
import { setOpenMarkdownDialog } from "@/tldraw-config/markdown-overrides";

/**
 * Rendered via tldraw's `components.InFrontOfTheCanvas` so it lives
 * inside the <Tldraw> tree and has access to `useEditor()`.
 */
export function MarkdownDialogOverlay() {
  const editor = useEditor();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setOpenMarkdownDialog(() => setOpen(true));
    return () => {
      setOpenMarkdownDialog(null);
    };
  }, []);

  const reset = useCallback(() => {
    setName("");
    setMarkdown("");
    setFileContent(null);
    setFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setName(file.name.replace(/\.(md|markdown|txt)$/i, ""));
    const reader = new FileReader();
    reader.onload = () => {
      setFileContent(reader.result as string);
    };
    reader.readAsText(file);
  }, []);

  const resolvedMarkdown = fileContent ?? markdown;

  const handleCreate = useCallback(() => {
    if (!resolvedMarkdown.trim()) return;
    const center = editor.getViewportPageBounds().center;
    const w = 1200;
    const h = 800;
    editor.createShape({
      type: "visual-markdown",
      x: center.x - w / 2,
      y: center.y - h / 2,
      props: { w, h, name, markdown: resolvedMarkdown },
    });
    setOpen(false);
    reset();
  }, [editor, name, resolvedMarkdown, reset]);

  const handleOpenChange = useCallback(
    (value: boolean) => {
      setOpen(value);
      if (!value) reset();
    },
    [reset],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Insert Markdown</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {fileName ? (
            <div className="flex w-full items-center gap-3 rounded-lg border border-input bg-input/30 px-3 py-3">
              <HugeiconsIcon icon={File01Icon} className="size-5 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate text-sm">{fileName}</span>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => {
                  setFileName(null);
                  setFileContent(null);
                  setName("");
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              >
                <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full items-center gap-3 rounded-lg border-2 border-dashed border-input px-3 py-3 text-sm text-muted-foreground transition-colors hover:border-ring hover:text-foreground cursor-pointer"
            >
              <HugeiconsIcon icon={FileUploadIcon} className="size-5 shrink-0" />
              <span>Upload .md file</span>
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,.markdown,.txt"
            onChange={handleFileChange}
            className="hidden"
          />

          <div className={fileName ? "opacity-50 pointer-events-none" : ""}>
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">or</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="md-name">Name</Label>
                <Input
                  id="md-name"
                  type="text"
                  placeholder="Optional"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={!!fileName}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="md-content">Markdown</Label>
                <Textarea
                  id="md-content"
                  placeholder="Paste your markdown here..."
                  value={markdown}
                  onChange={(e) => setMarkdown(e.target.value)}
                  rows={8}
                  className="font-mono resize-y"
                  disabled={!!fileName}
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!resolvedMarkdown.trim()}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CustomToolbar() {
  return (
    <DefaultToolbar>
      <DefaultToolbarContent />
      <ToolbarItem tool="markdown" />
    </DefaultToolbar>
  );
}

export function SelectionMentionToolbar() {
  const editor = useEditor();
  const pushMention = useChatComposerStore((state) => state.pushMention);

  const selected = useValue(
    "selection-shapes",
    () => {
      const ids = editor.getSelectedShapeIds();
      const bounds = editor.getSelectionPageBounds();
      return {
        ids,
        bounds,
      };
    },
    [editor],
  );

  if (!selected.bounds || selected.ids.length === 0) return null;

  const viewportBounds = editor.getViewportPageBounds();
  const top = selected.bounds.minY - viewportBounds.minY - 42;
  const left = selected.bounds.midX - viewportBounds.minX;

  const pushSelectedShapes = () => {
    selected.ids.forEach((shapeId: TLShapeId) => {
      const shape = editor.getShape(shapeId);
      const label =
        shape?.type === "visual-markdown" ? shape.props.name || "markdown" : shape?.type || "shape";
      pushMention({
        id: `shape:${shapeId}`,
        type: "shape",
        label,
        ref: shapeId,
      });
    });
  };

  return (
    <div
      className="pointer-events-auto absolute z-40"
      style={{ left, top, transform: "translateX(-50%)" }}
    >
      <Button type="button" size="sm" variant="secondary" onClick={pushSelectedShapes}>
        <HugeiconsIcon icon={AtIcon} className="mr-1 size-4" />
        Mention shape{selected.ids.length > 1 ? "s" : ""}
      </Button>
    </div>
  );
}
