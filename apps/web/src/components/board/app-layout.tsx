import { useState } from "react";
import { Outlet } from "react-router-dom";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useSettings, useUpdateSettings } from "@/hooks/api/use-settings";

export function AppLayout() {
  const { data: settings, isLoading } = useSettings();
  const { mutate: updateSettings } = useUpdateSettings();
  const [open, setOpen] = useState<boolean | undefined>(undefined);

  // Once settings load, use them as initial value (only on first load)
  const sidebarOpen = open ?? settings?.sidebarOpen ?? true;

  const handleOpenChange = (value: boolean) => {
    setOpen(value);
    updateSettings({ sidebarOpen: value });
  };

  if (isLoading) {
    return <div className="flex h-screen" />;
  }

  return (
    <SidebarProvider open={sidebarOpen} onOpenChange={handleOpenChange}>
      <AppSidebar />
      <SidebarInset className="flex flex-col h-screen">
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
}
