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
      }, 5000); // Cambiar cada 5 segundos

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
      // SVG placeholder como data URI
      return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwMCIgaGVpZ2h0PSI2MDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2RkZCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjQiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5ObyBoYXkgaW1hZ2VuPC90ZXh0Pjwvc3ZnPg==';
    }
    if (imagen.startsWith('http')) return imagen;
    return `${serverBase}${imagen}`;
  };

  const currentEvento = eventos[currentIndex];

  return (
    <div className="carrusel-container">
      <div className="carrusel">
        <button className="carrusel-btn prev" onClick={prevSlide}>
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
          <div className="carrusel-badge">NUEVO</div>
          <img 
            src={formatearImagen(currentEvento.imagen)} 
            alt={currentEvento.titulo}
            className="carrusel-image"
            onError={(e) => {
              e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwMCIgaGVpZ2h0PSI2MDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2RkZCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjQiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5ObyBoYXkgaW1hZ2VuPC90ZXh0Pjwvc3ZnPg==';
            }}
          />
          <div className="carrusel-content">
            <h2 className="carrusel-title">{currentEvento.titulo}</h2>
            <p className="carrusel-precio">${currentEvento.precio.toFixed(2)}</p>
            <button className="carrusel-btn-ver">Ver Detalles</button>
          </div>
        </div>

        <button className="carrusel-btn next" onClick={nextSlide}>
          ›
        </button>
      </div>

      <div className="carrusel-indicators">
        {eventos.map((_, index) => (
          <button
            key={index}
            className={`indicator ${index === currentIndex ? 'active' : ''}`}
            onClick={() => goToSlide(index)}
          />
        ))}
      </div>
    </div>
  );
};

export default Carrusel;

