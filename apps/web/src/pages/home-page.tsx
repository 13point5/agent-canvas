import { SidebarTrigger } from "@/components/ui/sidebar";

export function HomePage() {
  return (
    <>
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-2">
        <SidebarTrigger />
        <span className="font-medium">No board selected</span>
      </header>
      <main className="flex-1 overflow-hidden">
        <div className="flex items-center justify-center h-full text-muted-foreground">
          Select or create a board
        </div>
      </main>
    </>
  );
}
