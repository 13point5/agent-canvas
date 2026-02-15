import { BaseBoxShapeUtil, HTMLContainer, resizeBox, type TLBaseBoxShape, type TLResizeInfo } from "tldraw";

export abstract class BaseAiElementsShapeUtil<TShape extends TLBaseBoxShape> extends BaseBoxShapeUtil<TShape> {
  protected abstract minWidth: number;
  protected abstract minHeight: number;

  protected abstract renderContent(shape: TShape): React.ReactNode;

  override canEdit() {
    return true;
  }

  override canScroll() {
    return true;
  }

  override onResize(shape: TShape, info: TLResizeInfo<TShape>) {
    return resizeBox(shape, info, {
      minWidth: this.minWidth,
      minHeight: this.minHeight,
    });
  }

  override component(shape: TShape) {
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
            ? (event: React.PointerEvent) => {
                this.editor.markEventAsHandled(event);
              }
            : undefined
        }
        onPointerMove={
          isEditing
            ? (event: React.PointerEvent) => {
                this.editor.markEventAsHandled(event);
              }
            : undefined
        }
        onPointerUp={
          isEditing
            ? (event: React.PointerEvent) => {
                this.editor.markEventAsHandled(event);
              }
            : undefined
        }
        onWheel={
          isEditing
            ? (event: React.WheelEvent) => {
                this.editor.markEventAsHandled(event);
              }
            : undefined
        }
      >
        {this.renderContent(shape)}
      </HTMLContainer>
    );
  }

  override indicator(shape: TShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={8} ry={8} />;
  }
}
