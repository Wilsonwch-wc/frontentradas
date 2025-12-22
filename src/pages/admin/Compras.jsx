import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useAlert } from '../../context/AlertContext';
import './Compras.css';

const Compras = () => {
  const { showAlert, showConfirm } = useAlert();
  const [compras, setCompras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [codigoBusqueda, setCodigoBusqueda] = useState('');
  const [compraSeleccionada, setCompraSeleccionada] = useState(null);
  const [mostrarDetalle, setMostrarDetalle] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState(''); // 'PAGO_PENDIENTE', 'PAGO_REALIZADO', etc.
  const [confirmando, setConfirmando] = useState(false);
  const [reenviando, setReenviando] = useState(false);
  const [eliminando, setEliminando] = useState(false);

  useEffect(() => {
    cargarCompras();
  }, [filtroEstado]);

  const cargarCompras = async () => {
    try {
      setLoading(true);
      const params = filtroEstado ? { estado: filtroEstado } : {};
      const response = await api.get('/compras', { params });
      if (response.data.success) {
        setCompras(response.data.data);
      }
    } catch (error) {
      console.error('Error al cargar compras:', error);
      setError('Error al cargar las compras');
    } finally {
      setLoading(false);
    }
  };

  const buscarPorCodigo = async () => {
    if (!codigoBusqueda.trim()) {
      showAlert('Por favor ingresa un código', { type: 'warning' });
      return;
    }

    try {
      setLoading(true);
      const response = await api.get(`/compras/codigo/${codigoBusqueda.trim()}`);
      if (response.data.success) {
        setCompraSeleccionada(response.data.data);
        setMostrarDetalle(true);
        setError('');
      } else {
        setError('Compra no encontrada');
        setCompraSeleccionada(null);
        setMostrarDetalle(false);
      }
    } catch (error) {
      console.error('Error al buscar compra:', error);
      setError('Compra no encontrada con ese código');
      setCompraSeleccionada(null);
      setMostrarDetalle(false);
    } finally {
      setLoading(false);
    }
  };

  const verDetalle = async (compra) => {
    try {
      setLoading(true);
      const response = await api.get(`/compras/codigo/${compra.codigo_unico}`);
      if (response.data.success) {
        setCompraSeleccionada(response.data.data);
        setMostrarDetalle(true);
      }
    } catch (error) {
      console.error('Error al cargar detalle:', error);
      showAlert('Error al cargar los detalles de la compra', { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const confirmarPago = async (compraId) => {
    const confirmado = await showConfirm('¿Estás seguro de confirmar el pago de esta compra?', { 
      type: 'warning',
      title: 'Confirmar Pago'
    });
    if (!confirmado) {
      return;
    }

    try {
      setConfirmando(true);
      const response = await api.put(`/compras/${compraId}/confirmar-pago`);
      if (response.data.success) {
        showAlert('Pago confirmado exitosamente', { type: 'success' });
        cargarCompras();
        if (mostrarDetalle && compraSeleccionada?.id === compraId) {
          // Actualizar compra seleccionada
          const updated = await api.get(`/compras/codigo/${compraSeleccionada.codigo_unico}`);
          if (updated.data.success) {
            setCompraSeleccionada(updated.data.data);
          }
        }
      } else {
        showAlert(response.data.message || 'Error al confirmar el pago', { type: 'error' });
      }
    } catch (error) {
      console.error('Error al confirmar pago:', error);
      showAlert(error.response?.data?.message || 'Error al confirmar el pago', { type: 'error' });
    } finally {
      setConfirmando(false);
    }
  };

  const habilitarAsientos = async (compraId) => {
    const confirmado = await showConfirm('¿Estás seguro de habilitar los asientos? Esto cancelará la compra.', { 
      type: 'warning',
      title: 'Habilitar Asientos'
    });
    if (!confirmado) {
      return;
    }

    try {
      setConfirmando(true);
      const response = await api.put(`/compras/${compraId}/cancelar`);
      if (response.data.success) {
        showAlert('Asientos habilitados exitosamente', { type: 'success' });
        cargarCompras();
        setMostrarDetalle(false);
        setCompraSeleccionada(null);
      } else {
        showAlert(response.data.message || 'Error al habilitar asientos', { type: 'error' });
      }
    } catch (error) {
      console.error('Error al habilitar asientos:', error);
      showAlert(error.response?.data?.message || 'Error al habilitar asientos', { type: 'error' });
    } finally {
      setConfirmando(false);
    }
  };

  const copiarCodigo = (codigo) => {
    navigator.clipboard.writeText(codigo).then(() => {
      showAlert('Código copiado al portapapeles', { type: 'success' });
    }).catch(() => {
      showAlert('Error al copiar el código', { type: 'error' });
    });
  };


  const abrirChatWhatsApp = (telefono) => {
    if (!telefono) {
      showAlert('No hay número de teléfono disponible', { type: 'warning' });
      return;
    }

    // Limpiar el número (remover espacios, guiones, paréntesis, etc.)
    const numeroLimpio = telefono.replace(/[\s\-\(\)]/g, '');
    
    // Si el número no empieza con el código de país, agregar código por defecto (puedes ajustar según tu país)
    // Para Bolivia sería +591, pero mejor dejamos que el usuario use el formato completo
    // Formato: https://wa.me/[código país][número sin el 0 inicial]
    // Ejemplo: +591 70012345 -> https://wa.me/59170012345
    
    const url = `https://wa.me/${numeroLimpio}`;
    window.open(url, '_blank');
  };

  const descargarPDFBoleto = async (compraId) => {
    try {
      const response = await api.get(`/compras/${compraId}/pdf`, {
        responseType: 'blob' // Importante para descargar el archivo
      });

      // Crear un blob del PDF
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      
      // Crear un enlace temporal y hacer clic para descargar
      const link = document.createElement('a');
      link.href = url;
      link.download = `boleto-${compraSeleccionada?.codigo_unico || compraId}.pdf`;
      document.body.appendChild(link);
      link.click();
      
      // Limpiar
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      showAlert('PDF descargado exitosamente', { type: 'success' });
    } catch (error) {
      console.error('Error al descargar PDF:', error);
      const errorMessage = error.response?.data?.message || 'Error al descargar el PDF del boleto';
      showAlert(errorMessage, { type: 'error' });
    }
  };

  const enviarPorEmail = async (compraId, email, nombreCliente) => {
    if (!email) {
      showAlert('No se encontró correo electrónico del cliente', { type: 'warning' });
      return;
    }

    const confirmado = await showConfirm(`¿Enviar el PDF del boleto por correo electrónico a ${email}?`, { 
      type: 'info',
      title: 'Enviar por Email'
    });
    if (!confirmado) {
      return;
    }

    try {
      setReenviando(true);
      const response = await api.post(`/compras/${compraId}/enviar-email`);
      
      if (response.data.success) {
        showAlert(`Boleto enviado exitosamente por correo a ${response.data.email}`, { type: 'success' });
      } else {
        showAlert(response.data.message || 'Error al enviar el boleto por correo', { type: 'error' });
      }
    } catch (error) {
      console.error('Error al enviar boleto por email:', error);
      const errorMessage = error.response?.data?.message || 'Error al enviar el boleto por correo electrónico';
      showAlert(errorMessage, { type: 'error' });
    } finally {
      setReenviando(false);
    }
  };

  const enviarPorMiWhatsApp = async (compraId, telefono, nombreCliente) => {
    if (!telefono) {
      showAlert('No se encontró número de teléfono del cliente', { type: 'warning' });
      return;
    }

    const confirmado = await showConfirm(`¿Enviar el PDF del boleto por WhatsApp Web al número ${telefono}?`, { 
      type: 'info',
      title: 'Enviar por WhatsApp'
    });
    if (!confirmado) {
      return;
    }

    try {
      setReenviando(true);
      
      // Enviar PDF directamente por WhatsApp Web
      const response = await api.post(`/compras/${compraId}/enviar-whatsapp-web`);
      
      if (response.data.success) {
        showAlert(`PDF enviado exitosamente por WhatsApp Web a ${response.data.telefono}`, { type: 'success' });
      } else {
        // Si WhatsApp Web no está listo, mostrar el código QR o instrucciones
        if (response.data.qrCode) {
          showAlert(
            'WhatsApp Web no está conectado.\n\n' +
            'Por favor, escanea el código QR que aparece en la consola del servidor.\n\n' +
            'Luego intenta enviar el PDF nuevamente.',
            { type: 'warning', title: 'WhatsApp Web no conectado' }
          );
        } else {
          showAlert(response.data.message || 'Error al enviar el PDF por WhatsApp Web', { type: 'error' });
        }
      }
    } catch (error) {
      console.error('Error al enviar PDF por WhatsApp Web:', error);
      const errorMessage = error.response?.data?.message || 'Error al enviar el PDF por WhatsApp Web';
      
      if (error.response?.data?.qrCode) {
        showAlert(
          'WhatsApp Web no está conectado.\n\n' +
          'Por favor, escanea el código QR que aparece en la consola del servidor.\n\n' +
          'Luego intenta enviar el PDF nuevamente.',
          { type: 'warning', title: 'WhatsApp Web no conectado' }
        );
      } else {
        showAlert(errorMessage, { type: 'error' });
      }
    } finally {
      setReenviando(false);
    }
  };

  const eliminarCompra = async (compraId) => {
    const confirmado1 = await showConfirm(
      '¿Estás seguro de ELIMINAR COMPLETAMENTE esta compra y todas sus entradas?\n\n' +
      'Esto eliminará:\n' +
      '- La compra de la base de datos\n' +
      '- Todos los registros de compras_asientos\n' +
      '- Todos los registros de compras_mesas\n' +
      '- Liberará todos los asientos ocupados\n\n' +
      'Esta acción NO se puede deshacer.',
      { 
        type: 'warning',
        title: '⚠️ Confirmar Eliminación',
        confirmText: 'Sí, eliminar'
      }
    );
    if (!confirmado1) {
      return;
    }

    // Confirmación adicional
    const confirmado2 = await showConfirm(
      'ÚLTIMA CONFIRMACIÓN:\n\n' +
      '¿Realmente deseas eliminar esta compra y todas sus relaciones permanentemente?',
      { 
        type: 'error',
        title: '⚠️ Última Confirmación',
        confirmText: 'Sí, eliminar definitivamente'
      }
    );
    if (!confirmado2) {
      return;
    }

    try {
      setEliminando(true);
      const response = await api.delete(`/compras/${compraId}`);
      if (response.data.success) {
        showAlert('Compra y todas sus entradas eliminadas exitosamente. Los asientos han sido liberados.', { type: 'success' });
        cargarCompras();
        setMostrarDetalle(false);
        setCompraSeleccionada(null);
      } else {
        showAlert(response.data.message || 'Error al eliminar la compra', { type: 'error' });
      }
    } catch (error) {
      console.error('Error al eliminar compra:', error);
      showAlert(error.response?.data?.message || 'Error al eliminar la compra', { type: 'error' });
    } finally {
      setEliminando(false);
    }
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return '-';
    const date = new Date(fecha);
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getEstadoBadge = (estado) => {
    const estados = {
      'PAGO_PENDIENTE': { label: 'Pago Pendiente', class: 'badge-pendiente' },
      'PAGO_REALIZADO': { label: 'Pago Realizado', class: 'badge-realizado' },
      'CANCELADO': { label: 'Cancelado', class: 'badge-cancelado' },
      'ENTRADA_USADA': { label: 'Entrada Usada', class: 'badge-usada' }
    };
    const estadoInfo = estados[estado] || { label: estado, class: 'badge-default' };
    return <span className={`badge ${estadoInfo.class}`}>{estadoInfo.label}</span>;
  };

  return (
    <div className="admin-page compras-page">
      <div className="admin-content">
        <div className="compras-header">
          <div>
            <h1>Gestión de Compras</h1>
            <p>Verifica y confirma los pagos de los clientes</p>
          </div>
        </div>

        {/* Búsqueda por código único */}
        <div className="busqueda-codigo">
          <div className="busqueda-input-group">
            <input
              type="text"
              placeholder="Buscar por código único (ej: ENT-1765215246044-1234)"
              value={codigoBusqueda}
              onChange={(e) => setCodigoBusqueda(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && buscarPorCodigo()}
              className="input-busqueda"
            />
            <button onClick={buscarPorCodigo} className="btn-buscar">
              🔍 Buscar
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="filtros-compras">
          <label>Filtrar por estado:</label>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="select-filtro"
          >
            <option value="">Todos</option>
            <option value="PAGO_PENDIENTE">Pago Pendiente</option>
            <option value="PAGO_REALIZADO">Pago Realizado</option>
            <option value="CANCELADO">Cancelado</option>
            <option value="ENTRADA_USADA">Entrada Usada</option>
          </select>
        </div>

        {error && <div className="error-message">{error}</div>}

        {loading ? (
          <div className="loading">Cargando compras...</div>
        ) : mostrarDetalle && compraSeleccionada ? (
          <div className="detalle-compra">
            <div className="detalle-header">
              <h2>Detalle de Compra</h2>
              <button onClick={() => { setMostrarDetalle(false); setCompraSeleccionada(null); }} className="btn-cerrar">
                ✕ Cerrar
              </button>
            </div>

            <div className="detalle-content">
              <div className="detalle-section">
                <h3>Información General</h3>
                <div className="info-grid">
                  <div>
                    <strong>Código Único:</strong>
                    <div className="codigo-display">
                      <span>{compraSeleccionada.codigo_unico}</span>
                      <button onClick={() => copiarCodigo(compraSeleccionada.codigo_unico)} className="btn-copiar">
                        📋 Copiar
                      </button>
                    </div>
                  </div>
                  <div><strong>Estado:</strong> {getEstadoBadge(compraSeleccionada.estado)}</div>
                  <div><strong>Evento:</strong> {compraSeleccionada.evento_titulo}</div>
                  <div><strong>Fecha del Evento:</strong> {formatearFecha(compraSeleccionada.evento_fecha)}</div>
                  <div><strong>Cantidad:</strong> {compraSeleccionada.cantidad} entrada(s)</div>
                  <div><strong>Total:</strong> ${parseFloat(compraSeleccionada.total).toFixed(2)} BOB</div>
                  <div><strong>Fecha de Compra:</strong> {formatearFecha(compraSeleccionada.fecha_compra)}</div>
                </div>
              </div>

              <div className="detalle-section">
                <h3>Datos del Cliente</h3>
                <div className="info-grid">
                  <div><strong>Nombre:</strong> {compraSeleccionada.cliente_nombre}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <strong>Email:</strong> 
                    <span>{compraSeleccionada.cliente_email || 'N/A'}</span>
                    {compraSeleccionada.cliente_email && (
                      <button
                        onClick={() => enviarPorEmail(
                          compraSeleccionada.id,
                          compraSeleccionada.cliente_email,
                          compraSeleccionada.cliente_nombre
                        )}
                        disabled={reenviando || eliminando}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#dc2626',
                          color: 'white',
                          border: 'none',
                          borderRadius: '5px',
                          cursor: reenviando ? 'not-allowed' : 'pointer',
                          fontSize: '13px',
                          fontWeight: 'bold',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          opacity: reenviando ? 0.6 : 1
                        }}
                        title="Enviar boleto por correo electrónico"
                      >
                        📧 {reenviando ? 'Enviando...' : 'ENVIAR POR EMAIL'}
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <strong>Teléfono:</strong> 
                    <span>{compraSeleccionada.cliente_telefono || 'N/A'}</span>
                    {compraSeleccionada.cliente_telefono && (
                      <button
                        onClick={() => abrirChatWhatsApp(compraSeleccionada.cliente_telefono)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#25D366',
                          color: 'white',
                          border: 'none',
                          borderRadius: '5px',
                          cursor: 'pointer',
                          fontSize: '13px',
                          fontWeight: 'bold',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px'
                        }}
                        title="Abrir chat de WhatsApp con este número"
                      >
                        💬 ABRIR CHAT
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {compraSeleccionada.asientos && compraSeleccionada.asientos.length > 0 && (
                <div className="detalle-section">
                  <h3>Asientos Individuales ({compraSeleccionada.asientos.length})</h3>
                  <div className="asientos-list">
                    {compraSeleccionada.asientos.map((asiento) => (
                      <div key={asiento.id} className="asiento-item">
                        <span><strong>Asiento:</strong> {asiento.numero_asiento}</span>
                        {asiento.numero_mesa && (
                          <span><strong>Mesa:</strong> M{asiento.numero_mesa}</span>
                        )}
                        {asiento.tipo_precio_nombre && (
                          <span><strong>Tipo:</strong> {asiento.tipo_precio_nombre}</span>
                        )}
                        {asiento.area_nombre && <span><strong>Área:</strong> {asiento.area_nombre}</span>}
                        <span><strong>Precio:</strong> ${parseFloat(asiento.precio).toFixed(2)}</span>
                        <span className={`badge badge-${asiento.estado.toLowerCase()}`}>{asiento.estado}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {compraSeleccionada.mesas && compraSeleccionada.mesas.length > 0 && (
                <div className="detalle-section">
                  <h3>Mesas Completas ({compraSeleccionada.mesas.length})</h3>
                  <div className="mesas-list">
                    {compraSeleccionada.mesas.map((mesa) => (
                      <div key={mesa.id} className="mesa-item">
                        <span><strong>Mesa:</strong> M{mesa.numero_mesa}</span>
                        <span><strong>Cantidad de Sillas:</strong> {mesa.cantidad_sillas}</span>
                        <span><strong>Precio Total:</strong> ${parseFloat(mesa.precio_total).toFixed(2)}</span>
                        <span className={`badge badge-${mesa.estado.toLowerCase()}`}>{mesa.estado}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="detalle-actions">
                {compraSeleccionada.estado === 'PAGO_PENDIENTE' && (
                  <>
                    <button
                      onClick={() => confirmarPago(compraSeleccionada.id)}
                      className="btn-confirmar"
                      disabled={confirmando || eliminando}
                    >
                      {confirmando ? 'Confirmando...' : '✅ Confirmar Pago'}
                    </button>
                    <button
                      onClick={() => habilitarAsientos(compraSeleccionada.id)}
                      className="btn-cancelar"
                      disabled={confirmando || eliminando}
                    >
                      🔄 Habilitar Asientos
                    </button>
                  </>
                )}
                {compraSeleccionada.estado === 'PAGO_REALIZADO' && (
                  <>
                    <button
                      onClick={() => descargarPDFBoleto(compraSeleccionada.id)}
                      className="btn-descargar-pdf"
                      style={{
                        padding: '10px 20px',
                        backgroundColor: '#dc2626',
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '10px'
                      }}
                      title="Descargar PDF del boleto"
                    >
                      📄 GENERAR BOLETOS PDF
                    </button>
                    <button
                      onClick={() => enviarPorMiWhatsApp(
                        compraSeleccionada.id, 
                        compraSeleccionada.cliente_telefono,
                        compraSeleccionada.cliente_nombre
                      )}
                      className="btn-whatsapp-web"
                      disabled={reenviando || eliminando || !compraSeleccionada.cliente_telefono}
                    >
                      💬 Enviar por mi WhatsApp
                    </button>
                  </>
                )}
                <button
                  onClick={() => eliminarCompra(compraSeleccionada.id)}
                  className="btn-eliminar"
                  disabled={eliminando || confirmando || reenviando}
                  style={{ marginTop: '10px' }}
                >
                  {eliminando ? 'Eliminando...' : '🗑️ Eliminar Entradas y Todas las Relaciones'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="compras-list">
            {compras.length === 0 ? (
              <div className="no-compras">
                <p>No hay compras registradas</p>
              </div>
            ) : (
              <table className="compras-table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Cliente</th>
                    <th>Evento</th>
                    <th>Cantidad</th>
                    <th>Total</th>
                    <th>Estado</th>
                    <th>Fecha</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {compras.map((compra) => (
                    <tr key={compra.id}>
                      <td>
                        <div className="codigo-cell">
                          <span className="codigo-text">{compra.codigo_unico}</span>
                          <button
                            onClick={() => copiarCodigo(compra.codigo_unico)}
                            className="btn-copiar-small"
                            title="Copiar código"
                          >
                            📋
                          </button>
                        </div>
                      </td>
                      <td>{compra.cliente_nombre}</td>
                      <td>{compra.evento_titulo}</td>
                      <td>{compra.cantidad}</td>
                      <td>${parseFloat(compra.total).toFixed(2)}</td>
                      <td>{getEstadoBadge(compra.estado)}</td>
                      <td>{formatearFecha(compra.fecha_compra)}</td>
                      <td>
                        <button onClick={() => verDetalle(compra)} className="btn-ver">
                          Ver Detalle
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Compras;

