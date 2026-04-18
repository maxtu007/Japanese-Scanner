// Generates an Apple client secret JWT for Supabase
// Usage: node generate-apple-jwt.js /path/to/AuthKey_9X62AR4JFD.p8

import crypto from 'crypto';
import fs from 'fs';

const TEAM_ID = 'W5LGA4U6X7';
const KEY_ID = '9X62AR4JFD';
const CLIENT_ID = 'com.unblur.app';

const keyPath = process.argv[2] || `${process.env.HOME}/Downloads/AuthKey_9X62AR4JFD.p8`;

if (!fs.existsSync(keyPath)) {
  console.error(`Could not find .p8 file at: ${keyPath}`);
  console.error('Usage: node generate-apple-jwt.js /path/to/AuthKey_9X62AR4JFD.p8');
  process.exit(1);
}

const privateKey = fs.readFileSync(keyPath, 'utf8');
const now = Math.floor(Date.now() / 1000);
const exp = now + 15777000; // 6 months

function b64url(str) {
  return Buffer.from(str).toString('base64url');
}

const header = b64url(JSON.stringify({ alg: 'ES256', kid: KEY_ID }));
const payload = b64url(JSON.stringify({ iss: TEAM_ID, iat: now, exp, aud: 'https://appleid.apple.com', sub: CLIENT_ID }));
const signingInput = `${header}.${payload}`;

const sign = crypto.createSign('SHA256');
sign.update(signingInput);
const signature = sign.sign({ key: privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url');

const jwt = `${signingInput}.${signature}`;

console.log('\nYour Apple Client Secret JWT:\n');
console.log(jwt);
console.log('\nPaste this into the Supabase "Secret Key (for OAuth)" field.');
console.log('It expires in 6 months — re-run this script to regenerate.\n');
