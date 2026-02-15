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
  { id: "codex", label: "Codex" },
  { id: "open-code", label: "OpenCode" },
  { id: "claude-code", label: "Claude Code" },
  { id: "aider", label: "Aider" },
  { id: "cursor-agent", label: "Cursor Agent" },
] as const;

type AgentId = (typeof AGENT_OPTIONS)[number]["id"];
type AgentCount = (typeof AGENT_COUNT_OPTIONS)[number];
type AgentSelection = {
  enabled: boolean;
  count: AgentCount;
};
type AgentSelections = Record<AgentId, AgentSelection>;

const DEFAULT_AGENT_SELECTIONS: AgentSelections = {
  codex: { enabled: true, count: 1 },
  "open-code": { enabled: false, count: 1 },
  "claude-code": { enabled: false, count: 1 },
  aider: { enabled: false, count: 1 },
  "cursor-agent": { enabled: false, count: 1 },
};

export function BoardChatPromptHud() {
  const { addToast } = useToasts();
  const [status, setStatus] = useState<ChatStatus>("ready");
  const [agentMenuOpen, setAgentMenuOpen] = useState(false);
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

      setStatus("submitted");
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, SUBMIT_RESET_DELAY_MS);
      });
      setStatus("ready");

      addToast({
        title: "Prompt captured",
        description: `Routing: ${routingSummary}`,
        severity: "info",
      });
    },
    [addToast, routingSummary, selectedAgents.length],
  );

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 z-50 flex justify-center px-3 pb-[max(env(safe-area-inset-bottom),0px)] md:bottom-4 md:px-4">
      <div className="pointer-events-auto w-full max-w-2xl">
        <PromptInput
          onSubmit={(message) => {
            void handleSubmit(message);
          }}
          className="rounded-3xl border border-border/70 bg-background/95 shadow-lg backdrop-blur-md"
        >
          <PromptInputBody>
            <PromptInputTextarea className="min-h-14" placeholder="Message the board assistant..." />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools className="min-w-0 flex-1 gap-2 px-1">
              <DropdownMenu open={agentMenuOpen} onOpenChange={handleAgentMenuOpenChange} modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 rounded-full border-border/80 px-2.5 text-xs font-medium"
                  >
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
                            className="h-8 flex-1 justify-start px-2 text-sm"
                            onClick={() => handleToggleAgent(agent.id)}
                          >
                            <span
                              className={cn(
                                "mr-2 flex size-4 items-center justify-center rounded-[4px] border transition-colors",
                                selection.enabled
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-muted-foreground/40",
                              )}
                            >
                              <CheckIcon className={cn("size-3", !selection.enabled && "opacity-0")} />
                            </span>
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
              <span className="max-w-40 truncate text-xs text-muted-foreground sm:max-w-56">{routingSummary}</span>
              <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium">{totalAgentCount}x</span>
            </PromptInputTools>
            <PromptInputSubmit status={status} className="rounded-full" />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
