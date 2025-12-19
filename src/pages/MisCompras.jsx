import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import './MisCompras.css';

const MisCompras = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [compras, setCompras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }

    // Si el usuario tiene rol, es admin, no cliente
    if (user?.rol) {
      navigate('/');
      return;
    }

    cargarCompras();
  }, [user, isAuthenticated, navigate]);

  const cargarCompras = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get('/compras/mis-compras');
      
      if (response.data.success) {
        setCompras(response.data.data);
      } else {
        setError('Error al cargar las compras');
      }
    } catch (err) {
      console.error('Error al cargar compras:', err);
      setError(err.response?.data?.message || 'Error al cargar las compras');
    } finally {
      setLoading(false);
    }
  };

  const getEstadoTexto = (estado) => {
    const estados = {
      'PAGO_PENDIENTE': { texto: 'En Revisión', clase: 'estado-revision' },
      'PAGO_REALIZADO': { texto: 'Verificado', clase: 'estado-verificado' },
      'CANCELADO': { texto: 'Cancelado', clase: 'estado-cancelado' },
      'ENTRADA_USADA': { texto: 'Entrada Usada', clase: 'estado-usado' }
    };
    return estados[estado] || { texto: estado, clase: 'estado-default' };
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return 'Fecha no disponible';
    const date = new Date(fecha);
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatearFechaEvento = (fecha) => {
    if (!fecha) return 'Fecha no disponible';
    const date = new Date(fecha);
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="mis-compras">
        <div className="container">
          <h1 className="mis-compras-title">Mis Compras</h1>
          <div className="loading">Cargando...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="mis-compras">
      <div className="container">
        <h1 className="mis-compras-title">Mis Compras</h1>
        
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {compras.length === 0 ? (
          <div className="no-compras">
            <p>No tienes compras registradas aún.</p>
            <button onClick={() => navigate('/eventos')} className="btn-ver-eventos">
              Ver Eventos Disponibles
            </button>
          </div>
        ) : (
          <div className="compras-list">
            {compras.map((compra) => {
              const estadoInfo = getEstadoTexto(compra.estado);
              return (
                <div key={compra.id} className="compra-card">
                  <div className="compra-header">
                    <div className="compra-info-principal">
                      <h2 className="compra-evento">{compra.evento_titulo}</h2>
                      <p className="compra-fecha-evento">
                        📅 {formatearFechaEvento(compra.evento_fecha)}
                      </p>
                    </div>
                    <div className={`estado-badge ${estadoInfo.clase}`}>
                      {estadoInfo.texto}
                    </div>
                  </div>

                  <div className="compra-detalles">
                    <div className="detalle-item">
                      <span className="detalle-label">Código de Compra:</span>
                      <span className="detalle-value codigo-compra">{compra.codigo_unico}</span>
                    </div>
                    
                    <div className="detalle-item">
                      <span className="detalle-label">Fecha de Compra:</span>
                      <span className="detalle-value">{formatearFecha(compra.fecha_compra)}</span>
                    </div>

                    <div className="detalle-item">
                      <span className="detalle-label">Cantidad:</span>
                      <span className="detalle-value">{compra.cantidad} entrada(s)</span>
                    </div>

                    <div className="detalle-item">
                      <span className="detalle-label">Total:</span>
                      <span className="detalle-value total-precio">${parseFloat(compra.total).toFixed(2)} BOB</span>
                    </div>

                    {(compra.asientos && compra.asientos.length > 0) && (
                      <div className="detalle-item">
                        <span className="detalle-label">Asientos:</span>
                        <span className="detalle-value">
                          {compra.asientos.map((a, idx) => (
                            <span key={idx} className="asiento-badge">
                              {a.numero_asiento}
                              {a.numero_mesa && ` (Mesa ${a.numero_mesa})`}
                            </span>
                          ))}
                        </span>
                      </div>
                    )}

                    {(compra.mesas && compra.mesas.length > 0) && (
                      <div className="detalle-item">
                        <span className="detalle-label">Mesas:</span>
                        <span className="detalle-value">
                          {compra.mesas.map((m, idx) => (
                            <span key={idx} className="mesa-badge">
                              Mesa {m.numero_mesa} ({m.cantidad_sillas} sillas)
                            </span>
                          ))}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MisCompras;

