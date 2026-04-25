export type CbTheme =
  | "scifi"
  | "arcane"
  | "tavern"
  | "neon"
  | "terminal"
  | "paper"
  | "slate"
  | "dragonfire"
  | "feywild";

export type CbTextSize = "normal" | "large";
export type CbDensity = "comfortable" | "compact";

export interface DisplayPreferences {
  theme: CbTheme;
  textSize: CbTextSize;
  density: CbDensity;
}

export const DISPLAY_PREFS_DEFAULTS: DisplayPreferences = {
  theme: "scifi",
  textSize: "normal",
  density: "comfortable",
};

export const THEME_OPTIONS: Array<{ value: CbTheme; label: string }> = [
  { value: "scifi", label: "Sci-Fi" },
  { value: "arcane", label: "Arcane" },
  { value: "tavern", label: "Tavern" },
  { value: "neon", label: "Neon" },
  { value: "terminal", label: "Terminal" },
  { value: "paper", label: "Paper" },
  { value: "slate", label: "Slate" },
  { value: "dragonfire", label: "Dragonfire" },
  { value: "feywild", label: "Feywild" },
];

export const TEXT_SIZE_OPTIONS: Array<{ value: CbTextSize; label: string }> = [
  { value: "normal", label: "Normal" },
  { value: "large", label: "Large" },
];

export const DENSITY_OPTIONS: Array<{ value: CbDensity; label: string }> = [
  { value: "comfortable", label: "Comfortable" },
  { value: "compact", label: "Compact" },
];

const STORAGE_KEYS = {
  theme: "cb.theme",
  textSize: "cb.textSize",
  density: "cb.density",
} as const;

function isTheme(value: string): value is CbTheme {
  return THEME_OPTIONS.some((option) => option.value === value);
}

function isTextSize(value: string): value is CbTextSize {
  return TEXT_SIZE_OPTIONS.some((option) => option.value === value);
}

function isDensity(value: string): value is CbDensity {
  return DENSITY_OPTIONS.some((option) => option.value === value);
}

export function readDisplayPreferences(): DisplayPreferences {
  if (typeof window === "undefined") return DISPLAY_PREFS_DEFAULTS;

  try {
    const rawTheme = window.localStorage.getItem(STORAGE_KEYS.theme) ?? "";
    const rawTextSize = window.localStorage.getItem(STORAGE_KEYS.textSize) ?? "";
    const rawDensity = window.localStorage.getItem(STORAGE_KEYS.density) ?? "";

    return {
      theme: isTheme(rawTheme) ? rawTheme : DISPLAY_PREFS_DEFAULTS.theme,
      textSize: isTextSize(rawTextSize) ? rawTextSize : DISPLAY_PREFS_DEFAULTS.textSize,
      density: isDensity(rawDensity) ? rawDensity : DISPLAY_PREFS_DEFAULTS.density,
    };
  } catch {
    return DISPLAY_PREFS_DEFAULTS;
  }
}

export function applyDisplayPreferences(preferences: DisplayPreferences) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  root.dataset.cbTheme = preferences.theme;
  root.dataset.cbTextSize = preferences.textSize;
  root.dataset.cbDensity = preferences.density;
}

export function persistDisplayPreferences(preferences: DisplayPreferences) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORAGE_KEYS.theme, preferences.theme);
    window.localStorage.setItem(STORAGE_KEYS.textSize, preferences.textSize);
    window.localStorage.setItem(STORAGE_KEYS.density, preferences.density);
  } catch {
    // Ignore storage errors so the UI still works in restricted environments.
  }
}
