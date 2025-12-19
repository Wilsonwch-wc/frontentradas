import { useEffect, useState } from 'react';
import api from '../api/axios';
import './Footer.css';
import logoImage from '../images/logo2.png';

const iconos = {
  facebook: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12S0 5.446 0 12.073c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953h-1.436c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  ),
  instagram: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0 3.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zm7.406-2.401a1.44 1.44 0 1 0 0 2.88 1.44 1.44 0 0 0 0-2.88zM12 8.838A3.162 3.162 0 1 1 8.838 12 3.162 3.162 0 0 1 12 8.838z"/>
    </svg>
  ),
  twitter: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.953 4.57a10 10 0 0 1-2.825.775 4.958 4.958 0 0 0 2.163-2.723 9.864 9.864 0 0 1-3.127 1.184 4.92 4.92 0 0 0-8.384 4.482c-4.083-.205-7.71-2.158-10.137-5.126a4.822 4.822 0 0 0-.666 2.475 4.928 4.928 0 0 0 2.188 4.096 4.904 4.904 0 0 1-2.228-.616v.06a4.923 4.923 0 0 0 3.946 4.827 4.996 4.996 0 0 1-2.212.085 4.936 4.936 0 0 0 4.604 3.417A9.867 9.867 0 0 1 0 19.54a13.995 13.995 0 0 0 7.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0 0 24 4.59z"/>
    </svg>
  ),
  youtube: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  ),
  tiktok: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M21 8.5c-1.3-.1-2.5-.6-3.5-1.4-1-1-1.6-2.2-1.7-3.6V3h-3.5v12.2c0 1-.4 1.9-1.1 2.5-.7.6-1.7.9-2.7.7-1.3-.3-2.3-1.4-2.5-2.7-.3-1.9 1.1-3.6 3-3.6.3 0 .6 0 .8.1V8.6c-.3 0-.6-.1-.9-.1-1.5 0-2.9.5-4 1.4-1.2 1-1.9 2.4-2.1 3.9-.2 1.6.2 3.2 1.2 4.5 1 1.3 2.5 2.2 4.1 2.4 1.7.3 3.4-.1 4.8-1.1 1.4-1 2.2-2.6 2.2-4.3V9.8c.9.7 2 1.2 3.2 1.4V8.5z"/>
    </svg>
  ),
  linkedin: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M4.98 3.5C4.98 5 3.9 6 2.5 6S0 5 0 3.5 1.1 1 2.5 1s2.48 1 2.48 2.5zM.2 8.4h4.6V24H.2zM8.8 8.4h4.4v2.1h.1c.6-1.1 2-2.3 4.1-2.3 4.4 0 5.2 2.9 5.2 6.6V24h-4.6v-6.9c0-1.6 0-3.7-2.3-3.7-2.3 0-2.7 1.8-2.7 3.6V24H8.8z"/>
    </svg>
  ),
  website: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm6.7 6H16c-.2-1-.6-2-1-2.9 1.6.5 2.9 1.5 3.7 2.9zM12 4.1c.6 1 1.1 2.3 1.3 3.9H10.7c.2-1.6.7-2.9 1.3-3.9zM4.3 10c.2-1.4.9-2.7 1.9-3.6.3-.3.7-.6 1.2-.8-.5 1-.8 2.1-1 3.4H4.3zm1 4h2.1c.1 1.2.4 2.4.8 3.4-.9-.4-1.6-.9-2.2-1.5-.6-.6-1.1-1.3-1.4-2zM8.4 10h3.2v3H8.2c0-.5-.1-1-.1-1.5 0-.5.1-1 .3-1.5zm6 0h3.2c.2.5.3 1 .3 1.5 0 .5-.1 1-.3 1.5H14.4V10zm-1.6 3h-1.6v-3h1.6v3zm.3 2.9c-.2 1.6-.7 2.9-1.3 3.9-.6-1-1.1-2.3-1.3-3.9h2.6zm1.3 3c.6-1 .9-2.2 1-3.4h2.4c-.3.9-.8 1.7-1.5 2.4-.5.4-1.1.8-1.9 1zM16.6 13c.1-.5.1-1 .1-1.5 0-.5-.1-1-.2-1.5h2.2c.1.5.2 1 .2 1.5s-.1 1-.2 1.5h-2.1zM7.4 8c.2-.9.5-1.9 1-2.8.5.3.9.7 1.2 1.1-.3.6-.6 1.2-.8 1.9H7.4zm0 8h1.4c.2.7.5 1.3.8 1.9-.4.4-.8.8-1.2 1.1-.5-.9-.8-1.9-1-3zM6.2 6.1c-.7.6-1.3 1.4-1.7 2.2-.3.5-.5 1.1-.7 1.7H3a8 8 0 0 1 3.2-3.9zM3 14h.8c.2.6.4 1.2.7 1.7.4.8 1 1.5 1.7 2.2A8 8 0 0 1 3 14zm10.4-9c.5.9.8 1.9 1 2.8h-1.4c-.2-.7-.5-1.3-.8-1.9.3-.4.7-.8 1.2-1.1zM12 20a8 8 0 0 1-5-1.8c.4-.3.8-.7 1.2-1.1.6.4 1.2.7 1.9.9.7.2 1.3.3 1.9.3s1.2-.1 1.9-.3c.7-.2 1.3-.5 1.9-.9.4.4.8.8 1.2 1.1A8 8 0 0 1 12 20zm4.4-15c.4 0 .8.1 1.2.3l-.2.2c-.4.3-.8.7-1.2 1.1-.3-.6-.7-1.1-1.2-1.5.4-.1.9-.1 1.4-.1z"/>
    </svg>
  )
};

const Footer = () => {
  const [contacto, setContacto] = useState(null);

  useEffect(() => {
    const fetchContacto = async () => {
      try {
        const { data } = await api.get('/contacto');
        setContacto(data?.data || null);
      } catch (err) {
        setContacto(null);
      }
    };

    fetchContacto();
  }, []);

  const telefono = contacto?.telefono || '+1 (555) 123-4567';
  const email = contacto?.email || 'contacto@entradas.com';
  const whatsapp = contacto?.whatsapp || '+1 (555) 987-6543';
  const horario = contacto?.horario || 'Lunes a Sábado 9:00 AM - 8:00 PM';

  const socials = [
    { key: 'facebook', url: contacto?.facebook || 'https://facebook.com' },
    { key: 'instagram', url: contacto?.instagram || 'https://instagram.com' },
    { key: 'twitter', url: contacto?.twitter || 'https://twitter.com' },
    { key: 'youtube', url: contacto?.youtube || 'https://youtube.com' },
    { key: 'tiktok', url: contacto?.tiktok || 'https://www.tiktok.com' },
    { key: 'linkedin', url: contacto?.linkedin || 'https://www.linkedin.com' },
    { key: 'website', url: contacto?.website || 'https://www.tusitio.com' }
  ].filter(s => s.url);

  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-section footer-section-info">
          <img src={logoImage} alt="PlusTicket" className="footer-logo-image" />
          <div className="footer-info-content">
            <h3>Información</h3>
            <p>Tu plataforma de confianza para adquirir entradas a los mejores eventos culturales y musicales.</p>
            <p>Horario: {horario}</p>
          </div>
        </div>

        <div className="footer-section">
          <h3>Contacto</h3>
          <p>📞 Teléfono: {telefono}</p>
          <p>📧 Email: {email}</p>
          <p>💬 WhatsApp: {whatsapp}</p>
        </div>

        <div className="footer-section">
          <h3>Redes Sociales</h3>
          <div className="social-links">
            {socials.map((item) => (
              <a
                key={item.key}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="social-link"
              >
                {iconos[item.key] || iconos.website}
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <p>&copy; 2025 PlusTicket - MAS FACIL IMPOSIBLE. Todos los derechos reservados.</p>
      </div>
    </footer>
  );
};

export default Footer;

