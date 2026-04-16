# Roll20 Sheet

This folder contains source files for the Roll20 character sheet.

Files:
- sheet.html: Roll20 sheet markup placeholder.
- sheet.css: Roll20 sheet style placeholder.
- character-builder-import-mod.js: Roll20 API script for importing one payload via `!cb-import`.

Replace these placeholders with your real Roll20 sheet implementation.

## Character Builder Import Mod

Use `character-builder-import-mod.js` in your Roll20 API scripts to import a full character from one payload.

### Install

1. Open your Roll20 game where API scripts are enabled.
2. Go to API Scripts.
3. Create a new script and paste the contents of `character-builder-import-mod.js`.
4. Save and ensure the API sandbox reports the script as ready.

### Import Command

Paste the command in Roll20 chat:

```text
!cb-import b64:<base64-payload-from-app>
```

The app's **Copy Mod Command** button now produces this `b64:` format automatically.
Legacy raw JSON after `!cb-import` is still supported, but `b64:` is preferred because it avoids Roll20 chat interpolation issues.

Notes:
- The importer finds or creates the character by `character.name`.
- It upserts non-repeating attributes directly as Roll20 attribute objects.
- It sets HP fields explicitly, including `hp` current/max.
- It replaces repeating `skills`, `attacks`, `powers`, and `inventory` using stable `rowId` values from the payload.
