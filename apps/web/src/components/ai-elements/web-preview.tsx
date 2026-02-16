"use client";

import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, ExternalLinkIcon, RotateCwIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface WebPreviewContextValue {
  url: string;
  setUrl: (url: string) => void;
  consoleOpen: boolean;
  setConsoleOpen: (open: boolean) => void;
  canGoBack: boolean;
  canGoForward: boolean;
  goBack: () => void;
  goForward: () => void;
  reload: () => void;
  reloadToken: number;
}

const WebPreviewContext = createContext<WebPreviewContextValue | null>(null);

const useWebPreview = () => {
  const context = useContext(WebPreviewContext);
  if (!context) {
    throw new Error("WebPreview components must be used within a WebPreview");
  }
  return context;
};

export type WebPreviewProps = ComponentProps<"div"> & {
  defaultUrl?: string;
  onUrlChange?: (url: string) => void;
};

export const WebPreview = ({ className, children, defaultUrl = "", onUrlChange, ...props }: WebPreviewProps) => {
  const normalizedDefaultUrl = defaultUrl.trim();
  const [url, setUrl] = useState(normalizedDefaultUrl);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [history, setHistory] = useState<string[]>(() => (normalizedDefaultUrl ? [normalizedDefaultUrl] : []));
  const [historyIndex, setHistoryIndex] = useState<number>(() => (normalizedDefaultUrl ? 0 : -1));
  const [reloadToken, setReloadToken] = useState(0);

  const handleUrlChange = useCallback(
    (newUrl: string) => {
      const normalizedUrl = newUrl.trim();
      setUrl(normalizedUrl);
      setHistory((previousHistory) => {
        if (!normalizedUrl) {
          setHistoryIndex(-1);
          return [];
        }

        const currentUrl =
          historyIndex >= 0 && historyIndex < previousHistory.length ? (previousHistory[historyIndex] ?? "") : "";
        if (normalizedUrl === currentUrl) {
          return previousHistory;
        }

        const nextHistory = previousHistory.slice(0, Math.max(0, historyIndex + 1));
        nextHistory.push(normalizedUrl);
        setHistoryIndex(nextHistory.length - 1);
        return nextHistory;
      });
      onUrlChange?.(normalizedUrl);
    },
    [historyIndex, onUrlChange],
  );

  const handleGoBack = useCallback(() => {
    if (historyIndex <= 0) return;
    const nextIndex = historyIndex - 1;
    const nextUrl = history[nextIndex] ?? "";
    setHistoryIndex(nextIndex);
    setUrl(nextUrl);
    onUrlChange?.(nextUrl);
  }, [history, historyIndex, onUrlChange]);

  const handleGoForward = useCallback(() => {
    if (historyIndex < 0 || historyIndex >= history.length - 1) return;
    const nextIndex = historyIndex + 1;
    const nextUrl = history[nextIndex] ?? "";
    setHistoryIndex(nextIndex);
    setUrl(nextUrl);
    onUrlChange?.(nextUrl);
  }, [history, historyIndex, onUrlChange]);

  const handleReload = useCallback(() => {
    setReloadToken((previous) => previous + 1);
  }, []);

  const contextValue = useMemo<WebPreviewContextValue>(
    () => ({
      canGoBack: historyIndex > 0,
      canGoForward: historyIndex >= 0 && historyIndex < history.length - 1,
      consoleOpen,
      goBack: handleGoBack,
      goForward: handleGoForward,
      reload: handleReload,
      reloadToken,
      setConsoleOpen,
      setUrl: handleUrlChange,
      url,
    }),
    [
      consoleOpen,
      handleGoBack,
      handleGoForward,
      handleReload,
      handleUrlChange,
      history,
      historyIndex,
      reloadToken,
      url,
    ],
  );

  return (
    <WebPreviewContext.Provider value={contextValue}>
      <div className={cn("flex size-full flex-col rounded-lg border bg-card", className)} {...props}>
        {children}
      </div>
    </WebPreviewContext.Provider>
  );
};

export type WebPreviewNavigationProps = ComponentProps<"div">;

export const WebPreviewNavigation = ({ className, children, ...props }: WebPreviewNavigationProps) => (
  <div className={cn("flex items-center gap-1 border-b p-2", className)} {...props}>
    {children}
  </div>
);

export type WebPreviewNavigationButtonProps = ComponentProps<typeof Button> & {
  tooltip?: string;
};

export const WebPreviewNavigationButton = ({
  onClick,
  disabled,
  tooltip,
  children,
  ...props
}: WebPreviewNavigationButtonProps) => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          className="h-8 w-8 p-0 hover:text-foreground"
          disabled={disabled}
          onClick={onClick}
          size="sm"
          variant="ghost"
          {...props}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{tooltip}</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

export type WebPreviewBackButtonProps = Omit<WebPreviewNavigationButtonProps, "onClick" | "disabled" | "tooltip">;

export const WebPreviewBackButton = ({ children, ...props }: WebPreviewBackButtonProps) => {
  const { canGoBack, goBack } = useWebPreview();

  return (
    <WebPreviewNavigationButton disabled={!canGoBack} onClick={goBack} tooltip="Back" {...props}>
      {children ?? <ChevronLeftIcon className="size-4" />}
    </WebPreviewNavigationButton>
  );
};

export type WebPreviewForwardButtonProps = Omit<WebPreviewNavigationButtonProps, "onClick" | "disabled" | "tooltip">;

export const WebPreviewForwardButton = ({ children, ...props }: WebPreviewForwardButtonProps) => {
  const { canGoForward, goForward } = useWebPreview();

  return (
    <WebPreviewNavigationButton disabled={!canGoForward} onClick={goForward} tooltip="Forward" {...props}>
      {children ?? <ChevronRightIcon className="size-4" />}
    </WebPreviewNavigationButton>
  );
};

export type WebPreviewReloadButtonProps = Omit<WebPreviewNavigationButtonProps, "onClick" | "tooltip">;

export const WebPreviewReloadButton = ({ children, ...props }: WebPreviewReloadButtonProps) => {
  const { reload } = useWebPreview();

  return (
    <WebPreviewNavigationButton onClick={reload} tooltip="Reload" {...props}>
      {children ?? <RotateCwIcon className="size-4" />}
    </WebPreviewNavigationButton>
  );
};

export type WebPreviewOpenButtonProps = Omit<WebPreviewNavigationButtonProps, "onClick" | "disabled" | "tooltip">;

export const WebPreviewOpenButton = ({ children, ...props }: WebPreviewOpenButtonProps) => {
  const { url } = useWebPreview();

  const handleOpen = useCallback(() => {
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  }, [url]);

  return (
    <WebPreviewNavigationButton disabled={!url} onClick={handleOpen} tooltip="Open in new tab" {...props}>
      {children ?? <ExternalLinkIcon className="size-4" />}
    </WebPreviewNavigationButton>
  );
};

export type WebPreviewUrlProps = ComponentProps<typeof Input>;

export const WebPreviewUrl = ({ value, onChange, onKeyDown, ...props }: WebPreviewUrlProps) => {
  const { url, setUrl } = useWebPreview();
  const [prevUrl, setPrevUrl] = useState(url);
  const [inputValue, setInputValue] = useState(url);

  // Sync input value with context URL when it changes externally (derived state pattern)
  if (url !== prevUrl) {
    setPrevUrl(url);
    setInputValue(url);
  }

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value);
    onChange?.(event);
  };

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        const target = event.target as HTMLInputElement;
        setUrl(target.value);
      }
      onKeyDown?.(event);
    },
    [setUrl, onKeyDown],
  );

  return (
    <Input
      className="h-8 flex-1 text-sm"
      onChange={onChange ?? handleChange}
      onKeyDown={handleKeyDown}
      placeholder="Enter URL..."
      value={value ?? inputValue}
      {...props}
    />
  );
};

export type WebPreviewBodyProps = ComponentProps<"iframe"> & {
  loading?: ReactNode;
};

export const WebPreviewBody = ({ className, loading, src, ...props }: WebPreviewBodyProps) => {
  const { url, reloadToken } = useWebPreview();
  const resolvedSrc = (src ?? url) || undefined;

  return (
    <div className="flex-1">
      <iframe
        className={cn("size-full", className)}
        key={`${resolvedSrc ?? "empty"}:${reloadToken}`}
        // oxlint-disable-next-line eslint-plugin-react(iframe-missing-sandbox)
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation"
        src={resolvedSrc}
        title="Preview"
        {...props}
      />
      {loading}
    </div>
  );
};

export type WebPreviewConsoleProps = ComponentProps<"div"> & {
  logs?: {
    level: "log" | "warn" | "error";
    message: string;
    timestamp: Date;
  }[];
};

export const WebPreviewConsole = ({ className, logs = [], children, ...props }: WebPreviewConsoleProps) => {
  const { consoleOpen, setConsoleOpen } = useWebPreview();

  return (
    <Collapsible
      className={cn("border-t bg-muted/50 font-mono text-sm", className)}
      onOpenChange={setConsoleOpen}
      open={consoleOpen}
      {...props}
    >
      <CollapsibleTrigger asChild>
        <Button
          className="flex w-full items-center justify-between p-4 text-left font-medium hover:bg-muted/50"
          variant="ghost"
        >
          Console
          <ChevronDownIcon className={cn("h-4 w-4 transition-transform duration-200", consoleOpen && "rotate-180")} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent
        className={cn(
          "px-4 pb-4",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 outline-none data-[state=closed]:animate-out data-[state=open]:animate-in",
        )}
      >
        <div className="max-h-48 space-y-1 overflow-y-auto scrollbar-thin">
          {logs.length === 0 ? (
            <p className="text-muted-foreground">No console output</p>
          ) : (
            logs.map((log, index) => (
              <div
                className={cn(
                  "text-xs",
                  log.level === "error" && "text-destructive",
                  log.level === "warn" && "text-yellow-600",
                  log.level === "log" && "text-foreground",
                )}
                key={`${log.timestamp.getTime()}-${index}`}
              >
                <span className="text-muted-foreground">{log.timestamp.toLocaleTimeString()}</span> {log.message}
              </div>
            ))
          )}
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};
