import { createElement } from "react";
import { Database, Markdown } from "@react-symbols/icons";
import type { TLUiOverrides } from "tldraw";

// Module-level callback refs so toolbar overrides can open dialogs
// rendered inside the <Tldraw> tree.
export let openMarkdownDialog: (() => void) | null = null;
export let openDbSchemaDialog: (() => void) | null = null;

export function setOpenMarkdownDialog(fn: (() => void) | null) {
  openMarkdownDialog = fn;
}

export function setOpenDbSchemaDialog(fn: (() => void) | null) {
  openDbSchemaDialog = fn;
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

const dbSchemaIcon = createElement(
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
  createElement(Database, { width: 18, height: 18 }),
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

    tools.dbSchema = {
      id: "dbSchema",
      icon: dbSchemaIcon,
      label: "tool.dbSchema" as "tool.select",
      onSelect() {
        openDbSchemaDialog?.();
      },
    };

    return tools;
  },
  translations: {
    en: {
      "tool.markdown": "Markdown",
      "tool.dbSchema": "DB Schema",
    },
  },
};
