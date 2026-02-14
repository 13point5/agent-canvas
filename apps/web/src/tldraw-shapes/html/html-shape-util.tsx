import { BaseBoxShapeUtil, createShapePropsMigrationSequence, HTMLContainer } from "tldraw";
import { HtmlViewer } from "@/components/html/html-viewer";
import type { HtmlShape } from "./html-shape-props";
import { htmlShapeProps } from "./html-shape-props";

export class HtmlShapeUtil extends BaseBoxShapeUtil<HtmlShape> {
  static override type = "html" as const;
  static override props = htmlShapeProps;
  static override migrations = createShapePropsMigrationSequence({
    sequence: [
      {
        id: "com.tldraw.shape.html/1",
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

  override getDefaultProps(): HtmlShape["props"] {
    return {
      w: 600,
      h: 400,
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

  override component(shape: HtmlShape) {
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
        <HtmlViewer
          name={shape.props.name}
          content={shape.props.content}
          width={shape.props.w}
          height={shape.props.h}
          isEditing={isEditing}
        />
      </HTMLContainer>
    );
  }

  override indicator(shape: HtmlShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={8} ry={8} />;
  }
}
