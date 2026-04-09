import { useState } from "react";
import type {
  AttackTemplateDefinition,
  AttributeBonusRule,
  AttributeKey,
  ClassDefinition,
  ClassItemChoiceRule,
  LevelProgressionHpGainMode,
  ClassLevelProgressionRow,
  ClassPowerChoiceRule,
  ClassSkillChoiceRule,
  GameData,
  CampaignDefinition,
  ItemDefinition,
  PowerDefinition,
  SkillDefinition,
} from "../types/gameData";
import {
  buttonStyle,
  inputStyle,
  labelTextStyle,
  mutedTextStyle,
  panelStyle,
  primaryButtonStyle,
  sectionTitleStyle,
} from "./uiStyles";

interface Props {
  gameData: GameData;
  onSave: (gameData: GameData) => void;
  onClose: () => void;
}

type AdminTab = "campaigns" | "classes" | "skills" | "powers" | "items" | "attacks";
const HIT_DIE_OPTIONS = [4, 6, 8, 10, 12, 20] as const;
const ATTRIBUTE_KEYS: AttributeKey[] = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];
const compactNumberInputStyle = {
  ...inputStyle,
  maxWidth: 132,
};
const compactChoiceCountInputStyle = {
  ...inputStyle,
  maxWidth: 120,
};
const HP_GAIN_MODE_OPTIONS: Array<{ value: LevelProgressionHpGainMode; label: string }> = [
  { value: "full", label: "Full Die" },
  { value: "random", label: "Random Roll" },
  { value: "half", label: "Half / Average" },
];

function makeBlankCampaign(): CampaignDefinition {
  return {
    id: `campaign-${Date.now()}`,
    name: "New Campaign",
    description: "",
    labels: {
      attributes: "Attributes",
      skills: "Skills",
      attacks: "Attacks",
      powers: "Powers",
      inventory: "Inventory",
      className: "Class",
      level: "Level",
      hp: "HP",
    },
    classes: [],
    skills: [],
    powers: [],
    items: [],
    attackTemplates: [],
    availableClassIds: [],
    availableSkillIds: [],
    availablePowerIds: [],
    availableItemIds: [],
    availableAttackTemplateIds: [],
    attributeRules: {
      generationMethods: ["manual"],
      pointBuyTotal: 27,
      randomRollFormula: "4d6 drop lowest",
      randomRollCount: 6,
      randomRollDropLowest: 1,
      minimumScore: 3,
      maximumScore: 18,
    },
  };
}

function makeBlankClass(campaignId: string): ClassDefinition {
  return {
    id: `class-${Date.now()}`,
    campaignId,
    name: "New Class",
    description: "",
    attributeBonuses: [],
    hpRule: {
      hitDie: 8,
      level1Mode: "fixed-max",
      levelUpMode: "fixed-average",
      levelUpFixedValue: 5,
    },
    levelProgression: [
      {
        level: 1,
        hitDiceGained: 1,
        hpGainMode: "half",
        newSkillChoices: 0,
        newPowerChoices: 0,
        attributeBonuses: [],
      },
    ],
    startingAttackTemplateIds: [],
    defaultPowerIds: [],
    skillChoiceRules: [],
    powerChoiceRules: [],
    itemChoiceRules: [],
    levelUpSkillChoiceRules: [],
    levelUpPowerChoiceRules: [],
    levelUpItemChoiceRules: [],
  };
}

function makeBlankSkill(): SkillDefinition {
  return {
    id: `skill-${Date.now()}`,
    name: "New Skill",
    attribute: "STR",
    description: "",
    tags: [],
  };
}

function makeBlankPower(): PowerDefinition {
  return {
    id: `power-${Date.now()}`,
    name: "New Power",
    description: "",
    tags: [],
    category: "",
    sourceText: "",
  };
}

function makeBlankItem(): ItemDefinition {
  return {
    id: `item-${Date.now()}`,
    name: "New Item",
    description: "",
    category: "gear",
    stackable: false,
    defaultQuantity: 1,
    tags: [],
  };
}

function makeBlankAttackTemplate(): AttackTemplateDefinition {
  return {
    id: `attack-${Date.now()}`,
    name: "New Attack",
    attribute: "STR",
    damage: "1d6",
    bonus: 0,
    notes: "",
    tags: [],
  };
}

function cardStyle() {
  return {
    ...panelStyle,
    padding: 16,
  };
}

function gridCols(cols: number) {
  return {
    display: "grid",
    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
    gap: 12,
  };
}

function sortLevelProgression(rows: ClassLevelProgressionRow[]) {
  return [...rows].sort((a, b) => a.level - b.level);
}

function formatBonusSummary(bonuses: AttributeBonusRule[]) {
  if (bonuses.length === 0) return "None";
  return bonuses
    .map((bonus) => `${bonus.attribute} ${bonus.amount >= 0 ? `+${bonus.amount}` : bonus.amount}`)
    .join(", ");
}

function EntityListEditor<T extends { id: string; name: string }>(props: {
  title: string;
  helper?: string;
  items: T[];
  selectedId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
  subtitle?: (item: T) => string;
}) {
  return (
    <aside style={{ ...panelStyle, padding: 12, height: "100%", overflow: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ margin: 0, color: "var(--text-primary)" }}>{props.title}</h3>
        <button onClick={props.onAdd} style={buttonStyle}>
          Add
        </button>
      </div>
      {props.helper ? <div style={{ marginBottom: 10 }}>{props.helper}</div> : null}
      <div style={{ display: "grid", gap: 8 }}>
        {props.items.length === 0 ? (
          <p style={{ margin: 0, ...mutedTextStyle }}>Nothing here yet.</p>
        ) : (
          props.items.map((item) => {
            const isSelected = item.id === props.selectedId;
            return (
              <div key={item.id} style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => props.onSelect(item.id)}
                  style={{
                    flex: 1,
                    textAlign: "left",
                    padding: 10,
                    borderRadius: 8,
                    border: isSelected ? "1px solid var(--accent-primary)" : "1px solid var(--border-soft)",
                    background: isSelected ? "rgba(73, 224, 255, 0.16)" : "rgba(11, 22, 42, 0.75)",
                    color: "var(--text-primary)",
                    cursor: "pointer",
                  }}
                >
                  <strong>{item.name}</strong>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                    {props.subtitle ? props.subtitle(item) : item.id}
                  </div>
                </button>
                <button onClick={() => props.onDelete(item.id)} style={buttonStyle}>
                  ✕
                </button>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}

export default function AdminScreen({ gameData, onSave, onClose }: Props) {
  const [workingData, setWorkingData] = useState<GameData>(gameData);
  const [tab, setTab] = useState<AdminTab>("campaigns");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>(gameData.campaigns[0]?.id ?? "");
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [selectedSkillId, setSelectedSkillId] = useState<string>("");
  const [selectedPowerId, setSelectedPowerId] = useState<string>("");
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [selectedAttackId, setSelectedAttackId] = useState<string>("");

  const selectedCampaign = workingData.campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? null;
  const selectedClass = selectedCampaign?.classes.find((cls) => cls.id === selectedClassId) ?? null;
  const selectedSkill = selectedCampaign?.skills.find((skill) => skill.id === selectedSkillId) ?? null;
  const selectedPower = selectedCampaign?.powers.find((power) => power.id === selectedPowerId) ?? null;
  const selectedItem = selectedCampaign?.items.find((item) => item.id === selectedItemId) ?? null;
  const selectedAttack = selectedCampaign?.attackTemplates.find((attack) => attack.id === selectedAttackId) ?? null;

  function updateCampaign(updatedCampaign: CampaignDefinition) {
    setWorkingData((prev) => ({
      ...prev,
      campaigns: prev.campaigns.map((campaign) =>
        campaign.id === updatedCampaign.id ? updatedCampaign : campaign
      ),
    }));
  }

  function addCampaign() {
    const newCampaign = makeBlankCampaign();
    setWorkingData((prev) => ({
      ...prev,
      campaigns: [...prev.campaigns, newCampaign],
    }));
    setSelectedCampaignId(newCampaign.id);
    setTab("campaigns");
  }

  function deleteCampaign(id: string) {
    const campaign = workingData.campaigns.find((campaign) => campaign.id === id);
    const displayName = campaign?.name || "this campaign";
    if (!window.confirm(`Delete ${displayName}?`)) return;

    const remainingCampaigns = workingData.campaigns.filter((campaign) => campaign.id !== id);
    setWorkingData((prev) => ({
      ...prev,
      campaigns: remainingCampaigns,
    }));

    setSelectedCampaignId(remainingCampaigns[0]?.id ?? "");
  }

  function selectCampaign(id: string) {
    setSelectedCampaignId(id);
    setSelectedClassId("");
    setSelectedSkillId("");
    setSelectedPowerId("");
    setSelectedItemId("");
    setSelectedAttackId("");
  }

  function updateClass(updatedClass: ClassDefinition) {
    if (!selectedCampaign) return;
    updateCampaign({
      ...selectedCampaign,
      classes: selectedCampaign.classes.map((cls) =>
        cls.id === updatedClass.id ? updatedClass : cls
      ),
    });
  }

  function addClass() {
    if (!selectedCampaign) return;
    const newClass = makeBlankClass(selectedCampaign.id);
    updateCampaign({
      ...selectedCampaign,
      classes: [...selectedCampaign.classes, newClass],
    });
    setSelectedClassId(newClass.id);
    setTab("classes");
  }

  function deleteClass(id: string) {
    if (!selectedCampaign) return;
    const cls = selectedCampaign.classes.find((value) => value.id === id);
    const displayName = cls?.name || "this class";
    if (!window.confirm(`Delete ${displayName}?`)) return;
    updateCampaign({
      ...selectedCampaign,
      classes: selectedCampaign.classes.filter((value) => value.id !== id),
    });
    setSelectedClassId("");
  }

  function updateSkill(updatedSkill: SkillDefinition) {
    if (!selectedCampaign) return;
    updateCampaign({
      ...selectedCampaign,
      skills: selectedCampaign.skills.map((skill) =>
        skill.id === updatedSkill.id ? updatedSkill : skill
      ),
    });
  }

  function addSkill() {
    if (!selectedCampaign) return;
    const newSkill = makeBlankSkill();
    updateCampaign({
      ...selectedCampaign,
      skills: [...selectedCampaign.skills, newSkill],
    });
    setSelectedSkillId(newSkill.id);
    setTab("skills");
  }

  function deleteSkill(id: string) {
    if (!selectedCampaign) return;
    const skill = selectedCampaign.skills.find((value) => value.id === id);
    const displayName = skill?.name || "this skill";
    if (!window.confirm(`Delete ${displayName}?`)) return;
    updateCampaign({
      ...selectedCampaign,
      skills: selectedCampaign.skills.filter((value) => value.id !== id),
    });
    setSelectedSkillId("");
  }

  function updatePower(updatedPower: PowerDefinition) {
    if (!selectedCampaign) return;
    updateCampaign({
      ...selectedCampaign,
      powers: selectedCampaign.powers.map((power) =>
        power.id === updatedPower.id ? updatedPower : power
      ),
    });
  }

  function addPower() {
    if (!selectedCampaign) return;
    const newPower = makeBlankPower();
    updateCampaign({
      ...selectedCampaign,
      powers: [...selectedCampaign.powers, newPower],
    });
    setSelectedPowerId(newPower.id);
    setTab("powers");
  }

  function deletePower(id: string) {
    if (!selectedCampaign) return;
    const power = selectedCampaign.powers.find((value) => value.id === id);
    const displayName = power?.name || "this power";
    if (!window.confirm(`Delete ${displayName}?`)) return;
    updateCampaign({
      ...selectedCampaign,
      powers: selectedCampaign.powers.filter((value) => value.id !== id),
    });
    setSelectedPowerId("");
  }

  function updateItem(updatedItem: ItemDefinition) {
    if (!selectedCampaign) return;
    updateCampaign({
      ...selectedCampaign,
      items: selectedCampaign.items.map((item) =>
        item.id === updatedItem.id ? updatedItem : item
      ),
    });
  }

  function addItem() {
    if (!selectedCampaign) return;
    const newItem = makeBlankItem();
    updateCampaign({
      ...selectedCampaign,
      items: [...selectedCampaign.items, newItem],
    });
    setSelectedItemId(newItem.id);
    setTab("items");
  }

  function deleteItem(id: string) {
    if (!selectedCampaign) return;
    const item = selectedCampaign.items.find((value) => value.id === id);
    const displayName = item?.name || "this item";
    if (!window.confirm(`Delete ${displayName}?`)) return;
    updateCampaign({
      ...selectedCampaign,
      items: selectedCampaign.items.filter((value) => value.id !== id),
    });
    setSelectedItemId("");
  }

  function updateAttack(updatedAttack: AttackTemplateDefinition) {
    if (!selectedCampaign) return;
    updateCampaign({
      ...selectedCampaign,
      attackTemplates: selectedCampaign.attackTemplates.map((attack) =>
        attack.id === updatedAttack.id ? updatedAttack : attack
      ),
    });
  }

  function addAttack() {
    if (!selectedCampaign) return;
    const newAttack = makeBlankAttackTemplate();
    updateCampaign({
      ...selectedCampaign,
      attackTemplates: [...selectedCampaign.attackTemplates, newAttack],
    });
    setSelectedAttackId(newAttack.id);
    setTab("attacks");
  }

  function deleteAttack(id: string) {
    if (!selectedCampaign) return;
    const attack = selectedCampaign.attackTemplates.find((value) => value.id === id);
    const displayName = attack?.name || "this attack";
    if (!window.confirm(`Delete ${displayName}?`)) return;
    updateCampaign({
      ...selectedCampaign,
      attackTemplates: selectedCampaign.attackTemplates.filter((value) => value.id !== id),
    });
    setSelectedAttackId("");
  }

  function toggleClassFieldId(field: "startingAttackTemplateIds" | "defaultPowerIds", id: string) {
    if (!selectedClass) return;
    const current = selectedClass[field] ?? [];
    const next = current.includes(id) ? current.filter((value) => value !== id) : [...current, id];
    updateClass({
      ...selectedClass,
      [field]: next,
    } as ClassDefinition);
  }

  function updateClassRule<T extends ClassSkillChoiceRule | ClassPowerChoiceRule | ClassItemChoiceRule>(
    field: "skillChoiceRules" | "powerChoiceRules" | "itemChoiceRules",
    rule: T | null
  ) {
    if (!selectedClass) return;

    const ids = rule
      ? "skillIds" in rule
        ? rule.skillIds
        : "powerIds" in rule
          ? rule.powerIds
          : rule.itemIds
      : [];
    const shouldRemove = rule ? rule.choose <= 0 && ids.length === 0 : false;
    updateClass({
      ...selectedClass,
      [field]: shouldRemove ? [] : rule ? [rule] : [],
    } as ClassDefinition);
  }

  function setClassRuleIds(
    field: "skillChoiceRules" | "powerChoiceRules" | "itemChoiceRules",
    ids: string[]
  ) {
    if (!selectedClass) return;

    if (field === "skillChoiceRules") {
      const rule = getRuleFor<ClassSkillChoiceRule>(field);
      updateClassRule(field, {
        choose: rule?.choose ?? 0,
        skillIds: ids,
      });
      return;
    }

    if (field === "powerChoiceRules") {
      const rule = getRuleFor<ClassPowerChoiceRule>(field);
      updateClassRule(field, {
        choose: rule?.choose ?? 0,
        powerIds: ids,
      });
      return;
    }

    const rule = getRuleFor<ClassItemChoiceRule>(field);
    updateClassRule(field, {
      choose: rule?.choose ?? 1,
      itemIds: ids,
    });
  }

  function setClassFieldIds(field: "startingAttackTemplateIds" | "defaultPowerIds", ids: string[]) {
    if (!selectedClass) return;
    updateClass({
      ...selectedClass,
      [field]: ids,
    } as ClassDefinition);
  }

  function getClassAttributeBonusAmount(attribute: AttributeKey) {
    if (!selectedClass) return 0;
    return selectedClass.attributeBonuses.find((bonus) => bonus.attribute === attribute)?.amount ?? 0;
  }

  function setClassAttributeBonusAmount(attribute: AttributeKey, amount: number) {
    if (!selectedClass) return;

    const existing = selectedClass.attributeBonuses.filter((bonus) => bonus.attribute !== attribute);
    const nextBonuses: AttributeBonusRule[] =
      amount === 0 ? existing : [...existing, { attribute, amount }];

    updateClass({
      ...selectedClass,
      attributeBonuses: nextBonuses,
    });
  }

  function getClassLevelProgressionRows() {
    if (!selectedClass) return [] as ClassLevelProgressionRow[];
    return sortLevelProgression(selectedClass.levelProgression ?? []);
  }

  function updateClassLevelProgression(rows: ClassLevelProgressionRow[]) {
    if (!selectedClass) return;
    updateClass({
      ...selectedClass,
      levelProgression: sortLevelProgression(rows),
    });
  }

  function addClassLevelProgressionRow() {
    if (!selectedClass) return;
    const rows = getClassLevelProgressionRows();
    const nextLevel = Math.max(0, ...rows.map((row) => row.level)) + 1;
    updateClassLevelProgression([
      ...rows,
      {
        level: nextLevel,
        hitDiceGained: 1,
        hpGainMode: "half",
        newSkillChoices: 0,
        newPowerChoices: 0,
        attributeBonuses: [],
      },
    ]);
  }

  function removeClassLevelProgressionRow(index: number) {
    const rows = getClassLevelProgressionRows();
    updateClassLevelProgression(rows.filter((_, i) => i !== index));
  }

  function updateClassLevelProgressionRow(
    index: number,
    patch: Partial<ClassLevelProgressionRow>
  ) {
    const rows = getClassLevelProgressionRows();
    const row = rows[index];
    if (!row) return;
    const next = rows.map((value, i) => (i === index ? { ...value, ...patch } : value));
    updateClassLevelProgression(next);
  }

  function addClassLevelRowBonus(index: number) {
    const rows = getClassLevelProgressionRows();
    const row = rows[index];
    if (!row) return;
    updateClassLevelProgressionRow(index, {
      attributeBonuses: [...row.attributeBonuses, { attribute: "STR", amount: 1 }],
    });
  }

  function updateClassLevelRowBonus(
    index: number,
    bonusIndex: number,
    patch: Partial<AttributeBonusRule>
  ) {
    const rows = getClassLevelProgressionRows();
    const row = rows[index];
    if (!row) return;
    const nextBonuses = row.attributeBonuses.map((bonus, i) =>
      i === bonusIndex ? { ...bonus, ...patch } : bonus
    );
    updateClassLevelProgressionRow(index, { attributeBonuses: nextBonuses });
  }

  function removeClassLevelRowBonus(index: number, bonusIndex: number) {
    const rows = getClassLevelProgressionRows();
    const row = rows[index];
    if (!row) return;
    const nextBonuses = row.attributeBonuses.filter((_, i) => i !== bonusIndex);
    updateClassLevelProgressionRow(index, { attributeBonuses: nextBonuses });
  }

  function getRuleFor<T extends ClassSkillChoiceRule | ClassPowerChoiceRule | ClassItemChoiceRule>(
    field: "skillChoiceRules" | "powerChoiceRules" | "itemChoiceRules"
  ): T | null {
    if (!selectedClass) return null;
    const rules = selectedClass[field] as T[] | undefined;
    return rules?.[0] ?? null;
  }

  return (
    <section style={{ ...panelStyle, display: "flex", flexDirection: "column", height: "70vh", width: 980, maxWidth: 980, overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexShrink: 0 }}>
        <h2 style={sectionTitleStyle}>Admin Screen</h2>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button onClick={onClose} style={buttonStyle}>
            Close
          </button>
          <button onClick={() => onSave(workingData)} style={primaryButtonStyle}>
            Save Changes
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "nowrap", overflowX: "auto" }}>
        <button onClick={() => setTab("campaigns")} style={{ ...buttonStyle, background: tab === "campaigns" ? "rgba(73, 224, 255, 0.18)" : buttonStyle.background }}>
          Campaigns
        </button>
        <button onClick={() => setTab("classes")} style={{ ...buttonStyle, background: tab === "classes" ? "rgba(73, 224, 255, 0.18)" : buttonStyle.background }}>
          Classes
        </button>
        <button onClick={() => setTab("skills")} style={{ ...buttonStyle, background: tab === "skills" ? "rgba(73, 224, 255, 0.18)" : buttonStyle.background }}>
          Skills
        </button>
        <button onClick={() => setTab("powers")} style={{ ...buttonStyle, background: tab === "powers" ? "rgba(73, 224, 255, 0.18)" : buttonStyle.background }}>
          Powers
        </button>
        <button onClick={() => setTab("items")} style={{ ...buttonStyle, background: tab === "items" ? "rgba(73, 224, 255, 0.18)" : buttonStyle.background }}>
          Items
        </button>
        <button onClick={() => setTab("attacks")} style={{ ...buttonStyle, background: tab === "attacks" ? "rgba(73, 224, 255, 0.18)" : buttonStyle.background }}>
          Attacks
        </button>
      </div>

      {tab === "campaigns" && (
        <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20, flex: 1, minHeight: 0, overflow: "hidden" }}>
          <EntityListEditor
            title="Campaigns"
            helper="A campaign defines a pool of classes, skills, powers, items, and attacks."
            items={workingData.campaigns}
            selectedId={selectedCampaignId}
            onSelect={selectCampaign}
            onAdd={addCampaign}
            onDelete={deleteCampaign}
            subtitle={() => ""}
          />

          <main style={{ height: "100%", minHeight: 0, overflow: "auto" }}>
            {!selectedCampaign ? (
              <div style={cardStyle()}>
                <p style={{ margin: 0, ...mutedTextStyle }}>Select a campaign to edit.</p>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 16 }}>
                <section style={cardStyle()}>
                  <h3 style={{ marginTop: 0, color: "var(--text-primary)" }}>Basic Info</h3>
                  <div style={gridCols(2)}>
                    <label style={labelTextStyle}>
                      Internal ID
                      <input
                        value={selectedCampaign.id}
                        onChange={(e) => updateCampaign({ ...selectedCampaign, id: e.target.value })}
                        style={inputStyle}
                      />
                    </label>

                    <label style={labelTextStyle}>
                      Campaign Name
                      <input
                        value={selectedCampaign.name}
                        onChange={(e) => updateCampaign({ ...selectedCampaign, name: e.target.value })}
                        style={inputStyle}
                      />
                    </label>

                    <label style={labelTextStyle}>
                      Description
                      <input
                        value={selectedCampaign.description ?? ""}
                        onChange={(e) => updateCampaign({ ...selectedCampaign, description: e.target.value })}
                        style={inputStyle}
                      />
                    </label>
                  </div>
                </section>
              </div>
            )}
          </main>
        </div>
      )}

      {tab === "classes" && (
        !selectedCampaign ? (
          <div style={cardStyle()}>
            <p style={{ margin: 0, ...mutedTextStyle }}>Select a campaign first to manage classes.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20, flex: 1, minHeight: 0, overflow: "hidden" }}>
            <EntityListEditor
              title="Classes"
              helper="Classes belong to the selected campaign."
              items={selectedCampaign.classes}
              selectedId={selectedClassId}
              onSelect={setSelectedClassId}
              onAdd={addClass}
              onDelete={deleteClass}
              subtitle={() => ""}
            />
            <main style={{ height: "100%", minHeight: 0, overflow: "auto" }}>
              {!selectedClass ? (
                <div style={cardStyle()}>
                  <p style={{ margin: 0, ...mutedTextStyle }}>Select a class to edit.</p>
                </div>
              ) : (
                <div style={{ display: "grid", gap: 16 }}>
                  <section style={cardStyle()}>
                    <h3 style={{ marginTop: 0, color: "var(--text-primary)" }}>Class Details</h3>
                    <div style={gridCols(2)}>
                      <label style={labelTextStyle}>
                        Internal ID
                        <input
                          value={selectedClass.id}
                          onChange={(e) => updateClass({ ...selectedClass, id: e.target.value })}
                          style={inputStyle}
                        />
                      </label>
                      <label style={labelTextStyle}>
                        Name
                        <input
                          value={selectedClass.name}
                          onChange={(e) => updateClass({ ...selectedClass, name: e.target.value })}
                          style={inputStyle}
                        />
                      </label>
                      <label style={labelTextStyle}>
                        Description
                        <input
                          value={selectedClass.description ?? ""}
                          onChange={(e) => updateClass({ ...selectedClass, description: e.target.value })}
                          style={inputStyle}
                        />
                      </label>
                      <label style={labelTextStyle}>
                        Hit Die
                        <select
                          value={selectedClass.hpRule.hitDie}
                          onChange={(e) =>
                            updateClass({
                              ...selectedClass,
                              hpRule: {
                                ...selectedClass.hpRule,
                                hitDie: Number(e.target.value),
                              },
                            })
                          }
                          style={inputStyle}
                        >
                          {HIT_DIE_OPTIONS.map((die) => (
                            <option key={die} value={die}>
                              d{die}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </section>

                  <section style={cardStyle()}>
                    <h3 style={{ marginTop: 0, color: "var(--text-primary)" }}>Attribute Modifiers</h3>
                    <p style={{ marginTop: 0, ...mutedTextStyle }}>
                      Set class bonuses and penalties (for example: STR +2, INT -2).
                    </p>
                    <div style={gridCols(3)}>
                      {ATTRIBUTE_KEYS.map((attribute) => (
                        <label key={attribute} style={{ ...labelTextStyle, display: "grid", gap: 6 }}>
                          <span>{attribute}</span>
                          <input
                            type="number"
                            value={getClassAttributeBonusAmount(attribute)}
                            onChange={(e) =>
                              setClassAttributeBonusAmount(attribute, Number(e.target.value) || 0)
                            }
                            style={compactNumberInputStyle}
                          />
                        </label>
                      ))}
                    </div>
                  </section>

                  <section style={cardStyle()}>
                    <h3 style={{ marginTop: 0, color: "var(--text-primary)" }}>Class Rules</h3>
                    <div style={{ display: "grid", gap: 16 }}>
                      <div style={gridCols(3)}>
                        <label style={labelTextStyle}>
                          Skill Choice Count
                          <input
                            type="number"
                            min={0}
                            value={getRuleFor<ClassSkillChoiceRule>("skillChoiceRules")?.choose ?? 0}
                            onChange={(e) => {
                              const choose = Number(e.target.value);
                              const rule = getRuleFor<ClassSkillChoiceRule>("skillChoiceRules");
                              updateClassRule("skillChoiceRules", {
                                choose,
                                skillIds: rule?.skillIds ?? [],
                              });
                            }}
                            style={compactChoiceCountInputStyle}
                          />
                        </label>
                        <label style={labelTextStyle}>
                          Power Choice Count
                          <input
                            type="number"
                            min={0}
                            value={getRuleFor<ClassPowerChoiceRule>("powerChoiceRules")?.choose ?? 0}
                            onChange={(e) => {
                              const choose = Number(e.target.value);
                              const rule = getRuleFor<ClassPowerChoiceRule>("powerChoiceRules");
                              updateClassRule("powerChoiceRules", {
                                choose,
                                powerIds: rule?.powerIds ?? [],
                              });
                            }}
                            style={compactChoiceCountInputStyle}
                          />
                        </label>
                        <label style={labelTextStyle}>
                          Item Choice Count
                          <input
                            type="number"
                            min={1}
                            value={getRuleFor<ClassItemChoiceRule>("itemChoiceRules")?.choose ?? ""}
                            onChange={(e) => {
                              const choose = Number(e.target.value);
                              const rule = getRuleFor<ClassItemChoiceRule>("itemChoiceRules");
                              if (choose > 0) {
                                updateClassRule("itemChoiceRules", {
                                  choose,
                                  itemIds: rule?.itemIds ?? [],
                                });
                              } else {
                                updateClassRule("itemChoiceRules", null);
                              }
                            }}
                            style={compactChoiceCountInputStyle}
                          />
                        </label>
                      </div>

                      <div style={{ display: "grid", gap: 12 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                          <div style={{ ...panelStyle, padding: 12 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 12 }}>
                              <h4 style={{ margin: 0 }}>Allowed Skills</h4>
                              <div style={{ display: "flex", gap: 6 }}>
                                <button
                                  type="button"
                                  style={buttonStyle}
                                  onClick={() => setClassRuleIds("skillChoiceRules", selectedCampaign.skills.map((skill) => skill.id))}
                                >
                                  Select All
                                </button>
                                <button
                                  type="button"
                                  style={buttonStyle}
                                  onClick={() => setClassRuleIds("skillChoiceRules", [])}
                                >
                                  Clear
                                </button>
                              </div>
                            </div>
                            {selectedCampaign.skills.length === 0 ? (
                              <p style={{ margin: 0, ...mutedTextStyle }}>No skills are defined for this campaign.</p>
                            ) : (
                              selectedCampaign.skills.map((skill) => {
                                const rule = getRuleFor<ClassSkillChoiceRule>("skillChoiceRules");
                                const checked = rule?.skillIds.includes(skill.id) ?? false;
                                return (
                                  <label key={skill.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => {
                                        const current = rule?.skillIds ?? [];
                                        const next = current.includes(skill.id)
                                          ? current.filter((id) => id !== skill.id)
                                          : [...current, skill.id];
                                        updateClassRule("skillChoiceRules", {
                                          choose: rule?.choose ?? 0,
                                          skillIds: next,
                                        });
                                      }}
                                    />
                                    {skill.name}
                                  </label>
                                );
                              })
                            )}
                          </div>
                          <div style={{ ...panelStyle, padding: 12 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 12 }}>
                              <h4 style={{ margin: 0 }}>Allowed Powers</h4>
                              <div style={{ display: "flex", gap: 6 }}>
                                <button
                                  type="button"
                                  style={buttonStyle}
                                  onClick={() => setClassRuleIds("powerChoiceRules", selectedCampaign.powers.map((power) => power.id))}
                                >
                                  Select All
                                </button>
                                <button
                                  type="button"
                                  style={buttonStyle}
                                  onClick={() => setClassRuleIds("powerChoiceRules", [])}
                                >
                                  Clear
                                </button>
                              </div>
                            </div>
                            {selectedCampaign.powers.length === 0 ? (
                              <p style={{ margin: 0, ...mutedTextStyle }}>No powers are defined for this campaign.</p>
                            ) : (
                              selectedCampaign.powers.map((power) => {
                                const rule = getRuleFor<ClassPowerChoiceRule>("powerChoiceRules");
                                const checked = rule?.powerIds.includes(power.id) ?? false;
                                return (
                                  <label key={power.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => {
                                        const current = rule?.powerIds ?? [];
                                        const next = current.includes(power.id)
                                          ? current.filter((id) => id !== power.id)
                                          : [...current, power.id];
                                        updateClassRule("powerChoiceRules", {
                                          choose: rule?.choose ?? 0,
                                          powerIds: next,
                                        });
                                      }}
                                    />
                                    {power.name}
                                  </label>
                                );
                              })
                            )}
                          </div>
                        </div>

                        <div style={{ display: "grid", gap: 12 }}>
                          <div style={{ ...panelStyle, padding: 12 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 12 }}>
                              <h4 style={{ margin: 0 }}>Allowed Items</h4>
                              <div style={{ display: "flex", gap: 6 }}>
                                <button
                                  type="button"
                                  style={buttonStyle}
                                  onClick={() => setClassRuleIds("itemChoiceRules", selectedCampaign.items.map((item) => item.id))}
                                >
                                  Select All
                                </button>
                                <button
                                  type="button"
                                  style={buttonStyle}
                                  onClick={() => setClassRuleIds("itemChoiceRules", [])}
                                >
                                  Clear
                                </button>
                              </div>
                            </div>
                            {selectedCampaign.items.length === 0 ? (
                              <p style={{ margin: 0, ...mutedTextStyle }}>No items are defined for this campaign.</p>
                            ) : (
                              selectedCampaign.items.map((item) => {
                                const rule = getRuleFor<ClassItemChoiceRule>("itemChoiceRules");
                                const checked = rule?.itemIds.includes(item.id) ?? false;
                                return (
                                  <label key={item.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => {
                                        const current = rule?.itemIds ?? [];
                                        const next = current.includes(item.id)
                                          ? current.filter((id) => id !== item.id)
                                          : [...current, item.id];
                                        updateClassRule("itemChoiceRules", {
                                          choose: rule?.choose ?? 0,
                                          itemIds: next,
                                        });
                                      }}
                                    />
                                    {item.name}
                                  </label>
                                );
                              })
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section style={cardStyle()}>
                    <h3 style={{ marginTop: 0, color: "var(--text-primary)" }}>Anchored Defaults</h3>
                    <div style={{ display: "grid", gap: 16 }}>
                      <div style={{ ...panelStyle, padding: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 12 }}>
                          <h4 style={{ margin: 0 }}>Starting Attacks</h4>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              type="button"
                              style={buttonStyle}
                              onClick={() => setClassFieldIds("startingAttackTemplateIds", selectedCampaign.attackTemplates.map((attack) => attack.id))}
                            >
                              Select All
                            </button>
                            <button
                              type="button"
                              style={buttonStyle}
                              onClick={() => setClassFieldIds("startingAttackTemplateIds", [])}
                            >
                              Clear
                            </button>
                          </div>
                        </div>
                        {selectedCampaign.attackTemplates.length === 0 ? (
                          <p style={{ margin: 0, ...mutedTextStyle }}>No attacks are defined for this campaign.</p>
                        ) : (
                          selectedCampaign.attackTemplates.map((attack) => (
                            <label key={attack.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <input
                                type="checkbox"
                                checked={(selectedClass.startingAttackTemplateIds ?? []).includes(attack.id)}
                                onChange={() => toggleClassFieldId("startingAttackTemplateIds", attack.id)}
                              />
                              {attack.name} ({attack.damage})
                            </label>
                          ))
                        )}
                      </div>

                      <div style={{ ...panelStyle, padding: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 12 }}>
                          <h4 style={{ margin: 0 }}>Default Powers</h4>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              type="button"
                              style={buttonStyle}
                              onClick={() => setClassFieldIds("defaultPowerIds", selectedCampaign.powers.map((power) => power.id))}
                            >
                              Select All
                            </button>
                            <button
                              type="button"
                              style={buttonStyle}
                              onClick={() => setClassFieldIds("defaultPowerIds", [])}
                            >
                              Clear
                            </button>
                          </div>
                        </div>
                        {selectedCampaign.powers.length === 0 ? (
                          <p style={{ margin: 0, ...mutedTextStyle }}>No powers are defined for this campaign.</p>
                        ) : (
                          selectedCampaign.powers.map((power) => (
                            <label key={power.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <input
                                type="checkbox"
                                checked={(selectedClass.defaultPowerIds ?? []).includes(power.id)}
                                onChange={() => toggleClassFieldId("defaultPowerIds", power.id)}
                              />
                              {power.name}
                            </label>
                          ))
                        )}
                      </div>
                    </div>
                  </section>

                  <section style={cardStyle()}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <h3 style={{ marginTop: 0, marginBottom: 0, color: "var(--text-primary)" }}>Level Progression</h3>
                      <button
                        type="button"
                        style={{ ...buttonStyle, padding: "8px 12px", minWidth: 132 }}
                        onClick={addClassLevelProgressionRow}
                      >
                        Add Level Row
                      </button>
                    </div>
                    <p style={{ marginTop: 8, ...mutedTextStyle }}>
                      Define what this class gains per level.
                    </p>

                    {getClassLevelProgressionRows().length === 0 ? (
                      <div style={{ ...panelStyle, padding: 12 }}>
                        <p style={{ margin: 0, ...mutedTextStyle }}>
                          No progression rows yet. Add a level row to define class progression.
                        </p>
                      </div>
                    ) : (
                      <div style={{ display: "grid", gap: 10 }}>
                        {getClassLevelProgressionRows().map((row, index) => (
                          <div key={`${row.level}-${index}`} style={{ ...panelStyle, padding: 10 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8 }}>
                              <strong style={{ color: "var(--text-primary)" }}>Level {row.level}</strong>
                              <button
                                type="button"
                                style={{ ...buttonStyle, padding: "6px 10px" }}
                                onClick={() => removeClassLevelProgressionRow(index)}
                              >
                                Remove
                              </button>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 10, alignItems: "end" }}>
                              <label style={labelTextStyle}>
                                Level
                                <input
                                  type="number"
                                  min={1}
                                  value={row.level}
                                  onChange={(e) =>
                                    updateClassLevelProgressionRow(index, {
                                      level: Math.max(1, Number(e.target.value) || 1),
                                    })
                                  }
                                  style={inputStyle}
                                />
                              </label>
                              <label style={labelTextStyle}>
                                Hit Dice Gained
                                <input
                                  type="number"
                                  min={0}
                                  value={row.hitDiceGained}
                                  onChange={(e) =>
                                    updateClassLevelProgressionRow(index, {
                                      hitDiceGained: Math.max(0, Number(e.target.value) || 0),
                                    })
                                  }
                                  style={inputStyle}
                                />
                              </label>
                              <label style={labelTextStyle}>
                                HP Gain Mode
                                <select
                                  value={row.hpGainMode ?? "half"}
                                  onChange={(e) =>
                                    updateClassLevelProgressionRow(index, {
                                      hpGainMode: e.target.value as LevelProgressionHpGainMode,
                                    })
                                  }
                                  style={inputStyle}
                                >
                                  {HP_GAIN_MODE_OPTIONS.map((mode) => (
                                    <option key={mode.value} value={mode.value}>
                                      {mode.label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label style={labelTextStyle}>
                                New Skill Choices
                                <input
                                  type="number"
                                  min={0}
                                  value={row.newSkillChoices}
                                  onChange={(e) =>
                                    updateClassLevelProgressionRow(index, {
                                      newSkillChoices: Math.max(0, Number(e.target.value) || 0),
                                    })
                                  }
                                  style={inputStyle}
                                />
                              </label>
                              <label style={labelTextStyle}>
                                New Power Choices
                                <input
                                  type="number"
                                  min={0}
                                  value={row.newPowerChoices}
                                  onChange={(e) =>
                                    updateClassLevelProgressionRow(index, {
                                      newPowerChoices: Math.max(0, Number(e.target.value) || 0),
                                    })
                                  }
                                  style={inputStyle}
                                />
                              </label>
                            </div>

                            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 200px 112px", gap: 8, alignItems: "end" }}>
                                <div style={{ color: "var(--text-secondary)", fontSize: 13, gridColumn: "1 / span 2" }}>
                                  Attribute Bonuses: {formatBonusSummary(row.attributeBonuses)}
                                </div>
                                <button
                                  type="button"
                                  style={{ ...buttonStyle, padding: "6px 10px", width: "100%" }}
                                  onClick={() => addClassLevelRowBonus(index)}
                                >
                                  Add Bonus
                                </button>
                              </div>

                              {row.attributeBonuses.length > 0 && (
                                <div style={{ display: "grid", gap: 8 }}>
                                  {row.attributeBonuses.map((bonus, bonusIndex) => (
                                    <div
                                      key={`${row.level}-bonus-${bonusIndex}`}
                                      style={{ display: "grid", gridTemplateColumns: "1fr 200px 112px", gap: 8, alignItems: "end" }}
                                    >
                                      <label style={labelTextStyle}>
                                        Attribute
                                        <select
                                          value={bonus.attribute}
                                          onChange={(e) =>
                                            updateClassLevelRowBonus(index, bonusIndex, {
                                              attribute: e.target.value as AttributeKey,
                                            })
                                          }
                                          style={inputStyle}
                                        >
                                          {ATTRIBUTE_KEYS.map((attribute) => (
                                            <option key={attribute} value={attribute}>
                                              {attribute}
                                            </option>
                                          ))}
                                        </select>
                                      </label>
                                      <label style={labelTextStyle}>
                                        Amount
                                        <input
                                          type="number"
                                          value={bonus.amount}
                                          onChange={(e) =>
                                            updateClassLevelRowBonus(index, bonusIndex, {
                                              amount: Number(e.target.value) || 0,
                                            })
                                          }
                                          style={inputStyle}
                                        />
                                      </label>
                                      <button
                                        type="button"
                                        style={{ ...buttonStyle, padding: "6px 10px", width: "100%" }}
                                        onClick={() => removeClassLevelRowBonus(index, bonusIndex)}
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </div>
              )}
            </main>
          </div>
        )
      )}

      {tab === "skills" && (
        !selectedCampaign ? (
          <div style={cardStyle()}>
            <p style={{ margin: 0, ...mutedTextStyle }}>Select a campaign first to manage skills.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20, flex: 1, minHeight: 0, overflow: "hidden" }}>
            <EntityListEditor
              title="Skills"
              helper="Skills belong to the selected campaign."
              items={selectedCampaign.skills}
              selectedId={selectedSkillId}
              onSelect={setSelectedSkillId}
              onAdd={addSkill}
              onDelete={deleteSkill}
              subtitle={() => ""}
            />
            <main style={{ height: "100%", minHeight: 0, overflow: "auto" }}>
              {!selectedSkill ? (
                <div style={cardStyle()}>
                  <p style={{ margin: 0, ...mutedTextStyle }}>Select a skill to edit.</p>
                </div>
              ) : (
                <div style={{ display: "grid", gap: 16 }}>
                  <section style={cardStyle()}>
                    <h3 style={{ marginTop: 0, color: "var(--text-primary)" }}>Skill Details</h3>
                    <div style={gridCols(2)}>
                      <label style={labelTextStyle}>
                        Internal ID
                        <input
                          value={selectedSkill.id}
                          onChange={(e) => updateSkill({ ...selectedSkill, id: e.target.value })}
                          style={inputStyle}
                        />
                      </label>
                      <label style={labelTextStyle}>
                        Name
                        <input
                          value={selectedSkill.name}
                          onChange={(e) => updateSkill({ ...selectedSkill, name: e.target.value })}
                          style={inputStyle}
                        />
                      </label>
                      <label style={labelTextStyle}>
                        Attribute
                        <select
                          value={selectedSkill.attribute}
                          onChange={(e) => updateSkill({ ...selectedSkill, attribute: e.target.value as AttributeKey })}
                          style={inputStyle}
                        >
                          <option value="STR">STR</option>
                          <option value="DEX">DEX</option>
                          <option value="CON">CON</option>
                          <option value="INT">INT</option>
                          <option value="WIS">WIS</option>
                          <option value="CHA">CHA</option>
                        </select>
                      </label>
                    </div>
                  </section>
                </div>
              )}
            </main>
          </div>
        )
      )}

      {tab === "powers" && (
        !selectedCampaign ? (
          <div style={cardStyle()}>
            <p style={{ margin: 0, ...mutedTextStyle }}>Select a campaign first to manage powers.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20, flex: 1, minHeight: 0, overflow: "hidden" }}>
            <EntityListEditor
              title="Powers"
              helper="Powers belong to the selected campaign."
              items={selectedCampaign.powers}
              selectedId={selectedPowerId}
              onSelect={setSelectedPowerId}
              onAdd={addPower}
              onDelete={deletePower}
              subtitle={() => ""}
            />
            <main style={{ height: "100%", minHeight: 0, overflow: "auto" }}>
              {!selectedPower ? (
                <div style={cardStyle()}>
                  <p style={{ margin: 0, ...mutedTextStyle }}>Select a power to edit.</p>
                </div>
              ) : (
                <div style={{ display: "grid", gap: 16 }}>
                  <section style={cardStyle()}>
                    <h3 style={{ marginTop: 0, color: "var(--text-primary)" }}>Power Details</h3>
                    <div style={gridCols(2)}>
                      <label style={labelTextStyle}>
                        Internal ID
                        <input
                          value={selectedPower.id}
                          onChange={(e) => updatePower({ ...selectedPower, id: e.target.value })}
                          style={inputStyle}
                        />
                      </label>
                      <label style={labelTextStyle}>
                        Name
                        <input
                          value={selectedPower.name}
                          onChange={(e) => updatePower({ ...selectedPower, name: e.target.value })}
                          style={inputStyle}
                        />
                      </label>
                      <label style={labelTextStyle}>
                        Category
                        <input
                          value={selectedPower.category ?? ""}
                          onChange={(e) => updatePower({ ...selectedPower, category: e.target.value })}
                          style={inputStyle}
                        />
                      </label>
                    </div>
                  </section>
                </div>
              )}
            </main>
          </div>
        )
      )}

      {tab === "items" && (
        !selectedCampaign ? (
          <div style={cardStyle()}>
            <p style={{ margin: 0, ...mutedTextStyle }}>Select a campaign first to manage items.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20, flex: 1, minHeight: 0, overflow: "hidden" }}>
            <EntityListEditor
              title="Items"
              helper="Items belong to the selected campaign."
              items={selectedCampaign.items}
              selectedId={selectedItemId}
              onSelect={setSelectedItemId}
              onAdd={addItem}
              onDelete={deleteItem}
              subtitle={() => ""}
            />
            <main style={{ height: "100%", minHeight: 0, overflow: "auto" }}>
              {!selectedItem ? (
                <div style={cardStyle()}>
                  <p style={{ margin: 0, ...mutedTextStyle }}>Select an item to edit.</p>
                </div>
              ) : (
                <div style={{ display: "grid", gap: 16 }}>
                  <section style={cardStyle()}>
                    <h3 style={{ marginTop: 0, color: "var(--text-primary)" }}>Item Details</h3>
                    <div style={gridCols(2)}>
                      <label style={labelTextStyle}>
                        Internal ID
                        <input
                          value={selectedItem.id}
                          onChange={(e) => updateItem({ ...selectedItem, id: e.target.value })}
                          style={inputStyle}
                        />
                      </label>
                      <label style={labelTextStyle}>
                        Name
                        <input
                          value={selectedItem.name}
                          onChange={(e) => updateItem({ ...selectedItem, name: e.target.value })}
                          style={inputStyle}
                        />
                      </label>
                      <label style={labelTextStyle}>
                        Category
                        <input
                          value={selectedItem.category ?? ""}
                          onChange={(e) => updateItem({ ...selectedItem, category: e.target.value })}
                          style={inputStyle}
                        />
                      </label>
                    </div>
                  </section>
                </div>
              )}
            </main>
          </div>
        )
      )}

      {tab === "attacks" && (
        !selectedCampaign ? (
          <div style={cardStyle()}>
            <p style={{ margin: 0, ...mutedTextStyle }}>Select a campaign first to manage attacks.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20, flex: 1, minHeight: 0, overflow: "hidden" }}>
            <EntityListEditor
              title="Attacks"
              helper="Attacks belong to the selected campaign."
              items={selectedCampaign.attackTemplates}
              selectedId={selectedAttackId}
              onSelect={setSelectedAttackId}
              onAdd={addAttack}
              onDelete={deleteAttack}
              subtitle={(attack) => attack.damage}
            />
            <main style={{ height: "100%", minHeight: 0, overflow: "auto" }}>
              {!selectedAttack ? (
                <div style={cardStyle()}>
                  <p style={{ margin: 0, ...mutedTextStyle }}>Select an attack to edit.</p>
                </div>
              ) : (
                <div style={{ display: "grid", gap: 16 }}>
                  <section style={cardStyle()}>
                    <h3 style={{ marginTop: 0, color: "var(--text-primary)" }}>Attack Details</h3>
                    <div style={gridCols(2)}>
                      <label style={labelTextStyle}>
                        Internal ID
                        <input
                          value={selectedAttack.id}
                          onChange={(e) => updateAttack({ ...selectedAttack, id: e.target.value })}
                          style={inputStyle}
                        />
                      </label>
                      <label style={labelTextStyle}>
                        Name
                        <input
                          value={selectedAttack.name}
                          onChange={(e) => updateAttack({ ...selectedAttack, name: e.target.value })}
                          style={inputStyle}
                        />
                      </label>
                      <label style={labelTextStyle}>
                        Attribute
                        <select
                          value={selectedAttack.attribute}
                          onChange={(e) => updateAttack({ ...selectedAttack, attribute: e.target.value as AttributeKey })}
                          style={inputStyle}
                        >
                          <option value="STR">STR</option>
                          <option value="DEX">DEX</option>
                          <option value="CON">CON</option>
                          <option value="INT">INT</option>
                          <option value="WIS">WIS</option>
                          <option value="CHA">CHA</option>
                        </select>
                      </label>
                      <label style={labelTextStyle}>
                        Damage Dice
                        <select
                          value={selectedAttack.damage.split('d')[0] || "1"}
                          onChange={(e) => {
                            const diceCount = e.target.value;
                            const dieType = selectedAttack.damage.split('d')[1]?.split(' ')[0] || "6";
                            const bonus = selectedAttack.bonus || 0;
                            const damage = bonus > 0 ? `${diceCount}d${dieType} + ${bonus}` : `${diceCount}d${dieType}`;
                            updateAttack({ ...selectedAttack, damage });
                          }}
                          style={inputStyle}
                        >
                          <option value="1">1</option>
                          <option value="2">2</option>
                          <option value="3">3</option>
                          <option value="4">4</option>
                          <option value="5">5</option>
                          <option value="6">6</option>
                          <option value="7">7</option>
                          <option value="8">8</option>
                          <option value="9">9</option>
                          <option value="10">10</option>
                        </select>
                      </label>
                      <label style={labelTextStyle}>
                        Die Type
                        <select
                          value={selectedAttack.damage.split('d')[1]?.split(' ')[0] || "6"}
                          onChange={(e) => {
                            const diceCount = selectedAttack.damage.split('d')[0] || "1";
                            const dieType = e.target.value;
                            const bonus = selectedAttack.bonus || 0;
                            const damage = bonus > 0 ? `${diceCount}d${dieType} + ${bonus}` : `${diceCount}d${dieType}`;
                            updateAttack({ ...selectedAttack, damage });
                          }}
                          style={inputStyle}
                        >
                          <option value="4">d4</option>
                          <option value="6">d6</option>
                          <option value="8">d8</option>
                          <option value="10">d10</option>
                          <option value="12">d12</option>
                          <option value="20">d20</option>
                        </select>
                      </label>
                      <label style={labelTextStyle}>
                        Damage Bonus
                        <input
                          type="number"
                          value={selectedAttack.bonus || 0}
                          onChange={(e) => {
                            const bonus = Number(e.target.value);
                            const diceCount = selectedAttack.damage.split('d')[0] || "1";
                            const dieType = selectedAttack.damage.split('d')[1]?.split(' ')[0] || "6";
                            const damage = bonus > 0 ? `${diceCount}d${dieType} + ${bonus}` : `${diceCount}d${dieType}`;
                            updateAttack({ ...selectedAttack, damage, bonus: bonus || undefined });
                          }}
                          style={inputStyle}
                        />
                      </label>
                    </div>
                  </section>
                </div>
              )}
            </main>
          </div>
        )
      )}
    </section>
  );
}
