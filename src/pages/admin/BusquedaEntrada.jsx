import { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import api from '../../api/axios';
import { useAlert } from '../../context/AlertContext';
import './BusquedaEntrada.css';

const BusquedaEntrada = () => {
  const { showAlert } = useAlert();
  const [codigo, setCodigo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mostrarModal, setMostrarModal] = useState(false);
  const [datosEntrada, setDatosEntrada] = useState(null);
  const [tickeando, setTickeando] = useState(false);
  const [escanearQR, setEscanearQR] = useState(false);
  const qrCodeRegionId = 'qr-reader';
  const html5QrCodeRef = useRef(null);

  const tickearEntrada = async () => {
    if (!datosEntrada) return;

    setTickeando(true);
    try {
      const response = await api.post('/compras/tickear-entrada', {
        codigoEscaneo: datosEntrada.entrada.codigo_escaneo,
        tipo: datosEntrada.entrada.tipo,
        compra_asiento_id: datosEntrada.entrada.compra_asiento_id,
        compra_mesa_id: datosEntrada.entrada.compra_mesa_id,
        compra_entrada_general_id: datosEntrada.entrada.compra_entrada_general_id
      });

      if (response.data.success) {
        // Actualizar estado local
        setDatosEntrada({
          ...datosEntrada,
          entrada: {
            ...datosEntrada.entrada,
            ya_escaneado: true,
            fecha_escaneo: new Date()
          },
          ya_escaneada: true
        });
      }
    } catch (error) {
      console.error('Error al tickear:', error);
      showAlert(error.response?.data?.message || 'Error al tickear la entrada', { type: 'error' });
    } finally {
      setTickeando(false);
    }
  };

  const procesarCodigoQR = async (qrData) => {
    try {
      // Intentar parsear como JSON
      const qrJson = JSON.parse(qrData);
      console.log('📱 QR parseado:', qrJson);
      
      // El QR contiene 'codigo' que es el código único de la compra (ej: "ENT-1766583828542-9705")
      if (qrJson.codigo) {
        const index = qrJson.index !== undefined ? qrJson.index : 0;
        return buscarEntradaPorCodigoUnico(qrJson.codigo, index);
      }
      
      throw new Error('QR no contiene código de compra válido');
    } catch (parseError) {
      console.error('Error al parsear QR:', parseError);
      // Si no es JSON, intentar como código de 5 dígitos directamente
      if (/^\d{5}$/.test(qrData)) {
        return buscarEntradaPorCodigoEscaneo(qrData);
      }
      throw new Error('QR no válido. Debe ser un código de 5 dígitos o un QR válido de entrada.');
    }
  };

  const buscarEntradaPorCodigoUnico = async (codigoUnico, index = 0) => {
    try {
      console.log(`🔍 Buscando compra por código único: ${codigoUnico}, index: ${index}`);
      
      // Obtener la compra por código único
      const compraResponse = await api.get(`/compras/codigo/${codigoUnico}`);
      if (compraResponse.data.success) {
        const compra = compraResponse.data.data;
        return buscarCodigoEscaneoDesdeCompra(compra, index);
      }
      throw new Error('Compra no encontrada');
    } catch (error) {
      console.error('Error al buscar por código único:', error);
      throw error;
    }
  };

  const buscarCodigoEscaneoDesdeCompra = async (compra, index = 0) => {
    let codigoEscaneo = null;
    
    // Si tiene asientos y el index corresponde a un asiento
    if (compra.asientos && compra.asientos.length > index) {
      const asiento = compra.asientos[index];
      if (asiento.codigo_escaneo) {
        codigoEscaneo = asiento.codigo_escaneo;
      }
    }
    
    // Si no encontró en asientos, buscar en mesas
    if (!codigoEscaneo && compra.mesas && compra.mesas.length > 0) {
      const mesa = compra.mesas[index < compra.mesas.length ? index : 0];
      if (mesa.codigo_escaneo) {
        codigoEscaneo = mesa.codigo_escaneo;
      }
    }
    
    // Si aún no encontró, buscar en entradas generales (necesitaría agregar esto al response)
    // Por ahora, si no encuentra, usar el primer código disponible
    if (!codigoEscaneo && compra.asientos && compra.asientos.length > 0) {
      codigoEscaneo = compra.asientos[0].codigo_escaneo;
    }
    
    if (!codigoEscaneo && compra.mesas && compra.mesas.length > 0) {
      codigoEscaneo = compra.mesas[0].codigo_escaneo;
    }
    
    if (!codigoEscaneo) {
      throw new Error('No se encontró código de escaneo en la compra');
    }
    
    return buscarEntradaPorCodigoEscaneo(codigoEscaneo);
  };

  const buscarEntradaPorCodigoEscaneo = async (codigoEscaneo) => {
    setLoading(true);
    setError('');
    setDatosEntrada(null);

    try {
      console.log('🔍 Buscando código:', codigoEscaneo);
      const response = await api.post('/compras/buscar-entrada', {
        codigoEscaneo: codigoEscaneo.toString().trim()
      });

      console.log('✅ Respuesta recibida:', response.data);

      if (response.data.success) {
        setDatosEntrada(response.data.data);
        setMostrarModal(true);
        setCodigo(''); // Limpiar input
        // Detener el escáner QR si está activo
        if (escanearQR) {
          detenerEscanerQR();
        }
      }
    } catch (error) {
      console.error('❌ Error al buscar:', error);
      const mensajeError = error.response?.data?.message || error.message || 'Error al buscar la entrada';
      setError(`❌ ${mensajeError}`);
      
      if (error.response?.status === 404) {
        setError('❌ Código no encontrado o entrada no confirmada');
      } else if (error.response?.status === 401) {
        setError('❌ No autorizado. Por favor, inicia sesión nuevamente.');
      } else if (error.response?.status === 403) {
        setError('❌ No tienes permisos para acceder a esta función.');
      }
    } finally {
      setLoading(false);
    }
  };

  const buscarEntrada = async () => {
    const codigoLimpio = codigo.trim();
    
    if (!codigoLimpio) {
      setError('Por favor ingresa un código de escaneo');
      return;
    }

    if (!/^\d{5}$/.test(codigoLimpio)) {
      setError('El código debe ser de 5 dígitos');
      return;
    }

    await buscarEntradaPorCodigoEscaneo(codigoLimpio);
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return '-';
    const date = new Date(fecha);
    return date.toLocaleString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const cerrarModal = () => {
    setMostrarModal(false);
    setDatosEntrada(null);
    setCodigo('');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && codigo.trim().length === 5 && !loading) {
      buscarEntrada();
    }
  };

  const iniciarEscanerQR = () => {
    setError('');
    setEscanearQR(true);
    // La inicialización real se hace en useEffect cuando el elemento está disponible
  };

  const detenerEscanerQR = async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop().catch(err => {
          console.warn('Error al detener (puede estar ya detenido):', err);
        });
        html5QrCodeRef.current.clear();
      } catch (err) {
        console.error('Error al limpiar escáner:', err);
      } finally {
        html5QrCodeRef.current = null;
      }
    }
    setEscanearQR(false);
  };

  useEffect(() => {
    // Inicializar escáner cuando escanearQR se active y el elemento esté disponible
    if (escanearQR && !html5QrCodeRef.current) {
      const initializeScanner = async () => {
        try {
          // Esperar a que el elemento se renderice
          await new Promise(resolve => setTimeout(resolve, 200));
          
          const element = document.getElementById(qrCodeRegionId);
          if (!element) {
            setError('❌ No se pudo encontrar el elemento del escáner. Por favor, intenta nuevamente.');
            setEscanearQR(false);
            return;
          }

          const html5QrCode = new Html5Qrcode(qrCodeRegionId);
          html5QrCodeRef.current = html5QrCode;

          try {
            await html5QrCode.start(
              { facingMode: 'environment' }, // Cámara trasera
              {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0
              },
              async (decodedText, decodedResult) => {
                console.log('📷 QR escaneado:', decodedText);
                
                // Detener el escáner después de escanear exitosamente
                await detenerEscanerQR();
                
                // Procesar el código QR
                try {
                  await procesarCodigoQR(decodedText);
                } catch (err) {
                  console.error('Error al procesar QR:', err);
                  setError(`❌ ${err.message}`);
                }
              },
              (errorMessage) => {
                // Ignorar errores de escaneo continuo (son normales mientras busca)
              }
            );
          } catch (cameraError) {
            console.error('Error de cámara:', cameraError);
            setEscanearQR(false);
            if (cameraError.message && cameraError.message.includes('NotAllowedError')) {
              setError('❌ Permisos de cámara denegados. Por favor, permite el acceso a la cámara en la configuración del navegador.');
            } else if (cameraError.message && cameraError.message.includes('NotFoundError')) {
              setError('❌ No se encontró ninguna cámara. Por favor, conecta una cámara y vuelve a intentar.');
            } else if (cameraError.message && cameraError.message.includes('NotReadableError')) {
              setError('❌ La cámara está siendo usada por otra aplicación. Por favor, cierra otras aplicaciones que usen la cámara.');
            } else {
              setError(`❌ Error al acceder a la cámara: ${cameraError.message || 'Error desconocido'}`);
            }
            html5QrCodeRef.current = null;
          }
        } catch (err) {
          console.error('Error al inicializar escáner:', err);
          setError(`❌ ${err.message || 'Error al inicializar el escáner QR'}`);
          setEscanearQR(false);
          html5QrCodeRef.current = null;
        }
      };

      initializeScanner();
    }

    // Limpiar al desmontar o cuando escanearQR se desactiva
    return () => {
      if (!escanearQR && html5QrCodeRef.current) {
        detenerEscanerQR();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escanearQR]);

  return (
    <div className="admin-page busqueda-entrada-page">
      <div className="admin-content">
        <div className="busqueda-header">
          <h1>🔍 Búsqueda de Entrada</h1>
          <p>Ingresa el código de escaneo para buscar y verificar una entrada</p>
        </div>

        <div className="busqueda-container">
          <div className="busqueda-input-section">
            <label className="label-codigo">
              <strong>Código de Escaneo (5 dígitos) o Escanear QR:</strong>
            </label>
            <div className="input-group-busqueda">
              <input
                type="text"
                placeholder="Ejemplo: 90127"
                value={codigo}
                onChange={(e) => {
                  const valor = e.target.value.replace(/\D/g, '').slice(0, 5);
                  setCodigo(valor);
                  setError('');
                }}
                onKeyPress={handleKeyPress}
                className="input-codigo"
                maxLength={5}
                disabled={loading || escanearQR}
                autoFocus
              />
              <button
                onClick={buscarEntrada}
                className="btn-buscar"
                disabled={loading || escanearQR || codigo.trim().length !== 5}
              >
                {loading ? 'Buscando...' : '🔍 Buscar'}
              </button>
              <button
                onClick={escanearQR ? detenerEscanerQR : iniciarEscanerQR}
                className="btn-qr"
                disabled={loading}
                style={{ marginLeft: '10px' }}
              >
                {escanearQR ? '⏹️ Detener QR' : '📷 Escanear QR'}
              </button>
            </div>
            {error && (
              <div className="error-message">
                {error}
              </div>
            )}
            
            {/* Área del escáner QR */}
            {escanearQR && (
              <div style={{ marginTop: '20px', textAlign: 'center' }}>
                <div 
                  id={qrCodeRegionId} 
                  style={{ 
                    width: '100%', 
                    maxWidth: '500px', 
                    margin: '0 auto',
                    minHeight: '300px'
                  }}
                ></div>
                <p style={{ marginTop: '10px', color: '#666' }}>
                  Apunta la cámara hacia el código QR del boleto
                </p>
                <button
                  onClick={detenerEscanerQR}
                  className="btn-qr"
                  style={{ marginTop: '10px' }}
                >
                  ⏹️ Detener Escaneo
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Modal con los datos encontrados */}
        {mostrarModal && datosEntrada && (
          <div className="modal-overlay" onClick={cerrarModal}>
            <div className="modal-busqueda" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header-busqueda">
                <h2>
                  {datosEntrada.ya_escaneada 
                    ? '⚠️ Entrada ya escaneada anteriormente' 
                    : '✅ Entrada encontrada'}
                </h2>
                <button
                  className="btn-cerrar-modal"
                  onClick={cerrarModal}
                >
                  ✕
                </button>
              </div>

              <div className="modal-body-busqueda">
                <div className="info-entrada">
                  <div className="info-row">
                    <span className="info-label">Evento:</span>
                    <span className="info-value">{datosEntrada.compra.evento}</span>
                  </div>
                  
                  <div className="info-row">
                    <span className="info-label">Cliente:</span>
                    <span className="info-value">{datosEntrada.compra.cliente_nombre}</span>
                  </div>
                  
                  <div className="info-row">
                    <span className="info-label">Código de Compra:</span>
                    <span className="info-value">{datosEntrada.compra.codigo_unico}</span>
                  </div>
                  
                  {datosEntrada.entrada.codigo_escaneo && (
                    <div className="info-row destacado">
                      <span className="info-label">Código de Escaneo:</span>
                      <span className="info-value codigo-destacado">
                        {datosEntrada.entrada.codigo_escaneo}
                      </span>
                    </div>
                  )}
                  
                  <div className="info-row">
                    <span className="info-label">Tipo de Entrada:</span>
                    <span className="info-value">{datosEntrada.entrada.tipo}</span>
                  </div>

                  {datosEntrada.entrada.tipo === 'ASIENTO' && (
                    <>
                      <div className="info-row">
                        <span className="info-label">Asiento:</span>
                        <span className="info-value">{datosEntrada.entrada.numero_asiento}</span>
                      </div>
                      {datosEntrada.entrada.numero_mesa && (
                        <div className="info-row">
                          <span className="info-label">Mesa:</span>
                          <span className="info-value">M{datosEntrada.entrada.numero_mesa}</span>
                        </div>
                      )}
                      {datosEntrada.entrada.tipo_precio && (
                        <div className="info-row">
                          <span className="info-label">Tipo de Precio:</span>
                          <span className="info-value">{datosEntrada.entrada.tipo_precio}</span>
                        </div>
                      )}
                    </>
                  )}

                  {datosEntrada.entrada.tipo === 'MESA' && (
                    <>
                      <div className="info-row">
                        <span className="info-label">Mesa:</span>
                        <span className="info-value">M{datosEntrada.entrada.numero_mesa}</span>
                      </div>
                      <div className="info-row">
                        <span className="info-label">Cantidad de Sillas:</span>
                        <span className="info-value">{datosEntrada.entrada.cantidad_sillas} silla(s)</span>
                      </div>
                    </>
                  )}

                  {datosEntrada.entrada.fecha_escaneo && (
                    <div className="info-row">
                      <span className="info-label">Fecha de Escaneo:</span>
                      <span className="info-value">
                        {formatearFecha(datosEntrada.entrada.fecha_escaneo)}
                      </span>
                    </div>
                  )}

                  {datosEntrada.ya_escaneada && (
                    <div className="info-row advertencia">
                      <span className="info-label">⚠️ Estado:</span>
                      <span className="info-value">Esta entrada ya fue escaneada anteriormente</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-footer-busqueda">
                {!datosEntrada.ya_escaneada && (
                  <button
                    className="btn-tickear"
                    onClick={tickearEntrada}
                    disabled={tickeando}
                  >
                    {tickeando ? 'Tickeando...' : '✓ Tickear Entrada'}
                  </button>
                )}
                <button
                  className="btn-cerrar"
                  onClick={cerrarModal}
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BusquedaEntrada;

