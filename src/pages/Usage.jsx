import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { 
  collection, 
  getDocs, 
  query, 
  orderBy,
  collectionGroup,
  doc,
  getDoc
} from 'firebase/firestore';
import { 
  Heart, 
  MessageCircle, 
  Search, 
  Calendar,
  User,
  TrendingUp,
  RefreshCw,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

function Usage() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [usageData, setUsageData] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [expandedUser, setExpandedUser] = useState(null);
  const [stats, setStats] = useState({
    totalCompatibility: 0,
    totalAdvice: 0,
    todayCompatibility: 0,
    todayAdvice: 0,
  });

  useEffect(() => {
    loadUsageData();
  }, []);

  const loadUsageData = async () => {
    setLoading(true);
    try {
      // 1. 모든 사용자 로드
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersData = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsers(usersData);

      // 2. 각 사용자별 사용 기록 로드
      const allUsageData = [];
      let totalCompatibility = 0;
      let totalAdvice = 0;
      let todayCompatibility = 0;
      let todayAdvice = 0;
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (const user of usersData) {
        // 궁합 분석 기록
        const compatibilityRef = collection(db, 'users', user.id, 'compatibilityHistory');
        const compatibilityQuery = query(compatibilityRef, orderBy('createdAt', 'desc'));
        const compatibilitySnapshot = await getDocs(compatibilityQuery);
        
        const compatibilityRecords = compatibilitySnapshot.docs.map(doc => ({
          id: doc.id,
          type: 'compatibility',
          ...doc.data()
        }));

        // 조언 기록
        const adviceRef = collection(db, 'users', user.id, 'adviceHistory');
        const adviceQuery = query(adviceRef, orderBy('createdAt', 'desc'));
        const adviceSnapshot = await getDocs(adviceQuery);
        
        const adviceRecords = adviceSnapshot.docs.map(doc => ({
          id: doc.id,
          type: 'advice',
          ...doc.data()
        }));

        // 통계 계산
        totalCompatibility += compatibilityRecords.length;
        totalAdvice += adviceRecords.length;

        // 오늘 사용량
        compatibilityRecords.forEach(record => {
          const recordDate = record.createdAt?.toDate?.() || new Date(0);
          if (recordDate >= today) {
            todayCompatibility++;
          }
        });

        adviceRecords.forEach(record => {
          const recordDate = record.createdAt?.toDate?.() || new Date(0);
          if (recordDate >= today) {
            todayAdvice++;
          }
        });

        if (compatibilityRecords.length > 0 || adviceRecords.length > 0) {
          allUsageData.push({
            userId: user.id,
            userName: user.displayName || user.email || '이름 없음',
            email: user.email || '-',
            compatibilityCount: compatibilityRecords.length,
            adviceCount: adviceRecords.length,
            compatibilityRecords,
            adviceRecords,
            lastUsed: getLastUsedDate(compatibilityRecords, adviceRecords),
          });
        }
      }

      // 최근 사용순 정렬
      allUsageData.sort((a, b) => {
        const aDate = a.lastUsed || new Date(0);
        const bDate = b.lastUsed || new Date(0);
        return bDate - aDate;
      });

      setUsageData(allUsageData);
      setStats({
        totalCompatibility,
        totalAdvice,
        todayCompatibility,
        todayAdvice,
      });

    } catch (error) {
      console.error('사용 현황 로드 에러:', error);
    } finally {
      setLoading(false);
    }
  };

  const getLastUsedDate = (compatibilityRecords, adviceRecords) => {
    const allRecords = [...compatibilityRecords, ...adviceRecords];
    if (allRecords.length === 0) return null;
    
    const dates = allRecords.map(r => r.createdAt?.toDate?.() || new Date(0));
    return new Date(Math.max(...dates));
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '-';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  const formatDateShort = (date) => {
    if (!date) return '-';
    return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  // 필터링
  const filteredData = usageData.filter(user => {
    // 검색어 필터
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      if (!user.userName.toLowerCase().includes(term) && 
          !user.email.toLowerCase().includes(term) &&
          !user.userId.toLowerCase().includes(term)) {
        return false;
      }
    }
    
    // 날짜 필터
    if (startDate || endDate) {
      const start = startDate ? new Date(startDate) : new Date(0);
      const end = endDate ? new Date(endDate) : new Date();
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      
      if (!user.lastUsed || user.lastUsed < start || user.lastUsed > end) {
        return false;
      }
    }
    
    return true;
  });

  const toggleExpand = (userId) => {
    setExpandedUser(expandedUser === userId ? null : userId);
  };

  if (loading) {
    return <div style={styles.loading}>사용 현황 로딩 중...</div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.pageTitle}>📊 궁합/조언 사용 현황</h1>
        <button onClick={loadUsageData} style={styles.refreshBtn}>
          <RefreshCw size={18} />
          <span>새로고침</span>
        </button>
      </div>

      {/* 통계 카드 */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={{...styles.statIcon, backgroundColor: '#FFE0E0'}}>
            <Heart size={24} color="#FF6B6B" />
          </div>
          <div style={styles.statInfo}>
            <p style={styles.statLabel}>전체 궁합 분석</p>
            <p style={styles.statValue}>{stats.totalCompatibility}회</p>
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={{...styles.statIcon, backgroundColor: '#E0F0FF'}}>
            <MessageCircle size={24} color="#4A90D9" />
          </div>
          <div style={styles.statInfo}>
            <p style={styles.statLabel}>전체 조언</p>
            <p style={styles.statValue}>{stats.totalAdvice}회</p>
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={{...styles.statIcon, backgroundColor: '#E8F5E9'}}>
            <TrendingUp size={24} color="#4CAF50" />
          </div>
          <div style={styles.statInfo}>
            <p style={styles.statLabel}>오늘 궁합</p>
            <p style={styles.statValue}>{stats.todayCompatibility}회</p>
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={{...styles.statIcon, backgroundColor: '#FFF3E0'}}>
            <Calendar size={24} color="#FF9800" />
          </div>
          <div style={styles.statInfo}>
            <p style={styles.statLabel}>오늘 조언</p>
            <p style={styles.statValue}>{stats.todayAdvice}회</p>
          </div>
        </div>
      </div>

      {/* 필터 */}
      <div style={styles.filterSection}>
        <div style={styles.searchBox}>
          <Search size={18} color="#999" />
          <input
            type="text"
            placeholder="이름, 이메일, UID로 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={styles.searchInput}
          />
        </div>

        <div style={styles.dateFilters}>
          <div style={styles.dateInput}>
            <Calendar size={16} color="#999" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={styles.dateField}
            />
          </div>
          <span style={styles.dateSeparator}>~</span>
          <div style={styles.dateInput}>
            <Calendar size={16} color="#999" />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={styles.dateField}
            />
          </div>
          {(startDate || endDate) && (
            <button 
              onClick={() => { setStartDate(''); setEndDate(''); }}
              style={styles.clearBtn}
            >
              초기화
            </button>
          )}
        </div>
      </div>

      {/* 사용자 목록 */}
      <div style={styles.listCard}>
        <div style={styles.listHeader}>
          <span style={styles.listTitle}>사용자별 현황</span>
          <span style={styles.listCount}>{filteredData.length}명</span>
        </div>

        {filteredData.length === 0 ? (
          <p style={styles.empty}>사용 기록이 없습니다.</p>
        ) : (
          <div style={styles.userList}>
            {filteredData.map(user => (
              <div key={user.userId} style={styles.userItem}>
                <div 
                  style={styles.userMain}
                  onClick={() => toggleExpand(user.userId)}
                >
                  <div style={styles.userInfo}>
                    <div style={styles.userIcon}>
                      <User size={20} color="#666" />
                    </div>
                    <div>
                      <p style={styles.userName}>{user.userName}</p>
                      <p style={styles.userEmail}>{user.email}</p>
                      <p style={styles.userId}>UID: {user.userId.slice(0, 12)}...</p>
                    </div>
                  </div>

                  <div style={styles.userStats}>
                    <div style={styles.userStatItem}>
                      <Heart size={16} color="#FF6B6B" />
                      <span>{user.compatibilityCount}회</span>
                    </div>
                    <div style={styles.userStatItem}>
                      <MessageCircle size={16} color="#4A90D9" />
                      <span>{user.adviceCount}회</span>
                    </div>
                    <div style={styles.lastUsed}>
                      최근: {user.lastUsed ? formatDateShort(user.lastUsed) : '-'}
                    </div>
                    {expandedUser === user.userId ? 
                      <ChevronUp size={20} color="#999" /> : 
                      <ChevronDown size={20} color="#999" />
                    }
                  </div>
                </div>

                {/* 상세 기록 */}
                {expandedUser === user.userId && (
                  <div style={styles.detailSection}>
                    {/* 궁합 분석 기록 */}
                    <div style={styles.detailGroup}>
                      <h4 style={styles.detailTitle}>
                        <Heart size={16} color="#FF6B6B" />
                        궁합 분석 기록 ({user.compatibilityCount}회)
                      </h4>
                      {user.compatibilityRecords.length === 0 ? (
                        <p style={styles.noRecord}>기록 없음</p>
                      ) : (
                        <div style={styles.recordList}>
                          {user.compatibilityRecords.slice(0, 10).map((record, idx) => (
                            <div key={record.id} style={styles.recordItem}>
                              <span style={styles.recordNum}>#{idx + 1}</span>
                              <span style={styles.recordContent}>
                                {record.myName || '나'} ❤️ {record.partnerName || '상대'}
                                {record.result?.percentage && (
                                  <span style={styles.recordScore}> ({record.result.percentage}%)</span>
                                )}
                              </span>
                              <span style={styles.recordDate}>
                                {formatDate(record.createdAt)}
                              </span>
                            </div>
                          ))}
                          {user.compatibilityRecords.length > 10 && (
                            <p style={styles.moreRecords}>
                              +{user.compatibilityRecords.length - 10}개 더 있음
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 조언 기록 */}
                    <div style={styles.detailGroup}>
                      <h4 style={styles.detailTitle}>
                        <MessageCircle size={16} color="#4A90D9" />
                        조언 기록 ({user.adviceCount}회)
                      </h4>
                      {user.adviceRecords.length === 0 ? (
                        <p style={styles.noRecord}>기록 없음</p>
                      ) : (
                        <div style={styles.recordList}>
                          {user.adviceRecords.slice(0, 10).map((record, idx) => (
                            <div key={record.id} style={styles.recordItem}>
                              <span style={styles.recordNum}>#{idx + 1}</span>
                              <span style={styles.recordContent}>
                                {record.partnerName || '상대'}에게 - "{record.situation?.slice(0, 30) || '상황'}..."
                              </span>
                              <span style={styles.recordDate}>
                                {formatDate(record.createdAt)}
                              </span>
                            </div>
                          ))}
                          {user.adviceRecords.length > 10 && (
                            <p style={styles.moreRecords}>
                              +{user.adviceRecords.length - 10}개 더 있음
                            </p>
                          )}
                        </div>
                      )}
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
  filterSection: {
    display: 'flex',
    gap: '16px',
    marginBottom: '20px',
    flexWrap: 'wrap',
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 16px',
    backgroundColor: '#fff',
    borderRadius: '8px',
    border: '1px solid #eee',
    flex: 1,
    minWidth: '250px',
  },
  searchInput: {
    border: 'none',
    outline: 'none',
    fontSize: '14px',
    width: '100%',
  },
  dateFilters: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  dateInput: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 12px',
    backgroundColor: '#fff',
    borderRadius: '8px',
    border: '1px solid #eee',
  },
  dateField: {
    border: 'none',
    outline: 'none',
    fontSize: '14px',
  },
  dateSeparator: {
    color: '#999',
  },
  clearBtn: {
    padding: '10px 16px',
    backgroundColor: '#f5f5f5',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    color: '#666',
    cursor: 'pointer',
  },
  listCard: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
  },
  listHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
    paddingBottom: '16px',
    borderBottom: '1px solid #eee',
  },
  listTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#333',
  },
  listCount: {
    fontSize: '14px',
    color: '#999',
  },
  empty: {
    textAlign: 'center',
    color: '#999',
    padding: '40px 0',
  },
  userList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  userItem: {
    border: '1px solid #eee',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  userMain: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px',
    cursor: 'pointer',
    backgroundColor: '#fafafa',
    transition: 'background-color 0.2s',
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  userIcon: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    backgroundColor: '#eee',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userName: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#333',
    marginBottom: '2px',
  },
  userEmail: {
    fontSize: '13px',
    color: '#666',
    marginBottom: '2px',
  },
  userId: {
    fontSize: '11px',
    color: '#999',
  },
  userStats: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  userStatItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '14px',
    color: '#333',
    fontWeight: '500',
  },
  lastUsed: {
    fontSize: '12px',
    color: '#999',
  },
  detailSection: {
    padding: '16px',
    backgroundColor: '#fff',
    borderTop: '1px solid #eee',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  detailGroup: {
    padding: '16px',
    backgroundColor: '#f9f9f9',
    borderRadius: '8px',
  },
  detailTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    fontWeight: '600',
    color: '#333',
    marginBottom: '12px',
  },
  noRecord: {
    fontSize: '13px',
    color: '#999',
    textAlign: 'center',
    padding: '12px 0',
  },
  recordList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  recordItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 12px',
    backgroundColor: '#fff',
    borderRadius: '6px',
    fontSize: '13px',
  },
  recordNum: {
    fontSize: '12px',
    color: '#999',
    fontWeight: '500',
    minWidth: '28px',
  },
  recordContent: {
    flex: 1,
    color: '#333',
  },
  recordScore: {
    color: '#FF6B6B',
    fontWeight: '600',
  },
  recordDate: {
    fontSize: '12px',
    color: '#999',
    whiteSpace: 'nowrap',
  },
  moreRecords: {
    fontSize: '12px',
    color: '#999',
    textAlign: 'center',
    padding: '8px 0',
  },
};

export default Usage;