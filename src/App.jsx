import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AlertProvider } from './context/AlertContext';
import PublicLayout from './components/PublicLayout';
import Home from './pages/Home';
import DetalleEvento from './pages/DetalleEvento';
import Eventos from './pages/Eventos';
import Contacto from './pages/Contacto';
import Login from './pages/Login';
import Account from './pages/Account';
import MiInformacion from './pages/MiInformacion';
import MisCompras from './pages/MisCompras';
import Compra from './pages/Compra';
import PagoQR from './pages/PagoQR';
import AdminLayout from './pages/admin/AdminLayout';
import Dashboard from './pages/admin/Dashboard';
import Usuarios from './pages/admin/Usuarios';
import Cartelera from './pages/admin/Cartelera';
import Espacio from './pages/admin/Espacio';
import Reportes from './pages/admin/Reportes';
import Compras from './pages/admin/Compras';
import WhatsAppWeb from './pages/admin/WhatsAppWeb';
import ContactoAdmin from './pages/admin/ContactoAdmin';
import BusquedaEntrada from './pages/admin/BusquedaEntrada';
import EntradasEscaneadas from './pages/admin/EntradasEscaneadas';
import './App.css';

function App() {
  return (
    <AlertProvider>
      <AuthProvider>
        <Router>
        <Routes>
          {/* Rutas del panel admin (sin Header/Footer del sitio público) */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="usuarios" element={<Usuarios />} />
            <Route path="cartelera" element={<Cartelera />} />
            <Route path="espacio" element={<Espacio />} />
            <Route path="compras" element={<Compras />} />
            <Route path="reportes" element={<Reportes />} />
            <Route path="whatsapp-web" element={<WhatsAppWeb />} />
            <Route path="contacto" element={<ContactoAdmin />} />
            <Route path="busqueda-entrada" element={<BusquedaEntrada />} />
            <Route path="entradas-escaneadas" element={<EntradasEscaneadas />} />
          </Route>
          
          {/* Rutas públicas con Header y Footer */}
          <Route path="/" element={<PublicLayout><Home /></PublicLayout>} />
          <Route path="/eventos" element={<PublicLayout><Eventos /></PublicLayout>} />
          <Route path="/evento/:id" element={<PublicLayout><DetalleEvento /></PublicLayout>} />
          <Route path="/contacto" element={<PublicLayout><Contacto /></PublicLayout>} />
          <Route path="/login" element={<PublicLayout><Login /></PublicLayout>} />
          <Route path="/mi-informacion" element={<PublicLayout><MiInformacion /></PublicLayout>} />
          <Route path="/mis-compras" element={<PublicLayout><MisCompras /></PublicLayout>} />
          <Route path="/account" element={<Account />} />
          <Route path="/compra/:id" element={<PublicLayout><Compra /></PublicLayout>} />
          <Route path="/pago-qr/:id" element={<PublicLayout><PagoQR /></PublicLayout>} />
        </Routes>
      </Router>
      </AuthProvider>
    </AlertProvider>
  );
}

export default App;
