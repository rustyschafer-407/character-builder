import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { CampaignDefinition } from "../../types/gameData";
import { buttonStyle, inputStyle, labelTextStyle, panelStyle } from "../../components/uiStyles";
import { buildNpcImportPreview } from "./npcImportValidator";
import type { NpcImportPreview } from "./npcImportTypes";
import { buildAiGeneratorPrompt, type AiGeneratorMode } from "./aiGeneratorPromptBuilder";

type ContentSection = "skills" | "powers" | "items" | "attacks" | "races" | "classes";

interface Props {
  open: boolean;
  campaign: CampaignDefinition;
  canEditCampaign: boolean;
  canCreateNpc: boolean;
  onClose: () => void;
  onApply: (preview: NpcImportPreview, mode: AiGeneratorMode) => Promise<void>;
}

const ALL_CONTENT_SECTIONS: ContentSection[] = ["skills", "powers", "items", "attacks", "races", "classes"];

function cardStyle() {
  return {
    ...panelStyle,
    padding: 14,
    display: "grid",
    gap: 10,
  };
}

function modeDescription(mode: AiGeneratorMode) {
  if (mode === "content-only") {
    return "Generate campaign content for an existing campaign without creating characters.";
  }
  if (mode === "npc-roster") {
    return "Generate an NPC roster plus only the supporting content needed to run them.";
  }
  return "Generate a broad campaign package and a starter NPC roster for the current campaign.";
}

export default function AiGeneratorPanel({
  open,
  campaign,
  canEditCampaign,
  canCreateNpc,
  onClose,
  onApply,
}: Props) {
  const [mode, setMode] = useState<AiGeneratorMode>("content-only");
  const [sourceMaterial, setSourceMaterial] = useState("");
  const [extraInstructions, setExtraInstructions] = useState("");
  const [npcCount, setNpcCount] = useState(6);
  const [selectedSections, setSelectedSections] = useState<ContentSection[]>([...ALL_CONTENT_SECTIONS]);
  const [promptText, setPromptText] = useState("");
  const [payloadJson, setPayloadJson] = useState("");
  const [preview, setPreview] = useState<NpcImportPreview | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  const promptPreview = useMemo(() => promptText || "", [promptText]);

  if (!open) return null;

  const canApply = canEditCampaign && (mode === "content-only" || canCreateNpc);
  const requiresCharacters = mode !== "content-only";

  async function copyPrompt() {
    const prompt =
      promptText ||
      buildAiGeneratorPrompt({
        campaign,
        sourceMaterial,
        mode,
        npcCount,
        selectedSections,
        extraInstructions,
      });
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
    const prompt = buildAiGeneratorPrompt({
      campaign,
      sourceMaterial,
      mode,
      npcCount,
      selectedSections,
      extraInstructions,
    });
    setPromptText(prompt);
    setCopiedPrompt(false);
    setErrorMessage("");
    setSuccessMessage("");
  }

  function handleValidate() {
    try {
      const nextPreview = buildNpcImportPreview(payloadJson, campaign, {
        requireCharacter: requiresCharacters,
      });
      if (mode === "content-only" && nextPreview.characterPlans.length > 0) {
        throw new Error("Content-only mode requires content.characters to be an empty array.");
      }
      setPreview(nextPreview);
      setErrorMessage("");
      setSuccessMessage("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI payload validation failed.";
      setErrorMessage(message);
      setPreview(null);
      setSuccessMessage("");
    }
  }

  async function handleApply() {
    if (!preview || isApplying) return;
    if (!canEditCampaign) {
      setErrorMessage("You are not authorized to edit this campaign.");
      return;
    }
    if (preview.characterPlans.length > 0 && !canCreateNpc) {
      setErrorMessage("You are not authorized to create NPCs in this campaign.");
      return;
    }

    setIsApplying(true);
    setErrorMessage("");
    try {
      await onApply(preview, mode);
      if (preview.characterPlans.length > 0) {
        setSuccessMessage(
          `Applied content and created ${preview.characterPlans.length} NPC${preview.characterPlans.length === 1 ? "" : "s"}.`
        );
      } else {
        setSuccessMessage("Applied campaign content update.");
      }
    } catch (error) {
      setSuccessMessage("");
      setErrorMessage(error instanceof Error ? error.message : "Failed to apply AI package.");
    } finally {
      setIsApplying(false);
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
          width: "min(980px, 100%)",
          maxHeight: "min(90vh, 1080px)",
          overflow: "auto",
          display: "grid",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <h3 style={{ margin: 0, color: "var(--text-primary)" }}>AI Generator</h3>
            <p style={{ margin: "6px 0 0", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              Generate campaign content, NPC rosters, or full packages directly into the current campaign.
            </p>
          </div>
          <button type="button" className="button-control" style={buttonStyle} onClick={onClose}>
            Close
          </button>
        </div>

        {!canApply ? (
          <div
            style={{
              ...cardStyle(),
              border: "1px solid rgba(214, 120, 120, 0.45)",
              background: "linear-gradient(165deg, rgba(145, 67, 67, 0.18), var(--cb-surface))",
            }}
          >
            {canEditCampaign
              ? "You can edit campaign content, but you are not authorized to create NPCs for modes that generate characters."
              : "You are not authorized to edit this campaign."}
          </div>
        ) : null}

        <section style={cardStyle()}>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 700, letterSpacing: "0.04em" }}>STEP 1: TARGET</div>
          <label style={labelTextStyle}>
            Generation Mode
            <select
              value={mode}
              onChange={(event) => {
                setMode(event.target.value as AiGeneratorMode);
                setPromptText("");
                setPreview(null);
                setErrorMessage("");
                setSuccessMessage("");
              }}
              style={inputStyle}
            >
              <option value="content-only">Content Only (no characters)</option>
              <option value="npc-roster">NPC Roster + Supporting Content</option>
              <option value="campaign-package">Full Campaign Package + NPC Roster</option>
            </select>
          </label>
          <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>{modeDescription(mode)}</div>

          {mode === "content-only" ? (
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ color: "var(--text-secondary)", fontSize: 12, fontWeight: 700, letterSpacing: "0.04em" }}>CONTENT SECTIONS</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
                {ALL_CONTENT_SECTIONS.map((section) => {
                  const checked = selectedSections.includes(section);
                  return (
                    <label key={section} style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--text-primary)" }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => {
                          const next = event.target.checked
                            ? [...selectedSections, section]
                            : selectedSections.filter((entry) => entry !== section);
                          setSelectedSections(next.length > 0 ? next : [section]);
                        }}
                      />
                      <span style={{ textTransform: "capitalize" }}>{section}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ) : null}

          {mode === "npc-roster" ? (
            <label style={{ ...labelTextStyle, maxWidth: 220 }}>
              NPC Count
              <input
                type="number"
                min={1}
                max={100}
                value={npcCount}
                onChange={(event) => setNpcCount(Math.max(1, Math.min(100, Number(event.target.value) || 1)))}
                style={inputStyle}
              />
            </label>
          ) : null}
        </section>

        <section style={cardStyle()}>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 700, letterSpacing: "0.04em" }}>STEP 2: SOURCE</div>
          <label style={labelTextStyle}>
            Source Material
            <textarea
              value={sourceMaterial}
              onChange={(event) => setSourceMaterial(event.target.value)}
              spellCheck={false}
              placeholder="Describe what should be generated for this existing campaign."
              style={{
                ...inputStyle,
                minHeight: 160,
                resize: "vertical",
                fontFamily: "SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace",
                lineHeight: 1.5,
              }}
            />
          </label>

          <label style={labelTextStyle}>
            Additional Instructions (optional)
            <textarea
              value={extraInstructions}
              onChange={(event) => setExtraInstructions(event.target.value)}
              spellCheck={false}
              placeholder="Optional constraints, tone, rarity, balance, or exclusions."
              style={{
                ...inputStyle,
                minHeight: 80,
                resize: "vertical",
                fontFamily: "SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace",
                lineHeight: 1.5,
              }}
            />
          </label>
        </section>

        <section style={cardStyle()}>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 700, letterSpacing: "0.04em" }}>STEP 3: BUILD AI PROMPT</div>
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
              minHeight: 220,
              resize: "vertical",
              fontFamily: "SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace",
              lineHeight: 1.5,
            }}
          />
        </section>

        <section style={cardStyle()}>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 700, letterSpacing: "0.04em" }}>STEP 4: PASTE GENERATED PAYLOAD</div>
          <label style={labelTextStyle}>
            AI Package JSON
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
                minHeight: 260,
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
          <div style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 700, letterSpacing: "0.04em" }}>STEP 5: PREVIEW + APPLY</div>
          {!preview ? (
            <div style={{ color: "var(--text-secondary)" }}>Validate a payload to preview what will be created or reused.</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
                <div style={{ border: "1px solid var(--cb-border)", borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>New Skills</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>{preview.toCreate.skills.length}</div>
                </div>
                <div style={{ border: "1px solid var(--cb-border)", borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>New Powers</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>{preview.toCreate.powers.length}</div>
                </div>
                <div style={{ border: "1px solid var(--cb-border)", borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>New Items</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>{preview.toCreate.items.length}</div>
                </div>
                <div style={{ border: "1px solid var(--cb-border)", borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>New Attacks</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>{preview.toCreate.attacks.length}</div>
                </div>
                <div style={{ border: "1px solid var(--cb-border)", borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>New Races</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>{preview.toCreate.races.length}</div>
                </div>
                <div style={{ border: "1px solid var(--cb-border)", borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>New Classes</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>{preview.toCreate.classes.length}</div>
                </div>
                <div style={{ border: "1px solid var(--cb-border)", borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>NPCs To Create</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>{preview.characterPlans.length}</div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button type="button" className="button-control" style={buttonStyle} onClick={onClose}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="button-control"
                  style={buttonStyle}
                  onClick={() => void handleApply()}
                  disabled={isApplying || !canApply}
                >
                  {isApplying ? "Applying..." : "Apply To Campaign"}
                </button>
              </div>

              <div
                style={{
                  ...cardStyle(),
                  border: "1px solid var(--cb-border-strong)",
                  background: "linear-gradient(165deg, rgba(64, 117, 164, 0.14), var(--cb-surface))",
                }}
              >
                <div style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 700, letterSpacing: "0.04em" }}>WARNINGS</div>
                {preview.warnings.length === 0 ? (
                  <div style={{ color: "var(--text-secondary)" }}>No warnings.</div>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: 20, color: "var(--text-secondary)", display: "grid", gap: 6 }}>
                    {preview.warnings.map((warning, index) => (
                      <li key={`${warning.code}-${index}`}>{warning.message}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
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