/** Use after authMiddleware — req.user = { id, email, role } */

function requireRole(...allowed) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    const r = String(req.user.role || '').toLowerCase();
    const ok = allowed.some((a) => String(a).toLowerCase() === r);
    if (!ok) {
      return res.status(403).json({ message: 'Insufficient role' });
    }
    next();
  };
}

exports.requireAdmin = requireRole('admin');
exports.requireAdminOrAuthority = requireRole('admin', 'repair_authority');
exports.requireAuthority = requireRole('repair_authority');
