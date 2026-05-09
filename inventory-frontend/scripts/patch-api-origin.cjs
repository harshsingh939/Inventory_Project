/**
 * After `ng build`, inject BACKEND_ORIGIN into dist/index.html meta tag.
 * Set in Vercel (Frontend project): Environment variable BACKEND_ORIGIN = https://your-api.vercel.app
 * No trailing slash.
 */
const fs = require('fs');
const path = require('path');

const indexPath = path.join(
  __dirname,
  '..',
  'dist',
  'inventory-frontend',
  'browser',
  'index.html',
);

const origin = (process.env.BACKEND_ORIGIN || '').trim().replace(/"/g, '');

if (!fs.existsSync(indexPath)) {
  console.warn('patch-api-origin: skip —', indexPath, 'not found');
  process.exit(0);
}

let html = fs.readFileSync(indexPath, 'utf8');
if (!html.includes('name="api-origin"')) {
  console.warn('patch-api-origin: meta name=api-origin not in index.html');
  process.exit(0);
}

html = html.replace(
  /<meta name="api-origin" content="[^"]*"/,
  `<meta name="api-origin" content="${origin}"`,
);

fs.writeFileSync(indexPath, html);
console.log(
  'patch-api-origin:',
  origin ? `BACKEND_ORIGIN → ${origin}` : 'BACKEND_ORIGIN empty (browser uses relative /api)',
);
