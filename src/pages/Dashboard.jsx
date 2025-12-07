import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { Users, FileText, MessageSquare, Heart, TrendingUp, Calendar } from 'lucide-react';

function Dashboard() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalPosts: 0,
    totalComments: 0,
    totalReports: 0,
    todayUsers: 0,
    todayPosts: 0,
  });
  const [recentPosts, setRecentPosts] = useState([]);
  const [recentUsers, setRecentUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // 전체 통계
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const postsSnapshot = await getDocs(collection(db, 'posts'));
      const reportsSnapshot = await getDocs(collection(db, 'reports'));

      // 댓글 수 계산 (각 게시글의 comments 서브컬렉션)
      let totalComments = 0;
      for (const postDoc of postsSnapshot.docs) {
        const commentsSnapshot = await getDocs(collection(db, 'posts', postDoc.id, 'comments'));
        totalComments += commentsSnapshot.size;
      }

      // 오늘 날짜
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // 오늘 가입자
      let todayUsers = 0;
      usersSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.createdAt?.toDate && data.createdAt.toDate() >= today) {
          todayUsers++;
        }
      });

      // 오늘 게시글
      let todayPosts = 0;
      postsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.createdAt?.toDate && data.createdAt.toDate() >= today) {
          todayPosts++;
        }
      });

      setStats({
        totalUsers: usersSnapshot.size,
        totalPosts: postsSnapshot.size,
        totalComments,
        totalReports: reportsSnapshot.size,
        todayUsers,
        todayPosts,
      });

      // 최근 게시글
      const recentPostsQuery = query(
        collection(db, 'posts'),
        orderBy('createdAt', 'desc'),
        limit(5)
      );
      const recentPostsSnapshot = await getDocs(recentPostsQuery);
      setRecentPosts(recentPostsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })));

      // 최근 가입자
      const recentUsersQuery = query(
        collection(db, 'users'),
        orderBy('createdAt', 'desc'),
        limit(5)
      );
      const recentUsersSnapshot = await getDocs(recentUsersQuery);
      setRecentUsers(recentUsersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })));

    } catch (error) {
      console.error('대시보드 데이터 로드 에러:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp?.toDate) return '-';
    const date = timestamp.toDate();
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  if (loading) {
    return <div style={styles.loading}>로딩 중...</div>;
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.pageTitle}>대시보드</h1>
      
      {/* 통계 카드들 */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={{...styles.statIcon, backgroundColor: '#E3F2FD'}}>
            <Users size={24} color="#1976D2" />
          </div>
          <div style={styles.statInfo}>
            <p style={styles.statLabel}>전체 회원</p>
            <p style={styles.statValue}>{stats.totalUsers}</p>
          </div>
        </div>
        
        <div style={styles.statCard}>
          <div style={{...styles.statIcon, backgroundColor: '#FFF0F0'}}>
            <FileText size={24} color="#FF6B6B" />
          </div>
          <div style={styles.statInfo}>
            <p style={styles.statLabel}>전체 게시글</p>
            <p style={styles.statValue}>{stats.totalPosts}</p>
          </div>
        </div>
        
        <div style={styles.statCard}>
          <div style={{...styles.statIcon, backgroundColor: '#E8F5E9'}}>
            <MessageSquare size={24} color="#4CAF50" />
          </div>
          <div style={styles.statInfo}>
            <p style={styles.statLabel}>전체 댓글</p>
            <p style={styles.statValue}>{stats.totalComments}</p>
          </div>
        </div>
        
        <div style={styles.statCard}>
          <div style={{...styles.statIcon, backgroundColor: '#FFF3E0'}}>
            <TrendingUp size={24} color="#FF9800" />
          </div>
          <div style={styles.statInfo}>
            <p style={styles.statLabel}>신고</p>
            <p style={styles.statValue}>{stats.totalReports}</p>
          </div>
        </div>
      </div>

      {/* 오늘 통계 */}
      <div style={styles.todayStats}>
        <div style={styles.todayCard}>
          <Calendar size={20} color="#666" />
          <span>오늘 가입: <strong>{stats.todayUsers}명</strong></span>
        </div>
        <div style={styles.todayCard}>
          <FileText size={20} color="#666" />
          <span>오늘 게시글: <strong>{stats.todayPosts}개</strong></span>
        </div>
      </div>

      {/* 최근 데이터 */}
      <div style={styles.recentGrid}>
        {/* 최근 게시글 */}
        <div style={styles.recentCard}>
          <h2 style={styles.recentTitle}>최근 게시글</h2>
          <div style={styles.recentList}>
            {recentPosts.length === 0 ? (
              <p style={styles.empty}>게시글이 없습니다.</p>
            ) : (
              recentPosts.map(post => (
                <div key={post.id} style={styles.recentItem}>
                  <div style={styles.recentItemInfo}>
                    <span style={styles.category}>{post.category || '일반'}</span>
                    <p style={styles.recentItemTitle}>{post.title}</p>
                  </div>
                  <span style={styles.recentItemDate}>{formatDate(post.createdAt)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 최근 가입자 */}
        <div style={styles.recentCard}>
          <h2 style={styles.recentTitle}>최근 가입자</h2>
          <div style={styles.recentList}>
            {recentUsers.length === 0 ? (
              <p style={styles.empty}>가입자가 없습니다.</p>
            ) : (
              recentUsers.map(user => (
                <div key={user.id} style={styles.recentItem}>
                  <div style={styles.recentItemInfo}>
                    <p style={styles.recentItemTitle}>{user.displayName || user.email || '익명'}</p>
                    <span style={styles.recentItemSub}>{user.email}</span>
                  </div>
                  <span style={styles.recentItemDate}>{formatDate(user.createdAt)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
  },
  loading: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '200px',
    color: '#666',
  },
  pageTitle: {
    fontSize: '24px',
    fontWeight: '700',
    marginBottom: '24px',
    color: '#333',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '24px',
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
  },
  statIcon: {
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statInfo: {
    flex: 1,
  },
  statLabel: {
    fontSize: '14px',
    color: '#666',
    marginBottom: '4px',
  },
  statValue: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#333',
  },
  todayStats: {
    display: 'flex',
    gap: '16px',
    marginBottom: '24px',
  },
  todayCard: {
    backgroundColor: '#fff',
    borderRadius: '8px',
    padding: '12px 20px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    color: '#666',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
  },
  recentGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
    gap: '24px',
  },
  recentCard: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
  },
  recentTitle: {
    fontSize: '16px',
    fontWeight: '600',
    marginBottom: '16px',
    color: '#333',
  },
  recentList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  recentItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px',
    backgroundColor: '#f9f9f9',
    borderRadius: '8px',
  },
  recentItemInfo: {
    flex: 1,
    minWidth: 0,
  },
  category: {
    fontSize: '12px',
    color: '#FF6B6B',
    marginBottom: '4px',
    display: 'inline-block',
  },
  recentItemTitle: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#333',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  recentItemSub: {
    fontSize: '12px',
    color: '#999',
  },
  recentItemDate: {
    fontSize: '12px',
    color: '#999',
    marginLeft: '12px',
    flexShrink: 0,
  },
  empty: {
    textAlign: 'center',
    color: '#999',
    padding: '20px',
  },
};

export default Dashboard;
