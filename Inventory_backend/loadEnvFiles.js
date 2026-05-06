/**
 * Loads env from inventory_rag/.env then Inventory_backend/.env (later overrides).
 * Works even if `dotenv` is not installed (manual KEY=value parse).
 */
const fs = require('fs');
const path = require('path');

function applyEnvFile(absPath) {
  if (!fs.existsSync(absPath)) return;
  let text = fs.readFileSync(absPath, 'utf8');
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  for (let line of text.split(/\r?\n/)) {
    line = line.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    let key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (!key) continue;
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    val = val.trim();
    if (key === 'rag_internal_key') key = 'RAG_INTERNAL_KEY';
    process.env[key] = val;
  }
}

function candidateRagEnvPaths() {
  const out = [];
  out.push(path.join(__dirname, '..', 'inventory_rag', '.env'));
  out.push(path.join(process.cwd(), 'inventory_rag', '.env'));
  if (path.basename(process.cwd()) === 'Inventory_backend') {
    out.push(path.join(process.cwd(), '..', 'inventory_rag', '.env'));
  }
  return [...new Set(out.map((p) => path.resolve(p)))];
}

const localEnvPath = path.resolve(path.join(__dirname, '.env'));
const ragPaths = candidateRagEnvPaths();

/** Create inventory_rag/.env from .env.example so Node + Python can share one file. */
function ensureRagEnvFromExample() {
  const ragDir = path.resolve(path.join(__dirname, '..', 'inventory_rag'));
  const ragEnv = path.join(ragDir, '.env');
  const ragEx = path.join(ragDir, '.env.example');
  if (fs.existsSync(ragEnv) || !fs.existsSync(ragEx)) return;
  try {
    fs.copyFileSync(ragEx, ragEnv);
    console.warn('[RAG] Created', ragEnv, 'from .env.example — review and add real API keys if needed.');
  } catch (e) {
    console.warn('[RAG] Could not create inventory_rag/.env:', e.message);
  }
}

ensureRagEnvFromExample();

try {
  const dotenv = require('dotenv');
  for (const p of ragPaths) {
    dotenv.config({ path: p });
  }
  dotenv.config({ path: localEnvPath });
} catch (e) {
  console.warn('[env] dotenv optional load failed (run npm install if missing):', e.message);
}

for (const p of ragPaths) {
  applyEnvFile(p);
}
applyEnvFile(localEnvPath);

const ragKey = (process.env.RAG_INTERNAL_KEY || process.env.rag_internal_key || '').trim();
if (ragKey) {
  console.log('[RAG] RAG_INTERNAL_KEY loaded for /api/rag proxy.');
  const ar = String(process.env.RAG_AUTO_REINDEX || '').trim().toLowerCase();
  const autoOff = ar === '0' || ar === 'false' || ar === 'no' || ar === 'off';
  if (autoOff) {
    console.log('[RAG] RAG_AUTO_REINDEX is off — Pinecone will not refresh after DB writes (manual Reindex only).');
  } else {
    console.log(
      '[RAG] Writes will ping Python for debounced reindex (unset RAG_AUTO_REINDEX = on). Set RAG_AUTO_REINDEX=false to disable.',
    );
  }
} else {
  console.warn('[RAG] RAG_INTERNAL_KEY missing — /api/rag will return 503 until you fix this.');
  console.warn('    File must be named exactly .env (not .env.example). Checked paths:');
  for (const p of ragPaths) {
    console.warn('   ', p, fs.existsSync(p) ? 'exists' : 'missing');
  }
  console.warn('   ', localEnvPath, fs.existsSync(localEnvPath) ? 'exists' : 'missing');
  console.warn('    Add a line: RAG_INTERNAL_KEY=your-secret (same as Python service), then restart Node.');
}
