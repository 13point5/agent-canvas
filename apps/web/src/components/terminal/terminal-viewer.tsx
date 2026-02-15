import { FitAddon, type IDisposable, init, Terminal } from "ghostty-web";
import { useEffect, useMemo, useRef, useState } from "react";

interface TerminalViewerProps {
  name: string;
  width: number;
  height: number;
  sessionId: string;
  isEditing: boolean;
}

type ConnectionState = "connecting" | "connected" | "disconnected";

let ghosttyInitPromise: Promise<void> | null = null;

async function ensureGhosttyInitialized() {
  if (!ghosttyInitPromise) {
    ghosttyInitPromise = init();
  }
  await ghosttyInitPromise;
}

export function TerminalViewer({ name, width, height, sessionId, isEditing }: TerminalViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected");
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    let isDisposed = false;
    let socket: WebSocket | null = null;
    let handleWindowResize: (() => void) | null = null;
    const disposables: IDisposable[] = [];

    const initialize = async () => {
      setConnectionState("connecting");
      setBootError(null);

      try {
        await ensureGhosttyInitialized();
        if (isDisposed || !containerRef.current) {
          return;
        }

        const terminal = new Terminal({
          cursorBlink: true,
          fontSize: 14,
          fontFamily:
            '"MesloLGS NF", "JetBrainsMono Nerd Font", "JetBrains Mono", "Hack Nerd Font", "CaskaydiaCove Nerd Font", Menlo, Monaco, "SFMono-Regular", monospace',
          theme: {
            background: "#090f1b",
            foreground: "#e2e8f0",
            cursor: "#7dd3fc",
          },
          scrollback: 5000,
        });

        const fitAddon = new FitAddon();
        terminal.loadAddon(fitAddon);
        terminal.open(containerRef.current);
        terminalRef.current = terminal;
        fitAddon.fit();
        fitAddon.observeResize();

        handleWindowResize = () => {
          fitAddon.fit();
        };
        window.addEventListener("resize", handleWindowResize);

        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const session = encodeURIComponent(sessionId);
        socket = new WebSocket(
          `${protocol}//${window.location.host}/ws/terminal?session=${session}&cols=${terminal.cols}&rows=${terminal.rows}`,
        );

        socket.onopen = () => {
          if (!isDisposed) {
            setConnectionState("connected");
          }
        };

        socket.onmessage = (event) => {
          if (typeof event.data === "string") {
            terminal.write(event.data);
          }
        };

        socket.onerror = () => {
          if (!isDisposed) {
            setConnectionState("disconnected");
          }
        };

        socket.onclose = () => {
          if (!isDisposed) {
            setConnectionState("disconnected");
          }
        };

        disposables.push(
          terminal.onData((data) => {
            if (socket?.readyState === WebSocket.OPEN) {
              socket.send(data);
            }
          }),
        );

        disposables.push(
          terminal.onResize((size) => {
            if (socket?.readyState === WebSocket.OPEN) {
              socket.send(
                JSON.stringify({
                  type: "resize",
                  cols: size.cols,
                  rows: size.rows,
                }),
              );
            }
          }),
        );
      } catch (error) {
        if (isDisposed) return;
        const message = error instanceof Error ? error.message : "Failed to initialize terminal";
        setBootError(message);
        setConnectionState("disconnected");
      }
    };

    void initialize();

    return () => {
      isDisposed = true;
      for (const disposable of disposables) {
        disposable.dispose();
      }
      if (handleWindowResize) {
        window.removeEventListener("resize", handleWindowResize);
      }
      if (socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) {
        socket.close();
      }
      terminalRef.current?.dispose();
      terminalRef.current = null;
    };
  }, [sessionId]);

  useEffect(() => {
    if (isEditing) {
      terminalRef.current?.focus();
    }
  }, [isEditing]);

  const statusText = useMemo(() => {
    if (connectionState === "connected") return "Connected";
    if (connectionState === "connecting") return "Connecting";
    return "Disconnected";
  }, [connectionState]);

  const statusDotClass = useMemo(() => {
    if (connectionState === "connected") return "bg-emerald-400";
    if (connectionState === "connecting") return "bg-amber-400";
    return "bg-rose-400";
  }, [connectionState]);

  const borderClass = isEditing ? "border border-chart-1" : "border border-border";

  return (
    <div
      className={`relative flex h-full flex-col overflow-hidden rounded-lg bg-card shadow-sm ${borderClass}`}
      style={{ width, height }}
    >
      <div className="flex items-center justify-between border-b border-border bg-muted/50 px-3 py-1.5 shrink-0">
        <div className="flex items-center gap-2 truncate">
          <span className="text-sm font-semibold text-muted-foreground">{">_"}</span>
          <span className="text-sm font-medium text-foreground truncate">{name || "Terminal"}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className={`inline-flex size-2 rounded-full ${statusDotClass}`} />
          <span>{statusText}</span>
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden bg-[#090f1b]">
        <div ref={containerRef} className="h-full w-full" />

        {!isEditing && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/5 pointer-events-none">
            <span className="rounded-md bg-foreground/80 px-3 py-1.5 text-xs font-medium text-background shadow-sm">
              Double-click to interact
            </span>
          </div>
        )}

        {bootError && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#090f1b]/90 px-4 text-center text-xs text-rose-300">
            {bootError}
          </div>
        )}
      </div>
    </div>
  );
}
