import { useNavigate } from 'react-router-dom';
import { getServerBase } from '../api/base';
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
    if (!imagen) return 'https://via.placeholder.com/400x300?text=Sin+Imagen';
    if (imagen.startsWith('http')) return imagen;
    return `${serverBase}${imagen}`;
  };

  return (
    <div 
      className="evento-card"
      onClick={() => navigate(`/evento/${evento.id}`)}
    >
      <div className="evento-card-image-container">
        <img 
          src={formatearImagen(evento.imagen)} 
          alt={evento.titulo}
          className="evento-card-image"
          onError={(e) => {
            e.target.src = 'https://via.placeholder.com/400x300?text=Sin+Imagen';
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

