import { describe, expect, it } from "vitest";
import { CAMPAIGN_IMPORT_AI_PROMPT } from "./campaignImportPrompt";

describe("campaignImportPrompt", () => {
  it("exists and includes the required import format", () => {
    expect(typeof CAMPAIGN_IMPORT_AI_PROMPT).toBe("string");
    expect(CAMPAIGN_IMPORT_AI_PROMPT.length).toBeGreaterThan(100);
    expect(CAMPAIGN_IMPORT_AI_PROMPT).toContain("character-builder.campaign-content-import");
  });
});
