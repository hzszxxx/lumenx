// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import axios from "axios";
import { API_URL, api, type ComputeRouteAdmissionRequest, type ComputeRoutePreviewRequest } from "@/lib/api";

vi.mock("axios", () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));

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

    it("posts a route admission preflight with a batch budget", async () => {
        const request: ComputeRouteAdmissionRequest = {
            routing: {
                stage: "final",
                shot_type: "consistency_long",
                urgency: "high",
                duration_sec: 6,
            },
            batch_size: 2,
            budget_cny: 30,
            requested_provider: "bailian",
            requested_model: "wan3",
            requested_resolution: "720p",
        };
        const decision = {
            route: {
                ...request.routing,
                provider: "bailian",
                model: "wan3",
                resolution: "720p",
                audio: false,
                promo: false,
                rule_id: "final.consistency_long",
                fallback: [],
                billed_duration_sec: 8,
                est_cost_cny: 7.2,
                cost_note: "preview",
            },
            batch_size: 2,
            budget_cny: 30,
            estimated_total_cny: 14.4,
            remaining_cny: 15.6,
        };
        vi.mocked(axios.post).mockResolvedValue({ data: decision });

        await expect(api.admitComputeRoute("project-1", "frame-1", request)).resolves.toEqual(decision);
        expect(axios.post).toHaveBeenCalledWith(
            `${API_URL}/projects/project-1/frames/frame-1/compute_route/admission`,
            request,
        );
    });

    it("reads and updates the project-level compute budget", async () => {
        vi.mocked(axios.get).mockResolvedValue({ data: { project_id: "project-1", budget_cny: 30, revision: 4 } });
        vi.mocked(axios.put).mockResolvedValue({ data: { id: "project-1", compute_budget_cny: 40, revision: 5 } });

        await expect(api.getComputeBudget("project-1")).resolves.toEqual({ project_id: "project-1", budget_cny: 30, revision: 4 });
        await expect(api.updateComputeBudget("project-1", 40, 4)).resolves.toEqual({ id: "project-1", compute_budget_cny: 40, revision: 5 });
        expect(axios.get).toHaveBeenCalledWith(`${API_URL}/projects/project-1/compute_budget`);
        expect(axios.put).toHaveBeenCalledWith(`${API_URL}/projects/project-1/compute_budget`, {
            budget_cny: 40,
            expected_revision: 4,
        });
    });
});
