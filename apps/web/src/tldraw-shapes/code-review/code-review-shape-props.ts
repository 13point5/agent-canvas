import { type RecordProps, T, type TLShape } from "tldraw";

const CODE_REVIEW_SHAPE_TYPE = "visual-code-review" as const;

declare module "tldraw" {
  interface TLGlobalShapePropsMap {
    [CODE_REVIEW_SHAPE_TYPE]: {
      w: number;
      h: number;
      name: string;
      mode: string;
      fileName: string;
      fileContents: string;
      patch: string;
      comments: string;
    };
  }
}

export type CodeReviewShape = TLShape<typeof CODE_REVIEW_SHAPE_TYPE>;

export const codeReviewShapeProps: RecordProps<CodeReviewShape> = {
  w: T.number,
  h: T.number,
  name: T.string,
  mode: T.string,
  fileName: T.string,
  fileContents: T.string,
  patch: T.string,
  comments: T.string,
};
