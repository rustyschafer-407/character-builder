import type { CharacterRecord } from "../types/character";
import type { ClassPowerChoiceRule, PowerDefinition, AttributeKey } from "../types/gameData";
import { cardStyle, panelStyle, sectionTitleStyle, inputStyle, labelTextStyle } from "./uiStyles";

interface Props {
  character: CharacterRecord;
  powers: PowerDefinition[];
  label: string;
  powerChoiceRules: ClassPowerChoiceRule[];
  onTogglePower: (powerId: string, nextSelected: boolean) => void;
  onPowerChange?: (
    powerId: string,
    field: "usesPerDay" | "description" | "saveAttribute",
    value: number | string | AttributeKey | undefined
  ) => void;
}

function getRuleForPower(
  powerId: string,
  rules: ClassPowerChoiceRule[]
): ClassPowerChoiceRule | undefined {
  return rules.find((rule) => rule.powerIds.includes(powerId));
}

function getSelectedCountForRule(
  rule: ClassPowerChoiceRule,
  character: CharacterRecord
) {
  return character.powers.filter(
    (power) => power.powerId && rule.powerIds.includes(power.powerId)
  ).length;
}

export default function PowersSection({
  character,
  powers,
  label,
  powerChoiceRules,
  onTogglePower,
  onPowerChange,
}: Props) {
  const hasChoiceRules = powerChoiceRules.length > 0;

  return (
    <section style={panelStyle}>
      <h2 style={sectionTitleStyle}>{label}</h2>

      {hasChoiceRules && (
        <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
          {powerChoiceRules.map((rule, index) => {
            const selectedCount = getSelectedCountForRule(rule, character);
            const remaining = rule.choose - selectedCount;

            return (
              <div
                key={`${index}-${rule.powerIds.join("-")}`}
                style={{
                  padding: 10,
                  borderRadius: 8,
                  background: "#eff6ff",
                  color: "#1e3a8a",
                  fontSize: 14,
                }}
              >
                <strong>Power Picks:</strong> choose {rule.choose} from{" "}
                {rule.powerIds
                  .map((id) => powers.find((p) => p.id === id)?.name ?? id)
                  .join(", ")}
                <div style={{ marginTop: 4 }}>
                  Remaining: <strong>{remaining}</strong>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: "grid", gap: 8 }}>
        {powers.map((power) => {
          const selectedPower = character.powers.find((p) => p.powerId === power.id);
          const isSelected = Boolean(selectedPower);

          const rule = getRuleForPower(power.id, powerChoiceRules);
          const selectedCount = rule ? getSelectedCountForRule(rule, character) : 0;
          const remaining = rule ? rule.choose - selectedCount : 0;

          const canBeChosen = !hasChoiceRules || Boolean(rule) || isSelected;
          const disableCheckbox =
            !isSelected &&
            ((hasChoiceRules && !canBeChosen) || (rule ? remaining <= 0 : false));

          return (
            <div
              key={power.id}
              style={{
                ...cardStyle,
                display: "grid",
                gridTemplateColumns: isSelected ? "1fr" : "1fr auto",
                gap: 12,
                alignItems: "start",
                opacity: canBeChosen ? 1 : 0.7,
              }}
            >
              <div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: 12,
                    alignItems: "center",
                    marginBottom: isSelected ? 12 : 0,
                  }}
                >
                  <div>
                    <div style={{ color: "var(--text-primary)", fontWeight: 700 }}>{power.name}</div>
                    <div style={{ color: "var(--text-secondary)", fontSize: 14, marginTop: 4 }}>
                      {power.description || "No description."}
                    </div>
                  </div>

                  <label style={{ color: "#b9cdf0", fontSize: 14, whiteSpace: "nowrap" }}>
                    Select
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={disableCheckbox}
                      onChange={(e) => onTogglePower(power.id, e.target.checked)}
                      style={{ marginLeft: 8 }}
                    />
                  </label>
                </div>

                {isSelected && onPowerChange && selectedPower && (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3, 1fr)",
                      gap: 12,
                      borderTop: "1px solid rgba(255,255,255,0.1)",
                      paddingTop: 12,
                    }}
                  >
                    <label style={labelTextStyle}>
                      Uses/Day
                      <input
                        type="number"
                        min={0}
                        value={selectedPower.usesPerDay ?? power.usesPerDay ?? 0}
                        onChange={(e) =>
                          onPowerChange(power.id, "usesPerDay", Math.max(0, Number(e.target.value) || 0))
                        }
                        style={{ ...inputStyle, marginTop: 4 }}
                      />
                    </label>

                    <label style={labelTextStyle}>
                      Power Attribute
                      <select
                        value={selectedPower.saveAttribute ?? power.saveAttribute ?? "none"}
                        onChange={(e) =>
                          onPowerChange(
                            power.id,
                            "saveAttribute",
                            e.target.value === "none" ? undefined : (e.target.value as AttributeKey)
                          )
                        }
                        style={{ ...inputStyle, marginTop: 4 }}
                      >
                        <option value="none">None</option>
                        <option value="STR">STR</option>
                        <option value="DEX">DEX</option>
                        <option value="CON">CON</option>
                        <option value="INT">INT</option>
                        <option value="WIS">WIS</option>
                        <option value="CHA">CHA</option>
                      </select>
                    </label>

                    <label style={labelTextStyle}>
                      Description
                      <input
                        type="text"
                        value={selectedPower.description ?? power.description ?? ""}
                        onChange={(e) => onPowerChange(power.id, "description", e.target.value)}
                        placeholder="Power description"
                        style={{ ...inputStyle, marginTop: 4 }}
                      />
                    </label>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}