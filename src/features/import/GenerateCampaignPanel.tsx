import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { CampaignDefinition } from "../../types/gameData";
import { buttonStyle, inputStyle, labelTextStyle, panelStyle } from "../../components/uiStyles";
import { buildCampaignGeneratorPrompt } from "./campaignGeneratorPromptBuilder";
import { buildNpcImportPreview } from "./npcImportValidator";
import type { NpcImportPreview } from "./npcImportTypes";

interface Props {
  open: boolean;
  campaign: CampaignDefinition;
  canImport: boolean;
  onClose: () => void;
  onCreateCampaign: (preview: NpcImportPreview) => Promise<void>;
}

function cardStyle() {
  return {
    ...panelStyle,
    padding: 14,
    display: "grid",
    gap: 10,
  };
}

export default function GenerateCampaignPanel({
  open,
  campaign,
  canImport,
  onClose,
  onCreateCampaign,
}: Props) {
  const [sourceMaterial, setSourceMaterial] = useState("");
  const [promptText, setPromptText] = useState("");
  const [payloadJson, setPayloadJson] = useState("");
  const [preview, setPreview] = useState<NpcImportPreview | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const promptPreview = useMemo(() => {
    if (!promptText) return "";
    return promptText;
  }, [promptText]);

  if (!open) return null;

  async function copyPrompt() {
    const prompt = promptText || buildCampaignGeneratorPrompt({ campaign, sourceMaterial });
    setPromptText(prompt);
    try {
      await navigator.clipboard.writeText(prompt);
      setCopiedPrompt(true);
      setErrorMessage("");
    } catch {
      setErrorMessage("Unable to copy AI prompt automatically. Copy from the prompt area manually.");
    }
  }

  function handleGeneratePrompt() {
    const prompt = buildCampaignGeneratorPrompt({ campaign, sourceMaterial });
    setPromptText(prompt);
    setCopiedPrompt(false);
    setErrorMessage("");
    setSuccessMessage("");
  }

  function handleValidate() {
    try {
      const nextPreview = buildNpcImportPreview(payloadJson, campaign);
      setPreview(nextPreview);
      setErrorMessage("");
      setSuccessMessage("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Campaign payload validation failed.";
      setErrorMessage(message);
      setPreview(null);
      setSuccessMessage("");
    }
  }

  async function handleCreate() {
    if (!preview || isCreating) return;

    if (!canImport) {
      setErrorMessage("You are not authorized to generate campaign packages in this campaign.");
      return;
    }

    setIsCreating(true);
    setErrorMessage("");
    try {
      await onCreateCampaign(preview);
      setSuccessMessage(
        `Campaign package imported with ${preview.characterPlans.length} NPC${preview.characterPlans.length === 1 ? "" : "s"}.`
      );
    } catch (error) {
      setSuccessMessage("");
      setErrorMessage(error instanceof Error ? error.message : "Failed to create campaign package.");
    } finally {
      setIsCreating(false);
    }
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--cb-modal-overlay)",
        display: "grid",
        placeItems: "center",
        padding: 24,
        zIndex: 1000,
      }}
    >
      <div
        style={{
          ...panelStyle,
          width: "min(900px, 100%)",
          maxHeight: "min(88vh, 1080px)",
          overflow: "auto",
          display: "grid",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <h3 style={{ margin: 0, color: "var(--text-primary)" }}>Generate Campaign</h3>
            <p style={{ margin: "6px 0 0", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              Turn a campaign pitch into a full import package with classes, races, powers, items, attacks, and a starter NPC roster.
            </p>
          </div>
          <button type="button" className="button-control" style={buttonStyle} onClick={onClose}>
            Close
          </button>
        </div>

        {!canImport ? (
          <div
            style={{
              ...cardStyle(),
              border: "1px solid rgba(214, 120, 120, 0.45)",
              background: "linear-gradient(165deg, rgba(145, 67, 67, 0.18), var(--cb-surface))",
            }}
          >
            You are not authorized to use Generate Campaign in this campaign.
          </div>
        ) : null}

        <section style={cardStyle()}>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 700, letterSpacing: "0.04em" }}>STEP 1: CAMPAIGN BRIEF</div>
          <label style={labelTextStyle}>
            Campaign Setting Description
            <textarea
              value={sourceMaterial}
              onChange={(event) => setSourceMaterial(event.target.value)}
              spellCheck={false}
              placeholder="Describe the world, tone, genre, power level, factions, technology or magic, expected classes, enemies, and any signature mechanics."
              style={{
                ...inputStyle,
                minHeight: 180,
                resize: "vertical",
                fontFamily: "SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace",
                lineHeight: 1.5,
              }}
            />
          </label>
        </section>

        <section style={cardStyle()}>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 700, letterSpacing: "0.04em" }}>STEP 2: BUILD AI PROMPT</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="button-control" style={buttonStyle} onClick={handleGeneratePrompt}>
              Generate AI Prompt
            </button>
            <button type="button" className="button-control" style={buttonStyle} onClick={() => void copyPrompt()}>
              Copy AI Prompt
            </button>
            {copiedPrompt ? <div style={{ alignSelf: "center", color: "var(--text-secondary)", fontSize: 13 }}>AI prompt copied.</div> : null}
          </div>
          <textarea
            value={promptPreview}
            readOnly
            spellCheck={false}
            placeholder="Generate the prompt, then copy it into your AI tool."
            style={{
              ...inputStyle,
              minHeight: 240,
              resize: "vertical",
              fontFamily: "SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace",
              lineHeight: 1.5,
            }}
          />
        </section>

        <section style={cardStyle()}>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 700, letterSpacing: "0.04em" }}>STEP 3: PASTE GENERATED PAYLOAD</div>
          <label style={labelTextStyle}>
            Campaign Import JSON
            <textarea
              value={payloadJson}
              onChange={(event) => {
                setPayloadJson(event.target.value);
                setPreview(null);
                setErrorMessage("");
                setSuccessMessage("");
              }}
              spellCheck={false}
              placeholder='{
  "format": "character-builder.npc-import",
  "version": 1,
  "content": {
    "skills": [],
    "powers": [],
    "items": [],
    "attacks": [],
    "races": [],
    "classes": [],
    "characters": []
  }
}'
              style={{
                ...inputStyle,
                minHeight: 280,
                resize: "vertical",
                fontFamily: "SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace",
                lineHeight: 1.55,
              }}
            />
          </label>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              className="button-control"
              style={buttonStyle}
              onClick={handleValidate}
              disabled={!payloadJson.trim()}
            >
              Validate
            </button>
          </div>
        </section>

        <section style={cardStyle()}>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 700, letterSpacing: "0.04em" }}>STEP 4: PREVIEW</div>
          {!preview ? (
            <div style={{ color: "var(--text-secondary)" }}>Validate a payload to preview what will be created.</div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>New Skills</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>{preview.toCreate.skills.length}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>New Powers</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>{preview.toCreate.powers.length}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>New Items</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>{preview.toCreate.items.length}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>New Attacks</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>{preview.toCreate.attacks.length}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>New Races</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>{preview.toCreate.races.length}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>New Classes</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>{preview.toCreate.classes.length}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>NPC Roster</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>{preview.characterPlans.length}</div>
                </div>
              </div>

              <div style={{ border: "1px solid var(--cb-border)", borderRadius: 8, padding: 12, display: "grid", gap: 8 }}>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 700, letterSpacing: "0.04em" }}>NPC ROSTER PREVIEW</div>
                <div style={{ color: "var(--text-primary)", fontSize: 13, lineHeight: 1.6 }}>
                  {preview.characterPlans.map((plan) => plan.name).join(", ") || "None"}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                <div style={{ border: "1px solid var(--cb-border)", borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6 }}>New Campaign Values</div>
                  <div style={{ color: "var(--text-primary)", fontSize: 13, lineHeight: 1.5 }}>
                    Skills: {preview.toCreate.skills.length} | Powers: {preview.toCreate.powers.length} | Items: {preview.toCreate.items.length}
                    <br />
                    Attacks: {preview.toCreate.attacks.length} | Races: {preview.toCreate.races.length} | Classes: {preview.toCreate.classes.length}
                  </div>
                </div>
                <div style={{ border: "1px solid var(--cb-border)", borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6 }}>Existing Values Reused</div>
                  <div style={{ color: "var(--text-primary)", fontSize: 13, lineHeight: 1.5 }}>
                    Skills: {preview.toReuse.skills.length} | Powers: {preview.toReuse.powers.length} | Items: {preview.toReuse.items.length}
                    <br />
                    Attacks: {preview.toReuse.attacks.length} | Races: {preview.toReuse.races.length} | Classes: {preview.toReuse.classes.length}
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        <section style={cardStyle()}>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 700, letterSpacing: "0.04em" }}>STEP 5: CONFIRM</div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="button-control" style={buttonStyle} onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="button-control"
              style={buttonStyle}
              onClick={() => void handleCreate()}
              disabled={!preview || isCreating || !canImport}
            >
              {isCreating ? "Creating..." : "Create Campaign Package"}
            </button>
          </div>
        </section>

        {errorMessage ? (
          <div
            style={{
              ...cardStyle(),
              border: "1px solid rgba(214, 120, 120, 0.45)",
              background: "linear-gradient(165deg, rgba(145, 67, 67, 0.18), var(--cb-surface))",
              color: "var(--text-primary)",
            }}
          >
            {errorMessage}
          </div>
        ) : null}

        {successMessage ? (
          <div
            style={{
              ...cardStyle(),
              border: "1px solid rgba(121, 201, 145, 0.45)",
              background: "linear-gradient(165deg, rgba(56, 112, 74, 0.2), var(--cb-surface))",
              color: "var(--text-primary)",
            }}
          >
            {successMessage}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}