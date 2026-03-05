import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { getServerBase } from '../../api/base';
import { useAlert } from '../../context/AlertContext';
import './Cartelera.css';

const serverBase = getServerBase();

const Cartelera = () => {
  const { showAlert, showConfirm } = useAlert();
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEvento, setEditingEvento] = useState(null);
  const [formData, setFormData] = useState({
    imagen: '',
    qr_pago_url: '',
    titulo: '',
    descripcion: '',
    hora_inicio: '',
    precio: '',
    es_nuevo: false,
    tipo_evento: 'general',
    capacidad_maxima: '',
    limite_entradas: '',
    estado: 'activo'
  });
  const [error, setError] = useState('');
  const [imagenPreview, setImagenPreview] = useState('');
  const [imagenFile, setImagenFile] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [qrPreview, setQrPreview] = useState('');
  const [qrFile, setQrFile] = useState(null);
  const [uploadingQr, setUploadingQr] = useState(false);
  
  // Estados para tipos de precio en el formulario (general y especial): tipo, precio, limite (opcional por tipo)
  const [tiposPrecioForm, setTiposPrecioForm] = useState([{ tipo: '', precio: '', limite: '' }]);

  useEffect(() => {
    cargarEventos();
  }, []);

  const cargarEventos = async () => {
    try {
      setLoading(true);
      const response = await api.get('/eventos');
      if (response.data.success) {
        setEventos(response.data.data);
      }
    } catch (error) {
      console.error('Error al cargar eventos:', error);
      setError('Error al cargar los eventos');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
    
    // Si cambia el tipo de evento, mantener tipos de precio (ambos pueden tener múltiples)
    if (name === 'tipo_evento' && value === 'especial' && tiposPrecioForm.length === 0) {
      setTiposPrecioForm([{ tipo: '', precio: '', limite: '' }]);
    }
    
    setError('');
  };

  // Manejar cambios en tipos de precio
  const handleTipoPrecioChange = (index, field, value) => {
    const nuevosTipos = [...tiposPrecioForm];
    nuevosTipos[index][field] = value;
    setTiposPrecioForm(nuevosTipos);
  };

  // Agregar nuevo tipo de precio
  const agregarTipoPrecio = () => {
    setTiposPrecioForm([...tiposPrecioForm, { tipo: '', precio: '', limite: '' }]);
  };

  // Eliminar tipo de precio
  const eliminarTipoPrecio = (index) => {
    if (tiposPrecioForm.length > 1) {
      const nuevosTipos = tiposPrecioForm.filter((_, i) => i !== index);
      setTiposPrecioForm(nuevosTipos);
    }
  };

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validar tipo de archivo
    if (!file.type.match('image.*')) {
      setError('Por favor selecciona un archivo de imagen válido');
      return;
    }

    // Validar tamaño (5MB máximo)
    if (file.size > 5 * 1024 * 1024) {
      setError('La imagen no debe superar los 5MB');
      return;
    }

    setImagenFile(file);
    setError('');

    // Crear preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagenPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleQrChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.match('image.*')) {
      setError('Por favor selecciona una imagen válida para el QR');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('La imagen de QR no debe superar los 5MB');
      return;
    }

    setQrFile(file);
    setError('');

    const reader = new FileReader();
    reader.onloadend = () => {
      setQrPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const subirImagen = async () => {
    if (!imagenFile) return formData.imagen;

    try {
      setUploadingImage(true);
      const formDataUpload = new FormData();
      formDataUpload.append('imagen', imagenFile);

      const token = localStorage.getItem('token');
      const response = await fetch(`${serverBase}/api/upload/imagen`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formDataUpload
      });

      const data = await response.json();
      
      if (data.success) {
        return data.data.url;
      } else {
        throw new Error(data.message || 'Error al subir la imagen');
      }
    } catch (error) {
      console.error('Error al subir imagen:', error);
      setError('Error al subir la imagen: ' + error.message);
      throw error;
    } finally {
      setUploadingImage(false);
    }
  };

  const subirQr = async () => {
    if (!qrFile) return formData.qr_pago_url;

    try {
      setUploadingQr(true);
      const formDataUpload = new FormData();
      formDataUpload.append('imagen', qrFile);

      const token = localStorage.getItem('token');
      const response = await fetch(`${serverBase}/api/upload/imagen`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formDataUpload
      });

      const data = await response.json();
      
      if (data.success) {
        return data.data.url;
      } else {
        throw new Error(data.message || 'Error al subir el QR de pago');
      }
    } catch (error) {
      console.error('Error al subir QR:', error);
      setError('Error al subir el QR: ' + error.message);
      throw error;
    } finally {
      setUploadingQr(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Verificar que el usuario esté autenticado
    const token = localStorage.getItem('token');
    if (!token) {
      setError('No estás autenticado. Por favor, inicia sesión nuevamente.');
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);
      return;
    }

    // Validaciones básicas
    if (!formData.titulo || !formData.descripcion || !formData.hora_inicio) {
      setError('Por favor completa todos los campos requeridos');
      return;
    }

    // Validar tipos de precio para eventos general y especial (ambos usan múltiples precios: VIP, General, Gradería, etc.)
    const tiposValidos = tiposPrecioForm.filter(tp => tp.tipo.trim() && tp.precio);
    if (tiposValidos.length === 0) {
      setError('Debes agregar al menos un tipo de precio (ej: VIP, General, Gradería)');
      return;
    }
    for (const tp of tiposPrecioForm) {
      if (tp.tipo.trim() && (!tp.precio || isNaN(tp.precio) || parseFloat(tp.precio) < 0)) {
        setError('Todos los tipos de precio deben tener un nombre y un precio válido');
        return;
      }
    }

    // (Límite global ya no se usa para general: cada tipo de precio define su propio límite)

    try {

      // Subir imagen si hay una nueva
      let imagenUrl = formData.imagen;
      if (imagenFile) {
        imagenUrl = await subirImagen();
      }

      // Subir QR si hay uno nuevo
      let qrUrl = formData.qr_pago_url;
      if (qrFile) {
        qrUrl = await subirQr();
      }

      const tiposValidos = tiposPrecioForm.filter(tp => tp.tipo.trim() && tp.precio);
      const precioMinGeneral = tiposValidos.length > 0
        ? Math.min(...tiposValidos.map(tp => parseFloat(tp.precio)))
        : 0;
      const eventoData = {
        ...formData,
        imagen: imagenUrl || null,
        qr_pago_url: qrUrl || null,
        precio: formData.tipo_evento === 'general' ? precioMinGeneral : (formData.tipo_evento === 'especial' ? 0 : parseFloat(formData.precio) || 0),
        capacidad_maxima: formData.tipo_evento === 'especial' ? (formData.capacidad_maxima ? parseInt(formData.capacidad_maxima) : null) : null,
        limite_entradas: formData.tipo_evento === 'general' ? null : (formData.limite_entradas ? parseInt(formData.limite_entradas) : null),
        estado: formData.estado || 'activo'
      };

      let response;
      if (editingEvento) {
        // Actualizar evento
        response = await api.put(`/eventos/${editingEvento.id}`, eventoData);
      } else {
        // Crear evento
        response = await api.post('/eventos', eventoData);
      }

      if (response.data.success) {
        const nuevoEventoId = editingEvento ? editingEvento.id : response.data.data.id;
        
        // Guardar tipos de precio para evento especial y para general (VIP, General, Gradería, etc.)
        if (formData.tipo_evento === 'especial' || formData.tipo_evento === 'general') {
          const tiposValidos = tiposPrecioForm.filter(tp => tp.tipo.trim() && tp.precio);
          
          if (editingEvento) {
            // Al editar, sincronizar tipos de precio: actualizar existentes y crear nuevos
            try {
              const tiposExistentesRes = await api.get(`/tipos-precio/evento/${nuevoEventoId}`);
              const tiposExistentes = tiposExistentesRes.data.success ? tiposExistentesRes.data.data : [];
              
              // Mapear tipos existentes por índice para mantener el orden
              const tiposProcesados = new Set();
              
              // Actualizar o crear tipos de precio según corresponda
              for (let i = 0; i < tiposValidos.length; i++) {
                const tipoPrecio = tiposValidos[i];
                const tipoExistente = tiposExistentes[i]; // Usar índice para mapear (asumiendo orden similar)
                
                const limiteVal = (tipoPrecio.limite !== '' && tipoPrecio.limite != null && !isNaN(parseInt(tipoPrecio.limite, 10)))
                  ? parseInt(tipoPrecio.limite, 10) : null;
                if (tipoExistente && !tiposProcesados.has(tipoExistente.id)) {
                  const nombreCambio = tipoExistente.nombre !== tipoPrecio.tipo.trim();
                  const precioCambio = parseFloat(tipoExistente.precio) !== parseFloat(tipoPrecio.precio);
                  const limiteCambio = (tipoExistente.limite != null ? tipoExistente.limite : '') !== (limiteVal != null ? limiteVal : '');
                  if (nombreCambio || precioCambio || limiteCambio) {
                    try {
                      await api.put(`/tipos-precio/${tipoExistente.id}`, {
                        nombre: tipoPrecio.tipo.trim(),
                        precio: parseFloat(tipoPrecio.precio),
                        limite: limiteVal,
                        activo: true
                      });
                    } catch (error) {
                      console.error('Error al actualizar tipo de precio:', error);
                      if (error.response?.data?.message) setError(error.response.data.message);
                    }
                  }
                  tiposProcesados.add(tipoExistente.id);
                } else {
                  try {
                    await api.post('/tipos-precio', {
                      evento_id: nuevoEventoId,
                      nombre: tipoPrecio.tipo.trim(),
                      precio: parseFloat(tipoPrecio.precio),
                      limite: limiteVal,
                      descripcion: null,
                      activo: true
                    });
                  } catch (error) {
                    console.error('Error al crear tipo de precio:', error);
                  }
                }
              }
              
              // Eliminar o desactivar tipos de precio que ya no están en el formulario
              for (let i = tiposValidos.length; i < tiposExistentes.length; i++) {
                const tipoExcedente = tiposExistentes[i];
                if (!tiposProcesados.has(tipoExcedente.id)) {
                  // Intentar eliminar primero (si no hay asientos)
                  try {
                    await api.delete(`/tipos-precio/${tipoExcedente.id}`);
                  } catch (deleteError) {
                    // Si falla la eliminación (hay asientos), marcarlo como inactivo
                    try {
                      await api.put(`/tipos-precio/${tipoExcedente.id}`, {
                        activo: false
                      });
                    } catch (updateError) {
                      console.error('Error al desactivar tipo de precio:', updateError);
                    }
                  }
                }
              }
            } catch (error) {
              console.error('Error al sincronizar tipos de precio:', error);
            }
          } else {
            for (const tipoPrecio of tiposValidos) {
              const limiteVal = (tipoPrecio.limite !== '' && tipoPrecio.limite != null && !isNaN(parseInt(tipoPrecio.limite, 10)))
                ? parseInt(tipoPrecio.limite, 10) : null;
              try {
                await api.post('/tipos-precio', {
                  evento_id: nuevoEventoId,
                  nombre: tipoPrecio.tipo.trim(),
                  precio: parseFloat(tipoPrecio.precio),
                  limite: limiteVal,
                  descripcion: null,
                  activo: true
                });
              } catch (error) {
                console.error('Error al crear tipo de precio:', error);
              }
            }
          }
        }
        
        cargarEventos();
        cerrarModal();
      }
    } catch (error) {
      console.error('Error completo:', error);
      
      // Detectar si el error es por respuesta HTML
      let errorMessage = 'Error al guardar el evento';
      
      if (error.response) {
        const contentType = error.response.headers['content-type'] || '';
        const responseData = error.response.data;
        
        // Si la respuesta es HTML, mostrar mensaje específico
        if (contentType.includes('text/html') || 
            (typeof responseData === 'string' && responseData.trim().startsWith('<'))) {
          if (error.response.status === 401 || error.response.status === 403) {
            errorMessage = 'Tu sesión ha expirado o no tienes permisos. Por favor, inicia sesión nuevamente.';
            // Redirigir después de mostrar el error
            setTimeout(() => {
              localStorage.removeItem('token');
              localStorage.removeItem('user');
              window.location.href = '/login';
            }, 2000);
          } else {
            errorMessage = `Error del servidor (${error.response.status}). Por favor, verifica tu conexión o contacta al administrador.`;
          }
        } else if (error.response.data?.message) {
          errorMessage = error.response.data.message;
        } else if (error.response.status === 401 || error.response.status === 403) {
          errorMessage = 'No tienes permisos para realizar esta acción. Por favor, inicia sesión nuevamente.';
          setTimeout(() => {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
          }, 2000);
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
    }
  };

  const handleEdit = async (evento) => {
    setEditingEvento(evento);
    setFormData({
      imagen: evento.imagen || '',
      qr_pago_url: evento.qr_pago_url || '',
      titulo: evento.titulo,
      descripcion: evento.descripcion,
      hora_inicio: evento.hora_inicio ? evento.hora_inicio.slice(0, 16) : '',
      precio: evento.precio.toString(),
      es_nuevo: evento.es_nuevo === 1 || evento.es_nuevo === true,
      tipo_evento: evento.tipo_evento || 'general',
      capacidad_maxima: evento.capacidad_maxima || '',
      limite_entradas: evento.limite_entradas || '',
      estado: evento.estado || 'activo'
    });
    setImagenPreview(evento.imagen ? `${serverBase}${evento.imagen}` : '');
    setImagenFile(null);
    const qrUrl = evento.qr_pago_url;
    const qrFull = qrUrl ? (qrUrl.startsWith('http') ? qrUrl : `${serverBase}${qrUrl}`) : '';
    setQrPreview(qrFull);
    setQrFile(null);
    
    // Cargar tipos de precio (especial y general pueden tener múltiples)
    if (evento.tipo_evento === 'especial' || evento.tipo_evento === 'general') {
      try {
        const tiposRes = await api.get(`/tipos-precio/evento/${evento.id}`);
        if (tiposRes.data.success && tiposRes.data.data.length > 0) {
          setTiposPrecioForm(tiposRes.data.data.map(tp => ({
            id: tp.id,
            tipo: tp.nombre,
            precio: tp.precio.toString(),
            limite: tp.limite != null ? tp.limite.toString() : '',
            vendidos: tp.vendidos,
            disponibles: tp.disponibles
          })));
        } else {
          setTiposPrecioForm([{ tipo: '', precio: '', limite: '' }]);
        }
      } catch (error) {
        console.error('Error al cargar tipos de precio:', error);
        setTiposPrecioForm([{ tipo: '', precio: '', limite: '' }]);
      }
    } else {
      setTiposPrecioForm([{ tipo: '', precio: '', limite: '' }]);
    }
    
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    const confirmado = await showConfirm('¿Estás seguro de que deseas eliminar este evento?', { 
      type: 'warning',
      title: 'Eliminar Evento'
    });
    if (!confirmado) {
      return;
    }

    try {
      const response = await api.delete(`/eventos/${id}`);
      if (response.data.success) {
        cargarEventos();
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Error al eliminar el evento';
      showAlert(errorMessage, { type: 'error' });
    }
  };

  const abrirModalNuevo = () => {
    setEditingEvento(null);
    setFormData({
      imagen: '',
      qr_pago_url: '',
      titulo: '',
      descripcion: '',
      hora_inicio: '',
      precio: '',
      es_nuevo: false,
      tipo_evento: 'general',
      capacidad_maxima: '',
      limite_entradas: '',
      estado: 'activo'
    });
    setImagenPreview('');
    setImagenFile(null);
    setQrPreview('');
    setQrFile(null);
    setError('');
    setTiposPrecioForm([{ tipo: '', precio: '', limite: '' }]);
    setShowModal(true);
  };

  const cerrarModal = () => {
    setShowModal(false);
    setEditingEvento(null);
    setImagenPreview('');
    setImagenFile(null);
    setError('');
    setTiposPrecioForm([{ tipo: '', precio: '' }]);
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return '-';
    const date = new Date(fecha);
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="admin-page">
      <div className="admin-content">
        <div className="cartelera-header">
          <div>
            <h1>Cartelera de Eventos</h1>
            <p>Gestiona los eventos y la cartelera</p>
          </div>
          <button className="btn-primary" onClick={abrirModalNuevo}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Registrar Evento
          </button>
        </div>

        {loading ? (
          <div className="loading">Cargando eventos...</div>
        ) : eventos.length === 0 ? (
          <div className="no-events">
            <p>No hay eventos registrados</p>
            <button className="btn-primary" onClick={abrirModalNuevo}>
              Registrar Primer Evento
            </button>
          </div>
        ) : (
          <div className="eventos-grid">
            {eventos.map((evento) => (
              <div key={evento.id} className="evento-card">
                {evento.es_nuevo === 1 && (
                  <span className="badge-nuevo">Nuevo</span>
                )}
                <div className="evento-imagen">
                  {evento.imagen ? (
                    <img src={evento.imagen.startsWith('http') ? evento.imagen : `${serverBase}${evento.imagen}`} alt={evento.titulo} />
                  ) : (
                    <div className="evento-sin-imagen">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <circle cx="8.5" cy="8.5" r="1.5"></circle>
                        <polyline points="21 15 16 10 5 21"></polyline>
                      </svg>
                    </div>
                  )}
                </div>
                <div className="evento-content">
                  <h3 className="evento-titulo">{evento.titulo}</h3>
                  <p className="evento-descripcion">{evento.descripcion}</p>
                  <div className="evento-info">
                    <div className="evento-fecha">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                      </svg>
                      {formatearFecha(evento.hora_inicio)}
                    </div>
                    <div className="evento-precio">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="12" y1="1" x2="12" y2="23"></line>
                        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                      </svg>
                      ${parseFloat(evento.precio).toFixed(2)}
                    </div>
                  </div>
                </div>
                <div className="evento-acciones">
                  <button
                    className="btn-edit"
                    onClick={() => handleEdit(evento)}
                    title="Editar"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                  </button>
                  <button
                    className="btn-delete"
                    onClick={() => handleDelete(evento.id)}
                    title="Eliminar"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal para crear/editar evento */}
        {showModal && (
          <div className="modal-overlay" onClick={cerrarModal}>
            <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>{editingEvento ? 'Editar Evento' : 'Registrar Nuevo Evento'}</h2>
                <button className="modal-close" onClick={cerrarModal}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="modal-form">
                {error && <div className="error-message">{error}</div>}

                <div className="form-group">
                  <label>Imagen del Evento</label>
                  <input
                    type="file"
                    name="imagen"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="file-input"
                  />
                  {imagenPreview && (
                    <div className="image-preview">
                      <img src={imagenPreview} alt="Preview" />
                      <button
                        type="button"
                        className="remove-image"
                        onClick={() => {
                          setImagenPreview('');
                          setImagenFile(null);
                          setFormData({ ...formData, imagen: '' });
                        }}
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                      </button>
                    </div>
                  )}
                  {uploadingImage && (
                    <div className="uploading-message">Subiendo imagen...</div>
                  )}
                </div>

        <div className="form-group">
          <label>QR de Pago (imagen)</label>
          <input
            type="file"
            name="qr_pago_url"
            accept="image/*"
            onChange={handleQrChange}
            className="file-input"
          />
          {qrPreview && (
            <div className="image-preview">
              <img src={qrPreview} alt="QR Pago" />
              <button
                type="button"
                className="remove-image"
                onClick={() => {
                  setQrPreview('');
                  setQrFile(null);
                  setFormData({ ...formData, qr_pago_url: '' });
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          )}
          {uploadingQr && (
            <div className="uploading-message">Subiendo QR...</div>
          )}
        </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Título *</label>
                    <input
                      type="text"
                      name="titulo"
                      value={formData.titulo}
                      onChange={handleInputChange}
                      required
                      placeholder="Nombre del evento"
                    />
                  </div>

                  <div className="form-group">
                    <label>Tipo de Evento *</label>
                    <select
                      name="tipo_evento"
                      value={formData.tipo_evento}
                      onChange={handleInputChange}
                      required
                    >
                      <option value="general">General (Múltiples precios: VIP, General, Gradería… sin asientos)</option>
                      <option value="especial">Especial (Múltiples precios, con diseño de mesas y asientos)</option>
                    </select>
                  </div>
                </div>

                {(formData.tipo_evento === 'general' || formData.tipo_evento === 'especial') && (
                  <div className="form-group">
                    <label>Tipos de Precio *</label>
                    {formData.tipo_evento === 'especial' && (
                      <p className="form-hint" style={{ marginBottom: '10px', color: '#555', fontSize: '13px' }}>
                        Solo define el nombre y precio de cada tipo (ej. VIP, General). El límite de entradas por tipo se define después en <strong>Espacio</strong>, al diseñar el plano y asignar asientos a cada tipo; los clientes elegirán su lugar ahí.
                      </p>
                    )}
                    <div className="tipos-precio-table">
                      <table style={{ width: '100%', marginBottom: '10px' }}>
                        <thead>
                          <tr>
                            <th style={{ textAlign: 'left', padding: '8px' }}>Tipo</th>
                            <th style={{ textAlign: 'left', padding: '8px' }}>Precio</th>
                            <th style={{ textAlign: 'left', padding: '8px' }}>Vendidos / Quedan</th>
                            <th style={{ textAlign: 'left', padding: '8px' }}>
                              {formData.tipo_evento === 'especial' ? 'Límite (opc.; mejor en Espacio)' : 'Límite (opc.)'}
                            </th>
                            <th style={{ width: '50px', padding: '8px' }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {tiposPrecioForm.map((tipoPrecio, index) => (
                            <tr key={tipoPrecio.id ?? index}>
                              <td style={{ padding: '8px' }}>
                                <input
                                  type="text"
                                  value={tipoPrecio.tipo}
                                  onChange={(e) => handleTipoPrecioChange(index, 'tipo', e.target.value)}
                                  placeholder="Ej: VIP, General, Balcón"
                                  style={{ width: '100%', padding: '6px', border: '1px solid #ddd', borderRadius: '4px' }}
                                />
                              </td>
                              <td style={{ padding: '8px' }}>
                                <input
                                  type="number"
                                  value={tipoPrecio.precio}
                                  onChange={(e) => handleTipoPrecioChange(index, 'precio', e.target.value)}
                                  placeholder="0.00"
                                  min="0"
                                  step="0.01"
                                  style={{ width: '100%', padding: '6px', border: '1px solid #ddd', borderRadius: '4px' }}
                                />
                              </td>
                              <td style={{ padding: '8px', minWidth: '140px' }}>
                                {typeof tipoPrecio.vendidos === 'number' ? (
                                  <span style={{ color: '#c0392b', fontWeight: 600, fontSize: '13px' }}>
                                    Vendidos: {tipoPrecio.vendidos}
                                    {tipoPrecio.disponibles !== null && tipoPrecio.disponibles !== undefined && (
                                      <> · Quedan: {tipoPrecio.disponibles}</>
                                    )}
                                  </span>
                                ) : (
                                  <span style={{ color: '#888', fontSize: '12px' }}>—</span>
                                )}
                              </td>
                              <td style={{ padding: '8px' }}>
                                <input
                                  type="number"
                                  value={tipoPrecio.limite ?? ''}
                                  onChange={(e) => handleTipoPrecioChange(index, 'limite', e.target.value)}
                                  placeholder={formData.tipo_evento === 'especial' ? 'Definir en Espacio' : 'Sin límite'}
                                  min={typeof tipoPrecio.vendidos === 'number' ? tipoPrecio.vendidos : 0}
                                  step="1"
                                  title={formData.tipo_evento === 'especial'
                                    ? 'Opcional. El límite real lo defines en Espacio al colocar los asientos por tipo.'
                                    : (typeof tipoPrecio.vendidos === 'number' ? `Mínimo ${tipoPrecio.vendidos} (ya vendidos).` : 'Cantidad máxima. Vacío = sin límite.')}
                                  style={{ width: '100%', padding: '6px', border: '1px solid #ddd', borderRadius: '4px' }}
                                />
                              </td>
                              <td style={{ padding: '8px', textAlign: 'center' }}>
                                {tiposPrecioForm.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => eliminarTipoPrecio(index)}
                                    style={{
                                      background: '#dc3545',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '4px',
                                      padding: '6px 10px',
                                      cursor: 'pointer'
                                    }}
                                    title="Eliminar"
                                  >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <line x1="18" y1="6" x2="6" y2="18"></line>
                                      <line x1="6" y1="6" x2="18" y2="18"></line>
                                    </svg>
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <button
                        type="button"
                        onClick={agregarTipoPrecio}
                        style={{
                          background: '#28a745',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '8px 16px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="12" y1="5" x2="12" y2="19"></line>
                          <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        Agregar Tipo de Precio
                      </button>
                    </div>
                  </div>
                )}

                <div className="form-group">
                  <label>Descripción *</label>
                  <textarea
                    name="descripcion"
                    value={formData.descripcion}
                    onChange={handleInputChange}
                    required
                    rows="4"
                    placeholder="Descripción del evento"
                  ></textarea>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Fecha y Hora de Inicio *</label>
                    <input
                      type="datetime-local"
                      name="hora_inicio"
                      value={formData.hora_inicio}
                      onChange={handleInputChange}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        name="es_nuevo"
                        checked={formData.es_nuevo}
                        onChange={handleInputChange}
                      />
                      Marcar como nuevo evento
                    </label>
                  </div>

                  <div className="form-group">
                    <label>Estado del Evento *</label>
                    <select
                      name="estado"
                      value={formData.estado}
                      onChange={handleInputChange}
                      required
                    >
                      <option value="activo">Activo (Mostrar precio)</option>
                      <option value="proximamente">Próximamente (Sin precio)</option>
                      <option value="finalizado">Finalizado (Oculto)</option>
                    </select>
                  </div>
                </div>


                <div className="modal-actions">
                  <button type="button" className="btn-secondary" onClick={cerrarModal} disabled={uploadingImage}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn-primary" disabled={uploadingImage}>
                    {uploadingImage ? 'Subiendo...' : (editingEvento ? 'Actualizar' : 'Registrar')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Cartelera;
