import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../../api/axios";
import { useAlert } from "../../context/AlertContext";
import { useAuth } from "../../context/AuthContext";
import ModalTipoPago from "../../components/ModalTipoPago";
import "./Compras.css";

const Compras = () => {
  const { showAlert, showConfirm } = useAlert();
  const { isAdmin, canUseAdminSaleOptions } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [compras, setCompras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [codigoBusqueda, setCodigoBusqueda] = useState("");
  const [busquedaActiva, setBusquedaActiva] = useState("");
  const [compraSeleccionada, setCompraSeleccionada] = useState(null);
  const [mostrarDetalle, setMostrarDetalle] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState(""); // 'PAGO_PENDIENTE', 'PAGO_REALIZADO', etc.
  const [filtroTipoPago, setFiltroTipoPago] = useState(""); // 'QR', 'EFECTIVO', 'PASARELA'
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCompras, setTotalCompras] = useState(0);
  const [eventoFiltro, setEventoFiltro] = useState(""); // '', 'activo', o id del evento
  const [listaEventos, setListaEventos] = useState([]);
  const [confirmando, setConfirmando] = useState(false);
  const [reenviando, setReenviando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [mostrarModalTipoPago, setMostrarModalTipoPago] = useState(false);
  const [compraAConfirmar, setCompraAConfirmar] = useState(null);

  useEffect(() => {
    cargarCompras();
  }, [filtroEstado, eventoFiltro, filtroTipoPago, fechaDesde, fechaHasta, page, busquedaActiva]);

  // Buscar automáticamente si viene el parámetro "buscar" en la URL
  useEffect(() => {
    const codigoBuscar = searchParams.get("buscar");
    if (codigoBuscar) {
      setCodigoBusqueda(codigoBuscar);
      // Buscar y abrir el detalle automáticamente
      const buscarYAbrir = async () => {
        try {
          setLoading(true);
          const response = await api.get(
            `/compras/codigo/${codigoBuscar.trim()}`,
          );
          if (response.data.success) {
            setCompraSeleccionada(response.data.data);
            setMostrarDetalle(true);
            setError("");
          } else {
            setError("Compra no encontrada");
          }
        } catch (err) {
          console.error("Error al buscar compra:", err);
          setError("Compra no encontrada con ese código");
        } finally {
          setLoading(false);
        }
      };
      buscarYAbrir();
      // Limpiar el parámetro de la URL para evitar re-búsquedas
      setSearchParams({});
    }
  }, [searchParams]);

  useEffect(() => {
    const cargarEventos = async () => {
      try {
        const res = await api.get("/eventos");
        if (res.data.success && Array.isArray(res.data.data)) {
          setListaEventos(res.data.data);
        }
      } catch (e) {
        console.warn("No se pudo cargar lista de eventos para filtro:", e);
      }
    };
    cargarEventos();
  }, []);

  const cargarCompras = async () => {
    try {
      setLoading(true);
      const params = { page, limit: 10 };
      if (filtroEstado) params.estado = filtroEstado;
      if (eventoFiltro) params.evento_id = eventoFiltro;
      if (filtroTipoPago) params.tipo_pago = filtroTipoPago;
      if (fechaDesde) params.fecha_desde = fechaDesde;
      if (fechaHasta) params.fecha_hasta = fechaHasta;
      if (busquedaActiva) params.busqueda = busquedaActiva;
      const response = await api.get("/compras", { params });
      if (response.data.success) {
        setCompras(response.data.data);
        if (response.data.totalPages != null) {
          setTotalPages(response.data.totalPages);
          setTotalCompras(response.data.total || 0);
        }
      }
    } catch (error) {
      console.error("Error al cargar compras:", error);
      setError("Error al cargar las compras");
    } finally {
      setLoading(false);
    }
  };

  const buscarPorCodigo = async () => {
    const term = codigoBusqueda.trim();
    if (!term) {
      setBusquedaActiva("");
      setPage(1);
      return;
    }

    // Si parece un código exacto ENT-..., intentar abrir el detalle directamente
    if (term.toUpperCase().startsWith("ENT-")) {
      try {
        setLoading(true);
        const response = await api.get(
          `/compras/codigo/${encodeURIComponent(term)}`,
        );
        if (response.data.success && response.data.data) {
          setCompraSeleccionada(response.data.data);
          setMostrarDetalle(true);
          setError("");
          setLoading(false);
          return;
        }
      } catch (err) {
        console.log("No se abrió directamente por código, aplicando filtro:", err);
      }
    }

    // Para teléfonos, nombres, emails o códigos parciales: filtrar la lista
    setBusquedaActiva(term);
    setPage(1);
  };

  const verDetalle = async (compra) => {
    try {
      setLoading(true);
      const response = await api.get(`/compras/codigo/${compra.codigo_unico}`);
      if (response.data.success) {
        setCompraSeleccionada(response.data.data);
        setMostrarDetalle(true);
      }
    } catch (error) {
      console.error("Error al cargar detalle:", error);
      showAlert("Error al cargar los detalles de la compra", { type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const abrirModalTipoPago = (compraId) => {
    setCompraAConfirmar(compraId);
    setMostrarModalTipoPago(true);
  };

  const confirmarPago = async (
    compraId,
    tipoPago,
    tipoVenta,
    precioOriginal,
  ) => {
    if (!tipoPago || !["QR", "EFECTIVO"].includes(tipoPago)) {
      showAlert("Debe seleccionar el tipo de pago", { type: "error" });
      return;
    }

    try {
      setConfirmando(true);
      const body = { tipo_pago: tipoPago };
      if (tipoVenta) body.tipo_venta = tipoVenta;
      if (precioOriginal != null) body.precio_original = precioOriginal;
      const response = await api.put(
        `/compras/${compraId}/confirmar-pago`,
        body,
      );
      if (response.data.success) {
        showAlert("Pago confirmado exitosamente", { type: "success" });
        setMostrarModalTipoPago(false);
        setCompraAConfirmar(null);
        cargarCompras();
        if (mostrarDetalle && compraSeleccionada?.id === compraId) {
          const updated = await api.get(
            `/compras/codigo/${compraSeleccionada.codigo_unico}`,
          );
          if (updated.data.success) {
            setCompraSeleccionada(updated.data.data);
          }
        }
      } else {
        showAlert(response.data.message || "Error al confirmar el pago", {
          type: "error",
        });
      }
    } catch (error) {
      console.error("Error al confirmar pago:", error);
      showAlert(error.response?.data?.message || "Error al confirmar el pago", {
        type: "error",
      });
    } finally {
      setConfirmando(false);
    }
  };

  const handleSeleccionarTipoPago = (payload) => {
    if (compraAConfirmar) {
      const tipoPago = typeof payload === "string" ? payload : payload.tipoPago;
      const extras = typeof payload === "object" ? payload : {};
      confirmarPago(
        compraAConfirmar,
        tipoPago,
        extras.tipo_venta,
        extras.precio_original,
      );
    }
  };

  const habilitarAsientos = async (compraId) => {
    const confirmado = await showConfirm(
      "¿Estás seguro de habilitar los asientos? Esto cancelará la compra.",
      {
        type: "warning",
        title: "Habilitar Asientos",
      },
    );
    if (!confirmado) {
      return;
    }

    try {
      setConfirmando(true);
      const response = await api.put(`/compras/${compraId}/cancelar`);
      if (response.data.success) {
        showAlert("Asientos habilitados exitosamente", { type: "success" });
        cargarCompras();
        setMostrarDetalle(false);
        setCompraSeleccionada(null);
      } else {
        showAlert(response.data.message || "Error al habilitar asientos", {
          type: "error",
        });
      }
    } catch (error) {
      console.error("Error al habilitar asientos:", error);
      showAlert(
        error.response?.data?.message || "Error al habilitar asientos",
        { type: "error" },
      );
    } finally {
      setConfirmando(false);
    }
  };

  const renderUbicacionCompra = (compra) => {
    const elementos = [];
    const mesasMostradas = new Set();

    // 1. Mesas completas desde compras_mesas
    if (compra.mesas_detalle && compra.mesas_detalle.length > 0) {
      compra.mesas_detalle.forEach((m, idx) => {
        const mesaCodigo = m.codigo_mesa || (m.numero_mesa != null ? `Mesa ${m.numero_mesa}` : `Mesa ${m.mesa_id || ''}`);
        const mesaNombre = String(mesaCodigo).startsWith('Mesa') ? mesaCodigo : `Mesa ${mesaCodigo}`;
        const area = m.area_nombre ? ` • ${m.area_nombre}` : '';
        const sillas = m.cantidad_sillas ? ` [${m.cantidad_sillas} sillas]` : '';
        if (m.mesa_id) mesasMostradas.add(Number(m.mesa_id));
        if (m.codigo_mesa) mesasMostradas.add(String(m.codigo_mesa).toLowerCase());

        elementos.push(
          <span
            key={`m-${idx}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              color: '#1d4ed8',
              padding: '3px 8px',
              borderRadius: '6px',
              fontSize: '0.82rem',
              fontWeight: 700
            }}
          >
            🏷️ {mesaNombre}{area}{sillas}
          </span>
        );
      });
    }

    // 2. Asientos desde compras_asientos (agrupados por mesa o individuales)
    if (compra.asientos_detalle && compra.asientos_detalle.length > 0) {
      const porMesa = {};
      const sinMesa = [];

      compra.asientos_detalle.forEach((a) => {
        const mesaKey = a.mesa_id || a.codigo_mesa || a.numero_mesa;
        if (mesaKey) {
          if (!porMesa[mesaKey]) {
            porMesa[mesaKey] = {
              mesa_id: a.mesa_id,
              codigo_mesa: a.codigo_mesa || a.numero_mesa,
              area_nombre: a.area_nombre,
              tipo_precio_nombre: a.tipo_precio_nombre,
              asientos: []
            };
          }
          porMesa[mesaKey].asientos.push(a);
        } else if (a.asiento_id != null || (a.numero_asiento && !String(a.numero_asiento).toLowerCase().includes('null'))) {
          sinMesa.push(a);
        }
      });

      // Procesar grupos por mesa
      Object.keys(porMesa).forEach((key, idx) => {
        const grupo = porMesa[key];
        if (
          (grupo.mesa_id && mesasMostradas.has(Number(grupo.mesa_id))) ||
          (grupo.codigo_mesa && mesasMostradas.has(String(grupo.codigo_mesa).toLowerCase()))
        ) {
          return; // Ya mostrada en mesas_detalle
        }

        const rawCod = grupo.codigo_mesa || key;
        const mesaCodigo = String(rawCod).startsWith('Mesa') ? rawCod : `Mesa ${rawCod}`;
        const area = grupo.area_nombre ? ` • ${grupo.area_nombre}` : '';

        // Extraer números de asientos válidos (ej: A5, SN, 1, 2)
        const numsValidos = grupo.asientos
          .map((a) => a.numero_asiento)
          .filter((n) => n != null && n !== '' && !String(n).toLowerCase().includes('null') && String(n).toLowerCase() !== 'silla');

        if (numsValidos.length > 0) {
          elementos.push(
            <span
              key={`am-${idx}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                color: '#15803d',
                padding: '3px 8px',
                borderRadius: '6px',
                fontSize: '0.82rem',
                fontWeight: 600
              }}
            >
              🪑 Sillas {numsValidos.join(', ')} ({mesaCodigo}){area}
            </span>
          );
        } else {
          // Es una mesa completa (N sillas)
          elementos.push(
            <span
              key={`am-${idx}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                color: '#1d4ed8',
                padding: '3px 8px',
                borderRadius: '6px',
                fontSize: '0.82rem',
                fontWeight: 700
              }}
            >
              🏷️ {mesaCodigo}{area} [{grupo.asientos.length} sillas]
            </span>
          );
        }
      });

      // Asientos sueltos sin mesa
      if (sinMesa.length > 0) {
        const numsSinMesa = sinMesa
          .map((a) => a.numero_asiento || (a.asiento_id ? `#${a.asiento_id}` : null))
          .filter(Boolean);
        if (numsSinMesa.length > 0) {
          const area = sinMesa[0]?.area_nombre ? ` • ${sinMesa[0].area_nombre}` : '';
          elementos.push(
            <span
              key="sin-mesa"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                color: '#15803d',
                padding: '3px 8px',
                borderRadius: '6px',
                fontSize: '0.82rem',
                fontWeight: 600
              }}
            >
              🪑 Silla{numsSinMesa.length > 1 ? 's' : ''} {numsSinMesa.join(', ')}{area}
            </span>
          );
        }
      }
    }

    // 3. Áreas generales / personas de pie
    if (compra.areas_detalle && compra.areas_detalle.length > 0) {
      compra.areas_detalle.forEach((ar, idx) => {
        elementos.push(
          <span
            key={`ar-${idx}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              background: '#fefce8',
              border: '1px solid #fef08a',
              color: '#854d0e',
              padding: '3px 8px',
              borderRadius: '6px',
              fontSize: '0.82rem',
              fontWeight: 600
            }}
          >
            👥 {ar.area_nombre || 'Zona General'} [{ar.cantidad} personas]
          </span>
        );
      });
    } else if (compra.generales_detalle && compra.generales_detalle.length > 0) {
      compra.generales_detalle.forEach((g, idx) => {
        elementos.push(
          <span
            key={`gen-${idx}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              background: '#fefce8',
              border: '1px solid #fef08a',
              color: '#854d0e',
              padding: '3px 8px',
              borderRadius: '6px',
              fontSize: '0.82rem',
              fontWeight: 600
            }}
          >
            👥 {g.tipo_nombre || 'Entrada General'} [{g.cantidad} personas]
          </span>
        );
      });
    }

    if (elementos.length === 0) {
      return (
        <span style={{ color: '#64748b', fontSize: '0.85rem' }}>
          🎟️ {compra.cantidad || 1} entrada(s)
        </span>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '4px' }}>
        {elementos}
      </div>
    );
  };

  const copiarCodigo = (codigo) => {
    navigator.clipboard
      .writeText(codigo)
      .then(() => {
        showAlert("Código copiado al portapapeles", { type: "success" });
      })
      .catch(() => {
        showAlert("Error al copiar el código", { type: "error" });
      });
  };

  const abrirChatWhatsApp = (telefono) => {
    if (!telefono) {
      showAlert("No hay número de teléfono disponible", { type: "warning" });
      return;
    }

    // Limpiar el número (remover espacios, guiones, paréntesis, signos +)
    let numeroLimpio = telefono.toString().replace(/[\s\-\(\)\+]/g, "");

    // Agregar código de país Bolivia (591) si el número no lo tiene
    if (!numeroLimpio.startsWith("591")) {
      numeroLimpio = "591" + numeroLimpio;
    }

    const url = `https://wa.me/${numeroLimpio}`;
    window.open(url, "_blank");
  };

  const descargarPDFBoleto = async (compraId) => {
    try {
      const response = await api.get(`/compras/${compraId}/pdf`, {
        responseType: "blob", // Importante para descargar el archivo
      });

      // Crear un blob del PDF
      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);

      // Crear un enlace temporal y hacer clic para descargar
      const link = document.createElement("a");
      link.href = url;
      link.download = `boleto-${compraSeleccionada?.codigo_unico || compraId}.pdf`;
      document.body.appendChild(link);
      link.click();

      // Limpiar
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      showAlert("PDF descargado exitosamente", { type: "success" });
    } catch (error) {
      console.error("Error al descargar PDF:", error);
      const errorMessage =
        error.response?.data?.message || "Error al descargar el PDF del boleto";
      showAlert(errorMessage, { type: "error" });
    }
  };

  const enviarPorEmail = async (compraId, email, nombreCliente) => {
    if (!email) {
      showAlert("No se encontró correo electrónico del cliente", {
        type: "warning",
      });
      return;
    }

    const confirmado = await showConfirm(
      `¿Enviar el PDF del boleto por correo electrónico a ${email}?`,
      {
        type: "info",
        title: "Enviar por Email",
      },
    );
    if (!confirmado) {
      return;
    }

    try {
      setReenviando(true);
      const response = await api.post(`/compras/${compraId}/enviar-email`);

      if (response.data.success) {
        showAlert(
          `Boleto enviado exitosamente por correo a ${response.data.email}`,
          { type: "success" },
        );
      } else {
        showAlert(
          response.data.message || "Error al enviar el boleto por correo",
          { type: "error" },
        );
      }
    } catch (error) {
      console.error("Error al enviar boleto por email:", error);
      const errorMessage =
        error.response?.data?.message ||
        "Error al enviar el boleto por correo electrónico";
      showAlert(errorMessage, { type: "error" });
    } finally {
      setReenviando(false);
    }
  };

  const enviarPorMiWhatsApp = async (compraId, telefono, nombreCliente) => {
    if (!telefono) {
      showAlert("No se encontró número de teléfono del cliente", {
        type: "warning",
      });
      return;
    }

    const confirmado = await showConfirm(
      `¿Enviar el PDF del boleto por WhatsApp Web al número ${telefono}?`,
      {
        type: "info",
        title: "Enviar por WhatsApp",
      },
    );
    if (!confirmado) {
      return;
    }

    try {
      setReenviando(true);

      // Enviar PDF directamente por WhatsApp Web
      const response = await api.post(
        `/compras/${compraId}/enviar-whatsapp-web`,
      );

      if (response.data.success) {
        showAlert(
          `PDF enviado exitosamente por WhatsApp Web a ${response.data.telefono}`,
          { type: "success" },
        );
      } else {
        // Si WhatsApp Web no está listo, mostrar el código QR o instrucciones
        if (response.data.qrCode) {
          showAlert(
            "WhatsApp Web no está conectado.\n\n" +
              "Por favor, escanea el código QR que aparece en la consola del servidor.\n\n" +
              "Luego intenta enviar el PDF nuevamente.",
            { type: "warning", title: "WhatsApp Web no conectado" },
          );
        } else {
          showAlert(
            response.data.message || "Error al enviar el PDF por WhatsApp Web",
            { type: "error" },
          );
        }
      }
    } catch (error) {
      console.error("Error al enviar PDF por WhatsApp Web:", error);
      const errorMessage =
        error.response?.data?.message ||
        "Error al enviar el PDF por WhatsApp Web";

      if (error.response?.data?.qrCode) {
        showAlert(
          "WhatsApp Web no está conectado.\n\n" +
            "Por favor, escanea el código QR que aparece en la consola del servidor.\n\n" +
            "Luego intenta enviar el PDF nuevamente.",
          { type: "warning", title: "WhatsApp Web no conectado" },
        );
      } else {
        showAlert(errorMessage, { type: "error" });
      }
    } finally {
      setReenviando(false);
    }
  };

  const eliminarCompra = async (compraId) => {
    const confirmado1 = await showConfirm(
      "¿Estás seguro de ELIMINAR COMPLETAMENTE esta compra y todas sus entradas?\n\n" +
        "Esto eliminará:\n" +
        "- La compra de la base de datos\n" +
        "- Todos los registros de compras_asientos\n" +
        "- Todos los registros de compras_mesas\n" +
        "- Liberará todos los asientos ocupados\n\n" +
        "Esta acción NO se puede deshacer.",
      {
        type: "warning",
        title: "⚠️ Confirmar Eliminación",
        confirmText: "Sí, eliminar",
      },
    );
    if (!confirmado1) {
      return;
    }

    // Confirmación adicional
    const confirmado2 = await showConfirm(
      "ÚLTIMA CONFIRMACIÓN:\n\n" +
        "¿Realmente deseas eliminar esta compra y todas sus relaciones permanentemente?",
      {
        type: "error",
        title: "⚠️ Última Confirmación",
        confirmText: "Sí, eliminar definitivamente",
      },
    );
    if (!confirmado2) {
      return;
    }

    try {
      setEliminando(true);
      const response = await api.delete(`/compras/${compraId}`);
      if (response.data.success) {
        showAlert(
          "Compra y todas sus entradas eliminadas exitosamente. Los asientos han sido liberados.",
          { type: "success" },
        );
        cargarCompras();
        setMostrarDetalle(false);
        setCompraSeleccionada(null);
      } else {
        showAlert(response.data.message || "Error al eliminar la compra", {
          type: "error",
        });
      }
    } catch (error) {
      console.error("Error al eliminar compra:", error);
      showAlert(
        error.response?.data?.message || "Error al eliminar la compra",
        { type: "error" },
      );
    } finally {
      setEliminando(false);
    }
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return "-";
    const date = new Date(fecha);
    return date.toLocaleDateString("es-ES", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getEstadoBadge = (estado) => {
    const estados = {
      PAGO_PENDIENTE: { label: "Pago Pendiente", class: "badge-pendiente" },
      PAGO_REALIZADO: { label: "Pago Realizado", class: "badge-realizado" },
      CANCELADO: { label: "Cancelado", class: "badge-cancelado" },
      ENTRADA_USADA: { label: "Entrada Usada", class: "badge-usada" },
    };
    const estadoInfo = estados[estado] || {
      label: estado,
      class: "badge-default",
    };
    return (
      <span className={`badge ${estadoInfo.class}`}>{estadoInfo.label}</span>
    );
  };

  return (
    <div className="admin-page compras-page">
      <div className="admin-content">
        <div className="compras-header">
          <div>
            <h1>Gestión de Compras y Ventas</h1>
            <p>Historial de ventas y tickets confirmados</p>
          </div>
        </div>

        {/* Barra de Búsqueda Moderna */}
        <div className="busqueda-section">
          <div className="busqueda-box">
            <div className="busqueda-input-wrapper">
              <span className="busqueda-icon">🔍</span>
              <input
                type="text"
                placeholder="Buscar por mesa (ej: 5, M-05), cliente, teléfono o código..."
                value={codigoBusqueda}
                onChange={(e) => setCodigoBusqueda(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && buscarPorCodigo()}
                className="busqueda-input-modern"
              />
              {codigoBusqueda && (
                <button
                  type="button"
                  onClick={() => {
                    setCodigoBusqueda("");
                    setBusquedaActiva("");
                    setPage(1);
                  }}
                  className="busqueda-clear-btn"
                  title="Limpiar búsqueda"
                >
                  ✕
                </button>
              )}
            </div>
            <button onClick={buscarPorCodigo} className="btn-buscar-modern">
              Buscar
            </button>
          </div>
        </div>

        {/* Panel de Filtros Moderno */}
        <div className="filtros-card">
          <div className="filtros-header">
            <span className="filtros-title">⚙️ Filtros de búsqueda</span>
            {(filtroEstado || eventoFiltro || filtroTipoPago || fechaDesde || fechaHasta) && (
              <button
                type="button"
                onClick={() => {
                  setFiltroEstado("");
                  setEventoFiltro("");
                  setFiltroTipoPago("");
                  setFechaDesde("");
                  setFechaHasta("");
                  setPage(1);
                }}
                className="btn-limpiar-filtros"
              >
                ✕ Limpiar filtros
              </button>
            )}
          </div>
          <div className="filtros-grid">
            <div className="filtro-item">
              <label>Evento:</label>
              <select
                value={eventoFiltro}
                onChange={(e) => { setEventoFiltro(e.target.value); setPage(1); }}
                className="select-filtro-modern"
              >
                <option value="">Todos los eventos</option>
                <option value="activo">Evento activo (próximo)</option>
                {listaEventos.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.titulo || `Evento #${ev.id}`}
                    {ev.hora_inicio
                      ? ` — ${new Date(ev.hora_inicio).toLocaleDateString("es-ES")}`
                      : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="filtro-item">
              <label>Estado:</label>
              <select
                value={filtroEstado}
                onChange={(e) => { setFiltroEstado(e.target.value); setPage(1); }}
                className="select-filtro-modern"
              >
                <option value="">Ventas Confirmadas (Pagadas)</option>
                <option value="PAGO_REALIZADO">Pago Realizado</option>
                <option value="ENTRADA_USADA">Entrada Usada (Ingresada)</option>
                <option value="TODOS_INCLUYE_PENDIENTES">Ver Todo (incluye intentos)</option>
              </select>
            </div>

            <div className="filtro-item">
              <label>Tipo de Pago:</label>
              <select
                value={filtroTipoPago}
                onChange={(e) => { setFiltroTipoPago(e.target.value); setPage(1); }}
                className="select-filtro-modern"
              >
                <option value="">Todos los pagos</option>
                <option value="QR">QR</option>
                <option value="EFECTIVO">Efectivo</option>
                <option value="PASARELA">Pasarela</option>
              </select>
            </div>

            <div className="filtro-item">
              <label>Desde:</label>
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => { setFechaDesde(e.target.value); setPage(1); }}
                className="select-filtro-modern"
              />
            </div>

            <div className="filtro-item">
              <label>Hasta:</label>
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => { setFechaHasta(e.target.value); setPage(1); }}
                className="select-filtro-modern"
              />
            </div>
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}

        {loading ? (
          <div className="loading">Cargando compras...</div>
        ) : mostrarDetalle && compraSeleccionada ? (
          <div className="detalle-compra">
            <div className="detalle-header">
              <h2>Detalle de Compra</h2>
              <button
                onClick={() => {
                  setMostrarDetalle(false);
                  setCompraSeleccionada(null);
                }}
                className="btn-cerrar"
              >
                ✕ Cerrar
              </button>
            </div>

            <div className="detalle-content">
              <div className="detalle-section">
                <h3>Información General</h3>
                <div className="info-grid">
                  <div>
                    <strong>Código Único:</strong>
                    <div className="codigo-display">
                      <span>{compraSeleccionada.codigo_unico}</span>
                      <button
                        onClick={() =>
                          copiarCodigo(compraSeleccionada.codigo_unico)
                        }
                        className="btn-copiar"
                      >
                        📋 Copiar
                      </button>
                    </div>
                  </div>
                  <div>
                    <strong>Estado:</strong>{" "}
                    {getEstadoBadge(compraSeleccionada.estado)}
                  </div>
                  {(compraSeleccionada.tipo_venta === "REGALO_ADMIN" ||
                    compraSeleccionada.tipo_venta === "OFERTA_ADMIN") && (
                    <div>
                      <strong>Tipo venta:</strong>{" "}
                      {compraSeleccionada.tipo_venta === "REGALO_ADMIN"
                        ? "🎁 Regalo Admin"
                        : "🏷️ Oferta"}
                    </div>
                  )}
                  <div>
                    <strong>Evento:</strong> {compraSeleccionada.evento_titulo}
                  </div>
                  <div>
                    <strong>Fecha del Evento:</strong>{" "}
                    {formatearFecha(compraSeleccionada.evento_fecha)}
                  </div>
                  <div>
                    <strong>Cantidad:</strong> {compraSeleccionada.cantidad}{" "}
                    entrada(s)
                  </div>
                  <div>
                    <strong>
                      Total{compraSeleccionada.cupon_id ? " (con cupón)" : ""}:
                    </strong>{" "}
                    {compraSeleccionada.tipo_venta === "REGALO_ADMIN" ? (
                      <span style={{ color: "#28a745", fontWeight: 600 }}>
                        Gratis (Regalo Admin)
                      </span>
                    ) : compraSeleccionada.tipo_venta === "OFERTA_ADMIN" &&
                      compraSeleccionada.precio_original ? (
                      <span>
                        ${parseFloat(compraSeleccionada.total).toFixed(2)} BOB{" "}
                        <small>
                          (orig. $
                          {parseFloat(
                            compraSeleccionada.precio_original,
                          ).toFixed(2)}
                          )
                        </small>
                      </span>
                    ) : compraSeleccionada.cupon_id &&
                      (compraSeleccionada.descuento_cupon != null ||
                        compraSeleccionada.precio_original != null) ? (
                      <span>
                        <span style={{ display: "block", marginBottom: 4 }}>
                          <strong>Precio sin cupón:</strong> $
                          {parseFloat(
                            compraSeleccionada.precio_original ||
                              parseFloat(compraSeleccionada.total || 0) +
                                parseFloat(
                                  compraSeleccionada.descuento_cupon || 0,
                                ),
                          ).toFixed(2)}{" "}
                          BOB
                        </span>
                        {parseFloat(compraSeleccionada.descuento_cupon || 0) >
                          0 && (
                          <span
                            style={{
                              display: "block",
                              marginBottom: 4,
                              color: "#0d9488",
                            }}
                          >
                            <strong>Descuento cupón:</strong> -$
                            {parseFloat(
                              compraSeleccionada.descuento_cupon,
                            ).toFixed(2)}{" "}
                            BOB
                          </span>
                        )}
                        <span
                          style={{
                            color: "#16a34a",
                            fontWeight: 700,
                            fontSize: "1.1em",
                          }}
                        >
                          Total a verificar (pago): $
                          {parseFloat(compraSeleccionada.total || 0).toFixed(2)}{" "}
                          BOB
                        </span>
                      </span>
                    ) : (
                      <span style={{ color: "#16a34a", fontWeight: 700 }}>
                        ${parseFloat(compraSeleccionada.total || 0).toFixed(2)}{" "}
                        BOB
                      </span>
                    )}
                  </div>
                  <div>
                    <strong>Fecha de Compra:</strong>{" "}
                    {formatearFecha(compraSeleccionada.fecha_compra)}
                  </div>
                </div>
              </div>

              <div className="detalle-section">
                <h3>Datos del Cliente</h3>
                <div className="info-grid">
                  <div>
                    <strong>Nombre:</strong> {compraSeleccionada.cliente_nombre}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      flexWrap: "wrap",
                    }}
                  >
                    <strong>Email:</strong>
                    <span>{compraSeleccionada.cliente_email || "N/A"}</span>
                    {compraSeleccionada.cliente_email && (
                      <button
                        onClick={() =>
                          enviarPorEmail(
                            compraSeleccionada.id,
                            compraSeleccionada.cliente_email,
                            compraSeleccionada.cliente_nombre,
                          )
                        }
                        disabled={reenviando || eliminando}
                        style={{
                          padding: "6px 12px",
                          backgroundColor: "#dc2626",
                          color: "white",
                          border: "none",
                          borderRadius: "5px",
                          cursor: reenviando ? "not-allowed" : "pointer",
                          fontSize: "13px",
                          fontWeight: "bold",
                          display: "flex",
                          alignItems: "center",
                          gap: "5px",
                          opacity: reenviando ? 0.6 : 1,
                        }}
                        title="Enviar boleto por correo electrónico"
                      >
                        📧 {reenviando ? "Enviando..." : "ENVIAR POR EMAIL"}
                      </button>
                    )}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      flexWrap: "wrap",
                    }}
                  >
                    <strong>Teléfono:</strong>
                    <span>{compraSeleccionada.cliente_telefono || "N/A"}</span>
                    {compraSeleccionada.cliente_telefono && (
                      <button
                        onClick={() =>
                          abrirChatWhatsApp(compraSeleccionada.cliente_telefono)
                        }
                        style={{
                          padding: "6px 12px",
                          backgroundColor: "#25D366",
                          color: "white",
                          border: "none",
                          borderRadius: "5px",
                          cursor: "pointer",
                          fontSize: "13px",
                          fontWeight: "bold",
                          display: "flex",
                          alignItems: "center",
                          gap: "5px",
                        }}
                        title="Abrir chat de WhatsApp con este número"
                      >
                        💬 ABRIR CHAT
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {compraSeleccionada.asientos &&
                compraSeleccionada.asientos.length > 0 && (
                  <div className="detalle-section">
                    <h3>
                      Asientos Individuales (
                      {compraSeleccionada.asientos.length})
                    </h3>
                    <div className="asientos-list">
                      {compraSeleccionada.asientos.map((asiento) => (
                        <div key={asiento.id} className="asiento-item">
                          <span>
                            <strong>Asiento:</strong>{" "}
                            {asiento.codigo_asiento || asiento.numero_asiento}
                          </span>
                          {asiento.numero_mesa && (
                            <span>
                              <strong>Mesa:</strong> {asiento.numero_mesa}
                            </span>
                          )}
                          {asiento.tipo_precio_nombre && (
                            <span>
                              <strong>Tipo:</strong>{" "}
                              {asiento.tipo_precio_nombre}
                            </span>
                          )}
                          {asiento.area_nombre && (
                            <span>
                              <strong>Área:</strong> {asiento.area_nombre}
                            </span>
                          )}
                          <span>
                            <strong>Precio:</strong> $
                            {parseFloat(asiento.precio).toFixed(2)}
                          </span>
                          <span
                            className={`badge badge-${asiento.estado.toLowerCase()}`}
                          >
                            {asiento.estado}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {compraSeleccionada.mesas &&
                compraSeleccionada.mesas.length > 0 && (
                  <div className="detalle-section">
                    <h3>Mesas Completas ({compraSeleccionada.mesas.length})</h3>
                    <div className="mesas-list">
                      {compraSeleccionada.mesas.map((mesa) => (
                        <div key={mesa.id} className="mesa-item">
                          <span>
                            <strong>Mesa:</strong>{" "}
                            {mesa.codigo_mesa || mesa.numero_mesa}
                          </span>
                          <span>
                            <strong>Cantidad de Sillas:</strong>{" "}
                            {mesa.cantidad_sillas}
                          </span>
                          <span>
                            <strong>Precio Total:</strong> $
                            {parseFloat(mesa.precio_total).toFixed(2)}
                          </span>
                          <span
                            className={`badge badge-${mesa.estado.toLowerCase()}`}
                          >
                            {mesa.estado}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {compraSeleccionada.areas_personas &&
                compraSeleccionada.areas_personas.length > 0 && (
                  <div className="detalle-section">
                    <h3>Zonas generales (personas de pie)</h3>
                    <div className="zonas-list">
                      {compraSeleccionada.areas_personas.map((ap) => (
                        <div key={ap.id} className="zona-item">
                          <span>
                            <strong>Zona:</strong>{" "}
                            {ap.area_nombre || `Área ${ap.area_id}`}
                          </span>
                          <span>
                            <strong>Cantidad:</strong> {ap.cantidad} persona(s)
                          </span>
                          <span>
                            <strong>Precio:</strong> $
                            {parseFloat(ap.precio_total || 0).toFixed(2)}
                          </span>
                          <span
                            className={`badge badge-${(ap.estado || "").toLowerCase()}`}
                          >
                            {ap.estado}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {((compraSeleccionada.entradas_generales &&
                compraSeleccionada.entradas_generales.length > 0) ||
                (compraSeleccionada.detalle_general &&
                  compraSeleccionada.detalle_general.length > 0)) && (
                <div className="detalle-section">
                  <h3>Tipos de entrada comprados</h3>
                  <div className="entradas-generales-resumen">
                    {compraSeleccionada.entradas_generales &&
                    compraSeleccionada.entradas_generales.length > 0
                      ? (() => {
                          const porTipo = {};
                          compraSeleccionada.entradas_generales.forEach(
                            (eg) => {
                              const nombre =
                                eg.tipo_precio_nombre ||
                                eg.area_nombre ||
                                "General";
                              if (!porTipo[nombre]) porTipo[nombre] = [];
                              porTipo[nombre].push(eg);
                            },
                          );
                          return Object.entries(porTipo).map(
                            ([tipo, entradas]) => (
                              <div
                                key={tipo}
                                className="entradas-tipo-item"
                                style={{
                                  marginBottom: "12px",
                                  padding: "8px 12px",
                                  background: "#f8f9fa",
                                  borderRadius: "8px",
                                }}
                              >
                                <strong>{tipo}:</strong> {entradas.length}{" "}
                                entrada(s)
                                {entradas.some((e) => e.codigo_escaneo) && (
                                  <div
                                    style={{
                                      fontSize: "0.9rem",
                                      marginTop: "4px",
                                      color: "#555",
                                    }}
                                  >
                                    Códigos:{" "}
                                    {entradas
                                      .map((e) => e.codigo_escaneo)
                                      .filter(Boolean)
                                      .join(", ")}
                                  </div>
                                )}
                              </div>
                            ),
                          );
                        })()
                      : compraSeleccionada.detalle_general.map((dg) => (
                          <div
                            key={dg.id}
                            className="entradas-tipo-item"
                            style={{
                              marginBottom: "12px",
                              padding: "8px 12px",
                              background: "#f8f9fa",
                              borderRadius: "8px",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              flexWrap: "wrap",
                              gap: "8px",
                            }}
                          >
                            <span>
                              <strong>
                                {dg.tipo_precio_nombre || "Entrada"}:
                              </strong>{" "}
                              {dg.cantidad} entrada(s)
                            </span>
                            {dg.precio != null && (
                              <span
                                style={{ color: "#0d6efd", fontWeight: 600 }}
                              >
                                Bs.{" "}
                                {(
                                  parseFloat(dg.precio) * (dg.cantidad || 0)
                                ).toFixed(2)}
                              </span>
                            )}
                          </div>
                        ))}
                  </div>
                </div>
              )}

              <div className="detalle-actions">
                {compraSeleccionada.estado === "PAGO_PENDIENTE" && (
                  <>
                    <button
                      onClick={() => abrirModalTipoPago(compraSeleccionada.id)}
                      className="btn-confirmar"
                      disabled={confirmando || eliminando}
                    >
                      {confirmando ? "Confirmando..." : "✅ Confirmar Pago"}
                    </button>
                    <button
                      onClick={() => habilitarAsientos(compraSeleccionada.id)}
                      className="btn-cancelar"
                      disabled={confirmando || eliminando}
                    >
                      🔄 Habilitar Asientos
                    </button>
                  </>
                )}
                {compraSeleccionada.estado === "PAGO_REALIZADO" && (
                  <>
                    <button
                      onClick={() => descargarPDFBoleto(compraSeleccionada.id)}
                      className="btn-descargar-pdf"
                      style={{
                        padding: "10px 20px",
                        backgroundColor: "#dc2626",
                        color: "white",
                        border: "none",
                        borderRadius: "5px",
                        cursor: "pointer",
                        fontSize: "14px",
                        fontWeight: "bold",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        marginBottom: "10px",
                      }}
                      title="Descargar PDF del boleto"
                    >
                      📄 GENERAR BOLETOS PDF
                    </button>
                    <button
                      onClick={() =>
                        enviarPorMiWhatsApp(
                          compraSeleccionada.id,
                          compraSeleccionada.cliente_telefono,
                          compraSeleccionada.cliente_nombre,
                        )
                      }
                      className="btn-whatsapp-web"
                      disabled={
                        reenviando ||
                        eliminando ||
                        !compraSeleccionada.cliente_telefono
                      }
                    >
                      💬 Enviar por mi WhatsApp
                    </button>
                  </>
                )}
                {isAdmin && isAdmin() && (
                  <button
                    onClick={() => eliminarCompra(compraSeleccionada.id)}
                    className="btn-eliminar"
                    disabled={eliminando || confirmando || reenviando}
                    style={{ marginTop: "10px" }}
                  >
                    {eliminando
                      ? "Eliminando..."
                      : "🗑️ Eliminar Entradas y Todas las Relaciones"}
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="compras-list">
            {compras.length === 0 ? (
              <div className="no-compras">
                <p>No hay compras registradas</p>
              </div>
            ) : (
              <>
                {/* Tabla para desktop */}
                <table className="compras-table compras-table-desktop">
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Cliente</th>
                      <th>Teléfono</th>
                      <th>Evento y Ubicación (Mesas / Asientos)</th>
                      <th>Cantidad</th>
                      <th>Total</th>
                      <th>Estado</th>
                      <th>Fecha</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compras.map((compra) => (
                      <tr key={compra.id}>
                        <td>
                          <div className="codigo-cell">
                            <span className="codigo-text">
                              {compra.codigo_unico}
                            </span>
                            <button
                              onClick={() => copiarCodigo(compra.codigo_unico)}
                              className="btn-copiar-small"
                              title="Copiar código"
                            >
                              📋
                            </button>
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: '#1e293b' }}>
                            {compra.cliente_nombre || 'Sin nombre'}
                          </div>
                          {compra.cliente_email && (
                            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                              {compra.cliente_email}
                            </div>
                          )}
                        </td>
                        <td>
                          {compra.cliente_telefono ? (
                            <a
                              href={`https://wa.me/${compra.cliente_telefono.replace(/[^\d]/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                color: '#059669',
                                textDecoration: 'none',
                                fontWeight: 600,
                                fontSize: '0.9rem'
                              }}
                              title="Abrir WhatsApp"
                            >
                              📱 {compra.cliente_telefono}
                            </a>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>-</span>
                          )}
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: '4px' }}>
                            {compra.evento_titulo}
                          </div>
                          {renderUbicacionCompra(compra)}
                        </td>
                        <td>
                          <span style={{ fontWeight: 600, color: '#334155' }}>
                            {compra.cantidad}
                          </span>
                        </td>
                        <td>
                          <strong style={{ color: '#15803d', fontSize: '0.95rem' }}>
                            Bs. {parseFloat(compra.total).toFixed(2)}
                          </strong>
                        </td>
                        <td>{getEstadoBadge(compra.estado)}</td>
                        <td style={{ fontSize: '0.85rem', color: '#64748b' }}>
                          {formatearFecha(compra.fecha_compra)}
                        </td>
                        <td>
                          <button
                            onClick={() => verDetalle(compra)}
                            className="btn-ver"
                            style={{
                              padding: '6px 14px',
                              borderRadius: '6px',
                              background: '#2563eb',
                              color: 'white',
                              border: 'none',
                              cursor: 'pointer',
                              fontWeight: 600,
                              fontSize: '0.85rem'
                            }}
                          >
                            Ver Detalle
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Vista en tarjetas para pantallas móviles */}
                <div className="compras-cards-mobile">
                  {compras.map((compra) => (
                    <div key={compra.id} className="compra-card">
                      <div className="compra-card-header">
                        <div className="compra-card-codigo">
                          <span className="codigo-text">
                            {compra.codigo_unico}
                          </span>
                          <button
                            onClick={() => copiarCodigo(compra.codigo_unico)}
                            className="btn-copiar-small"
                            title="Copiar código"
                          >
                            📋
                          </button>
                        </div>
                        {getEstadoBadge(compra.estado)}
                      </div>
                      <div className="compra-card-body">
                        <div className="compra-card-row">
                          <span className="compra-card-label">Cliente:</span>
                          <span className="compra-card-value">
                            {compra.cliente_nombre}
                          </span>
                        </div>
                        <div className="compra-card-row">
                          <span className="compra-card-label">Teléfono:</span>
                          <span className="compra-card-value">
                            {compra.cliente_telefono ? (
                              <a
                                href={`https://wa.me/${compra.cliente_telefono.replace(/[^\d]/g, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: '#059669', textDecoration: 'none', fontWeight: 600 }}
                              >
                                📱 {compra.cliente_telefono}
                              </a>
                            ) : (
                              '-'
                            )}
                          </span>
                        </div>
                        <div className="compra-card-row">
                          <span className="compra-card-label">Evento:</span>
                          <span className="compra-card-value">
                            {compra.evento_titulo}
                          </span>
                        </div>

                        {/* Ubicación en móvil */}
                        <div className="compra-card-row">
                          <span className="compra-card-label">Ubicación:</span>
                          <div className="compra-card-value">
                            {renderUbicacionCompra(compra)}
                          </div>
                        </div>

                        <div className="compra-card-row">
                          <span className="compra-card-label">Cantidad:</span>
                          <span className="compra-card-value">
                            {compra.cantidad} entrada(s)
                          </span>
                        </div>
                        <div className="compra-card-row">
                          <span className="compra-card-label">Total:</span>
                          <span className="compra-card-value compra-card-total">
                            Bs. {parseFloat(compra.total).toFixed(2)}
                          </span>
                        </div>
                        <div className="compra-card-row">
                          <span className="compra-card-label">Fecha:</span>
                          <span className="compra-card-value">
                            {formatearFecha(compra.fecha_compra)}
                          </span>
                        </div>
                      </div>
                      <div className="compra-card-footer">
                        <button
                          onClick={() => verDetalle(compra)}
                          className="btn-ver btn-ver-mobile"
                        >
                          Ver Detalle
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Controles de Paginación */}
                {totalPages > 1 && (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '10px',
                    margin: '20px 0 12px 0',
                    padding: '10px',
                    background: '#f8fafc',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0'
                  }}>
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        background: page <= 1 ? '#f1f5f9' : '#ffffff',
                        color: page <= 1 ? '#94a3b8' : '#1e293b',
                        cursor: page <= 1 ? 'not-allowed' : 'pointer',
                        fontWeight: 600,
                        fontSize: '0.9rem'
                      }}
                    >
                      ← Anterior
                    </button>

                    <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#475569' }}>
                      Página {page} de {totalPages} {totalCompras > 0 && `(${totalCompras} compras)`}
                    </span>

                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        background: page >= totalPages ? '#f1f5f9' : '#ffffff',
                        color: page >= totalPages ? '#94a3b8' : '#1e293b',
                        cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                        fontWeight: 600,
                        fontSize: '0.9rem'
                      }}
                    >
                      Siguiente →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <ModalTipoPago
        isOpen={mostrarModalTipoPago}
        onClose={() => {
          if (!confirmando) {
            setMostrarModalTipoPago(false);
            setCompraAConfirmar(null);
          }
        }}
        onSelect={handleSeleccionarTipoPago}
        title="Confirmar Pago"
        disabled={confirmando}
        compraTotal={
          compraSeleccionada?.id === compraAConfirmar
            ? (compraSeleccionada?.total ?? 0)
            : (compras.find((c) => c.id === compraAConfirmar)?.total ?? 0)
        }
        permitirExtrasAdmin={
          !!(canUseAdminSaleOptions && canUseAdminSaleOptions())
        }
      />
    </div>
  );
};

export default Compras;
