import { BaseBoxShapeUtil, HTMLContainer, resizeBox, type TLBaseBoxShape, type TLResizeInfo, useValue } from "tldraw";

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
    const isSelected = useValue("is selected", () => this.editor.getOnlySelectedShapeId() === shape.id, [
      this.editor,
      shape.id,
    ]);
    const isInteractive = isEditing || isSelected;

    return (
      <HTMLContainer
        style={{
          width: shape.props.w,
          height: shape.props.h,
          pointerEvents: isInteractive ? "all" : "none",
          overflow: "hidden",
          borderRadius: 8,
          overscrollBehavior: "contain",
        }}
        onDoubleClick={
          isEditing
            ? undefined
            : (event: React.MouseEvent) => {
                this.editor.markEventAsHandled(event);
                if (!this.editor.canEditShape(shape, { type: "double-click" })) return;
                this.editor.markHistoryStoppingPoint("editing shape");
                this.editor.setEditingShape(shape.id);
                this.editor.setCurrentTool("select.editing_shape");
              }
        }
        onPointerDown={
          isEditing
            ? (event: React.PointerEvent) => {
                this.editor.markEventAsHandled(event);
                event.stopPropagation();
              }
            : undefined
        }
        onPointerMove={
          isEditing
            ? (event: React.PointerEvent) => {
                this.editor.markEventAsHandled(event);
                event.stopPropagation();
              }
            : undefined
        }
        onPointerUp={
          isEditing
            ? (event: React.PointerEvent) => {
                this.editor.markEventAsHandled(event);
                event.stopPropagation();
              }
            : undefined
        }
        onWheel={
          isInteractive
            ? (event: React.WheelEvent) => {
                this.editor.markEventAsHandled(event);
                event.stopPropagation();
              }
            : undefined
        }
        onWheelCapture={
          isInteractive
            ? (event: React.WheelEvent) => {
                this.editor.markEventAsHandled(event);
                event.stopPropagation();
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
