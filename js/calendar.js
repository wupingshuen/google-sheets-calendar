/**
 * Calendar generation for spreadsheet paste (TSV/HTML/text).
 * No network calls — pure logic for use in the browser.
 */

/** @typedef {'sunday' | 'monday'} WeekStart */

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Short labels for header row (Sunday-first order). */
export const WEEKDAYS_SUNDAY_FIRST = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Short labels for header row (Monday-first order). */
export const WEEKDAYS_MONDAY_FIRST = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Fixed layout for “Copy with colors (HTML)” so Google Sheets keeps 7 columns narrow
 * (percentage widths often expand to full sheet width).
 */
/** 756 = 504 × 1.5 — wider block for Google Sheets paste while keeping 7 equal columns */
const SHEETS_TABLE_TOTAL_WIDTH_PX = 756;
const SHEETS_COLUMN_WIDTH_PX = Math.floor(SHEETS_TABLE_TOTAL_WIDTH_PX / 7);

/**
 * @returns {string} colgroup with explicit px widths for Sheets + preview
 */
function colgroupSevenColumnsPx() {
  const w = SHEETS_COLUMN_WIDTH_PX;
  return `<colgroup>${Array.from({ length: 7 }, () => `<col width="${w}" style="width:${w}px;min-width:${w}px;max-width:${w}px">`).join('')}</colgroup>\n`;
}

/**
 * @param {number} year
 * @param {number} monthIndex 0–11
 */
export function getDaysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/**
 * JavaScript Sunday=0 … Saturday=6.
 * @param {number} year
 * @param {number} monthIndex 0–11
 * @returns {number} 0–6 (Sun–Sat)
 */
export function getJsWeekdayOfFirstOfMonth(year, monthIndex) {
  return new Date(year, monthIndex, 1).getDay();
}

/**
 * Map JS weekday to column index (0–6) for the grid.
 * @param {number} jsWeekday 0–6
 * @param {WeekStart} weekStart
 */
export function columnIndexForFirstDay(jsWeekday, weekStart) {
  if (weekStart === 'sunday') return jsWeekday;
  return (jsWeekday + 6) % 7; // Monday-first
}

/**
 * @param {number} day 1–31
 * @param {number} jsWeekday 0–6 for that calendar day (Sun=0 … Sat=6)
 */
export function isWeekendCell(day, jsWeekday) {
  return jsWeekday === 0 || jsWeekday === 6;
}

/**
 * @param {number} day
 * @param {number} jsWeekday
 * @param {{ weekendMarkers: 'none' | 'emoji' | 'label', includeWeekendStyling: boolean }} opts
 */
export function formatDayCell(day, jsWeekday, opts) {
  const { weekendMarkers, includeWeekendStyling } = opts;
  let s = String(day);
  if (!includeWeekendStyling || weekendMarkers === 'none') return s;

  if (weekendMarkers === 'emoji') {
    if (jsWeekday === 0) return `${s} ☀️`;
    if (jsWeekday === 6) return `${s} 🌙`;
    return s;
  }
  if (weekendMarkers === 'label') {
    if (jsWeekday === 0) return `${s} (Sun)`;
    if (jsWeekday === 6) return `${s} (Sat)`;
    return s;
  }
  return s;
}

/**
 * @typedef {{ day: number | null, jsWeekday: number | null, text: string, isWeekend: boolean }} CalendarCell
 */

/**
 * Core model: title + header + week rows of typed cells (for preview + string export).
 * @param {number} year
 * @param {number} monthIndex 0–11
 * @param {{
 *   weekStart: WeekStart,
 *   titleText: string,
 *   weekendMarkers: 'none' | 'emoji' | 'label',
 *   includeWeekendStyling: boolean,
 * }} options
 * @returns {{ title: string, header: CalendarCell[], weeks: CalendarCell[][] }}
 */
export function buildCalendarModel(year, monthIndex, options) {
  const { weekStart, titleText, weekendMarkers, includeWeekendStyling } = options;
  const headers = weekStart === 'sunday' ? [...WEEKDAYS_SUNDAY_FIRST] : [...WEEKDAYS_MONDAY_FIRST];

  const title = titleText.trim() || `${MONTH_NAMES[monthIndex]} ${year}`;

  const header = headers.map((h, i) => {
    const jsWd = weekStart === 'sunday' ? i : (i + 1) % 7;
    const isWk = jsWd === 0 || jsWd === 6;
    return { day: null, jsWeekday: jsWd, text: h, isWeekend: includeWeekendStyling && isWk };
  });

  const daysInMonth = getDaysInMonth(year, monthIndex);
  const startCol = columnIndexForFirstDay(getJsWeekdayOfFirstOfMonth(year, monthIndex), weekStart);

  const weeks = [];
  let current = /** @type {CalendarCell[]} */ ([]);
  for (let i = 0; i < startCol; i++) {
    current.push({ day: null, jsWeekday: null, text: '', isWeekend: false });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const jsWd = new Date(year, monthIndex, day).getDay();
    const text = formatDayCell(day, jsWd, { weekendMarkers, includeWeekendStyling });
    const isWk = isWeekendCell(day, jsWd);
    current.push({ day, jsWeekday: jsWd, text, isWeekend: includeWeekendStyling && isWk });
    if (current.length === 7) {
      weeks.push(current);
      current = [];
    }
  }
  if (current.length) {
    while (current.length < 7) {
      current.push({ day: null, jsWeekday: null, text: '', isWeekend: false });
    }
    weeks.push(current);
  }

  return { title, header, weeks };
}

/**
 * Convert model to plain string rows for TSV.
 * @param {{ title: string, header: CalendarCell[], weeks: CalendarCell[][] }} model
 */
export function modelToStringRows(model) {
  const titleRow = Array(7).fill('');
  titleRow[0] = model.title;
  const headerRow = model.header.map((c) => c.text);
  const weekRows = model.weeks.map((w) => w.map((c) => c.text));
  return [titleRow, headerRow, ...weekRows];
}

/**
 * Build one month grid: title row, weekday header, week rows (each 7 cells).
 * @param {number} year
 * @param {number} monthIndex 0–11
 * @param {{
 *   weekStart: WeekStart,
 *   titleText: string,
 *   weekendMarkers: 'none' | 'emoji' | 'label',
 *   includeWeekendStyling: boolean,
 * }} options
 * @returns {string[][]} rows of 7 string cells
 */
export function buildMonthGridRows(year, monthIndex, options) {
  return modelToStringRows(buildCalendarModel(year, monthIndex, options));
}

/**
 * Insert an empty notes row after each calendar week (not after title/header).
 * @param {string[][]} rows from buildMonthGridRows
 * @returns {string[][]}
 */
export function interleaveNotesRowsAfterWeeks(rows, notesRowsPerWeek = 1) {
  if (rows.length < 3 || notesRowsPerWeek <= 0) return rows;
  const out = [rows[0], rows[1]];
  const weekRows = rows.slice(2);
  for (const w of weekRows) {
    out.push(w);
    for (let i = 0; i < notesRowsPerWeek; i++) {
      out.push(Array(7).fill(''));
    }
  }
  return out;
}

/**
 * @typedef {{
 *   otherLabel?: string,
 *   blankRowsPerTopic?: number,
 * }} GoalsConfig
 */

/**
 * Split the topics field into multiple section titles (`Reminders; Habits` → two sections).
 * @param {string} s
 * @returns {string[]}
 */
export function parseSemicolonTopics(s) {
  return String(s || '')
    .split(';')
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
}

/**
 * Normalize goals UI options for export + preview.
 * Only headings from `otherLabel` (`;`-separated); empty string → no rows / no HTML block.
 * @param {GoalsConfig} raw
 */
export function normalizeGoalsConfig(raw) {
  const blankRowsPerTopic = Math.max(1, Math.min(8, Number(raw.blankRowsPerTopic) || 3));
  const otherTopics = parseSemicolonTopics(raw.otherLabel);
  return { otherTopics, blankRowsPerTopic };
}

/**
 * TSV rows for user-defined topic headings (7 columns). Leading spacer separates from calendar.
 * @param {GoalsConfig} raw
 * @returns {string[][]}
 */
export function buildGoalsStructuredRows(raw) {
  const c = normalizeGoalsConfig(raw);
  if (c.otherTopics.length === 0) return [];

  const headerRow = (text) => {
    const r = Array(7).fill('');
    r[0] = text;
    return r;
  };
  const blank = () => Array(7).fill('');
  const out = [blank()];

  const addTopic = (label) => {
    out.push(headerRow(label));
    for (let i = 0; i < c.blankRowsPerTopic; i++) out.push(blank());
  };

  for (const label of c.otherTopics) addTopic(label);

  return out;
}

/**
 * @typedef {'grid' | 'event'} LayoutMode
 */

/**
 * Build string rows for export (TSV) and companion model for preview.
 * @param {number} year
 * @param {number} monthIndex 0–11
 * @param {{
 *   weekStart: WeekStart,
 *   titleText: string,
 *   weekendMarkers: 'none' | 'emoji' | 'label',
 *   includeWeekendStyling: boolean,
 *   layout: LayoutMode,
 *   notesRowsPerWeek: number,
 *   includeGoalsSection: boolean,
 *   goalsOtherLabel?: string,
 *   goalsBlankRowsPerTopic?: number,
 * }} options
 */
export function buildExportRows(year, monthIndex, options) {
  const model = buildCalendarModel(year, monthIndex, options);
  let rows = modelToStringRows(model);
  if (options.layout === 'event' && (options.notesRowsPerWeek || 0) > 0) {
    rows = interleaveNotesRowsAfterWeeks(rows, options.notesRowsPerWeek || 0);
  }
  if (options.includeGoalsSection) {
    rows = [
      ...rows,
      ...buildGoalsStructuredRows({
        otherLabel: options.goalsOtherLabel,
        blankRowsPerTopic: options.goalsBlankRowsPerTopic,
      }),
    ];
  }
  return { model, rows };
}

/**
 * @param {string[][]} rows
 */
export function rowsToTSV(rows) {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const s = cell == null ? '' : String(cell);
          return s.replace(/\t/g, ' ').replace(/\r?\n/g, ' ');
        })
        .join('\t'),
    )
    .join('\n');
}

/**
 * Escape HTML entities for text content.
 * @param {string} s
 */
export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function parseHexColor(hex) {
  let s = String(hex).trim();
  if (!s) return null;
  if (s[0] !== '#') s = `#${s}`;
  if (!/^#[0-9a-fA-F]{6}$/.test(s)) return null;
  const n = Number.parseInt(s.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return { r, g, b };
}

function rgbToHex({ r, g, b }) {
  const to2 = (x) => x.toString(16).padStart(2, '0');
  return `#${to2(r)}${to2(g)}${to2(b)}`;
}

function mixRgb(a, b, t) {
  const tt = Math.max(0, Math.min(1, t));
  return {
    r: Math.round(a.r + (b.r - a.r) * tt),
    g: Math.round(a.g + (b.g - a.g) * tt),
    b: Math.round(a.b + (b.b - a.b) * tt),
  };
}

function lighten(hex, t) {
  const c = parseHexColor(hex);
  if (!c) return null;
  return rgbToHex(mixRgb(c, { r: 255, g: 255, b: 255 }, t));
}

function darken(hex, t) {
  const c = parseHexColor(hex);
  if (!c) return null;
  return rgbToHex(mixRgb(c, { r: 0, g: 0, b: 0 }, t));
}

/**
 * Generic HTML table from string rows (e.g. exported TSV rows). Row 1 = weekday header cells.
 * @param {string[][]} rows
 */
export function rowsToHtmlTable(rows) {
  let html = '<table class="cal-preview-table">\n';
  rows.forEach((row, ri) => {
    html += '  <tr>\n';
    row.forEach((cell) => {
      const isHeader = ri === 1;
      const tag = isHeader ? 'th' : 'td';
      html += `    <${tag}>${escapeHtml(cell)}</${tag}>\n`;
    });
    html += '  </tr>\n';
  });
  html += '</table>';
  return html;
}

/**
 * Topics block (separate table). One block per heading in `otherLabel` (`;`-separated).
 * @param {GoalsConfig | null | undefined} goalsConfig
 */
function buildGoalsSectionHtml(goalsConfig) {
  if (!goalsConfig) return '';
  const c = normalizeGoalsConfig(goalsConfig);
  if (c.otherTopics.length === 0) return '';
  let h = '<div class="cal-goals-wrap">\n';
  h += '<table class="cal-goals-section-table" cellspacing="0" cellpadding="0">\n';
  h += `  ${colgroupSevenColumnsPx()}`;
  h += '  <tbody>\n';
  let topicIndex = 0;
  const addTopic = (label) => {
    const divider = topicIndex > 0 ? ' cal-goals-topic-divider' : '';
    const bandCls =
      topicIndex % 2 === 0 ? ' cal-goals-topic-head--band-a' : ' cal-goals-topic-head--band-b';
    topicIndex++;
    h += `  <tr><td colspan="7" class="cal-goals-topic-head${bandCls}${divider}">${escapeHtml(label)}</td></tr>\n`;
    for (let i = 0; i < c.blankRowsPerTopic; i++) {
      h += '  <tr class="cal-goals-data-row">\n';
      for (let col = 0; col < 7; col++) {
        h += '    <td class="cal-goals-body-cell">&nbsp;</td>\n';
      }
      h += '  </tr>\n';
    }
  };
  for (const label of c.otherTopics) addTopic(label);
  h += '  </tbody>\n</table>\n</div>\n';
  return h;
}

/**
 * @param {{ title: string, header: CalendarCell[], weeks: CalendarCell[][] }} model
 * @param {{ notesRowsCount?: number, goalsConfig?: GoalsConfig | null, themeColor?: string }} extra
 */
export function modelToHtmlTable(model, extra = {}) {
  const { notesRowsCount = 0, goalsConfig = null, themeColor = '' } = extra;

  // Theme vars on wrapper so outer border + both tables share colors; calendar table has no inner borders.
  const base = parseHexColor(themeColor);
  const wrapStyleAttr = base
    ? (() => {
        const titleBg = lighten(themeColor, 0.35);
        const headerBg = darken(themeColor, 0.05) || themeColor;
        const bandA = lighten(themeColor, 0.65);
        const bandB = lighten(themeColor, 0.55);
        const frame = darken(themeColor, 0.45);
        const weekendHeader = darken(themeColor, 0.18) || frame;
        const weekendDate = lighten(weekendHeader, 0.48) || lighten(themeColor, 0.42);
        const values = [
          `--cal-frame:${frame}`,
          `--cal-title-bg:${titleBg}`,
          `--cal-header-bg:${headerBg}`,
          `--cal-weekband-a:${bandA}`,
          `--cal-weekband-b:${bandB}`,
          `--cal-weekend-header-bg:${weekendHeader}`,
          `--cal-weekend-date-bg:${weekendDate}`,
        ].join(';');
        return ` style="${values}"`;
      })()
    : '';

  let html = `<div class="cal-preview-wrap"${wrapStyleAttr}>\n`;
  html += '<table class="cal-preview-table cal-calendar-only" cellspacing="0" cellpadding="0">\n';
  html += `  ${colgroupSevenColumnsPx()}`;
  html += `  <tr><td class="cal-title" colspan="7">${escapeHtml(model.title)}</td></tr>\n`;
  html += '  <tr>\n';
  for (const c of model.header) {
    const cls = c.isWeekend ? 'cal-weekend-header' : '';
    html += `    <th scope="col" class="${cls}">${escapeHtml(c.text)}</th>\n`;
  }
  html += '  </tr>\n';

  for (let wi = 0; wi < model.weeks.length; wi++) {
    const week = model.weeks[wi];
    const band = wi % 2 === 0 ? 'cal-band-a' : 'cal-band-b';
    html += `  <tr class="cal-week-row ${band}">\n`;
    for (const c of week) {
      const classes = [];
      if (c.day == null) classes.push('cal-empty');
      if (c.day != null && c.isWeekend) classes.push('cal-weekend-date');
      const cls = classes.join(' ');
      html += `    <td${cls ? ` class="${cls}"` : ''}>${escapeHtml(c.text)}</td>\n`;
    }
    html += '  </tr>\n';
    for (let nr = 0; nr < notesRowsCount; nr++) {
      html += `  <tr class="cal-notes-row ${band}">\n`;
      for (let i = 0; i < 7; i++) {
        html += '    <td class="cal-notes-cell">&nbsp;</td>\n';
      }
      html += '  </tr>\n';
    }
  }

  html += '</table>\n';
  html += buildGoalsSectionHtml(goalsConfig);
  html += '</div>';
  return html;
}

/**
 * HTML table with inline styles (best-effort for clipboard paste into Sheets).
 * This is separate from TSV export: TSV never carries formatting.
 * @param {{ title: string, header: CalendarCell[], weeks: CalendarCell[][] }} model
 * @param {{ notesRowsCount?: number, goalsConfig?: GoalsConfig | null, themeColor?: string }} extra
 */
export function modelToHtmlTableInline(model, extra = {}) {
  const {
    notesRowsCount = 0,
    goalsConfig = null,
    themeColor = '#2f7aa7',
  } = extra;

  // If themeColor is invalid, fall back to defaults from CSS.
  const base = parseHexColor(themeColor) || parseHexColor('#2f7aa7');
  const titleBg = lighten(rgbToHex(base), 0.35) || '#6fa9c9';
  const headerBg = darken(rgbToHex(base), 0.05) || '#2f7aa7';
  const bandA = lighten(rgbToHex(base), 0.65) || '#a7dff0';
  const bandB = lighten(rgbToHex(base), 0.55) || '#86d1e9';
  const frame = darken(rgbToHex(base), 0.45) || '#184457';
  const weekendHeader = darken(rgbToHex(base), 0.18) || frame;
  const weekendDate =
    lighten(weekendHeader, 0.48) || lighten(rgbToHex(base), 0.42) || '#b9dde8';

  const colgroup = colgroupSevenColumnsPx();
  const tw = SHEETS_TABLE_TOTAL_WIDTH_PX;

  const cellBase =
    'padding:2px 3px;vertical-align:middle;border:0;box-sizing:border-box;overflow:hidden;';
  const dayFont = 'font-size:18px;';
  const titleFont = 'font-size:24px;line-height:1.2;';
  const notesFont = 'font-size:12px;';
  const goalsFont = 'font-size:12px;';

  // Outer border only; fixed total width so pasted columns stay ~108px each (7 cols).
  let html = `<div style="border:2px solid ${frame};width:${tw}px;max-width:100%;box-sizing:border-box;font-family:Arial,sans-serif;">\n`;

  html += `<table cellpadding="0" cellspacing="0" width="${tw}" style="border-collapse:collapse;border:0;width:${tw}px;max-width:100%;table-layout:fixed;">\n`;
  html += colgroup;
  html += `  <tr><td colspan="7" bgcolor="${titleBg}" style="background-color:${titleBg};color:#fff;font-weight:700;text-align:center;${cellBase}${titleFont}">${escapeHtml(model.title)}</td></tr>\n`;

  html += '  <tr>\n';
  for (const c of model.header) {
    const bg = c.isWeekend ? weekendHeader : headerBg;
    html += `    <th bgcolor="${bg}" style="background-color:${bg};color:#fff;font-weight:800;text-align:center;${cellBase}${dayFont}">${escapeHtml(c.text)}</th>\n`;
  }
  html += '  </tr>\n';

  for (let wi = 0; wi < model.weeks.length; wi++) {
    const week = model.weeks[wi];
    const bandBg = wi % 2 === 0 ? bandA : bandB;
    html += `  <tr>\n`;
    for (const c of week) {
      const bg = c.day == null ? 'transparent' : c.isWeekend ? weekendDate : bandBg;
      const color = c.day == null ? '' : '#0f172a';
      const text = escapeHtml(c.text);
      const weight = c.isWeekend && c.day != null ? 800 : 700;
      const safeBgColor = bg === 'transparent' ? '' : bg;
      const bgcolorAttr = safeBgColor ? ` bgcolor="${safeBgColor}"` : '';
      html += `    <td${bgcolorAttr} style="background-color:${bg};color:${color};font-weight:${weight};text-align:center;${cellBase}${dayFont}">${text}</td>\n`;
    }
    html += '  </tr>\n';

    for (let nr = 0; nr < notesRowsCount; nr++) {
      html += `  <tr>\n`;
      for (let i = 0; i < 7; i++) {
        html += `    <td bgcolor="#ffffff" style="background-color:#ffffff;${cellBase}${notesFont}min-height:24px;">&nbsp;</td>\n`;
      }
      html += '  </tr>\n';
    }
  }

  html += '</table>\n';

  if (goalsConfig) {
    const gc = normalizeGoalsConfig(goalsConfig);
    if (gc.otherTopics.length > 0) {
      // Solid fill + HTML bgcolor — Google Sheets often drops CSS gradients on paste.
      const topicHeadStyle = (fillHex) =>
        `text-align:left;font-weight:800;letter-spacing:0.05em;text-transform:uppercase;${goalsFont}color:#0f172a;background-color:${fillHex};border-left:4px solid ${headerBg};`;

      html += `<div style="padding:8px 6px 10px;box-sizing:border-box;width:${tw}px;max-width:100%;background:linear-gradient(180deg,rgba(15,23,42,0.06),transparent 55%);">\n`;
      html += `<table cellpadding="0" cellspacing="0" width="${tw}" style="border-collapse:separate;border-spacing:0;border:0;width:${tw}px;max-width:100%;table-layout:fixed;border-radius:10px;overflow:hidden;box-shadow:0 4px 14px rgba(15,23,42,0.08);">\n`;
      html += colgroup;
      let topicIndex = 0;
      const addTopicInline = (label) => {
        const fillHex = topicIndex % 2 === 0 ? bandA : bandB;
        const top =
          topicIndex > 0
            ? 'border-top:1px solid #cbd5e1;padding:10px 10px 8px 10px;'
            : 'padding:8px 10px;';
        topicIndex++;
        html += `  <tr><td colspan="7" bgcolor="${fillHex}" style="${top}${topicHeadStyle(fillHex)}">${escapeHtml(label)}</td></tr>\n`;
        for (let i = 0; i < gc.blankRowsPerTopic; i++) {
          html += '  <tr>\n';
          for (let col = 0; col < 7; col++) {
            html += `    <td bgcolor="#ffffff" style="background-color:#ffffff;color:#0f172a;${cellBase}${goalsFont}">&nbsp;</td>\n`;
          }
          html += '  </tr>\n';
        }
      };
      for (const label of gc.otherTopics) addTopicInline(label);
      html += '</table>\n</div>\n';
    }
  }

  html += '</div>';
  return html;
}

/**
 * Plain text preview (fixed-ish width using tabs).
 * @param {string[][]} rows
 */
export function rowsToPlainText(rows) {
  return rowsToTSV(rows).replace(/\t/g, '    ');
}
