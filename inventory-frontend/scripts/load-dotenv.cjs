/**
 * Load inventory-frontend/.env into process.env (KEY=value, # comments).
 * Used before ng build / patch-api-origin on Rocky Linux — no dotenv package required.
 */
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');

function loadDotenv() {
  if (!fs.existsSync(envPath)) return false;
  let text = fs.readFileSync(envPath, 'utf8');
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  for (let line of text.split(/\r?\n/)) {
    line = line.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (key && process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
  return true;
}

module.exports = { loadDotenv, envPath };

if (require.main === module) {
  const ok = loadDotenv();
  console.log(ok ? `load-dotenv: loaded ${envPath}` : `load-dotenv: no file at ${envPath}`);
}
