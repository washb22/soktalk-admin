import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc,
  deleteDoc,
  doc,
  query, 
  orderBy 
} from 'firebase/firestore';
import { 
  Megaphone, 
  Plus, 
  Edit3, 
  Trash2, 
  Save, 
  X,
  Eye,
  EyeOff,
  RefreshCw,
  Image,
  Upload
} from 'lucide-react';

function Notices() {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingNotice, setEditingNotice] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // 폼 상태
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('전체');
  const [imageUrl, setImageUrl] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadNotices();
  }, []);

  const loadNotices = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'notices'),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const noticesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setNotices(noticesData);
    } catch (error) {
      console.error('공지사항 로드 에러:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setContent('');
    setCategory('전체');
    setImageUrl('');
    setImagePreview('');
    setEditingNotice(null);
    setShowForm(false);
  };

  // 이미지 파일 선택 처리
  const handleImageSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 파일 크기 체크 (5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('이미지 크기는 5MB 이하여야 합니다.');
      return;
    }

    // 미리보기 생성
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target.result);
    };
    reader.readAsDataURL(file);

    // Firebase Storage에 업로드
    setUploading(true);
    try {
      const storage = getStorage();
      const fileName = `notices/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, fileName);
      
      await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(storageRef);
      
      setImageUrl(downloadUrl);
      alert('이미지가 업로드되었습니다.');
    } catch (error) {
      console.error('이미지 업로드 에러:', error);
      alert('이미지 업로드에 실패했습니다.');
      setImagePreview('');
    } finally {
      setUploading(false);
    }
  };

  // 이미지 제거
  const removeImage = () => {
    setImageUrl('');
    setImagePreview('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      alert('제목을 입력해주세요.');
      return;
    }
    if (!content.trim()) {
      alert('내용을 입력해주세요.');
      return;
    }

    setSubmitting(true);

    try {
      if (editingNotice) {
        // 수정
        await updateDoc(doc(db, 'notices', editingNotice.id), {
          title: title.trim(),
          content: content.trim(),
          category,
          imageUrl: imageUrl || null,
          updatedAt: new Date(),
        });
        alert('공지사항이 수정되었습니다.');
      } else {
        // 새로 작성
        await addDoc(collection(db, 'notices'), {
          title: title.trim(),
          content: content.trim(),
          category,
          imageUrl: imageUrl || null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        alert('공지사항이 등록되었습니다.');
      }
      
      resetForm();
      loadNotices();
    } catch (error) {
      console.error('공지사항 저장 에러:', error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (notice) => {
    setEditingNotice(notice);
    setTitle(notice.title);
    setContent(notice.content);
    setCategory(notice.category || '전체');
    setImageUrl(notice.imageUrl || '');
    setImagePreview(notice.imageUrl || '');
    setShowForm(true);
  };

  const handleDelete = async (noticeId) => {
    if (!window.confirm('이 공지사항을 삭제하시겠습니까?')) return;

    try {
      await deleteDoc(doc(db, 'notices', noticeId));
      alert('삭제되었습니다.');
      loadNotices();
    } catch (error) {
      console.error('삭제 에러:', error);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  const toggleActive = async (notice) => {
    try {
      await updateDoc(doc(db, 'notices', notice.id), {
        isActive: !notice.isActive,
      });
      loadNotices();
    } catch (error) {
      console.error('상태 변경 에러:', error);
      alert('처리 중 오류가 발생했습니다.');
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '-';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  const getCategoryBadgeStyle = (cat) => {
    switch (cat) {
      case '연애상담':
        return { backgroundColor: '#FFE8E8', color: '#FF6B6B' };
      case '잡담':
        return { backgroundColor: '#E8F4FF', color: '#4A90D9' };
      default:
        return { backgroundColor: '#E8FFE8', color: '#4CAF50' };
    }
  };

  if (loading) {
    return <div style={styles.loading}>공지사항 로딩 중...</div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.pageTitle}>📢 공지사항 관리</h1>
        <div style={styles.headerButtons}>
          <button onClick={loadNotices} style={styles.refreshBtn}>
            <RefreshCw size={18} />
            <span>새로고침</span>
          </button>
          <button 
            onClick={() => {
              resetForm();
              setShowForm(true);
            }} 
            style={styles.addBtn}
          >
            <Plus size={18} />
            <span>공지 작성</span>
          </button>
        </div>
      </div>

      {/* 작성/수정 폼 */}
      {showForm && (
        <div style={styles.formCard}>
          <div style={styles.formHeader}>
            <h2 style={styles.formTitle}>
              {editingNotice ? '공지사항 수정' : '새 공지사항 작성'}
            </h2>
            <button onClick={resetForm} style={styles.closeBtn}>
              <X size={20} />
            </button>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>게시판</label>
            <div style={styles.categoryButtons}>
              {['전체', '연애상담', '잡담'].map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  style={{
                    ...styles.categoryBtn,
                    ...(category === cat ? styles.categoryBtnActive : {}),
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>제목</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="공지사항 제목을 입력하세요"
              style={styles.input}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>내용</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="공지사항 내용을 입력하세요"
              rows={6}
              style={styles.textarea}
            />
          </div>

          {/* 이미지 업로드 */}
          <div style={styles.formGroup}>
            <label style={styles.label}>이미지 (선택)</label>
            
            {imagePreview ? (
              <div style={styles.imagePreviewContainer}>
                <img src={imagePreview} alt="미리보기" style={styles.imagePreview} />
                <button onClick={removeImage} style={styles.removeImageBtn}>
                  <X size={16} />
                  <span>이미지 제거</span>
                </button>
              </div>
            ) : (
              <div 
                style={styles.imageUploadArea}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? (
                  <span>업로드 중...</span>
                ) : (
                  <>
                    <Upload size={24} color="#999" />
                    <span style={styles.uploadText}>클릭하여 이미지 업로드</span>
                    <span style={styles.uploadHint}>최대 5MB, JPG/PNG/GIF</span>
                  </>
                )}
              </div>
            )}
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              style={{ display: 'none' }}
            />
          </div>

          <div style={styles.formActions}>
            <button onClick={resetForm} style={styles.cancelBtn}>
              취소
            </button>
            <button 
              onClick={handleSubmit} 
              disabled={submitting || uploading}
              style={styles.submitBtn}
            >
              <Save size={18} />
              <span>{submitting ? '저장 중...' : (editingNotice ? '수정하기' : '등록하기')}</span>
            </button>
          </div>
        </div>
      )}

      {/* 공지사항 목록 */}
      <div style={styles.listCard}>
        <div style={styles.listHeader}>
          <span style={styles.listTitle}>공지사항 목록</span>
          <span style={styles.listCount}>{notices.length}개</span>
        </div>

        {notices.length === 0 ? (
          <p style={styles.empty}>등록된 공지사항이 없습니다.</p>
        ) : (
          <div style={styles.noticeList}>
            {notices.map(notice => (
              <div 
                key={notice.id} 
                style={{
                  ...styles.noticeItem,
                  ...(notice.isActive ? {} : styles.noticeItemInactive),
                }}
              >
                <div style={styles.noticeMain}>
                  {/* 이미지 썸네일 */}
                  {notice.imageUrl && (
                    <img 
                      src={notice.imageUrl} 
                      alt="공지 이미지" 
                      style={styles.noticeThumbnail}
                    />
                  )}
                  
                  <div style={styles.noticeInfo}>
                    <div style={styles.noticeMeta}>
                      <span 
                        style={{
                          ...styles.categoryBadge,
                          ...getCategoryBadgeStyle(notice.category),
                        }}
                      >
                        {notice.category || '전체'}
                      </span>
                      {notice.imageUrl && (
                        <span style={styles.imageBadge}>
                          <Image size={12} />
                          이미지
                        </span>
                      )}
                      <span style={styles.noticeDate}>
                        {formatDate(notice.createdAt)}
                      </span>
                      {!notice.isActive && (
                        <span style={styles.inactiveBadge}>비활성</span>
                      )}
                    </div>
                    <h3 style={styles.noticeTitle}>{notice.title}</h3>
                    <p style={styles.noticeContent}>{notice.content}</p>
                  </div>

                  <div style={styles.noticeActions}>
                    <button
                      onClick={() => toggleActive(notice)}
                      style={styles.actionBtn}
                      title={notice.isActive ? '비활성화' : '활성화'}
                    >
                      {notice.isActive ? (
                        <Eye size={18} color="#4CAF50" />
                      ) : (
                        <EyeOff size={18} color="#999" />
                      )}
                    </button>
                    <button
                      onClick={() => handleEdit(notice)}
                      style={styles.actionBtn}
                      title="수정"
                    >
                      <Edit3 size={18} color="#4A90D9" />
                    </button>
                    <button
                      onClick={() => handleDelete(notice.id)}
                      style={styles.actionBtn}
                      title="삭제"
                    >
                      <Trash2 size={18} color="#FF6B6B" />
                    </button>
                  </div>
                </div>
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
  headerButtons: {
    display: 'flex',
    gap: '12px',
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
  addBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '10px 20px',
    backgroundColor: '#FF6B6B',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: '600',
  },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '24px',
    marginBottom: '24px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
  },
  formHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  formTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#333',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    color: '#999',
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
  categoryButtons: {
    display: 'flex',
    gap: '8px',
  },
  categoryBtn: {
    padding: '8px 16px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    backgroundColor: '#fff',
    fontSize: '14px',
    color: '#666',
    cursor: 'pointer',
  },
  categoryBtnActive: {
    backgroundColor: '#FF6B6B',
    borderColor: '#FF6B6B',
    color: '#fff',
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
  // 이미지 업로드 스타일
  imageUploadArea: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '30px',
    border: '2px dashed #ddd',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'border-color 0.2s',
  },
  uploadText: {
    marginTop: '8px',
    fontSize: '14px',
    color: '#666',
  },
  uploadHint: {
    marginTop: '4px',
    fontSize: '12px',
    color: '#999',
  },
  imagePreviewContainer: {
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    maxHeight: '300px',
    objectFit: 'contain',
    borderRadius: '8px',
    border: '1px solid #eee',
  },
  removeImageBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    marginTop: '8px',
    padding: '8px 12px',
    backgroundColor: '#f5f5f5',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    color: '#666',
    cursor: 'pointer',
  },
  formActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '20px',
  },
  cancelBtn: {
    padding: '10px 20px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    backgroundColor: '#fff',
    fontSize: '14px',
    color: '#666',
    cursor: 'pointer',
  },
  submitBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '10px 20px',
    backgroundColor: '#FF6B6B',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: '600',
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
  noticeList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  noticeItem: {
    border: '1px solid #eee',
    borderRadius: '8px',
    padding: '16px',
    backgroundColor: '#fff',
  },
  noticeItemInactive: {
    backgroundColor: '#f9f9f9',
    opacity: 0.7,
  },
  noticeMain: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '16px',
  },
  noticeThumbnail: {
    width: '80px',
    height: '80px',
    objectFit: 'cover',
    borderRadius: '8px',
    border: '1px solid #eee',
    flexShrink: 0,
  },
  noticeInfo: {
    flex: 1,
  },
  noticeMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px',
    flexWrap: 'wrap',
  },
  categoryBadge: {
    padding: '4px 10px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '600',
  },
  imageBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '2px 8px',
    backgroundColor: '#E8F4FF',
    borderRadius: '4px',
    fontSize: '11px',
    color: '#4A90D9',
  },
  noticeDate: {
    fontSize: '12px',
    color: '#999',
  },
  inactiveBadge: {
    padding: '2px 8px',
    backgroundColor: '#f0f0f0',
    borderRadius: '4px',
    fontSize: '11px',
    color: '#999',
  },
  noticeTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#333',
    marginBottom: '6px',
  },
  noticeContent: {
    fontSize: '14px',
    color: '#666',
    lineHeight: '1.5',
    whiteSpace: 'pre-wrap',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  noticeActions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginLeft: 'auto',
  },
  actionBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '8px',
    borderRadius: '6px',
    transition: 'background-color 0.2s',
  },
};

export default Notices;