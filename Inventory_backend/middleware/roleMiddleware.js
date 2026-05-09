/** Use after authMiddleware — req.user = { id, email, role } */

function normalizeRole(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function requireRole(...allowed) {
  const allowedNormalized = allowed.map((a) => normalizeRole(a));
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    const r = normalizeRole(req.user.role);
    const ok = allowedNormalized.includes(r);
    if (!ok) {
      return res.status(403).json({ message: 'Insufficient role' });
    }
    next();
  };
}

exports.requireAdmin = requireRole('admin');
exports.requireAdminOrAuthority = requireRole('admin', 'repair_authority', 'repair authority', 'vendor');
exports.requireAuthority = requireRole('repair_authority');
