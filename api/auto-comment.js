// api/auto-comment.js - 댓글 자동 생성 (30분마다 외부 크론으로 실행)
import { getAccessToken, firestoreQuery, firestoreAdd, firestoreUpdate, randomUserId, callLLM, authCheck } from './_lib/shared.js';

async function generateComment(postTitle, postContent, postCategory) {
  const systemPrompt = `너는 "마음다락방"이라는 10대 연애/일상 고민 앱의 사용자야.

[핵심 규칙]
- 글의 본문을 꼼꼼히 읽고, 그 상황에 맞는 구체적인 답변을 해줘
- 실제 10대가 그 글을 읽고 자연스럽게 달 법한 댓글을 써줘
- 존댓말 기본 (~요 체)
- 1~3문장으로 짧게
- 매번 다른 톤과 내용으로 써줘. 정해진 패턴 없이 자유롭게
- 글 내용에 언급된 구체적인 상황(이름, 장소, 숫자, 사건 등)을 반영해서 써줘

[절대 금지]
- "AI", "봇", "생성" 같은 단어
- 반말 금지
- "아 진짜 저도~", "힘내세요!!" 같은 뻔한 패턴 반복
- 4문장 이상`;

  const userPrompt = `[${postCategory}] "${postTitle}"

${postContent}

위 글을 꼼꼼히 읽고, 이 상황에 맞는 10대 사용자의 자연스러운 댓글 1개만 써줘. 댓글 내용만 출력해.`;

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

    // 댓글 0개인 글
    const noCommentPosts = await firestoreQuery(accessToken, {
      from: [{ collectionId: 'posts' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'commentsCount' },
          op: 'EQUAL',
          value: { integerValue: '0' },
        },
      },
      orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }],
      limit: 200,
    });

    // 댓글 1~2개인 글
    const fewCommentsPosts = await firestoreQuery(accessToken, {
      from: [{ collectionId: 'posts' }],
      where: {
        compositeFilter: {
          op: 'AND',
          filters: [
            { fieldFilter: { field: { fieldPath: 'commentsCount' }, op: 'GREATER_THAN_OR_EQUAL', value: { integerValue: '1' } } },
            { fieldFilter: { field: { fieldPath: 'commentsCount' }, op: 'LESS_THAN_OR_EQUAL', value: { integerValue: '2' } } },
          ],
        },
      },
      orderBy: [{ field: { fieldPath: 'commentsCount' }, direction: 'ASCENDING' }],
      limit: 100,
    });

    // 중복 제거
    const allPosts = [];
    const seenIds = new Set();
    for (const p of [...noCommentPosts, ...fewCommentsPosts]) {
      if (!seenIds.has(p._id)) { seenIds.add(p._id); allPosts.push(p); }
    }

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
