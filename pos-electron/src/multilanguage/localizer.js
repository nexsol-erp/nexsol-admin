// Multi-language printing helpers (optional module). Pure: no fetching, no React.
// Kept identical in src/multilanguage and pos-electron/src/multilanguage; a test checks they match.
//
// localizer(pack) takes the server's /multi-language/print-pack answer. When the module is off
// (no pack, or enabled: false) every helper hands back exactly what it was given, so print
// templates produce byte-for-byte the output they always did.

const escHtml = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const OFF_LOCALIZER = Object.freeze({
  on: false,
  mode: "ENGLISH_ONLY",
  lang: "en",
  dir: "ltr",
  localOnly: false,
  css: "",
  // Plain text, for React.
  text: () => null,
  itemText: () => null,
  branchText: () => null,
  // HTML strings, for string templates.
  label: (key, enHtml) => enHtml,
  stack: (key, enHtml) => enHtml,
  item: (enHtml) => enHtml,
  branch: (enHtml) => enHtml,
});

export const OFF = Object.freeze({ enabled: false });

export function localizer(pack) {
  if (!pack || pack.enabled !== true || !pack.language) return OFF_LOCALIZER;
  const lang = pack.language;
  const dir = pack.direction === "rtl" ? "rtl" : "ltr";
  const localOnly = pack.invoiceLanguage === "LOCAL_ONLY";
  const en = (pack.labels && pack.labels.en) || {};
  const local = (pack.labels && pack.labels.local) || {};
  const items = pack.items || {};
  const byName = pack.itemsByName || {};
  const branchName = (pack.branch && pack.branch.name) || (pack.company && (pack.company.displayName || pack.company.legalName)) || null;

  const span = (t) => `<span class="ml-l" lang="${escHtml(lang)}" dir="${dir}">${escHtml(t)}</span>`;
  const div = (t) => `<div class="ml-l" lang="${escHtml(lang)}" dir="${dir}">${escHtml(t)}</div>`;

  // A label in the second language, or null when there is none (or it reads the same as English).
  const text = (key) => {
    const t = local[key];
    return t && t !== en[key] ? t : null;
  };
  const itemText = (name, id) => (id != null && items[id]) || (name != null && byName[name]) || null;

  return Object.freeze({
    on: true,
    mode: pack.invoiceLanguage,
    lang,
    dir,
    localOnly,
    css: `.ml-l{font-family:"Noto Naskh Arabic","Noto Sans Arabic","Noto Sans","Segoe UI",Tahoma,Arial,sans-serif;unicode-bidi:isolate}`,
    text,
    itemText,
    branchText: () => branchName,
    // "رقم الفاتورة / Invoice No" on one line; only the second language when printing it alone.
    label: (key, enHtml) => {
      const t = text(key);
      if (!t) return enHtml;
      return localOnly ? span(t) : `${span(t)} / ${enHtml}`;
    },
    // The second language above English, for narrow column headings.
    stack: (key, enHtml) => {
      const t = text(key);
      if (!t) return enHtml;
      return localOnly ? span(t) : `${span(t)}<br/>${enHtml}`;
    },
    // An item's approved name above its English name; English alone when none is stored.
    item: (enHtml, name, id) => {
      const t = itemText(name, id);
      if (!t) return enHtml;
      return localOnly ? span(t) : `${div(t)}${enHtml}`;
    },
    branch: (enHtml) => {
      if (!branchName) return enHtml;
      return localOnly ? span(branchName) : `${div(branchName)}${enHtml}`;
    },
  });
}
