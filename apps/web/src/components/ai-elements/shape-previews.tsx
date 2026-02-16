import {
  Artifact,
  ArtifactContent,
  ArtifactDescription,
  ArtifactHeader,
  ArtifactTitle,
} from "@/components/ai-elements/artifact";
import { FileTree, FileTreeFile, FileTreeFolder } from "@/components/ai-elements/file-tree";
import { SchemaDisplay } from "@/components/ai-elements/schema-display";
import { Snippet, SnippetAddon, SnippetCopyButton, SnippetInput, SnippetText } from "@/components/ai-elements/snippet";
import {
  StackTrace,
  StackTraceActions,
  StackTraceContent,
  StackTraceCopyButton,
  StackTraceError,
  StackTraceErrorMessage,
  StackTraceErrorType,
  StackTraceExpandButton,
  StackTraceFrames,
  StackTraceHeader,
} from "@/components/ai-elements/stack-trace";
import {
  Terminal as AiElementsTerminal,
  TerminalActions,
  TerminalContent,
  TerminalCopyButton,
  TerminalHeader,
  TerminalStatus,
  TerminalTitle,
} from "@/components/ai-elements/terminal";
import {
  Test,
  TestDuration,
  TestError,
  TestErrorMessage,
  TestErrorStack,
  TestName,
  TestResults,
  TestResultsContent,
  TestResultsDuration,
  TestResultsHeader,
  TestResultsProgress,
  TestResultsSummary,
  TestStatus,
  TestSuite,
  TestSuiteContent,
  TestSuiteName,
  TestSuiteStats,
} from "@/components/ai-elements/test-results";
import {
  WebPreview,
  WebPreviewBackButton,
  WebPreviewBody,
  WebPreviewConsole,
  WebPreviewForwardButton,
  WebPreviewNavigation,
  WebPreviewOpenButton,
  WebPreviewReloadButton,
  WebPreviewUrl,
} from "@/components/ai-elements/web-preview";
import type {
  AiTerminalShape,
  ArtifactShape,
  FileTreeEntry,
  FileTreeShape,
  SchemaDisplayShape,
  SnippetShape,
  StackTraceShape,
  TestResultCase,
  TestResultsShape,
  WebPreviewLog,
  WebPreviewShape,
} from "@/tldraw-shapes/ai-elements/ai-elements-shape-props";

type SchemaMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
type SchemaParameterLocation = "path" | "query" | "header";
type TestStatusKind = "passed" | "failed" | "skipped" | "running";
type WebLogLevel = "log" | "warn" | "error";

type TreeNode = {
  name: string;
  path: string;
  type: "file" | "folder";
  children: TreeNode[];
};

type MutableTreeNode = {
  name: string;
  path: string;
  type: "file" | "folder";
  children: Map<string, MutableTreeNode>;
};

function splitPath(path: string): string[] {
  return path
    .split(/[/\\]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalizeTreeEntries(entries: FileTreeEntry[]): FileTreeEntry[] {
  const dedupedByPath = new Map<string, FileTreeEntry>();

  for (const entry of entries) {
    const normalizedPath = entry.path.replace(/\\+/g, "/").replace(/^\/+|\/+$/g, "");
    if (!normalizedPath) continue;
    const normalizedType = entry.type === "folder" ? "folder" : "file";

    const previous = dedupedByPath.get(normalizedPath);
    if (!previous || (previous.type === "file" && normalizedType === "folder")) {
      dedupedByPath.set(normalizedPath, {
        path: normalizedPath,
        type: normalizedType,
      });
    }
  }

  return [...dedupedByPath.values()];
}

function toTreeNodes(nodes: MutableTreeNode[]): TreeNode[] {
  return nodes
    .map((node) => {
      const children = toTreeNodes([...node.children.values()]);
      const type: "file" | "folder" = children.length > 0 ? "folder" : node.type;

      return {
        name: node.name,
        path: node.path,
        type,
        children,
      };
    })
    .sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === "folder" ? -1 : 1;
      }

      return a.name.localeCompare(b.name);
    });
}

function buildTree(entries: FileTreeEntry[]): TreeNode[] {
  const root = new Map<string, MutableTreeNode>();

  for (const entry of normalizeTreeEntries(entries)) {
    const entryType: "file" | "folder" = entry.type === "folder" ? "folder" : "file";
    const parts = splitPath(entry.path);
    if (parts.length === 0) continue;

    let current = root;
    let currentPath = "";

    for (let index = 0; index < parts.length; index++) {
      const segment = parts[index] ?? "";
      const isLeaf = index === parts.length - 1;
      const nodePath = currentPath ? `${currentPath}/${segment}` : segment;

      const existing = current.get(segment);
      if (!existing) {
        current.set(segment, {
          name: segment,
          path: nodePath,
          type: isLeaf ? entryType : "folder",
          children: new Map<string, MutableTreeNode>(),
        });
      } else if (!isLeaf) {
        existing.type = "folder";
      } else {
        existing.type = entryType === "folder" ? "folder" : existing.type;
      }

      current = (current.get(segment) as MutableTreeNode).children;
      currentPath = nodePath;
    }
  }

  return toTreeNodes([...root.values()]);
}

function collectFolderPaths(nodes: TreeNode[], depth = 0, maxDepth = 2): string[] {
  const folderPaths: string[] = [];

  for (const node of nodes) {
    if (node.type === "folder") {
      if (depth <= maxDepth) {
        folderPaths.push(node.path);
      }
      folderPaths.push(...collectFolderPaths(node.children, depth + 1, maxDepth));
    }
  }

  return folderPaths;
}

function renderTreeNodes(nodes: TreeNode[]): React.ReactNode {
  return nodes.map((node) => {
    if (node.type === "folder") {
      return (
        <FileTreeFolder key={node.path} path={node.path} name={node.name}>
          {renderTreeNodes(node.children)}
        </FileTreeFolder>
      );
    }

    return <FileTreeFile key={node.path} path={node.path} name={node.name} />;
  });
}

function deriveTestSummary(testCases: TestResultCase[]): {
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  duration?: number;
} {
  const passed = testCases.filter((testCase) => asTestStatus(testCase.status) === "passed").length;
  const failed = testCases.filter((testCase) => asTestStatus(testCase.status) === "failed").length;
  const skipped = testCases.filter((testCase) => asTestStatus(testCase.status) === "skipped").length;
  const running = testCases.filter((testCase) => asTestStatus(testCase.status) === "running").length;
  const total = testCases.length;
  const duration = testCases.reduce((sum, testCase) => sum + (testCase.duration ?? 0), 0);

  return {
    passed,
    failed,
    skipped,
    total: total + running,
    ...(duration > 0 ? { duration } : {}),
  };
}

function deriveSuiteStatus(testCases: TestResultCase[]): TestStatusKind {
  if (testCases.some((testCase) => asTestStatus(testCase.status) === "running")) return "running";
  if (testCases.some((testCase) => asTestStatus(testCase.status) === "failed")) return "failed";
  if (testCases.every((testCase) => asTestStatus(testCase.status) === "skipped")) return "skipped";
  return "passed";
}

function groupTestsBySuite(testCases: TestResultCase[]): Array<{ suite: string; tests: TestResultCase[] }> {
  const grouped = new Map<string, TestResultCase[]>();

  for (const testCase of testCases) {
    const suite = testCase.suite?.trim() || "Tests";
    const existing = grouped.get(suite);
    if (existing) {
      existing.push(testCase);
    } else {
      grouped.set(suite, [testCase]);
    }
  }

  return [...grouped.entries()].map(([suite, tests]) => ({ suite, tests }));
}

function parseWebPreviewLogs(logs: WebPreviewLog[]): Array<{ level: WebLogLevel; message: string; timestamp: Date }> {
  return logs.map((log, index) => {
    const date = new Date(log.timestamp);
    const timestamp = Number.isNaN(date.getTime()) ? new Date(Date.now() + index) : date;

    return {
      level: asLogLevel(log.level),
      message: log.message,
      timestamp,
    };
  });
}

function normalizeMultiline(value: string): string {
  return value.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n");
}

function asSchemaMethod(value: string): SchemaMethod {
  switch (value) {
    case "POST":
    case "PUT":
    case "PATCH":
    case "DELETE":
      return value;
    default:
      return "GET";
  }
}

function asSchemaLocation(value: string): SchemaParameterLocation {
  switch (value) {
    case "query":
    case "header":
      return value;
    default:
      return "path";
  }
}

function asTestStatus(value: string): TestStatusKind {
  switch (value) {
    case "failed":
    case "skipped":
    case "running":
      return value;
    default:
      return "passed";
  }
}

function asLogLevel(value: string): WebLogLevel {
  switch (value) {
    case "warn":
    case "error":
      return value;
    default:
      return "log";
  }
}

export function ArtifactShapePreview({ props }: { props: ArtifactShape["props"] }) {
  return (
    <Artifact className="h-full w-full rounded-[8px] border border-border shadow-sm">
      <ArtifactHeader>
        <div className="min-w-0">
          <ArtifactTitle className="truncate">{props.name || "Artifact"}</ArtifactTitle>
          {props.description ? (
            <ArtifactDescription className="truncate">{props.description}</ArtifactDescription>
          ) : null}
        </div>
      </ArtifactHeader>
      <ArtifactContent className="text-sm whitespace-pre-wrap break-words">
        {props.content || "No artifact content yet."}
      </ArtifactContent>
    </Artifact>
  );
}

export function FileTreeShapePreview({ props }: { props: FileTreeShape["props"] }) {
  const tree = buildTree(props.entries);
  const fallbackExpanded = collectFolderPaths(tree);
  const expanded = props.expandedPaths.length > 0 ? props.expandedPaths : fallbackExpanded;

  return (
    <FileTree
      className="h-full w-full rounded-[8px] border border-border shadow-sm"
      defaultExpanded={new Set(expanded)}
      selectedPath={props.selectedPath || undefined}
    >
      {tree.length > 0 ? renderTreeNodes(tree) : <p className="px-2 py-1 text-muted-foreground text-xs">No files</p>}
    </FileTree>
  );
}

export function SchemaDisplayShapePreview({ props }: { props: SchemaDisplayShape["props"] }) {
  const method = asSchemaMethod(props.method);
  const path = props.path || "/api/example";
  const parameters = props.parameters.map((param) => ({
    name: param.name,
    type: param.type,
    required: param.required,
    description: param.description,
    location: asSchemaLocation(param.location),
  }));

  const requestFields = props.requestFields.map((field) => ({
    name: field.name,
    type: field.type,
    required: field.required,
    description: field.description,
  }));

  const responseFields = props.responseFields.map((field) => ({
    name: field.name,
    type: field.type,
    required: field.required,
    description: field.description,
  }));

  return (
    <SchemaDisplay
      className="h-full w-full overflow-auto rounded-[8px] border border-border shadow-sm scrollbar-thin"
      method={method}
      path={path}
      description={props.description || undefined}
      parameters={parameters}
      requestBody={requestFields}
      responseBody={responseFields}
    />
  );
}

export function SnippetShapePreview({ props }: { props: SnippetShape["props"] }) {
  return (
    <div className="flex h-full w-full items-center rounded-lg border border-border bg-background p-3 shadow-sm">
      <Snippet className="w-full" code={props.code}>
        <SnippetAddon>
          <SnippetText>{props.prefix || "$"}</SnippetText>
        </SnippetAddon>
        <SnippetInput />
        <SnippetCopyButton />
      </Snippet>
    </div>
  );
}

export function StackTraceShapePreview({ props }: { props: StackTraceShape["props"] }) {
  return (
    <StackTrace className="h-full w-full rounded-[8px] border border-border shadow-sm" defaultOpen trace={props.trace}>
      <StackTraceHeader>
        <StackTraceError>
          <StackTraceErrorType />
          <StackTraceErrorMessage />
        </StackTraceError>
        <StackTraceActions>
          <StackTraceCopyButton />
          <StackTraceExpandButton />
        </StackTraceActions>
      </StackTraceHeader>
      <StackTraceContent className="min-h-0 flex-1" maxHeight={undefined}>
        <StackTraceFrames showInternalFrames={props.showInternalFrames} />
      </StackTraceContent>
    </StackTrace>
  );
}

export function AiTerminalShapePreview({ props }: { props: AiTerminalShape["props"] }) {
  const output = normalizeMultiline(props.output);

  return (
    <AiElementsTerminal
      autoScroll={props.autoScroll}
      className="h-full w-full rounded-[8px] border border-border shadow-sm"
      isStreaming={props.isStreaming}
      output={output}
    >
      <TerminalHeader>
        <TerminalTitle>{props.name || "Terminal"}</TerminalTitle>
        <div className="flex items-center gap-1">
          <TerminalStatus />
          <TerminalActions>
            <TerminalCopyButton />
          </TerminalActions>
        </div>
      </TerminalHeader>
      <TerminalContent className="h-full max-h-none" />
    </AiElementsTerminal>
  );
}

export function TestResultsShapePreview({ props }: { props: TestResultsShape["props"] }) {
  const suites = groupTestsBySuite(props.tests);
  const derivedSummary = props.summary.total > 0 ? props.summary : deriveTestSummary(props.tests);

  return (
    <TestResults className="h-full w-full rounded-[8px] border border-border shadow-sm" summary={derivedSummary}>
      <TestResultsHeader>
        <TestResultsSummary />
        <TestResultsDuration />
      </TestResultsHeader>
      <TestResultsContent className="space-y-3">
        <TestResultsProgress />
        {suites.map(({ suite, tests }) => {
          const passed = tests.filter((testCase) => asTestStatus(testCase.status) === "passed").length;
          const failed = tests.filter((testCase) => asTestStatus(testCase.status) === "failed").length;
          const skipped = tests.filter((testCase) => asTestStatus(testCase.status) === "skipped").length;

          return (
            <TestSuite defaultOpen key={suite} name={suite} status={deriveSuiteStatus(tests)}>
              <TestSuiteName>
                {suite}
                <TestSuiteStats passed={passed} failed={failed} skipped={skipped} />
              </TestSuiteName>
              <TestSuiteContent>
                {tests.map((testCase, index) => {
                  const testKey = `${suite}:${testCase.name}:${index}`;

                  return (
                    <Test
                      key={testKey}
                      name={testCase.name}
                      status={asTestStatus(testCase.status)}
                      duration={testCase.duration}
                    >
                      <div className="w-full">
                        <div className="flex items-center gap-2">
                          <TestStatus />
                          <TestName />
                          {typeof testCase.duration === "number" ? <TestDuration /> : null}
                        </div>
                        {asTestStatus(testCase.status) === "failed" &&
                        (testCase.errorMessage || testCase.errorStack) ? (
                          <TestError>
                            {testCase.errorMessage ? (
                              <TestErrorMessage>{testCase.errorMessage}</TestErrorMessage>
                            ) : null}
                            {testCase.errorStack ? <TestErrorStack>{testCase.errorStack}</TestErrorStack> : null}
                          </TestError>
                        ) : null}
                      </div>
                    </Test>
                  );
                })}
              </TestSuiteContent>
            </TestSuite>
          );
        })}
      </TestResultsContent>
    </TestResults>
  );
}

export function WebPreviewShapePreview({ props }: { props: WebPreviewShape["props"] }) {
  const logs = parseWebPreviewLogs(props.logs);

  return (
    <WebPreview className="h-full w-full rounded-[8px] border border-border shadow-sm" defaultUrl={props.url}>
      <WebPreviewNavigation>
        <WebPreviewBackButton />
        <WebPreviewForwardButton />
        <WebPreviewReloadButton />
        <WebPreviewUrl />
        <WebPreviewOpenButton />
      </WebPreviewNavigation>
      <WebPreviewBody />
      <WebPreviewConsole logs={logs} />
    </WebPreview>
  );
}
