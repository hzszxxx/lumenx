"use client";

import GlobalSidebar, { type GlobalTab } from "./GlobalSidebar";
import TopNavbar from "./TopNavbar";
import OfflineBanner from "./OfflineBanner";
import BottomTabBar from "./BottomTabBar";

interface AppShellProps {
  activeTab: GlobalTab;
  onTabChange: (tab: GlobalTab) => void;
  onRequestCreate?: () => void;
  onRequestAuth?: (title?: string, description?: string) => void;
  onLogout?: () => void;
  children: React.ReactNode;
}

export default function AppShell({
  activeTab,
  onTabChange,
  onRequestCreate,
  onRequestAuth,
  onLogout,
  children,
}: AppShellProps) {
  const isPortal = activeTab === "platform";
  return (
    <div className="flex h-screen w-full flex-col">
      <OfflineBanner />
      <TopNavbar
        activeTab={activeTab}
        onTabChange={onTabChange}
        onRequestCreate={onRequestCreate}
        onRequestAuth={onRequestAuth}
        onLogout={onLogout}
      />
      <div className="flex min-h-0 flex-1">
        {!isPortal && (
          <GlobalSidebar activeTab={activeTab} onTabChange={onTabChange} onLogout={onLogout} />
        )}
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">{children}</div>
      </div>
      {!isPortal && (
        <BottomTabBar activeTab={activeTab} onTabChange={onTabChange} onLogout={onLogout} />
      )}
    </div>
  );
}

