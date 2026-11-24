// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { useProjectStore, resetProjectStoreForUserSwitch } from "@/store/projectStore";
import { useAtelierStore, resetAtelierStoreForUserSwitch } from "@/store/atelierStore";
import { usePlatformStore } from "@/store/platformStore";
import { platformApi } from "@/lib/platformApi";

describe("Multi-user workspace isolation store reset", () => {
  beforeEach(() => {
    resetProjectStoreForUserSwitch();
    resetAtelierStoreForUserSwitch();
  });

  it("resets projectStore on user switch", () => {
    // Populate projectStore with mock state from previous user
    useProjectStore.setState({
      projects: [
        {
          id: "proj-1",
          title: "User 1 Project",
          revision: 1,
          characters: [],
          scenes: [],
          props: [],
          frames: [],
          video_tasks: [],
          original_text: "",
        } as any,
      ],
      seriesList: [
        {
          id: "series-1",
          title: "User 1 Series",
          revision: 1,
        } as any,
      ],
      currentProject: {
        id: "proj-1",
        title: "User 1 Project",
        revision: 1,
      } as any,
      currentSeries: {
        id: "series-1",
        title: "User 1 Series",
        revision: 1,
      } as any,
    });

    expect(useProjectStore.getState().projects).toHaveLength(1);
    expect(useProjectStore.getState().seriesList).toHaveLength(1);
    expect(useProjectStore.getState().currentProject).not.toBeNull();
    expect(useProjectStore.getState().currentSeries).not.toBeNull();

    // Call reset function
    resetProjectStoreForUserSwitch();

    // Verify everything is cleared for newly logged-in / switched user
    expect(useProjectStore.getState().projects).toEqual([]);
    expect(useProjectStore.getState().seriesList).toEqual([]);
    expect(useProjectStore.getState().currentProject).toBeNull();
    expect(useProjectStore.getState().currentSeries).toBeNull();
  });

  it("resets atelierStore on user switch", () => {
    // Populate atelierStore with mock state from previous user
    useAtelierStore.setState({
      projects: [
        {
          id: "atelier-1",
          title: "User 1 Canvas",
          revision: 1,
          nodes: [],
        } as any,
      ],
      currentProject: {
        id: "atelier-1",
        title: "User 1 Canvas",
        revision: 1,
        nodes: [],
      } as any,
    });

    expect(useAtelierStore.getState().projects).toHaveLength(1);
    expect(useAtelierStore.getState().currentProject).not.toBeNull();

    // Call reset function
    resetAtelierStoreForUserSwitch();

    // Verify atelier projects and currentProject are cleared
    expect(useAtelierStore.getState().projects).toEqual([]);
    expect(useAtelierStore.getState().currentProject).toBeNull();
  });

  it("dispatches lumenx:user_changed event on logout", async () => {
    vi.spyOn(platformApi, "logout").mockResolvedValue(undefined as any);
    let eventReceived = false;
    let eventDetail: any = undefined;

    const handler = (e: Event) => {
      eventReceived = true;
      eventDetail = (e as CustomEvent).detail;
    };

    window.addEventListener("lumenx:user_changed", handler);
    try {
      await usePlatformStore.getState().logout();
      expect(eventReceived).toBe(true);
      expect(eventDetail).toBeNull();
    } finally {
      window.removeEventListener("lumenx:user_changed", handler);
    }
  });
});
