import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getServerBase } from '../api/base';
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
    if (!imagen) return 'https://via.placeholder.com/1200x600?text=Sin+Imagen';
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
          onClick={() => navigate(`/evento/${currentEvento.id}`)}
          style={{ cursor: 'pointer' }}
        >
          <div className="carrusel-badge">NUEVO</div>
          <img 
            src={formatearImagen(currentEvento.imagen)} 
            alt={currentEvento.titulo}
            className="carrusel-image"
            onError={(e) => {
              e.target.src = 'https://via.placeholder.com/1200x600?text=Sin+Imagen';
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

