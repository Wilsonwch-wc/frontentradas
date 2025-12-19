import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import logoImage from '../../images/logo2.png';
import './AdminHeader.css';

const AdminHeader = ({ onMenuToggle, isMenuOpen }) => {
  const { user } = useAuth();

  return (
    <header className="admin-header">
      <div className="admin-header-content">
        <div className="admin-header-left">
          <button 
            className="admin-menu-toggle"
            onClick={onMenuToggle}
            aria-label="Toggle menu"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
          <img src={logoImage} alt="PlusTicket" className="admin-logo-image" />
          <h1 className="admin-logo">Panel Admin</h1>
        </div>
        <div className="admin-header-right">
          <div className="admin-user-info">
            <span className="admin-user-name">{user?.nombre_completo || 'Admin'}</span>
            <span className="admin-user-role">{user?.rol || 'admin'}</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default AdminHeader;

