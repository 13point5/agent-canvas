import { Http } from "@react-symbols/icons";
import { createElement } from "react";
import type { TLUiOverrides } from "tldraw";

// Module-level callback ref so the toolbar override can open the dialog
// rendered inside the <Tldraw> tree.
export let openHtmlDialog: (() => void) | null = null;

export function setOpenHtmlDialog(fn: (() => void) | null) {
  openHtmlDialog = fn;
}

const codeIcon = createElement(
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
  createElement(Http, { width: 18, height: 18 }),
) as React.ReactElement<React.HTMLAttributes<HTMLDivElement>>;

export const htmlOverrides: TLUiOverrides = {
  tools(_editor, tools) {
    tools.html = {
      id: "html",
      icon: codeIcon,
      label: "tool.html",
      onSelect() {
        openHtmlDialog?.();
      },
    };
    return tools;
  },
  translations: {
    en: {
      "tool.html": "HTML Artifact",
    },
  },
};
