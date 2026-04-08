import type { CharacterRecord } from "../types/character";
import type { ClassDefinition, GenreDefinition } from "../types/gameData";
import {
  dangerButtonStyle,
  inputStyle,
  labelTextStyle,
  mutedTextStyle,
  panelStyle,
  primaryButtonStyle,
} from "./uiStyles";

interface Props {
  genres: GenreDefinition[];
  classesForSelectedGenre: ClassDefinition[];
  characters: CharacterRecord[];
  selectedId: string;
  newGenreId: string;
  newClassId: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onImport: (file: File) => void;
  onGenreChange: (id: string) => void;
  onClassChange: (id: string) => void;
  getGenreName: (genreId: string) => string;
  getClassName: (classId: string) => string;
}

export default function Sidebar({
  genres,
  classesForSelectedGenre,
  characters,
  selectedId,
  newGenreId,
  newClassId,
  onSelect,
  onCreate,
  onDelete,
  onImport,
  onGenreChange,
  onClassChange,
  getGenreName,
  getClassName,
}: Props) {
  return (
    <aside
      style={{
        ...panelStyle,
        width: 300,
      }}
    >
      <h2 style={{ marginTop: 0, marginBottom: 16, color: "#111827" }}>Characters</h2>

      <div style={{ display: "grid", gap: 8 }}>
        <label style={labelTextStyle}>
          Genre
          <select value={newGenreId} onChange={(e) => onGenreChange(e.target.value)} style={inputStyle}>
            {genres.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>

        <label style={labelTextStyle}>
          Class
          <select value={newClassId} onChange={(e) => onClassChange(e.target.value)} style={inputStyle}>
            {classesForSelectedGenre.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </select>
        </label>

        <button onClick={onCreate} style={primaryButtonStyle}>
          New Character
        </button>
      </div>

      <div style={{ marginTop: 12 }}>
        <label
          style={{
            ...labelTextStyle,
            display: "block",
            marginBottom: 4,
          }}
        >
          Import Character
        </label>
        <input
          type="file"
          accept=".json"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onImport(file);
            e.currentTarget.value = "";
          }}
          style={{ ...inputStyle, padding: 6 }}
        />
      </div>

      <div style={{ marginTop: 16, display: "grid", gap: 8 }}>
        {characters.length === 0 && <p style={{ margin: 0, ...mutedTextStyle }}>No characters yet.</p>}

        {characters.map((c) => {
          const isSelected = c.id === selectedId;
          const displayName = c.identity.name?.trim() || "Unnamed Character";

          return (
            <div key={c.id} style={{ display: "flex", gap: 6 }}>
              <button
                onClick={() => onSelect(c.id)}
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
                <strong style={{ display: "block", color: "#111827" }}>{displayName}</strong>
                <div style={{ fontSize: 12, color: "#4b5563", marginTop: 2 }}>
                  {getGenreName(c.genreId)} • {getClassName(c.classId)}
                </div>
              </button>

              <button onClick={() => onDelete(c.id)} style={dangerButtonStyle}>
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </aside>
  );
}