import { BaseBoxShapeUtil, HTMLContainer } from "tldraw";
import type { VisualMarkdownShape } from "./visual-markdown-shape-props";
import { visualMarkdownShapeProps } from "./visual-markdown-shape-props";
import { VisualMarkdownViewer } from "./components/visual-markdown-viewer";

export class VisualMarkdownShapeUtil extends BaseBoxShapeUtil<VisualMarkdownShape> {
  static override type = "visual-markdown" as const;
  static override props = visualMarkdownShapeProps;

  override getDefaultProps(): VisualMarkdownShape["props"] {
    return {
      w: 1200,
      h: 800,
      name: "",
      markdown: "",
    };
  }

  override canEdit() {
    return true;
  }

  override canScroll() {
    return true;
  }

  override component(shape: VisualMarkdownShape) {
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
        <VisualMarkdownViewer
          name={shape.props.name}
          markdown={shape.props.markdown}
          width={shape.props.w}
          height={shape.props.h}
          isEditing={isEditing}
        />
      </HTMLContainer>
    );
  }

  override indicator(shape: VisualMarkdownShape) {
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
