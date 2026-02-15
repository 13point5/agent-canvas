import {
  BaseBoxShapeUtil,
  createShapePropsMigrationSequence,
  HTMLContainer,
  resizeBox,
  type TLResizeInfo,
} from "tldraw";
import { TerminalViewer } from "@/components/terminal/terminal-viewer";
import type { TerminalShape } from "./terminal-shape-props";
import { terminalShapeProps } from "./terminal-shape-props";

export class TerminalShapeUtil extends BaseBoxShapeUtil<TerminalShape> {
  static override type = "terminal" as const;
  static override props = terminalShapeProps;
  static override migrations = createShapePropsMigrationSequence({
    sequence: [
      {
        id: "com.tldraw.shape.terminal/1",
        up(props: Record<string, unknown>) {
          if (props.name === undefined) {
            props.name = "";
          }
          if (props.w === undefined) {
            props.w = 680;
          }
          if (props.h === undefined) {
            props.h = 420;
          }
        },
      },
      {
        id: "com.tldraw.shape.terminal/2",
        up(props: Record<string, unknown>) {
          if (typeof props.name !== "string") {
            props.name = "Shell";
          }
          if (typeof props.w !== "number" || !Number.isFinite(props.w)) {
            props.w = 680;
          }
          if (typeof props.h !== "number" || !Number.isFinite(props.h)) {
            props.h = 420;
          }
        },
      },
    ],
  });

  private static readonly minWidth = 320;
  private static readonly minHeight = 220;

  override getDefaultProps(): TerminalShape["props"] {
    return {
      w: 680,
      h: 420,
      name: "Shell",
    };
  }

  override canEdit() {
    return true;
  }

  override canScroll() {
    return true;
  }

  override onResize(shape: TerminalShape, info: TLResizeInfo<TerminalShape>) {
    return resizeBox(shape, info, {
      minWidth: TerminalShapeUtil.minWidth,
      minHeight: TerminalShapeUtil.minHeight,
    });
  }

  override component(shape: TerminalShape) {
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
        onWheel={
          isEditing
            ? (e: React.WheelEvent) => {
                this.editor.markEventAsHandled(e);
              }
            : undefined
        }
      >
        <TerminalViewer
          name={shape.props.name}
          width={shape.props.w}
          height={shape.props.h}
          sessionId={shape.id}
          isEditing={isEditing}
        />
      </HTMLContainer>
    );
  }

  override indicator(shape: TerminalShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={8} ry={8} />;
  }
}
