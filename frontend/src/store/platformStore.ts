import { create } from "zustand";
import { clearPlatformToken, getPlatformToken, platformApi, type PlatformUser } from "@/lib/platformApi";

type PlatformStore = {
  user: PlatformUser | null;
  walletCents: number;
  loading: boolean;
  error: string | null;
  initialize: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  devLogin?: (role?: "admin" | "creator") => Promise<void>;
  register: (username: string, password: string, email: string | undefined, inviteCode?: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: PlatformUser | null) => void;
  clearError: () => void;
};

function notifyUserChanged(user: PlatformUser | null) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("lumenx:user_changed", { detail: user }));
  }
}

export const usePlatformStore = create<PlatformStore>((set) => ({
  user: null,
  walletCents: 0,
  loading: false,
  error: null,
  initialize: async () => {
    if (!getPlatformToken()) return;
    set({ loading: true, error: null });
    try {
      const me = await platformApi.me();
      set({ user: me, walletCents: me.wallet?.simulated_balance_cents ?? 0, loading: false });
    } catch (error) {
      clearPlatformToken();
      set({ user: null, loading: false, error: error instanceof Error ? error.message : String(error) });
      notifyUserChanged(null);
    }
  },
  login: async (username, password) => {
    set({ loading: true, error: null });
    try {
      const session = await platformApi.login({ username, password });
      set({ user: session.user, loading: false });
      notifyUserChanged(session.user);
    } catch (error) { set({ loading: false, error: error instanceof Error ? error.message : String(error) }); throw error; }
  },
  devLogin: async (role: "admin" | "creator" = "admin") => {
    set({ loading: true, error: null });
    try {
      const username = role === "admin" ? "admin" : "hzszxx";
      const password = role === "admin" ? "aaaaaaaaaaaa" : "password123";
      const session = await platformApi.login({ username, password });
      set({ user: session.user, walletCents: 100000, loading: false });
      notifyUserChanged(session.user);
    } catch {
      const mockUser: PlatformUser = {
        id: `dev-${role}-id`,
        username: role === "admin" ? "admin" : "hzszxx",
        email: `${role}@lumenx.local`,
        role: role,
      };
      set({ user: mockUser, walletCents: 888800, loading: false });
      notifyUserChanged(mockUser);
    }
  },
  register: async (username, password, email, inviteCode = "") => {
    set({ loading: true, error: null });
    try {
      await platformApi.register({ username, password, email, invite_code: inviteCode });
      const session = await platformApi.login({ username, password });
      set({ user: session.user, loading: false });
      notifyUserChanged(session.user);
    } catch (error) { set({ loading: false, error: error instanceof Error ? error.message : String(error) }); throw error; }
  },
  logout: async () => {
    await platformApi.logout();
    set({ user: null, walletCents: 0 });
    notifyUserChanged(null);
  },
  setUser: (user) => set({ user }),
  clearError: () => set({ error: null }),
}));

