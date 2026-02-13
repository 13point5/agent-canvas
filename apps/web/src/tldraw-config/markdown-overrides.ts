import { Markdown } from "@react-symbols/icons";
import { createElement } from "react";
import type { TLUiOverrides } from "tldraw";

// Module-level callback ref so the toolbar override can open the dialog
// rendered inside the <Tldraw> tree.
export let openMarkdownDialog: (() => void) | null = null;

export function setOpenMarkdownDialog(fn: (() => void) | null) {
  openMarkdownDialog = fn;
}

const markdownIcon = createElement(
  "div",
  {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: 18,
      height: 18,
    },
  },
  createElement(Markdown, { width: 18, height: 18 }),
) as React.ReactElement<React.HTMLAttributes<HTMLDivElement>>;

export const markdownOverrides: TLUiOverrides = {
  tools(_editor, tools) {
    tools.markdown = {
      id: "markdown",
      icon: markdownIcon,
      label: "tool.markdown" as "tool.select",
      onSelect() {
        openMarkdownDialog?.();
      },
    };
    return tools;
  },
  translations: {
    en: {
      "tool.markdown": "Markdown",
    },
  },
};
