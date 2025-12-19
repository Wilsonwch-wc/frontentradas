import { useEffect, useState } from 'react';
import Carrusel from '../components/Carrusel';
import EventoCard from '../components/EventoCard';
import api from '../api/axios';
import { getApiBase, getServerBase } from '../api/base';
import './Home.css';

const serverBase = getServerBase();
const apiBase = getApiBase();

const Home = () => {
  const [todosEventos, setTodosEventos] = useState([]);
  const [eventosNuevos, setEventosNuevos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 9;

  useEffect(() => {
    cargarEventos();
  }, []);

  const cargarEventos = async () => {
    try {
      setLoading(true);
      // Usar la ruta pública sin autenticación
      const response = await fetch(`${apiBase}/eventos-public`);
      const data = await response.json();
      
      if (data.success) {
        const eventos = data.data;
        // Separar eventos nuevos (es_nuevo = 1) para el carrusel
        const nuevos = eventos.filter(e => e.es_nuevo === 1);
        // TODOS los eventos para la lista (incluyendo los del carrusel)
        setEventosNuevos(nuevos);
        setTodosEventos(eventos); // Mostrar todos los eventos, no solo los que no son nuevos
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

  // Formatear eventos para EventoCard
  const eventosFormateados = todosEventos.map(evento => ({
    ...evento,
    imagen: formatearImagen(evento.imagen),
    precio: parseFloat(evento.precio)
  }));

  const eventosNuevosFormateados = eventosNuevos.map(evento => ({
    ...evento,
    imagen: formatearImagen(evento.imagen),
    precio: parseFloat(evento.precio)
  }));

  const totalPages = Math.max(1, Math.ceil(eventosFormateados.length / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const visibleEventos = eventosFormateados.slice(startIndex, startIndex + pageSize);

  const prevPage = () => setCurrentPage(p => Math.max(1, p - 1));
  const nextPage = () => setCurrentPage(p => Math.min(totalPages, p + 1));
  const goToPage = (p) => setCurrentPage(Math.min(totalPages, Math.max(1, p)));

  return (
    <div className="home">
      <section className="carrusel-section">
        <Carrusel eventos={eventosNuevosFormateados} />
      </section>

      <section className="eventos-section">
        <div className="container">
          <h2 className="section-title">Todos los Eventos</h2>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem' }}>Cargando eventos...</div>
          ) : visibleEventos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem' }}>No hay eventos disponibles</div>
          ) : (
            <>
              <div className="eventos-grid">
                {visibleEventos.map(evento => (
                  <EventoCard key={evento.id} evento={evento} />
                ))}
              </div>
              {totalPages > 1 && (
                <div className="paginacion">
                  <button className="pag-btn" onClick={prevPage} disabled={currentPage === 1}>Anterior</button>
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
                  <button className="pag-btn" onClick={nextPage} disabled={currentPage === totalPages}>Siguiente</button>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
};

export default Home;

