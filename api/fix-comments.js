// api/fix-comments.js - 기존 봇 댓글을 존댓말로 일괄 변환 (일회성)

// ── auto-bot.js와 동일한 헬퍼 ──
function base64url(data) {
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlFromBuffer(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function importPrivateKey(pem) {
  const pemContents = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '');
  const binaryStr = atob(pemContents);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return await crypto.subtle.importKey(
    'pkcs8',
    bytes.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

async function getAccessToken() {
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (!clientEmail || !privateKey) throw new Error('Firebase credentials not configured');

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const unsignedToken = `${base64url(header)}.${base64url(payload)}`;
  const key = await importPrivateKey(privateKey);
  const signatureBuffer = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsignedToken)
  );
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

const PROJECT_ID = 'soktalk-3e359';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

function toFirestoreValue(val) {
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

async function callGPT(systemPrompt, userPrompt) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OpenAI API key not found');
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 300,
    }),
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const results = { fixed: 0, skipped: 0, errors: [] };

  try {
    const accessToken = await getAccessToken();

    // 1. 모든 게시글 가져오기
    const postsRes = await fetch(`${FIRESTORE_BASE}:runQuery`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'posts' }],
          orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }],
          limit: 500,
        },
      }),
    });
    const postsData = await postsRes.json();
    const posts = (postsData || []).filter(item => item.document).map(item => {
      const pathParts = item.document.name.split('/');
      return pathParts[pathParts.length - 1];
    });

    // 2. 각 게시글의 봇 댓글 찾아서 변환
    for (const postId of posts) {
      try {
        // 해당 글의 댓글 서브컬렉션 조회
        const commentsRes = await fetch(`${FIRESTORE_BASE}:runQuery`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            structuredQuery: {
              from: [{ collectionId: 'comments', allDescendants: true }],
              where: {
                fieldFilter: {
                  field: { fieldPath: 'userId' },
                  op: 'GREATER_THAN_OR_EQUAL',
                  value: { stringValue: 'bot_' },
                },
              },
              limit: 1000,
            },
          }),
        });
        const commentsData = await commentsRes.json();
        const botComments = (commentsData || [])
          .filter(item => item.document)
          .filter(item => {
            const userId = item.document.fields?.userId?.stringValue || '';
            return userId.startsWith('bot_');
          });

        for (const item of botComments) {
          const docPath = item.document.name.replace(
            `projects/${PROJECT_ID}/databases/(default)/documents/`,
            ''
          );
          const oldText = item.document.fields?.text?.stringValue || '';
          if (!oldText) { results.skipped++; continue; }

          // GPT로 존댓말 변환
          const newText = await callGPT(
            `너는 텍스트 말투 변환기야. 반말로 된 댓글을 존댓말(~요 체)로 자연스럽게 바꿔줘.
규칙:
- 10대 느낌은 유지하면서 존댓말로 변환
- 이모티콘, ㅋㅋ, ㅠㅠ 등은 그대로 유지
- 길이는 비슷하게 유지
- 이미 존댓말이면 그대로 출력
- 변환된 댓글 텍스트만 출력 (다른 설명 없이)`,
            oldText
          );

          if (!newText || newText === oldText) { results.skipped++; continue; }

          // Firestore 업데이트
          const fields = { text: toFirestoreValue(newText) };
          const updateRes = await fetch(
            `${FIRESTORE_BASE}/${docPath}?updateMask.fieldPaths=text`,
            {
              method: 'PATCH',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ fields }),
            }
          );

          if (updateRes.ok) {
            results.fixed++;
          } else {
            results.errors.push({ docPath, error: await updateRes.text() });
          }
        }
      } catch (err) {
        results.errors.push({ postId, error: err.message });
      }
    }

    // 중복 조회 방지를 위해 break (allDescendants로 한번에 가져옴)
    return res.status(200).json({
      success: true,
      summary: results,
      executedAt: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
