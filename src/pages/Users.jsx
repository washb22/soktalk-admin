import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { Search, Ban, CheckCircle, Mail, Calendar, User } from 'lucide-react';

function Users() {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (searchTerm) {
      const filtered = users.filter(user => 
        user.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.nickname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredUsers(filtered);
    } else {
      setFilteredUsers(users);
    }
  }, [searchTerm, users]);

  const loadUsers = async () => {
    try {
      // orderBy 제거 - createdAt 없는 사용자도 모두 가져오기
      const snapshot = await getDocs(collection(db, 'users'));
      const usersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // 클라이언트에서 정렬 (createdAt 있는 것 우선, 없으면 맨 뒤)
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
    
    // Firestore Timestamp 객체인 경우
    if (timestamp?.toDate) {
      const date = timestamp.toDate();
      return `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}`;
    }
    
    // 일반 Date 객체이거나 문자열인 경우
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return '-';
      return `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}`;
    } catch {
      return '-';
    }
  };

  const getDisplayName = (user) => {
    return user.displayName || user.nickname || '이름 없음';
  };

  const getInitial = (user) => {
    const name = user.displayName || user.nickname || user.email || '?';
    return name.charAt(0).toUpperCase();
  };

  const getInitialColor = (user) => {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'];
    const name = user.displayName || user.nickname || user.email || '';
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  if (loading) {
    return <div style={styles.loading}>로딩 중...</div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.pageTitle}>회원 관리</h1>
        <span style={styles.totalCount}>총 {users.length}명</span>
      </div>

      {/* 검색 */}
      <div style={styles.searchContainer}>
        <Search size={20} color="#999" />
        <input
          type="text"
          placeholder="이름 또는 이메일로 검색..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={styles.searchInput}
        />
      </div>

      {/* 회원 테이블 */}
      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>회원정보</th>
              <th style={styles.th}>이메일</th>
              <th style={styles.th}>가입일</th>
              <th style={styles.th}>상태</th>
              <th style={styles.th}>관리</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan="5" style={styles.emptyRow}>
                  {searchTerm ? '검색 결과가 없습니다.' : '회원이 없습니다.'}
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => (
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
                      <span style={styles.userName}>{getDisplayName(user)}</span>
                    </div>
                  </td>
                  <td style={styles.td}>
                    <div style={styles.emailContainer}>
                      <Mail size={14} color="#999" />
                      <span>{user.email || '-'}</span>
                    </div>
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
              ))
            )}
          </tbody>
        </table>
      </div>
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
  searchContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    backgroundColor: '#fff',
    padding: '12px 16px',
    borderRadius: '12px',
    marginBottom: '20px',
    border: '1px solid #eee',
  },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    fontSize: '14px',
    backgroundColor: 'transparent',
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
  userName: {
    fontWeight: '500',
  },
  emailContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    color: '#666',
    fontSize: '13px',
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
};

export default Users;