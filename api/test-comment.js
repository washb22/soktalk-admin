// api/test-comment.js - 최신 글 1개에 댓글 달기 테스트용

// auto-bot.js에서 공통 로직 재사용 위해 동일 코드 포함
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
async function getAccessToken() {
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (!clientEmail || !privateKey) throw new Error('Firebase credentials not configured');
  const now = Math.floor(Date.now() / 1000);
  const unsignedToken = `${base64url({ alg: 'RS256', typ: 'JWT' })}.${base64url({ iss: clientEmail, scope: 'https://www.googleapis.com/auth/datastore', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })}`;
  const key = await importPrivateKey(privateKey);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsignedToken));
  const jwt = `${unsignedToken}.${base64urlFromBuffer(sig)}`;
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}` });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) throw new Error(`Token error: ${JSON.stringify(tokenData)}`);
  return tokenData.access_token;
}

const PROJECT_ID = 'soktalk-3e359';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

function toFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'string') return { stringValue: val };
  if (typeof val === 'number') return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (val instanceof Date) return { timestampValue: val.toISOString() };
  if (Array.isArray(val)) return { arrayValue: { values: val.map(toFirestoreValue) } };
  return { stringValue: String(val) };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const accessToken = await getAccessToken();

    // 1. 최신 글 1개 가져오기
    const queryRes = await fetch(`${FIRESTORE_BASE}:runQuery`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ structuredQuery: {
        from: [{ collectionId: 'posts' }],
        orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }],
        limit: 1,
      }}),
    });
    const queryData = await queryRes.json();
    const doc = queryData[0]?.document;
    if (!doc) return res.status(404).json({ error: 'No posts found' });

    const postId = doc.name.split('/').pop();
    const title = doc.fields?.title?.stringValue || '';
    const content = doc.fields?.content?.stringValue || '';
    const category = doc.fields?.category?.stringValue || '연애상담';
    const currentCount = parseInt(doc.fields?.commentsCount?.integerValue || '0');

    // 2. Claude로 댓글 생성
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        temperature: 0.9,
        system: `너는 한국 10대(중학생~고등학생) 여자/남자야. "마음다락방"이라는 연애/일상 고민 앱에서 활동하는 일반 사용자야.
다른 10대의 고민 글을 읽고 공감하는 댓글을 달아줘.

[말투 규칙 - 존댓말 기반]
- 존댓말 기본 (~같아요, ~거든요, ~해봐요, ~인 것 같아요, ~하세요, ~좋을 것 같아요)
- 10대 느낌의 부드러운 존댓말 (~요 체)
- 맞춤법 가끔 틀려도 됨
- 줄임말/신조어 적당히 사용: ㄹㅇ, 진짜, 걍, 찐, 인정, 공감
- 이모티콘: ㅠㅠ, ㅜㅜ, ㅋㅋ, ㅋㅋㅋ, 😭, 🥺, !!
- 1~3문장으로 짧게

[절대 금지]
- "AI", "봇", "생성" 같은 단어
- 반말 사용 금지 (반드시 존댓말로)
- 너무 길게 쓰기 (4문장 이상 금지)`,
        messages: [{ role: 'user', content: `[${category}] "${title}"\n\n${content}\n\n위 글에 10대가 쓸법한 자연스러운 댓글 1개만. 댓글 내용만 출력해.` }],
      }),
    });
    const claudeData = await claudeRes.json();
    const commentText = claudeData.content?.[0]?.text?.trim() || '';

    if (!commentText) return res.status(500).json({ error: 'Failed to generate comment' });

    // 3. 댓글 추가
    const commentFields = {};
    for (const [k, v] of Object.entries({
      text: commentText,
      userId: `bot_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      userName: null,
      isAnonymous: true,
      createdAt: new Date(),
      likes: [],
      isPinned: false,
    })) {
      commentFields[k] = toFirestoreValue(v);
    }

    await fetch(`${FIRESTORE_BASE}/posts/${postId}/comments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: commentFields }),
    });

    // commentsCount 업데이트
    await fetch(`${FIRESTORE_BASE}/posts/${postId}?updateMask.fieldPaths=commentsCount`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { commentsCount: { integerValue: String(currentCount + 1) } } }),
    });

    return res.status(200).json({
      success: true,
      post: { id: postId, title },
      comment: commentText,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
