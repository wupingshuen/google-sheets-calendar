# Sheet Calendar

A small **client-only** web app that builds a monthly calendar as **tab-separated (TSV) text** you can paste into **Google Sheets**. There is no login, no backend, and no Google APIs — only your browser.

## Project structure

```
Calendar/
├── index.html          # Main page
├── css/
│   └── styles.css      # Layout and preview styling
├── js/
│   ├── calendar.js     # Calendar math, TSV/HTML/text helpers (no DOM)
│   └── app.js          # Form, preview, clipboard
└── README.md
```

## How to run

This app uses **ES modules** (`import` / `export`). Opening `index.html` directly as a `file://` URL may not load modules in all browsers.

**Option A — Python 3**

```bash
cd /path/to/Calendar
python3 -m http.server 8080
```

Then open [http://localhost:8080](http://localhost:8080).

**Option B — Node**

```bash
cd /path/to/Calendar
npx --yes serve -p 8080
```

## Paste into Google Sheets

1. Choose month, year, and options in the left panel.
2. Click **Copy for Google Sheets (TSV)**.
3. In a sheet, select cell **A1** (or your target corner).
4. Paste (**⌘V** / **Ctrl+V**). Columns align to separate cells because the clipboard holds tab-separated text.

Use **TSV** output for Sheets (values only, formatting won’t carry over).

If you want a best-effort attempt to preserve the colored preview, use **Copy with colors (HTML)** and paste into Sheets. The HTML export uses a **fixed total width (~756px) and ~108px per column** (seven equal weekday columns; tweak `SHEETS_TABLE_TOTAL_WIDTH_PX` in `js/calendar.js` if you want a different size).

Sheets support for HTML-in-paste formatting varies, but this usually gives better results than TSV for colors.

## Options

| Control | Effect |
|--------|--------|
| Month / Year | Month to render |
| Week starts on | Sunday-first or Monday-first columns |
| Title text | Title row; leave blank for `Month Year` |
| Layout | **Month grid** — one row per week. **Event planning** — enables note rows under each week |
| Blank rows per week | When enabled, inserts N empty TSV rows after every week (for handwritten notes in the sheet) |
| Style weekends | When on, applies emoji or text markers for Sat/Sun |
| Weekend markers | None, emoji, or `(Sat)` / `(Sun)` labels |
| Calendar color | Changes the visual preview theme colors (TSV output is unchanged) |
| Goals section | **Goals**, **Tasks**, then optional extra topics (each with a heading + blank rows). In “Extra topics”, separate names with **`;`** for multiple sections (e.g. `Reminders; Habits`). Optional **banner** row on top |

## Extending

- **Calendar logic** lives in `js/calendar.js` (`buildCalendarModel`, `buildExportRows`, `rowsToTSV`).
- **UI** lives in `js/app.js`. Add new controls there and pass fields into `buildExportRows`.

## License

Use and modify freely for your own projects.
