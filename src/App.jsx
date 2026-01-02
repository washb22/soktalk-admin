import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Posts from './pages/Posts';
import PostDetail from './pages/PostDetail';
import WritePost from './pages/WritePost';
import Comments from './pages/Comments';
import Reports from './pages/Reports';
import Usage from './pages/Usage';  // ✅ 추가
import Notices from './pages/Notices';

const ADMIN_PASSWORD = 'thrxhr1234';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('soktalk_admin_logged_in');
    if (saved === 'true') {
      setIsLoggedIn(true);
    }
  }, []);

  const handleLogin = (password) => {
    if (password === ADMIN_PASSWORD) {
      setIsLoggedIn(true);
      localStorage.setItem('soktalk_admin_logged_in', 'true');
      return true;
    }
    return false;
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    localStorage.removeItem('soktalk_admin_logged_in');
  };

  if (!isLoggedIn) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <BrowserRouter>
      <Layout onLogout={handleLogout}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/users" element={<Users />} />
          <Route path="/posts" element={<Posts />} />
          <Route path="/posts/:postId" element={<PostDetail />} />
          <Route path="/write" element={<WritePost />} />
          <Route path="/comments" element={<Comments />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/usage" element={<Usage />} />  {/* ✅ 추가 */}
          <Route path="*" element={<Navigate to="/" />} />
          <Route path="/notices" element={<Notices />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;