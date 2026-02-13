import { type RecordProps, T, type TLShape } from "tldraw";

const IFRAME_SHAPE_TYPE = "visual-iframe" as const;

declare module "tldraw" {
  interface TLGlobalShapePropsMap {
    [IFRAME_SHAPE_TYPE]: {
      w: number;
      h: number;
      name: string;
      html: string;
    };
  }
}

export type IframeShape = TLShape<typeof IFRAME_SHAPE_TYPE>;

export const iframeShapeProps: RecordProps<IframeShape> = {
  w: T.number,
  h: T.number,
  name: T.string,
  html: T.string,
};
