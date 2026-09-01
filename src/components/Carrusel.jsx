import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getServerBase } from '../api/base';
import { generarSlug } from '../utils/slug';
import './Carrusel.css';

const serverBase = getServerBase();

const Carrusel = ({ eventos = [] }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (eventos.length > 0) {
      const timer = setInterval(() => {
        setCurrentIndex((prevIndex) => 
          prevIndex === eventos.length - 1 ? 0 : prevIndex + 1
        );
      }, 6000);

      return () => clearInterval(timer);
    }
  }, [eventos.length]);

  const nextSlide = () => {
    setCurrentIndex((prevIndex) => 
      prevIndex === eventos.length - 1 ? 0 : prevIndex + 1
    );
  };

  const prevSlide = () => {
    setCurrentIndex((prevIndex) => 
      prevIndex === 0 ? eventos.length - 1 : prevIndex - 1
    );
  };

  const goToSlide = (index) => {
    setCurrentIndex(index);
  };

  if (eventos.length === 0) {
    return null;
  }

  const formatearImagen = (imagen) => {
    if (!imagen) {
      return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwMCIgaGVpZ2h0PSI2MDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2RkZCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjQiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5ObyBoYXkgaW1hZ2VuPC90ZXh0Pjwvc3ZnPg==';
    }
    if (imagen.startsWith('http')) return imagen;
    return `${serverBase}${imagen}`;
  };

  const formatearFecha = (fechaString) => {
    if (!fechaString) return null;
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

  const currentEvento = eventos[currentIndex];
  const imgUrl = formatearImagen(currentEvento?.imagen);

  return (
    <div className="carrusel-container">
      <div className="carrusel">
        <button className="carrusel-btn prev" onClick={prevSlide} aria-label="Anterior">
          ‹
        </button>
        
        <div 
          className="carrusel-slide"
          onClick={() => {
            const slug = generarSlug(currentEvento.titulo);
            navigate(`/evento/${slug}`);
          }}
          style={{ cursor: 'pointer' }}
        >
          {/* Fondo difuminado para atmósfera inmersiva */}
          <div 
            className="carrusel-backdrop"
            style={{ backgroundImage: `url(${imgUrl})` }}
          />
          <div className="carrusel-overlay" />

          {/* Contenedor central con afiche completo sin cortes */}
          <div className="carrusel-showcase">
            <div className="carrusel-poster-wrapper">
              <div className="carrusel-badge">✨ NUEVO</div>
              <img 
                src={imgUrl} 
                alt={currentEvento.titulo}
                className="carrusel-poster-img"
                onError={(e) => {
                  e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjYwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMWUxZTFlIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNiIgZmlsbD0iI2FhYSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPlNpbiBJbWFnZW48L3RleHQ+PC9zdmc+';
                }}
              />
            </div>

            <div className="carrusel-info">
              <h2 className="carrusel-title">{currentEvento.titulo}</h2>
              {currentEvento.hora_inicio && (
                <div className="carrusel-fecha">
                  📅 {formatearFecha(currentEvento.hora_inicio)}
                </div>
              )}
              {currentEvento.precio != null && (
                <div className="carrusel-precio">
                  <span>Desde</span> <strong>Bs. {parseFloat(currentEvento.precio).toFixed(2)}</strong>
                </div>
              )}
              <button className="carrusel-btn-ver">
                🎟️ Comprar Entradas
              </button>
            </div>
          </div>
        </div>

        <button className="carrusel-btn next" onClick={nextSlide} aria-label="Siguiente">
          ›
        </button>
      </div>

      <div className="carrusel-indicators">
        {eventos.map((_, index) => (
          <button
            key={index}
            className={`indicator ${index === currentIndex ? 'active' : ''}`}
            onClick={() => goToSlide(index)}
            aria-label={`Slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
};

export default Carrusel;

