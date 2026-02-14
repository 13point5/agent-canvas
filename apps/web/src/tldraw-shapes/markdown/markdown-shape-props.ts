import { type RecordProps, T, type TLShape } from "tldraw";

const MARKDOWN_SHAPE_TYPE = "markdown" as const;

declare module "tldraw" {
  interface TLGlobalShapePropsMap {
    [MARKDOWN_SHAPE_TYPE]: {
      w: number;
      h: number;
      name: string;
      content: string;
      filePath: string;
    };
  }
}

export type MarkdownShape = TLShape<typeof MARKDOWN_SHAPE_TYPE>;

export const markdownShapeProps: RecordProps<MarkdownShape> = {
  w: T.number,
  h: T.number,
  name: T.string,
  content: T.string,
  filePath: T.string,
};
