import { type RecordProps, T, type TLShape } from "tldraw";

const VISUAL_MARKDOWN_SHAPE_TYPE = "visual-markdown" as const;

declare module "tldraw" {
  interface TLGlobalShapePropsMap {
    [VISUAL_MARKDOWN_SHAPE_TYPE]: {
      w: number;
      h: number;
      name: string;
      markdown: string;
    };
  }
}

export type VisualMarkdownShape = TLShape<typeof VISUAL_MARKDOWN_SHAPE_TYPE>;

export const visualMarkdownShapeProps: RecordProps<VisualMarkdownShape> = {
  w: T.number,
  h: T.number,
  name: T.string,
  markdown: T.string,
};
