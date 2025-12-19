import { useEffect, useState } from 'react';
import api from '../api/axios';
import './Contacto.css';

const Contacto = () => {
  const [contacto, setContacto] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchContacto = async () => {
      try {
        const { data } = await api.get('/contacto');
        setContacto(data?.data || null);
      } catch (err) {
        setContacto(null);
      } finally {
        setLoading(false);
      }
    };

    fetchContacto();
  }, []);

  const telefono = contacto?.telefono || '+1 (555) 123-4567';
  const email = contacto?.email || 'contacto@entradas.com';
  const whatsapp = contacto?.whatsapp || '+1 (555) 987-6543';
  const direccion = contacto?.direccion || 'Av. Principal 123, Centro\nCiudad, País';
  const horario = contacto?.horario || 'Lunes a Sábado: 9:00 AM - 8:00 PM\nDomingo: 10:00 AM - 6:00 PM';

  return (
    <div className="contacto">
      <div className="container">
        <h1 className="contacto-title">Contacto</h1>
        <div className="contacto-content">
          <div className="contacto-info">
            <h2>Información de Contacto</h2>
            <div className="info-item">
              <h3>📍 Dirección</h3>
              <p>{direccion.split('\n').map((line, idx) => (<span key={idx}>{line}<br /></span>))}</p>
            </div>
            <div className="info-item">
              <h3>📞 Teléfono</h3>
              <p>{telefono}</p>
            </div>
            <div className="info-item">
              <h3>📧 Email</h3>
              <p>{email}</p>
            </div>
            <div className="info-item">
              <h3>💬 WhatsApp</h3>
              <p>{whatsapp}</p>
            </div>
            <div className="info-item">
              <h3>🕐 Horario de Atención</h3>
              <p>{horario.split('\n').map((line, idx) => (<span key={idx}>{line}<br /></span>))}</p>
            </div>
          </div>
          <div className="contacto-form">
            <h2>Envíanos un Mensaje</h2>
            <form>
              <input type="text" placeholder="Nombre" required />
              <input type="email" placeholder="Email" required />
              <input type="tel" placeholder="Teléfono" />
              <textarea placeholder="Mensaje" rows="6" required></textarea>
              <button type="submit" disabled={loading}>Enviar Mensaje</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Contacto;

