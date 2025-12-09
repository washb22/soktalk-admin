import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { Search, Ban, CheckCircle, Mail, ChevronLeft, ChevronRight, Filter, X, Smartphone } from 'lucide-react';

function Users() {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  
  // 페이지네이션
  const [currentPage, setCurrentPage] = useState(1);
  const usersPerPage = 20;
  
  // 날짜 필터
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showDateFilter, setShowDateFilter] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [searchTerm, users, startDate, endDate]);

  // 필터 적용
  const applyFilters = () => {
    let filtered = [...users];
    
    // 검색어 필터
    if (searchTerm) {
      filtered = filtered.filter(user => 
        user.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.nickname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.id?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // 날짜 필터
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      filtered = filtered.filter(user => {
        const userDate = user.createdAt?.toDate?.() || user.createdAt;
        if (!userDate) return false;
        return new Date(userDate) >= start;
      });
    }
    
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter(user => {
        const userDate = user.createdAt?.toDate?.() || user.createdAt;
        if (!userDate) return false;
        return new Date(userDate) <= end;
      });
    }
    
    setFilteredUsers(filtered);
    setCurrentPage(1);
  };

  const loadUsers = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'users'));
      const usersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      usersData.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || a.createdAt || new Date(0);
        const dateB = b.createdAt?.toDate?.() || b.createdAt || new Date(0);
        return dateB - dateA;
      });
      
      setUsers(usersData);
      setFilteredUsers(usersData);
    } catch (error) {
      console.error('회원 로드 에러:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleBan = async (userId, currentStatus) => {
    const action = currentStatus ? '차단 해제' : '차단';
    if (!window.confirm(`이 회원을 ${action}하시겠습니까?`)) return;

    try {
      await updateDoc(doc(db, 'users', userId), {
        isBanned: !currentStatus,
        bannedAt: !currentStatus ? new Date() : null,
      });
      
      setUsers(users.map(user => 
        user.id === userId 
          ? { ...user, isBanned: !currentStatus }
          : user
      ));
      
      alert(`${action}되었습니다.`);
    } catch (error) {
      console.error('차단 처리 에러:', error);
      alert('처리 중 오류가 발생했습니다.');
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '-';
    
    if (timestamp?.toDate) {
      const date = timestamp.toDate();
      return `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}`;
    }
    
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return '-';
      return `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}`;
    } catch {
      return '-';
    }
  };

  // 이름 표시 (없으면 UID 앞 8자리)
  const getDisplayName = (user) => {
    if (user.displayName && user.displayName.trim()) return user.displayName;
    if (user.nickname && user.nickname.trim()) return user.nickname;
    // 이름 없으면 UID 앞 8자리
    return `사용자_${user.id?.substring(0, 8) || '???'}`;
  };

  // 이메일 표시 (없으면 숨김 처리된 것으로 표시)
  const getDisplayEmail = (user) => {
    if (user.email && user.email.trim()) return user.email;
    return '(이메일 숨김)';
  };

  // 로그인 방식 뱃지
  const getProviderBadge = (user) => {
    const provider = user.provider?.toLowerCase();
    if (provider === 'apple') {
      return { text: 'Apple', color: '#000', bg: '#f5f5f5' };
    } else if (provider === 'google') {
      return { text: 'Google', color: '#4285F4', bg: '#E8F0FE' };
    } else if (provider === 'email' || user.email?.includes('@')) {
      return { text: '이메일', color: '#666', bg: '#f0f0f0' };
    }
    return null;
  };

  const getInitial = (user) => {
    const name = user.displayName || user.nickname || '';
    if (name.trim()) return name.charAt(0).toUpperCase();
    // 이름 없으면 provider 첫글자
    if (user.provider === 'apple') return 'A';
    if (user.provider === 'google') return 'G';
    return '?';
  };

  const getInitialColor = (user) => {
    if (user.provider === 'apple') return '#000';
    if (user.provider === 'google') return '#4285F4';
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'];
    const name = user.displayName || user.nickname || user.email || user.id || '';
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const clearDateFilter = () => {
    setStartDate('');
    setEndDate('');
  };

  // 페이지네이션 계산
  const totalPages = Math.ceil(filteredUsers.length / usersPerPage);
  const startIndex = (currentPage - 1) * usersPerPage;
  const endIndex = startIndex + usersPerPage;
  const currentUsers = filteredUsers.slice(startIndex, endIndex);

  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
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
        <h1 style={styles.pageTitle}>회원 관리</h1>
        <span style={styles.totalCount}>총 {filteredUsers.length}명</span>
      </div>

      {/* 검색 & 필터 */}
      <div style={styles.filterContainer}>
        <div style={styles.searchContainer}>
          <Search size={20} color="#999" />
          <input
            type="text"
            placeholder="이름, 이메일 또는 UID로 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={styles.searchInput}
          />
        </div>
        
        <button 
          onClick={() => setShowDateFilter(!showDateFilter)}
          style={{
            ...styles.filterBtn,
            backgroundColor: (startDate || endDate) ? '#FFF0F0' : '#f5f5f5',
            color: (startDate || endDate) ? '#FF6B6B' : '#666',
          }}
        >
          <Filter size={18} />
          <span>날짜 필터</span>
          {(startDate || endDate) && <span style={styles.filterBadge}>ON</span>}
        </button>
      </div>

      {/* 날짜 필터 패널 */}
      {showDateFilter && (
        <div style={styles.dateFilterPanel}>
          <div style={styles.dateFilterRow}>
            <div style={styles.dateField}>
              <label style={styles.dateLabel}>시작일</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={styles.dateInput}
              />
            </div>
            <span style={styles.dateSeparator}>~</span>
            <div style={styles.dateField}>
              <label style={styles.dateLabel}>종료일</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={styles.dateInput}
              />
            </div>
            {(startDate || endDate) && (
              <button onClick={clearDateFilter} style={styles.clearFilterBtn}>
                <X size={16} />
                <span>초기화</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 회원 테이블 */}
      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>회원정보</th>
              <th style={styles.th}>이메일</th>
              <th style={styles.th}>가입방식</th>
              <th style={styles.th}>가입일</th>
              <th style={styles.th}>상태</th>
              <th style={styles.th}>관리</th>
            </tr>
          </thead>
          <tbody>
            {currentUsers.length === 0 ? (
              <tr>
                <td colSpan="6" style={styles.emptyRow}>
                  {searchTerm || startDate || endDate ? '검색 결과가 없습니다.' : '회원이 없습니다.'}
                </td>
              </tr>
            ) : (
              currentUsers.map((user) => {
                const providerBadge = getProviderBadge(user);
                return (
                  <tr key={user.id} style={styles.tr}>
                    <td style={styles.td}>
                      <div style={styles.userInfo}>
                        <div 
                          style={{
                            ...styles.avatar,
                            backgroundColor: getInitialColor(user)
                          }}
                        >
                          {getInitial(user)}
                        </div>
                        <div style={styles.userNameContainer}>
                          <span style={styles.userName}>{getDisplayName(user)}</span>
                          <span style={styles.userId}>ID: {user.id?.substring(0, 12)}...</span>
                        </div>
                      </div>
                    </td>
                    <td style={styles.td}>
                      <div style={styles.emailContainer}>
                        <Mail size={14} color="#999" />
                        <span style={{
                          color: user.email ? '#666' : '#bbb',
                          fontStyle: user.email ? 'normal' : 'italic',
                        }}>
                          {getDisplayEmail(user)}
                        </span>
                      </div>
                    </td>
                    <td style={styles.td}>
                      {providerBadge && (
                        <span style={{
                          ...styles.providerBadge,
                          backgroundColor: providerBadge.bg,
                          color: providerBadge.color,
                        }}>
                          {providerBadge.text}
                        </span>
                      )}
                    </td>
                    <td style={styles.td}>
                      {formatDate(user.createdAt)}
                    </td>
                    <td style={styles.td}>
                      <span style={{
                        ...styles.statusBadge,
                        backgroundColor: user.isBanned ? '#FFEBEE' : '#E8F5E9',
                        color: user.isBanned ? '#F44336' : '#4CAF50',
                      }}>
                        {user.isBanned ? '차단됨' : '활성'}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <button
                        onClick={() => toggleBan(user.id, user.isBanned)}
                        style={{
                          ...styles.actionBtn,
                          backgroundColor: user.isBanned ? '#E8F5E9' : '#FFEBEE',
                          color: user.isBanned ? '#4CAF50' : '#F44336',
                        }}
                      >
                        {user.isBanned ? (
                          <>
                            <CheckCircle size={14} />
                            <span>해제</span>
                          </>
                        ) : (
                          <>
                            <Ban size={14} />
                            <span>차단</span>
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
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
          
          {getPageNumbers().map((page) => (
            <button
              key={page}
              onClick={() => goToPage(page)}
              style={{
                ...styles.pageBtn,
                backgroundColor: currentPage === page ? '#FF6B6B' : '#fff',
                color: currentPage === page ? '#fff' : '#666',
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
            {startIndex + 1}-{Math.min(endIndex, filteredUsers.length)} / {filteredUsers.length}명
          </span>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    padding: '0',
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
    margin: 0,
  },
  totalCount: {
    fontSize: '14px',
    color: '#999',
    backgroundColor: '#f5f5f5',
    padding: '4px 12px',
    borderRadius: '12px',
  },
  loading: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '200px',
    color: '#999',
  },
  filterContainer: {
    display: 'flex',
    gap: '12px',
    marginBottom: '16px',
  },
  searchContainer: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    backgroundColor: '#fff',
    padding: '12px 16px',
    borderRadius: '12px',
    border: '1px solid #eee',
  },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    fontSize: '14px',
    backgroundColor: 'transparent',
  },
  filterBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 16px',
    borderRadius: '12px',
    border: '1px solid #eee',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
  },
  filterBadge: {
    backgroundColor: '#FF6B6B',
    color: '#fff',
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '10px',
    fontWeight: '600',
  },
  dateFilterPanel: {
    backgroundColor: '#fff',
    padding: '16px',
    borderRadius: '12px',
    marginBottom: '16px',
    border: '1px solid #eee',
  },
  dateFilterRow: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '12px',
  },
  dateField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  dateLabel: {
    fontSize: '12px',
    color: '#666',
    fontWeight: '500',
  },
  dateInput: {
    padding: '10px 12px',
    border: '1px solid #eee',
    borderRadius: '8px',
    fontSize: '14px',
  },
  dateSeparator: {
    color: '#999',
    paddingBottom: '10px',
  },
  clearFilterBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '10px 16px',
    backgroundColor: '#f5f5f5',
    color: '#666',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '13px',
  },
  tableContainer: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    overflow: 'hidden',
    border: '1px solid #eee',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    padding: '16px',
    backgroundColor: '#f9f9f9',
    fontSize: '13px',
    fontWeight: '600',
    color: '#666',
    borderBottom: '1px solid #eee',
  },
  tr: {
    borderBottom: '1px solid #f5f5f5',
  },
  td: {
    padding: '16px',
    fontSize: '14px',
    color: '#333',
    verticalAlign: 'middle',
  },
  emptyRow: {
    padding: '40px',
    textAlign: 'center',
    color: '#999',
    fontSize: '14px',
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  avatar: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontWeight: '600',
    fontSize: '14px',
  },
  userNameContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  userName: {
    fontWeight: '500',
  },
  userId: {
    fontSize: '11px',
    color: '#999',
  },
  emailContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13px',
  },
  providerBadge: {
    padding: '4px 10px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '500',
  },
  statusBadge: {
    padding: '4px 10px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '500',
  },
  actionBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '6px 12px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
    border: 'none',
  },
  pagination: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    marginTop: '20px',
    padding: '16px',
    backgroundColor: '#fff',
    borderRadius: '12px',
    border: '1px solid #eee',
  },
  pageBtn: {
    width: '36px',
    height: '36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '8px',
    border: '1px solid #eee',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    backgroundColor: '#fff',
  },
  pageInfo: {
    marginLeft: '16px',
    fontSize: '13px',
    color: '#999',
  },
};

export default Users;