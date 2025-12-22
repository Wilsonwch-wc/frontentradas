import { useNavigate } from 'react-router-dom';
import { getServerBase } from '../api/base';
import { generarSlug } from '../utils/slug';
import './EventoCard.css';

const serverBase = getServerBase();

const EventoCard = ({ evento }) => {
  const navigate = useNavigate();

  const formatearFecha = (fechaString) => {
    if (!fechaString) return '-';
    const fecha = new Date(fechaString);
    return fecha.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatearImagen = (imagen) => {
    if (!imagen) {
      // SVG placeholder como data URI
      return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxOCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIGhheSBpbWFnZW48L3RleHQ+PC9zdmc+';
    }
    if (imagen.startsWith('http')) return imagen;
    return `${serverBase}${imagen}`;
  };

  const getEventoUrl = () => {
    // Generar slug desde el título
    const slug = generarSlug(evento.titulo);
    return `/evento/${slug}`;
  };

  return (
    <div 
      className="evento-card"
      onClick={() => navigate(getEventoUrl())}
    >
      <div className="evento-card-image-container">
        <img 
          src={formatearImagen(evento.imagen)} 
          alt={evento.titulo}
          className="evento-card-image"
          onError={(e) => {
            e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxOCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIGhheSBpbWFnZW48L3RleHQ+PC9zdmc+';
          }}
        />
        {evento.es_nuevo === 1 && (
          <div className="evento-card-badge">NUEVO</div>
        )}
      </div>
      
      <div className="evento-card-content">
        <h3 className="evento-card-title">{evento.titulo}</h3>
        <div className="evento-card-footer">
          <p className="evento-card-fecha">{formatearFecha(evento.hora_inicio)}</p>
          <p className="evento-card-precio">${evento.precio.toFixed(2)}</p>
        </div>
        <button className="evento-card-btn">Ver Detalles</button>
      </div>
    </div>
  );
};

export default EventoCard;

