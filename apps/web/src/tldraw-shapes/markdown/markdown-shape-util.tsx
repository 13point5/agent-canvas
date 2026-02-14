import { BaseBoxShapeUtil, createShapePropsMigrationSequence, HTMLContainer } from "tldraw";
import { MarkdownViewer } from "@/components/markdown/markdown-viewer";
import type { MarkdownShape } from "./markdown-shape-props";
import { markdownShapeProps } from "./markdown-shape-props";

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
    ],
  });

  override getDefaultProps(): MarkdownShape["props"] {
    return {
      w: 400,
      h: 300,
      name: "",
      content: "",
      filePath: "",
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

    return (
      <HTMLContainer
        style={{
          width: shape.props.w,
          height: shape.props.h,
          pointerEvents: isEditing ? "all" : "none",
          overflow: "hidden",
          borderRadius: 8,
        }}
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
          width={shape.props.w}
          height={shape.props.h}
          isEditing={isEditing}
        />
      </HTMLContainer>
    );
  }

  override indicator(shape: MarkdownShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={8} ry={8} />;
  }
}
