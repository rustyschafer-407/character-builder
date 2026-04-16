import { useState } from "react";
import { buttonStyle, panelStyle, primaryButtonStyle } from "./uiStyles";

interface Roll20ExportPanelProps {
  characterName: string;
  combinedCommand: string;
  phase1Command: string;
  phase2Command: string;
  modPayload: string;
}

export default function Roll20ExportPanel({
  characterName,
  combinedCommand,
  phase1Command,
  phase2Command,
  modPayload,
}: Roll20ExportPanelProps) {
  const [previewOpen, setPreviewOpen] = useState(false);

  async function copyChatSetAttr() {
    try {
      await navigator.clipboard.writeText(combinedCommand);
      alert("Roll20 import commands copied. Paste Attributes & Core first, then Repeating Lists.");
    } catch {
      alert("Could not copy to clipboard on this device/browser.");
    }
  }

  async function copyChatSetAttrPhase1() {
    try {
      await navigator.clipboard.writeText(phase1Command);
      alert("Roll20 Attributes & Core command copied to clipboard.");
    } catch {
      alert("Could not copy to clipboard on this device/browser.");
    }
  }

  async function copyChatSetAttrPhase2() {
    try {
      await navigator.clipboard.writeText(phase2Command);
      alert("Roll20 Repeating Lists commands copied to clipboard.");
    } catch {
      alert("Could not copy to clipboard on this device/browser.");
    }
  }

  async function copyModPayload() {
    try {
      await navigator.clipboard.writeText(modPayload);
      alert("Roll20 Mod command copied. Paste directly into Roll20 chat.");
    } catch {
      alert("Could not copy to clipboard on this device/browser.");
    }
  }

  async function copyCurrentPreview() {
    try {
      await navigator.clipboard.writeText(combinedCommand);
      alert("Command copied to clipboard.");
    } catch {
      alert("Could not copy to clipboard on this device/browser.");
    }
  }

  return (
    <>
      <section style={panelStyle}>
        <h3 style={{ marginTop: 0, color: "var(--text-primary)" }}>Roll20 Import</h3>
        <p style={{ marginTop: 0, color: "var(--text-secondary)", marginBottom: 12 }}>
          Requires the{" "}
          <a
            href="https://github.com/Roll20/roll20-api-scripts/tree/master/ChatSetAttr"
            target="_blank"
            rel="noreferrer"
            style={{ color: "#2563eb" }}
          >
            ChatSetAttr
          </a>{" "}
          API script (Roll20 Pro). Use <strong>Copy Mod Command</strong> for a single paste into your custom Roll20 Mod import command, or keep ChatSetAttr as fallback by selecting your character's token and pasting <strong>Attributes & Core</strong> then <strong>Repeating Lists</strong>.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={copyModPayload} style={primaryButtonStyle}>
            Copy Mod Command
          </button>
          <button onClick={copyChatSetAttrPhase1} style={buttonStyle}>
            Copy Attributes & Core
          </button>
          <button onClick={copyChatSetAttrPhase2} style={buttonStyle}>
            Copy Repeating Lists
          </button>
          <button onClick={copyChatSetAttr} style={primaryButtonStyle}>
            Copy Both Commands
          </button>
          <button onClick={() => setPreviewOpen(true)} style={buttonStyle}>
            Preview Command
          </button>
        </div>
      </section>

      {previewOpen && (
        <div
          onClick={() => setPreviewOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(17, 24, 39, 0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(1000px, 100%)",
              maxHeight: "90vh",
              overflow: "auto",
              background: "linear-gradient(165deg, var(--surface-2), var(--surface-1))",
              borderRadius: 14,
              border: "1px solid var(--border-soft)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
              padding: 20,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                marginBottom: 16,
                flexWrap: "wrap",
              }}
            >
              <div>
                <h2 style={{ margin: 0, color: "var(--text-primary)" }}>Roll20 Import Commands</h2>
                <div style={{ color: "var(--text-secondary)", marginTop: 4 }}>
                  {characterName || "Unnamed Character"} — paste Attributes & Core, then Repeating Lists
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={copyCurrentPreview} style={buttonStyle}>
                  Copy
                </button>
                <button onClick={() => setPreviewOpen(false)} style={buttonStyle}>
                  Close
                </button>
              </div>
            </div>
            <textarea
              readOnly
              value={combinedCommand}
              style={{
                width: "100%",
                minHeight: 300,
                borderRadius: 10,
                border: "1px solid var(--border-soft)",
                padding: 14,
                fontFamily:
                  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
                fontSize: 13,
                lineHeight: 1.5,
                color: "var(--text-primary)",
                background: "rgba(7, 14, 29, 0.84)",
                resize: "vertical",
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
