/**
 * UI wiring: reads form state, calls calendar logic, updates preview and clipboard.
 */

import {
  MONTH_NAMES,
  buildExportRows,
  modelToHtmlTable,
  modelToHtmlTableInline,
  rowsToPlainText,
  rowsToTSV,
} from './calendar.js';

const $ = (id) => document.getElementById(id);

function readOptions() {
  const monthIndex = Number($('field-month').value);
  const year = Number($('field-year').value);
  const weekStart = $('field-week-start').value === 'monday' ? 'monday' : 'sunday';
  const titleText = $('field-title').value;
  const layout = $('field-layout').value === 'event' ? 'event' : 'grid';
  const notesEnabled = $('field-notes-row').checked;
  const notesRowsPerWeekRaw = Number($('field-notes-count').value);
  const notesRowsPerWeek = notesEnabled
    ? Math.max(0, Math.min(10, Number.isFinite(notesRowsPerWeekRaw) ? notesRowsPerWeekRaw : 0))
    : 0;
  const includeWeekendStyling = $('field-weekend-style').checked;
  const weekendMarkers = /** @type {'none' | 'emoji' | 'label'} */ ($('field-weekend-markers').value);
  const includeGoalsSection = $('field-goals').checked;
  const goalsOtherLabel = $('field-goals-label-other').value;
  const goalsBlankRowsPerTopic = Number($('field-goals-blank-rows').value);
  const themeColor = ($('field-theme-color')?.value || '').trim();

  return {
    monthIndex,
    year,
    weekStart,
    titleText,
    layout,
    notesRowsPerWeek,
    includeWeekendStyling,
    weekendMarkers,
    includeGoalsSection,
    goalsOtherLabel,
    goalsBlankRowsPerTopic,
    themeColor,
  };
}

function validateYear(y) {
  return Number.isInteger(y) && y >= 1900 && y <= 2100;
}

function render() {
  syncLayoutControls();
  syncWeekendControls();
  syncGoalsControls();
  syncNotesControls();

  const o = readOptions();
  if (!validateYear(o.year)) {
    $('status-line').textContent = 'Enter a year between 1900 and 2100.';
    return;
  }

  const calOpts = {
    weekStart: o.weekStart,
    titleText: o.titleText,
    weekendMarkers: o.weekendMarkers,
    includeWeekendStyling: o.includeWeekendStyling,
    layout: o.layout,
    notesRowsPerWeek: o.notesRowsPerWeek,
    includeGoalsSection: o.includeGoalsSection,
    goalsOtherLabel: o.goalsOtherLabel,
    goalsBlankRowsPerTopic: o.goalsBlankRowsPerTopic,
  };

  const { model, rows } = buildExportRows(o.year, o.monthIndex, calOpts);

  const notesForPreviewCount = o.layout === 'event' ? o.notesRowsPerWeek : 0;
  const goalsConfig = o.includeGoalsSection
    ? {
        otherLabel: o.goalsOtherLabel,
        blankRowsPerTopic: o.goalsBlankRowsPerTopic,
      }
    : null;

  const html = modelToHtmlTable(model, {
    notesRowsCount: notesForPreviewCount,
    goalsConfig,
    themeColor: o.themeColor,
  });

  $('preview-html').innerHTML = html;
  $('output-tsv').textContent = rowsToTSV(rows);
  $('output-plain').textContent = rowsToPlainText(rows);

  $('status-line').textContent = `${MONTH_NAMES[o.monthIndex]} ${o.year} — ${rows.length} rows (TSV).`;
}

async function copyTsv() {
  const text = $('output-tsv').textContent || '';
  try {
    await navigator.clipboard.writeText(text);
    $('status-line').textContent = 'Copied tab-separated text for Google Sheets.';
  } catch {
    $('status-line').textContent = 'Clipboard failed — select TSV manually.';
  }
}

async function copyHtmlWithColors() {
  const o = readOptions();
  if (!validateYear(o.year)) {
    $('status-line').textContent = 'Fix the year input first.';
    return;
  }

  const calOpts = {
    weekStart: o.weekStart,
    titleText: o.titleText,
    weekendMarkers: o.weekendMarkers,
    includeWeekendStyling: o.includeWeekendStyling,
    layout: o.layout,
    notesRowsPerWeek: o.notesRowsPerWeek,
    includeGoalsSection: o.includeGoalsSection,
    goalsOtherLabel: o.goalsOtherLabel,
    goalsBlankRowsPerTopic: o.goalsBlankRowsPerTopic,
  };

  const { model, rows } = buildExportRows(o.year, o.monthIndex, calOpts);
  const notesForExportCount = o.layout === 'event' ? o.notesRowsPerWeek : 0;
  const goalsConfig = o.includeGoalsSection
    ? {
        otherLabel: o.goalsOtherLabel,
        blankRowsPerTopic: o.goalsBlankRowsPerTopic,
      }
    : null;

  const html = modelToHtmlTableInline(model, {
    notesRowsCount: notesForExportCount,
    goalsConfig,
    themeColor: o.themeColor,
  });

  const tsvFallback = rowsToTSV(rows);
  try {
    // Use both types so paste can pick formatting when supported.
    const item = new ClipboardItem({
      'text/html': html,
      'text/plain': tsvFallback,
    });
    await navigator.clipboard.write([item]);
    $('status-line').textContent = 'Copied HTML (with colors). Paste into Sheets.';
  } catch {
    $('status-line').textContent = 'HTML clipboard failed — TSV is still available below.';
  }
}

function initDefaults() {
  const now = new Date();
  $('field-month').value = String(now.getMonth());
  $('field-year').value = String(now.getFullYear() + 1);
  $('field-week-start').value = 'monday';
  $('field-layout').value = 'event';
  $('field-notes-row').checked = true;
}

function syncLayoutControls() {
  const isEvent = $('field-layout').value === 'event';
  $('field-notes-row').disabled = !isEvent;
  if (!isEvent) {
    $('field-notes-row').checked = false;
    $('field-notes-count').disabled = true;
  }
}

function syncWeekendControls() {
  const on = $('field-weekend-style').checked;
  $('field-weekend-markers').disabled = !on;
}

function syncNotesControls() {
  const isEvent = $('field-layout').value === 'event';
  // Keep the number input editable in event mode; we will only export notes rows
  // when the checkbox is enabled.
  $('field-notes-count').disabled = !isEvent;
}

function syncGoalsControls() {
  const on = $('field-goals').checked;
  for (const id of ['field-goals-label-other', 'field-goals-blank-rows']) {
    $(id).disabled = !on;
  }
}

function wireTabs() {
  const tabs = document.querySelectorAll('.tab');
  const panels = {
    tsv: $('panel-tsv'),
    plain: $('panel-plain'),
  };
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const name = tab.getAttribute('data-tab');
      tabs.forEach((t) => {
        const active = t.getAttribute('data-tab') === name;
        t.classList.toggle('active', active);
        t.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      Object.entries(panels).forEach(([key, el]) => {
        const show = key === name;
        el.classList.toggle('hidden', !show);
        el.hidden = !show;
      });
    });
  });
}

function wire() {
  const ids = [
    'field-month',
    'field-year',
    'field-week-start',
    'field-title',
    'field-layout',
    'field-notes-row',
    'field-notes-count',
    'field-weekend-style',
    'field-weekend-markers',
    'field-goals',
    'field-goals-label-other',
    'field-goals-blank-rows',
    'field-theme-color',
  ];
  for (const id of ids) {
    const el = $(id);
    if (!el) continue;
    el.addEventListener('input', render);
    el.addEventListener('change', render);
  }

  $('btn-copy-tsv').addEventListener('click', copyTsv);
  $('btn-copy-html').addEventListener('click', copyHtmlWithColors);

  wireTabs();
}

initDefaults();
wire();
render();
