import { describe, expect, it } from "vitest";
import { frameToShotNode } from "@/components/modules/storyboard-r2v/shotNodeHelpers";

describe("compute route tags in Studio shot nodes", () => {
    it("preserves persisted stage, shot type, and urgency", () => {
        const shot = frameToShotNode({
            id: "frame-1",
            shot_type: "hero_cover",
            urgency: "high",
            stage: "final",
        }, []);

        expect(shot).toMatchObject({
            shot_type: "hero_cover",
            urgency: "high",
            stage: "final",
        });
    });
});
