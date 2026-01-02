import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { 
  doc, 
  getDoc, 
  collection, 
  getDocs, 
  deleteDoc, 
  updateDoc,
  addDoc,
  query, 
  orderBy 
} from 'firebase/firestore';
import { 
  ArrowLeft, 
  Trash2, 
  Eye, 
  EyeOff, 
  Heart, 
  MessageSquare,
  Send,
  User,
  RefreshCw,
  Edit3,
  Save,
  X,
  Reply,
  CornerDownRight,
  Plus,
  Minus
} from 'lucide-react';

// 랜덤 닉네임 생성용
const adjectives = ['행복한', '슬픈', '외로운', '설레는', '두근거리는', '걱정되는', '기대되는', '불안한', '떨리는', '애틋한'];
const nouns = ['사랑꾼', '짝사랑러', '연애초보', '솔로', '커플', '썸남', '썸녀', '고민러', '연인', '짝꿍'];

function PostDetail() {
  const { postId } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // 게시글 수정용
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  
  // 조회수 수정용
  const [editingViews, setEditingViews] = useState(false);
  const [newViews, setNewViews] = useState(0);
  
  // 댓글 작성용
  const [newComment, setNewComment] = useState('');
  const [commentAuthor, setCommentAuthor] = useState('익명');
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // 대댓글 작성용
  const [replyingTo, setReplyingTo] = useState(null); // { parentCommentId, authorName }
  const [replyText, setReplyText] = useState('');
  const [replyAuthor, setReplyAuthor] = useState('익명');
  const [isReplyAnonymous, setIsReplyAnonymous] = useState(true);
  const [replySubmitting, setReplySubmitting] = useState(false);

  useEffect(() => {
    loadPostAndComments();
  }, [postId]);

  const loadPostAndComments = async () => {
    try {
      // 게시글 로드
      const postDoc = await getDoc(doc(db, 'posts', postId));
      if (postDoc.exists()) {
        const postData = { id: postDoc.id, ...postDoc.data() };
        setPost(postData);
        setEditTitle(postData.title || '');
        setEditContent(postData.content || '');
        setNewViews(postData.views || 0);
      }

      // 댓글 로드
      const commentsQuery = query(
        collection(db, 'posts', postId, 'comments'),
        orderBy('createdAt', 'asc')
      );
      const commentsSnapshot = await getDocs(commentsQuery);
      const commentsData = commentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setComments(commentsData);
    } catch (error) {
      console.error('데이터 로드 에러:', error);
    } finally {
      setLoading(false);
    }
  };

  const startEditing = () => {
    setEditTitle(post.title || '');
    setEditContent(post.content || '');
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setEditTitle(post.title || '');
    setEditContent(post.content || '');
    setIsEditing(false);
  };

  const saveEdit = async () => {
    if (!editTitle.trim()) {
      alert('제목을 입력해주세요.');
      return;
    }
    if (!editContent.trim()) {
      alert('내용을 입력해주세요.');
      return;
    }

    setSaving(true);

    try {
      await updateDoc(doc(db, 'posts', postId), {
        title: editTitle.trim(),
        content: editContent.trim(),
        updatedAt: new Date(),
      });

      setPost({
        ...post,
        title: editTitle.trim(),
        content: editContent.trim(),
      });
      setIsEditing(false);
      alert('게시글이 수정되었습니다.');
    } catch (error) {
      console.error('수정 에러:', error);
      alert('수정 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // 조회수 수정
  const updateViews = async () => {
    try {
      await updateDoc(doc(db, 'posts', postId), {
        views: newViews,
      });
      setPost({ ...post, views: newViews });
      setEditingViews(false);
      alert('조회수가 수정되었습니다.');
    } catch (error) {
      console.error('조회수 수정 에러:', error);
      alert('수정 중 오류가 발생했습니다.');
    }
  };

  const adjustViews = (amount) => {
    const adjusted = Math.max(0, newViews + amount);
    setNewViews(adjusted);
  };

  const deletePost = async () => {
    if (!window.confirm('이 게시글을 삭제하시겠습니까?\n(댓글도 모두 삭제됩니다)')) return;

    try {
      // 댓글들 먼저 삭제
      for (const comment of comments) {
        await deleteDoc(doc(db, 'posts', postId, 'comments', comment.id));
      }
      // 게시글 삭제
      await deleteDoc(doc(db, 'posts', postId));
      alert('삭제되었습니다.');
      navigate('/posts');
    } catch (error) {
      console.error('삭제 에러:', error);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  const toggleHidden = async () => {
    try {
      await updateDoc(doc(db, 'posts', postId), {
        isHidden: !post.isHidden,
      });
      setPost({ ...post, isHidden: !post.isHidden });
      alert(post.isHidden ? '게시글이 공개되었습니다.' : '게시글이 숨김 처리되었습니다.');
    } catch (error) {
      console.error('숨김 처리 에러:', error);
      alert('처리 중 오류가 발생했습니다.');
    }
  };

  const deleteComment = async (commentId) => {
    if (!window.confirm('이 댓글을 삭제하시겠습니까?')) return;

    try {
      await deleteDoc(doc(db, 'posts', postId, 'comments', commentId));
      setComments(comments.filter(c => c.id !== commentId));
      
      // 댓글 수 업데이트
      await updateDoc(doc(db, 'posts', postId), {
        commentsCount: comments.length - 1
      });
      
      alert('삭제되었습니다.');
    } catch (error) {
      console.error('삭제 에러:', error);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  const generateRandomName = () => {
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const num = Math.floor(Math.random() * 100);
    setCommentAuthor(`${adj}${noun}${num}`);
  };

  // ✅ 푸시 알림 전송 함수 (Vercel API 사용)
  const sendPushNotification = async (commenterName, commentText) => {
    // 게시글 작성자에게 알림 전송
    if (!post.authorId) {
      console.log('게시글 작성자 ID가 없습니다.');
      return;
    }

    try {
      // 게시글 작성자의 pushToken 가져오기
      const userRef = doc(db, 'users', post.authorId);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        console.log('사용자를 찾을 수 없습니다.');
        return;
      }

      const pushToken = userSnap.data().pushToken;

      if (!pushToken) {
        console.log('푸시 토큰이 없습니다.');
        return;
      }

      // Vercel API를 통해 알림 전송 (CORS 우회)
      const response = await fetch('https://soktalk.vercel.app/api/push-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pushToken: pushToken,
          title: '새 댓글 💬',
          body: `${commenterName}님이 "${post.title}"에 댓글을 남겼습니다.`,
          data: {
            type: 'comment',
            postId: postId,
            screen: 'PostDetail'
          },
        }),
      });

      const result = await response.json();
      console.log('✅ 관리자 댓글 알림 전송 완료:', result);
    } catch (error) {
      console.error('❌ 알림 전송 에러:', error);
    }
  };

  const generateRandomReplyName = () => {
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const num = Math.floor(Math.random() * 100);
    setReplyAuthor(`${adj}${noun}${num}`);
  };

  const submitComment = async () => {
    if (!newComment.trim()) {
      alert('댓글 내용을 입력해주세요.');
      return;
    }

    setSubmitting(true);

    try {
      const fakeUserId = `admin_${Date.now()}`;
      
      const commentData = {
        text: newComment.trim(),
        userId: fakeUserId,
        userName: isAnonymous ? null : commentAuthor,
        isAnonymous,
        createdAt: new Date(),
        likes: [],
        isPinned: false,
        isAdminComment: true,
      };

      await addDoc(collection(db, 'posts', postId, 'comments'), commentData);
      
      // 댓글 수 업데이트
      await updateDoc(doc(db, 'posts', postId), {
        commentsCount: comments.length + 1
      });

      // ✅ 푸시 알림 전송
      const displayName = isAnonymous ? '익명' : commentAuthor;
      await sendPushNotification(displayName, newComment.trim());

      // 댓글 다시 로드 (중복 방지)
      await loadPostAndComments();
      setNewComment('');
      alert('댓글이 등록되었습니다.');
    } catch (error) {
      console.error('댓글 등록 에러:', error);
      alert('등록 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  // 대댓글 작성 시작 (어떤 댓글이든 그 댓글에 대한 답글 가능)
  const startReply = (comment) => {
    const authorName = getDisplayName(comment);
    
    setReplyingTo({ 
      commentId: comment.id,  // 클릭한 댓글의 ID
      parentCommentId: comment.id,  // 부모 댓글 ID (바로 그 댓글)
      authorName: authorName 
    });
    setReplyText('');
    setIsReplyAnonymous(true);
  };

  // 대댓글 취소
  const cancelReply = () => {
    setReplyingTo(null);
    setReplyText('');
  };

  // 대댓글 제출
  const submitReply = async () => {
    if (!replyText.trim()) {
      alert('대댓글 내용을 입력해주세요.');
      return;
    }

    setReplySubmitting(true);

    try {
      const fakeUserId = `admin_${Date.now()}`;
      
      const replyData = {
        text: replyText.trim(),
        userId: fakeUserId,
        userName: isReplyAnonymous ? null : replyAuthor,
        isAnonymous: isReplyAnonymous,
        createdAt: new Date(),
        likes: [],
        isPinned: false,
        isAdminComment: true,
        parentCommentId: replyingTo.parentCommentId,
        replyTo: replyingTo.authorName,
      };

      await addDoc(collection(db, 'posts', postId, 'comments'), replyData);
      
      // 댓글 수 업데이트
      await updateDoc(doc(db, 'posts', postId), {
        commentsCount: comments.length + 1
      });

      // ✅ 푸시 알림 전송
      const displayName = isReplyAnonymous ? '익명' : replyAuthor;
      await sendPushNotification(displayName, replyText.trim());

      // 댓글 다시 로드 (중복 방지)
      await loadPostAndComments();
      setReplyText('');
      setReplyingTo(null);
      alert('대댓글이 등록되었습니다.');
    } catch (error) {
      console.error('대댓글 등록 에러:', error);
      alert('등록 중 오류가 발생했습니다.');
    } finally {
      setReplySubmitting(false);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp?.toDate) return '-';
    const date = timestamp.toDate();
    return `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  const getDisplayName = (item) => {
    if (item.isAnonymous) return '익명';
    return item.userName || item.authorName || '익명';
  };

  // 댓글 정렬: 트리 구조로 정렬 (무한 깊이 대댓글 지원)
  const organizeComments = () => {
    // 이미 추가된 댓글 ID 추적 (중복 방지)
    const addedIds = new Set();
    const result = [];
    
    // 자식 댓글 찾기
    const getChildren = (parentId) => {
      return comments
        .filter(c => c.parentCommentId === parentId && !addedIds.has(c.id))
        .sort((a, b) => {
          const aTime = a.createdAt?.toDate?.() || a.createdAt || new Date(0);
          const bTime = b.createdAt?.toDate?.() || b.createdAt || new Date(0);
          return aTime - bTime;
        });
    };
    
    // 재귀적으로 댓글과 자식들 추가
    const addWithChildren = (comment, depth) => {
      if (addedIds.has(comment.id)) return; // 중복 방지
      addedIds.add(comment.id);
      result.push({ ...comment, depth });
      
      const children = getChildren(comment.id);
      children.forEach(child => addWithChildren(child, depth + 1));
    };
    
    // 원댓글들 (parentCommentId가 없는 것들)
    const rootComments = comments
      .filter(c => !c.parentCommentId)
      .sort((a, b) => {
        const aTime = a.createdAt?.toDate?.() || a.createdAt || new Date(0);
        const bTime = b.createdAt?.toDate?.() || b.createdAt || new Date(0);
        return aTime - bTime;
      });
    
    rootComments.forEach(root => addWithChildren(root, 0));
    
    // 고아 댓글들 추가 (부모가 삭제된 경우)
    comments.forEach(c => {
      if (!addedIds.has(c.id)) {
        result.push({ ...c, depth: 0 });
      }
    });
    
    return result;
  };

  if (loading) {
    return <div style={styles.loading}>로딩 중...</div>;
  }

  if (!post) {
    return <div style={styles.loading}>게시글을 찾을 수 없습니다.</div>;
  }

  const organizedComments = organizeComments();

  return (
    <div style={styles.container}>
      {/* 헤더 */}
      <div style={styles.header}>
        <button onClick={() => navigate('/posts')} style={styles.backBtn}>
          <ArrowLeft size={20} />
          <span>목록으로</span>
        </button>
        
        <div style={styles.actions}>
          {!isEditing && (
            <button onClick={startEditing} style={styles.editBtn}>
              <Edit3 size={18} />
              <span>수정</span>
            </button>
          )}
          <button
            onClick={toggleHidden}
            style={{
              ...styles.actionBtn,
              backgroundColor: post.isHidden ? '#E3F2FD' : '#FFF3E0',
            }}
          >
            {post.isHidden ? <Eye size={18} color="#1976D2" /> : <EyeOff size={18} color="#FF9800" />}
            <span>{post.isHidden ? '공개하기' : '숨기기'}</span>
          </button>
          <button onClick={deletePost} style={styles.deleteBtn}>
            <Trash2 size={18} />
            <span>삭제</span>
          </button>
        </div>
      </div>

      {/* 게시글 내용 */}
      <div style={styles.postCard}>
        <div style={styles.postHeader}>
          <span style={styles.category}>{post.category || '일반'}</span>
          {post.isHidden && <span style={styles.hiddenBadge}>숨김</span>}
          {post.isAdminPost && <span style={styles.adminBadge}>관리자</span>}
        </div>
        
        {isEditing ? (
          // 수정 모드
          <div style={styles.editForm}>
            <div style={styles.editField}>
              <label style={styles.editLabel}>제목</label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                style={styles.editTitleInput}
                placeholder="제목을 입력하세요"
              />
            </div>
            <div style={styles.editField}>
              <label style={styles.editLabel}>내용</label>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                style={styles.editContentInput}
                placeholder="내용을 입력하세요"
                rows={10}
              />
            </div>
            <div style={styles.editActions}>
              <button onClick={cancelEditing} style={styles.cancelBtn}>
                <X size={16} />
                <span>취소</span>
              </button>
              <button onClick={saveEdit} disabled={saving} style={styles.saveBtn}>
                <Save size={16} />
                <span>{saving ? '저장 중...' : '저장'}</span>
              </button>
            </div>
          </div>
        ) : (
          // 보기 모드
          <>
            <h1 style={styles.postTitle}>{post.title}</h1>
            
            <div style={styles.postMeta}>
              <span>{getDisplayName(post)}</span>
              <span>•</span>
              <span>{formatDate(post.createdAt)}</span>
            </div>
            
            <div style={styles.postContent}>{post.content}</div>
          </>
        )}
        
        {/* 통계 (조회수 수정 가능) */}
        <div style={styles.postStats}>
          {/* 조회수 - 클릭하면 수정 모드 */}
          <div 
            style={styles.statClickable}
            onClick={() => {
              setNewViews(post.views || 0);
              setEditingViews(true);
            }}
            title="클릭하여 조회수 수정"
          >
            <Eye size={16} />
            <span>{post.views || 0}</span>
            <Edit3 size={12} style={{ marginLeft: 4, opacity: 0.5 }} />
          </div>
          <span style={styles.stat}>
            <Heart size={16} />
            {post.likesArray?.length || 0}
          </span>
          <span style={styles.stat}>
            <MessageSquare size={16} />
            {comments.length}
          </span>
        </div>

        {/* 조회수 수정 모달 */}
        {editingViews && (
          <div style={styles.viewsEditContainer}>
            <div style={styles.viewsEditBox}>
              <span style={styles.viewsEditLabel}>조회수 수정</span>
              <div style={styles.viewsEditControls}>
                <button onClick={() => adjustViews(-10)} style={styles.viewsBtn}>-10</button>
                <button onClick={() => adjustViews(-1)} style={styles.viewsBtn}>-1</button>
                <input
                  type="number"
                  value={newViews}
                  onChange={(e) => setNewViews(Math.max(0, parseInt(e.target.value) || 0))}
                  style={styles.viewsInput}
                />
                <button onClick={() => adjustViews(1)} style={styles.viewsBtn}>+1</button>
                <button onClick={() => adjustViews(10)} style={styles.viewsBtn}>+10</button>
                <button onClick={() => adjustViews(100)} style={styles.viewsBtn}>+100</button>
              </div>
              <div style={styles.viewsEditActions}>
                <button onClick={() => setEditingViews(false)} style={styles.viewsCancelBtn}>취소</button>
                <button onClick={updateViews} style={styles.viewsSaveBtn}>저장</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 댓글 작성 */}
      <div style={styles.commentWriteCard}>
        <h2 style={styles.sectionTitle}>댓글 작성 (관리자)</h2>
        
        <div style={styles.authorSection}>
          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={isAnonymous}
              onChange={(e) => setIsAnonymous(e.target.checked)}
              style={styles.checkbox}
            />
            <span>익명으로 작성</span>
          </label>
          
          {!isAnonymous && (
            <div style={styles.authorInput}>
              <User size={16} color="#666" />
              <input
                type="text"
                value={commentAuthor}
                onChange={(e) => setCommentAuthor(e.target.value)}
                placeholder="닉네임"
                style={styles.nicknameInput}
              />
              <button type="button" onClick={generateRandomName} style={styles.randomBtn}>
                <RefreshCw size={14} />
              </button>
            </div>
          )}
        </div>
        
        <div style={styles.commentInputRow}>
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="댓글을 입력하세요..."
            style={styles.commentTextarea}
            rows={3}
          />
          <button 
            onClick={submitComment} 
            disabled={submitting}
            style={styles.submitBtn}
          >
            <Send size={18} />
          </button>
        </div>
      </div>

      {/* 댓글 목록 */}
      <div style={styles.commentsCard}>
        <h2 style={styles.sectionTitle}>댓글 {comments.length}개</h2>
        
        {comments.length === 0 ? (
          <p style={styles.empty}>댓글이 없습니다.</p>
        ) : (
          <div style={styles.commentList}>
            {organizedComments.map((comment) => (
              <div key={comment.id}>
                <div 
                  style={{
                    ...styles.commentItem,
                    ...(comment.depth > 0 ? {
                      ...styles.replyItem,
                      marginLeft: `${Math.min(comment.depth * 24, 72)}px`,  // 최대 3단계 들여쓰기
                    } : {}),
                  }}
                >
                  <div style={styles.commentHeader}>
                    <div style={styles.commentInfo}>
                      {comment.depth > 0 && (
                        <CornerDownRight size={14} color="#FF6B6B" style={{ marginRight: 4 }} />
                      )}
                      <span style={styles.commentAuthor}>
                        {getDisplayName(comment)}
                        {comment.isAdminComment && (
                          <span style={styles.adminTag}>관리자</span>
                        )}
                      </span>
                      <span style={styles.commentDate}>{formatDate(comment.createdAt)}</span>
                    </div>
                    <div style={styles.commentActions}>
                      {/* 모든 댓글에 답글 버튼 표시 */}
                      <button
                        onClick={() => startReply(comment)}
                        style={styles.replyBtn}
                        title="답글 달기"
                      >
                        <Reply size={14} />
                      </button>
                      <button
                        onClick={() => deleteComment(comment.id)}
                        style={styles.commentDeleteBtn}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  
                  {comment.replyTo && (
                    <div style={styles.replyTo}>
                      @{comment.replyTo}
                    </div>
                  )}
                  
                  <p style={styles.commentText}>{comment.text}</p>
                </div>

                {/* 대댓글 작성 폼 - 클릭한 댓글 바로 아래에 표시 */}
                {replyingTo && replyingTo.commentId === comment.id && (
                  <div style={{
                    ...styles.replyFormContainer,
                    marginLeft: `${Math.min((comment.depth + 1) * 24, 72)}px`,
                  }}>
                    <div style={styles.replyFormHeader}>
                      <CornerDownRight size={16} color="#FF6B6B" />
                      <span style={styles.replyFormTitle}>@{replyingTo.authorName}에게 답글</span>
                      <button onClick={cancelReply} style={styles.replyCancelBtn}>
                        <X size={14} />
                      </button>
                    </div>
                    
                    <div style={styles.replyAuthorSection}>
                      <label style={styles.checkboxLabel}>
                        <input
                          type="checkbox"
                          checked={isReplyAnonymous}
                          onChange={(e) => setIsReplyAnonymous(e.target.checked)}
                          style={styles.checkbox}
                        />
                        <span>익명</span>
                      </label>
                      
                      {!isReplyAnonymous && (
                        <div style={styles.authorInput}>
                          <input
                            type="text"
                            value={replyAuthor}
                            onChange={(e) => setReplyAuthor(e.target.value)}
                            placeholder="닉네임"
                            style={styles.nicknameInput}
                          />
                          <button type="button" onClick={generateRandomReplyName} style={styles.randomBtn}>
                            <RefreshCw size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                    
                    <div style={styles.replyInputRow}>
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="답글을 입력하세요..."
                        style={styles.replyTextarea}
                        rows={2}
                      />
                      <button 
                        onClick={submitReply} 
                        disabled={replySubmitting}
                        style={styles.replySubmitBtn}
                      >
                        <Send size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '900px',
  },
  loading: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '200px',
    color: '#999',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  backBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    backgroundColor: '#f5f5f5',
    borderRadius: '8px',
    color: '#666',
    fontSize: '14px',
    cursor: 'pointer',
    border: 'none',
  },
  actions: {
    display: 'flex',
    gap: '8px',
  },
  editBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    backgroundColor: '#E3F2FD',
    color: '#1976D2',
    borderRadius: '8px',
    fontSize: '14px',
    cursor: 'pointer',
    border: 'none',
  },
  actionBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    borderRadius: '8px',
    fontSize: '14px',
    cursor: 'pointer',
    border: 'none',
  },
  deleteBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    backgroundColor: '#FFEBEE',
    color: '#F44336',
    borderRadius: '8px',
    fontSize: '14px',
    cursor: 'pointer',
    border: 'none',
  },
  postCard: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '24px',
    marginBottom: '20px',
    border: '1px solid #eee',
  },
  postHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '16px',
  },
  category: {
    backgroundColor: '#FFF0F0',
    color: '#FF6B6B',
    padding: '4px 10px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '500',
  },
  hiddenBadge: {
    backgroundColor: '#FFF3E0',
    color: '#FF9800',
    padding: '4px 10px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '500',
  },
  adminBadge: {
    backgroundColor: '#E3F2FD',
    color: '#1976D2',
    padding: '4px 10px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '500',
  },
  postTitle: {
    fontSize: '22px',
    fontWeight: '700',
    color: '#333',
    marginBottom: '12px',
    lineHeight: '1.4',
  },
  postMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    color: '#999',
    marginBottom: '20px',
  },
  postContent: {
    fontSize: '15px',
    color: '#333',
    lineHeight: '1.8',
    whiteSpace: 'pre-wrap',
    marginBottom: '20px',
    paddingBottom: '20px',
    borderBottom: '1px solid #f0f0f0',
  },
  postStats: {
    display: 'flex',
    gap: '16px',
  },
  stat: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '14px',
    color: '#666',
  },
  statClickable: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '14px',
    color: '#666',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: '6px',
    backgroundColor: '#f9f9f9',
    transition: 'background-color 0.2s',
  },
  // 조회수 수정
  viewsEditContainer: {
    marginTop: '16px',
    padding: '16px',
    backgroundColor: '#f9f9f9',
    borderRadius: '8px',
  },
  viewsEditBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  viewsEditLabel: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#333',
  },
  viewsEditControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  viewsBtn: {
    padding: '6px 12px',
    backgroundColor: '#fff',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '13px',
    cursor: 'pointer',
  },
  viewsInput: {
    width: '80px',
    padding: '8px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '14px',
    textAlign: 'center',
  },
  viewsEditActions: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'flex-end',
  },
  viewsCancelBtn: {
    padding: '8px 16px',
    backgroundColor: '#f5f5f5',
    borderRadius: '6px',
    fontSize: '13px',
    cursor: 'pointer',
    border: 'none',
  },
  viewsSaveBtn: {
    padding: '8px 16px',
    backgroundColor: '#FF6B6B',
    color: '#fff',
    borderRadius: '6px',
    fontSize: '13px',
    cursor: 'pointer',
    border: 'none',
  },
  // 수정 모드
  editForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  editField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  editLabel: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#666',
  },
  editTitleInput: {
    padding: '12px',
    border: '1px solid #eee',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
  },
  editContentInput: {
    padding: '12px',
    border: '1px solid #eee',
    borderRadius: '8px',
    fontSize: '14px',
    lineHeight: '1.6',
    resize: 'vertical',
  },
  editActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
  },
  cancelBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '10px 16px',
    backgroundColor: '#f5f5f5',
    color: '#666',
    borderRadius: '8px',
    fontSize: '14px',
    cursor: 'pointer',
    border: 'none',
  },
  saveBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '10px 16px',
    backgroundColor: '#4CAF50',
    color: '#fff',
    borderRadius: '8px',
    fontSize: '14px',
    cursor: 'pointer',
    border: 'none',
  },
  // 댓글 작성
  commentWriteCard: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '20px',
    border: '1px solid #eee',
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#333',
    marginBottom: '16px',
  },
  authorSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '12px',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '14px',
    color: '#666',
    cursor: 'pointer',
  },
  checkbox: {
    width: '16px',
    height: '16px',
    cursor: 'pointer',
  },
  authorInput: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  nicknameInput: {
    padding: '6px 10px',
    border: '1px solid #eee',
    borderRadius: '6px',
    fontSize: '14px',
    width: '120px',
  },
  randomBtn: {
    padding: '6px',
    backgroundColor: '#f5f5f5',
    borderRadius: '6px',
    cursor: 'pointer',
    border: 'none',
  },
  commentInputRow: {
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-end',
  },
  commentTextarea: {
    flex: 1,
    padding: '12px',
    border: '1px solid #eee',
    borderRadius: '8px',
    fontSize: '14px',
    resize: 'none',
    lineHeight: '1.5',
  },
  submitBtn: {
    padding: '12px 16px',
    backgroundColor: '#FF6B6B',
    color: '#fff',
    borderRadius: '8px',
    cursor: 'pointer',
    border: 'none',
    height: 'fit-content',
  },
  // 댓글 목록
  commentsCard: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '20px',
    border: '1px solid #eee',
  },
  empty: {
    textAlign: 'center',
    color: '#999',
    padding: '40px 0',
    fontSize: '14px',
  },
  commentList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0',
  },
  commentItem: {
    padding: '16px 0',
    borderBottom: '1px solid #f5f5f5',
  },
  replyItem: {
    marginLeft: '24px',
    paddingLeft: '16px',
    borderLeft: '2px solid #FFE0E0',
    backgroundColor: '#FFFAFA',
    marginTop: '-1px',
    borderRadius: '0 8px 8px 0',
  },
  commentHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  commentInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  commentAuthor: {
    fontWeight: '600',
    fontSize: '14px',
    color: '#333',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  adminTag: {
    backgroundColor: '#E3F2FD',
    color: '#1976D2',
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '11px',
  },
  commentDate: {
    fontSize: '12px',
    color: '#999',
  },
  commentActions: {
    display: 'flex',
    gap: '8px',
  },
  replyBtn: {
    padding: '6px',
    backgroundColor: '#E8F5E9',
    color: '#4CAF50',
    borderRadius: '6px',
    cursor: 'pointer',
    border: 'none',
  },
  commentDeleteBtn: {
    padding: '6px',
    backgroundColor: '#FFEBEE',
    color: '#F44336',
    borderRadius: '6px',
    cursor: 'pointer',
    border: 'none',
  },
  replyTo: {
    fontSize: '12px',
    color: '#FF6B6B',
    marginBottom: '6px',
    fontWeight: '500',
  },
  commentText: {
    fontSize: '14px',
    color: '#333',
    lineHeight: '1.6',
  },
  // 대댓글 작성 폼 스타일
  replyFormContainer: {
    marginLeft: '24px',
    marginTop: '8px',
    padding: '16px',
    backgroundColor: '#FFF5F5',
    borderRadius: '8px',
    borderLeft: '3px solid #FF6B6B',
  },
  replyFormHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '12px',
  },
  replyFormTitle: {
    fontSize: '13px',
    color: '#FF6B6B',
    fontWeight: '600',
    flex: 1,
  },
  replyCancelBtn: {
    padding: '4px',
    backgroundColor: '#f5f5f5',
    borderRadius: '4px',
    color: '#666',
    cursor: 'pointer',
    border: 'none',
  },
  replyAuthorSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '12px',
  },
  replyInputRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'flex-end',
  },
  replyTextarea: {
    flex: 1,
    padding: '10px',
    border: '1px solid #FFD0D0',
    borderRadius: '6px',
    fontSize: '13px',
    resize: 'none',
    lineHeight: '1.5',
  },
  replySubmitBtn: {
    padding: '10px 14px',
    backgroundColor: '#FF6B6B',
    color: '#fff',
    borderRadius: '6px',
    height: 'fit-content',
    cursor: 'pointer',
    border: 'none',
  },
};

export default PostDetail;