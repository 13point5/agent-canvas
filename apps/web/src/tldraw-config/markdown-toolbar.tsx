import { Cancel01Icon, File01Icon, FileUploadIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { DefaultToolbar, DefaultToolbarContent, ToolbarItem, useEditor } from "tldraw";

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
import { setOpenDbSchemaDialog, setOpenMarkdownDialog } from "@/tldraw-config/markdown-overrides";

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

export function DbSchemaDialogOverlay() {
  const editor = useEditor();
  const [open, setOpen] = useState(false);
  const [tableName, setTableName] = useState("users");
  const [columns, setColumns] = useState(
    "id: uuid #primary key\nemail: varchar(255) #unique login\nrole: varchar(50) #authorization role",
  );

  useEffect(() => {
    setOpenDbSchemaDialog(() => setOpen(true));
    return () => {
      setOpenDbSchemaDialog(null);
    };
  }, []);

  const handleCreate = useCallback(() => {
    if (!tableName.trim()) return;

    const center = editor.getViewportPageBounds().center;
    const columnCount = columns
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean).length;

    const w = 560;
    const h = Math.max(220, 44 + columnCount * 30);

    editor.createShape({
      type: "db-schema",
      x: center.x - w / 2,
      y: center.y - h / 2,
      props: {
        w,
        h,
        tableName: tableName.trim(),
        columns,
      },
    });

    setOpen(false);
  }, [columns, editor, tableName]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Insert DB Schema Table</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="schema-name">Table Name</Label>
            <Input
              id="schema-name"
              type="text"
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              placeholder="users"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="schema-columns">Columns</Label>
            <Textarea
              id="schema-columns"
              rows={10}
              value={columns}
              onChange={(e) => setColumns(e.target.value)}
              className="font-mono resize-y"
              placeholder="one column per line: column_name: type #comment"
            />
            <p className="text-xs text-muted-foreground">
              Format each line as <code>column_name: column_type #comment</code>. Crow&apos;s foot
              connectors can snap to per-column handles on left/right sides.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!tableName.trim()}>
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
      <ToolbarItem tool="dbSchema" />
    </DefaultToolbar>
  );
}
