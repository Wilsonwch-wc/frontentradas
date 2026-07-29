import { useState, useEffect, useRef } from 'react';
import api from '../../api/axios';
import { useAlert } from '../../context/AlertContext';
import './WhatsAppWeb.css';

const WhatsAppWeb = () => {
  const { showAlert, showConfirm } = useAlert();
  const [estado, setEstado] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reiniciando, setReiniciando] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const countdownRef = useRef(null);
  const lastQrRef = useRef(null);

  useEffect(() => {
    cargarEstado();
    // Intervalo base de consulta
    const interval = setInterval(cargarEstado, 3000);
    return () => {
      clearInterval(interval);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  // Iniciar/reiniciar el contador cada vez que llega un QR nuevo
  const iniciarContador = () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setCountdown(60);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const cargarEstado = async () => {
    try {
      const response = await api.get('/compras/whatsapp-web/estado');
      if (response.data.success) {
        setEstado(response.data);
        // Si hay un QR nuevo (diferente al anterior), reiniciar el contador
        const nuevoQr = response.data.qrCode;
        if (nuevoQr && nuevoQr !== lastQrRef.current) {
          lastQrRef.current = nuevoQr;
          iniciarContador();
        }
        // Si ya se conectó, limpiar el contador
        if (response.data.isReady) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          setCountdown(null);
          lastQrRef.current = null;
        }
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
      lastQrRef.current = null;
      if (countdownRef.current) clearInterval(countdownRef.current);
      setCountdown(null);
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

  // Color del contador según tiempo restante
  const getCountdownColor = () => {
    if (countdown > 30) return '#25d366';
    if (countdown > 10) return '#f59e0b';
    return '#ef4444';
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

                  {/* Contador de tiempo */}
                  {countdown !== null && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '10px',
                      margin: '12px 0',
                      padding: '10px 16px',
                      backgroundColor: '#f8f9fa',
                      borderRadius: '8px',
                      border: `2px solid ${getCountdownColor()}`,
                    }}>
                      <span style={{ fontSize: '14px', color: '#555' }}>⏱️ El QR se renueva en:</span>
                      <span style={{
                        fontSize: '24px',
                        fontWeight: 'bold',
                        color: getCountdownColor(),
                        minWidth: '40px',
                        textAlign: 'center',
                        transition: 'color 0.3s',
                      }}>
                        {countdown}s
                      </span>
                      {countdown === 0 && (
                        <span style={{ fontSize: '13px', color: '#888' }}>⟳ Actualizando...</span>
                      )}
                    </div>
                  )}

                  <div className="qr-container">
                    <img 
                      src={estado.qrCodeImage} 
                      alt="Código QR de WhatsApp Web" 
                      className="qr-image"
                    />
                  </div>
                  <p className="qr-note">
                    ⚠️ Si el QR expira antes de escanearlo, espera a que aparezca uno nuevo automáticamente.
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
