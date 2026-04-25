import type { CharacterRecord } from "../types/character";
import type { AttributeKey } from "../types/gameData";
import { getAttributeModifier } from "../lib/character";
import { inputStyle, panelStyle, sectionTitleStyle } from "./uiStyles";

interface Props {
  character: CharacterRecord;
  onSpeedChange: (value: string) => void;
  onAcBaseChange: (value: number) => void;
  onAcBonusChange: (value: number) => void;
  onAcUseDexChange: (value: boolean) => void;
  onInitMiscChange: (value: number) => void;
  onSaveProfChange: (attr: AttributeKey, value: boolean) => void;
  onSaveBonusChange: (attr: AttributeKey, value: number) => void;
}

const ATTRS: AttributeKey[] = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];

export default function SheetFieldsSection({
  character,
  onSpeedChange,
  onAcBaseChange,
  onAcBonusChange,
  onAcUseDexChange,
  onInitMiscChange,
  onSaveProfChange,
  onSaveBonusChange,
}: Props) {
  const sheet = character.sheet ?? {
    speed: "",
    acBase: 10,
    acBonus: 0,
    acUseDex: true,
    initMisc: 0,
    saveProf: {
      STR: false,
      DEX: false,
      CON: false,
      INT: false,
      WIS: false,
      CHA: false,
    },
    saveBonus: {
      STR: 0,
      DEX: 0,
      CON: 0,
      INT: 0,
      WIS: 0,
      CHA: 0,
    },
  };

  const dexMod = getAttributeModifier(character.attributes.DEX);
  const totalAc = sheet.acBase + sheet.acBonus + (sheet.acUseDex ? dexMod : 0);
  const initiative = dexMod + sheet.initMisc;

  return (
    <section style={panelStyle}>
      <h2 style={sectionTitleStyle}>Core</h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 12,
          marginBottom: 18,
        }}
      >
        <label style={{ display: "grid", gap: 6 }}>
          <span>Speed</span>
          <input
            type="text"
            value={sheet.speed ?? ""}
            onChange={(e) => onSpeedChange(e.target.value)}
            className="form-control" style={inputStyle}
            placeholder="30 ft"
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span>Base AC</span>
          <input
            type="number"
            value={sheet.acBase}
            onChange={(e) => onAcBaseChange(Number(e.target.value) || 0)}
            className="form-control" style={inputStyle}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span>AC Bonus</span>
          <input
            type="number"
            value={sheet.acBonus}
            onChange={(e) => onAcBonusChange(Number(e.target.value) || 0)}
            className="form-control" style={inputStyle}
          />
        </label>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            paddingTop: 24,
          }}
        >
          <input
            type="checkbox"
            checked={sheet.acUseDex}
            onChange={(e) => onAcUseDexChange(e.target.checked)}
          />
          <span>Use DEX in AC</span>
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span>Init Bonus</span>
          <input
            type="number"
            value={sheet.initMisc}
            onChange={(e) => onInitMiscChange(Number(e.target.value) || 0)}
            className="form-control" style={inputStyle}
          />
        </label>

        <div
          style={{
            display: "grid",
            gap: 6,
            paddingTop: 24,
          }}
        >
          <div>Total AC: {totalAc}</div>
          <div>Initiative: {initiative}</div>
        </div>
      </div>

      <div style={{ fontWeight: 700, marginBottom: 8 }}>Saving Throws</div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "90px 80px 90px 90px 100px",
          gap: 8,
          alignItems: "center",
        }}
      >
        <div style={{ fontWeight: 700 }}>Attr</div>
        <div style={{ fontWeight: 700 }}>Mod</div>
        <div style={{ fontWeight: 700 }}>Prof</div>
        <div style={{ fontWeight: 700 }}>Bonus</div>
        <div style={{ fontWeight: 700 }}>Total</div>

        {ATTRS.map((attr) => {
          const mod = getAttributeModifier(character.attributes[attr]);
          const prof = sheet.saveProf[attr];
          const bonus = sheet.saveBonus[attr];
          const total = mod + (prof ? character.proficiencyBonus : 0) + bonus;

          return (
            <div key={attr} style={{ display: "contents" }}>
              <div>{attr}</div>
              <div>{mod >= 0 ? `+${mod}` : mod}</div>
              <div>
                <input
                  type="checkbox"
                  checked={prof}
                  onChange={(e) => onSaveProfChange(attr, e.target.checked)}
                />
              </div>
              <div>
                <input
                  type="number"
                  value={bonus}
                  onChange={(e) => onSaveBonusChange(attr, Number(e.target.value) || 0)}
                  className="form-control" style={inputStyle}
                />
              </div>
              <div>{total >= 0 ? `+${total}` : total}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}