import { useEffect, useRef, useState } from "react";
import type {
  CharacterType,
  CharacterAttack,
  CharacterAttributeGeneration,
  CharacterHp,
  CharacterIdentity,
  CharacterItem,
  CharacterLevelProgressionState,
  CharacterPowerSelection,
  CharacterSkillSelection,
} from "../types/character";
import type {
  AttributeKey,
  ClassDefinition,
  ClassItemChoiceRule,
  ClassPowerChoiceRule,
  ClassSkillChoiceRule,
  CampaignDefinition,
  CampaignLabels,
  ItemDefinition,
  PowerDefinition,
  RaceDefinition,
  SkillDefinition,
} from "../types/gameData";
import {
  getItemChoiceState,
  getPowerChoiceState,
  getSelectedCountForItemRule,
  getSelectedCountForPowerRule,
  getSelectedCountForSkillRule,
  getSkillChoiceState,
} from "../lib/creationChoiceRules";
import { getAttributeModifier } from "../lib/character";
import { getAttributeBonusTotals, getPointBuyBaseScore, getPointBuyCost } from "../lib/pointBuy";
import type { QuickstartConcept, QuickstartLocks } from "../lib/characterQuickstart";
import { buttonStyle, inputStyle, panelStyle, sectionTitleStyle, selectStyle, statCardStyle } from "./uiStyles";
import "./CharacterCreationWizard.css";

export interface CharacterCreationDraft {
  characterType?: CharacterType;
  identity: CharacterIdentity;
  campaignId: string;
  raceId: string;
  classId: string;
  level: number;
  proficiencyBonus: number;
  attributes: Record<AttributeKey, number>;
  saveProf: Record<AttributeKey, boolean>;
  attributeGeneration?: CharacterAttributeGeneration;
  hp: CharacterHp;
  skills: CharacterSkillSelection[];
  powers: CharacterPowerSelection[];
  inventory: CharacterItem[];
  attacks: CharacterAttack[];
  levelProgression: CharacterLevelProgressionState;
}

interface Props {
  step: number;
  draft: CharacterCreationDraft;
  campaigns: CampaignDefinition[];
  racesForCampaign: RaceDefinition[];
  classesForCampaign: ClassDefinition[];
  selectedCampaign: CampaignDefinition | null;
  selectedRace: RaceDefinition | null;
  selectedClass: ClassDefinition | null;
  skills: SkillDefinition[];
  powers: PowerDefinition[];
  items: ItemDefinition[];
  skillChoiceRules: ClassSkillChoiceRule[];
  powerChoiceRules: ClassPowerChoiceRule[];
  itemChoiceRules: ClassItemChoiceRule[];
  pointBuyTotal: number;
  pointBuyRemaining: number;
  labels: CampaignLabels;
  onNameChange: (name: string) => void;
  onCharacterTypeChange: (characterType: CharacterType) => void;
  onCampaignChange: (campaignId: string) => void;
  onRaceChange: (raceId: string) => void;
  onClassChange: (classId: string) => void;
  onAttributeGenerationChange: (method: "pointBuy" | "randomRoll" | "manual") => void;
  onAttributeChange: (key: AttributeKey, value: number) => void;
  onSaveProfToggle: (attribute: AttributeKey, nextSelected: boolean) => void;
  onRollAttributes: () => number[];
  onSkillToggle: (skillId: string, nextSelected: boolean) => void;
  onPowerToggle: (powerId: string, nextSelected: boolean) => void;
  onItemToggle: (itemId: string, nextSelected: boolean) => void;
  onBack: () => void;
  onNext: () => void;
  onCancel: () => void;
  onFinish: () => void;
  quickstartPanelOpen: boolean;
  quickstartMode: "surprise" | "guided" | "concepts";
  quickstartLocks: QuickstartLocks;
  quickstartConcepts: QuickstartConcept[];
  quickstartWarnings: string[];
  quickstartActive: boolean;
  onOpenQuickstart: () => void;
  onCloseQuickstart: () => void;
  onQuickstartModeChange: (mode: "surprise" | "guided" | "concepts") => void;
  onQuickstartLocksChange: (locks: QuickstartLocks) => void;
  onQuickstartGenerate: () => void;
  onQuickstartChooseConcept: (index: number) => void;
  onQuickstartRerollConcepts: () => void;
  onQuickstartRerollEverything: () => void;
  onQuickstartRerollName: () => void;
  onQuickstartRerollAttributes: () => void;
  onQuickstartRerollSkills: () => void;
  onQuickstartEditManually: () => void;
  /** When false, character type is forced to PC and the type selector is hidden. */
  canChooseCharacterType: boolean;
}

const ATTRS: AttributeKey[] = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];
type RollEffectType = "glow" | "glow-strong" | "crack" | "crack-strong";

function getStepTitles(labels: CampaignLabels) {
  return [
    "Campaign",
    "Race",
    labels.className,
    labels.attributes,
    "Saves",
    labels.skills,
    labels.powers,
    labels.inventory,
    "Review",
  ];
}

function getStepStatus(index: number, currentStep: number) {
  if (index < currentStep) return "done";
  if (index === currentStep) return "current";
  return "upcoming";
}

function formatSignedNumber(value: number) {
  return value >= 0 ? `+${value}` : `${value}`;
}

function formatClassAttributeModifiers(
  selectedClass: ClassDefinition | null
) {
  if (!selectedClass) return "";
  const modifiers = (selectedClass.attributeBonuses ?? []).filter((bonus) => bonus.amount !== 0);
  if (modifiers.length === 0) return "None";
  return modifiers
    .map((bonus) => `${bonus.attribute} ${formatSignedNumber(bonus.amount)}`)
    .join(", ");
}

function formatRaceAttributeModifiers(selectedRace: RaceDefinition | null) {
  if (!selectedRace) return "";
  const modifiers = (selectedRace.attributeBonuses ?? []).filter((bonus) => bonus.amount !== 0);
  if (modifiers.length === 0) return "None";
  return modifiers
    .map((bonus) => `${bonus.attribute} ${formatSignedNumber(bonus.amount)}`)
    .join(", ");
}

export default function CharacterCreationWizard({
  step,
  draft,
  campaigns,
  racesForCampaign,
  classesForCampaign,
  selectedCampaign,
  selectedRace,
  selectedClass,
  skills,
  powers,
  items,
  skillChoiceRules,
  powerChoiceRules,
  itemChoiceRules,
  pointBuyTotal,
  pointBuyRemaining,
  labels,
  onNameChange,
  onCharacterTypeChange,
  onCampaignChange,
  onRaceChange,
  onClassChange,
  onAttributeGenerationChange,
  onAttributeChange,
  onSaveProfToggle,
  onRollAttributes,
  onSkillToggle,
  onPowerToggle,
  onItemToggle,
  onBack,
  onNext,
  onCancel,
  onFinish,
  quickstartPanelOpen,
  quickstartMode,
  quickstartLocks,
  quickstartConcepts,
  quickstartWarnings,
  quickstartActive,
  onOpenQuickstart,
  onCloseQuickstart,
  onQuickstartModeChange,
  onQuickstartLocksChange,
  onQuickstartGenerate,
  onQuickstartChooseConcept,
  onQuickstartRerollConcepts,
  onQuickstartRerollEverything,
  onQuickstartRerollName,
  onQuickstartRerollAttributes,
  onQuickstartRerollSkills,
  onQuickstartEditManually,
  canChooseCharacterType,
}: Props) {
  const [rollEffect, setRollEffect] = useState<RollEffectType | null>(null);
  const [isMinMaxTooltipOpen, setIsMinMaxTooltipOpen] = useState(false);
  const glowSoundRef = useRef<HTMLAudioElement | null>(null);
  const crackSoundRef = useRef<HTMLAudioElement | null>(null);
  const hasUserInteractedRef = useRef(false);
  const lastSoundPlayedAtRef = useRef(0);
  const pendingRollEffectTimerRef = useRef<number | null>(null);
  const method = draft.attributeGeneration?.method ?? selectedCampaign?.attributeRules.generationMethods[0] ?? "pointBuy";
  const stepTitles = getStepTitles(labels);
  const currentStepTitle = stepTitles[step] ?? "Overview";
  const classModifiersText = formatClassAttributeModifiers(selectedClass);
  const raceModifiersText = formatRaceAttributeModifiers(selectedRace);
  const attributeBonusTotals = getAttributeBonusTotals(selectedClass, selectedRace);
  const selectedSaveProfCount = ATTRS.filter((attr) => draft.saveProf[attr]).length;
  const hasRaceOptions = racesForCampaign.length > 0;
  const hasClassOptions = classesForCampaign.length > 0;
  const attributeScores = Object.values(draft.attributes).map(Number);
  const highStats = attributeScores.filter((score) => score >= 16).length;
  const dumpStats = attributeScores.filter((score) => score <= 8).length;
  const isMinMaxed = highStats >= 2 && dumpStats >= 1;

  useEffect(() => {
    if (!rollEffect) return;

    const durationMs = rollEffect.startsWith("glow") ? 1500 : 1000;
    const timer = window.setTimeout(() => setRollEffect(null), durationMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [rollEffect]);

  useEffect(() => {
    return () => {
      if (pendingRollEffectTimerRef.current) {
        window.clearTimeout(pendingRollEffectTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const glowAudio = new Audio("/sounds/chime.wav");
    const crackAudio = new Audio("/sounds/crack.wav");

    glowAudio.preload = "auto";
    crackAudio.preload = "auto";
    glowAudio.volume = 0.15;
    crackAudio.volume = 0.2;

    glowSoundRef.current = glowAudio;
    crackSoundRef.current = crackAudio;

    return () => {
      glowAudio.pause();
      crackAudio.pause();
      glowSoundRef.current = null;
      crackSoundRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!rollEffect || !hasUserInteractedRef.current) return;

    const soundCooldownMs = 500;
    const now = Date.now();
    if (now - lastSoundPlayedAtRef.current < soundCooldownMs) {
      return;
    }

    const audioToPlay = rollEffect.startsWith("glow") ? glowSoundRef.current : crackSoundRef.current;
    if (!audioToPlay) return;

    lastSoundPlayedAtRef.current = now;

    const playSound = async () => {
      try {
        audioToPlay.pause();
        audioToPlay.currentTime = 0;
        await audioToPlay.play();
      } catch {
        // Ignore autoplay or decoding issues; visual feedback still runs.
      }
    };

    void playSound();
  }, [rollEffect]);

  useEffect(() => {
    if (!quickstartPanelOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseQuickstart();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onCloseQuickstart, quickstartPanelOpen]);

  useEffect(() => {
    if (!isMinMaxed) {
      setIsMinMaxTooltipOpen(false);
    }
  }, [isMinMaxed]);

  function handleRollAttributesClick() {
    hasUserInteractedRef.current = true;
    const rolls = onRollAttributes();
    const total = rolls.reduce((sum, r) => sum + r, 0);

    let nextEffect: RollEffectType | null = null;
    if (total >= 85) {
      nextEffect = "glow-strong";
    } else if (total >= 80) {
      nextEffect = "glow";
    } else if (total <= 60) {
      nextEffect = "crack-strong";
    } else if (total <= 65) {
      nextEffect = "crack";
    }

    if (pendingRollEffectTimerRef.current) {
      window.clearTimeout(pendingRollEffectTimerRef.current);
      pendingRollEffectTimerRef.current = null;
    }

    // Reset before delayed apply so identical consecutive effects still retrigger.
    setRollEffect(null);

    if (!nextEffect) {
      return;
    }

    pendingRollEffectTimerRef.current = window.setTimeout(() => {
      setRollEffect(nextEffect);
      pendingRollEffectTimerRef.current = null;
    }, 150);
  }

  const showAttributesCrackOverlay = step === 3 && Boolean(rollEffect?.startsWith("crack"));
  const attributesCrackClassName =
    showAttributesCrackOverlay && rollEffect === "crack-strong"
      ? "wizard-step-content effect-crack-panel effect-crack-panel-strong"
      : showAttributesCrackOverlay
      ? "wizard-step-content effect-crack-panel"
      : "wizard-step-content";

  return (
    <section
      className={`character-creation-wizard wizard-container ${rollEffect ? `effect-${rollEffect}` : ""}`}
      style={panelStyle}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 14,
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <h2 style={sectionTitleStyle}>Character Wizard: {currentStepTitle}</h2>
        <button
          onClick={onCancel}
          className="button-control"
          style={{ ...buttonStyle, background: "transparent", border: "1px solid rgba(255,255,255,0.14)", opacity: 0.7 }}
        >
          Cancel
        </button>
      </div>

      <div
        className="wizard-steps"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 0,
          marginBottom: 14,
        }}
      >
        {stepTitles.map((title, index) => {
          const status = getStepStatus(index, step);
          const isCurrent = status === "current";
          const isDone = status === "done";

          return (
            <div
              key={title}
              title={`Step ${index + 1}: ${title}`}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                margin: "0 2px",
                background: isCurrent
                  ? "linear-gradient(90deg, var(--cb-accent), var(--cb-accent-hover))"
                  : isDone
                  ? "rgba(138, 247, 207, 0.46)"
                  : "rgba(255,255,255,0.08)",
                boxShadow: isCurrent ? "0 0 10px var(--cb-accent-soft-strong)" : "none",
                transition: "background 180ms ease, box-shadow 180ms ease",
              }}
            />
          );
        })}
      </div>
      <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 10, opacity: 0.58, fontWeight: 500 }}>
        Step {step + 1} of {stepTitles.length} — {stepTitles[step]}
      </div>

      <div className={attributesCrackClassName}>
      {step === 0 && (
        <div style={{ display: "grid", gap: 10 }}>
          {/* ── Primary: manual inputs ── */}
          <label style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: 14 }}>
            Character Name
            <input
              value={draft.identity.name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="Name your character"
              className="form-control" style={inputStyle}
            />
          </label>

          {canChooseCharacterType ? (
            <label style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: 14 }}>
              Character Type
              <select
                value={draft.characterType ?? "pc"}
                onChange={(e) => onCharacterTypeChange(e.target.value as CharacterType)}
                className="form-control" style={selectStyle}
              >
                <option value="pc">PC</option>
                <option value="npc">NPC</option>
              </select>
            </label>
          ) : null}

          <label style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: 14 }}>
            Campaign
            <select
              value={draft.campaignId}
              onChange={(e) => onCampaignChange(e.target.value)}
              className="form-control" style={selectStyle}
            >
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </option>
              ))}
            </select>
          </label>

          {selectedCampaign?.description && (
            <p style={{ margin: "-6px 0 0", fontSize: 12, color: "var(--text-secondary)", opacity: 0.55, paddingLeft: 2, lineHeight: 1.55 }}>
              {selectedCampaign.description}
            </p>
          )}

          {/* ── Tertiary: Quickstart inline row ── */}
          <button
            onClick={onOpenQuickstart}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              background: "none",
              border: "none",
              padding: "4px 2px",
              cursor: "pointer",
              color: "var(--text-secondary)",
              fontSize: 12,
              opacity: 0.52,
              transition: "opacity 0.15s, color 0.15s",
              textAlign: "left",
              width: "fit-content",
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.opacity = "1";
              el.style.color = "var(--accent-primary)";
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.opacity = "0.65";
              el.style.color = "var(--text-secondary)";
            }}
          >
            <span style={{ fontSize: 14, lineHeight: 1 }}>⚡</span>
            <span>
              <span style={{ fontWeight: 600 }}>Quickstart Character</span>
              <span style={{ marginLeft: 6, opacity: 0.75 }}>— generate a complete character in seconds</span>
            </span>
          </button>
        </div>
      )}

      {step === 1 && (
        <div style={{ display: "grid", gap: 12 }}>
          {racesForCampaign.length === 0 && (
            <div
              style={{
                padding: 12,
                borderRadius: 8,
                border: "1px solid var(--cb-warning-soft-border)",
                background: "var(--cb-warning-soft)",
                color: "var(--cb-warning-text)",
                fontSize: 14,
              }}
            >
              This campaign has no species/race list. Quickstart will omit species and continue.
            </div>
          )}
          <label style={{ fontWeight: 600, color: "var(--cb-muted-label)" }}>
            Race
            <select
              value={draft.raceId}
              onChange={(e) => onRaceChange(e.target.value)}
              className="form-control" style={selectStyle}
              disabled={racesForCampaign.length === 0}
            >
              {racesForCampaign.length === 0 && <option value="">No species available</option>}
              {racesForCampaign.map((race) => (
                <option key={race.id} value={race.id}>
                  {race.name}
                </option>
              ))}
            </select>
          </label>

          {selectedRace && (
            <div
              style={{
                padding: 12,
                borderRadius: 8,
                background: "var(--cb-surface-raised)",
                border: "1px solid var(--cb-border)",
                color: "var(--cb-text)",
              }}
            >
              <div>
                <strong>{selectedRace.name}</strong>
              </div>
              <div style={{ marginTop: 4 }}>
                {selectedRace.description || "No description."}
              </div>
              <div style={{ marginTop: 8, fontSize: 14, color: "var(--cb-text-muted)" }}>
                Modifiers: {raceModifiersText}
              </div>
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div style={{ display: "grid", gap: 12 }}>
          {classesForCampaign.length === 0 && (
            <div
              style={{
                padding: 12,
                borderRadius: 8,
                border: "1px solid var(--cb-warning-soft-border)",
                background: "var(--cb-warning-soft)",
                color: "var(--cb-warning-text)",
                fontSize: 14,
              }}
            >
              This campaign has no class list. Quickstart can still create a basic adventurer concept.
            </div>
          )}
          <label style={{ fontWeight: 600, color: "var(--cb-muted-label)" }}>
            {labels.className}
            <select
              value={draft.classId}
              onChange={(e) => onClassChange(e.target.value)}
              className="form-control" style={selectStyle}
              disabled={classesForCampaign.length === 0}
            >
              {classesForCampaign.length === 0 && <option value="">No classes available</option>}
              {classesForCampaign.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>
          </label>

          {selectedClass && (
            <div
              style={{
                padding: 12,
                borderRadius: 8,
                background: "var(--cb-surface-raised)",
                border: "1px solid var(--cb-border)",
                color: "var(--cb-text)",
              }}
            >
              <div>
                <strong>{selectedClass.name}</strong>
              </div>
              <div style={{ marginTop: 4 }}>
                {selectedClass.description || "No description."}
              </div>
              <div style={{ marginTop: 8, fontSize: 14, color: "var(--cb-text-muted)" }}>
                Hit Die: d{selectedClass.hpRule.hitDie}
              </div>
              <div style={{ marginTop: 8, fontSize: 14, color: "var(--cb-text-muted)" }}>
                Modifiers: {classModifiersText}
              </div>
            </div>
          )}
        </div>
      )}

      {step === 3 && (
        <div style={{ display: "grid", gap: 12 }}>
          {(selectedClass || selectedRace) && (
            <div
              style={{
                padding: 12,
                borderRadius: 8,
                background: "var(--cb-surface-raised)",
                border: "1px solid var(--cb-border)",
                color: "var(--cb-text-muted)",
                fontSize: 14,
              }}
            >
              {selectedClass && (
                <div>
                  Class Modifiers: <strong style={{ color: "var(--cb-text)" }}>{classModifiersText}</strong>
                </div>
              )}
              {selectedRace && (
                <div style={{ marginTop: selectedClass ? 6 : 0 }}>
                  Race Modifiers: <strong style={{ color: "var(--cb-text)" }}>{raceModifiersText}</strong>
                </div>
              )}
            </div>
          )}
          <div className="wizard-attribute-controls">
            <label style={{ fontWeight: 600, color: "var(--cb-muted-label)" }}>
              Generation Method
              <select
                value={method}
                onChange={(e) =>
                  onAttributeGenerationChange(
                    e.target.value as "pointBuy" | "randomRoll" | "manual"
                  )
                }
                className="form-control" style={selectStyle}
              >
                <option value="manual">Manual</option>
                <option value="pointBuy">Point Buy</option>
                <option value="randomRoll">Random Roll</option>
              </select>
            </label>
            {isMinMaxed && (
              <div
                className="wizard-minmax-warning"
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                    setIsMinMaxTooltipOpen(false);
                  }
                }}
              >
                <button
                  type="button"
                  className="wizard-minmax-badge"
                  aria-label="Optimized build warning"
                  aria-describedby="wizard-minmax-tooltip"
                  aria-expanded={isMinMaxTooltipOpen}
                  onClick={() => setIsMinMaxTooltipOpen((open) => !open)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      setIsMinMaxTooltipOpen(false);
                    }
                  }}
                >
                  ⚠️ Optimized Build
                </button>
                <span
                  id="wizard-minmax-tooltip"
                  role="tooltip"
                  className={`wizard-minmax-tooltip ${isMinMaxTooltipOpen ? "is-visible" : ""}`}
                >
                  Your GM is already planning your downfall.
                </span>
              </div>
            )}
          </div>

          {method === "pointBuy" && (
            <div
              style={{
                padding: 12,
                borderRadius: 8,
                background: "var(--cb-accent-soft-strong)",
                color: "var(--text-primary)",
                fontSize: 14,
                border: "1px solid var(--accent-primary)",
              }}
            >
              <strong>Point Buy:</strong> {pointBuyRemaining} / {pointBuyTotal} points remaining
            </div>
          )}

          {method === "randomRoll" && (
            <div>
              <button onClick={handleRollAttributesClick} className="button-control" style={buttonStyle}>
                Roll Stats
              </button>
            </div>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 12,
            }}
          >
            {ATTRS.map((attr) => {
              const baseScore = getPointBuyBaseScore(draft.attributes[attr], attributeBonusTotals[attr]);
              const pointBuyCost = method === "pointBuy" ? getPointBuyCost(baseScore) : null;
              const combinedModifier = attributeBonusTotals[attr];
              const attributeModifier = getAttributeModifier(draft.attributes[attr]);

              return (
                <div
                  key={attr}
                  style={{
                    ...statCardStyle,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    padding: 24,
                  }}
                >
                  <span
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      gap: 8,
                      marginBottom: 4,
                    }}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <span>{attr}</span>
                      {combinedModifier !== 0 && (
                        <span
                          style={{
                            fontWeight: 500,
                            fontSize: 12,
                            color: "var(--text-secondary)",
                            background: "rgba(255,255,255,0.08)",
                            border: "1px solid var(--border-soft)",
                            borderRadius: 999,
                            padding: "1px 7px",
                            lineHeight: 1.4,
                          }}
                        >
                          {formatSignedNumber(combinedModifier)}
                        </span>
                      )}
                    </span>
                    {pointBuyCost !== null && (
                      <span style={{ fontWeight: 500, fontSize: 12, color: "var(--text-secondary)" }}>
                        {pointBuyCost} pts
                      </span>
                    )}
                  </span>
                  <label style={{ display: "flex", flexDirection: "column", fontWeight: 600, color: "var(--cb-muted-label)" }}>
                    <input
                      type="number"
                      value={draft.attributes[attr]}
                      onChange={(e) => onAttributeChange(attr, Number(e.target.value) || 0)}
                      style={{ ...inputStyle, marginTop: 0 }}
                    />
                  </label>
                  <span style={{ marginTop: 8, fontSize: 14, color: "var(--text-secondary)" }}>
                    Mod: {attributeModifier >= 0 ? "+" : ""}
                    {attributeModifier}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {step === 4 && (
        <div style={{ display: "grid", gap: 12 }}>
          <div
            style={{
              padding: 12,
              borderRadius: 8,
              background: "var(--cb-accent-soft-strong)",
              color: "var(--text-primary)",
              fontSize: 14,
              border: "1px solid var(--accent-primary)",
            }}
          >
            <strong>Saving Throw Proficiencies:</strong> choose exactly 2 attributes.
            <div style={{ marginTop: 4 }}>
              Selected: {selectedSaveProfCount} / 2
            </div>
          </div>

          {ATTRS.map((attr) => {
            const checked = draft.saveProf[attr];
            const disableUnchecked = !checked && selectedSaveProfCount >= 2;

            return (
              <label
                key={attr}
                style={{
                  padding: 12,
                  borderRadius: 8,
                  border: "1px solid var(--border-soft)",
                  background: checked ? "var(--cb-accent-soft-strong)" : "var(--cb-selection-row-bg)",
                  color: "var(--text-primary)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <span>
                  <strong>{attr}</strong> Save Proficiency
                </span>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disableUnchecked}
                  onChange={(e) => onSaveProfToggle(attr, e.target.checked)}
                />
              </label>
            );
          })}
        </div>
      )}

      {step === 5 && (
        <div style={{ display: "grid", gap: 12 }}>
          {skillChoiceRules.map((rule, index) => {
            const selectedCount = getSelectedCountForSkillRule(rule, draft.skills);
            return (
              <div
                key={`${index}-${rule.skillIds.join("-")}`}
                style={{
                  padding: 12,
                  borderRadius: 8,
                  background: "var(--cb-accent-soft-strong)",
                  color: "var(--text-primary)",
                  fontSize: 14,
                  border: "1px solid var(--accent-primary)",
                }}
              >
                <strong>{labels.skills}:</strong> choose exactly {rule.choose} skills.
                <div style={{ marginTop: 4 }}>
                  Selected: {selectedCount}/{rule.choose}
                </div>
              </div>
            );
          })}

          {skills.map((skill) => {
            const selectedSkill = draft.skills.find((s) => s.skillId === skill.id);
            const isSelected = selectedSkill?.proficient ?? false;
            const choiceState = getSkillChoiceState(
              skill.id,
              isSelected,
              draft.skills,
              skillChoiceRules
            );
            const canBeChosen = choiceState.canBeChosen;
            const disabled = choiceState.disabled;

            if (!canBeChosen && !isSelected) {
              return null;
            }

            return (
              <label
                key={skill.id}
                style={{
                  padding: 12,
                  borderRadius: 8,
                  border: "1px solid var(--border-soft)",
                  background: isSelected ? "var(--cb-accent-soft-strong)" : "var(--cb-selection-row-bg)",
                  color: "var(--text-primary)",
                  opacity: canBeChosen ? 1 : 0.7,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <span>
                  <strong>{skill.name}</strong> ({skill.attribute})
                  {skill.description && (
                    <div style={{ fontWeight: 400, fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>
                      {skill.description}
                    </div>
                  )}
                </span>
                <input
                  type="checkbox"
                  checked={isSelected}
                  disabled={disabled}
                  onChange={(e) => onSkillToggle(skill.id, e.target.checked)}
                />
              </label>
            );
          })}
        </div>
      )}

      {step === 6 && (
        <div style={{ display: "grid", gap: 12 }}>
          {powerChoiceRules.map((rule, index) => {
            const selectedCount = getSelectedCountForPowerRule(rule, draft.powers);
            return (
              <div
                key={`${index}-${rule.powerIds.join("-")}`}
                style={{
                  padding: 12,
                  borderRadius: 8,
                  background: "var(--cb-accent-soft-strong)",
                  color: "var(--text-primary)",
                  fontSize: 14,
                  border: "1px solid var(--accent-primary)",
                }}
              >
                <strong>{labels.powers}:</strong> choose exactly {rule.choose} powers.
                <div style={{ marginTop: 4 }}>
                  Selected: {selectedCount} / {rule.choose}
                </div>
              </div>
            );
          })}

          {powers.map((power) => {
            const isSelected = draft.powers.some((p) => p.powerId === power.id);
            const choiceState = getPowerChoiceState(
              power.id,
              isSelected,
              draft.powers,
              powerChoiceRules
            );
            const canBeChosen = choiceState.canBeChosen;
            const disabled = choiceState.disabled;

            if (!canBeChosen && !isSelected) {
              return null;
            }

            return (
              <label
                key={power.id}
                style={{
                  padding: 12,
                  borderRadius: 8,
                  border: "1px solid var(--border-soft)",
                  background: isSelected ? "var(--cb-accent-soft-strong)" : "var(--cb-selection-row-bg)",
                  color: "var(--text-primary)",
                  opacity: canBeChosen ? 1 : 0.7,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <span>
                  <strong>{power.name}</strong>
                  <div style={{ fontWeight: 400, fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>
                    {power.description || "No description."}
                  </div>
                </span>
                <input
                  type="checkbox"
                  checked={isSelected}
                  disabled={disabled}
                  onChange={(e) => onPowerToggle(power.id, e.target.checked)}
                />
              </label>
            );
          })}
        </div>
      )}

      {step === 7 && (
        <div style={{ display: "grid", gap: 12 }}>
          {itemChoiceRules.map((rule, index) => {
            const selectedCount = getSelectedCountForItemRule(rule, draft.inventory);
            return (
              <div
                key={`${index}-${rule.itemIds.join("-")}`}
                style={{
                  padding: 12,
                  borderRadius: 8,
                  background: "var(--cb-accent-soft-strong)",
                  color: "var(--text-primary)",
                  fontSize: 14,
                  border: "1px solid var(--accent-primary)",
                }}
              >
                <strong>{labels.inventory}:</strong> choose up to {rule.choose} items.
                <div style={{ marginTop: 4 }}>
                  Selected {selectedCount}/{rule.choose}
                </div>
              </div>
            );
          })}

          {items.map((item) => {
            const isSelected = draft.inventory.some((i) => i.itemId === item.id);
            const choiceState = getItemChoiceState(
              item.id,
              isSelected,
              draft.inventory,
              itemChoiceRules
            );
            const canBeChosen = choiceState.canBeChosen;
            const disabled = choiceState.disabled;

            if (!canBeChosen && !isSelected) {
              return null;
            }

            return (
              <label
                key={item.id}
                style={{
                  padding: 12,
                  borderRadius: 8,
                  border: "1px solid var(--border-soft)",
                  background: isSelected ? "var(--cb-accent-soft-strong)" : "var(--cb-selection-row-bg)",
                  color: "var(--text-primary)",
                  opacity: canBeChosen ? 1 : 0.7,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <span>
                  <strong>{item.name}</strong>
                  <div style={{ fontWeight: 400, fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>
                    {item.description || "Item"}
                  </div>
                </span>
                <input
                  type="checkbox"
                  checked={isSelected}
                  disabled={disabled}
                  onChange={(e) => onItemToggle(item.id, e.target.checked)}
                />
              </label>
            );
          })}
        </div>
      )}

      {step === 8 && (
        <div style={{ display: "grid", gap: 12 }}>
          {quickstartActive && (
            <div
              style={{
                padding: 10,
                borderRadius: 8,
                border: "1px solid rgba(73, 224, 255, 0.28)",
                background: "rgba(73, 224, 255, 0.08)",
                color: "var(--text-primary)",
              }}
            >
              <strong style={{ fontSize: 13 }}>Quickstart Review</strong>
              <div style={{ marginTop: 3, color: "var(--text-secondary)", fontSize: 12, opacity: 0.9 }}>
                Check this generated character before keeping it, reroll sections, or switch to manual editing.
              </div>
            </div>
          )}
          <div style={{ color: "var(--cb-muted-label)" }}>
            <strong>Name:</strong> {draft.identity.name}
          </div>
          <div style={{ color: "var(--cb-muted-label)" }}>
            <strong>Character Type:</strong> {(draft.characterType ?? "pc").toUpperCase()}
          </div>
          <div style={{ color: "var(--cb-muted-label)" }}>
            <strong>Campaign:</strong> {selectedCampaign?.name}
          </div>
          <div style={{ color: "var(--cb-muted-label)" }}>
            <strong>Race:</strong> {selectedRace?.name}
          </div>
          <div style={{ color: "var(--cb-muted-label)" }}>
            <strong>{labels.className}:</strong> {selectedClass?.name || "Adventurer (no class data)"}
          </div>
          <div style={{ color: "var(--cb-muted-label)" }}>
            <strong>Background:</strong> {draft.identity.background || "None"}
          </div>
          <div style={{ color: "var(--cb-muted-label)" }}>
            <strong>Ancestry:</strong> {draft.identity.ancestry || "None"}
          </div>
          <div style={{ color: "var(--cb-muted-label)" }}>
            <strong>{labels.attributes}:</strong>{" "}
            {ATTRS.map((attr) => `${attr} ${draft.attributes[attr]}`).join(", ")}
          </div>
          <div style={{ color: "var(--cb-muted-label)" }}>
            <strong>Saves:</strong>{" "}
            {ATTRS.filter((attr) => draft.saveProf[attr]).join(", ") || "None"}
          </div>
          <div style={{ color: "var(--cb-muted-label)" }}>
            <strong>{labels.skills}:</strong>{" "}
            {draft.skills
              .filter((skill) => skill.proficient)
              .map((skill) => skills.find((s) => s.id === skill.skillId)?.name ?? skill.skillId)
              .join(", ") || "None"}
          </div>
          <div style={{ color: "var(--cb-muted-label)" }}>
            <strong>{labels.powers}:</strong>{" "}
            {draft.powers.map((power) => power.name).join(", ") || "None"}
          </div>
          <div style={{ color: "var(--cb-muted-label)" }}>
            <strong>{labels.inventory}:</strong>{" "}
            {draft.inventory.map((item) => `${item.name} x${item.quantity}`).join(", ") || "None"}
          </div>
          <div style={{ color: "var(--cb-muted-label)" }}>
            <strong>{labels.attacks}:</strong>{" "}
            {[...draft.attacks].sort((a, b) => a.name.trim().localeCompare(b.name.trim(), undefined, { sensitivity: "base" })).map((attack) => `${attack.name} (${attack.damage})`).join(", ") || "None"}
          </div>
          <div style={{ color: "var(--cb-muted-label)" }}>
            <strong>{labels.hp}:</strong> {draft.hp.current} / {draft.hp.max}
          </div>
          {selectedClass && (
            <div style={{ color: "var(--text-secondary)", fontSize: 14 }}>
              Starting HP uses d{selectedClass.hpRule.hitDie} + CON modifier.
            </div>
          )}
          {quickstartActive && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={onFinish} className="button-control" style={buttonStyle}>Keep Character</button>
              <button onClick={onQuickstartRerollEverything} className="button-control" style={buttonStyle}>Reroll Everything</button>
              <button onClick={onQuickstartRerollName} className="button-control" style={buttonStyle}>Reroll Name</button>
              <button onClick={onQuickstartRerollAttributes} className="button-control" style={buttonStyle}>Reroll Attributes</button>
              <button onClick={onQuickstartRerollSkills} className="button-control" style={buttonStyle}>Reroll Skills</button>
              <button onClick={onQuickstartEditManually} className="button-control" style={buttonStyle}>Edit Manually</button>
            </div>
          )}
        </div>
      )}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 18,
        }}
      >
        <button
          onClick={onBack}
          disabled={step === 0}
          style={{
            ...buttonStyle,
            opacity: step === 0 ? 0.3 : 0.62,
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.14)",
            boxShadow: "none",
          }}
        >
          Back
        </button>

        {step < stepTitles.length - 1 ? (
          <button
            onClick={onNext}
            style={{
              ...buttonStyle,
              background: "linear-gradient(140deg, var(--cb-accent), var(--cb-accent-hover))",
              border: "1px solid var(--cb-accent)",
              color: "var(--cb-accent-contrast)",
              fontWeight: 750,
              boxShadow: "0 6px 14px var(--cb-accent-soft)",
            }}
          >
            Next
          </button>
        ) : (
          <button onClick={onFinish} className="button-control" style={buttonStyle}>
            {quickstartActive ? "Keep Character" : "Finish Character"}
          </button>
        )}
      </div>

      {quickstartPanelOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(2, 6, 16, 0.68)",
            zIndex: 60,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="quickstart-title"
        >
          <div
            style={{
              width: "min(980px, 100%)",
              maxHeight: "85vh",
              overflow: "auto",
              borderRadius: 12,
              border: "1px solid var(--border-soft)",
              background: "linear-gradient(165deg, var(--surface-1), var(--surface-0))",
              padding: 16,
              display: "grid",
              gap: 16,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <h3 id="quickstart-title" style={{ margin: 0, color: "var(--text-primary)" }}>Character Quickstart</h3>
              <button onClick={onCloseQuickstart} className="button-control" style={buttonStyle}>Close</button>
            </div>

            <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>
              Not saved yet. Quickstart only fills the draft and sends you to review.
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
              <button
                onClick={() => onQuickstartModeChange("surprise")}
                style={{
                  ...buttonStyle,
                  border: quickstartMode === "surprise" ? "1px solid var(--accent-primary)" : buttonStyle.border,
                  background: quickstartMode === "surprise" ? "var(--cb-accent-soft)" : buttonStyle.background,
                }}
              >
                Surprise Me
              </button>
              <button
                onClick={() => onQuickstartModeChange("guided")}
                style={{
                  ...buttonStyle,
                  border: quickstartMode === "guided" ? "1px solid var(--accent-primary)" : buttonStyle.border,
                  background: quickstartMode === "guided" ? "var(--cb-accent-soft)" : buttonStyle.background,
                }}
              >
                Guided Random
              </button>
              <button
                onClick={() => onQuickstartModeChange("concepts")}
                style={{
                  ...buttonStyle,
                  border: quickstartMode === "concepts" ? "1px solid var(--accent-primary)" : buttonStyle.border,
                  background: quickstartMode === "concepts" ? "var(--cb-accent-soft)" : buttonStyle.background,
                }}
              >
                Roll 3 Concepts
              </button>
            </div>

            {quickstartMode === "guided" && (
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                  Lock key choices and randomize the rest.
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                  <label style={{ fontWeight: 600, color: "var(--cb-muted-label)" }}>
                    Race / Species
                    <select
                      value={quickstartLocks.raceId ?? ""}
                      onChange={(e) =>
                        onQuickstartLocksChange({
                          ...quickstartLocks,
                          raceId: e.target.value || undefined,
                        })
                      }
                      className="form-control" style={selectStyle}
                      disabled={!hasRaceOptions}
                    >
                      <option value="">Random</option>
                      {racesForCampaign.map((race) => (
                        <option key={race.id} value={race.id}>{race.name}</option>
                      ))}
                    </select>
                    {!hasRaceOptions && (
                      <div style={{ marginTop: 4, color: "var(--text-secondary)", fontSize: 12 }}>
                        No species list found. Generation will omit species.
                      </div>
                    )}
                  </label>

                  <label style={{ fontWeight: 600, color: "var(--cb-muted-label)" }}>
                    {labels.className}
                    <select
                      value={quickstartLocks.classId ?? ""}
                      onChange={(e) =>
                        onQuickstartLocksChange({
                          ...quickstartLocks,
                          classId: e.target.value || undefined,
                        })
                      }
                      className="form-control" style={selectStyle}
                      disabled={!hasClassOptions}
                    >
                      <option value="">Random</option>
                      {classesForCampaign.map((cls) => (
                        <option key={cls.id} value={cls.id}>{cls.name}</option>
                      ))}
                    </select>
                    {!hasClassOptions && (
                      <div style={{ marginTop: 4, color: "var(--text-secondary)", fontSize: 12 }}>
                        No class list found. Generation will create a basic concept.
                      </div>
                    )}
                  </label>

                  <label style={{ fontWeight: 600, color: "var(--cb-muted-label)" }}>
                    Background / Archetype
                    <input
                      value={quickstartLocks.background ?? ""}
                      onChange={(e) =>
                        onQuickstartLocksChange({
                          ...quickstartLocks,
                          background: e.target.value || undefined,
                        })
                      }
                      className="form-control" style={inputStyle}
                      placeholder="Random if blank"
                    />
                  </label>
                </div>
              </div>
            )}

            {quickstartMode === "concepts" && quickstartConcepts.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 12 }}>
                {quickstartConcepts.map((concept, index) => (
                  <div
                    key={`${concept.id}-${index}`}
                    role="button"
                    tabIndex={0}
                    aria-label={`Use concept ${index + 1}: ${concept.name}`}
                    onClick={() => onQuickstartChooseConcept(index)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onQuickstartChooseConcept(index);
                      }
                    }}
                    style={{
                      border: "1px solid var(--border-soft)",
                      borderRadius: 10,
                      padding: 12,
                      background: "var(--cb-selection-row-bg)",
                      display: "grid",
                      gap: 8,
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ color: "var(--text-primary)", fontWeight: 700 }}>{concept.name}</div>
                    <div style={{ color: "var(--cb-muted-label)", fontSize: 13 }}><strong>Race:</strong> {concept.raceName || "None"}</div>
                    <div style={{ color: "var(--cb-muted-label)", fontSize: 13 }}><strong>{labels.className}:</strong> {concept.className}</div>
                    <div style={{ color: "var(--cb-muted-label)", fontSize: 13 }}><strong>Background:</strong> {concept.background}</div>
                    <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>{concept.summary}</div>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        onQuickstartChooseConcept(index);
                      }}
                      className="button-control" style={buttonStyle}
                    >
                      Use This Concept
                    </button>
                  </div>
                ))}
              </div>
            )}

            {quickstartMode === "concepts" && quickstartConcepts.length === 0 && (
              <div
                style={{
                  padding: 12,
                  borderRadius: 8,
                  border: "1px solid var(--border-soft)",
                  background: "var(--cb-selection-row-bg)",
                  color: "var(--text-secondary)",
                  fontSize: 14,
                }}
              >
                No concepts generated yet. Select Generate 3 Concepts to create options.
              </div>
            )}

            {quickstartWarnings.length > 0 && (
              <div style={{ display: "grid", gap: 6 }}>
                {quickstartWarnings.map((warning, index) => (
                  <div
                    key={`${warning}-${index}`}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: "1px solid var(--cb-warning-soft-border)",
                      background: "var(--cb-warning-soft)",
                      color: "var(--cb-warning-text)",
                      fontSize: 13,
                    }}
                  >
                    {warning}
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, justifyContent: "space-between", flexWrap: "wrap" }}>
              <div style={{ color: "var(--text-secondary)", fontSize: 13, alignSelf: "center" }}>
                Generated characters always go through review before being saved.
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {quickstartMode === "concepts" && (
                  <button onClick={onQuickstartRerollConcepts} className="button-control" style={buttonStyle}>Reroll 3 Concepts</button>
                )}
                <button onClick={onQuickstartGenerate} className="button-control" style={buttonStyle}>
                  {quickstartMode === "concepts" ? "Generate 3 Concepts" : "Generate & Review"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {rollEffect && (
        <div className="wizard-roll-feedback" aria-live="polite">
          {rollEffect.startsWith("glow")
            ? "Exceptional potential detected."
            : "Structural integrity... questionable."}
        </div>
      )}
    </section>
  );
}