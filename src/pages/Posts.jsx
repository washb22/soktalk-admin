import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, getDocs, doc, deleteDoc, updateDoc, query, orderBy } from 'firebase/firestore';
import { Search, Trash2, Eye, EyeOff, Heart, MessageSquare, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

const ITEMS_PER_PAGE = 20;

function Posts() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [filteredPosts, setFilteredPosts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  
  // 날짜 필터
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // 페이지네이션
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    loadPosts();
  }, []);

  // 필터링 로직 (posts 변경시에도 실행, 페이지 유지)
  useEffect(() => {
    let filtered = posts;
    
    // 카테고리 필터
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(post => post.category === categoryFilter);
    }
    
    // 검색어 필터
    if (searchTerm) {
      filtered = filtered.filter(post => 
        post.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        post.content?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // 날짜 필터
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      filtered = filtered.filter(post => {
        const postDate = post.createdAt?.toDate?.();
        return postDate && postDate >= start;
      });
    }
    
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter(post => {
        const postDate = post.createdAt?.toDate?.();
        return postDate && postDate <= end;
      });
    }
    
    setFilteredPosts(filtered);
    
    // 현재 페이지가 총 페이지를 초과하면 마지막 페이지로 이동
    const newTotalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
    if (currentPage > newTotalPages && newTotalPages > 0) {
      setCurrentPage(newTotalPages);
    }
  }, [searchTerm, categoryFilter, startDate, endDate, posts]);

  // 필터 조건 변경시에만 1페이지로 이동 (posts 변경은 제외)
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, categoryFilter, startDate, endDate]);

  const loadPosts = async () => {
    try {
      const postsQuery = query(
        collection(db, 'posts'),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(postsQuery);
      const postsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPosts(postsData);
      setFilteredPosts(postsData);
    } catch (error) {
      console.error('게시글 로드 에러:', error);
    } finally {
      setLoading(false);
    }
  };

  const deletePost = async (postId) => {
    if (!window.confirm('이 게시글을 삭제하시겠습니까?')) return;
  
    try {
      await deleteDoc(doc(db, 'posts', postId));
      const newPosts = posts.filter(post => post.id !== postId);
      setPosts(newPosts);
      
      alert('삭제되었습니다.');
    } catch (error) {
      console.error('삭제 에러:', error);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  const toggleHidden = async (postId, currentStatus) => {
    try {
      await updateDoc(doc(db, 'posts', postId), {
        isHidden: !currentStatus,
      });
      
      setPosts(posts.map(post => 
        post.id === postId 
          ? { ...post, isHidden: !currentStatus }
          : post
      ));
      
      alert(currentStatus ? '게시글이 공개되었습니다.' : '게시글이 숨김 처리되었습니다.');
    } catch (error) {
      console.error('숨김 처리 에러:', error);
      alert('처리 중 오류가 발생했습니다.');
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp?.toDate) return '-';
    const date = timestamp.toDate();
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  const clearDateFilter = () => {
    setStartDate('');
    setEndDate('');
  };

  // 페이지네이션 계산
  const totalPages = Math.ceil(filteredPosts.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentPosts = filteredPosts.slice(startIndex, endIndex);

  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    
    let start = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let end = Math.min(totalPages, start + maxVisiblePages - 1);
    
    if (end - start + 1 < maxVisiblePages) {
      start = Math.max(1, end - maxVisiblePages + 1);
    }
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    
    return pages;
  };

  if (loading) {
    return <div style={styles.loading}>로딩 중...</div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.pageTitle}>게시글 관리</h1>
        <span style={styles.count}>총 {filteredPosts.length}개</span>
      </div>

      {/* 필터 & 검색 */}
      <div style={styles.filterBar}>
        <div style={styles.searchBox}>
          <Search size={20} color="#999" />
          <input
            type="text"
            placeholder="제목 또는 내용으로 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={styles.searchInput}
          />
        </div>
        
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          style={styles.select}
        >
          <option value="all">전체 카테고리</option>
          <option value="연애상담">연애상담</option>
          <option value="잡담">잡담</option>
        </select>
      </div>

      {/* 날짜 필터 */}
      <div style={styles.dateFilterBar}>
        <Calendar size={18} color="#666" />
        <span style={styles.dateLabel}>기간:</span>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          style={styles.dateInput}
        />
        <span style={styles.dateSeparator}>~</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          style={styles.dateInput}
        />
        {(startDate || endDate) && (
          <button onClick={clearDateFilter} style={styles.clearBtn}>
            초기화
          </button>
        )}
      </div>

      {/* 게시글 목록 */}
      <div style={styles.postList}>
        {currentPosts.length === 0 ? (
          <div style={styles.empty}>게시글이 없습니다.</div>
        ) : (
          currentPosts.map(post => (
            <div 
              key={post.id} 
              style={{
                ...styles.postCard,
                opacity: post.isHidden ? 0.6 : 1,
                cursor: 'pointer',
              }}
              onClick={() => navigate(`/posts/${post.id}`)}
            >
              <div style={styles.postHeader}>
                <span style={styles.category}>{post.category || '일반'}</span>
                {post.isHidden && <span style={styles.hiddenBadge}>숨김</span>}
                <span style={styles.date}>{formatDate(post.createdAt)}</span>
              </div>
              
              <h3 style={styles.postTitle}>{post.title}</h3>
              <p style={styles.postContent}>{post.content}</p>
              
              <div style={styles.postFooter}>
                <div style={styles.postStats}>
                  <span style={styles.stat}>
                    <Eye size={14} />
                    {post.views || 0}
                  </span>
                  <span style={styles.stat}>
                    <Heart size={14} />
                    {post.likesArray?.length || 0}
                  </span>
                  <span style={styles.stat}>
                    <MessageSquare size={14} />
                    {post.commentsCount || 0}
                  </span>
                </div>
                
                <div style={styles.postActions}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleHidden(post.id, post.isHidden);
                    }}
                    style={{
                      ...styles.actionBtn,
                      backgroundColor: post.isHidden ? '#E3F2FD' : '#FFF3E0',
                    }}
                  >
                    {post.isHidden ? <Eye size={16} color="#1976D2" /> : <EyeOff size={16} color="#FF9800" />}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deletePost(post.id);
                    }}
                    style={{...styles.actionBtn, backgroundColor: '#FFEBEE'}}
                  >
                    <Trash2 size={16} color="#F44336" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div style={styles.pagination}>
          <button
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1}
            style={{
              ...styles.pageBtn,
              opacity: currentPage === 1 ? 0.5 : 1,
            }}
          >
            <ChevronLeft size={18} />
          </button>
          
          {getPageNumbers().map(page => (
            <button
              key={page}
              onClick={() => goToPage(page)}
              style={{
                ...styles.pageBtn,
                backgroundColor: currentPage === page ? '#FF6B6B' : '#fff',
                color: currentPage === page ? '#fff' : '#333',
              }}
            >
              {page}
            </button>
          ))}
          
          <button
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage === totalPages}
            style={{
              ...styles.pageBtn,
              opacity: currentPage === totalPages ? 0.5 : 1,
            }}
          >
            <ChevronRight size={18} />
          </button>
          
          <span style={styles.pageInfo}>
            {currentPage} / {totalPages} 페이지
          </span>
        </div>
      )}
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
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '24px',
  },
  pageTitle: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#333',
  },
  count: {
    fontSize: '14px',
    color: '#999',
    backgroundColor: '#f5f5f5',
    padding: '4px 12px',
    borderRadius: '12px',
  },
  filterBar: {
    display: 'flex',
    gap: '12px',
    marginBottom: '12px',
  },
  searchBox: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    backgroundColor: '#fff',
    padding: '12px 16px',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
  },
  searchInput: {
    flex: 1,
    border: 'none',
    fontSize: '14px',
    color: '#333',
  },
  select: {
    padding: '12px 16px',
    borderRadius: '8px',
    border: '1px solid #eee',
    backgroundColor: '#fff',
    fontSize: '14px',
    color: '#333',
    cursor: 'pointer',
  },
  dateFilterBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    backgroundColor: '#fff',
    padding: '12px 16px',
    borderRadius: '8px',
    marginBottom: '16px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
  },
  dateLabel: {
    fontSize: '14px',
    color: '#666',
    fontWeight: '500',
  },
  dateInput: {
    padding: '8px 12px',
    border: '1px solid #eee',
    borderRadius: '6px',
    fontSize: '14px',
    color: '#333',
  },
  dateSeparator: {
    color: '#999',
  },
  clearBtn: {
    padding: '8px 16px',
    backgroundColor: '#f5f5f5',
    borderRadius: '6px',
    fontSize: '13px',
    color: '#666',
    marginLeft: 'auto',
  },
  postList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  postCard: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
  },
  postHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '12px',
  },
  category: {
    backgroundColor: '#FFF0F0',
    color: '#FF6B6B',
    padding: '4px 10px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '500',
  },
  hiddenBadge: {
    backgroundColor: '#FFF3E0',
    color: '#FF9800',
    padding: '4px 10px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '500',
  },
  date: {
    marginLeft: 'auto',
    fontSize: '12px',
    color: '#999',
  },
  postTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#333',
    marginBottom: '8px',
  },
  postContent: {
    fontSize: '14px',
    color: '#666',
    lineHeight: '1.5',
    marginBottom: '16px',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  postFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  postStats: {
    display: 'flex',
    gap: '16px',
  },
  stat: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '13px',
    color: '#999',
  },
  postActions: {
    display: 'flex',
    gap: '8px',
  },
  actionBtn: {
    padding: '8px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    textAlign: 'center',
    padding: '60px',
    color: '#999',
    backgroundColor: '#fff',
    borderRadius: '12px',
  },
  pagination: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    marginTop: '24px',
    padding: '16px',
    backgroundColor: '#fff',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
  },
  pageBtn: {
    width: '36px',
    height: '36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '8px',
    border: '1px solid #eee',
    backgroundColor: '#fff',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
  },
  pageInfo: {
    marginLeft: '16px',
    fontSize: '13px',
    color: '#999',
  },
};

export default Posts;