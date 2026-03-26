// api/auto-comment.js - 댓글 자동 생성 (30분마다 외부 크론으로 실행)
import { getAccessToken, firestoreQuery, firestoreAdd, firestoreUpdate, randomUserId, callLLM, authCheck } from './_lib/shared.js';

async function generateComment(postTitle, postContent, postCategory) {
  const systemPrompt = `너는 "마음다락방"이라는 10대 연애/일상 고민 앱의 실제 사용자야.
글을 읽고 실제 10대가 달 법한 댓글을 써줘.

[실제 10대 댓글 예시 - 이런 느낌으로 다양하게]
- "헐 그건 좀.."
- "나도ㅠㅠ"
- "ㅋㅋㅋㅋ 이건 걍 고백각"
- "와 진짜요??"
- "오 그건 좀 별로인듯"
- "근데 걔가 먼저 연락은 해요?"
- "나도 비슷한데 걍 연락 끊었어요ㅋㅋ"
- "그 심정 이해해요 저도 그랬거든요ㅠ"
- "에이 그건 좋아하는거 맞아요!!"
- "음.. 저같으면 좀 더 지켜볼듯"
- "ㄹㅇ 공감"
- "아 그거 진짜 짜증나겠다"
- "잠깐 근데 그 남자애 좀 이상한데?"
- "나였으면 바로 차버렸을듯ㅋㅋ"
- "우와 부럽다ㅠㅠ"

[핵심 규칙]
- 위 예시처럼 짧은 한마디 리액션부터 1~2문장 답변까지 길이를 자유롭게
- 반말/존댓말 자유롭게 섞어서 (실제 10대는 섞어 씀)
- 매번 다른 사람이 쓴 것처럼 톤을 바꿔줘
- 글 내용의 구체적인 상황을 반영해서 써줘
- 항상 조언할 필요 없음. 그냥 리액션만 해도 되고, 질문만 해도 되고, 본인 경험만 말해도 됨

[절대 금지]
- "AI", "봇", "생성" 같은 단어
- 매번 조언하는 상담사 톤
- "아 진짜 저도~" 같은 반복 패턴
- 4문장 이상 (대부분은 1문장이면 충분)`;

  const userPrompt = `[${postCategory}] "${postTitle}"

${postContent}

실제 10대 사용자가 이 글을 보고 달 법한 자연스러운 댓글 1개. 댓글만 출력.`;

  return await callLLM(systemPrompt, userPrompt);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!authCheck(req)) return res.status(401).json({ error: 'Unauthorized' });

  const results = { comments: [], errors: [] };

  try {
    const accessToken = await getAccessToken();

    // 전체 글 가져온 뒤 댓글 적은 글 필터링 (commentsCount 필드가 없는 글도 포함)
    const allPostsRaw = await firestoreQuery(accessToken, {
      from: [{ collectionId: 'posts' }],
      orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }],
      limit: 500,
    });

    // commentsCount가 없거나 0~2인 글만 필터
    const allPosts = allPostsRaw.filter(p => {
      const count = p.commentsCount;
      return count === undefined || count === null || count <= 2;
    });

    for (const post of allPosts) {
      try {
        const commentText = await generateComment(
          post.title || '',
          ((post.content || '') + '').substring(0, 500),
          post.category || '연애상담'
        );
        if (!commentText) continue;

        await firestoreAdd(accessToken, `posts/${post._id}/comments`, {
          text: commentText,
          userId: randomUserId(),
          userName: null,
          isAnonymous: true,
          createdAt: new Date(),
          likes: [],
          isPinned: false,
        });

        await firestoreUpdate(accessToken, `posts/${post._id}`, {
          commentsCount: (post.commentsCount || 0) + 1,
        });

        results.comments.push({ postId: post._id, postTitle: post.title, comment: commentText });
      } catch (err) {
        results.errors.push({ postId: post._id, error: err.message });
      }
    }

    return res.status(200).json({
      success: true,
      summary: { commentsCreated: results.comments.length, errors: results.errors.length },
      details: results,
      executedAt: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
