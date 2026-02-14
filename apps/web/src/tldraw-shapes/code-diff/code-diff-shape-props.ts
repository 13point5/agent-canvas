import { type RecordProps, T, type TLShape } from "tldraw";

const CODE_DIFF_SHAPE_TYPE = "code-diff" as const;
const codeDiffFileProps = T.object({
  name: T.string,
  contents: T.string,
});

export type CodeDiffFile = {
  name: string;
  contents: string;
};

declare module "tldraw" {
  interface TLGlobalShapePropsMap {
    [CODE_DIFF_SHAPE_TYPE]: {
      w: number;
      h: number;
      oldFile: CodeDiffFile;
      newFile: CodeDiffFile;
    };
  }
}

export type CodeDiffShape = TLShape<typeof CODE_DIFF_SHAPE_TYPE>;

export const codeDiffShapeProps: RecordProps<CodeDiffShape> = {
  w: T.number,
  h: T.number,
  oldFile: codeDiffFileProps,
  newFile: codeDiffFileProps,
};
