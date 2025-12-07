import React, { useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc, doc, setDoc } from 'firebase/firestore';
import { PenSquare, Send, User, RefreshCw } from 'lucide-react';

// 랜덤 닉네임 생성용
const adjectives = ['행복한', '슬픈', '외로운', '설레는', '두근거리는', '걱정되는', '기대되는', '불안한', '떨리는', '애틋한'];
const nouns = ['사랑꾼', '짝사랑러', '연애초보', '솔로', '커플', '썸남', '썸녀', '고민러', '연인', '짝꿍'];

function WritePost() {
  const [category, setCategory] = useState('연애상담');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [authorName, setAuthorName] = useState('익명');
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [loading, setLoading] = useState(false);

  const generateRandomName = () => {
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const num = Math.floor(Math.random() * 100);
    setAuthorName(`${adj}${noun}${num}`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!title.trim()) {
      alert('제목을 입력해주세요.');
      return;
    }
    if (!content.trim()) {
      alert('내용을 입력해주세요.');
      return;
    }

    setLoading(true);

    try {
      // 가상 유저 ID 생성
      const fakeUserId = `admin_${Date.now()}`;
      
      const postData = {
        title: title.trim(),
        content: content.trim(),
        category,
        authorId: fakeUserId,
        authorName: isAnonymous ? null : authorName,
        isAnonymous,
        createdAt: new Date(),
        updatedAt: new Date(),
        views: Math.floor(Math.random() * 50), // 랜덤 조회수
        likesArray: [],
        commentsCount: 0,
        isAdminPost: true, // 관리자 작성 표시
      };

      await addDoc(collection(db, 'posts'), postData);
      
      alert('게시글이 등록되었습니다.');
      
      // 폼 초기화
      setTitle('');
      setContent('');
      setAuthorName('익명');
      setIsAnonymous(true);
      
    } catch (error) {
      console.error('게시글 등록 에러:', error);
      alert('등록 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <PenSquare size={28} color="#FF6B6B" />
        <div>
          <h1 style={styles.pageTitle}>글 작성</h1>
          <p style={styles.subtitle}>관리자 시딩용 게시글 작성</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={styles.form}>
        {/* 작성자 설정 */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>작성자 설정</h2>
          
          <div style={styles.authorSection}>
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                style={styles.checkbox}
              />
              <span>익명으로 작성</span>
            </label>
            
            {!isAnonymous && (
              <div style={styles.authorInput}>
                <User size={18} color="#666" />
                <input
                  type="text"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  placeholder="닉네임 입력"
                  style={styles.input}
                />
                <button
                  type="button"
                  onClick={generateRandomName}
                  style={styles.randomBtn}
                >
                  <RefreshCw size={16} />
                  <span>랜덤</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 게시글 내용 */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>게시글 내용</h2>
          
          <div style={styles.formGroup}>
            <label style={styles.label}>카테고리</label>
            <div style={styles.categoryButtons}>
              {['연애상담', '잡담'].map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  style={{
                    ...styles.categoryBtn,
                    backgroundColor: category === cat ? '#FF6B6B' : '#f5f5f5',
                    color: category === cat ? '#fff' : '#666',
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
              placeholder="제목을 입력하세요"
              style={styles.titleInput}
              maxLength={100}
            />
          </div>
          
          <div style={styles.formGroup}>
            <label style={styles.label}>내용</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="내용을 입력하세요"
              style={styles.textarea}
              rows={10}
            />
          </div>
        </div>

        {/* 미리보기 */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>미리보기</h2>
          <div style={styles.preview}>
            <div style={styles.previewHeader}>
              <span style={styles.previewCategory}>{category}</span>
              <span style={styles.previewAuthor}>
                {isAnonymous ? '익명' : authorName}
              </span>
            </div>
            <h3 style={styles.previewTitle}>{title || '제목을 입력하세요'}</h3>
            <p style={styles.previewContent}>{content || '내용을 입력하세요'}</p>
          </div>
        </div>

        {/* 제출 버튼 */}
        <button
          type="submit"
          disabled={loading}
          style={{
            ...styles.submitBtn,
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? (
            <span>등록 중...</span>
          ) : (
            <>
              <Send size={18} />
              <span>게시글 등록</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '800px',
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '24px',
  },
  pageTitle: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#333',
  },
  subtitle: {
    fontSize: '14px',
    color: '#999',
    marginTop: '4px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
  },
  cardTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#333',
    marginBottom: '16px',
  },
  authorSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    color: '#333',
    cursor: 'pointer',
  },
  checkbox: {
    width: '18px',
    height: '18px',
    cursor: 'pointer',
  },
  authorInput: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    backgroundColor: '#f9f9f9',
    padding: '12px 16px',
    borderRadius: '8px',
  },
  input: {
    flex: 1,
    border: 'none',
    backgroundColor: 'transparent',
    fontSize: '14px',
    color: '#333',
  },
  randomBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 12px',
    backgroundColor: '#FF6B6B',
    color: '#fff',
    borderRadius: '6px',
    fontSize: '13px',
  },
  formGroup: {
    marginBottom: '16px',
  },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '500',
    color: '#333',
    marginBottom: '8px',
  },
  categoryButtons: {
    display: 'flex',
    gap: '8px',
  },
  categoryBtn: {
    padding: '10px 20px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.2s',
  },
  titleInput: {
    width: '100%',
    padding: '14px 16px',
    border: '1px solid #eee',
    borderRadius: '8px',
    fontSize: '14px',
  },
  textarea: {
    width: '100%',
    padding: '14px 16px',
    border: '1px solid #eee',
    borderRadius: '8px',
    fontSize: '14px',
    resize: 'vertical',
    minHeight: '200px',
    lineHeight: '1.6',
  },
  preview: {
    backgroundColor: '#f9f9f9',
    borderRadius: '8px',
    padding: '20px',
  },
  previewHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '12px',
  },
  previewCategory: {
    backgroundColor: '#FFF0F0',
    color: '#FF6B6B',
    padding: '4px 10px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '500',
  },
  previewAuthor: {
    fontSize: '13px',
    color: '#666',
  },
  previewTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#333',
    marginBottom: '8px',
  },
  previewContent: {
    fontSize: '14px',
    color: '#666',
    lineHeight: '1.6',
    whiteSpace: 'pre-wrap',
  },
  submitBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '16px',
    backgroundColor: '#FF6B6B',
    color: '#fff',
    borderRadius: '12px',
    fontSize: '16px',
    fontWeight: '600',
  },
};

export default WritePost;
