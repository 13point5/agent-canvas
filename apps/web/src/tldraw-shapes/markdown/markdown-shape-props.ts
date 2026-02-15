import { type RecordProps, T, type TLShape } from "tldraw";

const MARKDOWN_SHAPE_TYPE = "markdown" as const;

const markdownCommentAuthorProps = T.union("type", {
  user: T.object({
    type: T.literal("user"),
  }),
  agent: T.object({
    type: T.literal("agent"),
    name: T.string,
  }),
});

const markdownCommentTargetProps = T.union("type", {
  shape: T.object({
    type: T.literal("shape"),
  }),
  text: T.object({
    type: T.literal("text"),
    start: T.integer,
    end: T.integer,
    quote: T.string,
    prefix: T.optional(T.string),
    suffix: T.optional(T.string),
  }),
  line: T.object({
    type: T.literal("line"),
    line: T.integer,
    lineText: T.optional(T.string),
    previousLineText: T.optional(T.nullable(T.string)),
    nextLineText: T.optional(T.nullable(T.string)),
  }),
  diagram: T.object({
    type: T.literal("diagram"),
    diagramId: T.string,
  }),
});

const markdownCommentProps = T.object({
  id: T.string,
  target: markdownCommentTargetProps,
  body: T.string,
  author: markdownCommentAuthorProps,
  createdAt: T.string,
  resolvedAt: T.nullable(T.string),
});

export type MarkdownCommentAuthor = { type: "user" } | { type: "agent"; name: string };

export type MarkdownShapeCommentTarget = { type: "shape" };
export type MarkdownTextCommentTarget = {
  type: "text";
  start: number;
  end: number;
  quote: string;
  prefix?: string;
  suffix?: string;
};
export type MarkdownLineCommentTarget = {
  type: "line";
  line: number;
  lineText?: string;
  previousLineText?: string | null;
  nextLineText?: string | null;
};
export type MarkdownDiagramCommentTarget = { type: "diagram"; diagramId: string };
export type MarkdownCommentTarget =
  | MarkdownShapeCommentTarget
  | MarkdownTextCommentTarget
  | MarkdownLineCommentTarget
  | MarkdownDiagramCommentTarget;

export type MarkdownComment = {
  id: string;
  target: MarkdownCommentTarget;
  body: string;
  author: MarkdownCommentAuthor;
  createdAt: string;
  resolvedAt: string | null;
};

declare module "tldraw" {
  interface TLGlobalShapePropsMap {
    [MARKDOWN_SHAPE_TYPE]: {
      w: number;
      h: number;
      name: string;
      content: string;
      filePath: string;
      comments: MarkdownComment[];
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
  comments: T.arrayOf(markdownCommentProps),
};
