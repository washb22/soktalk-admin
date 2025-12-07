import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { Search, Ban, CheckCircle, Mail } from 'lucide-react';

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
        user.email?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredUsers(filtered);
    } else {
      setFilteredUsers(users);
    }
  }, [searchTerm, users]);

  const loadUsers = async () => {
    try {
      const usersQuery = query(
        collection(db, 'users'),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(usersQuery);
      const usersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
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
    if (!timestamp?.toDate) return '-';
    const date = timestamp.toDate();
    return `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}`;
  };

  if (loading) {
    return <div style={styles.loading}>로딩 중...</div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.pageTitle}>회원 관리</h1>
        <span style={styles.count}>총 {users.length}명</span>
      </div>

      {/* 검색 */}
      <div style={styles.searchBox}>
        <Search size={20} color="#999" />
        <input
          type="text"
          placeholder="이름 또는 이메일로 검색..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={styles.searchInput}
        />
      </div>

      {/* 회원 목록 */}
      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead>
            <tr style={styles.tableHeader}>
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
                <td colSpan="5" style={styles.empty}>회원이 없습니다.</td>
              </tr>
            ) : (
              filteredUsers.map(user => (
                <tr key={user.id} style={styles.tableRow}>
                  <td style={styles.td}>
                    <div style={styles.userInfo}>
                      <div style={styles.avatar}>
                        {(user.displayName || user.email || '?')[0].toUpperCase()}
                      </div>
                      <span style={styles.userName}>{user.displayName || '이름 없음'}</span>
                    </div>
                  </td>
                  <td style={styles.td}>
                    <div style={styles.emailCell}>
                      <Mail size={14} color="#999" />
                      <span>{user.email || '-'}</span>
                    </div>
                  </td>
                  <td style={styles.td}>{formatDate(user.createdAt)}</td>
                  <td style={styles.td}>
                    {user.isBanned ? (
                      <span style={styles.bannedBadge}>차단됨</span>
                    ) : (
                      <span style={styles.activeBadge}>활성</span>
                    )}
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
    marginBottom: '16px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
  },
  searchInput: {
    flex: 1,
    border: 'none',
    fontSize: '14px',
    color: '#333',
  },
  tableContainer: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    overflow: 'hidden',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  tableHeader: {
    backgroundColor: '#f9f9f9',
  },
  th: {
    padding: '16px',
    textAlign: 'left',
    fontSize: '14px',
    fontWeight: '600',
    color: '#666',
    borderBottom: '1px solid #eee',
  },
  tableRow: {
    borderBottom: '1px solid #f5f5f5',
  },
  td: {
    padding: '16px',
    fontSize: '14px',
    color: '#333',
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
    backgroundColor: '#FF6B6B',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    fontWeight: '600',
  },
  userName: {
    fontWeight: '500',
  },
  emailCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#666',
  },
  activeBadge: {
    backgroundColor: '#E8F5E9',
    color: '#4CAF50',
    padding: '4px 12px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '500',
  },
  bannedBadge: {
    backgroundColor: '#FFEBEE',
    color: '#F44336',
    padding: '4px 12px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '500',
  },
  actionBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 12px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '500',
  },
  empty: {
    textAlign: 'center',
    padding: '40px',
    color: '#999',
  },
};

export default Users;
