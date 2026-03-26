// api/auto-post.js - 글 자동 생성 (30분마다 실행, 확률적으로 0~1개 작성)
import { getAccessToken, firestoreQuery, firestoreAdd, firestoreUpdate, randomUserId, callLLM, authCheck } from './_lib/shared.js';

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
- 제목: 20자 이내, 고민/궁금증 느낌
- 본문: 4~8문장, 구체적인 상황 설명 포함
- 학교/학원/동아리 등 10대 일상 배경
- 마지막에 도움 요청이나 질문으로 끝남

[절대 금지]
- 성인 느낌 나는 표현 (직장, 결혼, 대학생활, 술)
- AI/봇 관련 단어
- 너무 정돈된 문장
- 문단 나누기 깔끔하게 하지 말 것

JSON 형식으로만 출력: {"title": "제목", "content": "본문"}`;

  const userPrompt = `주제: "${randomTopic}"
"${category}" 카테고리에 올릴 글을 하나 작성해줘.
실제 10대 학생이 폰으로 빠르게 쓴 것처럼 자연스럽게.
JSON으로만 출력해.`;

  const result = await callLLM(systemPrompt, userPrompt);
  try {
    const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

async function generateComment(postTitle, postContent, postCategory) {
  const systemPrompt = `너는 "마음다락방"이라는 10대 연애/일상 고민 앱의 사용자야.

[핵심 규칙]
- 글의 본문을 꼼꼼히 읽고, 그 상황에 맞는 구체적인 답변을 해줘
- 실제 10대가 그 글을 읽고 자연스럽게 달 법한 댓글을 써줘
- 존댓말 기본 (~요 체)
- 1~3문장으로 짧게
- 글 내용에 언급된 구체적인 상황을 반영해서 써줘

[절대 금지]
- "AI", "봇", "생성" 같은 단어
- 반말 금지
- 4문장 이상`;

  return await callLLM(systemPrompt, `[${postCategory}] "${postTitle}"\n\n${postContent}\n\n위 글에 자연스러운 댓글 1개만. 댓글 내용만 출력해.`);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!authCheck(req)) return res.status(401).json({ error: 'Unauthorized' });

  try {
    // 25% 확률로 글 작성 → 30분마다 실행 시 하루 평균 12개
    const roll = Math.random();
    if (roll > 0.25) {
      return res.status(200).json({
        success: true,
        action: 'skipped',
        roll: roll.toFixed(2),
        message: '이번엔 글 안 씀 (확률 미달)',
        executedAt: new Date().toISOString(),
      });
    }

    const accessToken = await getAccessToken();

    // 연애상담 30%, 잡담 70% 확률
    const category = Math.random() < 0.3 ? '연애상담' : '잡담';

    const postContent = await generatePost(category);
    if (!postContent || !postContent.title || !postContent.content) {
      return res.status(200).json({ success: true, action: 'failed_generate', executedAt: new Date().toISOString() });
    }

    const postData = {
      title: postContent.title,
      content: postContent.content,
      category,
      authorId: randomUserId(),
      authorName: null,
      isAnonymous: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      views: Math.floor(Math.random() * 30) + 5,
      likesArray: [],
      commentsCount: 0,
      isAdminPost: true,
    };

    const docRef = await firestoreAdd(accessToken, 'posts', postData);
    const docId = docRef.name ? docRef.name.split('/').pop() : 'unknown';

    // 글 생성 후 바로 댓글 1개 달기
    const commentText = await generateComment(
      postContent.title,
      postContent.content.substring(0, 500),
      category
    );

    if (commentText) {
      await firestoreAdd(accessToken, `posts/${docId}/comments`, {
        text: commentText,
        userId: randomUserId(),
        userName: null,
        isAnonymous: true,
        createdAt: new Date(Date.now() + (Math.floor(Math.random() * 20) + 5) * 60 * 1000), // 5~25분 뒤
        likes: [],
        isPinned: false,
      });
      await firestoreUpdate(accessToken, `posts/${docId}`, { commentsCount: 1 });
    }

    return res.status(200).json({
      success: true,
      action: 'posted',
      post: { id: docId, title: postContent.title, category },
      comment: commentText || null,
      executedAt: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
