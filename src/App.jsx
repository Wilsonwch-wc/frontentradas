import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AlertProvider } from './context/AlertContext';
import PublicLayout from './components/PublicLayout';
import Home from './pages/Home';
import DetalleEvento from './pages/DetalleEvento';
import Eventos from './pages/Eventos';
import Contacto from './pages/Contacto';
import Login from './pages/Login';
import MiInformacion from './pages/MiInformacion';
import MisCompras from './pages/MisCompras';
import Compra from './pages/Compra';
import PagoQR from './pages/PagoQR';
import AdminLayout from './pages/admin/AdminLayout';
import Dashboard from './pages/admin/Dashboard';
import Usuarios from './pages/admin/Usuarios';
import Cartelera from './pages/admin/Cartelera';
import EspacioGrid from './pages/admin/EspacioGrid';
import Reportes from './pages/admin/Reportes';
import Compras from './pages/admin/Compras';
import WhatsAppWeb from './pages/admin/WhatsAppWeb';
import ContactoAdmin from './pages/admin/ContactoAdmin';
import BusquedaEntrada from './pages/admin/BusquedaEntrada';
import EntradasEscaneadas from './pages/admin/EntradasEscaneadas';
import PanelEnVivo from './pages/admin/PanelEnVivo';
import Cupones from './pages/admin/Cupones';
import MiPanelVentas from './pages/admin/MiPanelVentas';
import './App.css';

function AdminIndexRedirect() {
  const { user } = useAuth();
  const rol = (user?.rol || '').toLowerCase();
  if (rol === 'vendedor_externo') return <Navigate to="/admin/mi-panel" replace />;
  if (rol === 'vendedor') return <Navigate to="/admin/compras" replace />;
  if (rol === 'seguridad') return <Navigate to="/admin/busqueda-entrada" replace />;
  return <Navigate to="/admin/dashboard" replace />;
}

function App() {
  return (
    <AlertProvider>
      <AuthProvider>
        <Router>
        <Routes>
          {/* Rutas del panel admin (sin Header/Footer del sitio público) */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminIndexRedirect />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="usuarios" element={<Usuarios />} />
            <Route path="cartelera" element={<Cartelera />} />
            <Route path="espacio" element={<EspacioGrid />} />
            <Route path="compras" element={<Compras />} />
            <Route path="mi-panel" element={<MiPanelVentas />} />
            <Route path="reportes" element={<Reportes />} />
            <Route path="whatsapp-web" element={<WhatsAppWeb />} />
            <Route path="contacto" element={<ContactoAdmin />} />
            <Route path="busqueda-entrada" element={<BusquedaEntrada />} />
            <Route path="entradas-escaneadas" element={<EntradasEscaneadas />} />
            <Route path="panel-en-vivo" element={<PanelEnVivo />} />
            <Route path="cupones" element={<Cupones />} />
          </Route>
          
          {/* Rutas públicas con Header y Footer */}
          <Route path="/" element={<PublicLayout><Home /></PublicLayout>} />
          <Route path="/eventos" element={<PublicLayout><Eventos /></PublicLayout>} />
          <Route path="/evento/:slug" element={<PublicLayout><DetalleEvento /></PublicLayout>} />
          <Route path="/contacto" element={<PublicLayout><Contacto /></PublicLayout>} />
          <Route path="/login" element={<PublicLayout><Login /></PublicLayout>} />
          <Route path="/mi-informacion" element={<PublicLayout><MiInformacion /></PublicLayout>} />
          <Route path="/mis-compras" element={<PublicLayout><MisCompras /></PublicLayout>} />
          <Route path="/compra/:id" element={<PublicLayout><Compra /></PublicLayout>} />
          <Route path="/pago-qr/:id" element={<PublicLayout><PagoQR /></PublicLayout>} />
        </Routes>
      </Router>
      </AuthProvider>
    </AlertProvider>
  );
}

export default App;
