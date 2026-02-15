import type { AppSettings } from "@agent-canvas/shared";
import { Folder01Icon, Infinity01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ChatStatus } from "ai";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { createShapeId, useEditor, useToasts } from "tldraw";

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
import { useSettings, useUpdateSettings } from "@/hooks/api/use-settings";
import { registerPendingTerminalLaunch } from "@/lib/pending-terminal-launch";
import { cn } from "@/lib/utils";

const SUBMIT_RESET_DELAY_MS = 180;
const AGENT_COUNT_OPTIONS = [1, 2, 3, 4] as const;
const TERMINAL_SHAPE_WIDTH = 680;
const TERMINAL_SHAPE_HEIGHT = 420;
const TERMINAL_SHAPE_GAP = 24;
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
  path: string;
};

type PersistedFolderOption = {
  name: string;
  path: string;
};
type BoardFolderSettings = {
  boardFolders?: Record<string, PersistedFolderOption[]>;
  boardSelectedFolderPath?: Record<string, string>;
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

function quoteForShell(input: string): string {
  return `'${input.replaceAll("'", "'\\''")}'`;
}

function buildAgentCommand(agentId: AgentId, prompt: string): string {
  const quotedPrompt = quoteForShell(prompt);

  switch (agentId) {
    case "claude-code":
      return `claude ${quotedPrompt}`;
    case "codex":
      return `codex ${quotedPrompt}`;
    case "open-code":
      return `opencode --prompt ${quotedPrompt}`;
    case "cursor":
      return `agent ${quotedPrompt}`;
    default:
      return `echo ${quoteForShell(`Unsupported agent: ${agentId}`)}`;
  }
}

function arePersistedFolderListsEqual(a: PersistedFolderOption[], b: PersistedFolderOption[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let index = 0; index < a.length; index += 1) {
    if (a[index]?.name !== b[index]?.name || a[index]?.path !== b[index]?.path) {
      return false;
    }
  }
  return true;
}

function persistBoardFoldersPatch({
  boardId,
  settings,
  folders,
  selectedFolderId,
}: {
  boardId: string;
  settings: BoardFolderSettings | undefined;
  folders: FolderOption[];
  selectedFolderId: string | null;
}): BoardFolderSettings | null {
  const persistedFolders = folders.map((folder) => ({ name: folder.name, path: folder.path }));
  const selectedFolder = selectedFolderId ? (folders.find((folder) => folder.id === selectedFolderId) ?? null) : null;
  const selectedFolderPath = selectedFolder?.path ?? null;

  const currentBoardFolders = settings?.boardFolders?.[boardId] ?? [];
  const currentSelectedFolderPath = settings?.boardSelectedFolderPath?.[boardId] ?? null;
  if (
    arePersistedFolderListsEqual(currentBoardFolders, persistedFolders) &&
    currentSelectedFolderPath === selectedFolderPath
  ) {
    return null;
  }

  const nextBoardFolders = { ...(settings?.boardFolders ?? {}) };
  if (persistedFolders.length > 0) {
    nextBoardFolders[boardId] = persistedFolders;
  } else {
    delete nextBoardFolders[boardId];
  }

  const nextBoardSelectedFolderPath = { ...(settings?.boardSelectedFolderPath ?? {}) };
  if (selectedFolderPath) {
    nextBoardSelectedFolderPath[boardId] = selectedFolderPath;
  } else {
    delete nextBoardSelectedFolderPath[boardId];
  }

  return {
    boardFolders: nextBoardFolders,
    boardSelectedFolderPath: nextBoardSelectedFolderPath,
  };
}

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
  const { boardId } = useParams<{ boardId: string }>();
  const editor = useEditor();
  const { addToast } = useToasts();
  const { data: settings } = useSettings();
  const { mutate: updateSettings } = useUpdateSettings();
  const [status, setStatus] = useState<ChatStatus>("ready");
  const [agentMenuOpen, setAgentMenuOpen] = useState(false);
  const [folderMenuOpen, setFolderMenuOpen] = useState(false);
  const [folders, setFolders] = useState<FolderOption[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [agentSelections, setAgentSelections] = useState<AgentSelections>(DEFAULT_AGENT_SELECTIONS);
  const settingsWithFolders = settings as (AppSettings & BoardFolderSettings) | undefined;

  const selectedAgents = useMemo(
    () => AGENT_OPTIONS.filter((agent) => agentSelections[agent.id].enabled),
    [agentSelections],
  );
  const totalAgentCount = useMemo(
    () => selectedAgents.reduce((total, agent) => total + agentSelections[agent.id].count, 0),
    [agentSelections, selectedAgents],
  );
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
  const selectedFolderPath = selectedFolder?.path ?? null;
  const persistedFoldersForBoard = useMemo(() => {
    if (!boardId) {
      return [] as PersistedFolderOption[];
    }
    return settingsWithFolders?.boardFolders?.[boardId] ?? [];
  }, [boardId, settingsWithFolders?.boardFolders]);
  const persistedSelectedFolderPathForBoard = useMemo(() => {
    if (!boardId) {
      return null;
    }
    return settingsWithFolders?.boardSelectedFolderPath?.[boardId] ?? null;
  }, [boardId, settingsWithFolders?.boardSelectedFolderPath]);

  const persistFolders = useCallback(
    (nextFolders: FolderOption[], nextSelectedFolderId: string | null) => {
      if (!boardId) {
        return;
      }
      const patch = persistBoardFoldersPatch({
        boardId,
        settings: settingsWithFolders,
        folders: nextFolders,
        selectedFolderId: nextSelectedFolderId,
      });
      if (!patch) {
        return;
      }
      updateSettings(patch as Partial<AppSettings>);
    },
    [boardId, settingsWithFolders, updateSettings],
  );

  useEffect(() => {
    if (!boardId) {
      setFolders([]);
      setSelectedFolderId(null);
      return;
    }

    const hydratedFolders: FolderOption[] = persistedFoldersForBoard.map((folder) => ({
      id: folder.path,
      name: folder.name,
      path: folder.path,
    }));
    setFolders(hydratedFolders);

    if (
      persistedSelectedFolderPathForBoard &&
      hydratedFolders.some((folder) => folder.path === persistedSelectedFolderPathForBoard)
    ) {
      setSelectedFolderId(persistedSelectedFolderPathForBoard);
      return;
    }
    setSelectedFolderId(hydratedFolders[0]?.id ?? null);
  }, [boardId, persistedFoldersForBoard, persistedSelectedFolderPathForBoard]);

  const handleFolderMenuOpenChange = useCallback((open: boolean) => {
    setFolderMenuOpen(open);
  }, []);

  const handleSelectFolder = useCallback(
    (folderId: string) => {
      setSelectedFolderId(folderId);
      persistFolders(folders, folderId);
    },
    [folders, persistFolders],
  );

  const handlePickFolder = useCallback(async () => {
    try {
      const response = await fetch("/api/system/pick-folder", {
        method: "POST",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Could not open folder picker.");
      }

      const payload = (await response.json()) as {
        canceled?: boolean;
        name?: string;
        path?: string;
      };
      if (payload.canceled) {
        return;
      }
      if (!payload.path || !payload.name) {
        throw new Error("Folder picker did not return a valid folder.");
      }
      const folderPath = payload.path;
      const folderName = payload.name;

      let nextSelectedId: string | null = null;
      let nextFolders: FolderOption[] | null = null;

      setFolders((current) => {
        const existing = current.find((folder) => folder.path === folderPath);
        if (existing) {
          nextSelectedId = existing.id;
          nextFolders = current;
          return current;
        }

        const nextFolder: FolderOption = {
          id: folderPath,
          name: folderName,
          path: folderPath,
        };
        nextSelectedId = nextFolder.id;
        nextFolders = [...current, nextFolder];
        return nextFolders;
      });

      if (nextSelectedId) {
        setSelectedFolderId(nextSelectedId);
      }
      if (nextFolders) {
        persistFolders(nextFolders, nextSelectedId);
      }
    } catch (error) {
      addToast({
        title: "Could not select folder",
        description: error instanceof Error ? error.message : "Try again or choose a different folder.",
        severity: "error",
      });
    }
  }, [addToast, persistFolders]);

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
      if (!selectedFolderPath) {
        addToast({
          title: "Select a folder",
          description: "Pick a folder from the folder dropdown before sending the prompt.",
          severity: "error",
        });
        return;
      }

      const launchTargets: Array<{
        agentId: AgentId;
        agentLabel: string;
        instanceIndex: number;
      }> = [];
      for (const agent of selectedAgents) {
        const count = agentSelections[agent.id].count;
        for (let index = 1; index <= count; index += 1) {
          launchTargets.push({
            agentId: agent.id,
            agentLabel: agent.label,
            instanceIndex: index,
          });
        }
      }

      if (launchTargets.length === 0) {
        addToast({
          title: "No terminal launches requested",
          description: "Enable at least one agent before submitting.",
          severity: "error",
        });
        return;
      }

      setStatus("submitted");

      try {
        const columnCount = Math.max(1, Math.ceil(Math.sqrt(launchTargets.length)));
        const rowCount = Math.ceil(launchTargets.length / columnCount);
        const totalWidth = columnCount * TERMINAL_SHAPE_WIDTH + (columnCount - 1) * TERMINAL_SHAPE_GAP;
        const totalHeight = rowCount * TERMINAL_SHAPE_HEIGHT + (rowCount - 1) * TERMINAL_SHAPE_GAP;
        const center = editor.getViewportPageBounds().center;
        const originX = center.x - totalWidth / 2;
        const originY = center.y - totalHeight / 2;

        const plannedSessions = launchTargets.map((target, index) => {
          const col = index % columnCount;
          const row = Math.floor(index / columnCount);
          const sessionId = createShapeId();
          const startupCommand = buildAgentCommand(target.agentId, prompt);
          const shapeName =
            agentSelections[target.agentId].count > 1
              ? `${target.agentLabel} ${target.instanceIndex}`
              : target.agentLabel;

          return {
            id: sessionId,
            startupCommand,
            name: shapeName,
            x: originX + col * (TERMINAL_SHAPE_WIDTH + TERMINAL_SHAPE_GAP),
            y: originY + row * (TERMINAL_SHAPE_HEIGHT + TERMINAL_SHAPE_GAP),
          };
        });

        for (const session of plannedSessions) {
          registerPendingTerminalLaunch(session.id, {
            cwd: selectedFolderPath,
            startupCommand: session.startupCommand,
          });
          editor.createShape({
            id: session.id,
            type: "terminal",
            x: session.x,
            y: session.y,
            props: {
              w: TERMINAL_SHAPE_WIDTH,
              h: TERMINAL_SHAPE_HEIGHT,
              name: session.name,
            },
          });
        }

        addToast({
          title: "Launched terminal swarm",
          description: `Started ${plannedSessions.length} terminal${plannedSessions.length > 1 ? "s" : ""} in ${selectedFolderLabel}.`,
          severity: "info",
        });
      } catch (error) {
        addToast({
          title: "Could not launch terminals",
          description: error instanceof Error ? error.message : "Try again.",
          severity: "error",
        });
      } finally {
        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, SUBMIT_RESET_DELAY_MS);
        });
        setStatus("ready");
      }
    },
    [addToast, agentSelections, editor, selectedAgents, selectedFolderLabel, selectedFolderPath],
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
                          onClick={() => handleSelectFolder(folder.id)}
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
