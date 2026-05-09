/**
 * Repo-root Vercel Function entry for a single-project deploy.
 * Routes `/api` to the existing Express app in `Inventory_backend`.
 */
const app = require('../Inventory_backend/server');

module.exports = app;
