// api/auto-bot.js - 자동 댓글 & 글 작성 봇
// Vercel Cron으로 하루 1회 실행

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Firebase Admin 초기화
function getDb() {
  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID || 'soktalk-3e359',
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      }),
    });
  }
  return getFirestore();
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

function randomName() {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 100);
  return `${adj}${noun}${num}`;
}

function randomUserId() {
  return `bot_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

// ── GPT 호출 ──
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
      temperature: 0.9,
      max_tokens: 300,
    }),
  });

  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

// ── 댓글 생성 ──
async function generateComment(postTitle, postContent, postCategory) {
  const systemPrompt = `너는 한국 10대(중학생~고등학생) 여자/남자야. "마음다락방"이라는 연애/일상 고민 앱에서 활동하는 일반 사용자야.
다른 10대의 고민 글을 읽고 공감하는 댓글을 달아줘.

[말투 규칙 - 실제 10대처럼]
- 반말 기본 (~거든, ~인데, ~같아, ~ㅋㅋ, ~ㅠㅠ)
- 가끔 존댓말 섞어도 됨 (~같아요, ~거든요, ~해봐요)
- 맞춤법 가끔 틀려도 됨 (했는데→햇는데, 됐는데→됫는데, 같은→같은, 거든요→거등요)
- 줄임말/신조어 사용: ㄹㅇ, 진짜, 걍, 겁나, 개~, 찐, 인정, 공감, 와 이거 나야나
- 이모티콘: ㅠㅠ, ㅜㅜ, ㅋㅋ, ㅋㅋㅋ, 😭, 🥺, !!
- 1~3문장으로 짧게

[댓글 유형 - 랜덤하게 섞어서]
- 공감형: "아 진짜 이거 나도 겪어봐서 아는데 ㅠㅠ"
- 조언형: "나같으면 걍 솔직하게 말할듯"
- 응원형: "힘내!! 잘될거야 진짜"
- 경험 공유형: "나도 비슷한 적 있었는데~"
- 질문형: "근데 걔가 먼저 연락은 해?"

[절대 금지]
- "AI", "봇", "생성" 같은 단어
- 어른스러운 말투, 조언가 느낌
- 너무 길게 쓰기 (4문장 이상 금지)`;

  const userPrompt = `[${postCategory}] "${postTitle}"\n\n${postContent}\n\n위 글에 10대가 쓸법한 자연스러운 댓글 1개만. 댓글 내용만 출력해.`;

  return await callGPT(systemPrompt, userPrompt);
}

// ── 새 글 생성 ──
async function generatePost(category) {
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

  const randomTopic = topicPool[Math.floor(Math.random() * topicPool.length)];

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

  const userPrompt = `주제: "${randomTopic}"
"${category}" 카테고리에 올릴 글을 하나 작성해줘.
실제 10대 학생이 폰으로 빠르게 쓴 것처럼 자연스럽게.
JSON으로만 출력해.`;

  const result = await callGPT(systemPrompt, userPrompt);

  try {
    // JSON 파싱 (코드블록 제거)
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

  const db = getDb();
  const results = { comments: [], posts: [], errors: [] };

  try {
    // ─── 1. 댓글 없는 글 찾아서 댓글 달기 ───
    const postsSnapshot = await db
      .collection('posts')
      .where('commentsCount', '==', 0)
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();

    // 댓글이 적은 글도 추가 (1~2개인 글)
    const fewCommentsSnapshot = await db
      .collection('posts')
      .where('commentsCount', 'in', [1, 2])
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get();

    const postsToComment = [];
    postsSnapshot.forEach((doc) => postsToComment.push({ id: doc.id, ...doc.data() }));
    fewCommentsSnapshot.forEach((doc) => {
      if (!postsToComment.find((p) => p.id === doc.id)) {
        postsToComment.push({ id: doc.id, ...doc.data() });
      }
    });

    // 각 글에 댓글 1개씩 생성
    for (const post of postsToComment) {
      try {
        const commentText = await generateComment(
          post.title || '',
          (post.content || '').substring(0, 500),
          post.category || '연애상담'
        );

        if (!commentText) continue;

        const commentData = {
          text: commentText,
          userId: randomUserId(),
          userName: null, // 익명
          isAnonymous: true,
          createdAt: new Date(),
          likes: [],
          isPinned: false,
        };

        await db.collection('posts').doc(post.id).collection('comments').add(commentData);

        // commentsCount 업데이트
        await db
          .collection('posts')
          .doc(post.id)
          .update({
            commentsCount: FieldValue.increment(1),
          });

        results.comments.push({
          postId: post.id,
          postTitle: post.title,
          comment: commentText,
        });
      } catch (err) {
        results.errors.push({ type: 'comment', postId: post.id, error: err.message });
      }
    }

    // ─── 2. 새 글 작성 (연애상담 3개 + 잡담 10개) ───
    const postPlan = [
      { category: '연애상담', count: 3 },
      { category: '잡담', count: 10 },
    ];

    for (const { category, count } of postPlan) {
      for (let i = 0; i < count; i++) {
        try {
          const postContent = await generatePost(category);
          if (!postContent || !postContent.title || !postContent.content) continue;

          // createdAt을 하루 안에서 랜덤 분산 (자연스럽게 보이도록)
          const now = new Date();
          const randomMinutes = Math.floor(Math.random() * 1440); // 0~1440분(24시간)
          const spreadTime = new Date(now.getTime() - randomMinutes * 60 * 1000);

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

          const docRef = await db.collection('posts').add(postData);

          results.posts.push({
            id: docRef.id,
            title: postContent.title,
            category,
          });
        } catch (err) {
          results.errors.push({ type: 'post', category, error: err.message });
        }
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
