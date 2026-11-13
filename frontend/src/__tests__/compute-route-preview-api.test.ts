// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import axios from "axios";
import { API_URL, api, type ComputeRoutePreviewRequest } from "@/lib/api";

vi.mock("axios", () => ({ default: { post: vi.fn() } }));

describe("compute route preview API client", () => {
    beforeEach(() => vi.clearAllMocks());

    it("posts a read-only route preview request to the frame endpoint", async () => {
        const request: ComputeRoutePreviewRequest = {
            stage: "final",
            shot_type: "dialogue_av",
            urgency: "high",
            duration_sec: 8,
            has_dialogue: true,
            closeup_or_hero: true,
            prefer_libtv_promo: false,
        };
        const preview = {
            ...request,
            provider: "minimax",
            model: "minimax_h3_hosted",
            resolution: "2k",
            audio: true,
            promo: false,
            rule_id: "final.dialogue_av.upgrade_2k",
            fallback: [],
            billed_duration_sec: 10,
            est_cost_cny: 13.97,
            cost_note: "preview",
        };
        vi.mocked(axios.post).mockResolvedValue({ data: preview });

        await expect(api.previewComputeRoute("project-1", "frame-1", request)).resolves.toEqual(preview);
        expect(axios.post).toHaveBeenCalledWith(
            `${API_URL}/projects/project-1/frames/frame-1/compute_route`,
            request,
        );
    });
});
