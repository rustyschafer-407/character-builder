import type { CharacterRecord } from "../types/character";
import type { ItemDefinition } from "../types/gameData";
import { buttonStyle, cardStyle, inputStyle, panelStyle, sectionTitleStyle } from "./uiStyles";

interface Props {
  character: CharacterRecord;
  items: ItemDefinition[];
  label: string;
  onToggleItem: (itemId: string, nextSelected: boolean) => void;
  onQuantityChange: (itemId: string, quantity: number) => void;
  onRemoveManualItem: (itemName: string) => void;
  onAddManualItem: () => void;
}

export default function InventorySection({
  character,
  items,
  label,
  onToggleItem,
  onQuantityChange,
  onRemoveManualItem,
  onAddManualItem,
}: Props) {
  return (
    <section style={panelStyle} className="inventory-section mobile-stack">
      <div className="inventory-section-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <h2 style={sectionTitleStyle}>{label}</h2>
        <button onClick={onAddManualItem} className="button-control" style={buttonStyle}>
          Add Item
        </button>
      </div>

      <div className="inventory-list" style={{ display: "grid", gap: 8 }}>
        {items.map((item) => {
          const selectedItem = character.inventory.find((i) => i.itemId === item.id);
          const isSelected = Boolean(selectedItem);

          return (
            <div
              key={item.id}
              className="inventory-row mobile-card"
              style={{
                ...cardStyle,
                display: "grid",
                gridTemplateColumns: "1.5fr auto auto",
                gap: 12,
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ color: "var(--text-primary)", fontWeight: 700 }}>{item.name}</div>
                <div style={{ color: "var(--text-secondary)", fontSize: 14, marginTop: 4 }}>
                  {item.description || "No description."}
                </div>
              </div>

              <label style={{ color: "var(--cb-muted-label)", fontSize: 14, whiteSpace: "nowrap" }}>
                Select
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={(e) => onToggleItem(item.id, e.target.checked)}
                  style={{ marginLeft: 8 }}
                />
              </label>

              <label style={{ color: "var(--cb-muted-label)", fontSize: 14, whiteSpace: "nowrap" }}>
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
            </div>
          );
        })}

        {character.inventory
          .filter((item) => !item.itemId)
          .map((item, index) => (
            <div
              key={`manual-${index}-${item.name}`}
              className="inventory-row inventory-row-manual mobile-card"
              style={{
                ...cardStyle,
                display: "grid",
                gridTemplateColumns: "2fr 1fr auto",
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

              <label style={{ color: "var(--cb-muted-label)", fontSize: 14 }}>
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

              <button onClick={() => onRemoveManualItem(item.name)} className="button-control" style={buttonStyle}>
                Remove
              </button>
            </div>
          ))}
      </div>
    </section>
  );
}