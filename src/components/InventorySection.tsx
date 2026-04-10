import type { CharacterRecord } from "../types/character";
import type { ClassItemChoiceRule, ItemDefinition } from "../types/gameData";
import { buttonStyle, cardStyle, inputStyle, panelStyle, sectionTitleStyle } from "./uiStyles";

interface Props {
  character: CharacterRecord;
  items: ItemDefinition[];
  label: string;
  itemChoiceRules: ClassItemChoiceRule[];
  onToggleItem: (itemId: string, nextSelected: boolean) => void;
  onQuantityChange: (itemId: string, quantity: number) => void;
  onEquippedChange: (itemId: string, equipped: boolean) => void;
  onRemoveManualItem: (itemName: string) => void;
  onAddManualItem: () => void;
}

function getRuleForItem(itemId: string, rules: ClassItemChoiceRule[]) {
  return rules.find((rule) => rule.itemIds.includes(itemId));
}

function getSelectedCountForRule(rule: ClassItemChoiceRule, character: CharacterRecord) {
  return character.inventory.filter(
    (item) => item.itemId && rule.itemIds.includes(item.itemId)
  ).length;
}

export default function InventorySection({
  character,
  items,
  label,
  itemChoiceRules,
  onToggleItem,
  onQuantityChange,
  onEquippedChange,
  onRemoveManualItem,
  onAddManualItem,
}: Props) {
  const hasChoiceRules = itemChoiceRules.length > 0;

  return (
    <section style={panelStyle}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <h2 style={sectionTitleStyle}>{label}</h2>
        <button onClick={onAddManualItem} style={buttonStyle}>
          Add Item
        </button>
      </div>

      {hasChoiceRules && (
        <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
          {itemChoiceRules.map((rule, index) => {
            const selectedCount = getSelectedCountForRule(rule, character);
            const remaining = rule.choose - selectedCount;

            return (
              <div
                key={`${index}-${rule.itemIds.join("-")}`}
                style={{
                  padding: 10,
                  borderRadius: 8,
                  background: "#eff6ff",
                  color: "#1e3a8a",
                  fontSize: 14,
                }}
              >
                <strong>Item Picks:</strong> choose {rule.choose} from{" "}
                {rule.itemIds
                  .map((id) => items.find((i) => i.id === id)?.name ?? id)
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
        {items.map((item) => {
          const selectedItem = character.inventory.find((i) => i.itemId === item.id);
          const isSelected = Boolean(selectedItem);

          const rule = getRuleForItem(item.id, itemChoiceRules);
          const selectedCount = rule ? getSelectedCountForRule(rule, character) : 0;
          const remaining = rule ? rule.choose - selectedCount : 0;

          const canBeChosen = !hasChoiceRules || Boolean(rule) || isSelected;
          const disableCheckbox =
            !isSelected &&
            ((hasChoiceRules && !canBeChosen) || (rule ? remaining <= 0 : false));

          return (
            <div
              key={item.id}
              style={{
                ...cardStyle,
                display: "grid",
                gridTemplateColumns: "1.5fr auto auto auto",
                gap: 12,
                alignItems: "center",
                opacity: canBeChosen ? 1 : 0.7,
              }}
            >
              <div>
                <div style={{ color: "var(--text-primary)", fontWeight: 700 }}>{item.name}</div>
                <div style={{ color: "var(--text-secondary)", fontSize: 14, marginTop: 4 }}>
                  {item.description || "No description."}
                </div>
              </div>

              <label style={{ color: "#b9cdf0", fontSize: 14, whiteSpace: "nowrap" }}>
                Select
                <input
                  type="checkbox"
                  checked={isSelected}
                  disabled={disableCheckbox}
                  onChange={(e) => onToggleItem(item.id, e.target.checked)}
                  style={{ marginLeft: 8 }}
                />
              </label>

              <label style={{ color: "#b9cdf0", fontSize: 14, whiteSpace: "nowrap" }}>
                Qty
                <input
                  type="number"
                  min={1}
                  value={selectedItem?.quantity ?? item.defaultQuantity ?? 1}
                  disabled={!isSelected}
                  onChange={(e) => onQuantityChange(item.id, Number(e.target.value) || 1)}
                  style={{
                    ...inputStyle,
                    width: 70,
                    marginLeft: 8,
                    marginTop: 0,
                    display: "inline-block",
                  }}
                />
              </label>

              <label style={{ color: "#b9cdf0", fontSize: 14, whiteSpace: "nowrap" }}>
                Equipped
                <input
                  type="checkbox"
                  checked={selectedItem?.equipped ?? false}
                  disabled={!isSelected}
                  onChange={(e) => onEquippedChange(item.id, e.target.checked)}
                  style={{ marginLeft: 8 }}
                />
              </label>
            </div>
          );
        })}

        {character.inventory
          .filter((item) => !item.itemId)
          .map((item, index) => (
            <div
              key={`manual-${index}-${item.name}`}
              style={{
                ...cardStyle,
                display: "grid",
                gridTemplateColumns: "2fr 1fr 1fr auto",
                gap: 12,
                alignItems: "center",
              }}
            >
              <div style={{ color: "var(--text-primary)" }}>
                <strong>{item.name}</strong>
                <div style={{ color: "var(--text-secondary)", fontSize: 14, marginTop: 4 }}>
                  Manual item
                </div>
              </div>

              <label style={{ color: "#b9cdf0", fontSize: 14 }}>
                Qty
                <input
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(e) => onQuantityChange(item.name, Number(e.target.value) || 1)}
                  style={{
                    ...inputStyle,
                    width: 70,
                    marginLeft: 8,
                    marginTop: 0,
                    display: "inline-block",
                  }}
                />
              </label>

              <label style={{ color: "#b9cdf0", fontSize: 14 }}>
                Equipped
                <input
                  type="checkbox"
                  checked={item.equipped ?? false}
                  onChange={(e) => onEquippedChange(item.name, e.target.checked)}
                  style={{ marginLeft: 8 }}
                />
              </label>

              <button onClick={() => onRemoveManualItem(item.name)} style={buttonStyle}>
                Remove
              </button>
            </div>
          ))}
      </div>
    </section>
  );
}