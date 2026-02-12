import { z } from "zod";

export const boardMetadataSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createBoardSchema = z.object({
  name: z.string().min(1),
});

export const updateBoardSchema = z.object({
  name: z.string().min(1).optional(),
});

export const snapshotSchema = z.object({
  document: z.unknown(),
  session: z.unknown().optional(),
});

// ── Shape enums (exact TLDraw values) ────────────────────────────────

const colorEnum = z.enum([
  "black", "grey", "light-violet", "violet", "blue", "light-blue",
  "yellow", "orange", "green", "light-green", "light-red", "red", "white",
]);
const fillEnum = z.enum(["none", "semi", "solid", "pattern", "fill", "lined-fill"]);
const sizeEnum = z.enum(["s", "m", "l", "xl"]);
const dashEnum = z.enum(["draw", "solid", "dashed", "dotted"]);
const fontEnum = z.enum(["draw", "sans", "serif", "mono"]);
const alignEnum = z.enum(["start", "middle", "end", "start-legacy", "end-legacy", "middle-legacy"]);
const verticalAlignEnum = z.enum(["start", "middle", "end"]);
const textAlignEnum = z.enum(["start", "middle", "end"]);
const arrowheadEnum = z.enum([
  "arrow", "triangle", "square", "dot", "pipe", "diamond", "inverted", "bar", "none",
]);
const geoTypeEnum = z.enum([
  "cloud", "rectangle", "ellipse", "triangle", "diamond",
  "pentagon", "hexagon", "octagon", "star", "rhombus", "rhombus-2",
  "oval", "trapezoid", "arrow-right", "arrow-left", "arrow-up",
  "arrow-down", "x-box", "check-box", "heart",
]);

// ── Shared types ─────────────────────────────────────────────────────

const richTextSchema = z.object({
  type: z.literal("doc"),
  content: z.array(z.record(z.unknown())),
}).passthrough();

const vecSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number().optional(),
});

// ── Geo shape ────────────────────────────────────────────────────────

const geoPropsSchema = z.object({
  geo: geoTypeEnum,
  w: z.number(),
  h: z.number(),
  growY: z.number().optional(),
  text: z.string().optional(),
  richText: richTextSchema.optional(),
  color: colorEnum.optional(),
  labelColor: colorEnum.optional(),
  fill: fillEnum.optional(),
  dash: dashEnum.optional(),
  size: sizeEnum.optional(),
  font: fontEnum.optional(),
  align: alignEnum.optional(),
  verticalAlign: verticalAlignEnum.optional(),
  url: z.string().optional(),
  scale: z.number().optional(),
}).strict();

const geoShapeSchema = z.object({
  type: z.literal("geo"),
  x: z.number(),
  y: z.number(),
  tempId: z.string().optional(),
  props: geoPropsSchema,
}).strict();

// ── Text shape ───────────────────────────────────────────────────────

const textPropsSchema = z.object({
  text: z.string().optional(),
  richText: richTextSchema.optional(),
  color: colorEnum.optional(),
  size: sizeEnum.optional(),
  font: fontEnum.optional(),
  textAlign: textAlignEnum.optional(),
  w: z.number().optional(),
  autoSize: z.boolean().optional(),
  scale: z.number().optional(),
}).strict();

const textShapeSchema = z.object({
  type: z.literal("text"),
  x: z.number(),
  y: z.number(),
  tempId: z.string().optional(),
  props: textPropsSchema,
}).strict();

// ── Arrow shape ──────────────────────────────────────────────────────

const arrowPropsSchema = z.object({
  kind: z.enum(["arc", "elbow"]).optional(),
  color: colorEnum.optional(),
  labelColor: colorEnum.optional(),
  fill: fillEnum.optional(),
  dash: dashEnum.optional(),
  size: sizeEnum.optional(),
  font: fontEnum.optional(),
  arrowheadStart: arrowheadEnum.optional(),
  arrowheadEnd: arrowheadEnum.optional(),
  start: vecSchema.optional(),
  end: vecSchema.optional(),
  bend: z.number().optional(),
  text: z.string().optional(),
  richText: richTextSchema.optional(),
  labelPosition: z.number().optional(),
  scale: z.number().optional(),
  elbowMidPoint: z.number().optional(),
}).strict();

const arrowShapeSchema = z.object({
  type: z.literal("arrow"),
  x: z.number().optional(),
  y: z.number().optional(),
  tempId: z.string().optional(),
  fromId: z.string().optional(),
  toId: z.string().optional(),
  x1: z.number().optional(),
  y1: z.number().optional(),
  x2: z.number().optional(),
  y2: z.number().optional(),
  props: arrowPropsSchema.optional(),
}).strict();

// ── Note shape ───────────────────────────────────────────────────────

const notePropsSchema = z.object({
  text: z.string().optional(),
  richText: richTextSchema.optional(),
  color: colorEnum.optional(),
  labelColor: colorEnum.optional(),
  size: sizeEnum.optional(),
  font: fontEnum.optional(),
  fontSizeAdjustment: z.number().optional(),
  align: alignEnum.optional(),
  verticalAlign: verticalAlignEnum.optional(),
  growY: z.number().optional(),
  url: z.string().optional(),
  scale: z.number().optional(),
}).strict();

const noteShapeSchema = z.object({
  type: z.literal("note"),
  x: z.number(),
  y: z.number(),
  tempId: z.string().optional(),
  props: notePropsSchema,
}).strict();

// ── Frame shape ──────────────────────────────────────────────────────

const framePropsSchema = z.object({
  w: z.number(),
  h: z.number(),
  name: z.string().optional(),
  color: colorEnum.optional(),
}).strict();

const frameShapeSchema = z.object({
  type: z.literal("frame"),
  x: z.number(),
  y: z.number(),
  tempId: z.string().optional(),
  props: framePropsSchema,
}).strict();

// ── Image shape ─────────────────────────────────────────────────────

const imagePropsSchema = z.object({
  w: z.number().optional(),
  h: z.number().optional(),
}).strict();

const imageShapeSchema = z.object({
  type: z.literal("image"),
  x: z.number(),
  y: z.number(),
  tempId: z.string().optional(),
  src: z.string(),
  props: imagePropsSchema.optional(),
}).strict();

// ── Visual Markdown shape ────────────────────────────────────────────

const visualMarkdownPropsSchema = z.object({
  w: z.number().optional(),
  h: z.number().optional(),
  name: z.string().optional(),
  markdown: z.string(),
}).strict();

const visualMarkdownShapeSchema = z.object({
  type: z.literal("visual-markdown"),
  x: z.number(),
  y: z.number(),
  tempId: z.string().optional(),
  props: visualMarkdownPropsSchema,
}).strict();

// ── Discriminated union + request body ───────────────────────────────

export const inputShapeSchema = z.discriminatedUnion("type", [
  geoShapeSchema,
  textShapeSchema,
  arrowShapeSchema,
  noteShapeSchema,
  frameShapeSchema,
  imageShapeSchema,
  visualMarkdownShapeSchema,
]);

export const createShapesBodySchema = z.object({
  shapes: z.array(inputShapeSchema).min(1),
});
