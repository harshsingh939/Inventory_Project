/**
 * Same secret as inventory_rag RAG_INTERNAL_KEY / Node rag proxy.
 * Protects bulk export used only by the local RAG indexer.
 */
function requireRagInternalKey(req, res, next) {
  const expected = (process.env.RAG_INTERNAL_KEY || '').trim();
  if (!expected) {
    return res.status(503).json({ message: 'RAG_INTERNAL_KEY is not set on the API server.' });
  }
  const got = (req.headers['x-internal-key'] || '').trim();
  if (got !== expected) {
    return res.status(401).json({ message: 'Invalid or missing X-Internal-Key' });
  }
  next();
}

module.exports = { requireRagInternalKey };
