/**
 * Pull simple hardware tokens from free-text (user_message) for softer matching
 * against assets.cpu / model / brand (not NLP).
 */

/**
 * @param {string|null|undefined} msg
 * @returns {string[]} lowercased tokens, e.g. ['i7'], ['ryzen 7']
 */
exports.extractHintsFromNote = (msg) => {
  if (msg == null || msg === '') return [];
  const s = String(msg);
  const lower = s.toLowerCase();
  const out = [];

  const intel = /\b(i3|i5|i7|i9)\b/gi;
  let m;
  while ((m = intel.exec(lower)) !== null) {
    const t = String(m[1]).toLowerCase();
    if (!out.includes(t)) out.push(t);
  }

  const ryzen = /\bryzen\s*[3579]\b/gi;
  while ((m = ryzen.exec(s)) !== null) {
    const t = String(m[0]).replace(/\s+/g, ' ').trim().toLowerCase();
    if (!out.includes(t)) out.push(t);
  }

  return out;
};
