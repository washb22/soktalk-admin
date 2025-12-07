import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, doc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { Search, Trash2, MessageSquare, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

const ITEMS_PER_PAGE = 20;

function Comments() {
  const [comments, setComments] = useState([]);
  const [filteredComments, setFilteredComments] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  
  // 날짜 필터
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // 페이지네이션
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    loadComments();
  }, []);

  useEffect(() => {
    let filtered = comments;
    
    // 검색어 필터
    if (searchTerm) {
      filtered = filtered.filter(comment => 
        comment.text?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        comment.userName?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // 날짜 필터
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      filtered = filtered.filter(comment => {
        const commentDate = comment.createdAt?.toDate?.();
        return commentDate && commentDate >= start;
      });
    }
    
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter(comment => {
        const commentDate = comment.createdAt?.toDate?.();
        return commentDate && commentDate <= end;
      });
    }
    
    setFilteredComments(filtered);
    setCurrentPage(1);
  }, [searchTerm, startDate, endDate, comments]);

  const loadComments = async () => {
    try {
      const postsSnapshot = await getDocs(collection(db, 'posts'));
      
      const allComments = [];
      
      for (const postDoc of postsSnapshot.docs) {
        const postData = postDoc.data();
        const commentsQuery = query(
          collection(db, 'posts', postDoc.id, 'comments'),
          orderBy('createdAt', 'desc')
        );
        const commentsSnapshot = await getDocs(commentsQuery);
        
        commentsSnapshot.docs.forEach(commentDoc => {
          allComments.push({
            id: commentDoc.id,
            postId: postDoc.id,
            postTitle: postData.title,
            ...commentDoc.data()
          });
        });
      }
      
      allComments.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || new Date(0);
        const dateB = b.createdAt?.toDate?.() || new Date(0);
        return dateB - dateA;
      });
      
      setComments(allComments);
      setFilteredComments(allComments);
    } catch (error) {
      console.error('댓글 로드 에러:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteComment = async (postId, commentId) => {
    if (!window.confirm('이 댓글을 삭제하시겠습니까?')) return;

    try {
      await deleteDoc(doc(db, 'posts', postId, 'comments', commentId));
      setComments(comments.filter(c => c.id !== commentId));
      alert('삭제되었습니다.');
    } catch (error) {
      console.error('삭제 에러:', error);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp?.toDate) return '-';
    const date = timestamp.toDate();
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  const getDisplayName = (comment) => {
    if (comment.isAnonymous) {
      return '익명';
    }
    return comment.userName || '익명';
  };

  const clearDateFilter = () => {
    setStartDate('');
    setEndDate('');
  };

  // 페이지네이션 계산
  const totalPages = Math.ceil(filteredComments.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentComments = filteredComments.slice(startIndex, endIndex);

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
        <h1 style={styles.pageTitle}>댓글 관리</h1>
        <span style={styles.count}>총 {filteredComments.length}개</span>
      </div>

      {/* 검색 */}
      <div style={styles.searchBox}>
        <Search size={20} color="#999" />
        <input
          type="text"
          placeholder="댓글 내용 또는 작성자로 검색..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={styles.searchInput}
        />
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

      {/* 댓글 목록 */}
      <div style={styles.commentList}>
        {currentComments.length === 0 ? (
          <div style={styles.empty}>
            <MessageSquare size={48} color="#ddd" />
            <p>댓글이 없습니다.</p>
          </div>
        ) : (
          currentComments.map(comment => (
            <div key={comment.id} style={styles.commentCard}>
              <div style={styles.commentHeader}>
                <div style={styles.commentInfo}>
                  <span style={styles.commentAuthor}>{getDisplayName(comment)}</span>
                  <span style={styles.commentDate}>{formatDate(comment.createdAt)}</span>
                </div>
                <button
                  onClick={() => deleteComment(comment.postId, comment.id)}
                  style={styles.deleteBtn}
                >
                  <Trash2 size={16} />
                </button>
              </div>
              
              <p style={styles.commentText}>{comment.text}</p>
              
              <div style={styles.postInfo}>
                <span style={styles.postLabel}>게시글:</span>
                <span style={styles.postTitle}>{comment.postTitle}</span>
              </div>
              
              {comment.replyTo && (
                <div style={styles.replyInfo}>
                  <span>↳ @{comment.replyTo}에게 답글</span>
                </div>
              )}
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
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    backgroundColor: '#fff',
    padding: '12px 16px',
    borderRadius: '8px',
    marginBottom: '12px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
  },
  searchInput: {
    flex: 1,
    border: 'none',
    fontSize: '14px',
    color: '#333',
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
  commentList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  commentCard: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
  },
  commentHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  commentInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  commentAuthor: {
    fontWeight: '600',
    color: '#333',
    fontSize: '14px',
  },
  commentDate: {
    fontSize: '12px',
    color: '#999',
  },
  deleteBtn: {
    padding: '8px',
    backgroundColor: '#FFEBEE',
    borderRadius: '8px',
    color: '#F44336',
  },
  commentText: {
    fontSize: '14px',
    color: '#333',
    lineHeight: '1.6',
    marginBottom: '12px',
  },
  postInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    backgroundColor: '#f9f9f9',
    borderRadius: '6px',
  },
  postLabel: {
    fontSize: '12px',
    color: '#999',
  },
  postTitle: {
    fontSize: '13px',
    color: '#666',
    fontWeight: '500',
  },
  replyInfo: {
    marginTop: '8px',
    fontSize: '12px',
    color: '#FF6B6B',
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    padding: '60px',
    backgroundColor: '#fff',
    borderRadius: '12px',
    color: '#999',
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

export default Comments;
