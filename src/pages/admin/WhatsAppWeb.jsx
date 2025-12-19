import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useAlert } from '../../context/AlertContext';
import './WhatsAppWeb.css';

const WhatsAppWeb = () => {
  const { showAlert, showConfirm } = useAlert();
  const [estado, setEstado] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reiniciando, setReiniciando] = useState(false);

  useEffect(() => {
    cargarEstado();
    // Actualizar cada 2 segundos para ver cambios en tiempo real
    const interval = setInterval(cargarEstado, 2000);
    return () => clearInterval(interval);
  }, []);

  const cargarEstado = async () => {
    try {
      const response = await api.get('/compras/whatsapp-web/estado');
      if (response.data.success) {
        setEstado(response.data);
        setError('');
      } else {
        setError(response.data.message || 'Error al obtener el estado');
      }
    } catch (error) {
      console.error('Error al cargar estado:', error);
      setError(error.response?.data?.message || 'Error al obtener el estado de WhatsApp Web');
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
        showAlert('Sesión reiniciada. Escanea el nuevo código QR.', { type: 'success' });
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

        {error && <div className="error-message">{error}</div>}

        {estado && (
          <div className="whatsapp-status">
            <div className={`status-card ${estado.isReady ? 'status-ready' : 'status-not-ready'}`}>
              <div className="status-header">
                <h2>Estado de Conexión</h2>
                <span className={`status-badge ${estado.isReady ? 'badge-ready' : 'badge-not-ready'}`}>
                  {estado.isReady ? '✅ Conectado' : '❌ Desconectado'}
                </span>
              </div>

              <div className="status-info">
                <div className="info-item">
                  <strong>Estado:</strong>
                  <span>{estado.isReady ? 'WhatsApp Web está listo para enviar mensajes' : 'WhatsApp Web no está conectado'}</span>
                </div>
                <div className="info-item">
                  <strong>Inicializado:</strong>
                  <span>{estado.isInitialized ? 'Sí' : 'No'}</span>
                </div>
              </div>
            </div>

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

            {estado.isReady && (
              <div className="ready-section">
                <div className="ready-message">
                  <h3>✅ WhatsApp Web está conectado</h3>
                  <p>Ahora puedes enviar boletos por WhatsApp Web desde la página de Compras.</p>
                </div>
              </div>
            )}

            {!estado.isReady && !estado.qrCodeImage && (
              <div className="waiting-section">
                <div className="waiting-message">
                  <h3>⏳ Esperando conexión...</h3>
                  <p>El sistema está inicializando WhatsApp Web. Por favor, espera unos segundos.</p>
                  <p>Si el código QR no aparece después de unos momentos, recarga la página.</p>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="whatsapp-info">
          <h3>Información</h3>
          <ul>
            <li>WhatsApp Web permite enviar boletos directamente a los clientes</li>
            <li>La conexión se mantiene activa mientras el servidor esté en ejecución</li>
            <li>Solo necesitas escanear el código QR una vez (la sesión se guarda)</li>
            <li>Si la sesión expira, aparecerá un nuevo código QR aquí</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default WhatsAppWeb;

