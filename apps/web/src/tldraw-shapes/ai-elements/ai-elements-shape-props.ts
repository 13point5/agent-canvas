import { type RecordProps, T, type TLShape } from "tldraw";

const ARTIFACT_SHAPE_TYPE = "artifact" as const;
const FILE_TREE_SHAPE_TYPE = "file-tree" as const;
const SCHEMA_DISPLAY_SHAPE_TYPE = "schema-display" as const;
const SNIPPET_SHAPE_TYPE = "snippet" as const;
const STACK_TRACE_SHAPE_TYPE = "stack-trace" as const;
const AI_TERMINAL_SHAPE_TYPE = "ai-terminal" as const;
const TEST_RESULTS_SHAPE_TYPE = "test-results" as const;
const WEB_PREVIEW_SHAPE_TYPE = "web-preview" as const;

const fileTreeEntryProps = T.object({
  path: T.string,
  type: T.string,
});

const schemaDisplayParameterProps = T.object({
  name: T.string,
  type: T.string,
  required: T.boolean,
  description: T.string,
  location: T.string,
});

const schemaDisplayFieldProps = T.object({
  name: T.string,
  type: T.string,
  required: T.boolean,
  description: T.string,
});

const testResultsSummaryProps = T.object({
  passed: T.integer,
  failed: T.integer,
  skipped: T.integer,
  total: T.integer,
  duration: T.optional(T.number),
});

const testResultCaseProps = T.object({
  suite: T.string,
  name: T.string,
  status: T.string,
  duration: T.optional(T.number),
  errorMessage: T.optional(T.string),
  errorStack: T.optional(T.string),
});

const webPreviewLogProps = T.object({
  level: T.string,
  message: T.string,
  timestamp: T.string,
});

export type FileTreeEntry = {
  path: string;
  type: string;
};

export type SchemaDisplayMethod = string;

export type SchemaDisplayParameter = {
  name: string;
  type: string;
  required: boolean;
  description: string;
  location: string;
};

export type SchemaDisplayField = {
  name: string;
  type: string;
  required: boolean;
  description: string;
};

export type TestResultStatus = string;

export type TestResultSummary = {
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  duration?: number;
};

export type TestResultCase = {
  suite: string;
  name: string;
  status: TestResultStatus;
  duration?: number;
  errorMessage?: string;
  errorStack?: string;
};

export type WebPreviewLog = {
  level: string;
  message: string;
  timestamp: string;
};

declare module "tldraw" {
  interface TLGlobalShapePropsMap {
    [ARTIFACT_SHAPE_TYPE]: {
      w: number;
      h: number;
      name: string;
      description: string;
      content: string;
    };
    [FILE_TREE_SHAPE_TYPE]: {
      w: number;
      h: number;
      name: string;
      entries: FileTreeEntry[];
      selectedPath: string;
      expandedPaths: string[];
    };
    [SCHEMA_DISPLAY_SHAPE_TYPE]: {
      w: number;
      h: number;
      name: string;
      method: SchemaDisplayMethod;
      path: string;
      description: string;
      parameters: SchemaDisplayParameter[];
      requestFields: SchemaDisplayField[];
      responseFields: SchemaDisplayField[];
    };
    [SNIPPET_SHAPE_TYPE]: {
      w: number;
      h: number;
      name: string;
      prefix: string;
      code: string;
      language: string;
    };
    [STACK_TRACE_SHAPE_TYPE]: {
      w: number;
      h: number;
      name: string;
      trace: string;
      showInternalFrames: boolean;
    };
    [AI_TERMINAL_SHAPE_TYPE]: {
      w: number;
      h: number;
      name: string;
      output: string;
      isStreaming: boolean;
      autoScroll: boolean;
    };
    [TEST_RESULTS_SHAPE_TYPE]: {
      w: number;
      h: number;
      name: string;
      summary: TestResultSummary;
      tests: TestResultCase[];
    };
    [WEB_PREVIEW_SHAPE_TYPE]: {
      w: number;
      h: number;
      name: string;
      url: string;
      logs: WebPreviewLog[];
    };
  }
}

export type ArtifactShape = TLShape<typeof ARTIFACT_SHAPE_TYPE>;
export type FileTreeShape = TLShape<typeof FILE_TREE_SHAPE_TYPE>;
export type SchemaDisplayShape = TLShape<typeof SCHEMA_DISPLAY_SHAPE_TYPE>;
export type SnippetShape = TLShape<typeof SNIPPET_SHAPE_TYPE>;
export type StackTraceShape = TLShape<typeof STACK_TRACE_SHAPE_TYPE>;
export type AiTerminalShape = TLShape<typeof AI_TERMINAL_SHAPE_TYPE>;
export type TestResultsShape = TLShape<typeof TEST_RESULTS_SHAPE_TYPE>;
export type WebPreviewShape = TLShape<typeof WEB_PREVIEW_SHAPE_TYPE>;

export const artifactShapeProps: RecordProps<ArtifactShape> = {
  w: T.number,
  h: T.number,
  name: T.string,
  description: T.string,
  content: T.string,
};

export const fileTreeShapeProps: RecordProps<FileTreeShape> = {
  w: T.number,
  h: T.number,
  name: T.string,
  entries: T.arrayOf(fileTreeEntryProps),
  selectedPath: T.string,
  expandedPaths: T.arrayOf(T.string),
};

export const schemaDisplayShapeProps: RecordProps<SchemaDisplayShape> = {
  w: T.number,
  h: T.number,
  name: T.string,
  method: T.string,
  path: T.string,
  description: T.string,
  parameters: T.arrayOf(schemaDisplayParameterProps),
  requestFields: T.arrayOf(schemaDisplayFieldProps),
  responseFields: T.arrayOf(schemaDisplayFieldProps),
};

export const snippetShapeProps: RecordProps<SnippetShape> = {
  w: T.number,
  h: T.number,
  name: T.string,
  prefix: T.string,
  code: T.string,
  language: T.string,
};

export const stackTraceShapeProps: RecordProps<StackTraceShape> = {
  w: T.number,
  h: T.number,
  name: T.string,
  trace: T.string,
  showInternalFrames: T.boolean,
};

export const aiTerminalShapeProps: RecordProps<AiTerminalShape> = {
  w: T.number,
  h: T.number,
  name: T.string,
  output: T.string,
  isStreaming: T.boolean,
  autoScroll: T.boolean,
};

export const testResultsShapeProps: RecordProps<TestResultsShape> = {
  w: T.number,
  h: T.number,
  name: T.string,
  summary: testResultsSummaryProps,
  tests: T.arrayOf(testResultCaseProps),
};

export const webPreviewShapeProps: RecordProps<WebPreviewShape> = {
  w: T.number,
  h: T.number,
  name: T.string,
  url: T.string,
  logs: T.arrayOf(webPreviewLogProps),
};
