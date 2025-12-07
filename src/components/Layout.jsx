import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  PenSquare, 
  MessageSquare, 
  AlertTriangle,
  LogOut
} from 'lucide-react';

const menuItems = [
  { path: '/', icon: LayoutDashboard, label: '대시보드' },
  { path: '/users', icon: Users, label: '회원 관리' },
  { path: '/posts', icon: FileText, label: '게시글 관리' },
  { path: '/write', icon: PenSquare, label: '글 작성' },
  { path: '/comments', icon: MessageSquare, label: '댓글 관리' },
  { path: '/reports', icon: AlertTriangle, label: '신고 관리' },
];

function Layout({ children, onLogout }) {
  return (
    <div style={styles.container}>
      <aside style={styles.sidebar}>
        <div style={styles.logo}>
          <span style={styles.logoText}>마음다락방</span>
          <span style={styles.adminBadge}>Admin</span>
        </div>
        
        <nav style={styles.nav}>
          {menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              style={({ isActive }) => ({
                ...styles.navItem,
                backgroundColor: isActive ? '#FF6B6B' : 'transparent',
                color: isActive ? '#fff' : '#666',
              })}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        
        <button style={styles.logoutBtn} onClick={onLogout}>
          <LogOut size={20} />
          <span>로그아웃</span>
        </button>
      </aside>
      
      <main style={styles.main}>
        {children}
      </main>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    minHeight: '100vh',
  },
  sidebar: {
    width: '240px',
    backgroundColor: '#fff',
    borderRight: '1px solid #eee',
    display: 'flex',
    flexDirection: 'column',
    position: 'fixed',
    height: '100vh',
    left: 0,
    top: 0,
  },
  logo: {
    padding: '20px',
    borderBottom: '1px solid #eee',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  logoText: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#FF6B6B',
  },
  adminBadge: {
    fontSize: '12px',
    backgroundColor: '#FF6B6B',
    color: '#fff',
    padding: '2px 8px',
    borderRadius: '4px',
  },
  nav: {
    flex: 1,
    padding: '16px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.2s',
  },
  logoutBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px 24px',
    borderTop: '1px solid #eee',
    backgroundColor: 'transparent',
    color: '#666',
    fontSize: '14px',
    fontWeight: '500',
  },
  main: {
    flex: 1,
    marginLeft: '240px',
    padding: '24px',
    minHeight: '100vh',
  },
};

export default Layout;
