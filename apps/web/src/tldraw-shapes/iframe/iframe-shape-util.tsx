import { BaseBoxShapeUtil, HTMLContainer } from "tldraw";
import { IframeArtifactViewer } from "@/components/artifact/iframe-artifact-viewer";
import type { IframeShape } from "./iframe-shape-props";
import { iframeShapeProps } from "./iframe-shape-props";

export class IframeShapeUtil extends BaseBoxShapeUtil<IframeShape> {
  static override type = "visual-iframe" as const;
  static override props = iframeShapeProps;

  override getDefaultProps(): IframeShape["props"] {
    return {
      w: 900,
      h: 600,
      name: "",
      html: "",
    };
  }

  override canEdit() {
    return true;
  }

  override canScroll() {
    return true;
  }

  override component(shape: IframeShape) {
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
        <IframeArtifactViewer
          name={shape.props.name}
          html={shape.props.html}
          width={shape.props.w}
          height={shape.props.h}
          isEditing={isEditing}
        />
      </HTMLContainer>
    );
  }

  override indicator(shape: IframeShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={8} ry={8} />;
  }
}
