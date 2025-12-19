import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Header.css';

const Header = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="header">
      <div className="header-container">
        <Link to="/" className="logo">
          <div className="logo-text">
            <h1>PlusTicket</h1>
            <span className="logo-subtitle">MAS FACIL IMPOSIBLE</span>
          </div>
        </Link>
        <nav className="nav">
          <Link to="/" className="nav-link">Inicio</Link>
          <Link to="/eventos" className="nav-link">Eventos</Link>
          <Link to="/contacto" className="nav-link">Contacto</Link>
          {isAuthenticated() && !user?.rol && (
            <Link to="/mis-compras" className="nav-link">Mis Compras</Link>
          )}
          {isAuthenticated() ? (
            <div className="nav-user-section">
              {user?.foto_perfil && (
                <img 
                  src={user.foto_perfil} 
                  alt={user.nombre_completo || user.nombre}
                  className="nav-user-avatar"
                />
              )}
              <Link to="/mi-informacion" className="nav-user-link">
                <span className="nav-user">
                  {user?.nombre_completo || user?.nombre || user?.correo}
                </span>
              </Link>
              <button onClick={handleLogout} className="nav-btn-logout">
                Cerrar Sesión
              </button>
            </div>
          ) : (
            <Link to="/login" className="nav-link nav-link-login">
              Iniciar Sesión
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Header;

