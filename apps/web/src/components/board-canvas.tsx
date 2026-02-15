import {
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ArrowUp01Icon,
  CancelSquareIcon,
  CheckmarkSquare01Icon,
  CircleIcon,
  CloudIcon,
  CodeIcon,
  ComputerTerminal01Icon,
  Cursor01Icon,
  CursorTextIcon,
  DashedLine01Icon,
  DiamondIcon,
  EraserIcon,
  FlashIcon,
  GitCompareIcon,
  HeartCheckIcon,
  HexagonIcon,
  HighlighterIcon,
  Image01Icon,
  MoreHorizontalIcon,
  OvalIcon,
  PencilIcon,
  RhombusIcon,
  ShapesIcon,
  SquareIcon,
  StarIcon,
  StickyNote02Icon,
  TouchInteraction01Icon,
  TriangleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Markdown } from "@react-symbols/icons";
import { useState } from "react";
import { GeoShapeGeoStyle, type TLUiOverrides, Tldraw, useEditor, useTools, useValue } from "tldraw";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useBoardPersistence } from "@/hooks/api/use-board-persistence";
import { BoardChatPromptHud } from "@/tldraw-config/chat-hud";
import { cn } from "@/lib/utils";
import { codeDiffOverrides } from "@/tldraw-config/code-diff-overrides";
import { htmlOverrides } from "@/tldraw-config/html-overrides";
import { HtmlDialogOverlay } from "@/tldraw-config/html-toolbar";
import { markdownOverrides, openMarkdownDialog } from "@/tldraw-config/markdown-overrides";
import { MarkdownDialogOverlay } from "@/tldraw-config/markdown-toolbar";
import { SelectionIdsToolbar } from "@/tldraw-config/selection-ids-toolbar";
import { terminalOverrides } from "@/tldraw-config/terminal-overrides";
import { CodeDiffShapeUtil } from "@/tldraw-shapes/code-diff";
import { HtmlShapeUtil } from "@/tldraw-shapes/html";
import { MarkdownShapeUtil } from "@/tldraw-shapes/markdown";
import { TerminalShapeUtil } from "@/tldraw-shapes/terminal";

const customShapeUtils = [MarkdownShapeUtil, HtmlShapeUtil, CodeDiffShapeUtil, TerminalShapeUtil];

const overflowToolOrder = [
  "text",
  "asset",
  "triangle",
  "diamond",
  "hexagon",
  "oval",
  "rhombus",
  "star",
  "cloud",
  "heart",
  "x-box",
  "check-box",
  "arrow-left",
  "arrow-up",
  "arrow-down",
  "arrow-right",
  "line",
  "highlight",
  "laser",
  "frame",
  "html",
  "code-diff",
];

const toolLabels: Record<string, string> = {
  text: "Text",
  asset: "Media",
  triangle: "Triangle",
  diamond: "Diamond",
  hexagon: "Hexagon",
  oval: "Oval",
  rhombus: "Rhombus",
  star: "Star",
  cloud: "Cloud",
  heart: "Heart",
  "x-box": "X Box",
  "check-box": "Check Box",
  "arrow-left": "Arrow Left",
  "arrow-up": "Arrow Up",
  "arrow-down": "Arrow Down",
  "arrow-right": "Arrow Right",
  line: "Line",
  highlight: "Highlight",
  laser: "Laser",
  frame: "Frame",
  html: "HTML Artifact",
  "code-diff": "Code Diff",
};

const overflowToolIcons: Record<string, React.ComponentProps<typeof HugeiconsIcon>["icon"]> = {
  text: CursorTextIcon,
  asset: Image01Icon,
  triangle: TriangleIcon,
  diamond: DiamondIcon,
  hexagon: HexagonIcon,
  oval: OvalIcon,
  rhombus: RhombusIcon,
  star: StarIcon,
  cloud: CloudIcon,
  heart: HeartCheckIcon,
  "x-box": CancelSquareIcon,
  "check-box": CheckmarkSquare01Icon,
  "arrow-left": ArrowLeft01Icon,
  "arrow-up": ArrowUp01Icon,
  "arrow-down": ArrowDown01Icon,
  "arrow-right": ArrowRight01Icon,
  line: DashedLine01Icon,
  highlight: HighlighterIcon,
  laser: FlashIcon,
  frame: ShapesIcon,
  html: CodeIcon,
  "code-diff": GitCompareIcon,
};

const activeToolClasses = "border border-transparent bg-[#5f5f5f] text-white shadow-none ring-0 hover:bg-[#5f5f5f]";
const inactiveToolClasses = "border border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/70";

const combinedOverrides: TLUiOverrides = {
  tools(editor, tools, helpers) {
    markdownOverrides.tools?.(editor, tools, helpers);
    htmlOverrides.tools?.(editor, tools, helpers);
    codeDiffOverrides.tools?.(editor, tools, helpers);
    terminalOverrides.tools?.(editor, tools, helpers);
    return tools;
  },
  translations: {
    ...markdownOverrides.translations,
    en: {
      ...(markdownOverrides.translations as Record<string, Record<string, string>>)?.en,
      ...(htmlOverrides.translations as Record<string, Record<string, string>>)?.en,
      ...(codeDiffOverrides.translations as Record<string, Record<string, string>>)?.en,
      ...(terminalOverrides.translations as Record<string, Record<string, string>>)?.en,
    },
  },
};

function CombinedDialogOverlay() {
  return (
    <>
      <SelectionIdsToolbar />
      <BoardChatPromptHud />
      <MarkdownDialogOverlay />
      <HtmlDialogOverlay />
    </>
  );
}

interface MinimalToolButtonProps {
  active?: boolean;
  icon: React.ComponentProps<typeof HugeiconsIcon>["icon"];
  label: string;
  onClick: () => void;
}

function MinimalToolButton({ active = false, icon, label, onClick }: MinimalToolButtonProps) {
  return (
    <Button
      type="button"
      variant={active ? "secondary" : "ghost"}
      size="icon-sm"
      className={cn(
        "h-8 w-8 rounded-md transition-all pointer-events-auto",
        active ? activeToolClasses : inactiveToolClasses,
      )}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      <HugeiconsIcon icon={icon} strokeWidth={2} className="size-4" />
    </Button>
  );
}

function MinimalToolbar() {
  const editor = useEditor();
  const tools = useTools();
  const [overflowOpen, setOverflowOpen] = useState(false);
  const activeToolId = useValue("minimal-toolbar.active-tool", () => editor.getCurrentToolId(), [editor]);
  const activeGeo = useValue(
    "minimal-toolbar.active-geo",
    () => editor.getSharedStyles().getAsKnownValue(GeoShapeGeoStyle),
    [editor],
  );
  const availableOverflowTools = overflowToolOrder.filter((toolId) => Boolean(tools[toolId]));

  const selectTool = () => {
    if (editor.isIn("select")) {
      const currentNode = editor.root.getCurrent();
      if (currentNode) {
        currentNode.exit({}, currentNode.id);
        currentNode.enter({}, currentNode.id);
      }
    }
    editor.setCurrentTool("select");
  };

  const setGeoTool = (geo: "rectangle" | "ellipse") => {
    editor.run(() => {
      editor.setStyleForNextShapes(GeoShapeGeoStyle, geo);
      editor.setCurrentTool("geo");
    });
  };

  const insertTerminal = () => {
    const center = editor.getViewportPageBounds().center;
    const width = 680;
    const height = 420;
    editor.createShape({
      type: "terminal",
      x: center.x - width / 2,
      y: center.y - height / 2,
    });
    editor.setCurrentTool("select");
  };

  const isToolActive = (toolId: string) => {
    const tool = tools[toolId];
    if (!tool) return false;
    const geo = tool.meta?.geo as string | undefined;
    if (geo) return activeToolId === "geo" && activeGeo === geo;
    return activeToolId === toolId;
  };

  const selectToolById = (toolId: string) => {
    switch (toolId) {
      case "select":
        selectTool();
        return;
      case "hand":
        editor.setCurrentTool("hand");
        return;
      case "draw":
        editor.setCurrentTool("draw");
        return;
      case "eraser":
        editor.setCurrentTool("eraser");
        return;
      case "arrow":
        editor.setCurrentTool("arrow");
        return;
      case "note":
        editor.setCurrentTool("note");
        return;
      case "rectangle":
        setGeoTool("rectangle");
        return;
      case "ellipse":
        setGeoTool("ellipse");
        return;
      case "markdown":
        openMarkdownDialog?.();
        return;
      case "terminal":
        insertTerminal();
        return;
      default:
        tools[toolId]?.onSelect("toolbar");
    }
  };

  const overflowActive = availableOverflowTools.some((toolId) => isToolActive(toolId));

  return (
    <div className="absolute left-3 top-1/2 z-40 -translate-y-1/2 rounded-xl border border-border/80 bg-background/80 p-1 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/70 pointer-events-auto">
      <div className="flex flex-col gap-1">
        <MinimalToolButton
          active={activeToolId === "select"}
          icon={Cursor01Icon}
          label="Select"
          onClick={() => selectToolById("select")}
        />
        <MinimalToolButton
          active={activeToolId === "hand"}
          icon={TouchInteraction01Icon}
          label="Pan"
          onClick={() => selectToolById("hand")}
        />
        <MinimalToolButton
          active={activeToolId === "geo" && activeGeo === "rectangle"}
          icon={SquareIcon}
          label="Rectangle"
          onClick={() => selectToolById("rectangle")}
        />
        <MinimalToolButton
          active={activeToolId === "geo" && activeGeo === "ellipse"}
          icon={CircleIcon}
          label="Circle"
          onClick={() => selectToolById("ellipse")}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="h-8 w-8 rounded-md text-muted-foreground hover:text-foreground pointer-events-auto"
          aria-label="Markdown"
          title="Markdown"
          onClick={() => selectToolById("markdown")}
        >
          <Markdown width={16} height={16} />
        </Button>
        <MinimalToolButton icon={ComputerTerminal01Icon} label="Terminal" onClick={() => selectToolById("terminal")} />
        <MinimalToolButton
          active={activeToolId === "note"}
          icon={StickyNote02Icon}
          label="Sticky Note"
          onClick={() => selectToolById("note")}
        />
        <MinimalToolButton
          active={activeToolId === "draw"}
          icon={PencilIcon}
          label="Pencil"
          onClick={() => selectToolById("draw")}
        />
        <MinimalToolButton
          active={activeToolId === "eraser"}
          icon={EraserIcon}
          label="Eraser"
          onClick={() => selectToolById("eraser")}
        />
        <MinimalToolButton
          active={activeToolId === "arrow"}
          icon={ArrowRight01Icon}
          label="Arrow"
          onClick={() => selectToolById("arrow")}
        />
        <DropdownMenu open={overflowOpen} onOpenChange={setOverflowOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant={overflowActive ? "secondary" : "ghost"}
              size="icon-sm"
              className={cn(
                "h-8 w-8 rounded-md pointer-events-auto transition-all",
                overflowActive ? activeToolClasses : inactiveToolClasses,
              )}
              aria-label="More tools"
              title="More tools"
            >
              <HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={2} className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="right"
            align="start"
            sideOffset={10}
            className="w-auto min-w-0 pointer-events-auto rounded-xl p-2"
          >
            <div className="grid grid-cols-4 gap-1">
              {availableOverflowTools.map((toolId) => {
                const active = isToolActive(toolId);
                const label = toolLabels[toolId] ?? toolId;
                const icon = overflowToolIcons[toolId] ?? ShapesIcon;

                return (
                  <Button
                    key={toolId}
                    type="button"
                    variant={active ? "secondary" : "ghost"}
                    size="icon-sm"
                    className={cn(
                      "h-8 w-8 rounded-md pointer-events-auto transition-all",
                      active ? activeToolClasses : inactiveToolClasses,
                    )}
                    aria-label={label}
                    title={label}
                    onClick={() => {
                      selectToolById(toolId);
                      setOverflowOpen(false);
                    }}
                  >
                    <HugeiconsIcon icon={icon} strokeWidth={2} className="size-4" />
                  </Button>
                );
              })}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

interface BoardCanvasProps {
  boardId: string;
}

export function BoardCanvas({ boardId }: BoardCanvasProps) {
  const { handleMount } = useBoardPersistence(boardId);

  return (
    <div className="h-full w-full" key={boardId}>
      <Tldraw
        onMount={handleMount}
        shapeUtils={customShapeUtils}
        overrides={combinedOverrides}
        components={{
          MenuPanel: null,
          HelperButtons: null,
          Toolbar: MinimalToolbar,
          InFrontOfTheCanvas: CombinedDialogOverlay,
        }}
      />
    </div>
  );
}
