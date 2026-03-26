// api/auto-bot.js - 자동 댓글 & 글 작성 봇
// Vercel Cron으로 하루 1회 실행
// firebase-admin 대신 Firestore REST API 직접 사용 (의존성 제로)

// ── Base64URL 인코딩 ──
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

// PEM → CryptoKey 변환
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

// ── Google OAuth2 토큰 발급 (서비스 계정) ──
async function getAccessToken() {
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

  if (!clientEmail || !privateKey) {
    throw new Error('Firebase credentials not configured');
  }

  // JWT 생성
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

  // JWT로 액세스 토큰 교환
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    throw new Error(`Token error: ${JSON.stringify(tokenData)}`);
  }
  return tokenData.access_token;
}

// ── Firestore REST API 헬퍼 ──
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
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(toFirestoreValue) } };
  }
  if (typeof val === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(val)) {
      fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function fromFirestoreValue(val) {
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return parseInt(val.integerValue);
  if ('doubleValue' in val) return val.doubleValue;
  if ('booleanValue' in val) return val.booleanValue;
  if ('nullValue' in val) return null;
  if ('timestampValue' in val) return new Date(val.timestampValue);
  if ('arrayValue' in val) return (val.arrayValue.values || []).map(fromFirestoreValue);
  if ('mapValue' in val) {
    const obj = {};
    for (const [k, v] of Object.entries(val.mapValue.fields || {})) {
      obj[k] = fromFirestoreValue(v);
    }
    return obj;
  }
  return null;
}

function fromFirestoreDoc(doc) {
  const obj = {};
  for (const [k, v] of Object.entries(doc.fields || {})) {
    obj[k] = fromFirestoreValue(v);
  }
  // 문서 ID 추출
  const pathParts = doc.name.split('/');
  obj._id = pathParts[pathParts.length - 1];
  return obj;
}

async function firestoreQuery(accessToken, structuredQuery) {
  const res = await fetch(`${FIRESTORE_BASE}:runQuery`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ structuredQuery }),
  });
  const data = await res.json();
  return (data || [])
    .filter((item) => item.document)
    .map((item) => fromFirestoreDoc(item.document));
}

async function firestoreAdd(accessToken, collectionPath, data) {
  const fields = {};
  for (const [k, v] of Object.entries(data)) {
    fields[k] = toFirestoreValue(v);
  }
  const res = await fetch(`${FIRESTORE_BASE}/${collectionPath}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  });
  return await res.json();
}

async function firestoreUpdate(accessToken, docPath, data) {
  const fields = {};
  const updateMask = [];
  for (const [k, v] of Object.entries(data)) {
    fields[k] = toFirestoreValue(v);
    updateMask.push(k);
  }
  const params = updateMask.map((f) => `updateMask.fieldPaths=${f}`).join('&');
  const res = await fetch(`${FIRESTORE_BASE}/${docPath}?${params}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  });
  return await res.json();
}

// ── 랜덤 닉네임 생성 ──
const adjectives = [
  '행복한', '슬픈', '외로운', '설레는', '두근거리는', '걱정되는',
  '기대되는', '불안한', '떨리는', '애틋한', '용감한', '수줍은',
  '따뜻한', '쿨한', '솔직한', '귀여운', '당당한', '센치한',
];
const nouns = [
  '사랑꾼', '짝사랑러', '연애초보', '솔로', '썸남', '썸녀',
  '고민러', '연인', '짝꿍', '몽상가', '힐러', '감성러',
  '직진러', '밀당러', '순정파', '로맨티스트',
];

function randomUserId() {
  return `bot_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

// ── Claude API 호출 ──
async function callLLM(systemPrompt, userPrompt) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('Anthropic API key not found');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      temperature: 0.9,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  const data = await res.json();
  return data.content?.[0]?.text?.trim() || '';
}

// ── 댓글 생성 ──
async function generateComment(postTitle, postContent, postCategory) {
  const systemPrompt = `너는 한국 10대(중학생~고등학생) 여자/남자야. "마음다락방"이라는 연애/일상 고민 앱에서 활동하는 일반 사용자야.
다른 10대의 고민 글을 읽고 공감하는 댓글을 달아줘.

[말투 규칙 - 존댓말 기반]
- 존댓말 기본 (~같아요, ~거든요, ~해봐요, ~인 것 같아요, ~하세요, ~좋을 것 같아요)
- 10대 느낌의 부드러운 존댓말 (~요 체)
- 맞춤법 가끔 틀려도 됨 (했는데→햇는데, 됐는데→됫는데, 거든요→거등요)
- 줄임말/신조어 적당히 사용: ㄹㅇ, 진짜, 걍, 찐, 인정, 공감
- 이모티콘: ㅠㅠ, ㅜㅜ, ㅋㅋ, ㅋㅋㅋ, 😭, 🥺, !!
- 1~3문장으로 짧게

[댓글 유형 - 랜덤하게 섞어서]
- 공감형: "아 진짜 저도 겪어봐서 아는데 ㅠㅠ 힘드시겠어요"
- 조언형: "저같으면 걍 솔직하게 말할 것 같아요!"
- 응원형: "힘내세요!! 잘될거예요 진짜"
- 경험 공유형: "저도 비슷한 적 있었는데요~"
- 질문형: "근데 그 사람이 먼저 연락은 해요?"

[절대 금지]
- "AI", "봇", "생성" 같은 단어
- 어른스러운 말투, 조언가 느낌
- 반말 사용 금지 (반드시 존댓말로)
- 너무 길게 쓰기 (4문장 이상 금지)`;

  const userPrompt = `[${postCategory}] "${postTitle}"\n\n${postContent}\n\n위 글에 10대가 쓸법한 자연스러운 댓글 1개만. 댓글 내용만 출력해.`;

  return await callLLM(systemPrompt, userPrompt);
}

// ── 새 글 생성 ──
async function generatePost(category, existingTitles = []) {
  const topicPool = category === '연애상담'
    ? [
        '짝남/짝녀 짝사랑 고민 (같은반, 같은학원, 선배, 후배)',
        '남친/여친과의 문제 (단답, 삐짐, 여사친/남사친, 권태기)',
        '디엠 고민 (먼저 보낼까말까, 답장 어떻게, 읽씹)',
        '고백 타이밍/방법 고민',
        '전남친/전여친 미련, 재결합 고민',
        '썸남/썸녀 심리 분석 부탁',
        '짝사랑 포기해야 할지 고민',
        '남친이 다른 여자랑 친한 거 질투',
        '친구가 내 짝남을 좋아함',
        '같은반 되서 어색한 전남친',
        '연하/연상 좋아하는데 어떡하죠',
        '호감 신호인지 아닌지 판단 부탁',
      ]
    : [
        '학교생활 고민 (새학기, 반배정, 반장선거, 자리배치)',
        '화장품/뷰티 추천 (퍼컬, 틴트, 쿠션, 블러셔)',
        '친구관계 고민 (멀어진 친구, 싸운 친구, 새학기 적응)',
        '진로/공부 고민 (성적, 학원, 꿈, 문이과 선택)',
        'MBTI/성격 관련 잡담',
        '다이어트/운동 고민',
        '학교 동아리/밴드부/체육부 고민',
        '부모님과의 갈등 (폰 제한, 외출, 성적)',
        '일상 소소한 고민 (잠이안옴, 외로움, 심심함)',
        '학원/학교에서 있었던 웃긴 일',
      ];

  // 이미 사용된 주제 피하기 (제목에서 키워드 추출)
  let availableTopics = [...topicPool];
  if (existingTitles.length > 0) {
    const usedKeywords = existingTitles.join(' ');
    availableTopics = topicPool.filter(topic => {
      const mainKeyword = topic.split(' ')[0].replace(/[/()]/g, '');
      return !usedKeywords.includes(mainKeyword);
    });
    if (availableTopics.length === 0) availableTopics = [...topicPool];
  }
  const randomTopic = availableTopics[Math.floor(Math.random() * availableTopics.length)];

  const systemPrompt = `너는 한국 10대(중학생~고등학생)야. "마음다락방"이라는 연애/일상 고민 앱에 글을 쓰는 일반 사용자야.

[실제 10대 글 스타일 참고]
- "쉬는시간에 복도에서 짝남 무리가 있길래 그쪽으로 가서 있었거등요"
- "남친이랑 사귄지 140일 정도 됐는데요"
- "중2입니다 근데 제가 중3선배를 좋아해요"
- "제가 학년이 올라가면서 반배정이 새로 나왔는데"
- "남친이 절 먼저 좋아해서 계속 시도한결과 사귀게 되었고"
- "퍼컬은 봄 소프트인거같고 건성이야ㅠㅠ 쿠션이랑 팔레트 추천해줘!!"
- "오늘 반장선거를 했는데 저 말고 친구랑 전남친이 됐어요"

[말투 규칙]
- 반말 + 존댓말 자연스럽게 혼용 (한 글 안에서도 섞임)
- 맞춤법 가끔 틀림 (했→햇, 됐→됫, 같은데→같은대, 거든요→거등요)
- ㅠㅠ, ㅜㅜ, ㅋㅋ, 😭, 🥺, .. , ... 자주 사용
- 디엠, 릴스, 인스타, 카톡 같은 단어 자연스럽게 사용
- 사귄 일수 언급 (ex: "200일", "140일")
- 학년/나이 언급 (ex: "중2입니다", "고1 여학생이에요")
- "~거든요?", "~어떡하죠..", "도와주세요ㅠ", "알려주세요" 패턴

[글 구조]
- 제목: 20자 이내, 고민/궁금증 느낌 (ex: "짝남이 저한테 관심있는 걸까요?", "남친이 사소한일로 잘 삐져요")
- 본문: 4~8문장, 구체적인 상황 설명 포함
- 학교/학원/동아리 등 10대 일상 배경
- 마지막에 도움 요청이나 질문으로 끝남

[절대 금지]
- 성인 느낌 나는 표현 (직장, 결혼, 대학생활, 술)
- AI/봇 관련 단어
- 너무 정돈된 문장 (실제 10대는 생각나는 대로 씀)
- 문단 나누기 깔끔하게 하지 말 것 (줄바꿈은 하되 불규칙하게)

JSON 형식으로만 출력: {"title": "제목", "content": "본문"}`;

  const avoidList = existingTitles.length > 0
    ? `\n\n[중복 금지] 아래 제목들과 비슷한 주제/제목은 절대 쓰지 마:\n${existingTitles.map(t => `- "${t}"`).join('\n')}`
    : '';

  const userPrompt = `주제: "${randomTopic}"
"${category}" 카테고리에 올릴 글을 하나 작성해줘.
실제 10대 학생이 폰으로 빠르게 쓴 것처럼 자연스럽게.
JSON으로만 출력해.${avoidList}`;

  const result = await callLLM(systemPrompt, userPrompt);

  try {
    const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

// ── 메인 핸들러 ──
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // 보안: Vercel Cron 또는 인증된 요청만 허용
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;

  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const isAuthorized = cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (!isVercelCron && !isAuthorized) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const results = { comments: [], posts: [], errors: [] };

  try {
    const accessToken = await getAccessToken();

    // ─── 1. 댓글 없는 글 찾아서 댓글 달기 ───
    // 최신 글 (댓글 0개)
    const recentNoPosts = await firestoreQuery(accessToken, {
      from: [{ collectionId: 'posts' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'commentsCount' },
          op: 'EQUAL',
          value: { integerValue: '0' },
        },
      },
      orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }],
      limit: 15,
    });

    // 오래된 글도 포함 (댓글 0개, 오래된 순)
    const oldNoPosts = await firestoreQuery(accessToken, {
      from: [{ collectionId: 'posts' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'commentsCount' },
          op: 'EQUAL',
          value: { integerValue: '0' },
        },
      },
      orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'ASCENDING' }],
      limit: 10,
    });

    // 댓글 적은 글도 추가 (1~2개인 글)
    const fewCommentsPosts = await firestoreQuery(accessToken, {
      from: [{ collectionId: 'posts' }],
      where: {
        compositeFilter: {
          op: 'AND',
          filters: [
            {
              fieldFilter: {
                field: { fieldPath: 'commentsCount' },
                op: 'GREATER_THAN_OR_EQUAL',
                value: { integerValue: '1' },
              },
            },
            {
              fieldFilter: {
                field: { fieldPath: 'commentsCount' },
                op: 'LESS_THAN_OR_EQUAL',
                value: { integerValue: '2' },
              },
            },
          ],
        },
      },
      orderBy: [{ field: { fieldPath: 'commentsCount' }, direction: 'ASCENDING' }],
      limit: 10,
    });

    // 중복 제거하면서 합치기
    const allPosts = [];
    const seenIds = new Set();
    for (const p of [...recentNoPosts, ...oldNoPosts, ...fewCommentsPosts]) {
      if (!seenIds.has(p._id)) {
        seenIds.add(p._id);
        allPosts.push(p);
      }
    }

    // 각 글에 댓글 1개씩 생성
    for (const post of allPosts) {
      try {
        const commentText = await generateComment(
          post.title || '',
          ((post.content || '') + '').substring(0, 500),
          post.category || '연애상담'
        );

        if (!commentText) continue;

        const commentData = {
          text: commentText,
          userId: randomUserId(),
          userName: null,
          isAnonymous: true,
          createdAt: new Date(),
          likes: [],
          isPinned: false,
        };

        await firestoreAdd(accessToken, `posts/${post._id}/comments`, commentData);

        // commentsCount 업데이트
        const newCount = (post.commentsCount || 0) + 1;
        await firestoreUpdate(accessToken, `posts/${post._id}`, {
          commentsCount: newCount,
        });

        results.comments.push({
          postId: post._id,
          postTitle: post.title,
          comment: commentText,
        });
      } catch (err) {
        results.errors.push({ type: 'comment', postId: post._id, error: err.message });
      }
    }

    // ─── 2. 새 글 작성 (연애상담 3개 + 잡담 10개) ───
    const postPlan = [
      { category: '연애상담', count: 3 },
      { category: '잡담', count: 10 },
    ];

    // 전체 글 수와 시간 슬롯 계산 (24시간에 고르게 분산)
    const totalPosts = postPlan.reduce((sum, p) => sum + p.count, 0);
    const slotMinutes = Math.floor(1440 / totalPosts); // 글 간격 (분)
    let globalPostIndex = 0;

    for (const { category, count } of postPlan) {
      const createdTitles = [];
      for (let i = 0; i < count; i++) {
        try {
          const postContent = await generatePost(category, createdTitles);
          if (!postContent || !postContent.title || !postContent.content) continue;

          // 24시간 내 균등 분산 + 랜덤 지터(±30분)
          const now = new Date();
          const baseMinutes = globalPostIndex * slotMinutes;
          const jitter = Math.floor(Math.random() * 60) - 30; // -30 ~ +30분
          const offsetMinutes = Math.max(0, Math.min(1439, baseMinutes + jitter));
          const spreadTime = new Date(now.getTime() - offsetMinutes * 60 * 1000);
          globalPostIndex++;

          const postData = {
            title: postContent.title,
            content: postContent.content,
            category,
            authorId: randomUserId(),
            authorName: null,
            isAnonymous: true,
            createdAt: spreadTime,
            updatedAt: spreadTime,
            views: Math.floor(Math.random() * 30) + 5,
            likesArray: [],
            commentsCount: 0,
            isAdminPost: true,
          };

          const docRef = await firestoreAdd(accessToken, 'posts', postData);
          const docId = docRef.name ? docRef.name.split('/').pop() : 'unknown';

          createdTitles.push(postContent.title);
          results.posts.push({
            id: docId,
            title: postContent.title,
            content: postContent.content,
            category,
            createdAt: spreadTime,
          });
        } catch (err) {
          results.errors.push({ type: 'post', category, error: err.message });
        }
      }
    }

    // ─── 3. 방금 생성한 글에 댓글 1~2개씩 달기 ───
    for (const posted of results.posts) {
      try {
        const commentCount = Math.random() < 0.5 ? 1 : 2;
        for (let c = 0; c < commentCount; c++) {
          const commentText = await generateComment(
            posted.title || '',
            ((posted.content || '') + '').substring(0, 500),
            posted.category || '연애상담'
          );

          if (!commentText) continue;

          // 댓글 시간을 글 작성 시간 이후 랜덤(10분~3시간)으로 설정
          const postTime = posted.createdAt instanceof Date ? posted.createdAt.getTime() : Date.now();
          const delayMs = (Math.floor(Math.random() * 170) + 10) * 60 * 1000;
          const commentTime = new Date(postTime + delayMs);

          const commentData = {
            text: commentText,
            userId: randomUserId(),
            userName: null,
            isAnonymous: true,
            createdAt: commentTime,
            likes: [],
            isPinned: false,
          };

          await firestoreAdd(accessToken, `posts/${posted.id}/comments`, commentData);
          await firestoreUpdate(accessToken, `posts/${posted.id}`, {
            commentsCount: c + 1,
          });

          results.comments.push({
            postId: posted.id,
            postTitle: posted.title,
            comment: commentText,
            source: 'auto-post',
          });
        }
      } catch (err) {
        results.errors.push({ type: 'auto-post-comment', postId: posted.id, error: err.message });
      }
    }

    return res.status(200).json({
      success: true,
      summary: {
        commentsCreated: results.comments.length,
        postsCreated: results.posts.length,
        errors: results.errors.length,
      },
      details: results,
      executedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Auto-bot error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}
