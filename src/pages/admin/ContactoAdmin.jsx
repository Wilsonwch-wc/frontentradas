import { useEffect, useState } from 'react';
import api from '../../api/axios';
import './ContactoAdmin.css';

const ContactoAdmin = () => {
  const [form, setForm] = useState({
    telefono: '',
    email: '',
    whatsapp: '',
    direccion: '',
    horario: '',
    facebook: '',
    instagram: '',
    twitter: '',
    youtube: '',
    tiktok: '',
    linkedin: '',
    website: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const cargarDatos = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/contacto');
      if (data?.data) {
        setForm({
          telefono: data.data.telefono || '',
          email: data.data.email || '',
          whatsapp: data.data.whatsapp || '',
          direccion: data.data.direccion || '',
          horario: data.data.horario || '',
          facebook: data.data.facebook || '',
          instagram: data.data.instagram || '',
          twitter: data.data.twitter || '',
          youtube: data.data.youtube || '',
          tiktok: data.data.tiktok || '',
          linkedin: data.data.linkedin || '',
          website: data.data.website || ''
        });
      }
    } catch (err) {
      setError('No se pudo cargar la información de contacto.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
    setSuccess('');
  };

  const handleGuardar = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      await api.put('/contacto', form);
      setSuccess('Datos actualizados correctamente.');
      await cargarDatos();
    } catch (err) {
      const msg = err.response?.data?.message || 'Error al guardar los datos.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="contacto-admin">
      <div className="contacto-admin-header">
        <div>
          <h1>Datos de Contacto</h1>
          <p>Editar la información que se muestra en el footer y en la página de contacto.</p>
        </div>
        <button
          className="contacto-admin-refresh"
          onClick={cargarDatos}
          disabled={loading || saving}
        >
          {loading ? 'Cargando...' : 'Recargar'}
        </button>
      </div>

      <div className="contacto-admin-card">
        {error && <div className="contacto-admin-alert error">{error}</div>}
        {success && <div className="contacto-admin-alert success">{success}</div>}

        <div className="contacto-admin-grid">
          <label className="contacto-admin-field">
            <span>Teléfono</span>
            <input
              type="text"
              name="telefono"
              value={form.telefono}
              onChange={handleChange}
              placeholder="(+591) 700-00000"
            />
          </label>

          <label className="contacto-admin-field">
            <span>Email</span>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="contacto@ejemplo.com"
            />
          </label>

          <label className="contacto-admin-field">
            <span>WhatsApp</span>
            <input
              type="text"
              name="whatsapp"
              value={form.whatsapp}
              onChange={handleChange}
              placeholder="+59170000000"
            />
          </label>

          <label className="contacto-admin-field">
            <span>Facebook</span>
            <input
              type="url"
              name="facebook"
              value={form.facebook}
              onChange={handleChange}
              placeholder="https://facebook.com/tu-pagina"
            />
          </label>

          <label className="contacto-admin-field">
            <span>Instagram</span>
            <input
              type="url"
              name="instagram"
              value={form.instagram}
              onChange={handleChange}
              placeholder="https://instagram.com/tu-pagina"
            />
          </label>

          <label className="contacto-admin-field">
            <span>Twitter/X</span>
            <input
              type="url"
              name="twitter"
              value={form.twitter}
              onChange={handleChange}
              placeholder="https://twitter.com/tu-pagina"
            />
          </label>

          <label className="contacto-admin-field">
            <span>YouTube</span>
            <input
              type="url"
              name="youtube"
              value={form.youtube}
              onChange={handleChange}
              placeholder="https://youtube.com/tu-canal"
            />
          </label>

          <label className="contacto-admin-field">
            <span>TikTok</span>
            <input
              type="url"
              name="tiktok"
              value={form.tiktok}
              onChange={handleChange}
              placeholder="https://www.tiktok.com/@tu-usuario"
            />
          </label>

          <label className="contacto-admin-field">
            <span>LinkedIn</span>
            <input
              type="url"
              name="linkedin"
              value={form.linkedin}
              onChange={handleChange}
              placeholder="https://www.linkedin.com/company/tu-empresa"
            />
          </label>

          <label className="contacto-admin-field">
            <span>Sitio web</span>
            <input
              type="url"
              name="website"
              value={form.website}
              onChange={handleChange}
              placeholder="https://www.tusitio.com"
            />
          </label>

          <label className="contacto-admin-field full">
            <span>Dirección</span>
            <input
              type="text"
              name="direccion"
              value={form.direccion}
              onChange={handleChange}
              placeholder="Av. Ejemplo 123, La Paz"
            />
          </label>

          <label className="contacto-admin-field full">
            <span>Horario</span>
            <input
              type="text"
              name="horario"
              value={form.horario}
              onChange={handleChange}
              placeholder="Lun-Vie 09:00 - 18:00"
            />
          </label>
        </div>

        <div className="contacto-admin-actions">
          <button
            className="contacto-admin-save"
            onClick={handleGuardar}
            disabled={saving}
          >
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ContactoAdmin;

