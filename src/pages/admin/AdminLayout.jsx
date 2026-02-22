import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import AdminHeader from '../../components/admin/AdminHeader';
import AdminSidebar from '../../components/admin/AdminSidebar';
import { useAuth } from '../../context/AuthContext';
import { Navigate } from 'react-router-dom';
import './AdminLayout.css';

const AdminLayout = () => {
  const { isAuthenticated, isAdmin, loading, user } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <p>Cargando...</p>
      </div>
    );
  }

  // Verificar autenticación y rol admin o seguridad
  const isAdminOrSeguridad = user && (user.rol === 'admin' || user.rol === 'seguridad');
  if (!user || !isAuthenticated() || !isAdminOrSeguridad) {
    // Usar la pantalla de login única (correo/contraseña)
    return <Navigate to="/login" replace />;
  }

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  return (
    <div className="admin-layout">
      <AdminHeader onMenuToggle={toggleMenu} isMenuOpen={isMenuOpen} />
      <AdminSidebar isOpen={isMenuOpen} onClose={closeMenu} />
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;

