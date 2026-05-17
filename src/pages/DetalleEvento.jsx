import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getApiBase, getServerBase } from '../api/base';
import './DetalleEvento.css';

const serverBase = getServerBase();
const apiBase = getApiBase();

const DetalleEvento = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin, canUseAdminSaleOptions } = useAuth();
  const [evento, setEvento] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargarEvento();
  }, [slug]);

  const cargarEvento = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${apiBase}/eventos-public/${slug}`);
      const data = await response.json();
      
      if (data.success) {
        const eventoData = data.data;
        // Formatear imagen
        if (eventoData.imagen && !eventoData.imagen.startsWith('http')) {
          eventoData.imagen = `${serverBase}${eventoData.imagen}`;
        }
        // Formatear precio
        eventoData.precio = parseFloat(eventoData.precio);
        // Formatear tipos de precio si existen
        if (eventoData.tipos_precio && Array.isArray(eventoData.tipos_precio)) {
          eventoData.tipos_precio = eventoData.tipos_precio.map(tp => ({
            ...tp,
            precio: parseFloat(tp.precio)
          }));
        }
        setEvento(eventoData);
      } else {
        setEvento(null);
      }
    } catch (error) {
      console.error('Error al cargar evento:', error);
      setEvento(null);
    } finally {
      setLoading(false);
    }
  };

  const handleComprar = () => {
    if (!evento) return;
    // No permitir comprar si el evento está en estado "proximamente", excepto para admin/vendedor
    if (evento.estado === 'proximamente' && !isAdmin() && !canUseAdminSaleOptions()) {
      return;
    }
    if (isAuthenticated()) {
      navigate(`/compra/${evento.id}`);
    } else {
      navigate('/login', { state: { from: `/compra/${evento.id}` } });
    }
  };

  const esProximamente = evento?.estado === 'proximamente' && !isAdmin() && !canUseAdminSaleOptions();

  if (loading) {
    return (
      <div className="detalle-evento">
        <div className="container">
          <div style={{ textAlign: 'center', padding: '3rem' }}>Cargando evento...</div>
        </div>
      </div>
    );
  }

  if (!evento) {
    return (
      <div className="detalle-evento">
        <div className="container">
          <div className="error-message">
            <h2>Evento no encontrado</h2>
            <button onClick={() => navigate('/')} className="btn-volver">
              Volver al Inicio
            </button>
          </div>
        </div>
      </div>
    );
  }

  const formatearFecha = (fechaString) => {
    const fecha = new Date(fechaString);
    return {
      fecha: fecha.toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      hora: fecha.toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit'
      })
    };
  };

  const { fecha, hora } = formatearFecha(evento.hora_inicio);

  return (
    <div className="detalle-evento">
      <div className="container">
        <button onClick={() => navigate(-1)} className="btn-volver">
          ← Volver
        </button>

        <div className="detalle-content">
          <div className="detalle-col-izq">
            <div className="detalle-imagen-container">
              <img 
                src={evento.imagen || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIyMCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIGhheSBpbWFnZW48L3RleHQ+PC9zdmc+'} 
                alt={evento.titulo}
                className="detalle-imagen"
                onError={(e) => {
                  e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIyMCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIGhheSBpbWFnZW48L3RleHQ+PC9zdmc+';
                }}
              />
              {evento.es_nuevo === 1 && (
                <div className="detalle-badge">NUEVO</div>
              )}
            </div>

            <div className="detalle-descripcion">
              <h3>Descripción</h3>
              <p>{evento.descripcion}</p>
            </div>
          </div>

          <div className="detalle-info">
            <h1 className="detalle-titulo">{evento.titulo}</h1>
            
            {/* Mostrar precios según el tipo de evento, solo si no es "proximamente" */}
            {esProximamente ? (
              <div className="detalle-proximamente">
                <span className="proximamente-badge">PROXIMAMENTE</span>
                <p className="proximamente-mensaje">Los precios estarán disponibles próximamente</p>
              </div>
            ) : evento.tipo_evento === 'especial' && evento.tipos_precio && evento.tipos_precio.length > 0 ? (
              <div className="detalle-precios">
                <h3 className="precios-titulo">Precios Disponibles</h3>
                <div className="precios-lista">
                  {evento.tipos_precio.map((tipoPrecio, index) => (
                    <div key={tipoPrecio.id || index} className="precio-item">
                      <div className="precio-item-header">
                        <span 
                          className="precio-color-indicator"
                          style={{ backgroundColor: tipoPrecio.color || '#CCCCCC' }}
                        ></span>
                        <span className="precio-nombre">{tipoPrecio.nombre}</span>
                      </div>
                      <div className="precio-item-body">
                        <span className="precio-valor">${tipoPrecio.precio.toFixed(2)}</span>
                        {tipoPrecio.descripcion && (
                          <p className="precio-descripcion">{tipoPrecio.descripcion}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="precio-minimo">
                  <span className="precio-label">Desde:</span>
                  <span className="precio-valor-minimo">${evento.precio.toFixed(2)}</span>
                </div>
              </div>
            ) : (
              <div className="detalle-precio">
                <span className="precio-label">Precio:</span>
                <span className="precio-valor">${evento.precio.toFixed(2)}</span>
              </div>
            )}

            <div className="detalle-fecha-hora">
              <div className="fecha-item">
                <span className="fecha-icon">📅</span>
                <div>
                  <p className="fecha-label">Fecha</p>
                  <p className="fecha-valor">{fecha}</p>
                </div>
              </div>
              <div className="fecha-item">
                <span className="fecha-icon">🕐</span>
                <div>
                  <p className="fecha-label">Hora</p>
                  <p className="fecha-valor">{hora}</p>
                </div>
              </div>
              {(evento.ubicacion || evento.ciudad) && (
                <div className="fecha-item detalle-ubicacion">
                  <span className="fecha-icon">📍</span>
                  <div>
                    <p className="fecha-label">Ubicación</p>
                    <p className="fecha-valor">
                      {[evento.ubicacion, evento.ciudad].filter(Boolean).join(', ')}
                    </p>
                    {evento.ubicacion_url && (
                      <a
                        href={evento.ubicacion_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="detalle-ubicacion-link"
                      >
                        Ver en mapa →
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
            <button 
              onClick={handleComprar} 
              className={`btn-comprar ${esProximamente ? 'btn-comprar-disabled' : ''}`}
              disabled={esProximamente}
            >
              {esProximamente ? 'Próximamente Disponible' : 'Comprar Entradas'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DetalleEvento;

