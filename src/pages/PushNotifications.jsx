import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, orderBy, limit, where } from 'firebase/firestore';
import { 
  Bell, 
  Send, 
  Megaphone, 
  Flame,
  Users,
  RefreshCw,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

function PushNotifications() {
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [tokenCount, setTokenCount] = useState(0);
  const [hotPosts, setHotPosts] = useState([]);
  const [notices, setNotices] = useState([]);
  const [result, setResult] = useState(null);
  const [tokens, setTokens] = useState([]);
  
  // 커스텀 푸시 폼
  const [customTitle, setCustomTitle] = useState('');
  const [customBody, setCustomBody] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // 사용자에서 푸시 토큰 조회
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const tokenList = [];
      usersSnapshot.forEach(doc => {
        const userData = doc.data();
        if (userData.pushToken) {
          tokenList.push(userData.pushToken);
        }
      });
      
      // 중복 제거
      const uniqueTokens = [...new Set(tokenList)];
      setTokens(uniqueTokens);
      setTokenCount(uniqueTokens.length);
      
      // 최근 공지사항 조회
      const noticesQuery = query(
        collection(db, 'notices'),
        where('isActive', '==', true),
        orderBy('createdAt', 'desc'),
        limit(5)
      );
      const noticesSnapshot = await getDocs(noticesQuery);
      setNotices(noticesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })));
      
      // 인기글 조회
      const postsQuery = query(
        collection(db, 'posts'),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
      const postsSnapshot = await getDocs(postsQuery);
      const posts = postsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // 인기 점수 계산 후 정렬
      const sortedPosts = posts
        .map(post => ({
          ...post,
          score: (post.likes || 0) * 5 + (post.commentsCount || 0) * 10 + (post.views || 0)
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
      
      setHotPosts(sortedPosts);
    } catch (error) {
      console.error('데이터 로드 에러:', error);
    } finally {
      setLoading(false);
    }
  };

  // Vercel API 프록시를 통해 Expo Push 발송
  const sendPushDirect = async (title, body, data = {}) => {
    setSending(true);
    setResult(null);
    
    try {
      if (tokens.length === 0) {
        setResult({
          success: false,
          message: '❌ 푸시 토큰이 있는 사용자가 없습니다.'
        });
        setSending(false);
        return;
      }

      // 메시지 배열 생성
      const messages = tokens.map(token => ({
        to: token,
        sound: 'default',
        title: title,
        body: body,
        data: data,
      }));

      // Vercel API 프록시를 통해 발송 (100개씩 배치)
      const batchSize = 100;
      let successCount = 0;
      let failureCount = 0;

      for (let i = 0; i < messages.length; i += batchSize) {
        const batch = messages.slice(i, i + batchSize);
        
        try {
          const response = await fetch('/api/send-push-all', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ messages: batch }),
          });

          const result = await response.json();
          
          if (result.success) {
            successCount += result.successCount || 0;
            failureCount += result.failureCount || 0;
          } else {
            failureCount += batch.length;
          }
        } catch (batchError) {
          console.error('배치 발송 에러:', batchError);
          failureCount += batch.length;
        }
      }

      setResult({
        success: true,
        message: `✅ ${successCount}명에게 발송 완료! (실패: ${failureCount}명)`
      });
    } catch (error) {
      console.error('푸시 발송 에러:', error);
      setResult({
        success: false,
        message: `❌ 에러: ${error.message}`
      });
    } finally {
      setSending(false);
    }
  };

  // 공지사항 푸시
  const sendNoticePush = (notice) => {
    if (!window.confirm(`"${notice.title}" 공지를 전체 회원에게 발송하시겠습니까?`)) return;
    
    sendPushDirect(
      '📢 새 공지사항',
      notice.title,
      { type: 'notice', noticeId: notice.id }
    );
  };

  // 인기글 푸시
  const sendHotPostPush = (post) => {
    if (!window.confirm(`"${post.title}" 글을 전체 회원에게 발송하시겠습니까?`)) return;
    
    sendPushDirect(
      '🔥 지금 핫한 글',
      post.title,
      { type: 'post', postId: post.id }
    );
  };

  // 커스텀 푸시
  const sendCustomPush = () => {
    if (!customTitle.trim() || !customBody.trim()) {
      alert('제목과 내용을 모두 입력해주세요.');
      return;
    }
    if (!window.confirm('전체 회원에게 푸시를 발송하시겠습니까?')) return;
    
    sendPushDirect(customTitle, customBody, { type: 'custom' });
    setCustomTitle('');
    setCustomBody('');
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '-';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  if (loading) {
    return <div style={styles.loading}>로딩 중...</div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.pageTitle}>🔔 푸시 알림 발송</h1>
        <button onClick={loadData} style={styles.refreshBtn}>
          <RefreshCw size={18} />
          <span>새로고침</span>
        </button>
      </div>

      {/* 통계 */}
      <div style={styles.statsCard}>
        <Users size={24} color="#FF6B6B" />
        <div style={styles.statsInfo}>
          <span style={styles.statsLabel}>푸시 등록 회원</span>
          <span style={styles.statsValue}>{tokenCount}명</span>
        </div>
      </div>

      {/* 발송 결과 */}
      {result && (
        <div style={{
          ...styles.resultCard,
          backgroundColor: result.success ? '#E8F5E9' : '#FFEBEE',
          borderColor: result.success ? '#4CAF50' : '#F44336',
        }}>
          {result.success ? (
            <CheckCircle size={20} color="#4CAF50" />
          ) : (
            <AlertCircle size={20} color="#F44336" />
          )}
          <span style={styles.resultText}>{result.message}</span>
        </div>
      )}

      {/* 커스텀 푸시 */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <Bell size={20} color="#FF6B6B" />
          <h2 style={styles.sectionTitle}>커스텀 푸시 발송</h2>
        </div>
        
        <div style={styles.formGroup}>
          <label style={styles.label}>제목</label>
          <input
            type="text"
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
            placeholder="푸시 알림 제목"
            style={styles.input}
          />
        </div>
        
        <div style={styles.formGroup}>
          <label style={styles.label}>내용</label>
          <textarea
            value={customBody}
            onChange={(e) => setCustomBody(e.target.value)}
            placeholder="푸시 알림 내용"
            rows={3}
            style={styles.textarea}
          />
        </div>
        
        <button 
          onClick={sendCustomPush}
          disabled={sending}
          style={styles.sendBtn}
        >
          <Send size={18} />
          <span>{sending ? '발송 중...' : '전체 발송'}</span>
        </button>
      </div>

      {/* 공지사항 푸시 */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <Megaphone size={20} color="#FF6B6B" />
          <h2 style={styles.sectionTitle}>공지사항 푸시</h2>
        </div>
        
        {notices.length === 0 ? (
          <p style={styles.empty}>등록된 공지사항이 없습니다.</p>
        ) : (
          <div style={styles.itemList}>
            {notices.map(notice => (
              <div key={notice.id} style={styles.itemCard}>
                <div style={styles.itemInfo}>
                  <span style={styles.itemTitle}>{notice.title}</span>
                  <span style={styles.itemDate}>{formatDate(notice.createdAt)}</span>
                </div>
                <button
                  onClick={() => sendNoticePush(notice)}
                  disabled={sending}
                  style={styles.itemSendBtn}
                >
                  <Send size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 인기글 푸시 */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <Flame size={20} color="#FF6B6B" />
          <h2 style={styles.sectionTitle}>인기글 푸시</h2>
        </div>
        
        {hotPosts.length === 0 ? (
          <p style={styles.empty}>게시글이 없습니다.</p>
        ) : (
          <div style={styles.itemList}>
            {hotPosts.map((post, index) => (
              <div key={post.id} style={styles.itemCard}>
                <div style={styles.itemInfo}>
                  <div style={styles.itemTitleRow}>
                    <span style={styles.rankBadge}>{index + 1}위</span>
                    <span style={styles.itemTitle}>{post.title}</span>
                  </div>
                  <div style={styles.itemMeta}>
                    <span>❤️ {post.likes || 0}</span>
                    <span>💬 {post.commentsCount || 0}</span>
                    <span>👀 {post.views || 0}</span>
                  </div>
                </div>
                <button
                  onClick={() => sendHotPostPush(post)}
                  disabled={sending}
                  style={styles.itemSendBtn}
                >
                  <Send size={16} />
                </button>
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
    maxWidth: '800px',
    margin: '0 auto',
  },
  loading: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '200px',
    color: '#666',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
  },
  pageTitle: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#333',
  },
  refreshBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '10px 16px',
    backgroundColor: '#f5f5f5',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    color: '#666',
    cursor: 'pointer',
  },
  statsCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '24px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
  },
  statsInfo: {
    display: 'flex',
    flexDirection: 'column',
  },
  statsLabel: {
    fontSize: '13px',
    color: '#999',
  },
  statsValue: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#333',
  },
  resultCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px',
    borderRadius: '8px',
    marginBottom: '24px',
    border: '1px solid',
  },
  resultText: {
    fontSize: '14px',
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '20px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '16px',
    paddingBottom: '12px',
    borderBottom: '1px solid #eee',
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#333',
  },
  formGroup: {
    marginBottom: '16px',
  },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '600',
    color: '#333',
    marginBottom: '8px',
  },
  input: {
    width: '100%',
    padding: '12px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    fontSize: '14px',
    boxSizing: 'border-box',
  },
  textarea: {
    width: '100%',
    padding: '12px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    fontSize: '14px',
    resize: 'vertical',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  },
  sendBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    width: '100%',
    padding: '14px',
    backgroundColor: '#FF6B6B',
    border: 'none',
    borderRadius: '8px',
    fontSize: '15px',
    fontWeight: '600',
    color: '#fff',
    cursor: 'pointer',
  },
  empty: {
    textAlign: 'center',
    color: '#999',
    padding: '20px 0',
  },
  itemList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  itemCard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px',
    backgroundColor: '#f9f9f9',
    borderRadius: '8px',
  },
  itemInfo: {
    flex: 1,
    marginRight: '12px',
  },
  itemTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '4px',
  },
  rankBadge: {
    backgroundColor: '#FFE8E8',
    color: '#FF6B6B',
    fontSize: '11px',
    fontWeight: '700',
    padding: '2px 8px',
    borderRadius: '10px',
  },
  itemTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#333',
    display: 'block',
    marginBottom: '4px',
  },
  itemDate: {
    fontSize: '12px',
    color: '#999',
  },
  itemMeta: {
    display: 'flex',
    gap: '12px',
    fontSize: '12px',
    color: '#666',
  },
  itemSendBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '36px',
    backgroundColor: '#FF6B6B',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    cursor: 'pointer',
  },
};

export default PushNotifications;