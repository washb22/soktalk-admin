import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, doc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { AlertTriangle, Check, X, Trash2 } from 'lucide-react';

function Reports() {
  const [reports, setReports] = useState([]);
  const [filter, setFilter] = useState('all'); // all, pending, processed
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      const reportsQuery = query(
        collection(db, 'reports'),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(reportsQuery);
      const reportsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setReports(reportsData);
    } catch (error) {
      console.error('신고 로드 에러:', error);
    } finally {
      setLoading(false);
    }
  };

  const processReport = async (reportId, action) => {
    const actionText = action === 'approve' ? '승인' : '반려';
    if (!window.confirm(`이 신고를 ${actionText}하시겠습니까?`)) return;

    try {
      await updateDoc(doc(db, 'reports', reportId), {
        status: action === 'approve' ? 'approved' : 'rejected',
        processedAt: new Date(),
      });
      
      setReports(reports.map(report => 
        report.id === reportId 
          ? { ...report, status: action === 'approve' ? 'approved' : 'rejected' }
          : report
      ));
      
      alert(`${actionText}되었습니다.`);
    } catch (error) {
      console.error('처리 에러:', error);
      alert('처리 중 오류가 발생했습니다.');
    }
  };

  const deleteReport = async (reportId) => {
    if (!window.confirm('이 신고를 삭제하시겠습니까?')) return;

    try {
      await deleteDoc(doc(db, 'reports', reportId));
      setReports(reports.filter(r => r.id !== reportId));
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

  const getReasonText = (reason) => {
    const reasons = {
      'spam': '스팸/광고',
      'inappropriate': '부적절한 내용',
      'harassment': '괴롭힘/욕설',
      'other': '기타',
    };
    return reasons[reason] || reason || '기타';
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return <span style={styles.approvedBadge}>승인됨</span>;
      case 'rejected':
        return <span style={styles.rejectedBadge}>반려됨</span>;
      default:
        return <span style={styles.pendingBadge}>대기중</span>;
    }
  };

  const filteredReports = reports.filter(report => {
    if (filter === 'pending') return !report.status || report.status === 'pending';
    if (filter === 'processed') return report.status === 'approved' || report.status === 'rejected';
    return true;
  });

  if (loading) {
    return <div style={styles.loading}>로딩 중...</div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.pageTitle}>신고 관리</h1>
        <span style={styles.count}>총 {reports.length}건</span>
      </div>

      {/* 필터 */}
      <div style={styles.filterBar}>
        {['all', 'pending', 'processed'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              ...styles.filterBtn,
              backgroundColor: filter === f ? '#FF6B6B' : '#f5f5f5',
              color: filter === f ? '#fff' : '#666',
            }}
          >
            {f === 'all' ? '전체' : f === 'pending' ? '대기중' : '처리완료'}
          </button>
        ))}
      </div>

      {/* 신고 목록 */}
      <div style={styles.reportList}>
        {filteredReports.length === 0 ? (
          <div style={styles.empty}>
            <AlertTriangle size={48} color="#ddd" />
            <p>신고가 없습니다.</p>
          </div>
        ) : (
          filteredReports.map(report => (
            <div key={report.id} style={styles.reportCard}>
              <div style={styles.reportHeader}>
                <div style={styles.reportInfo}>
                  <span style={styles.reportType}>
                    {report.type === 'post' ? '게시글' : '댓글'} 신고
                  </span>
                  {getStatusBadge(report.status)}
                </div>
                <span style={styles.reportDate}>{formatDate(report.createdAt)}</span>
              </div>
              
              <div style={styles.reportContent}>
                <div style={styles.reportItem}>
                  <span style={styles.reportLabel}>신고 사유</span>
                  <span style={styles.reasonBadge}>{getReasonText(report.reason)}</span>
                </div>
                
                {report.details && (
                  <div style={styles.reportItem}>
                    <span style={styles.reportLabel}>상세 내용</span>
                    <p style={styles.reportDetails}>{report.details}</p>
                  </div>
                )}
                
                <div style={styles.reportItem}>
                  <span style={styles.reportLabel}>신고된 내용</span>
                  <p style={styles.targetContent}>{report.content || '내용 없음'}</p>
                </div>
              </div>
              
              {(!report.status || report.status === 'pending') && (
                <div style={styles.reportActions}>
                  <button
                    onClick={() => processReport(report.id, 'approve')}
                    style={styles.approveBtn}
                  >
                    <Check size={16} />
                    <span>승인</span>
                  </button>
                  <button
                    onClick={() => processReport(report.id, 'reject')}
                    style={styles.rejectBtn}
                  >
                    <X size={16} />
                    <span>반려</span>
                  </button>
                  <button
                    onClick={() => deleteReport(report.id)}
                    style={styles.deleteBtn}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>
          ))
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
    gap: '8px',
    marginBottom: '16px',
  },
  filterBtn: {
    padding: '10px 20px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.2s',
  },
  reportList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  reportCard: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
  },
  reportHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  reportInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  reportType: {
    fontWeight: '600',
    color: '#333',
  },
  reportDate: {
    fontSize: '12px',
    color: '#999',
  },
  pendingBadge: {
    backgroundColor: '#FFF3E0',
    color: '#FF9800',
    padding: '4px 10px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '500',
  },
  approvedBadge: {
    backgroundColor: '#E8F5E9',
    color: '#4CAF50',
    padding: '4px 10px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '500',
  },
  rejectedBadge: {
    backgroundColor: '#FFEBEE',
    color: '#F44336',
    padding: '4px 10px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '500',
  },
  reportContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  reportItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  reportLabel: {
    fontSize: '12px',
    fontWeight: '500',
    color: '#999',
  },
  reasonBadge: {
    display: 'inline-block',
    backgroundColor: '#FFEBEE',
    color: '#F44336',
    padding: '6px 12px',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: '500',
    width: 'fit-content',
  },
  reportDetails: {
    fontSize: '14px',
    color: '#666',
    lineHeight: '1.5',
  },
  targetContent: {
    fontSize: '14px',
    color: '#333',
    backgroundColor: '#f9f9f9',
    padding: '12px',
    borderRadius: '8px',
    lineHeight: '1.5',
  },
  reportActions: {
    display: 'flex',
    gap: '8px',
    marginTop: '16px',
    paddingTop: '16px',
    borderTop: '1px solid #f5f5f5',
  },
  approveBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '10px 16px',
    backgroundColor: '#E8F5E9',
    color: '#4CAF50',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
  },
  rejectBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '10px 16px',
    backgroundColor: '#FFEBEE',
    color: '#F44336',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
  },
  deleteBtn: {
    padding: '10px',
    backgroundColor: '#f5f5f5',
    color: '#999',
    borderRadius: '8px',
    marginLeft: 'auto',
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
};

export default Reports;
