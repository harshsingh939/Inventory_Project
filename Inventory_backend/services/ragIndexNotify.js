'use strict';

/**
 * After inventory-related DB writes, ping the Python RAG service so Pinecone re-embeds
 * from GET /api/rag-export/snapshot (same RAG_INTERNAL_KEY + RAG_SERVICE_URL as /api/rag).
 *
 * Default: ON whenever RAG_INTERNAL_KEY is set (vectors follow MySQL).
 * Opt-out: RAG_AUTO_REINDEX=false
 */

function ragInternalKey() {
  return (process.env.RAG_INTERNAL_KEY || process.env.rag_internal_key || '').trim();
}

function shouldAutoReindex() {
  if (!ragInternalKey()) return false;

  const raw = process.env.RAG_AUTO_REINDEX;
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    return true;
  }
  const v = String(raw).trim().toLowerCase();
  if (v === '0' || v === 'false' || v === 'no' || v === 'off') return false;
  return true;
}

function notifyRagDebouncedReindex() {
  if (!shouldAutoReindex()) return;

  const key = ragInternalKey();
  const base = (process.env.RAG_SERVICE_URL || 'http://127.0.0.1:8787').replace(/\/+$/, '');
  const url = `${base}/internal/reindex-debounced`;

  fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Key': key,
    },
    body: '{}',
  })
    .then((res) => {
      if (!res.ok) {
        return res.text().then((t) => {
          console.warn('[RAG auto-reindex]', res.status, String(t).slice(0, 300));
        });
      }
      console.log('[RAG auto-reindex] scheduled (debounced) →', url);
    })
    .catch((err) => {
      console.warn('[RAG auto-reindex] fetch failed — is Python RAG running?', err && err.message);
    });
}

module.exports = { notifyRagDebouncedReindex, shouldAutoReindex };
