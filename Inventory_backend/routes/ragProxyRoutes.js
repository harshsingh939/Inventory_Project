const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

function ragUrl() {
  return (process.env.RAG_SERVICE_URL || 'http://127.0.0.1:8787').replace(/\/+$/, '');
}

function ragInternalKey() {
  return (process.env.RAG_INTERNAL_KEY || process.env.rag_internal_key || '').trim();
}

function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin only' });
  }
  next();
}

function ragHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-Internal-Key': ragInternalKey(),
  };
}

async function forwardRag(method, path, body) {
  const url = `${ragUrl()}${path}`;
  const opts = { method, headers: ragHeaders() };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { message: text || 'Non-JSON response from RAG service' };
  }
  return { status: res.status, json };
}

/** Node fetch often throws AggregateError with message "fetch failed" on ECONNREFUSED. */
function explainRagForwardError(err) {
  const parts = [err];
  if (err && Array.isArray(err.errors)) parts.push(...err.errors);
  if (err && err.cause) parts.push(err.cause);
  let refused = false;
  for (const p of parts) {
    if (p && (p.code === 'ECONNREFUSED' || p.errno === -4078)) refused = true;
  }
  const base = err && err.message ? String(err.message) : 'RAG service unreachable';
  if (refused || /ECONNREFUSED/i.test(base)) {
    return {
      message: `Cannot connect to RAG service at ${ragUrl()} (nothing listening).`,
      hint:
        'Start Python RAG: cd inventory_rag && python -m uvicorn app.main:app --host 127.0.0.1 --port 8787',
    };
  }
  return { message: base, hint: null };
}

router.get('/status', authMiddleware, adminOnly, async (req, res) => {
  if (!ragInternalKey()) {
    return res.status(503).json({
      message:
        'RAG is not configured: set RAG_INTERNAL_KEY in inventory_rag/.env (or Inventory_backend/.env). Optional: RAG_SERVICE_URL (default http://127.0.0.1:8787). Restart Node after saving.',
    });
  }
  try {
    const { status, json } = await forwardRag('GET', '/internal/status');
    return res.status(status).json(json);
  } catch (e) {
    const { message, hint } = explainRagForwardError(e);
    return res.status(502).json({ message: hint ? `${message} ${hint}` : message });
  }
});

router.post('/reindex', authMiddleware, adminOnly, async (req, res) => {
  if (!ragInternalKey()) {
    return res.status(503).json({
      message:
        'RAG_INTERNAL_KEY missing: add it to inventory_rag/.env and restart Node (same value as Python RAG service).',
    });
  }
  try {
    const { status, json } = await forwardRag('POST', '/internal/reindex', {});
    return res.status(status).json(json);
  } catch (e) {
    const { message, hint } = explainRagForwardError(e);
    return res.status(502).json({ message: hint ? `${message} ${hint}` : message });
  }
});

router.post('/chat', authMiddleware, async (req, res) => {
  if (!ragInternalKey()) {
    return res.status(503).json({
      message:
        'RAG_INTERNAL_KEY missing: add it to inventory_rag/.env and restart Node (same value as Python RAG service).',
    });
  }
  const question = req.body && (req.body.question || req.body.q);
  if (!question || !String(question).trim()) {
    return res.status(400).json({ message: 'question is required' });
  }
  try {
    const { status, json } = await forwardRag('POST', '/internal/chat', {
      question: String(question).trim(),
    });
    return res.status(status).json(json);
  } catch (e) {
    const { message, hint } = explainRagForwardError(e);
    return res.status(502).json({ message: hint ? `${message} ${hint}` : message });
  }
});

module.exports = router;
