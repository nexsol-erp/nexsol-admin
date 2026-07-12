'use strict';

// Minimal .env loader — reads test-agent/.env if it exists.
// No dependency on dotenv package.

const fs   = require('fs');
const path = require('path');

const envFile = path.join(__dirname, '.env');
if (!fs.existsSync(envFile)) return;

for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eq = trimmed.indexOf('=');
  if (eq < 1) continue;
  const key = trimmed.slice(0, eq).trim();
  const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
  if (!(key in process.env)) process.env[key] = val;
}
