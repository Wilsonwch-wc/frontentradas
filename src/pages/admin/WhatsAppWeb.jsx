import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useAlert } from '../../context/AlertContext';
import './WhatsAppWeb.css';

const WhatsAppWeb = () => {
  const { showAlert, showConfirm } = useAlert();
  const [estado, setEstado] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reiniciando, setReiniciando] = useState(false);

  useEffect(() => {
    cargarEstado();
    // Actualizar cada 3 segundos para ver cambios en tiempo real
    const interval = setInterval(cargarEstado, 3000);
    return () => clearInterval(interval);
  }, []);

  const cargarEstado = async () => {
    try {
      const response = await api.get('/compras/whatsapp-web/estado');
      if (response.data.success) {
        setEstado(response.data);
      }
    } catch (error) {
      console.error('Error al cargar estado:', error);
    } finally {
      setLoading(false);
    }
  };

  const reiniciarSesion = async () => {
    const confirmado = await showConfirm('Esto cerrará la sesión guardada y generará un nuevo QR. ¿Continuar?', { 
      type: 'warning',
      title: 'Reiniciar Sesión'
    });
    if (!confirmado) {
      return;
    }
    try {
      setReiniciando(true);
      const response = await api.post('/compras/whatsapp-web/reiniciar');
      if (response.data.success) {
        await cargarEstado();
        showAlert('Sesión reiniciada correctamente.', { type: 'success' });
      } else {
        showAlert(response.data.message || 'No se pudo reiniciar la sesión', { type: 'error' });
      }
    } catch (err) {
      console.error('Error al reiniciar sesión de WhatsApp:', err);
      showAlert(err.response?.data?.message || 'Error al reiniciar la sesión de WhatsApp', { type: 'error' });
    } finally {
      setReiniciando(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-page whatsapp-web-page">
        <div className="loading">Cargando estado de WhatsApp Web...</div>
      </div>
    );
  }

  return (
    <div className="admin-page whatsapp-web-page">
      <div className="admin-content">
        <div className="whatsapp-header">
          <h1>WhatsApp Web</h1>
          <p>Gestiona la conexión de WhatsApp Web para enviar boletos</p>
          <button className="btn-restart" onClick={reiniciarSesion} disabled={reiniciando}>
            {reiniciando ? 'Reiniciando...' : 'Reiniciar sesión'}
          </button>
        </div>

        {estado && (
          <div className="whatsapp-status">
            <div className={`status-card ${estado.isReady ? 'status-ready' : 'status-not-ready'}`}>
              <div className="status-header">
                <h2>Estado</h2>
                <span className={`status-badge ${estado.isReady ? 'badge-ready' : 'badge-not-ready'}`}>
                  {estado.isReady ? '✅ Conectado' : '❌ Desconectado'}
                </span>
              </div>

              {estado.isReady && estado.numeroWhatsApp && (
                <div className="status-info">
                  <div className="info-item">
                    <strong>Número conectado:</strong>
                    <span>{estado.numeroWhatsApp}</span>
                  </div>
                </div>
              )}

              {!estado.isReady && estado.qrCodeImage && (
                <div className="qr-section">
                  <h3>Escanea este código QR con WhatsApp</h3>
                  <div className="qr-instructions">
                    <ol>
                      <li>Abre WhatsApp en tu teléfono</li>
                      <li>Ve a <strong>Configuración</strong> → <strong>Dispositivos vinculados</strong></li>
                      <li>Toca <strong>Vincular un dispositivo</strong></li>
                      <li>Escanea este código QR</li>
                    </ol>
                  </div>
                  <div className="qr-container">
                    <img 
                      src={estado.qrCodeImage} 
                      alt="Código QR de WhatsApp Web" 
                      className="qr-image"
                    />
                  </div>
                  <p className="qr-note">
                    ⚠️ El código QR expira después de unos minutos. Si expira, recarga la página.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WhatsAppWeb;

