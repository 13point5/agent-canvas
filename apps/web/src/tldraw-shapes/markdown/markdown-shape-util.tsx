import { BaseBoxShapeUtil, createShapePropsMigrationSequence, HTMLContainer } from "tldraw";
import { MarkdownViewer } from "@/components/markdown/markdown-viewer";
import type { MarkdownComment, MarkdownShape } from "./markdown-shape-props";
import { markdownShapeProps } from "./markdown-shape-props";

const FALLBACK_COMMENT_TIMESTAMP = "1970-01-01T00:00:00.000Z";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeCommentAuthor(author: unknown): { type: "user" } | { type: "agent"; name: string } {
  if (isRecord(author) && author.type === "agent" && typeof author.name === "string" && author.name.trim().length > 0) {
    return {
      type: "agent",
      name: author.name,
    };
  }

  return {
    type: "user",
  };
}

export class MarkdownShapeUtil extends BaseBoxShapeUtil<MarkdownShape> {
  static override type = "markdown" as const;
  static override props = markdownShapeProps;
  static override migrations = createShapePropsMigrationSequence({
    sequence: [
      {
        id: "com.tldraw.shape.markdown/1",
        up(props: Record<string, unknown>) {
          if (props.filePath === undefined) {
            props.filePath = "";
          }
          if (props.content === undefined) {
            props.content = "";
          }
        },
      },
      {
        id: "com.tldraw.shape.markdown/2",
        up(props: Record<string, unknown>) {
          if (props.comments === undefined) {
            props.comments = [];
          }
        },
      },
      {
        id: "com.tldraw.shape.markdown/3",
        up(props: Record<string, unknown>) {
          if (!Array.isArray(props.comments)) {
            props.comments = [];
            return;
          }

          props.comments = props.comments.map((comment, index) => {
            if (!isRecord(comment) || Array.isArray(comment.messages)) {
              return comment;
            }

            const commentId = typeof comment.id === "string" && comment.id.length > 0 ? comment.id : `comment-${index}`;
            const createdAt =
              typeof comment.createdAt === "string" && comment.createdAt.length > 0
                ? comment.createdAt
                : FALLBACK_COMMENT_TIMESTAMP;

            return {
              id: commentId,
              target: comment.target,
              messages: [
                {
                  id: `${commentId}-message-0`,
                  body: typeof comment.body === "string" ? comment.body : "",
                  author: normalizeCommentAuthor(comment.author),
                  createdAt,
                  editedAt: null,
                },
              ],
              resolvedAt: typeof comment.resolvedAt === "string" ? comment.resolvedAt : null,
            };
          });
        },
      },
    ],
  });

  override getDefaultProps(): MarkdownShape["props"] {
    return {
      w: 400,
      h: 300,
      name: "",
      content: "",
      filePath: "",
      comments: [],
    };
  }

  override canEdit() {
    return true;
  }

  override canScroll() {
    return true;
  }

  override component(shape: MarkdownShape) {
    const isEditing = this.editor.getEditingShapeId() === shape.id;
    const handleCommentsChange = (comments: MarkdownComment[]) => {
      this.editor.updateShape({
        id: shape.id,
        type: shape.type,
        props: { comments },
      });
    };

    return (
      <HTMLContainer
        style={{
          width: shape.props.w,
          height: shape.props.h,
          pointerEvents: "all",
          overflow: "hidden",
          borderRadius: 8,
        }}
        onDoubleClick={
          isEditing
            ? undefined
            : (e: React.MouseEvent) => {
                this.editor.markEventAsHandled(e);
                if (!this.editor.canEditShape(shape, { type: "double-click" })) return;
                this.editor.markHistoryStoppingPoint("editing shape");
                this.editor.setEditingShape(shape.id);
                this.editor.setCurrentTool("select.editing_shape");
              }
        }
        onPointerDown={
          isEditing
            ? (e: React.PointerEvent) => {
                this.editor.markEventAsHandled(e);
              }
            : undefined
        }
        onPointerMove={
          isEditing
            ? (e: React.PointerEvent) => {
                this.editor.markEventAsHandled(e);
              }
            : undefined
        }
        onPointerUp={
          isEditing
            ? (e: React.PointerEvent) => {
                this.editor.markEventAsHandled(e);
              }
            : undefined
        }
      >
        <MarkdownViewer
          name={shape.props.name}
          content={shape.props.content}
          filePath={shape.props.filePath}
          comments={shape.props.comments}
          width={shape.props.w}
          height={shape.props.h}
          isEditing={isEditing}
          onCommentsChange={handleCommentsChange}
        />
      </HTMLContainer>
    );
  }

  override indicator(shape: MarkdownShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={8} ry={8} />;
  }
}
