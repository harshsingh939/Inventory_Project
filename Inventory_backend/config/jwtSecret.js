/**
 * Single source for signing/verifying auth JWTs and short-lived email action tokens.
 * Set JWT_SECRET in production; default matches legacy dev installs.
 */
module.exports = function getJwtSecret() {
  const fromEnv = (process.env.JWT_SECRET || process.env.AUTH_JWT_SECRET || '').trim();
  return fromEnv || 'inventrack_secret_key_2024';
};
