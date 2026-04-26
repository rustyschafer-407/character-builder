import { describe, expect, it } from "vitest";
import { CAMPAIGN_IMPORT_AI_PROMPT } from "./campaignImportPrompt";

describe("campaignImportPrompt", () => {
  it("exists and includes the required import format", () => {
    expect(typeof CAMPAIGN_IMPORT_AI_PROMPT).toBe("string");
    expect(CAMPAIGN_IMPORT_AI_PROMPT.length).toBeGreaterThan(100);
    expect(CAMPAIGN_IMPORT_AI_PROMPT).toContain("character-builder.campaign-content-import");
  });

  it("does not include unsupported field names", () => {
    const unsupportedFieldKeySnippets = [
      '"tags":',
      '"notes":',
      '"category":',
      '"source":',
      '"damage":',
      '"saveAttribute":',
      '"quantity":',
      '"weight":',
      '"cost":',
    ];

    for (const fieldSnippet of unsupportedFieldKeySnippets) {
      expect(CAMPAIGN_IMPORT_AI_PROMPT).not.toContain(fieldSnippet);
    }
  });
});
