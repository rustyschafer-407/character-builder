import type { GuideStep } from "./guidance";

/**
 * All guide steps, ordered by priority (higher = shown sooner).
 * To add a new step: append a new entry here. No other file needs changing.
 *
 * HOW TARGET MATCHING WORKS
 * ─────────────────────────
 * Each step's `target` value must match a `data-guide="..."` attribute on a
 * real DOM element.  Example: target "create-character" matches any element
 * with data-guide="create-character" in the rendered tree.
 *
 * A step is only eligible if:
 *   • The element exists in the DOM
 *   • It is visible (no display:none / visibility:hidden / opacity:0 / zero-size)
 *   • It is not disabled
 *
 * If the element is present but offscreen (scrolled out of view), the overlay
 * will scroll it into view before positioning the hint card.
 *
 * Safe to add a data-guide attribute to an element that doesn't yet have a
 * matching step — the attribute is ignored until a step references it.
 */
export const ALL_GUIDE_STEPS: GuideStep[] = [
  // ── Player steps ───────────────────────────────────────────────────────────

  {
    id: "player-no-chars-create",
    target: "create-character",
    title: "Create your first character",
    body: "Start here. The wizard will walk you through the choices your GM has enabled for this campaign.",
    role: "player",
    condition: { hasCampaigns: true, hasNoCharactersInSelectedCampaign: true },
    priority: 100,
    placement: "bottom",
  },
  {
    id: "player-has-chars-view",
    target: "character-viewer",
    title: "Review your character",
    body: "Open your character sheet here to check attributes, skills, powers, attacks, and inventory.",
    role: "player",
    condition: { hasCharactersInSelectedCampaign: true },
    priority: 90,
    placement: "right",
  },
  {
    id: "player-export-roll20",
    target: "export-roll20",
    title: "Send your character to Roll20",
    body: "When your character is ready, copy the Roll20 export and paste it into Roll20 chat.",
    role: "player",
    condition: { hasCharactersInSelectedCampaign: true, hasSelectedCharacter: true },
    priority: 80,
    placement: "top",
  },
  {
    id: "player-display-settings",
    target: "display-settings",
    title: "Make it easier to read",
    body: "You can adjust display settings here if the default look is hard to read.",
    role: "player",
    priority: 10,
    placement: "bottom",
  },

  // ── GM steps ───────────────────────────────────────────────────────────────

  {
    id: "gm-no-campaigns-create",
    target: "create-campaign",
    title: "Create a campaign",
    body: "Campaigns hold the rules, options, classes, powers, and characters for your game.",
    role: "gm",
    condition: { hasNoCampaigns: true },
    priority: 100,
    placement: "bottom",
  },
  {
    id: "gm-campaign-settings",
    target: "campaign-settings",
    title: "Configure your campaign",
    body: "Set up attributes, skills, classes, powers, equipment, and level-up options before inviting players.",
    role: "gm",
    condition: { hasCampaigns: true },
    priority: 90,
    placement: "bottom",
  },
  {
    id: "gm-invite-users",
    target: "invite-users",
    title: "Invite your players",
    body: "Add users or copy an invite link so players can join the campaign.",
    role: "gm",
    condition: { hasCampaigns: true },
    priority: 80,
    placement: "bottom",
  },
  {
    id: "gm-campaign-characters",
    target: "campaign-characters",
    title: "Manage characters",
    body: "This is where you can review player characters and help troubleshoot their builds.",
    role: "gm",
    condition: { hasCampaigns: true },
    priority: 70,
    placement: "right",
  },
  {
    id: "gm-export-roll20",
    target: "export-roll20",
    title: "Export to Roll20",
    body: "Use this when you want to move a finished character into your Roll20 game.",
    role: "gm",
    condition: { hasCharacters: true },
    priority: 60,
    placement: "top",
  },

  // ── Admin steps (same as GM, with admin role) ──────────────────────────────

  {
    id: "admin-no-campaigns-create",
    target: "create-campaign",
    title: "Create a campaign",
    body: "Campaigns hold the rules, options, classes, powers, and characters for your game.",
    role: "admin",
    condition: { hasNoCampaigns: true },
    priority: 100,
    placement: "bottom",
  },
  {
    id: "admin-campaign-settings",
    target: "campaign-settings",
    title: "Configure your campaign",
    body: "Set up attributes, skills, classes, powers, equipment, and level-up options before inviting players.",
    role: "admin",
    condition: { hasCampaigns: true },
    priority: 90,
    placement: "bottom",
  },
  {
    id: "admin-invite-users",
    target: "invite-users",
    title: "Invite your players",
    body: "Add users or copy an invite link so players can join the campaign.",
    role: "admin",
    condition: { hasCampaigns: true },
    priority: 80,
    placement: "bottom",
  },
  {
    id: "admin-campaign-characters",
    target: "campaign-characters",
    title: "Manage characters",
    body: "This is where you can review player characters and help troubleshoot their builds.",
    role: "admin",
    condition: { hasCampaigns: true },
    priority: 70,
    placement: "right",
  },
];
