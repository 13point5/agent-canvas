import { Copy01Icon, File01Icon, GitCompareIcon, PlusSignIcon, Remove01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useCallback, useMemo } from "react";
import { File, PatchDiff } from "@pierre/diffs/react";
import type { DiffLineAnnotation } from "@pierre/diffs/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface ReviewComment {
  id: string;
  side: "additions" | "deletions";
  lineNumber: number;
  text: string;
}

interface CodeReviewViewerProps {
  name: string;
  mode: "file" | "diff";
  fileName: string;
  fileContents: string;
  patch: string;
  comments: ReviewComment[];
  width: number;
  height: number;
  isEditing: boolean;
  onCommentsChange: (comments: ReviewComment[]) => void;
}

function buildPrompt({ name, mode, fileName, fileContents, patch, comments }: Omit<CodeReviewViewerProps, "width" | "height" | "isEditing" | "onCommentsChange">) {
  const sourceLabel = mode === "diff" ? "Diff" : `File (${fileName || "untitled"})`;
  const source = mode === "diff" ? patch : fileContents;
  const commentText = comments.length === 0
    ? "No comments provided."
    : comments
      .map((comment, index) => `${index + 1}. [${comment.side} line ${comment.lineNumber}] ${comment.text}`)
      .join("\n");

  return [
    `Review this ${sourceLabel.toLowerCase()} and address all comments.`,
    "",
    `Title: ${name || "Code review"}`,
    "",
    `${sourceLabel}:`,
    "```",
    source,
    "```",
    "",
    "Comments:",
    commentText,
  ].join("\n");
}

export function CodeReviewViewer(props: CodeReviewViewerProps) {
  const { name, mode, fileName, fileContents, patch, comments, width, height, isEditing, onCommentsChange } = props;

  const lineAnnotations = useMemo<DiffLineAnnotation<{ text: string }>[]>(() => {
    return comments
      .filter((comment) => comment.lineNumber > 0 && comment.text.trim().length > 0)
      .map((comment) => ({
        side: comment.side,
        lineNumber: comment.lineNumber,
        metadata: { text: comment.text.trim() },
      }));
  }, [comments]);

  const handleCopyPrompt = useCallback(async () => {
    const prompt = buildPrompt({ name, mode, fileName, fileContents, patch, comments });
    await navigator.clipboard.writeText(prompt);
  }, [comments, fileContents, fileName, mode, name, patch]);

  const updateComment = useCallback((id: string, updates: Partial<ReviewComment>) => {
    onCommentsChange(comments.map((comment) => (
      comment.id === id ? { ...comment, ...updates } : comment
    )));
  }, [comments, onCommentsChange]);

  const addComment = useCallback(() => {
    onCommentsChange([
      ...comments,
      {
        id: crypto.randomUUID(),
        side: "additions",
        lineNumber: 1,
        text: "",
      },
    ]);
  }, [comments, onCommentsChange]);

  const removeComment = useCallback((id: string) => {
    onCommentsChange(comments.filter((comment) => comment.id !== id));
  }, [comments, onCommentsChange]);

  const borderClass = isEditing ? "border border-chart-1" : "border border-border";

  return (
    <div
      className={`relative flex h-full flex-col overflow-hidden rounded-lg ${borderClass} bg-card shadow-sm ${isEditing ? "select-text cursor-auto" : ""}`}
      style={{ width, height }}
    >
      {!isEditing && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/0 opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
          <span className="rounded-md bg-foreground/80 px-3 py-1.5 text-xs font-medium text-background shadow-sm">
            Double-click to interact
          </span>
        </div>
      )}

      <div className="flex items-center justify-between border-b border-border bg-muted/50 px-3 py-1.5 shrink-0">
        <div className="flex items-center gap-2 truncate">
          <HugeiconsIcon icon={mode === "diff" ? GitCompareIcon : File01Icon} className="size-4 shrink-0" />
          <span className="text-sm font-medium truncate">{name || (mode === "diff" ? "Code Diff" : fileName || "Code File")}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => void handleCopyPrompt()}
            title="Copy as LLM prompt"
            className="text-muted-foreground"
          >
            <HugeiconsIcon icon={Copy01Icon} className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {mode === "diff" ? (
          <PatchDiff
            patch={patch}
            options={{
              diffStyle: "split",
              overflow: "scroll",
              expandUnchanged: true,
            }}
            lineAnnotations={lineAnnotations}
            renderAnnotation={(annotation) => (
              <div className="rounded-md border border-border bg-background px-2 py-1 text-xs">
                {annotation.metadata.text}
              </div>
            )}
          />
        ) : (
          <File
            file={{ name: fileName || "untitled.ts", contents: fileContents }}
            options={{
              overflow: "scroll",
            }}
          />
        )}
      </div>

      <div className="border-t border-border bg-muted/30 p-2">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Comments</span>
          {isEditing && (
            <Button variant="ghost" size="icon-xs" onClick={addComment} title="Add comment">
              <HugeiconsIcon icon={PlusSignIcon} className="size-3.5" />
            </Button>
          )}
        </div>

        <div className="max-h-40 space-y-2 overflow-auto">
          {comments.length === 0 && (
            <p className="text-xs text-muted-foreground">No comments yet.</p>
          )}

          {comments.map((comment) => (
            <div key={comment.id} className="rounded-md border border-border bg-background p-2">
              <div className="mb-1 flex items-center gap-1">
                {mode === "diff" ? (
                  <select
                    className="h-7 rounded-md border border-input bg-background px-2 text-xs"
                    value={comment.side}
                    onChange={(event) => updateComment(comment.id, { side: event.target.value as ReviewComment["side"] })}
                    disabled={!isEditing}
                  >
                    <option value="additions">additions</option>
                    <option value="deletions">deletions</option>
                  </select>
                ) : (
                  <span className="rounded bg-muted px-2 py-1 text-xs">file</span>
                )}
                <Input
                  type="number"
                  min={1}
                  value={comment.lineNumber}
                  onChange={(event) => updateComment(comment.id, { lineNumber: Number(event.target.value) || 1 })}
                  className="h-7 w-20 text-xs"
                  disabled={!isEditing}
                />
                {isEditing && (
                  <Button variant="ghost" size="icon-xs" onClick={() => removeComment(comment.id)}>
                    <HugeiconsIcon icon={Remove01Icon} className="size-3.5" />
                  </Button>
                )}
              </div>
              <Input
                value={comment.text}
                onChange={(event) => updateComment(comment.id, { text: event.target.value })}
                placeholder="Comment"
                className="h-8 text-xs"
                disabled={!isEditing}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
