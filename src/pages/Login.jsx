import React, { useState } from 'react';
import { Lock } from 'lucide-react';

function Login({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const success = onLogin(password);
    if (!success) {
      setError('비밀번호가 올바르지 않습니다.');
      setPassword('');
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.logoSection}>
          <div style={styles.logoIcon}>
            <Lock size={32} color="#FF6B6B" />
          </div>
          <h1 style={styles.title}>마음다락방</h1>
          <p style={styles.subtitle}>관리자 페이지</p>
        </div>
        
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>관리자 비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호를 입력하세요"
              style={styles.input}
              autoFocus
            />
          </div>
          
          {error && <p style={styles.error}>{error}</p>}
          
          <button type="submit" style={styles.button}>
            로그인
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    padding: '20px',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: '16px',
    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.08)',
    padding: '48px',
    width: '100%',
    maxWidth: '400px',
  },
  logoSection: {
    textAlign: 'center',
    marginBottom: '32px',
  },
  logoIcon: {
    width: '64px',
    height: '64px',
    backgroundColor: '#FFF0F0',
    borderRadius: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 16px',
  },
  title: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#FF6B6B',
    marginBottom: '4px',
  },
  subtitle: {
    fontSize: '14px',
    color: '#999',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#333',
  },
  input: {
    padding: '12px 16px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    fontSize: '14px',
    transition: 'border-color 0.2s',
  },
  error: {
    color: '#FF6B6B',
    fontSize: '14px',
    textAlign: 'center',
  },
  button: {
    padding: '14px',
    backgroundColor: '#FF6B6B',
    color: '#fff',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    marginTop: '8px',
  },
};

export default Login;
