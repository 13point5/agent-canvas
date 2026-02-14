import { MultiFileDiff } from "@pierre/diffs/react";
import {
  BaseBoxShapeUtil,
  createShapePropsMigrationSequence,
  HTMLContainer,
  resizeBox,
  type TLResizeInfo,
} from "tldraw";
import type { CodeDiffFile, CodeDiffShape } from "./code-diff-shape-props";
import { codeDiffShapeProps } from "./code-diff-shape-props";

const CODE_DIFF_THEME = "pierre-dark";
const CODE_DIFF_THEME_BG = "#070707";
const DEFAULT_OLD_FILE: CodeDiffFile = {
  name: "some/path/example.ts",
  contents: 'console.log("Hello world")',
};
const DEFAULT_NEW_FILE: CodeDiffFile = {
  name: "example.ts",
  contents: 'console.warn("Updated message")',
};

const cloneFile = (file: CodeDiffFile): CodeDiffFile => ({ ...file });

export class CodeDiffShapeUtil extends BaseBoxShapeUtil<CodeDiffShape> {
  static override type = "code-diff";
  static override props = codeDiffShapeProps;
  static override migrations = createShapePropsMigrationSequence({
    sequence: [
      {
        id: "com.tldraw.shape.code-diff/1",
        up(props: Record<string, unknown>) {
          if (props.oldFile === undefined) {
            props.oldFile = cloneFile(DEFAULT_OLD_FILE);
          }
          if (props.newFile === undefined) {
            props.newFile = cloneFile(DEFAULT_NEW_FILE);
          }
        },
      },
    ],
  });

  private static readonly minWidth = 360;
  private static readonly minHeight = 140;

  override getDefaultProps(): CodeDiffShape["props"] {
    return {
      w: 600,
      h: 400,
      oldFile: cloneFile(DEFAULT_OLD_FILE),
      newFile: cloneFile(DEFAULT_NEW_FILE),
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
          <MultiFileDiff
            oldFile={shape.props.oldFile}
            newFile={shape.props.newFile}
            options={{
              theme: CODE_DIFF_THEME,
              themeType: "dark",
              overflow: "scroll",
              diffStyle: "unified",
            }}
          />
        </div>
      </HTMLContainer>
    );
  }

  override indicator(shape: CodeDiffShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={8} ry={8} />;
  }
}
