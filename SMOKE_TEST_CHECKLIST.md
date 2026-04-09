# Developer Smoke Test Checklist

Use this as a quick pass after feature work. Target: 10-15 minutes.

## 1) Create Campaign
- Open Admin.
- Create a new campaign with a unique name.
- Expected: campaign appears in campaign selector and remains selected.

## 2) Add Campaign Content
- In the same campaign, add:
  - 1 class
  - 2 skills
  - 2 powers
  - 2 items
  - 1 attack template
- Expected: each entry appears in its section immediately.

## 3) Create Character
- Start Character Creation Wizard in that campaign.
- Select the new class and complete wizard steps.
- Pick at least one skill, power, and item.
- Finish character creation.
- Expected: character appears in sidebar/list with correct campaign and class.

## 4) Level Up Character
- Open Level Up for the new character.
- Apply the next level.
- Expected: level increases by 1 and apply action completes without errors.

## 5) Verify Progression Effects
- Confirm expected changes from progression/class rules:
  - HP and hit dice updated
  - New skill/power choices applied (if configured)
  - Attribute increases applied (if configured)
- Expected: sheet values and character summary reflect these changes.

## 6) Export Roll20 Mod Command
- Open Roll20 export for the character.
- Generate/copy command output.
- Expected:
  - Output includes Phase 1 and Phase 2 flow
  - No empty/invalid repeating content for removed references
  - Command text is generated without runtime errors

## 7) Reload and Verify Persistence
- Refresh the app/browser tab.
- Re-open campaign and character.
- Expected: campaign data, character data, and level-up state persist.

## 8) Rename/Delete Content Gracefully
- Rename one campaign asset (for example, a skill or power) used by the character.
- Delete one different campaign asset that is referenced by older character data.
- Expected:
  - UI remains stable (no crash)
  - Character still loads
  - Invalid/removed references are handled gracefully in views/export

## Pass Criteria
- All expected outcomes pass.
- No console errors during the flow.
- No blocked wizard/level-up/export path unless intentionally invalid input is provided.
