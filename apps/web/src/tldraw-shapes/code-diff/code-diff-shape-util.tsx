import { File, type FileContents } from "@pierre/diffs/react";
import { BaseBoxShapeUtil, HTMLContainer, resizeBox, type TLResizeInfo } from "tldraw";
import type { CodeDiffShape } from "./code-diff-shape-props";
import { codeDiffShapeProps } from "./code-diff-shape-props";

const file: FileContents = {
  name: "example.ts",
  contents: `function greet(name: string) {
  console.log(\`Hello, \${name}!\`);
}

export { greet };`,
};

const CODE_DIFF_THEME = { dark: "pierre-dark", light: "pierre-light" };
const CODE_DIFF_THEME_TYPE = "dark";
const CODE_DIFF_THEME_BG = "#070707";

export class CodeDiffShapeUtil extends BaseBoxShapeUtil<CodeDiffShape> {
  static override type = "code-diff";
  static override props = codeDiffShapeProps;

  private static readonly minWidth = 360;
  private static readonly minHeight = 140;

  override getDefaultProps(): CodeDiffShape["props"] {
    return {
      w: 600,
      h: 400,
    };
  }

  override canEdit() {
    return true;
  }

  override canScroll() {
    return true;
  }

  override onResize(shape: CodeDiffShape, info: TLResizeInfo<CodeDiffShape>) {
    return resizeBox(shape, info, {
      minWidth: CodeDiffShapeUtil.minWidth,
      minHeight: CodeDiffShapeUtil.minHeight,
    });
  }

  override component(shape: CodeDiffShape) {
    const isEditing = this.editor.getEditingShapeId() === shape.id;

    return (
      <HTMLContainer
        style={{
          width: shape.props.w,
          height: shape.props.h,
          overflow: "hidden",
          borderRadius: 8,
          pointerEvents: isEditing ? "all" : "none",
          backgroundColor: CODE_DIFF_THEME_BG,
        }}
      >
        <div className="h-full w-full overflow-auto">
          <File
            file={file}
            options={{
              theme: CODE_DIFF_THEME,
              themeType: CODE_DIFF_THEME_TYPE,
              overflow: "scroll",
            }}
            className="min-h-full w-full"
          />
        </div>
      </HTMLContainer>
    );
  }

  override indicator(shape: CodeDiffShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={8} ry={8} />;
  }
}
