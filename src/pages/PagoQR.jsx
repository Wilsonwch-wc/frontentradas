import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import { QRCodeSVG } from 'qrcode.react';
import api from '../api/axios';
import { getServerBase } from '../api/base';
import './PagoQR.css';

const PagoQR = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const { showConfirm } = useAlert();
  const serverBase = getServerBase();
  const [loading, setLoading] = useState(true);
  const [pago, setPago] = useState(null);
  const [error, setError] = useState('');
  const [eventoData, setEventoData] = useState(null);
  const [seleccionesData, setSeleccionesData] = useState([]);
  const [formDataCompra, setFormDataCompra] = useState(null);
  const [codigoCompra, setCodigoCompra] = useState(null);
  const [compraData, setCompraData] = useState(null);

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }

    cargarDatos();
  }, [id, isAuthenticated, navigate]);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      // Cargar código de compra desde localStorage
      const codigo = localStorage.getItem('codigoCompra');
      if (codigo) {
        setCodigoCompra(codigo);
        
        // Cargar datos de la compra desde el backend
        try {
          const resCompra = await api.get(`/compras/codigo/${codigo}`);
          if (resCompra.data?.success) {
            setCompraData(resCompra.data.data);
          }
        } catch (err) {
          console.error('Error al cargar compra:', err);
        }
      }

      // Evento fresco desde API para traer qr_pago_url actualizado
      const resEvento = await api.get(`/eventos-public/${id}`);
      if (resEvento.data?.success) {
        setEventoData(resEvento.data.data);
      } else {
        setEventoData(null);
      }

      // Cargar selecciones (asientos) si es evento especial desde localStorage
      const selecciones = JSON.parse(localStorage.getItem('seleccionesCompra') || '[]');
      setSeleccionesData(selecciones);
      
      // Cargar datos del formulario
      const formData = JSON.parse(localStorage.getItem('formDataCompra') || '{}');
      setFormDataCompra(formData);

      // Generar QR estático de prueba (si no hay qr_pago_url)
      crearPagoQRPrueba();
    } catch (err) {
      console.error('Error cargando datos de pago:', err);
      setError('No se pudo cargar la información de pago');
    } finally {
      setLoading(false);
    }
  };

  const crearPagoQRPrueba = () => {
    setLoading(true);
    
    // Simular generación de QR (modo prueba)
    const evento = JSON.parse(localStorage.getItem('eventoCompra') || '{}');
    const cantidad = parseInt(localStorage.getItem('cantidadCompra') || '1');
    const total = parseFloat(localStorage.getItem('totalCompra') || '0');
    
    // Generar referencia única
    const referencia = `EVENTO_${id}_USER_${user?.id}_${Date.now()}`;
    
    // Crear URL de pago de prueba (simulando una pasarela de pago)
    const qrUrl = `https://pago.ejemplo.com/bo/pagar?ref=${referencia}&monto=${total}&evento=${id}&cantidad=${cantidad}`;
    
    // Crear objeto de pago simulado
    const pagoSimulado = {
      paymentId: Date.now(),
      preferenceId: `TEST_${Date.now()}`,
      qrCodeUrl: qrUrl,
      externalReference: referencia,
      status: 'pending',
      monto: total,
      cantidad: cantidad,
      evento: evento
    };

    // Simular delay de API
    setTimeout(() => {
      setPago(pagoSimulado);
      setLoading(false);
    }, 1000);
  };

  const limpiarDatosCompra = async () => {
    const confirmado = await showConfirm('¿Estás seguro de eliminar todos los datos de esta compra? Esta acción no se puede deshacer.', { 
      type: 'warning',
      title: 'Limpiar Datos'
    });
    if (confirmado) {
      // Limpiar todos los datos relacionados con la compra
      localStorage.removeItem('codigoCompra');
      localStorage.removeItem('compraId');
      localStorage.removeItem('eventoCompra');
      localStorage.removeItem('cantidadCompra');
      localStorage.removeItem('totalCompra');
      localStorage.removeItem('formDataCompra');
      localStorage.removeItem('seleccionesCompra');
      
      // Limpiar estados
      setCompraData(null);
      setCodigoCompra(null);
      setEventoData(null);
      setSeleccionesData([]);
      setFormDataCompra(null);
      setPago(null);
      
      // Redirigir a la página de eventos
      navigate('/eventos');
    }
  };

  const enviarComprobantePorWhatsApp = () => {
    if (!eventoData || !codigoCompra) return;

    const numeroWhatsApp = import.meta.env.VITE_WHATSAPP || '59162556840';
    const cantidad = compraData?.cantidad || pago?.cantidad || localStorage.getItem('cantidadCompra') || '';
    const totalRaw = compraData?.total || pago?.monto || localStorage.getItem('totalCompra') || '0';
    const total = typeof totalRaw === 'number' ? totalRaw.toFixed(2) : (typeof totalRaw === 'string' ? parseFloat(totalRaw).toFixed(2) : '0.00');

    // Mensaje corto solicitado
    const mensaje = `Hola, estoy comprando para el evento ${eventoData.titulo || id}\nEl código es: ${codigoCompra}`;
    
    const mensajeCodificado = encodeURIComponent(mensaje);

    // Intentar distintas variantes para evitar bloqueos de pop-up
    const urls = [
      `https://wa.me/${numeroWhatsApp}?text=${mensajeCodificado}`,
      `https://api.whatsapp.com/send?phone=${numeroWhatsApp}&text=${mensajeCodificado}`,
      `whatsapp://send?phone=${numeroWhatsApp}&text=${mensajeCodificado}`
    ];

    // Preferir abrir en la misma pestaña para móviles, nueva pestaña para desktop
    const target = /Mobi|Android/i.test(navigator.userAgent) ? '_self' : '_blank';

    const opened = window.open(urls[0], target);
    if (!opened) {
      // Fallback a la segunda URL
      window.open(urls[1], target);
    }
  };

  if (loading) {
    return (
      <div className="pago-qr-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Generando código QR de pago...</p>
        </div>
      </div>
    );
  }

  if (error && !pago) {
    return (
      <div className="pago-qr-page">
        <div className="error-container">
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={() => navigate(-1)} className="btn-volver">
            Volver
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pago-qr-page">
      <div className="container">
        <button onClick={() => navigate(-1)} className="btn-volver">
          ← Volver
        </button>

        <div className="pago-qr-content">
          <div className="pago-qr-card">
            <h1>Información del Pago</h1>
            {eventoData && (
              <div className="pago-info">
                <p><strong>Evento:</strong> {eventoData.titulo}</p>
                <p><strong>Cantidad:</strong> {compraData?.cantidad || pago?.cantidad} entrada(s)</p>
                <p><strong>Total:</strong> ${(() => {
                  const total = compraData?.total || pago?.monto;
                  if (total !== null && total !== undefined) {
                    const totalNum = typeof total === 'number' ? total : parseFloat(total);
                    return isNaN(totalNum) ? '0.00' : totalNum.toFixed(2);
                  }
                  return '0.00';
                })()} BOB</p>
                {codigoCompra && (
                  <div style={{ 
                    marginTop: '15px', 
                    padding: '15px', 
                    backgroundColor: '#f0f8ff', 
                    borderRadius: '8px',
                    border: '2px solid #4CAF50'
                  }}>
                    <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>
                      <strong>Código de Compra:</strong>
                    </p>
                    <p style={{ 
                      margin: '5px 0 0 0', 
                      fontSize: '20px', 
                      fontWeight: 'bold', 
                      color: '#4CAF50',
                      letterSpacing: '2px'
                    }}>
                      {codigoCompra}
                    </p>
                    <p style={{ margin: '10px 0 0 0', fontSize: '12px', color: '#666' }}>
                      Envía este código al personal para verificar tu compra
                    </p>
                  </div>
                )}
              </div>
            )}

            {(eventoData?.qr_pago_url || pago) && (
              <div className="qr-container">
                <div className="qr-code-wrapper">
                  {eventoData?.qr_pago_url ? (
                    <img
                      src={eventoData.qr_pago_url.startsWith('http') ? eventoData.qr_pago_url : `${serverBase}${eventoData.qr_pago_url}`}
                      alt="QR de pago"
                      style={{ width: 360, height: 360, objectFit: 'contain', background: '#fff', padding: '10px', borderRadius: '12px' }}
                    />
                  ) : (
                    <QRCodeSVG
                      value={pago.qrCodeUrl}
                      size={360}
                      level="H"
                      includeMargin={true}
                      fgColor="#2c3e50"
                      bgColor="#ffffff"
                    />
                  )}
                </div>
              </div>
            )}

            <div className="pago-actions" style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button 
                onClick={enviarComprobantePorWhatsApp} 
                className="btn-whatsapp"
                style={{ width: '100%', padding: '15px', fontSize: '16px' }}
              >
                📱 Enviar Comprobante
              </button>
              <button 
                onClick={limpiarDatosCompra} 
                className="btn-limpiar"
                style={{ 
                  width: '100%', 
                  padding: '12px', 
                  fontSize: '14px',
                  background: '#e74c3c',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                🗑️ Limpiar Datos de Compra
              </button>
            </div>

            {error && (
              <div className="error-message">
                {error}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PagoQR;
