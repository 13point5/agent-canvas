import { createElement } from "react";
import { Markdown } from "@react-symbols/icons";
import type { TLUiOverrides } from "tldraw";

// Module-level callback ref so the toolbar override can open the dialog
// rendered inside the <Tldraw> tree.
export let openMarkdownDialog: (() => void) | null = null;
export let openCodeReviewDialog: (() => void) | null = null;

export function setOpenMarkdownDialog(fn: (() => void) | null) {
  openMarkdownDialog = fn;
}

export function setOpenCodeReviewDialog(fn: (() => void) | null) {
  openCodeReviewDialog = fn;
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
  createElement(Markdown, { width: 18, height: 18 })
) as React.ReactElement<React.HTMLAttributes<HTMLDivElement>>;

const codeReviewIcon = createElement(
  "div",
  {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: 18,
      height: 18,
      fontSize: 12,
      fontWeight: 700,
    },
  },
  "Δ"
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
    tools.codeReview = {
      id: "codeReview",
      icon: codeReviewIcon,
      label: "tool.codeReview" as "tool.select",
      onSelect() {
        openCodeReviewDialog?.();
      },
    };
    return tools;
  },
  translations: {
    en: {
      "tool.markdown": "Markdown",
      "tool.codeReview": "Code Review",
    },
  },
};
