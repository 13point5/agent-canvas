import { createElement } from "react";
import type { TLUiOverrides } from "tldraw";

const DEFAULT_TERMINAL_WIDTH = 680;
const DEFAULT_TERMINAL_HEIGHT = 420;

const terminalIcon = createElement(
  "div",
  {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: 18,
      height: 18,
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: -0.6,
    },
  },
  ">_",
) as React.ReactElement<React.HTMLAttributes<HTMLDivElement>>;

export const terminalOverrides: TLUiOverrides = {
  tools(editor, tools) {
    tools.terminal = {
      id: "terminal",
      icon: terminalIcon,
      label: "tool.terminal",
      onSelect() {
        const center = editor.getViewportPageBounds().center;

        editor.createShape({
          type: "terminal",
          x: center.x - DEFAULT_TERMINAL_WIDTH / 2,
          y: center.y - DEFAULT_TERMINAL_HEIGHT / 2,
        });

        editor.setCurrentTool("select");
      },
    };
    return tools;
  },
  translations: {
    en: {
      "tool.terminal": "Terminal",
    },
  },
};
