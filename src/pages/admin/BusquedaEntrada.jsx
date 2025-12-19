import { useState } from 'react';
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

  const tickearEntrada = async () => {
    if (!datosEntrada) return;

    setTickeando(true);
    try {
      const response = await api.post('/compras/tickear-entrada', {
        codigoEscaneo: datosEntrada.entrada.codigo_escaneo,
        tipo: datosEntrada.entrada.tipo,
        compra_asiento_id: datosEntrada.entrada.compra_asiento_id,
        compra_mesa_id: datosEntrada.entrada.compra_mesa_id
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

    setLoading(true);
    setError('');
    setDatosEntrada(null);

    try {
      console.log('🔍 Buscando código:', codigoLimpio);
      const response = await api.post('/compras/buscar-entrada', {
        codigoEscaneo: codigoLimpio
      });

      console.log('✅ Respuesta recibida:', response.data);

      if (response.data.success) {
        setDatosEntrada(response.data.data);
        setMostrarModal(true);
        setCodigo(''); // Limpiar input
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
              <strong>Código de Escaneo (5 dígitos):</strong>
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
                disabled={loading}
                autoFocus
              />
              <button
                onClick={buscarEntrada}
                className="btn-buscar"
                disabled={loading || codigo.trim().length !== 5}
              >
                {loading ? 'Buscando...' : '🔍 Buscar'}
              </button>
            </div>
            {error && (
              <div className="error-message">
                {error}
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

