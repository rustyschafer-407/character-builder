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
      '"damageType":',
      '"range":',
      '"saveAttribute":',
      '"quantity":',
      '"weight":',
      '"cost":',
      '"attack":',
    ];

    for (const fieldSnippet of unsupportedFieldKeySnippets) {
      expect(CAMPAIGN_IMPORT_AI_PROMPT).not.toContain(fieldSnippet);
    }

    expect(CAMPAIGN_IMPORT_AI_PROMPT).toContain('"attackAttribute": ""');
  });

  it("instructs usableAsAttack when damage dice are present", () => {
    expect(CAMPAIGN_IMPORT_AI_PROMPT).toContain("Set usableAsAttack to true if the power deals damage, lists damage dice");
    expect(CAMPAIGN_IMPORT_AI_PROMPT).toContain("Set usableAsAttack to true if the item is used to attack, lists damage dice");
    expect(CAMPAIGN_IMPORT_AI_PROMPT).toContain("lists a flat damage amount");
    expect(CAMPAIGN_IMPORT_AI_PROMPT).toContain("Use STR for melee attacks and DEX for ranged attacks");
    expect(CAMPAIGN_IMPORT_AI_PROMPT).toContain("Use STR for melee weapons and DEX for ranged weapons");
  });
});
