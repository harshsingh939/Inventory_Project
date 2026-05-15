/**
 * PM2 on Rocky Linux — run after: npm ci && ./scripts/build-for-deploy.sh
 *
 *   pm2 start ecosystem.config.cjs
 *   pm2 save && pm2 startup
 */
const path = require('path');
const { loadDotenv } = require('./scripts/load-dotenv.cjs');

loadDotenv();

const port = Number(process.env.PORT) || 4000;
const appRoot = __dirname;
const serverScript = path.join(
  appRoot,
  'dist',
  'inventory-frontend',
  'server',
  'server.mjs',
);

module.exports = {
  apps: [
    {
      name: 'inventrack-frontend',
      cwd: appRoot,
      script: serverScript,
      interpreter: 'node',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: port,
      },
    },
  ],
};
