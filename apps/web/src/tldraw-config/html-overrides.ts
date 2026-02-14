import { createElement } from "react";
import type { TLUiOverrides } from "tldraw";

// Module-level callback ref so the toolbar override can open the dialog
// rendered inside the <Tldraw> tree.
export let openHtmlDialog: (() => void) | null = null;

export function setOpenHtmlDialog(fn: (() => void) | null) {
  openHtmlDialog = fn;
}

const codeBracketsIcon = createElement(
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
  createElement(
    "svg",
    {
      width: 18,
      height: 18,
      viewBox: "0 0 16 16",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 1.5,
      strokeLinecap: "round",
      strokeLinejoin: "round",
    },
    createElement("polyline", { points: "5 4 1 8 5 12" }),
    createElement("polyline", { points: "11 4 15 8 11 12" }),
    createElement("line", { x1: 9, y1: 2, x2: 7, y2: 14 }),
  ),
) as React.ReactElement<React.HTMLAttributes<HTMLDivElement>>;

export const htmlOverrides: TLUiOverrides = {
  tools(_editor, tools, _helpers) {
    tools.html = {
      id: "html",
      icon: codeBracketsIcon,
      label: "tool.html" as "tool.select",
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
