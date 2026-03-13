# Changelog System

## Overview

The changelog is a bottom-left floating button that opens a popup panel listing what has been added or changed in the game over time. It uses the same liquid-glass visual language as the rest of the UI.

## Files

| File | Purpose |
|------|---------|
| `lib/changelogData.ts` | Typed data — array of `ChangelogEntry` objects, newest first |
| `components/ChangelogWidget.tsx` | React component — floating button + popup panel |
| `__tests__/ChangelogWidget.test.tsx` | Jest/RTL tests |

## Data structure

```ts
interface ChangelogEntry {
  date: string;    // YYYY-MM-DD
  title: string;   // short group title in Czech
  items: string[]; // bullet points in Czech, one per change
}
```

All entries live in `CHANGELOG` (exported from `changelogData.ts`) and are ordered **newest first**.

## How to add a new entry

1. Open `lib/changelogData.ts`.
2. Insert a new object at the **top** of the `CHANGELOG` array.
3. Use today's date, a short Czech title, and one-line Czech items.

```ts
{
  date: "2026-04-01",
  title: "Název skupiny změn",
  items: [
    "Přidána nová funkce X",
    "Opravena chyba Y",
  ],
},
```

> **This is mandatory.** The CLAUDE.md rule requires every user-visible change to be logged here.

## Component behaviour

- A round green button is fixed at `bottom-5 left-5` (z-index 100).
- Clicking it toggles a popup panel that opens just above the button (`bottom-20 left-5`).
- The panel is scrollable and shows all entries with date, title, and items.
- The close button inside the panel and the toggle button both close the popup.
- `aria-expanded` and `role="dialog"` attributes are set for accessibility.
