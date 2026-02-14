import { type RecordProps, T, type TLShape } from "tldraw";

const CODE_DIFF_SHAPE_TYPE = "code-diff" as const;

declare module "tldraw" {
  interface TLGlobalShapePropsMap {
    [CODE_DIFF_SHAPE_TYPE]: {
      w: number;
      h: number;
    };
  }
}

export type CodeDiffShape = TLShape<typeof CODE_DIFF_SHAPE_TYPE>;

export const codeDiffShapeProps: RecordProps<CodeDiffShape> = {
  w: T.number,
  h: T.number,
};
