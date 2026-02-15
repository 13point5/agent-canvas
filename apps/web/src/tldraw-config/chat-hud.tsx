import { Folder01Icon, Infinity01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ChatStatus } from "ai";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useToasts } from "tldraw";

import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const SUBMIT_RESET_DELAY_MS = 180;
const AGENT_COUNT_OPTIONS = [1, 2, 3, 4] as const;
const AGENT_OPTIONS = [
  { id: "claude-code", label: "Claude Code", iconSrc: "/agent-logos/claude-code.svg" },
  { id: "codex", label: "Codex", iconSrc: "/agent-logos/codex.svg" },
  { id: "cursor", label: "Cursor", iconSrc: "/agent-logos/cursor.svg" },
  { id: "open-code", label: "Open Code", iconSrc: "/agent-logos/open-code.svg" },
] as const;

type AgentId = (typeof AGENT_OPTIONS)[number]["id"];
type AgentCount = (typeof AGENT_COUNT_OPTIONS)[number];
type AgentSelection = {
  enabled: boolean;
  count: AgentCount;
};
type AgentSelections = Record<AgentId, AgentSelection>;
type FolderOption = {
  id: string;
  name: string;
  handle: FileSystemDirectoryHandle;
};

const DEFAULT_AGENT_SELECTIONS: AgentSelections = {
  cursor: { enabled: true, count: 1 },
  codex: { enabled: true, count: 1 },
  "open-code": { enabled: false, count: 1 },
  "claude-code": { enabled: false, count: 1 },
};

const AGENT_ICON_SRC_BY_ID: Record<AgentId, string> = {
  cursor: "/agent-logos/cursor.svg",
  codex: "/agent-logos/codex.svg",
  "claude-code": "/agent-logos/claude-code.svg",
  "open-code": "/agent-logos/open-code.svg",
};

const AGENT_ICON_SIZE_CLASS_BY_ID: Record<AgentId, string> = {
  cursor: "size-4",
  codex: "size-4",
  "claude-code": "size-3.5",
  "open-code": "size-3.5",
};

function AgentAvatar({
  agentId,
  label,
  selected,
  className,
}: {
  agentId: AgentId;
  label: string;
  selected: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex size-7 items-center justify-center overflow-hidden rounded-full border bg-card",
        selected ? "border-primary/80 ring-1 ring-primary/30" : "border-border/70",
        className,
      )}
    >
      <img
        src={AGENT_ICON_SRC_BY_ID[agentId]}
        alt={label}
        className={cn("object-contain", AGENT_ICON_SIZE_CLASS_BY_ID[agentId])}
      />
    </span>
  );
}

export function BoardChatPromptHud() {
  const { addToast } = useToasts();
  const [status, setStatus] = useState<ChatStatus>("ready");
  const [agentMenuOpen, setAgentMenuOpen] = useState(false);
  const [folderMenuOpen, setFolderMenuOpen] = useState(false);
  const [folders, setFolders] = useState<FolderOption[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [agentSelections, setAgentSelections] = useState<AgentSelections>(DEFAULT_AGENT_SELECTIONS);

  const selectedAgents = useMemo(
    () => AGENT_OPTIONS.filter((agent) => agentSelections[agent.id].enabled),
    [agentSelections],
  );
  const totalAgentCount = useMemo(
    () => selectedAgents.reduce((total, agent) => total + agentSelections[agent.id].count, 0),
    [agentSelections, selectedAgents],
  );
  const routingSummary = useMemo(() => {
    if (selectedAgents.length === 0) {
      return "No agents selected";
    }
    return selectedAgents.map((agent) => `${agent.label} ${agentSelections[agent.id].count}x`).join(", ");
  }, [agentSelections, selectedAgents]);
  const selectedFolder = useMemo(
    () => folders.find((folder) => folder.id === selectedFolderId) ?? null,
    [folders, selectedFolderId],
  );
  const selectedFolderLabel = useMemo(() => {
    if (!selectedFolder) {
      return "No folder selected";
    }
    return selectedFolder.name;
  }, [selectedFolder]);

  const handleFolderMenuOpenChange = useCallback((open: boolean) => {
    setFolderMenuOpen(open);
  }, []);

  const handlePickFolder = useCallback(async () => {
    const picker = (
      window as Window & {
        showDirectoryPicker?: (options?: { mode?: "read" | "readwrite" }) => Promise<FileSystemDirectoryHandle>;
      }
    ).showDirectoryPicker;
    if (!picker) {
      addToast({
        title: "Folder picker unavailable",
        description: "This browser does not support system folder picking.",
        severity: "error",
      });
      return;
    }

    try {
      const handle = await picker({ mode: "readwrite" });
      let nextSelectedId: string | null = null;

      setFolders((current) => {
        const existing = current.find((folder) => folder.name === handle.name);
        if (existing) {
          nextSelectedId = existing.id;
          return current;
        }

        const nextFolder: FolderOption = {
          id: crypto.randomUUID(),
          name: handle.name,
          handle,
        };
        nextSelectedId = nextFolder.id;
        return [...current, nextFolder];
      });

      if (nextSelectedId) {
        setSelectedFolderId(nextSelectedId);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      addToast({
        title: "Could not select folder",
        description: "Try again or choose a different folder.",
        severity: "error",
      });
    }
  }, [addToast]);

  const handleAgentMenuOpenChange = useCallback((open: boolean) => {
    setAgentMenuOpen(open);
  }, []);

  const handleToggleAgent = useCallback((agentId: AgentId) => {
    setAgentSelections((current) => ({
      ...current,
      [agentId]: {
        ...current[agentId],
        enabled: !current[agentId].enabled,
      },
    }));
  }, []);

  const handleCountChange = useCallback((agentId: AgentId, rawValue: string) => {
    const parsedCount = Number.parseInt(rawValue, 10);
    if (!AGENT_COUNT_OPTIONS.includes(parsedCount as AgentCount)) {
      return;
    }
    setAgentSelections((current) => ({
      ...current,
      [agentId]: {
        ...current[agentId],
        count: parsedCount as AgentCount,
      },
    }));
  }, []);

  const handleSubmit = useCallback(
    async ({ text }: PromptInputMessage) => {
      const prompt = text.trim();
      if (!prompt) {
        return;
      }
      if (selectedAgents.length === 0) {
        addToast({
          title: "Select at least one agent",
          description: "Choose one or more coding agents before sending the prompt.",
          severity: "error",
        });
        return;
      }
      if (!selectedFolderId) {
        addToast({
          title: "Select a folder",
          description: "Pick a folder from the folder dropdown before sending the prompt.",
          severity: "error",
        });
        return;
      }

      setStatus("submitted");
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, SUBMIT_RESET_DELAY_MS);
      });
      setStatus("ready");

      addToast({
        title: "Prompt captured",
        description: `Routing: ${routingSummary} · Folder: ${selectedFolderLabel}`,
        severity: "info",
      });
    },
    [addToast, routingSummary, selectedAgents.length, selectedFolderId, selectedFolderLabel],
  );

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 z-50 flex justify-center px-3 pb-[max(env(safe-area-inset-bottom),0px)] md:bottom-4 md:px-4">
      <div className="pointer-events-auto w-full max-w-2xl">
        <PromptInput
          onSubmit={(message) => {
            void handleSubmit(message);
          }}
          className="[&>[data-slot=input-group]]:rounded-3xl [&>[data-slot=input-group]]:border-border/70 [&>[data-slot=input-group]]:bg-background/95 [&>[data-slot=input-group]]:shadow-[0_2px_8px_rgba(15,23,42,0.08)] [&>[data-slot=input-group]]:backdrop-blur-md"
        >
          <PromptInputBody>
            <PromptInputTextarea
              className="min-h-14 pl-4"
              placeholder="Launch a swarm and prompt multiple agents at once..."
            />
          </PromptInputBody>
          <PromptInputFooter className="pb-2">
            <PromptInputTools className="min-w-0 flex-1 gap-2 px-1">
              <DropdownMenu open={folderMenuOpen} onOpenChange={handleFolderMenuOpenChange} modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 max-w-44 rounded-full border-border/80 px-2.5 text-xs font-medium"
                  >
                    <HugeiconsIcon icon={Folder01Icon} className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 truncate">
                      {selectedFolderLabel === "No folder selected" ? "Choose folder" : selectedFolderLabel}
                    </span>
                    <ChevronDownIcon className="size-3.5 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  side="top"
                  align="start"
                  sideOffset={8}
                  className="z-[1000] w-auto min-w-80 p-0"
                  style={{ width: 360 }}
                  onCloseAutoFocus={(event) => {
                    event.preventDefault();
                  }}
                >
                  <div className="border-b border-border/70 p-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 w-full justify-start"
                      onClick={() => void handlePickFolder()}
                    >
                      Choose folder...
                    </Button>
                  </div>
                  <div className="max-h-64 space-y-1 overflow-y-auto p-2">
                    {folders.length === 0 ? (
                      <p className="px-2 py-3 text-xs text-muted-foreground">No folders added yet.</p>
                    ) : (
                      folders.map((folder) => (
                        <Button
                          key={folder.id}
                          type="button"
                          variant="ghost"
                          size="sm"
                          className={cn(
                            "h-8 w-full justify-between rounded-lg px-2 text-left text-xs font-normal",
                            selectedFolderId === folder.id && "bg-accent/60",
                          )}
                          onClick={() => setSelectedFolderId(folder.id)}
                        >
                          <span className="truncate">{folder.name}</span>
                          <CheckIcon
                            className={cn("size-3.5 shrink-0", selectedFolderId !== folder.id && "opacity-0")}
                          />
                        </Button>
                      ))
                    )}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu open={agentMenuOpen} onOpenChange={handleAgentMenuOpenChange} modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 rounded-full border-border/80 px-2.5 text-xs font-medium"
                  >
                    <HugeiconsIcon icon={Infinity01Icon} className="size-3.5 shrink-0 text-muted-foreground" />
                    Agents
                    <ChevronDownIcon className="size-3.5 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  side="top"
                  align="start"
                  sideOffset={8}
                  className="z-[1000] w-auto min-w-80 p-0"
                  style={{ width: 340 }}
                  onCloseAutoFocus={(event) => {
                    event.preventDefault();
                  }}
                >
                  <div className="max-h-72 space-y-1 overflow-y-auto p-2">
                    {AGENT_OPTIONS.map((agent) => {
                      const selection = agentSelections[agent.id];
                      return (
                        <div
                          key={agent.id}
                          className={cn(
                            "flex items-center gap-2 rounded-xl border border-transparent px-1 py-1 transition-colors",
                            selection.enabled && "bg-accent/60",
                          )}
                        >
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-9 flex-1 justify-start gap-1.5 px-2 text-sm font-normal"
                            title={agent.label}
                            aria-label={agent.label}
                            onClick={() => handleToggleAgent(agent.id)}
                          >
                            <img
                              src={AGENT_ICON_SRC_BY_ID[agent.id]}
                              alt={agent.label}
                              className={cn("shrink-0 object-contain", AGENT_ICON_SIZE_CLASS_BY_ID[agent.id])}
                            />
                            <span className="truncate">{agent.label}</span>
                          </Button>
                          <Select
                            value={`${selection.count}`}
                            onValueChange={(value) => handleCountChange(agent.id, value)}
                            disabled={!selection.enabled}
                          >
                            <SelectTrigger className="h-8 w-16 rounded-lg border-border/70 px-2 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent align="end" className="z-[1010] p-1">
                              {AGENT_COUNT_OPTIONS.map((count) => (
                                <SelectItem key={count} value={`${count}`}>
                                  {count}x
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      );
                    })}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
              {selectedAgents.length === 0 ? (
                <span className="max-w-40 truncate text-xs text-muted-foreground sm:max-w-56">No agents selected</span>
              ) : (
                <div className="flex items-center gap-1">
                  <div className="isolate flex -space-x-2">
                    {selectedAgents.map((agent) => {
                      const count = agentSelections[agent.id].count;
                      return (
                        <span key={agent.id} className="relative inline-flex">
                          <AgentAvatar
                            agentId={agent.id}
                            label={agent.label}
                            selected
                            className="size-7 border-2 border-background"
                          />
                          {count > 1 ? (
                            <span className="absolute -right-1 -top-1 rounded-md bg-background px-1 text-[9px] font-semibold leading-4 text-foreground ring-1 ring-border">
                              {count}x
                            </span>
                          ) : null}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
              {selectedAgents.length > 1 ? (
                <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium">{totalAgentCount}x</span>
              ) : null}
            </PromptInputTools>
            <PromptInputSubmit status={status} className="rounded-full" />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
