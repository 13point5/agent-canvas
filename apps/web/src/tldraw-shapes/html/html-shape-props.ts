import { type RecordProps, T, type TLShape } from "tldraw";

const HTML_SHAPE_TYPE = "html" as const;

declare module "tldraw" {
  interface TLGlobalShapePropsMap {
    [HTML_SHAPE_TYPE]: {
      w: number;
      h: number;
      name: string;
      content: string;
      filePath: string;
    };
  }
}

export type HtmlShape = TLShape<typeof HTML_SHAPE_TYPE>;

export const htmlShapeProps: RecordProps<HtmlShape> = {
  w: T.number,
  h: T.number,
  name: T.string,
  content: T.string,
  filePath: T.string,
};
