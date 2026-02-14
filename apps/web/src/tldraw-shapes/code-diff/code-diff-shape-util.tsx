import { BaseBoxShapeUtil, HTMLContainer } from "tldraw";
import type { CodeDiffShape } from "./code-diff-shape-props";
import { codeDiffShapeProps } from "./code-diff-shape-props";

export class CodeDiffShapeUtil extends BaseBoxShapeUtil<CodeDiffShape> {
  static override type = "code-diff" as const;
  static override props = codeDiffShapeProps;

  override getDefaultProps(): CodeDiffShape["props"] {
    return {
      w: 600,
      h: 400,
    };
  }

  override component(shape: CodeDiffShape) {
    return (
      <HTMLContainer
        style={{
          width: shape.props.w,
          height: shape.props.h,
          overflow: "hidden",
          borderRadius: 8,
          padding: 16,
        }}
      >
        <p>Code diff placeholder</p>
      </HTMLContainer>
    );
  }

  override indicator(shape: CodeDiffShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={8} ry={8} />;
  }
}
