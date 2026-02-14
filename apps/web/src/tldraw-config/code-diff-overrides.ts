import { createElement } from "react";
import type { TLUiOverrides } from "tldraw";

const DEFAULT_CODE_DIFF_WIDTH = 600;
const DEFAULT_CODE_DIFF_HEIGHT = 400;

const codeDiffIcon = createElement(
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
      letterSpacing: -0.4,
    },
  },
  "+/-",
) as React.ReactElement<React.HTMLAttributes<HTMLDivElement>>;

export const codeDiffOverrides: TLUiOverrides = {
  tools(editor, tools) {
    tools["code-diff"] = {
      id: "code-diff",
      icon: codeDiffIcon,
      label: "tool.code-diff",
      onSelect() {
        const center = editor.getViewportPageBounds().center;

        editor.createShape({
          type: "code-diff",
          x: center.x - DEFAULT_CODE_DIFF_WIDTH / 2,
          y: center.y - DEFAULT_CODE_DIFF_HEIGHT / 2,
        });

        editor.setCurrentTool("select");
      },
    };
    return tools;
  },
  translations: {
    en: {
      "tool.code-diff": "Code Diff",
    },
  },
};
