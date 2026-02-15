import { type RecordProps, T, type TLShape } from "tldraw";

const TERMINAL_SHAPE_TYPE = "terminal" as const;

declare module "tldraw" {
  interface TLGlobalShapePropsMap {
    [TERMINAL_SHAPE_TYPE]: {
      w: number;
      h: number;
      name: string;
    };
  }
}

export type TerminalShape = TLShape<typeof TERMINAL_SHAPE_TYPE>;

export const terminalShapeProps: RecordProps<TerminalShape> = {
  w: T.number,
  h: T.number,
  name: T.string,
};
