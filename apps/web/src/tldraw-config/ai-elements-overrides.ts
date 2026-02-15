import { createElement } from "react";
import type { TLUiOverrides } from "tldraw";

type AiElementToolConfig = {
  id:
    | "artifact"
    | "file-tree"
    | "schema-display"
    | "snippet"
    | "stack-trace"
    | "ai-terminal"
    | "test-results"
    | "web-preview";
  label: string;
  iconText: string;
  width: number;
  height: number;
};

const aiElementToolConfigs: AiElementToolConfig[] = [
  { id: "artifact", label: "Artifact", iconText: "AR", width: 560, height: 320 },
  { id: "file-tree", label: "File Tree", iconText: "FT", width: 460, height: 360 },
  { id: "schema-display", label: "Schema Display", iconText: "API", width: 620, height: 420 },
  { id: "snippet", label: "Snippet", iconText: "<>", width: 560, height: 84 },
  { id: "stack-trace", label: "Stack Trace", iconText: "ST", width: 660, height: 360 },
  { id: "ai-terminal", label: "AI Terminal", iconText: "$_", width: 680, height: 380 },
  { id: "test-results", label: "Test Results", iconText: "TS", width: 640, height: 420 },
  { id: "web-preview", label: "Web Preview", iconText: "WEB", width: 700, height: 460 },
];

function createTextIcon(text: string) {
  return createElement(
    "div",
    {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 18,
        height: 18,
        fontSize: text.length > 2 ? 7 : 9,
        fontWeight: 700,
        letterSpacing: text.length > 2 ? -0.2 : -0.4,
      },
    },
    text,
  ) as React.ReactElement<React.HTMLAttributes<HTMLDivElement>>;
}

const iconByType = Object.fromEntries(
  aiElementToolConfigs.map((config) => [config.id, createTextIcon(config.iconText)]),
) as Record<AiElementToolConfig["id"], React.ReactElement<React.HTMLAttributes<HTMLDivElement>>>;

const translations = Object.fromEntries(
  aiElementToolConfigs.map((config) => [`tool.${config.id}`, config.label]),
) as Record<string, string>;

export const aiElementsOverrides: TLUiOverrides = {
  tools(editor, tools) {
    for (const config of aiElementToolConfigs) {
      tools[config.id] = {
        id: config.id,
        icon: iconByType[config.id],
        label: `tool.${config.id}`,
        onSelect() {
          const center = editor.getViewportPageBounds().center;

          editor.createShape({
            type: config.id,
            x: center.x - config.width / 2,
            y: center.y - config.height / 2,
          });

          editor.setCurrentTool("select");
        },
      };
    }

    return tools;
  },
  translations: {
    en: translations,
  },
};
