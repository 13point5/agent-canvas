import {
  Cancel01Icon,
  File01Icon,
  FileUploadIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor } from "tldraw";

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
import { setOpenHtmlDialog } from "@/tldraw-config/html-overrides";

/**
 * Rendered via tldraw's `components.InFrontOfTheCanvas` so it lives
 * inside the <Tldraw> tree and has access to `useEditor()`.
 */
export function HtmlDialogOverlay() {
  const editor = useEditor();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [html, setHtml] = useState("");
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setOpenHtmlDialog(() => setOpen(true));
    return () => {
      setOpenHtmlDialog(null);
    };
  }, []);

  const reset = useCallback(() => {
    setName("");
    setHtml("");
    setFileContent(null);
    setFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setFileName(file.name);
      setName(file.name.replace(/\.(html?|svg)$/i, ""));
      const reader = new FileReader();
      reader.onload = () => {
        setFileContent(reader.result as string);
      };
      reader.readAsText(file);
    },
    [],
  );

  const resolvedHtml = fileContent ?? html;

  const handleCreate = useCallback(() => {
    if (!resolvedHtml.trim()) return;
    const center = editor.getViewportPageBounds().center;
    editor.createShape({
      type: "html",
      x: center.x,
      y: center.y,
      props: { name, html: resolvedHtml, filePath: "" },
    });
    setOpen(false);
    reset();
  }, [editor, name, resolvedHtml, reset]);

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
          <DialogTitle>Insert HTML Artifact</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {fileName ? (
            <div className="flex w-full items-center gap-3 rounded-lg border border-input bg-input/30 px-3 py-3">
              <HugeiconsIcon
                icon={File01Icon}
                className="size-5 shrink-0 text-muted-foreground"
              />
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
              <HugeiconsIcon
                icon={FileUploadIcon}
                className="size-5 shrink-0"
              />
              <span>Upload .html file</span>
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".html,.htm,.svg"
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
                <Label htmlFor="html-name">Name</Label>
                <Input
                  id="html-name"
                  type="text"
                  placeholder="Optional"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={!!fileName}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="html-content">HTML</Label>
                <Textarea
                  id="html-content"
                  placeholder="Paste your HTML here..."
                  value={html}
                  onChange={(e) => setHtml(e.target.value)}
                  rows={12}
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
          <Button onClick={handleCreate} disabled={!resolvedHtml.trim()}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
