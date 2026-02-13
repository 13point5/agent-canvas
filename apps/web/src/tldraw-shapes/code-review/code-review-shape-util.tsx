import { BaseBoxShapeUtil, HTMLContainer } from "tldraw";
import { CodeReviewViewer, type ReviewComment } from "@/components/code-review/code-review-viewer";
import { codeReviewShapeProps, type CodeReviewShape } from "./code-review-shape-props";

function parseComments(value: string): ReviewComment[] {
  try {
    const parsed = JSON.parse(value) as ReviewComment[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((comment) => (
      typeof comment.id === "string"
      && (comment.side === "additions" || comment.side === "deletions")
      && typeof comment.lineNumber === "number"
      && typeof comment.text === "string"
    ));
  } catch {
    return [];
  }
}

export class CodeReviewShapeUtil extends BaseBoxShapeUtil<CodeReviewShape> {
  static override type = "visual-code-review" as const;
  static override props = codeReviewShapeProps;

  override getDefaultProps(): CodeReviewShape["props"] {
    return {
      w: 1200,
      h: 800,
      name: "",
      mode: "diff",
      fileName: "",
      fileContents: "",
      patch: "",
      comments: "[]",
    };
  }

  override canEdit() {
    return true;
  }

  override canScroll() {
    return true;
  }

  override component(shape: CodeReviewShape) {
    const isEditing = this.editor.getEditingShapeId() === shape.id;

    return (
      <HTMLContainer
        style={{
          width: shape.props.w,
          height: shape.props.h,
          pointerEvents: isEditing ? "all" : "none",
          overflow: "hidden",
          borderRadius: 8,
        }}
        onPointerDown={isEditing ? (e: React.PointerEvent) => { this.editor.markEventAsHandled(e); } : undefined}
        onPointerMove={isEditing ? (e: React.PointerEvent) => { this.editor.markEventAsHandled(e); } : undefined}
        onPointerUp={isEditing ? (e: React.PointerEvent) => { this.editor.markEventAsHandled(e); } : undefined}
      >
        <CodeReviewViewer
          name={shape.props.name}
          mode={shape.props.mode === "file" ? "file" : "diff"}
          fileName={shape.props.fileName}
          fileContents={shape.props.fileContents}
          patch={shape.props.patch}
          comments={parseComments(shape.props.comments)}
          width={shape.props.w}
          height={shape.props.h}
          isEditing={isEditing}
          onCommentsChange={(comments) => {
            this.editor.updateShape({
              id: shape.id,
              type: shape.type,
              props: {
                comments: JSON.stringify(comments),
              },
            });
          }}
        />
      </HTMLContainer>
    );
  }

  override indicator(shape: CodeReviewShape) {
    return (
      <rect
        width={shape.props.w}
        height={shape.props.h}
        rx={8}
        ry={8}
      />
    );
  }
}
