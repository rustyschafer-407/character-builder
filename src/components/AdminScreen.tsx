import { useMemo, useState } from "react";
import type {
  AttackTemplateDefinition,
  AttributeBonusRule,
  AttributeKey,
  ClassDefinition,
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

function isAttributeKey(value: string): value is AttributeKey {
  return (
    value === "STR" ||
    value === "DEX" ||
    value === "CON" ||
    value === "INT" ||
    value === "WIS" ||
    value === "CHA"
  );
}

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
    startingAttackTemplateIds: [],
    defaultPowerIds: [],
    defaultItemIds: [],
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

function parseCommaList(value: string) {
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function pillButton(isActive: boolean) {
  return {
    ...buttonStyle,
    background: isActive ? "#dbeafe" : buttonStyle.background,
    border: isActive ? "1px solid #93c5fd" : buttonStyle.border,
  };
}

function helperText(text: string) {
  return (
    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
      {text}
    </div>
  );
}

function cardStyle() {
  return {
    ...panelStyle,
    padding: 16,
  };
}

function rowWrap() {
  return {
    display: "flex",
    gap: 8,
    alignItems: "center",
    flexWrap: "wrap" as const,
  };
}

function grid2() {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  };
}

function grid3() {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 12,
  };
}

function ToggleIdListEditor({
  title,
  helper,
  options,
  selectedIds,
  onChange,
}: {
  title: string;
  helper?: string;
  options: Array<{ id: string; name: string }>;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  function toggle(id: string) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((value) => value !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  }

  return (
    <section style={cardStyle()}>
      <h3 style={{ marginTop: 0, marginBottom: 8, color: "#111827" }}>{title}</h3>
      {helper ? helperText(helper) : null}
      <div style={{ ...rowWrap(), marginTop: 12 }}>
        {options.length === 0 ? (
          <p style={{ margin: 0, ...mutedTextStyle }}>No options available yet.</p>
        ) : (
          options.map((option) => {
            const selected = selectedIds.includes(option.id);
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => toggle(option.id)}
                style={{
                  ...buttonStyle,
                  background: selected ? "#dbeafe" : "#ffffff",
                  border: selected ? "1px solid #60a5fa" : "1px solid #d1d5db",
                  color: "#111827",
                }}
              >
                {selected ? "✓ " : ""}
                {option.name}
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}

function ChoiceRulesEditor({
  title,
  helper,
  optionLabel,
  options,
  rules,
  onChange,
}: {
  title: string;
  helper?: string;
  optionLabel: string;
  options: Array<{ id: string; name: string }>;
  rules: Array<{ choose: number; ids: string[] }>;
  onChange: (rules: Array<{ choose: number; ids: string[] }>) => void;
}) {
  function addRule() {
    onChange([...rules, { choose: 1, ids: [] }]);
  }

  function updateRule(index: number, nextRule: { choose: number; ids: string[] }) {
    onChange(rules.map((rule, i) => (i === index ? nextRule : rule)));
  }

  function removeRule(index: number) {
    onChange(rules.filter((_, i) => i !== index));
  }

  function toggleId(index: number, id: string) {
    const rule = rules[index];
    const ids = rule.ids.includes(id)
      ? rule.ids.filter((value) => value !== id)
      : [...rule.ids, id];
    updateRule(index, { ...rule, ids });
  }

  return (
    <section style={cardStyle()}>
      <div style={{ ...rowWrap(), justifyContent: "space-between" }}>
        <div>
          <h3 style={{ margin: 0, color: "#111827" }}>{title}</h3>
          {helper ? helperText(helper) : null}
        </div>
        <button type="button" onClick={addRule} style={buttonStyle}>
          Add Choice Group
        </button>
      </div>

      <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
        {rules.length === 0 ? (
          <p style={{ margin: 0, ...mutedTextStyle }}>No choice groups yet.</p>
        ) : (
          rules.map((rule, index) => (
            <div
              key={index}
              style={{
                border: "1px solid #d1d5db",
                borderRadius: 10,
                padding: 12,
                background: "#f9fafb",
              }}
            >
              <div style={{ ...rowWrap(), justifyContent: "space-between", marginBottom: 10 }}>
                <strong style={{ color: "#111827" }}>Choice Group {index + 1}</strong>
                <button type="button" onClick={() => removeRule(index)} style={buttonStyle}>
                  Remove
                </button>
              </div>

              <label style={{ ...labelTextStyle, maxWidth: 220 }}>
                Player chooses
                <input
                  type="number"
                  min={1}
                  value={rule.choose}
                  onChange={(e) =>
                    updateRule(index, {
                      ...rule,
                      choose: Math.max(1, Number(e.target.value) || 1),
                    })
                  }
                  style={inputStyle}
                />
              </label>

              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
                  Available {optionLabel}
                </div>

                <div style={rowWrap()}>
                  {options.length === 0 ? (
                    <p style={{ margin: 0, ...mutedTextStyle }}>No options available.</p>
                  ) : (
                    options.map((option) => {
                      const selected = rule.ids.includes(option.id);
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => toggleId(index, option.id)}
                          style={{
                            ...buttonStyle,
                            background: selected ? "#dbeafe" : "#ffffff",
                            border: selected ? "1px solid #60a5fa" : "1px solid #d1d5db",
                            color: "#111827",
                          }}
                        >
                          {selected ? "✓ " : ""}
                          {option.name}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function AttributeBonusesEditor({
  bonuses,
  onChange,
}: {
  bonuses: AttributeBonusRule[];
  onChange: (bonuses: AttributeBonusRule[]) => void;
}) {
  function addBonus() {
    onChange([...bonuses, { attribute: "STR", amount: 1 }]);
  }

  function updateBonus(index: number, nextBonus: AttributeBonusRule) {
    onChange(bonuses.map((bonus, i) => (i === index ? nextBonus : bonus)));
  }

  function removeBonus(index: number) {
    onChange(bonuses.filter((_, i) => i !== index));
  }

  return (
    <section style={cardStyle()}>
      <div style={{ ...rowWrap(), justifyContent: "space-between" }}>
        <div>
          <h3 style={{ margin: 0, color: "#111827" }}>Attribute Bonuses</h3>
          {helperText("Set the bonuses this class grants when a character is created.")}
        </div>
        <button type="button" onClick={addBonus} style={buttonStyle}>
          Add Bonus
        </button>
      </div>

      <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
        {bonuses.length === 0 ? (
          <p style={{ margin: 0, ...mutedTextStyle }}>No bonuses yet.</p>
        ) : (
          bonuses.map((bonus, index) => (
            <div
              key={index}
              style={{
                ...grid3(),
                alignItems: "end",
                border: "1px solid #d1d5db",
                borderRadius: 10,
                padding: 12,
                background: "#f9fafb",
              }}
            >
              <label style={labelTextStyle}>
                Attribute
                <select
                  value={bonus.attribute}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (!isAttributeKey(value)) return;
                    updateBonus(index, { ...bonus, attribute: value });
                  }}
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
                Bonus
                <input
                  type="number"
                  value={bonus.amount}
                  onChange={(e) =>
                    updateBonus(index, { ...bonus, amount: Number(e.target.value) || 0 })
                  }
                  style={inputStyle}
                />
              </label>

              <div>
                <button type="button" onClick={() => removeBonus(index)} style={buttonStyle}>
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
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
    <aside style={{ ...panelStyle, padding: 12 }}>
      <div style={{ ...rowWrap(), justifyContent: "space-between", marginBottom: 12 }}>
        <h3 style={{ margin: 0, color: "#111827" }}>{props.title}</h3>
        <button onClick={props.onAdd} style={buttonStyle}>
          Add
        </button>
      </div>

      {props.helper ? <div style={{ marginBottom: 10 }}>{helperText(props.helper)}</div> : null}

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
                    border: isSelected ? "1px solid #2563eb" : "1px solid #cbd5e1",
                    background: isSelected ? "#dbeafe" : "#ffffff",
                    color: "#111827",
                    cursor: "pointer",
                  }}
                >
                  <strong>{item.name}</strong>
                  <div style={{ fontSize: 12, color: "#4b5563", marginTop: 2 }}>
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
  const [selectedClassId, setSelectedClassId] = useState<string>(gameData.classes[0]?.id ?? "");
  const [selectedSkillId, setSelectedSkillId] = useState<string>(gameData.skills[0]?.id ?? "");
  const [selectedPowerId, setSelectedPowerId] = useState<string>(gameData.powers[0]?.id ?? "");
  const [selectedItemId, setSelectedItemId] = useState<string>(gameData.items[0]?.id ?? "");
  const [selectedAttackId, setSelectedAttackId] = useState<string>(
    gameData.attackTemplates[0]?.id ?? ""
  );

  const selectedCampaign = useMemo(
    () => workingData.campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? null,
    [workingData.campaigns, selectedCampaignId]
  );

  const visibleClasses = useMemo(
    () => workingData.classes.filter((cls) => cls.campaignId === selectedCampaignId),
    [workingData.classes, selectedCampaignId]
  );

  const selectedClass = useMemo(() => {
    const found = visibleClasses.find((cls) => cls.id === selectedClassId);
    return found ?? visibleClasses[0] ?? null;
  }, [visibleClasses, selectedClassId]);

  const selectedSkill = useMemo(
    () => workingData.skills.find((skill) => skill.id === selectedSkillId) ?? null,
    [workingData.skills, selectedSkillId]
  );

  const selectedPower = useMemo(
    () => workingData.powers.find((power) => power.id === selectedPowerId) ?? null,
    [workingData.powers, selectedPowerId]
  );

  const selectedItem = useMemo(
    () => workingData.items.find((item) => item.id === selectedItemId) ?? null,
    [workingData.items, selectedItemId]
  );

  const selectedAttack = useMemo(
    () => workingData.attackTemplates.find((attack) => attack.id === selectedAttackId) ?? null,
    [workingData.attackTemplates, selectedAttackId]
  );

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
    const campaign = workingData.campaigns.find((g) => g.id === id);
    const displayName = campaign?.name || "this campaign";
    if (!window.confirm(`Delete ${displayName}?`)) return;

    const remainingCampaigns = workingData.campaigns.filter((g) => g.id !== id);
    const remainingClasses = workingData.classes.filter((cls) => cls.campaignId !== id);

    setWorkingData((prev) => ({
      ...prev,
      campaigns: remainingCampaigns,
      classes: remainingClasses,
    }));

    setSelectedCampaignId(remainingCampaigns[0]?.id ?? "");
    setSelectedClassId(remainingClasses.find((cls) => cls.campaignId === remainingCampaigns[0]?.id)?.id ?? "");
  }

  function updateClass(updatedClass: ClassDefinition) {
    setWorkingData((prev) => ({
      ...prev,
      classes: prev.classes.map((cls) =>
        cls.id === updatedClass.id ? updatedClass : cls
      ),
    }));
  }

  function addClass() {
    const campaignIdForNewClass = selectedCampaignId || workingData.campaigns[0]?.id || "";
    if (!campaignIdForNewClass) {
      alert("Create or select a campaign first.");
      return;
    }

    const newClass = makeBlankClass(campaignIdForNewClass);

    setWorkingData((prev) => ({
      ...prev,
      classes: [...prev.classes, newClass],
    }));
    setSelectedClassId(newClass.id);
    setTab("classes");
  }

  function deleteClass(id: string) {
    const cls = workingData.classes.find((c) => c.id === id);
    const displayName = cls?.name || "this class";
    if (!window.confirm(`Delete ${displayName}?`)) return;

    const remaining = workingData.classes.filter((c) => c.id !== id);
    const nextVisible = remaining.filter((c) => c.campaignId === selectedCampaignId);

    setWorkingData((prev) => ({
      ...prev,
      classes: remaining,
      campaigns: prev.campaigns.map((campaign) => ({
        ...campaign,
        availableClassIds: campaign.availableClassIds.filter((classId) => classId !== id),
      })),
    }));
    setSelectedClassId(nextVisible[0]?.id ?? "");
  }

  function updateSkill(updatedSkill: SkillDefinition) {
    setWorkingData((prev) => ({
      ...prev,
      skills: prev.skills.map((skill) =>
        skill.id === updatedSkill.id ? updatedSkill : skill
      ),
    }));
  }

  function addSkill() {
    const newSkill = makeBlankSkill();
    setWorkingData((prev) => ({
      ...prev,
      skills: [...prev.skills, newSkill],
    }));
    setSelectedSkillId(newSkill.id);
    setTab("skills");
  }

  function deleteSkill(id: string) {
    const skill = workingData.skills.find((s) => s.id === id);
    const displayName = skill?.name || "this skill";
    if (!window.confirm(`Delete ${displayName}?`)) return;

    const remainingSkills = workingData.skills.filter((s) => s.id !== id);

    setWorkingData((prev) => ({
      ...prev,
      skills: remainingSkills,
      campaigns: prev.campaigns.map((campaign) => ({
        ...campaign,
        availableSkillIds: campaign.availableSkillIds.filter((skillId) => skillId !== id),
      })),
      classes: prev.classes.map((cls) => ({
        ...cls,
        skillChoiceRules: (cls.skillChoiceRules ?? []).map((rule) => ({
          ...rule,
          skillIds: rule.skillIds.filter((skillId) => skillId !== id),
        })),
        levelUpSkillChoiceRules: (cls.levelUpSkillChoiceRules ?? []).map((rule) => ({
          ...rule,
          skillIds: rule.skillIds.filter((skillId) => skillId !== id),
        })),
      })),
    }));

    setSelectedSkillId(remainingSkills[0]?.id ?? "");
  }

  function updatePower(updatedPower: PowerDefinition) {
    setWorkingData((prev) => ({
      ...prev,
      powers: prev.powers.map((power) =>
        power.id === updatedPower.id ? updatedPower : power
      ),
    }));
  }

  function addPower() {
    const newPower = makeBlankPower();
    setWorkingData((prev) => ({
      ...prev,
      powers: [...prev.powers, newPower],
    }));
    setSelectedPowerId(newPower.id);
    setTab("powers");
  }

  function deletePower(id: string) {
    const power = workingData.powers.find((p) => p.id === id);
    const displayName = power?.name || "this power";
    if (!window.confirm(`Delete ${displayName}?`)) return;

    const remainingPowers = workingData.powers.filter((p) => p.id !== id);

    setWorkingData((prev) => ({
      ...prev,
      powers: remainingPowers,
      campaigns: prev.campaigns.map((campaign) => ({
        ...campaign,
        availablePowerIds: campaign.availablePowerIds.filter((powerId) => powerId !== id),
      })),
      classes: prev.classes.map((cls) => ({
        ...cls,
        defaultPowerIds: (cls.defaultPowerIds ?? []).filter((powerId) => powerId !== id),
        powerChoiceRules: (cls.powerChoiceRules ?? []).map((rule) => ({
          ...rule,
          powerIds: rule.powerIds.filter((powerId) => powerId !== id),
        })),
        levelUpPowerChoiceRules: (cls.levelUpPowerChoiceRules ?? []).map((rule) => ({
          ...rule,
          powerIds: rule.powerIds.filter((powerId) => powerId !== id),
        })),
      })),
    }));

    setSelectedPowerId(remainingPowers[0]?.id ?? "");
  }

  function updateItem(updatedItem: ItemDefinition) {
    setWorkingData((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.id === updatedItem.id ? updatedItem : item
      ),
    }));
  }

  function addItem() {
    const newItem = makeBlankItem();
    setWorkingData((prev) => ({
      ...prev,
      items: [...prev.items, newItem],
    }));
    setSelectedItemId(newItem.id);
    setTab("items");
  }

  function deleteItem(id: string) {
    const item = workingData.items.find((i) => i.id === id);
    const displayName = item?.name || "this item";
    if (!window.confirm(`Delete ${displayName}?`)) return;

    const remainingItems = workingData.items.filter((i) => i.id !== id);

    setWorkingData((prev) => ({
      ...prev,
      items: remainingItems,
      campaigns: prev.campaigns.map((campaign) => ({
        ...campaign,
        availableItemIds: campaign.availableItemIds.filter((itemId) => itemId !== id),
      })),
      classes: prev.classes.map((cls) => ({
        ...cls,
        defaultItemIds: (cls.defaultItemIds ?? []).filter((itemId) => itemId !== id),
        itemChoiceRules: (cls.itemChoiceRules ?? []).map((rule) => ({
          ...rule,
          itemIds: rule.itemIds.filter((itemId) => itemId !== id),
        })),
        levelUpItemChoiceRules: (cls.levelUpItemChoiceRules ?? []).map((rule) => ({
          ...rule,
          itemIds: rule.itemIds.filter((itemId) => itemId !== id),
        })),
      })),
    }));

    setSelectedItemId(remainingItems[0]?.id ?? "");
  }

  function updateAttack(updatedAttack: AttackTemplateDefinition) {
    setWorkingData((prev) => ({
      ...prev,
      attackTemplates: prev.attackTemplates.map((attack) =>
        attack.id === updatedAttack.id ? updatedAttack : attack
      ),
    }));
  }

  function addAttack() {
    const newAttack = makeBlankAttackTemplate();
    setWorkingData((prev) => ({
      ...prev,
      attackTemplates: [...prev.attackTemplates, newAttack],
    }));
    setSelectedAttackId(newAttack.id);
    setTab("attacks");
  }

  function deleteAttack(id: string) {
    const attack = workingData.attackTemplates.find((a) => a.id === id);
    const displayName = attack?.name || "this attack";
    if (!window.confirm(`Delete ${displayName}?`)) return;

    const remainingAttacks = workingData.attackTemplates.filter((a) => a.id !== id);

    setWorkingData((prev) => ({
      ...prev,
      attackTemplates: remainingAttacks,
      campaigns: prev.campaigns.map((campaign) => ({
        ...campaign,
        availableAttackTemplateIds: campaign.availableAttackTemplateIds.filter(
          (attackId) => attackId !== id
        ),
      })),
      classes: prev.classes.map((cls) => ({
        ...cls,
        startingAttackTemplateIds: (cls.startingAttackTemplateIds ?? []).filter(
          (attackId) => attackId !== id
        ),
      })),
    }));

    setSelectedAttackId(remainingAttacks[0]?.id ?? "");
  }

  const classSkillOptions = selectedCampaign
    ? workingData.skills
        .filter((skill) => selectedCampaign.availableSkillIds.includes(skill.id))
        .map((skill) => ({ id: skill.id, name: skill.name }))
    : [];

  const classPowerOptions = selectedCampaign
    ? workingData.powers
        .filter((power) => selectedCampaign.availablePowerIds.includes(power.id))
        .map((power) => ({ id: power.id, name: power.name }))
    : [];

  const classItemOptions = selectedCampaign
    ? workingData.items
        .filter((item) => selectedCampaign.availableItemIds.includes(item.id))
        .map((item) => ({ id: item.id, name: item.name }))
    : [];

  const classAttackOptions = selectedCampaign
    ? workingData.attackTemplates
        .filter((attack) => selectedCampaign.availableAttackTemplateIds.includes(attack.id))
        .map((attack) => ({ id: attack.id, name: attack.name }))
    : [];

  return (
    <section style={panelStyle}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <h2 style={sectionTitleStyle}>Admin Screen</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={buttonStyle}>
            Close
          </button>
          <button onClick={() => onSave(workingData)} style={primaryButtonStyle}>
            Save Game Data
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <button onClick={() => setTab("campaigns")} style={pillButton(tab === "campaigns")}>
          Campaigns
        </button>
        <button onClick={() => setTab("classes")} style={pillButton(tab === "classes")}>
          Classes
        </button>
        <button onClick={() => setTab("skills")} style={pillButton(tab === "skills")}>
          Skills
        </button>
        <button onClick={() => setTab("powers")} style={pillButton(tab === "powers")}>
          Powers
        </button>
        <button onClick={() => setTab("items")} style={pillButton(tab === "items")}>
          Items
        </button>
        <button onClick={() => setTab("attacks")} style={pillButton(tab === "attacks")}>
          Attack Templates
        </button>
      </div>

      {tab === "campaigns" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "300px 1fr",
            gap: 20,
            alignItems: "start",
          }}
        >
          <EntityListEditor
            title="Campaigns"
            helper="A campaign defines the pool of classes, skills, powers, items, and attacks available."
            items={workingData.campaigns}
            selectedId={selectedCampaignId}
            onSelect={setSelectedCampaignId}
            onAdd={addCampaign}
            onDelete={deleteCampaign}
            subtitle={(campaign) => campaign.id}
          />

          <main>
            {!selectedCampaign ? (
              <div style={cardStyle()}>
                <p style={{ margin: 0, ...mutedTextStyle }}>Select a campaign to edit.</p>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 16 }}>
                <section style={cardStyle()}>
                  <h3 style={{ marginTop: 0, color: "#111827" }}>Basic Info</h3>
                  <div style={grid2()}>
                    <label style={labelTextStyle}>
                      Internal ID
                      <input
                        value={selectedCampaign.id}
                        onChange={(e) => updateCampaign({ ...selectedCampaign, id: e.target.value })}
                        style={inputStyle}
                      />
                    </label>
                    <label style={labelTextStyle}>
                      Display Name
                      <input
                        value={selectedCampaign.name}
                        onChange={(e) => updateCampaign({ ...selectedCampaign, name: e.target.value })}
                        style={inputStyle}
                      />
                    </label>
                  </div>

                  <label style={{ ...labelTextStyle, marginTop: 12 }}>
                    Description
                    <input
                      value={selectedCampaign.description ?? ""}
                      onChange={(e) =>
                        updateCampaign({ ...selectedCampaign, description: e.target.value })
                      }
                      style={inputStyle}
                    />
                  </label>
                </section>

                <section style={cardStyle()}>
                  <h3 style={{ marginTop: 0, color: "#111827" }}>Campaign Labels</h3>
                  {helperText("These labels control the words shown to players throughout the builder.")}
                  <div style={{ ...grid2(), marginTop: 12 }}>
                    <label style={labelTextStyle}>
                      Attributes Label
                      <input
                        value={selectedCampaign.labels.attributes}
                        onChange={(e) =>
                          updateCampaign({
                            ...selectedCampaign,
                            labels: { ...selectedCampaign.labels, attributes: e.target.value },
                          })
                        }
                        style={inputStyle}
                      />
                    </label>
                    <label style={labelTextStyle}>
                      Skills Label
                      <input
                        value={selectedCampaign.labels.skills}
                        onChange={(e) =>
                          updateCampaign({
                            ...selectedCampaign,
                            labels: { ...selectedCampaign.labels, skills: e.target.value },
                          })
                        }
                        style={inputStyle}
                      />
                    </label>
                    <label style={labelTextStyle}>
                      Attacks Label
                      <input
                        value={selectedCampaign.labels.attacks}
                        onChange={(e) =>
                          updateCampaign({
                            ...selectedCampaign,
                            labels: { ...selectedCampaign.labels, attacks: e.target.value },
                          })
                        }
                        style={inputStyle}
                      />
                    </label>
                    <label style={labelTextStyle}>
                      Powers Label
                      <input
                        value={selectedCampaign.labels.powers}
                        onChange={(e) =>
                          updateCampaign({
                            ...selectedCampaign,
                            labels: { ...selectedCampaign.labels, powers: e.target.value },
                          })
                        }
                        style={inputStyle}
                      />
                    </label>
                    <label style={labelTextStyle}>
                      Inventory Label
                      <input
                        value={selectedCampaign.labels.inventory}
                        onChange={(e) =>
                          updateCampaign({
                            ...selectedCampaign,
                            labels: { ...selectedCampaign.labels, inventory: e.target.value },
                          })
                        }
                        style={inputStyle}
                      />
                    </label>
                    <label style={labelTextStyle}>
                      Class Label
                      <input
                        value={selectedCampaign.labels.className}
                        onChange={(e) =>
                          updateCampaign({
                            ...selectedCampaign,
                            labels: { ...selectedCampaign.labels, className: e.target.value },
                          })
                        }
                        style={inputStyle}
                      />
                    </label>
                    <label style={labelTextStyle}>
                      Level Label
                      <input
                        value={selectedCampaign.labels.level}
                        onChange={(e) =>
                          updateCampaign({
                            ...selectedCampaign,
                            labels: { ...selectedCampaign.labels, level: e.target.value },
                          })
                        }
                        style={inputStyle}
                      />
                    </label>
                    <label style={labelTextStyle}>
                      HP Label
                      <input
                        value={selectedCampaign.labels.hp}
                        onChange={(e) =>
                          updateCampaign({
                            ...selectedCampaign,
                            labels: { ...selectedCampaign.labels, hp: e.target.value },
                          })
                        }
                        style={inputStyle}
                      />
                    </label>
                  </div>
                </section>

                <ToggleIdListEditor
                  title="Available Classes"
                  helper="These classes can be chosen when this campaign is selected."
                  options={workingData.classes
                    .filter((cls) => cls.campaignId === selectedCampaign.id)
                    .map((cls) => ({ id: cls.id, name: cls.name }))}
                  selectedIds={selectedCampaign.availableClassIds}
                  onChange={(ids) =>
                    updateCampaign({ ...selectedCampaign, availableClassIds: ids })
                  }
                />

                <ToggleIdListEditor
                  title="Available Skills"
                  helper="These skills appear for this campaign and can be used by classes in it."
                  options={workingData.skills.map((skill) => ({ id: skill.id, name: skill.name }))}
                  selectedIds={selectedCampaign.availableSkillIds}
                  onChange={(ids) =>
                    updateCampaign({ ...selectedCampaign, availableSkillIds: ids })
                  }
                />

                <ToggleIdListEditor
                  title="Available Powers"
                  helper="These powers can be granted or chosen by classes in this campaign."
                  options={workingData.powers.map((power) => ({ id: power.id, name: power.name }))}
                  selectedIds={selectedCampaign.availablePowerIds}
                  onChange={(ids) =>
                    updateCampaign({ ...selectedCampaign, availablePowerIds: ids })
                  }
                />

                <ToggleIdListEditor
                  title="Available Items"
                  helper="These items can be granted or chosen by classes in this campaign."
                  options={workingData.items.map((item) => ({ id: item.id, name: item.name }))}
                  selectedIds={selectedCampaign.availableItemIds}
                  onChange={(ids) =>
                    updateCampaign({ ...selectedCampaign, availableItemIds: ids })
                  }
                />

                <ToggleIdListEditor
                  title="Available Attack Templates"
                  helper="These starting attacks can be assigned to classes in this campaign."
                  options={workingData.attackTemplates.map((attack) => ({
                    id: attack.id,
                    name: attack.name,
                  }))}
                  selectedIds={selectedCampaign.availableAttackTemplateIds}
                  onChange={(ids) =>
                    updateCampaign({ ...selectedCampaign, availableAttackTemplateIds: ids })
                  }
                />

                <section style={cardStyle()}>
                  <h3 style={{ marginTop: 0, color: "#111827" }}>Attribute Generation</h3>
                  {helperText("Choose how players generate attributes for this campaign.")}
                  <div style={{ ...rowWrap(), marginTop: 10 }}>
                    {["manual", "pointBuy", "randomRoll"].map((method) => {
                      const active = selectedCampaign.attributeRules.generationMethods.includes(
                        method as "manual" | "pointBuy" | "randomRoll"
                      );
                      return (
                        <button
                          key={method}
                          type="button"
                          onClick={() => {
                            const current = selectedCampaign.attributeRules.generationMethods;
                            const next = active
                              ? current.filter((value) => value !== method)
                              : [...current, method as "manual" | "pointBuy" | "randomRoll"];
                            updateCampaign({
                              ...selectedCampaign,
                              attributeRules: {
                                ...selectedCampaign.attributeRules,
                                generationMethods: next.length ? next : ["manual"],
                              },
                            });
                          }}
                          style={{
                            ...buttonStyle,
                            background: active ? "#dbeafe" : "#ffffff",
                            border: active ? "1px solid #60a5fa" : "1px solid #d1d5db",
                          }}
                        >
                          {active ? "✓ " : ""}
                          {method}
                        </button>
                      );
                    })}
                  </div>

                  <div style={{ ...grid2(), marginTop: 12 }}>
                    <label style={labelTextStyle}>
                      Point Buy Total
                      <input
                        type="number"
                        value={selectedCampaign.attributeRules.pointBuyTotal ?? 27}
                        onChange={(e) =>
                          updateCampaign({
                            ...selectedCampaign,
                            attributeRules: {
                              ...selectedCampaign.attributeRules,
                              pointBuyTotal: Number(e.target.value) || 0,
                            },
                          })
                        }
                        style={inputStyle}
                      />
                    </label>

                    <label style={labelTextStyle}>
                      Random Roll Formula
                      <input
                        value={selectedCampaign.attributeRules.randomRollFormula ?? ""}
                        onChange={(e) =>
                          updateCampaign({
                            ...selectedCampaign,
                            attributeRules: {
                              ...selectedCampaign.attributeRules,
                              randomRollFormula: e.target.value,
                            },
                          })
                        }
                        style={inputStyle}
                      />
                    </label>

                    <label style={labelTextStyle}>
                      Number of Rolls
                      <input
                        type="number"
                        value={selectedCampaign.attributeRules.randomRollCount ?? 6}
                        onChange={(e) =>
                          updateCampaign({
                            ...selectedCampaign,
                            attributeRules: {
                              ...selectedCampaign.attributeRules,
                              randomRollCount: Number(e.target.value) || 0,
                            },
                          })
                        }
                        style={inputStyle}
                      />
                    </label>

                    <label style={labelTextStyle}>
                      Drop Lowest Dice
                      <input
                        type="number"
                        value={selectedCampaign.attributeRules.randomRollDropLowest ?? 1}
                        onChange={(e) =>
                          updateCampaign({
                            ...selectedCampaign,
                            attributeRules: {
                              ...selectedCampaign.attributeRules,
                              randomRollDropLowest: Number(e.target.value) || 0,
                            },
                          })
                        }
                        style={inputStyle}
                      />
                    </label>

                    <label style={labelTextStyle}>
                      Minimum Score
                      <input
                        type="number"
                        value={selectedCampaign.attributeRules.minimumScore ?? 3}
                        onChange={(e) =>
                          updateCampaign({
                            ...selectedCampaign,
                            attributeRules: {
                              ...selectedCampaign.attributeRules,
                              minimumScore: Number(e.target.value) || 0,
                            },
                          })
                        }
                        style={inputStyle}
                      />
                    </label>

                    <label style={labelTextStyle}>
                      Maximum Score
                      <input
                        type="number"
                        value={selectedCampaign.attributeRules.maximumScore ?? 18}
                        onChange={(e) =>
                          updateCampaign({
                            ...selectedCampaign,
                            attributeRules: {
                              ...selectedCampaign.attributeRules,
                              maximumScore: Number(e.target.value) || 0,
                            },
                          })
                        }
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
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "300px 1fr",
            gap: 20,
            alignItems: "start",
          }}
        >
          <EntityListEditor
            title="Classes"
            helper="Classes are filtered to the selected campaign so they are easier to manage."
            items={visibleClasses}
            selectedId={selectedClass?.id ?? ""}
            onSelect={setSelectedClassId}
            onAdd={addClass}
            onDelete={deleteClass}
            subtitle={(cls) => `${cls.campaignId} • ${cls.id}`}
          />

          <main>
            <section style={{ ...cardStyle(), marginBottom: 16 }}>
              <h3 style={{ marginTop: 0, color: "#111827" }}>Class Filter</h3>
              {helperText("Choose a campaign to view and create only that campaign’s classes.")}
              <label style={{ ...labelTextStyle, marginTop: 12, maxWidth: 320 }}>
                Campaign
                <select
                  value={selectedCampaignId}
                  onChange={(e) => {
                    const nextCampaignId = e.target.value;
                    setSelectedCampaignId(nextCampaignId);
                    const nextVisible = workingData.classes.filter(
                      (cls) => cls.campaignId === nextCampaignId
                    );
                    setSelectedClassId(nextVisible[0]?.id ?? "");
                  }}
                  style={inputStyle}
                >
                  {workingData.campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>
                      {campaign.name}
                    </option>
                  ))}
                </select>
              </label>
            </section>

            {!selectedClass ? (
              <div style={cardStyle()}>
                <p style={{ margin: 0, ...mutedTextStyle }}>
                  No class selected for this campaign. Add one or choose a different campaign.
                </p>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 16 }}>
                <section style={cardStyle()}>
                  <h3 style={{ marginTop: 0, color: "#111827" }}>Basic Info</h3>
                  <div style={{ color: "#6b7280", marginBottom: 12 }}>
                    Campaign: {selectedCampaign?.name ?? selectedClass.campaignId}
                  </div>

                  <div style={grid2()}>
                    <label style={labelTextStyle}>
                      Internal ID
                      <input
                        value={selectedClass.id}
                        onChange={(e) => updateClass({ ...selectedClass, id: e.target.value })}
                        style={inputStyle}
                      />
                    </label>

                    <label style={labelTextStyle}>
                      Class Name
                      <input
                        value={selectedClass.name}
                        onChange={(e) => updateClass({ ...selectedClass, name: e.target.value })}
                        style={inputStyle}
                      />
                    </label>

                    <label style={labelTextStyle}>
                      Campaign
                      <select
                        value={selectedClass.campaignId}
                        onChange={(e) => {
                          const nextCampaignId = e.target.value;
                          const updated = { ...selectedClass, campaignId: nextCampaignId };
                          updateClass(updated);
                          setSelectedCampaignId(nextCampaignId);
                          setSelectedClassId(updated.id);
                        }}
                        style={inputStyle}
                      >
                        {workingData.campaigns.map((campaign) => (
                          <option key={campaign.id} value={campaign.id}>
                            {campaign.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label style={{ ...labelTextStyle, marginTop: 12 }}>
                    Description
                    <input
                      value={selectedClass.description ?? ""}
                      onChange={(e) =>
                        updateClass({ ...selectedClass, description: e.target.value })
                      }
                      style={inputStyle}
                    />
                  </label>
                </section>

                <AttributeBonusesEditor
                  bonuses={selectedClass.attributeBonuses}
                  onChange={(bonuses) =>
                    updateClass({ ...selectedClass, attributeBonuses: bonuses })
                  }
                />

                <section style={cardStyle()}>
                  <h3 style={{ marginTop: 0, color: "#111827" }}>HP Rules</h3>
                  {helperText("Define how much health this class gets at level 1 and on level-up.")}
                  <div style={{ ...grid2(), marginTop: 12 }}>
                    <label style={labelTextStyle}>
                      Hit Die
                      <input
                        type="number"
                        value={selectedClass.hpRule.hitDie}
                        onChange={(e) =>
                          updateClass({
                            ...selectedClass,
                            hpRule: {
                              ...selectedClass.hpRule,
                              hitDie: Number(e.target.value) || 0,
                            },
                          })
                        }
                        style={inputStyle}
                      />
                    </label>

                    <label style={labelTextStyle}>
                      Level 1 HP Mode
                      <select
                        value={selectedClass.hpRule.level1Mode}
                        onChange={(e) =>
                          updateClass({
                            ...selectedClass,
                            hpRule: {
                              ...selectedClass.hpRule,
                              level1Mode: e.target.value as ClassDefinition["hpRule"]["level1Mode"],
                            },
                          })
                        }
                        style={inputStyle}
                      >
                        <option value="fixed-max">Use max hit die</option>
                        <option value="fixed-value">Use fixed value</option>
                        <option value="roll">Roll</option>
                      </select>
                    </label>

                    <label style={labelTextStyle}>
                      Level 1 Fixed Value
                      <input
                        type="number"
                        value={selectedClass.hpRule.level1FixedValue ?? ""}
                        onChange={(e) =>
                          updateClass({
                            ...selectedClass,
                            hpRule: {
                              ...selectedClass.hpRule,
                              level1FixedValue:
                                e.target.value === "" ? undefined : Number(e.target.value),
                            },
                          })
                        }
                        style={inputStyle}
                      />
                    </label>

                    <label style={labelTextStyle}>
                      Level-up HP Mode
                      <select
                        value={selectedClass.hpRule.levelUpMode}
                        onChange={(e) =>
                          updateClass({
                            ...selectedClass,
                            hpRule: {
                              ...selectedClass.hpRule,
                              levelUpMode:
                                e.target.value as ClassDefinition["hpRule"]["levelUpMode"],
                            },
                          })
                        }
                        style={inputStyle}
                      >
                        <option value="fixed-average">Use fixed average</option>
                        <option value="fixed-value">Use fixed value</option>
                        <option value="roll">Roll</option>
                      </select>
                    </label>

                    <label style={labelTextStyle}>
                      Level-up Fixed Value
                      <input
                        type="number"
                        value={selectedClass.hpRule.levelUpFixedValue ?? ""}
                        onChange={(e) =>
                          updateClass({
                            ...selectedClass,
                            hpRule: {
                              ...selectedClass.hpRule,
                              levelUpFixedValue:
                                e.target.value === "" ? undefined : Number(e.target.value),
                            },
                          })
                        }
                        style={inputStyle}
                      />
                    </label>
                  </div>
                </section>

                <ToggleIdListEditor
                  title="Starting Attacks"
                  helper="These attacks are automatically added when a new character of this class is created."
                  options={classAttackOptions}
                  selectedIds={selectedClass.startingAttackTemplateIds ?? []}
                  onChange={(ids) =>
                    updateClass({ ...selectedClass, startingAttackTemplateIds: ids })
                  }
                />

                <ToggleIdListEditor
                  title="Starting Powers"
                  helper="These powers are automatically granted at character creation."
                  options={classPowerOptions}
                  selectedIds={selectedClass.defaultPowerIds ?? []}
                  onChange={(ids) =>
                    updateClass({ ...selectedClass, defaultPowerIds: ids })
                  }
                />

                <ToggleIdListEditor
                  title="Starting Items"
                  helper="These items are automatically granted at character creation."
                  options={classItemOptions}
                  selectedIds={selectedClass.defaultItemIds ?? []}
                  onChange={(ids) =>
                    updateClass({ ...selectedClass, defaultItemIds: ids })
                  }
                />

                <ChoiceRulesEditor
                  title="Skill Choices"
                  helper="Define which skills a player may choose during character creation."
                  optionLabel="skills"
                  options={classSkillOptions}
                  rules={(selectedClass.skillChoiceRules ?? []).map((rule) => ({
                    choose: rule.choose,
                    ids: rule.skillIds,
                  }))}
                  onChange={(rules) =>
                    updateClass({
                      ...selectedClass,
                      skillChoiceRules: rules.map((rule) => ({
                        choose: rule.choose,
                        skillIds: rule.ids,
                      })),
                    })
                  }
                />

                <ChoiceRulesEditor
                  title="Power Choices"
                  helper="Define which powers a player may choose during character creation."
                  optionLabel="powers"
                  options={classPowerOptions}
                  rules={(selectedClass.powerChoiceRules ?? []).map((rule) => ({
                    choose: rule.choose,
                    ids: rule.powerIds,
                  }))}
                  onChange={(rules) =>
                    updateClass({
                      ...selectedClass,
                      powerChoiceRules: rules.map((rule) => ({
                        choose: rule.choose,
                        powerIds: rule.ids,
                      })),
                    })
                  }
                />

                <ChoiceRulesEditor
                  title="Item Choices"
                  helper="Define which items a player may choose during character creation."
                  optionLabel="items"
                  options={classItemOptions}
                  rules={(selectedClass.itemChoiceRules ?? []).map((rule) => ({
                    choose: rule.choose,
                    ids: rule.itemIds,
                  }))}
                  onChange={(rules) =>
                    updateClass({
                      ...selectedClass,
                      itemChoiceRules: rules.map((rule) => ({
                        choose: rule.choose,
                        itemIds: rule.ids,
                      })),
                    })
                  }
                />
              </div>
            )}
          </main>
        </div>
      )}

      {tab === "skills" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "300px 1fr",
            gap: 20,
            alignItems: "start",
          }}
        >
          <EntityListEditor
            title="Skills"
            helper="Skills are things characters can be proficient in."
            items={workingData.skills}
            selectedId={selectedSkillId}
            onSelect={setSelectedSkillId}
            onAdd={addSkill}
            onDelete={deleteSkill}
            subtitle={(skill) => `${skill.attribute} • ${skill.id}`}
          />

          <main>
            {!selectedSkill ? (
              <div style={cardStyle()}>
                <p style={{ margin: 0, ...mutedTextStyle }}>Select a skill to edit.</p>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 16 }}>
                <section style={cardStyle()}>
                  <h3 style={{ marginTop: 0, color: "#111827" }}>Skill Details</h3>
                  <div style={grid2()}>
                    <label style={labelTextStyle}>
                      Internal ID
                      <input
                        value={selectedSkill.id}
                        onChange={(e) => updateSkill({ ...selectedSkill, id: e.target.value })}
                        style={inputStyle}
                      />
                    </label>

                    <label style={labelTextStyle}>
                      Display Name
                      <input
                        value={selectedSkill.name}
                        onChange={(e) => updateSkill({ ...selectedSkill, name: e.target.value })}
                        style={inputStyle}
                      />
                    </label>

                    <label style={labelTextStyle}>
                      Linked Attribute
                      <select
                        value={selectedSkill.attribute}
                        onChange={(e) =>
                          updateSkill({
                            ...selectedSkill,
                            attribute: e.target.value as AttributeKey,
                          })
                        }
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

                  <label style={{ ...labelTextStyle, marginTop: 12 }}>
                    Description
                    <input
                      value={selectedSkill.description ?? ""}
                      onChange={(e) =>
                        updateSkill({ ...selectedSkill, description: e.target.value })
                      }
                      style={inputStyle}
                    />
                  </label>

                  <label style={{ ...labelTextStyle, marginTop: 12 }}>
                    Tags
                    <input
                      value={(selectedSkill.tags ?? []).join(", ")}
                      onChange={(e) =>
                        updateSkill({ ...selectedSkill, tags: parseCommaList(e.target.value) })
                      }
                      style={inputStyle}
                    />
                  </label>
                </section>
              </div>
            )}
          </main>
        </div>
      )}

      {tab === "powers" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "300px 1fr",
            gap: 20,
            alignItems: "start",
          }}
        >
          <EntityListEditor
            title="Powers"
            helper="Powers are abilities, spells, or special features characters can have."
            items={workingData.powers}
            selectedId={selectedPowerId}
            onSelect={setSelectedPowerId}
            onAdd={addPower}
            onDelete={deletePower}
            subtitle={(power) => `${power.category || "uncategorized"} • ${power.id}`}
          />

          <main>
            {!selectedPower ? (
              <div style={cardStyle()}>
                <p style={{ margin: 0, ...mutedTextStyle }}>Select a power to edit.</p>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 16 }}>
                <section style={cardStyle()}>
                  <h3 style={{ marginTop: 0, color: "#111827" }}>Power Details</h3>
                  <div style={grid2()}>
                    <label style={labelTextStyle}>
                      Internal ID
                      <input
                        value={selectedPower.id}
                        onChange={(e) => updatePower({ ...selectedPower, id: e.target.value })}
                        style={inputStyle}
                      />
                    </label>

                    <label style={labelTextStyle}>
                      Display Name
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
                        onChange={(e) =>
                          updatePower({ ...selectedPower, category: e.target.value })
                        }
                        style={inputStyle}
                      />
                    </label>
                  </div>

                  <label style={{ ...labelTextStyle, marginTop: 12 }}>
                    Description
                    <input
                      value={selectedPower.description ?? ""}
                      onChange={(e) =>
                        updatePower({ ...selectedPower, description: e.target.value })
                      }
                      style={inputStyle}
                    />
                  </label>

                  <label style={{ ...labelTextStyle, marginTop: 12 }}>
                    Source Text
                    <input
                      value={selectedPower.sourceText ?? ""}
                      onChange={(e) =>
                        updatePower({ ...selectedPower, sourceText: e.target.value })
                      }
                      style={inputStyle}
                    />
                  </label>

                  <label style={{ ...labelTextStyle, marginTop: 12 }}>
                    Tags
                    <input
                      value={(selectedPower.tags ?? []).join(", ")}
                      onChange={(e) =>
                        updatePower({ ...selectedPower, tags: parseCommaList(e.target.value) })
                      }
                      style={inputStyle}
                    />
                  </label>
                </section>
              </div>
            )}
          </main>
        </div>
      )}

      {tab === "items" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "300px 1fr",
            gap: 20,
            alignItems: "start",
          }}
        >
          <EntityListEditor
            title="Items"
            helper="Items are equipment or gear that characters can start with or choose."
            items={workingData.items}
            selectedId={selectedItemId}
            onSelect={setSelectedItemId}
            onAdd={addItem}
            onDelete={deleteItem}
            subtitle={(item) => `${item.category || "uncategorized"} • ${item.id}`}
          />

          <main>
            {!selectedItem ? (
              <div style={cardStyle()}>
                <p style={{ margin: 0, ...mutedTextStyle }}>Select an item to edit.</p>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 16 }}>
                <section style={cardStyle()}>
                  <h3 style={{ marginTop: 0, color: "#111827" }}>Item Details</h3>
                  <div style={grid2()}>
                    <label style={labelTextStyle}>
                      Internal ID
                      <input
                        value={selectedItem.id}
                        onChange={(e) => updateItem({ ...selectedItem, id: e.target.value })}
                        style={inputStyle}
                      />
                    </label>

                    <label style={labelTextStyle}>
                      Display Name
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
                        onChange={(e) =>
                          updateItem({ ...selectedItem, category: e.target.value })
                        }
                        style={inputStyle}
                      />
                    </label>

                    <label style={labelTextStyle}>
                      Default Quantity
                      <input
                        type="number"
                        value={selectedItem.defaultQuantity ?? 1}
                        onChange={(e) =>
                          updateItem({
                            ...selectedItem,
                            defaultQuantity: Number(e.target.value) || 1,
                          })
                        }
                        style={inputStyle}
                      />
                    </label>

                    <label style={{ ...labelTextStyle, ...rowWrap() }}>
                      <input
                        type="checkbox"
                        checked={selectedItem.stackable}
                        onChange={(e) =>
                          updateItem({ ...selectedItem, stackable: e.target.checked })
                        }
                      />
                      Stackable
                    </label>
                  </div>

                  <label style={{ ...labelTextStyle, marginTop: 12 }}>
                    Description
                    <input
                      value={selectedItem.description ?? ""}
                      onChange={(e) =>
                        updateItem({ ...selectedItem, description: e.target.value })
                      }
                      style={inputStyle}
                    />
                  </label>

                  <label style={{ ...labelTextStyle, marginTop: 12 }}>
                    Tags
                    <input
                      value={(selectedItem.tags ?? []).join(", ")}
                      onChange={(e) =>
                        updateItem({ ...selectedItem, tags: parseCommaList(e.target.value) })
                      }
                      style={inputStyle}
                    />
                  </label>
                </section>
              </div>
            )}
          </main>
        </div>
      )}

      {tab === "attacks" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "300px 1fr",
            gap: 20,
            alignItems: "start",
          }}
        >
          <EntityListEditor
            title="Attack Templates"
            helper="Attack templates become starting attacks on created characters."
            items={workingData.attackTemplates}
            selectedId={selectedAttackId}
            onSelect={setSelectedAttackId}
            onAdd={addAttack}
            onDelete={deleteAttack}
            subtitle={(attack) => `${attack.attribute} • ${attack.damage} • ${attack.id}`}
          />

          <main>
            {!selectedAttack ? (
              <div style={cardStyle()}>
                <p style={{ margin: 0, ...mutedTextStyle }}>Select an attack template to edit.</p>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 16 }}>
                <section style={cardStyle()}>
                  <h3 style={{ marginTop: 0, color: "#111827" }}>Attack Details</h3>
                  <div style={grid2()}>
                    <label style={labelTextStyle}>
                      Internal ID
                      <input
                        value={selectedAttack.id}
                        onChange={(e) => updateAttack({ ...selectedAttack, id: e.target.value })}
                        style={inputStyle}
                      />
                    </label>

                    <label style={labelTextStyle}>
                      Display Name
                      <input
                        value={selectedAttack.name}
                        onChange={(e) => updateAttack({ ...selectedAttack, name: e.target.value })}
                        style={inputStyle}
                      />
                    </label>

                    <label style={labelTextStyle}>
                      Linked Attribute
                      <select
                        value={selectedAttack.attribute}
                        onChange={(e) =>
                          updateAttack({
                            ...selectedAttack,
                            attribute: e.target.value as AttributeKey,
                          })
                        }
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
                      <input
                        value={selectedAttack.damage}
                        onChange={(e) =>
                          updateAttack({ ...selectedAttack, damage: e.target.value })
                        }
                        style={inputStyle}
                      />
                    </label>

                    <label style={labelTextStyle}>
                      Attack Bonus
                      <input
                        type="number"
                        value={selectedAttack.bonus ?? 0}
                        onChange={(e) =>
                          updateAttack({
                            ...selectedAttack,
                            bonus: Number(e.target.value) || 0,
                          })
                        }
                        style={inputStyle}
                      />
                    </label>
                  </div>

                  <label style={{ ...labelTextStyle, marginTop: 12 }}>
                    Notes
                    <input
                      value={selectedAttack.notes ?? ""}
                      onChange={(e) =>
                        updateAttack({ ...selectedAttack, notes: e.target.value })
                      }
                      style={inputStyle}
                    />
                  </label>

                  <label style={{ ...labelTextStyle, marginTop: 12 }}>
                    Tags
                    <input
                      value={(selectedAttack.tags ?? []).join(", ")}
                      onChange={(e) =>
                        updateAttack({ ...selectedAttack, tags: parseCommaList(e.target.value) })
                      }
                      style={inputStyle}
                    />
                  </label>
                </section>
              </div>
            )}
          </main>
        </div>
      )}
    </section>
  );
}