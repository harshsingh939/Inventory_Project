/**
 * Fulfillment matching for assignment requests where asset_types includes "Other".
 * Supports multiple items in user_message (comma / newline / "and") and avoids
 * assigning unrelated stock (no single-token OR fallback across the whole note).
 */

const STOP = new Set([
  'need',
  'wants',
  'want',
  'the',
  'and',
  'for',
  'one',
  'two',
  'any',
  'some',
  'pls',
  'please',
  'a',
  'an',
  'to',
  'of',
  'in',
  'i',
  'we',
  'me',
  'my',
  'you',
  'with',
  'from',
  'this',
  'that',
  'sir',
  'kindly',
  'urgent',
  'okay',
  'ok',
  'yes',
  'no',
  'hi',
  'new',
  'also',
  'qty',
  'quantity',
]);

function sanitizeLike(s) {
  return String(s).replace(/[%_\\]/g, '').trim();
}

/**
 * Split free text into separate requested items (peripherals list).
 * @param {string} raw
 * @returns {string[]}
 */
function parseOtherNoteSegments(raw) {
  const msg = String(raw || '').trim();
  if (!msg) return [];
  const chunks = msg
    .split(/\s*(?:,|;|\/|\n|\r+|(?:\s+and\s+))\s*/gi)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2);
  const seen = new Set();
  const out = [];
  for (const p of chunks) {
    const k = p.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(p);
    if (out.length >= 12) break;
  }
  return out.length ? out : [msg];
}

function meaningfulTokens(segment) {
  const rawTokens = String(segment || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const tokens = [
    ...new Set(rawTokens.filter((w) => w.length >= 2 && !STOP.has(w))),
  ];
  tokens.sort((a, b) => b.length - a.length);
  return tokens.slice(0, 6);
}

function haystackExpr() {
  return `LOWER(CONCAT_WS(' ', IFNULL(a.asset_type,''), IFNULL(a.brand,''), IFNULL(a.model,''), IFNULL(a.serial_number,''), IFNULL(a.cpu,'')))`;
}

function excludePlaceholders(ex) {
  const list = ex && ex.length ? ex.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0) : [];
  return list.length ? list : [-1];
}

/**
 * @param {*} dbConn
 * @param {string} segment
 * @param {number[]} excludeIds
 * @param {(err: Error|null, id: number|null, loose: boolean) => void} cb
 */
function pickOneAssetForSegment(dbConn, segment, excludeIds, cb) {
  const seg = String(segment || '').trim();
  if (!seg) return cb(null, null, false);

  const ex = excludePlaceholders(excludeIds);
  const phEx = ex.map(() => '?').join(', ');
  const hay = haystackExpr();
  const baseFrom = `
    FROM assets a
    LEFT JOIN assignments x ON x.asset_id = a.id AND x.status = 'Active'
    WHERE x.id IS NULL
    AND COALESCE(LOWER(TRIM(a.status)), 'available') NOT IN ('assigned', 'under repair', 'disposed')
    AND a.id NOT IN (${phEx})
  `;
  const tail = `ORDER BY (a.inventory_id IS NULL) DESC, a.id ASC`;

  const tokens = meaningfulTokens(seg);
  const lump = sanitizeLike(seg).toLowerCase();
  const lumpPat = lump.length >= 2 ? `%${lump.replace(/\s+/g, '%')}%` : null;

  const runWhereOne = (whereSql, params, loose, onEmpty) => {
    const sql = `SELECT a.id ${baseFrom} AND (${whereSql}) ${tail} LIMIT 1`;
    dbConn.query(sql, [...ex, ...params], (e, rows) => {
      if (e) return cb(e);
      if (rows?.length) return cb(null, rows[0].id, loose);
      onEmpty();
    });
  };

  const tryPhrase = (onFail) => {
    if (!lumpPat) return onFail();
    runWhereOne(`${hay} LIKE ?`, [lumpPat], false, onFail);
  };

  const tryAndAll = (onFail) => {
    if (!tokens.length) return tryPhrase(onFail);
    const parts = tokens.map(() => `${hay} LIKE ?`);
    const vals = tokens.map((t) => `%${sanitizeLike(t)}%`);
    const whereSql = parts.join(' AND ');
    runWhereOne(whereSql, vals, false, onFail);
  };

  const tryScoredOr = (onFail) => {
    if (tokens.length < 2) return onFail();
    const parts = tokens.map(() => `${hay} LIKE ?`);
    const vals = tokens.map((t) => `%${sanitizeLike(t)}%`);
    const sql = `SELECT a.id, ${hay} AS _hay ${baseFrom} AND (${parts.join(' OR ')}) ${tail} LIMIT 40`;
    dbConn.query(sql, [...ex, ...vals], (e, rows) => {
      if (e) return cb(e);
      if (!rows?.length) return onFail();
      const threshold =
        tokens.length <= 2 ? tokens.length : Math.max(2, Math.ceil(tokens.length * 0.66));
      let bestId = null;
      let bestScore = 0;
      for (const row of rows) {
        const h = String(row._hay || '');
        let sc = 0;
        for (const t of tokens) {
          if (h.includes(t)) sc += 1;
        }
        if (sc > bestScore) {
          bestScore = sc;
          bestId = row.id;
        }
      }
      if (bestId != null && bestScore >= threshold) {
        return cb(null, bestId, true);
      }
      onFail();
    });
  };

  const trySingleToken = (onFail) => {
    if (tokens.length !== 1) return onFail();
    const t = tokens[0];
    runWhereOne(`${hay} LIKE ?`, [`%${sanitizeLike(t)}%`], false, onFail);
  };

  tryAndAll(() => {
    tryScoredOr(() => {
      trySingleToken(() => {
        tryPhrase(() => cb(null, null, false));
      });
    });
  });
}

/**
 * Resolve one asset per line item in the user's "Other" note.
 * @param {*} dbConn
 * @param {string} userMessage
 * @param {number[]} excludeIds
 * @param {(err: Error|null, result: { assetIds: number[], usedLooseMatch: boolean, error?: string }) => void} cb
 */
function pickAssetIdsForOtherNote(dbConn, userMessage, excludeIds, cb) {
  const msg = String(userMessage || '').trim();
  if (!msg) {
    return cb(null, { assetIds: [], usedLooseMatch: false, error: 'Empty note for Other request' });
  }

  const segments = parseOtherNoteSegments(msg);
  const assetIds = [];
  let usedLooseMatch = false;
  let ex = [...(excludeIds || [])].map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0);

  const step = (i) => {
    if (i >= segments.length) {
      return cb(null, { assetIds, usedLooseMatch });
    }
    pickOneAssetForSegment(dbConn, segments[i], ex, (err, id, loose) => {
      if (err) return cb(err);
      if (!id) {
        return cb(null, {
          assetIds: [],
          usedLooseMatch: false,
          error: `No available stock matched "${segments[i]}" from your note. Add matching inventory, use clearer names (e.g. "HDMI cable", "mouse"), or fulfill manually.`,
        });
      }
      assetIds.push(id);
      if (loose) usedLooseMatch = true;
      ex = [...ex, id];
      step(i + 1);
    });
  };

  step(0);
}

module.exports = {
  parseOtherNoteSegments,
  meaningfulTokens,
  pickAssetIdsForOtherNote,
};
