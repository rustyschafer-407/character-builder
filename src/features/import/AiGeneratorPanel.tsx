import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CampaignDefinition } from "../../types/gameData";
import { buttonStyle, inputStyle, labelTextStyle, panelStyle, primaryButtonStyle } from "../../components/uiStyles";
import { buildNpcImportPreview } from "./npcImportValidator";
import type { NpcImportPreview } from "./npcImportTypes";
import { buildAiGeneratorPrompt, type AiGeneratorMode } from "./aiGeneratorPromptBuilder";

type ContentSection = "skills" | "powers" | "items" | "attacks" | "races" | "classes";
type UiState = "idle" | "generating" | "preview_ready" | "applying";
type PreviewSectionKey = "skills" | "powers" | "items" | "classes" | "races" | "attacks";

type PreviewListEntry = {
  name: string;
  status: "new" | "reused";
};

interface Props {
  open: boolean;
  campaign: CampaignDefinition;
  canEditCampaign: boolean;
  canCreateNpc: boolean;
  onClose: () => void;
  onApply: (preview: NpcImportPreview, mode: AiGeneratorMode) => Promise<void>;
}

const ALL_CONTENT_SECTIONS: ContentSection[] = ["skills", "powers", "items", "attacks", "races", "classes"];
const PRIMARY_PREVIEW_SECTIONS: PreviewSectionKey[] = ["skills", "powers", "items"];
const SECONDARY_PREVIEW_SECTIONS: PreviewSectionKey[] = ["classes", "races", "attacks"];

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
    return "Generate content for an existing campaign without creating characters.";
  }
  if (mode === "npc-roster") {
    return "Generate an NPC roster plus supporting campaign content.";
  }
  return "Generate a broad campaign package plus an NPC roster.";
}

function prettifySectionName(section: PreviewSectionKey) {
  if (section === "classes") return "Classes";
  if (section === "races") return "Races";
  if (section === "attacks") return "Attacks";
  if (section === "powers") return "Powers";
  if (section === "items") return "Items";
  return "Skills";
}

function extractJsonCandidate(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
}

function summaryCount(preview: NpcImportPreview | null, section: PreviewSectionKey) {
  if (!preview) return "-";
  return String(preview.toCreate[section].length);
}

function buildPreviewEntries(preview: NpcImportPreview, section: PreviewSectionKey): PreviewListEntry[] {
  const created = preview.toCreate[section].map((entry) => ({
    name: entry.name,
    status: "new" as const,
  }));
  const reused = preview.toReuse[section].map((entry) => ({
    name: entry.name,
    status: "reused" as const,
  }));
  return [...created, ...reused].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
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
  const [assistantOutput, setAssistantOutput] = useState("");
  const [extraInstructions, setExtraInstructions] = useState("");
  const [npcCount, setNpcCount] = useState(6);
  const [selectedSections, setSelectedSections] = useState<ContentSection[]>([...ALL_CONTENT_SECTIONS]);
  const [payloadJson, setPayloadJson] = useState("");
  const [preview, setPreview] = useState<NpcImportPreview | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [uiState, setUiState] = useState<UiState>("idle");
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);
  const [showApplyConfirm, setShowApplyConfirm] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<PreviewSectionKey, boolean>>({
    skills: true,
    powers: false,
    items: false,
    classes: false,
    races: false,
    attacks: false,
  });

  const previewSectionRef = useRef<HTMLDivElement | null>(null);

  const canApply = canEditCampaign && (mode === "content-only" || canCreateNpc);
  const requiresCharacters = mode !== "content-only";
  const sourceCount = sourceMaterial.length;
  const applyPending = uiState === "applying";

  const previewCounts = useMemo(
    () => ({
      skills: summaryCount(preview, "skills"),
      powers: summaryCount(preview, "powers"),
      items: summaryCount(preview, "items"),
      classes: summaryCount(preview, "classes"),
      races: summaryCount(preview, "races"),
      attacks: summaryCount(preview, "attacks"),
    }),
    [preview]
  );

  useEffect(() => {
    if (uiState !== "preview_ready") return;
    previewSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [uiState]);

  if (!open) return null;

  function resetPreviewState() {
    setPreview(null);
    setUiState("idle");
    setShowApplyConfirm(false);
    setErrorMessage("");
  }

  function toggleSection(section: ContentSection) {
    const checked = selectedSections.includes(section);
    const next = checked
      ? selectedSections.filter((entry) => entry !== section)
      : [...selectedSections, section];
    setSelectedSections(next.length > 0 ? next : [section]);
    resetPreviewState();
  }

  function togglePreviewSection(section: PreviewSectionKey) {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  }

  function validateAssistantOutput(rawOutput: string) {
    const normalized = extractJsonCandidate(rawOutput);
    if (!normalized) {
      setErrorMessage("Paste your AI response before building a preview.");
      setPreview(null);
      setUiState("idle");
      return null;
    }

    try {
      const nextPreview = buildNpcImportPreview(normalized, campaign, {
        requireCharacter: requiresCharacters,
      });
      if (mode === "content-only" && nextPreview.characterPlans.length > 0) {
        throw new Error("Content Only mode cannot include characters.");
      }
      setPayloadJson(normalized);
      setPreview(nextPreview);
      setErrorMessage("");
      setInfoMessage("");
      setUiState("preview_ready");
      return nextPreview;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to build preview from AI response.";
      setErrorMessage(message);
      setPreview(null);
      setUiState("idle");
      return null;
    }
  }

  async function handleGenerateContent() {
    if (!sourceMaterial.trim()) {
      setErrorMessage("Add source material before generating content.");
      return;
    }

    setUiState("generating");
    setErrorMessage("");
    setInfoMessage("");

    const prompt = buildAiGeneratorPrompt({
      campaign,
      sourceMaterial,
      mode,
      npcCount,
      selectedSections,
      extraInstructions,
    });

    try {
      await navigator.clipboard.writeText(prompt);
      setInfoMessage("Generation prompt copied. Run it in your AI assistant, then paste the response below.");
    } catch {
      setInfoMessage("Prompt prepared. If copy fails, open Advanced Raw JSON to access the prompt and payload tools.");
    }

    if (assistantOutput.trim()) {
      validateAssistantOutput(assistantOutput);
    } else {
      setUiState("idle");
    }
  }

  function handleBuildPreview() {
    validateAssistantOutput(assistantOutput);
  }

  async function handleApplyConfirmed() {
    if (!preview || applyPending) return;
    if (!canEditCampaign) {
      setErrorMessage("You are not authorized to edit this campaign.");
      return;
    }
    if (preview.characterPlans.length > 0 && !canCreateNpc) {
      setErrorMessage("You are not authorized to create NPCs in this campaign.");
      return;
    }

    setUiState("applying");
    setErrorMessage("");

    try {
      await onApply(preview, mode);
      setShowApplyConfirm(false);
      setUiState("preview_ready");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to apply AI package.");
      setUiState("preview_ready");
    }
  }

  const applySummary = preview
    ? [
        { label: "Skills", count: preview.toCreate.skills.length },
        { label: "Powers", count: preview.toCreate.powers.length },
        { label: "Items", count: preview.toCreate.items.length },
        { label: "Classes", count: preview.toCreate.classes.length },
        { label: "Races", count: preview.toCreate.races.length },
        { label: "Attacks", count: preview.toCreate.attacks.length },
      ].filter((entry) => entry.count > 0)
    : [];

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
        padding: 16,
        zIndex: 1000,
      }}
    >
      <div
        style={{
          ...panelStyle,
          width: "min(1120px, 100%)",
          maxHeight: "min(92vh, 1200px)",
          display: "grid",
          gridTemplateRows: "auto minmax(0, 1fr) auto",
          gap: 14,
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <h3 style={{ margin: 0, color: "var(--text-primary)" }}>AI Generator</h3>
            <p style={{ margin: "6px 0 0", color: "var(--text-secondary)", lineHeight: 1.45 }}>
              Intent, generate, then review exactly what will be applied.
            </p>
          </div>
          <button type="button" className="button-control" style={buttonStyle} onClick={onClose}>
            Close
          </button>
        </div>

        <div style={{ overflow: "auto", display: "grid", gap: 14, paddingRight: 2 }}>
          {!canApply ? (
            <div
              style={{
                ...cardStyle(),
                border: "1px solid rgba(214, 120, 120, 0.45)",
                background: "linear-gradient(165deg, rgba(145, 67, 67, 0.18), var(--cb-surface))",
              }}
            >
              {canEditCampaign
                ? "You can edit campaign content, but this mode cannot create NPCs with your current permissions."
                : "You are not authorized to edit this campaign."}
            </div>
          ) : null}

          <section style={{ ...cardStyle(), gap: 12 }}>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 700, letterSpacing: "0.04em" }}>
              PHASE 1: INTENT
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1.8fr) minmax(280px, 1fr)",
                gap: 12,
              }}
            >
              <div style={{ display: "grid", gap: 12, minWidth: 0 }}>
                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ ...labelTextStyle, marginBottom: 0 }}>Generation Mode</div>
                  <div
                    role="group"
                    aria-label="Generation mode"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                      gap: 8,
                      minWidth: 0,
                    }}
                  >
                    {[
                      { value: "content-only", label: "Content Only" },
                      { value: "npc-roster", label: "NPC + Content" },
                      { value: "campaign-package", label: "Full Package" },
                    ].map((entry) => {
                      const active = mode === (entry.value as AiGeneratorMode);
                      return (
                        <button
                          key={entry.value}
                          type="button"
                          className="button-control"
                          onClick={() => {
                            setMode(entry.value as AiGeneratorMode);
                            resetPreviewState();
                          }}
                          style={{
                            ...(active ? primaryButtonStyle : buttonStyle),
                            minHeight: 42,
                            borderRadius: 999,
                            justifyContent: "center",
                            padding: "0 12px",
                            fontSize: 13,
                            fontWeight: 700,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {entry.label}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ color: "var(--text-secondary)", fontSize: 12 }}>{modeDescription(mode)}</div>
                </div>

                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ ...labelTextStyle, marginBottom: 0 }}>Content Sections</div>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                      alignItems: "center",
                    }}
                  >
                    {ALL_CONTENT_SECTIONS.map((section) => {
                      const active = selectedSections.includes(section);
                      return (
                        <button
                          key={section}
                          type="button"
                          className="button-control"
                          onClick={() => toggleSection(section)}
                          style={{
                            ...(active ? primaryButtonStyle : buttonStyle),
                            minHeight: 34,
                            borderRadius: 999,
                            padding: "0 12px",
                            fontSize: 12,
                            textTransform: "capitalize",
                          }}
                        >
                          {section}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {mode === "npc-roster" ? (
                  <label style={{ ...labelTextStyle, maxWidth: 260 }}>
                    NPC Count
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={npcCount}
                      onChange={(event) => {
                        setNpcCount(Math.max(1, Math.min(100, Number(event.target.value) || 1)));
                        resetPreviewState();
                      }}
                      style={inputStyle}
                    />
                  </label>
                ) : null}

                <label style={labelTextStyle}>
                  Source Material
                  <textarea
                    value={sourceMaterial}
                    onChange={(event) => {
                      setSourceMaterial(event.target.value);
                      resetPreviewState();
                    }}
                    spellCheck={false}
                    placeholder="Describe what should be generated (e.g., 'Fantasy assassin class with poison and stealth abilities')"
                    style={{
                      ...inputStyle,
                      minHeight: 170,
                      resize: "vertical",
                      lineHeight: 1.45,
                    }}
                  />
                </label>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, color: "var(--text-secondary)", fontSize: 12 }}>
                  <span>Use clear theme, mechanics, and constraints for best results.</span>
                  <span>{sourceCount} chars</span>
                </div>

                <div style={{ display: "grid", gap: 8 }}>
                  <button
                    type="button"
                    className="button-control"
                    style={{ ...buttonStyle, justifySelf: "start", minHeight: 34 }}
                    onClick={() => setShowAdvancedOptions((value) => !value)}
                  >
                    {showAdvancedOptions ? "Hide Advanced Options" : "Advanced Options"}
                  </button>

                  {showAdvancedOptions ? (
                    <label style={labelTextStyle}>
                      Additional Instructions
                      <textarea
                        value={extraInstructions}
                        onChange={(event) => {
                          setExtraInstructions(event.target.value);
                          resetPreviewState();
                        }}
                        spellCheck={false}
                        placeholder="Tone, exclusions, balance notes, and special constraints."
                        style={{ ...inputStyle, minHeight: 100, resize: "vertical", lineHeight: 1.45 }}
                      />
                    </label>
                  ) : null}
                </div>
              </div>

              <aside
                style={{
                  ...cardStyle(),
                  alignContent: "start",
                  gap: 8,
                  background: "linear-gradient(150deg, rgba(63, 124, 184, 0.13), var(--cb-surface-raised))",
                  border: "1px solid var(--cb-border-strong)",
                }}
              >
                <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>You are about to generate</div>
                <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>Mode: {modeDescription(mode)}</div>
                <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                  Sections: {selectedSections.length > 0 ? selectedSections.join(", ") : "None"}
                </div>
                <div style={{ borderTop: "1px solid var(--cb-border)", marginTop: 4, paddingTop: 8, display: "grid", gap: 4 }}>
                  <div style={{ color: "var(--text-primary)", fontSize: 13 }}>New Skills: {previewCounts.skills}</div>
                  <div style={{ color: "var(--text-primary)", fontSize: 13 }}>New Powers: {previewCounts.powers}</div>
                  <div style={{ color: "var(--text-primary)", fontSize: 13 }}>New Items: {previewCounts.items}</div>
                  <div style={{ color: "var(--text-primary)", fontSize: 13 }}>New Classes: {previewCounts.classes}</div>
                </div>
              </aside>
            </div>
          </section>

          <section style={cardStyle()}>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 700, letterSpacing: "0.04em" }}>
              PHASE 2: GENERATE
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
              <button
                type="button"
                className="button-control"
                style={{ ...primaryButtonStyle, minHeight: 46, padding: "0 18px" }}
                onClick={() => void handleGenerateContent()}
                disabled={uiState === "generating" || uiState === "applying"}
              >
                {uiState === "generating" ? "Generating content..." : "Generate Content"}
              </button>
              {uiState === "generating" ? (
                <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>Preparing generation instructions...</div>
              ) : null}
            </div>

            {infoMessage ? <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>{infoMessage}</div> : null}

            <label style={labelTextStyle}>
              Assistant Output
              <textarea
                value={assistantOutput}
                onChange={(event) => {
                  setAssistantOutput(event.target.value);
                  if (uiState === "preview_ready") {
                    setUiState("idle");
                  }
                }}
                spellCheck={false}
                placeholder="Paste your AI assistant output here. Markdown and fenced JSON are accepted."
                style={{ ...inputStyle, minHeight: 140, resize: "vertical", lineHeight: 1.45 }}
              />
            </label>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="button-control"
                style={buttonStyle}
                onClick={handleBuildPreview}
                disabled={!assistantOutput.trim() || uiState === "generating"}
              >
                Build Preview
              </button>
            </div>
          </section>

          <section
            ref={previewSectionRef}
            style={{
              ...cardStyle(),
              opacity: preview ? 1 : 0.55,
              transform: preview ? "translateY(0)" : "translateY(4px)",
              transition: "opacity 220ms ease, transform 220ms ease",
            }}
          >
            <div style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 700, letterSpacing: "0.04em" }}>
              PHASE 3: REVIEW + APPLY
            </div>

            <div style={{ fontSize: 20, fontWeight: 750, color: "var(--text-primary)" }}>Preview Changes</div>

            {!preview ? (
              <div style={{ color: "var(--text-secondary)", fontSize: 14 }}>
                Generate content and build preview to review exact changes before applying.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
                  {PRIMARY_PREVIEW_SECTIONS.map((section) => (
                    <div key={section} style={{ border: "1px solid var(--cb-border)", borderRadius: 10, padding: 10, background: "var(--cb-surface-raised)" }}>
                      <div style={{ color: "var(--text-secondary)", fontSize: 12 }}>{prettifySectionName(section)}</div>
                      <div style={{ color: "var(--text-primary)", fontSize: 20, fontWeight: 800 }}>{preview.toCreate[section].length}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
                  {SECONDARY_PREVIEW_SECTIONS.map((section) => (
                    <div key={section} style={{ border: "1px solid var(--cb-border)", borderRadius: 10, padding: 10, background: "var(--cb-surface-raised)" }}>
                      <div style={{ color: "var(--text-secondary)", fontSize: 12 }}>{prettifySectionName(section)}</div>
                      <div style={{ color: "var(--text-primary)", fontSize: 20, fontWeight: 800 }}>{preview.toCreate[section].length}</div>
                    </div>
                  ))}
                </div>

                {[...PRIMARY_PREVIEW_SECTIONS, ...SECONDARY_PREVIEW_SECTIONS].map((section) => {
                  const entries = buildPreviewEntries(preview, section);
                  if (entries.length === 0) return null;
                  const openSection = expandedSections[section];
                  return (
                    <div key={section} style={{ border: "1px solid var(--cb-border)", borderRadius: 10, overflow: "hidden", background: "var(--cb-surface-raised)" }}>
                      <button
                        type="button"
                        className="button-control"
                        onClick={() => togglePreviewSection(section)}
                        style={{
                          width: "100%",
                          border: "none",
                          borderRadius: 0,
                          minHeight: 42,
                          textAlign: "left",
                          padding: "0 12px",
                          background: "transparent",
                          color: "var(--text-primary)",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span style={{ fontWeight: 700 }}>{prettifySectionName(section)} ({entries.length})</span>
                        <span style={{ color: "var(--text-secondary)", fontSize: 12 }}>{openSection ? "Hide" : "Show"}</span>
                      </button>

                      {openSection ? (
                        <div style={{ padding: "4px 12px 12px", display: "grid", gap: 6 }}>
                          {entries.map((entry) => (
                            <div key={`${section}-${entry.status}-${entry.name}`} style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", borderTop: "1px solid var(--cb-border)", paddingTop: 6 }}>
                              <span style={{ color: "var(--text-primary)", fontSize: 13 }}>{entry.name}</span>
                              <span
                                style={{
                                  fontSize: 10,
                                  letterSpacing: "0.04em",
                                  fontWeight: 800,
                                  textTransform: "uppercase",
                                  padding: "2px 7px",
                                  borderRadius: 999,
                                  border: entry.status === "new" ? "1px solid rgba(92, 189, 118, 0.55)" : "1px solid rgba(86, 145, 214, 0.55)",
                                  color: entry.status === "new" ? "rgb(164, 228, 178)" : "rgb(150, 188, 236)",
                                  background: entry.status === "new" ? "rgba(53, 122, 75, 0.28)" : "rgba(49, 89, 145, 0.3)",
                                  flexShrink: 0,
                                }}
                              >
                                {entry.status === "new" ? "NEW" : "REUSED"}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}

                {preview.warnings.length > 0 ? (
                  <div style={{ border: "1px solid rgba(202, 178, 77, 0.55)", borderRadius: 10, background: "rgba(116, 97, 26, 0.2)", padding: 12 }}>
                    <div style={{ color: "rgb(246, 223, 137)", fontWeight: 700, marginBottom: 6 }}>Warnings</div>
                    <ul style={{ margin: 0, paddingLeft: 18, color: "rgb(236, 223, 176)", display: "grid", gap: 6 }}>
                      {preview.warnings.map((warning, index) => (
                        <li key={`${warning.code}-${index}`}>{warning.message}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div style={{ display: "grid", gap: 8 }}>
                  <button
                    type="button"
                    className="button-control"
                    style={{ ...buttonStyle, justifySelf: "start", minHeight: 34 }}
                    onClick={() => setShowRawJson((value) => !value)}
                  >
                    {showRawJson ? "Hide Raw JSON" : "Show Raw JSON"}
                  </button>

                  {showRawJson ? (
                    <div style={{ display: "grid", gap: 8 }}>
                      <textarea
                        value={payloadJson}
                        onChange={(event) => {
                          setPayloadJson(event.target.value);
                          setAssistantOutput(event.target.value);
                          setUiState("idle");
                          setPreview(null);
                        }}
                        spellCheck={false}
                        style={{
                          ...inputStyle,
                          minHeight: 180,
                          resize: "vertical",
                          fontFamily: "SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace",
                          lineHeight: 1.45,
                        }}
                      />
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                        <button
                          type="button"
                          className="button-control"
                          style={buttonStyle}
                          onClick={() => {
                            if (!payloadJson.trim()) return;
                            setAssistantOutput(payloadJson);
                            handleBuildPreview();
                          }}
                          disabled={!payloadJson.trim()}
                        >
                          Rebuild Preview
                        </button>
                      </div>
                    </div>
                  ) : null}
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
        </div>

        <footer
          style={{
            borderTop: "1px solid var(--cb-border)",
            paddingTop: 10,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
            background: "linear-gradient(180deg, rgba(11, 22, 42, 0), var(--cb-surface))",
          }}
        >
          <button type="button" className="button-control" style={buttonStyle} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="button-control"
            style={primaryButtonStyle}
            onClick={() => setShowApplyConfirm(true)}
            disabled={!preview || !canApply || applyPending}
          >
            {applyPending ? "Applying..." : "Apply to Campaign"}
          </button>
        </footer>
      </div>

      {showApplyConfirm && preview ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(2, 6, 16, 0.65)",
            display: "grid",
            placeItems: "center",
            padding: 16,
            zIndex: 1200,
          }}
        >
          <div
            style={{
              ...panelStyle,
              width: "min(460px, 100%)",
              display: "grid",
              gap: 12,
            }}
          >
            <h4 style={{ margin: 0, color: "var(--text-primary)", fontSize: 20 }}>Apply Changes?</h4>
            <div style={{ color: "var(--text-secondary)", display: "grid", gap: 4 }}>
              {applySummary.length === 0 ? (
                <div>No new entities detected; existing references will be reused.</div>
              ) : (
                applySummary.map((entry) => (
                  <div key={entry.label}>Add {entry.count} {entry.label}</div>
                ))
              )}
              {preview.characterPlans.length > 0 ? (
                <div>Create {preview.characterPlans.length} NPC{preview.characterPlans.length === 1 ? "" : "s"}</div>
              ) : null}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                className="button-control"
                style={buttonStyle}
                onClick={() => setShowApplyConfirm(false)}
                disabled={applyPending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button-control"
                style={primaryButtonStyle}
                onClick={() => void handleApplyConfirmed()}
                disabled={applyPending}
              >
                {applyPending ? "Applying..." : "Confirm Apply"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>,
    document.body,
  );
}
