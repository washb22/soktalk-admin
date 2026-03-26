// api/_lib/shared.js - 공통 유틸 (인증, Firestore, Claude API)

// ── Base64URL 인코딩 ──
function base64url(data) {
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlFromBuffer(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function importPrivateKey(pem) {
  const pemContents = pem.replace(/-----BEGIN PRIVATE KEY-----/g, '').replace(/-----END PRIVATE KEY-----/g, '').replace(/\s/g, '');
  const binaryStr = atob(pemContents);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
  return await crypto.subtle.importKey('pkcs8', bytes.buffer, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
}

// ── Google OAuth2 토큰 발급 ──
export async function getAccessToken() {
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (!clientEmail || !privateKey) throw new Error('Firebase credentials not configured');

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = { iss: clientEmail, scope: 'https://www.googleapis.com/auth/datastore', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 };
  const unsignedToken = `${base64url(header)}.${base64url(payload)}`;
  const key = await importPrivateKey(privateKey);
  const signatureBuffer = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsignedToken));
  const jwt = `${unsignedToken}.${base64urlFromBuffer(signatureBuffer)}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) throw new Error(`Token error: ${JSON.stringify(tokenData)}`);
  return tokenData.access_token;
}

// ── Firestore REST API 헬퍼 ──
export const PROJECT_ID = 'soktalk-3e359';
export const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

export function toFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'string') return { stringValue: val };
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return { integerValue: String(val) };
    return { doubleValue: val };
  }
  if (typeof val === 'boolean') return { booleanValue: val };
  if (val instanceof Date) return { timestampValue: val.toISOString() };
  if (Array.isArray(val)) return { arrayValue: { values: val.map(toFirestoreValue) } };
  if (typeof val === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(val)) fields[k] = toFirestoreValue(v);
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

export function fromFirestoreValue(val) {
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return parseInt(val.integerValue);
  if ('doubleValue' in val) return val.doubleValue;
  if ('booleanValue' in val) return val.booleanValue;
  if ('nullValue' in val) return null;
  if ('timestampValue' in val) return new Date(val.timestampValue);
  if ('arrayValue' in val) return (val.arrayValue.values || []).map(fromFirestoreValue);
  if ('mapValue' in val) {
    const obj = {};
    for (const [k, v] of Object.entries(val.mapValue.fields || {})) obj[k] = fromFirestoreValue(v);
    return obj;
  }
  return null;
}

export function fromFirestoreDoc(doc) {
  const obj = {};
  for (const [k, v] of Object.entries(doc.fields || {})) obj[k] = fromFirestoreValue(v);
  const pathParts = doc.name.split('/');
  obj._id = pathParts[pathParts.length - 1];
  return obj;
}

export async function firestoreQuery(accessToken, structuredQuery) {
  const res = await fetch(`${FIRESTORE_BASE}:runQuery`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery }),
  });
  const data = await res.json();
  return (data || []).filter((item) => item.document).map((item) => fromFirestoreDoc(item.document));
}

export async function firestoreAdd(accessToken, collectionPath, data) {
  const fields = {};
  for (const [k, v] of Object.entries(data)) fields[k] = toFirestoreValue(v);
  const res = await fetch(`${FIRESTORE_BASE}/${collectionPath}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  return await res.json();
}

export async function firestoreUpdate(accessToken, docPath, data) {
  const fields = {};
  const updateMask = [];
  for (const [k, v] of Object.entries(data)) { fields[k] = toFirestoreValue(v); updateMask.push(k); }
  const params = updateMask.map((f) => `updateMask.fieldPaths=${f}`).join('&');
  const res = await fetch(`${FIRESTORE_BASE}/${docPath}?${params}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  return await res.json();
}

// ── 공통 유틸 ──
export function randomUserId() {
  return `bot_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

export async function callLLM(systemPrompt, userPrompt) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('Anthropic API key not found');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      temperature: 0.9,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });
  const data = await res.json();
  return data.content?.[0]?.text?.trim() || '';
}

export function authCheck(req) {
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const isAuthorized = cronSecret && authHeader === `Bearer ${cronSecret}`;
  return isVercelCron || isAuthorized;
}
