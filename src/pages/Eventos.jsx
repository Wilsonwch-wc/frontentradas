import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import EventoCard from '../components/EventoCard';
import { getApiBase, getServerBase } from '../api/base';
import './Eventos.css';

const serverBase = getServerBase();
const apiBase = getApiBase();

const Eventos = () => {
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 9;

  useEffect(() => {
    cargarEventos();
  }, []);

  const cargarEventos = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${apiBase}/eventos-public`);
      const data = await response.json();
      
      if (data.success) {
        const eventosData = data.data.map(evento => ({
          ...evento,
          imagen: formatearImagen(evento.imagen),
          precio: parseFloat(evento.precio)
        }));
        setEventos(eventosData);
      }
    } catch (error) {
      console.error('Error al cargar eventos:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatearImagen = (imagen) => {
    if (!imagen) return null;
    if (imagen.startsWith('http')) return imagen;
    return `${serverBase}${imagen}`;
  };

  const totalPages = Math.max(1, Math.ceil(eventos.length / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const visibleEventos = eventos.slice(startIndex, startIndex + pageSize);

  const prevPage = () => setCurrentPage(p => Math.max(1, p - 1));
  const nextPage = () => setCurrentPage(p => Math.min(totalPages, p + 1));
  const goToPage = (p) => setCurrentPage(Math.min(totalPages, Math.max(1, p)));

  return (
    <div className="eventos-page">
      <div className="container">
        <div className="eventos-header">
          <h1>Eventos Disponibles</h1>
          <p>Descubre todos nuestros eventos y encuentra el que más te guste</p>
        </div>

        {loading ? (
          <div className="loading">Cargando eventos...</div>
        ) : eventos.length === 0 ? (
          <div className="no-events">
            <p>No hay eventos disponibles en este momento</p>
          </div>
        ) : (
          <>
            <div className="eventos-grid">
              {visibleEventos.map(evento => (
                <EventoCard key={evento.id} evento={evento} />
              ))}
            </div>
            
            {totalPages > 1 && (
              <div className="paginacion">
                <button 
                  className="pag-btn" 
                  onClick={prevPage} 
                  disabled={currentPage === 1}
                >
                  Anterior
                </button>
                <div className="pag-pages">
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <button
                      key={i}
                      className={`pag-page ${currentPage === i + 1 ? 'active' : ''}`}
                      onClick={() => goToPage(i + 1)}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
                <button 
                  className="pag-btn" 
                  onClick={nextPage} 
                  disabled={currentPage === totalPages}
                >
                  Siguiente
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Eventos;

