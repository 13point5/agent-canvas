import { Markdown as MarkdownIcon } from "@react-symbols/icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Group, Panel, Separator } from "react-resizable-panels";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { parseMarkdown } from "@/lib/parse-markdown";
import type { MarkdownComment, MarkdownTextCommentTarget } from "@/tldraw-shapes/markdown/markdown-shape-props";
import { DiagramsPanel } from "./diagrams-panel";
import { MarkdownPanel } from "./markdown-panel";

interface MarkdownViewerProps {
  name: string;
  content: string;
  filePath: string;
  comments: MarkdownComment[];
  width: number;
  height: number;
  isEditing: boolean;
  onCommentsChange: (nextComments: MarkdownComment[]) => void;
}

type TextSelectionAnchor = {
  start: number;
  end: number;
  quote: string;
  prefix?: string;
  suffix?: string;
};

type PositionedComment = {
  key: string;
  top: number;
  slot: number;
  comment: MarkdownComment;
};

type HighlightRect = {
  key: string;
  top: number;
  left: number;
  width: number;
  height: number;
  tone: "comment" | "draft";
};

const COMMENT_CARD_MIN_WIDTH = 220;
const COMMENT_ICON_SIZE = 26;
const COMMENT_ICON_ROW_GAP = 3;
const COMMENT_ICON_STACK_GAP = 8;
const COMMENT_CARD_STACK_GAP = 6;
const COMMENT_SELECTION_BUTTON_SIZE = 36;
const COMMENT_BUTTON_TO_ICON_GAP = 2;
const COMMENT_LINE_GROUP_TOLERANCE = 12;
const SELECTION_CONTEXT_CHARS = 24;

export function MarkdownViewer({
  name,
  content,
  filePath,
  comments,
  width,
  height,
  isEditing,
  onCommentsChange,
}: MarkdownViewerProps) {
  const parsed = useMemo(() => parseMarkdown(content), [content]);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pinnedDiagramIds, setPinnedDiagramIds] = useState<string[]>([]);
  const [pinnedImageSources, setPinnedImageSources] = useState<string[]>([]);
  const [showSidePanel, setShowSidePanel] = useState(false);

  const [pendingSelection, setPendingSelection] = useState<TextSelectionAnchor | null>(null);
  const [composerAnchor, setComposerAnchor] = useState<TextSelectionAnchor | null>(null);
  const [commentBody, setCommentBody] = useState("");
  const [expandedCommentId, setExpandedCommentId] = useState<string | null>(null);

  const [scrollContainerEl, setScrollContainerEl] = useState<HTMLDivElement | null>(null);
  const [contentRootEl, setContentRootEl] = useState<HTMLDivElement | null>(null);
  const [viewportWidth, setViewportWidth] = useState(0);

  const commentInputRef = useRef<HTMLTextAreaElement | null>(null);

  const applyComments = useCallback(
    (updater: (current: MarkdownComment[]) => MarkdownComment[]) => {
      onCommentsChange(updater(comments));
    },
    [comments, onCommentsChange],
  );

  const handleToggleCommentResolved = useCallback(
    (commentId: string, resolved: boolean) => {
      applyComments((current) =>
        current.map((comment) => {
          if (comment.id !== commentId) return comment;
          return {
            ...comment,
            resolvedAt: resolved ? new Date().toISOString() : null,
          };
        }),
      );
    },
    [applyComments],
  );

  const clearNativeSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection) return;
    if (selection.rangeCount === 0 || selection.isCollapsed) return;
    selection.removeAllRanges();
  }, []);

  const handleOpenComposer = useCallback(() => {
    if (!pendingSelection) return;
    setComposerAnchor(pendingSelection);
    setPendingSelection(null);
    setCommentBody("");
    setExpandedCommentId(null);

    // Clear browser selection once we have captured the anchor.
    requestAnimationFrame(() => {
      clearNativeSelection();
    });
  }, [clearNativeSelection, pendingSelection]);

  const handleCancelComposer = useCallback(() => {
    setComposerAnchor(null);
    setCommentBody("");
  }, []);

  const canSubmitComment = composerAnchor !== null && commentBody.trim().length > 0;

  const handleSubmitComment = useCallback(() => {
    if (!composerAnchor) return;

    const body = commentBody.trim();
    if (!body) return;

    applyComments((current) => [
      ...current,
      {
        id: makeCommentId(),
        target: {
          type: "text",
          start: composerAnchor.start,
          end: composerAnchor.end,
          quote: composerAnchor.quote,
          prefix: composerAnchor.prefix,
          suffix: composerAnchor.suffix,
        },
        body,
        author: { type: "user" },
        createdAt: new Date().toISOString(),
        resolvedAt: null,
      },
    ]);

    setComposerAnchor(null);
    setCommentBody("");
  }, [applyComments, commentBody, composerAnchor]);

  const handleComposerKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        if (canSubmitComment) {
          handleSubmitComment();
        }
      }
    },
    [canSubmitComment, handleSubmitComment],
  );

  const handleScrollContainerChange = useCallback((node: HTMLDivElement | null) => {
    setScrollContainerEl(node);
  }, []);

  const handleContentRootChange = useCallback((node: HTMLDivElement | null) => {
    setContentRootEl(node);
  }, []);

  const handlePinDiagram = useCallback((id: string) => {
    setPinnedDiagramIds((prev) => {
      if (prev.includes(id)) return prev;
      return [...prev, id];
    });
    setShowSidePanel(true);
  }, []);

  const handlePinImage = useCallback((src: string) => {
    setPinnedImageSources((prev) => {
      if (prev.includes(src)) return prev;
      return [...prev, src];
    });
    setShowSidePanel(true);
  }, []);

  const handleUnpinDiagram = useCallback((id: string) => {
    setPinnedDiagramIds((prev) => prev.filter((value) => value !== id));
  }, []);

  const handleUnpinImage = useCallback((src: string) => {
    setPinnedImageSources((prev) => prev.filter((value) => value !== src));
  }, []);

  const openTextComments = useMemo(
    () =>
      comments.filter(
        (comment): comment is MarkdownComment & { target: MarkdownTextCommentTarget } =>
          comment.resolvedAt === null && comment.target.type === "text",
      ),
    [comments],
  );

  useEffect(() => {
    if (!composerAnchor) return;
    commentInputRef.current?.focus();
  }, [composerAnchor]);

  useEffect(() => {
    if (pinnedDiagramIds.length > 0 || pinnedImageSources.length > 0) return;
    setShowSidePanel(false);
  }, [pinnedDiagramIds, pinnedImageSources]);

  // Capture text selections only after selection interaction completes.
  // Updating state on every `selectionchange` can re-render mid-drag and corrupt range start/end.
  useEffect(() => {
    if (!isEditing || !contentRootEl) return;

    const syncSelection = () => {
      const nextSelection = getSelectionAnchor(contentRootEl);
      if (nextSelection) {
        setPendingSelection(nextSelection);
        setComposerAnchor(null);
        setCommentBody("");
      } else {
        setPendingSelection(null);
      }
    };

    const handleMouseUp = (event: MouseEvent) => {
      requestAnimationFrame(() => {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
          syncSelection();
          return;
        }

        const clickedCommentId = findCommentIdAtPoint(contentRootEl, event.clientX, event.clientY, openTextComments);
        if (clickedCommentId) {
          setExpandedCommentId(clickedCommentId);
          setPendingSelection(null);
          return;
        }

        syncSelection();
      });
    };

    const handlePointerDown = () => {
      setPendingSelection(null);
    };

    const handleKeyUp = () => {
      requestAnimationFrame(syncSelection);
    };

    contentRootEl.addEventListener("mouseup", handleMouseUp);
    contentRootEl.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keyup", handleKeyUp);

    return () => {
      contentRootEl.removeEventListener("mouseup", handleMouseUp);
      contentRootEl.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keyup", handleKeyUp);
    };
  }, [contentRootEl, isEditing, openTextComments]);

  // Keep floating UI aligned as panel/content width changes.
  useEffect(() => {
    if (!scrollContainerEl) return;

    const updateViewportWidth = () => {
      const nextWidth = scrollContainerEl.clientWidth;
      setViewportWidth((prev) => (prev === nextWidth ? prev : nextWidth));
    };

    updateViewportWidth();

    const observer = new ResizeObserver(updateViewportWidth);
    observer.observe(scrollContainerEl);
    if (contentRootEl) {
      observer.observe(contentRootEl);
    }

    return () => {
      observer.disconnect();
    };
  }, [contentRootEl, scrollContainerEl]);

  // Escape key to exit fullscreen.
  useEffect(() => {
    if (!isFullscreen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setIsFullscreen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isFullscreen]);

  // Ensure Cmd/Ctrl+C copies selected markdown text (not the shape) while editing.
  useEffect(() => {
    if (!isEditing || !contentRootEl) return;

    const getCopyText = () =>
      getSelectedTextWithin(contentRootEl) || getAnchorTextWithin(contentRootEl, composerAnchor ?? pendingSelection);

    const handleCopyShortcut = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
      if (event.key.toLowerCase() !== "c") return;
      if (isTextInputTarget(event.target)) return;

      const copyText = getCopyText();
      if (!copyText) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      void writeTextToClipboard(copyText);
    };

    const handleCopyEvent = (event: ClipboardEvent) => {
      if (isTextInputTarget(event.target)) return;

      const copyText = getCopyText();
      if (!copyText) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      if (event.clipboardData) {
        event.clipboardData.setData("text/plain", copyText);
      } else {
        void writeTextToClipboard(copyText);
      }
    };

    window.addEventListener("keydown", handleCopyShortcut, true);
    document.addEventListener("copy", handleCopyEvent, true);
    return () => {
      window.removeEventListener("keydown", handleCopyShortcut, true);
      document.removeEventListener("copy", handleCopyEvent, true);
    };
  }, [composerAnchor, contentRootEl, isEditing, pendingSelection]);

  useEffect(() => {
    if (!expandedCommentId) return;
    if (openTextComments.some((comment) => comment.id === expandedCommentId)) return;
    setExpandedCommentId(null);
  }, [expandedCommentId, openTextComments]);

  const effectiveViewportWidth = viewportWidth || scrollContainerEl?.clientWidth || 0;

  const highlightRects = useMemo<HighlightRect[]>(() => {
    if (!contentRootEl || !scrollContainerEl || effectiveViewportWidth <= 0) return [];

    const next: HighlightRect[] = [];

    for (const comment of openTextComments) {
      const range = resolveTextAnchorRange(comment.target, contentRootEl);
      if (!range) continue;

      for (const [rectIndex, rect] of getRangeRectsInScrollContainer(range, scrollContainerEl).entries()) {
        next.push({
          key: `comment-${comment.id}-${rectIndex}`,
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          tone: "comment",
        });
      }
    }

    const draft = composerAnchor ?? pendingSelection;
    if (draft) {
      const range = resolveTextAnchorRange(draft, contentRootEl);
      if (range) {
        for (const [rectIndex, rect] of getRangeRectsInScrollContainer(range, scrollContainerEl).entries()) {
          next.push({
            key: `draft-${rectIndex}`,
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            tone: "draft",
          });
        }
      }
    }

    return next;
  }, [composerAnchor, contentRootEl, effectiveViewportWidth, openTextComments, pendingSelection, scrollContainerEl]);

  const marginLane = useMemo(() => {
    if (!contentRootEl) {
      return {
        left: 12,
        width: 260,
        compact: false,
        iconLeft: 12,
      };
    }

    const contentRight = contentRootEl.offsetLeft + contentRootEl.offsetWidth;
    const preferredLeft = contentRight + 12;
    const preferredWidth = clamp(Math.round(effectiveViewportWidth * 0.3), COMMENT_CARD_MIN_WIDTH, 320);
    const laneMinWidth = 170;
    const viewportRight = Math.max(12, effectiveViewportWidth - 8);
    const availableRightWidth = viewportRight - preferredLeft;
    const compact = availableRightWidth < COMMENT_CARD_MIN_WIDTH;

    let left = preferredLeft;
    let width = Math.min(preferredWidth, Math.max(laneMinWidth, viewportRight - preferredLeft));

    if (left + width > viewportRight) {
      left = Math.max(8, viewportRight - width);
    }

    if (width < laneMinWidth) {
      width = laneMinWidth;
      left = Math.max(8, viewportRight - width);
    }

    const iconLeft = clamp(
      effectiveViewportWidth - COMMENT_ICON_SIZE - 10,
      contentRight + 4,
      Math.max(8, effectiveViewportWidth - COMMENT_ICON_SIZE - 6),
    );

    return {
      left,
      width,
      compact,
      iconLeft,
    };
  }, [contentRootEl, effectiveViewportWidth]);

  const selectionButtonTop = useMemo(() => {
    if (!pendingSelection || !contentRootEl || !scrollContainerEl || effectiveViewportWidth <= 0) return null;

    const range = resolveTextAnchorRange(pendingSelection, contentRootEl);
    if (!range) return null;

    const rawTop = getRangeTopInScrollContainer(range, scrollContainerEl);
    return Math.max(0, rawTop - 12);
  }, [contentRootEl, effectiveViewportWidth, pendingSelection, scrollContainerEl]);

  const composerTop = useMemo(() => {
    if (!composerAnchor || !contentRootEl || !scrollContainerEl || effectiveViewportWidth <= 0) return null;

    const range = resolveTextAnchorRange(composerAnchor, contentRootEl);
    if (!range) return null;

    const rawTop = getRangeTopInScrollContainer(range, scrollContainerEl);
    return Math.max(0, rawTop - 18);
  }, [composerAnchor, contentRootEl, effectiveViewportWidth, scrollContainerEl]);

  const selectionButtonLeft = useMemo(() => {
    if (marginLane.compact) {
      return marginLane.iconLeft;
    }
    return Math.max(8, marginLane.left - COMMENT_SELECTION_BUTTON_SIZE - 6);
  }, [marginLane.compact, marginLane.iconLeft, marginLane.left]);

  const positionedComments = useMemo<PositionedComment[]>(() => {
    if (!contentRootEl || !scrollContainerEl || effectiveViewportWidth <= 0) return [];

    const candidates: Array<{ key: string; targetTop: number; comment: MarkdownComment }> = [];

    for (const comment of openTextComments) {
      const range = resolveTextAnchorRange(comment.target, contentRootEl);
      if (!range) continue;

      const targetTop = getRangeTopInScrollContainer(range, scrollContainerEl);

      candidates.push({
        key: comment.id,
        targetTop,
        comment,
      });
    }

    candidates.sort((left, right) => left.targetTop - right.targetTop);

    if (marginLane.compact) {
      const rows: Array<{
        anchorTop: number;
        top: number;
        items: Array<{ key: string; comment: MarkdownComment }>;
      }> = [];

      let nextTop = 8;
      for (const candidate of candidates) {
        const row = rows.find(
          (entry) => Math.abs(entry.anchorTop - candidate.targetTop) <= COMMENT_LINE_GROUP_TOLERANCE,
        );
        if (row) {
          row.items.push({
            key: candidate.key,
            comment: candidate.comment,
          });
          continue;
        }

        const rowTop = Math.max(candidate.targetTop, nextTop);
        rows.push({
          anchorTop: candidate.targetTop,
          top: rowTop,
          items: [
            {
              key: candidate.key,
              comment: candidate.comment,
            },
          ],
        });

        nextTop = rowTop + COMMENT_ICON_SIZE + COMMENT_ICON_STACK_GAP;
      }

      return rows.flatMap((row) =>
        row.items.map((item, slot) => ({
          key: item.key,
          top: row.top,
          slot,
          comment: item.comment,
        })),
      );
    }

    const rows: Array<{
      anchorTop: number;
      items: Array<{ key: string; comment: MarkdownComment }>;
    }> = [];

    for (const candidate of candidates) {
      const row = rows.find((entry) => Math.abs(entry.anchorTop - candidate.targetTop) <= COMMENT_LINE_GROUP_TOLERANCE);
      if (row) {
        row.items.push({
          key: candidate.key,
          comment: candidate.comment,
        });
        continue;
      }

      rows.push({
        anchorTop: candidate.targetTop,
        items: [
          {
            key: candidate.key,
            comment: candidate.comment,
          },
        ],
      });
    }

    let nextTop = 8;
    const positioned: PositionedComment[] = [];

    for (const row of rows) {
      const rowTop = Math.max(row.anchorTop, nextTop);
      let cursorTop = rowTop;

      for (const item of row.items) {
        positioned.push({
          key: item.key,
          top: cursorTop,
          slot: 0,
          comment: item.comment,
        });

        cursorTop += estimateCommentCardHeight(item.comment, marginLane.width) + COMMENT_CARD_STACK_GAP;
      }

      nextTop = cursorTop + COMMENT_ICON_STACK_GAP;
    }

    return positioned;
  }, [
    contentRootEl,
    effectiveViewportWidth,
    marginLane.compact,
    marginLane.width,
    openTextComments,
    scrollContainerEl,
  ]);

  const expandedComment = useMemo(
    () => openTextComments.find((comment) => comment.id === expandedCommentId) ?? null,
    [expandedCommentId, openTextComments],
  );

  const expandedCommentAnchorTop = useMemo(
    () => positionedComments.find((entry) => entry.comment.id === expandedCommentId)?.top ?? null,
    [expandedCommentId, positionedComments],
  );

  const expandedCommentLayout = useMemo(() => {
    if (!marginLane.compact || !expandedComment || expandedCommentAnchorTop === null || effectiveViewportWidth <= 0)
      return null;

    const maxWidth = Math.max(160, effectiveViewportWidth - 16);
    const cardWidth = Math.min(clamp(Math.round(effectiveViewportWidth * 0.34), 220, 320), maxWidth);
    const preferredLeft = marginLane.compact ? marginLane.iconLeft - cardWidth - 8 : marginLane.left;
    const left = clamp(preferredLeft, 8, Math.max(8, effectiveViewportWidth - cardWidth - 8));

    return {
      top: expandedCommentAnchorTop,
      left,
      width: cardWidth,
    };
  }, [
    effectiveViewportWidth,
    expandedComment,
    expandedCommentAnchorTop,
    marginLane.compact,
    marginLane.iconLeft,
    marginLane.left,
  ]);

  const openCommentCount = openTextComments.length;
  const hasPinnedItems = pinnedDiagramIds.length > 0 || pinnedImageSources.length > 0;
  const showPanel = showSidePanel && hasPinnedItems;
  const borderClass = isEditing ? "border border-chart-1" : "border border-border";
  const interactiveOverlayClass = isEditing ? "pointer-events-auto" : "pointer-events-none";

  const floatingLayer = (
    <div className="pointer-events-none absolute left-0 top-0 z-10 w-full">
      {highlightRects.map((rect) => (
        <div
          key={rect.key}
          className={
            rect.tone === "draft" ? "absolute rounded-[2px] bg-amber-300/60" : "absolute rounded-[2px] bg-blue-300/45"
          }
          style={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
          }}
        />
      ))}

      {selectionButtonTop !== null && composerAnchor === null && (
        <button
          type="button"
          title="Add comment"
          className={`${interactiveOverlayClass} absolute z-30 flex size-9 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-sm transition hover:bg-muted`}
          style={{
            top: selectionButtonTop,
            left: selectionButtonLeft,
          }}
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleOpenComposer}
        >
          <svg
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 3h10v7H7l-3 3V3z" />
            <line x1="8" y1="5" x2="8" y2="9" />
            <line x1="6" y1="7" x2="10" y2="7" />
          </svg>
        </button>
      )}

      {composerAnchor && composerTop !== null && (
        <div
          className={`${interactiveOverlayClass} absolute z-40 flex min-h-[188px] flex-col rounded-xl border border-border bg-card/95 p-3 shadow-lg`}
          style={{
            top: composerTop,
            left: marginLane.left,
            width: marginLane.width,
          }}
        >
          <div className="mb-2 text-xs font-medium text-muted-foreground">Add comment</div>
          <Textarea
            ref={commentInputRef}
            value={commentBody}
            onChange={(e) => setCommentBody(e.target.value)}
            onKeyDown={handleComposerKeyDown}
            placeholder="Comment"
            className="min-h-0 flex-1 resize-none"
          />

          <div className="mt-3 flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={handleCancelComposer}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSubmitComment} disabled={!canSubmitComment}>
              Comment
            </Button>
          </div>
        </div>
      )}

      {positionedComments.map(({ key, top, slot, comment }) =>
        marginLane.compact ? (
          <button
            key={key}
            type="button"
            title={`${getAuthorLabel(comment)} • ${formatDateTime(comment.createdAt)}`}
            className={`${interactiveOverlayClass} absolute flex size-[26px] items-center justify-center rounded-full border border-border bg-card/95 text-foreground shadow-sm transition hover:bg-muted data-[active=true]:border-chart-1 data-[active=true]:bg-chart-1/10`}
            data-active={expandedCommentId === comment.id}
            style={{
              top,
              left:
                marginLane.iconLeft +
                (selectionButtonTop !== null && Math.abs(top - selectionButtonTop) <= COMMENT_LINE_GROUP_TOLERANCE
                  ? COMMENT_SELECTION_BUTTON_SIZE + COMMENT_BUTTON_TO_ICON_GAP
                  : 0) +
                slot * (COMMENT_ICON_SIZE + COMMENT_ICON_ROW_GAP),
            }}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setExpandedCommentId((current) => (current === comment.id ? null : comment.id))}
          >
            <svg
              aria-hidden="true"
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 3h10v7H7l-3 3V3z" />
            </svg>
          </button>
        ) : (
          <div
            key={key}
            className={`${interactiveOverlayClass} absolute rounded-xl border border-border bg-card/95 p-3 shadow-sm data-[active=true]:border-chart-1 data-[active=true]:bg-chart-1/10`}
            data-active={expandedCommentId === comment.id}
            style={{
              top,
              left: marginLane.left,
              width: marginLane.width,
            }}
          >
            <div className="flex items-center gap-2">
              <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[11px] font-medium">
                {getAuthorLabel(comment)}
              </span>
              <span className="text-[11px] text-muted-foreground">{formatDateTime(comment.createdAt)}</span>
              <Button
                variant="ghost"
                size="xs"
                className="ml-auto h-6 px-2 text-[11px]"
                onClick={() => handleToggleCommentResolved(comment.id, true)}
              >
                Resolve
              </Button>
            </div>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed">{comment.body}</p>
          </div>
        ),
      )}

      {marginLane.compact && expandedComment && expandedCommentLayout && (
        <div
          className={`${interactiveOverlayClass} absolute rounded-xl border border-border bg-card/95 p-3 shadow-sm`}
          style={{
            top: expandedCommentLayout.top,
            left: expandedCommentLayout.left,
            width: expandedCommentLayout.width,
          }}
        >
          <div className="flex items-center gap-2">
            <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[11px] font-medium">
              {getAuthorLabel(expandedComment)}
            </span>
            <span className="text-[11px] text-muted-foreground">{formatDateTime(expandedComment.createdAt)}</span>
            <Button
              variant="ghost"
              size="xs"
              className="ml-auto h-6 px-2 text-[11px]"
              onClick={() => {
                handleToggleCommentResolved(expandedComment.id, true);
                setExpandedCommentId(null);
              }}
            >
              Resolve
            </Button>
          </div>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed">{expandedComment.body}</p>
        </div>
      )}
    </div>
  );

  const markdownPanel = (
    <MarkdownPanel
      markdown={content}
      filePath={filePath}
      parsed={parsed}
      mermaidBlocks={parsed.mermaidBlocks}
      onPinDiagram={handlePinDiagram}
      onPinImage={handlePinImage}
      onScrollContainerChange={handleScrollContainerChange}
      onContentRootChange={handleContentRootChange}
      overlay={floatingLayer}
    />
  );

  const panelLayout = (
    <Group orientation="horizontal" className="min-h-0 flex-1" resizeTargetMinimumSize={{ fine: 12, coarse: 24 }}>
      <Panel defaultSize={showPanel ? "70%" : "100%"} minSize={showPanel ? "45%" : "0%"}>
        <div className="min-h-0 min-w-0 h-full">{markdownPanel}</div>
      </Panel>
      {showPanel && (
        <>
          <Separator className="relative w-px cursor-col-resize bg-border transition-colors hover:bg-chart-1" />
          <Panel defaultSize="30%" minSize="220px" maxSize="55%">
            <div className="h-full min-h-0 overflow-hidden">
              <DiagramsPanel
                pinnedDiagramIds={pinnedDiagramIds}
                allBlocks={parsed.mermaidBlocks}
                pinnedImageSources={pinnedImageSources}
                onUnpinDiagram={handleUnpinDiagram}
                onUnpinImage={handleUnpinImage}
              />
            </div>
          </Panel>
        </>
      )}
    </Group>
  );

  const sidePanelToggleButton = hasPinnedItems && (
    <Button
      variant="ghost"
      size="icon-xs"
      title={showSidePanel ? "Hide side panel" : "Show side panel"}
      onClick={() => setShowSidePanel((value) => !value)}
      className={showSidePanel ? "bg-accent text-foreground" : "text-muted-foreground"}
    >
      <svg
        aria-hidden="true"
        width="14"
        height="14"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="2" y="2" width="12" height="12" rx="1" />
        <line x1="10" y1="2" x2="10" y2="14" />
      </svg>
    </Button>
  );

  const header = (
    <div className="flex items-center justify-between border-b border-border bg-muted/50 px-3 py-1.5 shrink-0">
      <div className="flex items-center gap-1.5 truncate">
        <MarkdownIcon className="size-5 shrink-0" />
        <span className="text-sm font-medium text-foreground truncate">{name || "Markdown"}</span>
        {openCommentCount > 0 && (
          <span className="rounded-sm bg-chart-1 px-1.5 py-0.5 text-[11px] font-medium text-white">
            {openCommentCount}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1">
        {isEditing && <span className="inline-flex size-2 shrink-0 rounded-full bg-chart-1" />}
        {sidePanelToggleButton}
        <Button
          variant="ghost"
          size="icon-xs"
          title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          onClick={() => setIsFullscreen((value) => !value)}
          className="text-muted-foreground"
        >
          {isFullscreen ? (
            <svg
              aria-hidden="true"
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="4" y1="4" x2="12" y2="12" />
              <line x1="12" y1="4" x2="4" y2="12" />
            </svg>
          ) : (
            <svg
              aria-hidden="true"
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="1 5 1 1 5 1" />
              <polyline points="11 1 15 1 15 5" />
              <polyline points="15 11 15 15 11 15" />
              <polyline points="5 15 1 15 1 11" />
            </svg>
          )}
        </Button>
      </div>
    </div>
  );

  const editOverlay = !isEditing && (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/0 opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
      <span className="rounded-md bg-foreground/80 px-3 py-1.5 text-xs font-medium text-background shadow-sm">
        Double-click to interact
      </span>
    </div>
  );

  const viewerContent = (
    <div
      className={`relative flex h-full flex-col overflow-hidden ${isEditing ? "select-text cursor-auto" : ""}`}
      style={{ pointerEvents: isEditing ? "auto" : "none" }}
    >
      {editOverlay}
      {header}
      {panelLayout}
    </div>
  );

  if (!isFullscreen) {
    return (
      <div
        className={`relative flex h-full flex-col overflow-hidden rounded-lg ${borderClass} bg-card shadow-sm`}
        style={{ width, height }}
      >
        {viewerContent}
      </div>
    );
  }

  return (
    <>
      <div style={{ width, height }} />
      {createPortal(
        <div
          className="fixed inset-0 z-9999 flex flex-col bg-background select-text cursor-auto"
          style={{ pointerEvents: "all" }}
        >
          <div className={`flex h-full w-full flex-col overflow-hidden ${borderClass} bg-card shadow-sm`}>
            {viewerContent}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

function getAuthorLabel(comment: MarkdownComment): string {
  if (comment.author.type === "agent") {
    return comment.author.name;
  }
  return "User";
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  // Handle near-future timestamps from clock skew gracefully.
  if (diffMs < -30_000) {
    return `${formatDayLabel(date, now)} ${formatClock(date)}`;
  }

  if (diffMs < 45_000) {
    return "just now";
  }

  const diffMinutes = Math.floor(diffMs / 60_000);
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 12) {
    return `${diffHours}h ago`;
  }

  return `${formatDayLabel(date, now)} ${formatClock(date)}`;
}

function formatClock(date: Date): string {
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDayLabel(date: Date, now: Date): string {
  if (isSameCalendarDay(date, now)) {
    return "Today";
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameCalendarDay(date, yesterday)) {
    return "Yesterday";
  }

  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isSameCalendarDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function estimateCommentCardHeight(comment: MarkdownComment, cardWidth: number): number {
  const safeWidth = Math.max(160, cardWidth);
  const innerWidth = Math.max(120, safeWidth - 24);
  const charsPerLine = Math.max(16, Math.floor(innerWidth / 7));
  const bodyLength = comment.body.trim().length;
  const bodyLines = Math.max(1, Math.ceil(bodyLength / charsPerLine));
  return 60 + bodyLines * 22;
}

function isTextInputTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tagName = target.tagName;
  return tagName === "INPUT" || tagName === "TEXTAREA";
}

function getSelectedTextWithin(root: HTMLElement): string | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;

  const range = selection.getRangeAt(0);
  if (!isNodeInside(root, range.startContainer) || !isNodeInside(root, range.endContainer)) {
    return null;
  }

  const text = selection.toString();
  return text ? text : null;
}

function getAnchorTextWithin(root: HTMLElement, anchor: TextSelectionAnchor | null): string | null {
  if (!anchor) return null;

  const range = resolveTextAnchorRange(anchor, root);
  const text = range?.toString() ?? anchor.quote;
  return text ? text : null;
}

function isNodeInside(root: HTMLElement, node: Node): boolean {
  const element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  return !!element && root.contains(element);
}

async function writeTextToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall through to legacy copy command.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function makeCommentId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `comment-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getSelectionAnchor(root: HTMLElement): TextSelectionAnchor | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return null;
  }

  const range = selection.getRangeAt(0);
  if (!isRangeInsideRoot(range, root)) {
    return null;
  }

  return serializeRange(range, root);
}

function isRangeInsideRoot(range: Range, root: HTMLElement): boolean {
  return root.contains(range.commonAncestorContainer);
}

function serializeRange(range: Range, root: HTMLElement): TextSelectionAnchor | null {
  const rootText = root.textContent ?? "";
  if (!rootText) {
    return null;
  }

  const start = getOffsetWithinRoot(root, range.startContainer, range.startOffset);
  const end = getOffsetWithinRoot(root, range.endContainer, range.endOffset);
  if (start === null || end === null) {
    return null;
  }

  const orderedStart = Math.min(start, end);
  const orderedEnd = Math.max(start, end);
  if (orderedEnd <= orderedStart) {
    return null;
  }

  const quote = rootText.slice(orderedStart, orderedEnd);
  if (!quote.trim()) {
    return null;
  }

  return {
    start: orderedStart,
    end: orderedEnd,
    quote,
    prefix: rootText.slice(Math.max(0, orderedStart - SELECTION_CONTEXT_CHARS), orderedStart),
    suffix: rootText.slice(orderedEnd, Math.min(rootText.length, orderedEnd + SELECTION_CONTEXT_CHARS)),
  };
}

function getOffsetWithinRoot(root: HTMLElement, container: Node, offset: number): number | null {
  if (!root.contains(container) && container !== root) {
    return null;
  }

  try {
    const probe = document.createRange();
    probe.selectNodeContents(root);
    probe.setEnd(container, offset);
    return probe.toString().length;
  } catch {
    return null;
  }
}

function getOffsetFromPoint(root: HTMLElement, clientX: number, clientY: number): number | null {
  if ("caretPositionFromPoint" in document) {
    const caret = document.caretPositionFromPoint(clientX, clientY);
    if (caret) {
      return getOffsetWithinRoot(root, caret.offsetNode, caret.offset);
    }
  }

  if ("caretRangeFromPoint" in document) {
    const range = document.caretRangeFromPoint(clientX, clientY);
    if (range) {
      return getOffsetWithinRoot(root, range.startContainer, range.startOffset);
    }
  }

  return null;
}

function findCommentIdAtPoint(
  root: HTMLElement,
  clientX: number,
  clientY: number,
  comments: Array<MarkdownComment & { target: MarkdownTextCommentTarget }>,
): string | null {
  const rootText = root.textContent ?? "";
  if (!rootText) return null;

  const pointOffset = getOffsetFromPoint(root, clientX, clientY);
  if (pointOffset === null) return null;

  let bestMatch: { id: string; span: number } | null = null;
  for (const comment of comments) {
    const offsets = resolveAnchorOffsets(comment.target, rootText);
    if (!offsets) continue;
    if (pointOffset < offsets.start || pointOffset > offsets.end) continue;

    const span = offsets.end - offsets.start;
    if (!bestMatch || span < bestMatch.span) {
      bestMatch = {
        id: comment.id,
        span,
      };
    }
  }

  return bestMatch?.id ?? null;
}

function resolveTextAnchorRange(anchor: TextSelectionAnchor, root: HTMLElement): Range | null {
  const rootText = root.textContent ?? "";
  if (!rootText) {
    return null;
  }

  const offsets = resolveAnchorOffsets(anchor, rootText);
  if (!offsets) {
    return null;
  }

  return buildRangeFromOffsets(root, offsets.start, offsets.end);
}

function resolveAnchorOffsets(
  anchor: TextSelectionAnchor,
  text: string,
): {
  start: number;
  end: number;
} | null {
  if (!text) {
    return null;
  }

  const preferredStart = clamp(Math.floor(anchor.start), 0, text.length);
  const preferredEnd = clamp(Math.floor(anchor.end), 0, text.length);

  const quote = anchor.quote;
  if (!quote) {
    const fallbackStart = Math.min(preferredStart, preferredEnd);
    const fallbackEnd = Math.max(preferredStart, preferredEnd);
    if (fallbackEnd <= fallbackStart) return null;
    return {
      start: fallbackStart,
      end: fallbackEnd,
    };
  }

  let start = preferredStart;
  let end = start + quote.length;

  if (text.slice(start, end) !== quote) {
    const matchStart = findBestQuoteMatch(text, quote, preferredStart, anchor.prefix, anchor.suffix);
    if (matchStart === null) {
      return null;
    }
    start = matchStart;
    end = matchStart + quote.length;
  }

  if (end <= start) {
    return null;
  }

  return {
    start,
    end,
  };
}

function findBestQuoteMatch(
  text: string,
  quote: string,
  preferredStart: number,
  prefix: string | undefined,
  suffix: string | undefined,
): number | null {
  if (!quote) {
    return null;
  }

  const candidates: number[] = [];
  let searchFrom = 0;

  while (searchFrom <= text.length) {
    const index = text.indexOf(quote, searchFrom);
    if (index < 0) {
      break;
    }
    candidates.push(index);
    searchFrom = index + 1;
  }

  if (candidates.length === 0) {
    return null;
  }

  let bestIndex = candidates[0];
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const index of candidates) {
    let score = -Math.abs(index - preferredStart);

    if (prefix) {
      const actualPrefix = text.slice(Math.max(0, index - prefix.length), index);
      if (actualPrefix === prefix) {
        score += 120;
      }
    }

    if (suffix) {
      const actualSuffix = text.slice(index + quote.length, index + quote.length + suffix.length);
      if (actualSuffix === suffix) {
        score += 120;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }

  return bestIndex;
}

function buildRangeFromOffsets(root: HTMLElement, start: number, end: number): Range | null {
  const orderedStart = Math.max(0, Math.min(start, end));
  const orderedEnd = Math.max(orderedStart, end);

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);

  let currentOffset = 0;
  let startNode: Node | null = null;
  let startNodeOffset = 0;
  let endNode: Node | null = null;
  let endNodeOffset = 0;

  let node = walker.nextNode();
  while (node) {
    const textLength = node.textContent?.length ?? 0;
    const nextOffset = currentOffset + textLength;

    if (!startNode && orderedStart <= nextOffset) {
      startNode = node;
      startNodeOffset = orderedStart - currentOffset;
    }

    if (!endNode && orderedEnd <= nextOffset) {
      endNode = node;
      endNodeOffset = orderedEnd - currentOffset;
      break;
    }

    currentOffset = nextOffset;
    node = walker.nextNode();
  }

  if (!startNode || !endNode) {
    return null;
  }

  try {
    const range = document.createRange();
    range.setStart(startNode, Math.max(0, startNodeOffset));
    range.setEnd(endNode, Math.max(0, endNodeOffset));
    if (range.collapsed) {
      return null;
    }
    return range;
  } catch {
    return null;
  }
}

function getRangeTopInScrollContainer(range: Range, scrollContainer: HTMLElement): number {
  const rangeRect = getRangeDisplayRect(range);
  const scrollRect = scrollContainer.getBoundingClientRect();
  return rangeRect.top - scrollRect.top + scrollContainer.scrollTop;
}

function getRangeRectsInScrollContainer(
  range: Range,
  scrollContainer: HTMLElement,
): Array<{ top: number; left: number; width: number; height: number }> {
  const scrollRect = scrollContainer.getBoundingClientRect();
  const rects = Array.from(range.getClientRects());

  const sourceRects =
    rects.length > 0 && rects.some((rect) => rect.width > 0 && rect.height > 0)
      ? rects
      : [range.getBoundingClientRect()];

  return sourceRects
    .map((rect) => ({
      top: rect.top - scrollRect.top + scrollContainer.scrollTop,
      left: rect.left - scrollRect.left + scrollContainer.scrollLeft,
      width: rect.width,
      height: rect.height,
    }))
    .filter((rect) => rect.width > 0 && rect.height > 0);
}

function getRangeDisplayRect(range: Range): DOMRect {
  const firstRect = range.getClientRects().item(0);
  if (firstRect) {
    return firstRect;
  }
  return range.getBoundingClientRect();
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
