import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import { getServerBase } from "../api/base";
import "./PagoQR.css";

// Intervalo de polling para verificar el estado del pago (ms)
const POLL_INTERVAL_MS = 5000;

const PagoQR = () => {
  const { id: eventoId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  // ── Estados principales ───────────────────────────────────────────────────
  const [fase, setFase] = useState("generando"); // generando | esperando | aprobado | expirado | error
  const [qrImagen, setQrImagen]     = useState(null);   // cadena Base64 de Redenlace
  const [qrData, setQrData]         = useState(null);   // { paymentId, origenNumeroReferencia, atcReferencia, monto, tiempoQr }
  const [eventoInfo, setEventoInfo] = useState(null);   // { titulo }
  const [compraInfo, setCompraInfo] = useState(null);   // datos de la compra
  const [errorMsg, setErrorMsg]     = useState("");
  const [segundosRestantes, setSegundosRestantes] = useState(null);

  // Refs para timers
  const pollingRef   = useRef(null);
  const countdownRef = useRef(null);
  const generadoRef  = useRef(false); // evitar doble llamada en StrictMode

  // ── Helpers ───────────────────────────────────────────────────────────────
  const detenerTimers = () => {
    if (pollingRef.current)   clearInterval(pollingRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  };

  const formatearTiempo = (segundos) => {
    if (segundos === null || segundos < 0) return "--:--:--";
    const h = Math.floor(segundos / 3600);
    const m = Math.floor((segundos % 3600) / 60);
    const s = segundos % 60;
    return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
  };

  const formatearMonto = (monto) => {
    const n = parseFloat(monto);
    return isNaN(n) ? "0.00" : n.toFixed(2);
  };

  // ── Polling: consulta estado cada POLL_INTERVAL_MS ───────────────────────
  const iniciarPolling = useCallback((origenRef) => {
    if (pollingRef.current) clearInterval(pollingRef.current);

    pollingRef.current = setInterval(async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${getServerBase()}/qr/verificaQr/${origenRef}`, {
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
        });
        const data = await res.json();
        const estado = data?.data?.estado;

        if (estado === "approved") {
          detenerTimers();
          setFase("aprobado");
        } else if (estado === "expired" || estado === "cancelled" || estado === "rejected") {
          detenerTimers();
          setFase("expirado");
        }
      } catch (e) {
        // Error de red: continuar polling silenciosamente
        console.warn("[PagoQR] Error en polling:", e.message);
      }
    }, POLL_INTERVAL_MS);
  }, []);

  // ── Countdown del tiempo de vigencia ─────────────────────────────────────
  const iniciarCountdown = useCallback((tiempoQrStr) => {
    // tiempoQrStr = "HH:MM:SS"
    const partes = (tiempoQrStr || "24:00:00").split(":").map(Number);
    const totalSeg = (partes[0] || 0) * 3600 + (partes[1] || 0) * 60 + (partes[2] || 0);
    setSegundosRestantes(totalSeg);

    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setSegundosRestantes((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          setFase((f) => (f === "esperando" ? "expirado" : f));
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // ── Generación del QR ─────────────────────────────────────────────────────
  const generarQR = useCallback(async () => {
    const compraId   = localStorage.getItem("compraId");
    const totalGuard = localStorage.getItem("totalCompra");
    const cantGuard  = localStorage.getItem("cantidadCompra");
    const eventoJSON = localStorage.getItem("eventoCompra");

    if (!compraId || !totalGuard || !eventoId) {
      setErrorMsg("No se encontraron datos de la compra. Por favor, vuelve al inicio.");
      setFase("error");
      return;
    }

    // Datos del evento desde localStorage (para mostrar el título)
    try {
      if (eventoJSON) setEventoInfo(JSON.parse(eventoJSON));
    } catch (_) {}

    // Datos de la compra
    try {
      const resCom = await api.get(`/compras/codigo/${localStorage.getItem("codigoCompra")}`);
      if (resCom.data?.success) setCompraInfo(resCom.data.data);
    } catch (_) {}

    // ─── Llamada correcta: la ruta /qr/generar está fuera de /api ─────────
    // Usamos fetch directo con getServerBase() para evitar 404 en el proxy de Vite
    const token = localStorage.getItem("token");
    const eventoData = eventoJSON ? JSON.parse(eventoJSON) : {};

    const response = await fetch(`${getServerBase()}/qr/generar`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        compra_id: parseInt(compraId, 10),
        eventoId: parseInt(eventoId, 10),
        cantidad: parseInt(cantGuard || "1", 10),
        total: parseFloat(totalGuard),
        descripcion: `Entradas ${eventoData.titulo || "evento"}`.substring(0, 40),
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.message || `Error ${response.status}`);
    }

    const data = await response.json();

    if (!data.success || !data.data?.imagen) {
      throw new Error(data.message || "La pasarela no devolvió imagen QR");
    }

    const { imagen, tiempoQr, origenNumeroReferencia } = data.data;

    setQrImagen(imagen);
    setQrData(data.data);
    setFase("esperando");

    iniciarCountdown(tiempoQr || "24:00:00");
    iniciarPolling(origenNumeroReferencia.toString());
  }, [eventoId, iniciarCountdown, iniciarPolling]);

  // ── Efecto principal ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated()) {
      navigate("/login");
      return;
    }
    if (generadoRef.current) return;
    generadoRef.current = true;

    generarQR().catch((err) => {
      console.error("[PagoQR] Error al generar QR:", err);
      setErrorMsg(err.message || "No se pudo generar el QR. Intenta nuevamente.");
      setFase("error");
    });

    return () => detenerTimers();
  }, [isAuthenticated, navigate, generarQR]);

  // ── Verificación manual ───────────────────────────────────────────────────
  const verificarManual = async () => {
    if (!qrData?.origenNumeroReferencia) return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${getServerBase()}/qr/verificaQr/${qrData.origenNumeroReferencia}`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const data = await res.json();
      const estado = data?.data?.estado;
      if (estado === "approved") {
        detenerTimers();
        setFase("aprobado");
      } else if (estado === "expired" || estado === "cancelled" || estado === "rejected") {
        detenerTimers();
        setFase("expirado");
      } else {
        // Todavía pendiente
        alert("El pago aún está pendiente. Por favor, escanea el QR y completa el pago.");
      }
    } catch (e) {
      alert("No se pudo verificar el estado. Intenta nuevamente.");
    }
  };

  const irAMisCompras = () => {
    // Limpiar localStorage
    ["codigoCompra","compraId","eventoCompra","cantidadCompra","totalCompra","formDataCompra","seleccionesCompra"].forEach(
      (k) => localStorage.removeItem(k)
    );
    navigate("/mis-compras");
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Fase: generando ───────────────────────────────────────────────────────
  if (fase === "generando") {
    return (
      <div className="pago-qr-page">
        <div className="pqr-center">
          <div className="pqr-card pqr-generando">
            <div className="pqr-spinner" />
            <h2>Generando tu QR de pago…</h2>
            <p>Conectando con la pasarela de pagos Redenlace</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Fase: error ───────────────────────────────────────────────────────────
  if (fase === "error") {
    return (
      <div className="pago-qr-page">
        <div className="pqr-center">
          <div className="pqr-card pqr-error-card">
            <div className="pqr-icon pqr-icon-error">✕</div>
            <h2>No se pudo generar el QR</h2>
            <p>{errorMsg}</p>
            <button className="pqr-btn pqr-btn-secondary" onClick={() => navigate(-1)}>
              ← Volver
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Fase: aprobado ────────────────────────────────────────────────────────
  if (fase === "aprobado") {
    return (
      <div className="pago-qr-page">
        <div className="pqr-center">
          <div className="pqr-card pqr-aprobado-card">
            <div className="pqr-icon pqr-icon-success">✓</div>
            <h2>¡Pago recibido!</h2>
            <p className="pqr-subtitle">Tu compra ha sido confirmada exitosamente.</p>

            {compraInfo && (
              <div className="pqr-resumen">
                <div className="pqr-resumen-row">
                  <span>Evento</span>
                  <strong>{compraInfo.evento_titulo || eventoInfo?.titulo || "—"}</strong>
                </div>
                <div className="pqr-resumen-row">
                  <span>Entradas</span>
                  <strong>{compraInfo.cantidad}</strong>
                </div>
                <div className="pqr-resumen-row">
                  <span>Total pagado</span>
                  <strong>{formatearMonto(compraInfo.total)} BOB</strong>
                </div>
                <div className="pqr-resumen-row">
                  <span>Código</span>
                  <strong className="pqr-codigo">{compraInfo.codigo_unico}</strong>
                </div>
              </div>
            )}

            <p className="pqr-info-boleto">
              Tu boleto está siendo generado. Puedes descargarlo desde <strong>Mis Compras</strong>.
            </p>

            <button className="pqr-btn pqr-btn-primary" onClick={irAMisCompras}>
              Ver mis entradas →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Fase: expirado ────────────────────────────────────────────────────────
  if (fase === "expirado") {
    return (
      <div className="pago-qr-page">
        <div className="pqr-center">
          <div className="pqr-card pqr-expirado-card">
            <div className="pqr-icon pqr-icon-warning">⏱</div>
            <h2>QR expirado o cancelado</h2>
            <p>El tiempo de pago venció. Puedes volver e intentarlo de nuevo.</p>
            <button className="pqr-btn pqr-btn-secondary" onClick={() => navigate(-1)}>
              ← Intentar de nuevo
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Fase: esperando (QR activo) ───────────────────────────────────────────
  const porcentaje = qrData?.tiempoQr
    ? (() => {
        const total = (parseInt(qrData.tiempoQr.split(":")[0], 10) || 24) * 3600;
        return Math.max(0, Math.min(100, (segundosRestantes / total) * 100));
      })()
    : 100;

  return (
    <div className="pago-qr-page">
      <div className="pqr-layout">
        {/* ── Panel izquierdo: QR ─────────────────────────────────────── */}
        <div className="pqr-panel-qr">
          <div className="pqr-card">
            {/* Encabezado */}
            <div className="pqr-header">
              <div className="pqr-logo-redenlace">Redenlace QR</div>
              <div className="pqr-ambiente">🔐 Ambiente: {qrData?.ambiente || "TEST"}</div>
            </div>

            {/* Imagen QR */}
            <div className="pqr-qr-wrapper">
              {qrImagen ? (
                <img
                  src={`data:image/png;base64,${qrImagen}`}
                  alt="Código QR de pago"
                  className="pqr-qr-image"
                />
              ) : (
                <div className="pqr-spinner" />
              )}
            </div>

            {/* Monto */}
            {qrData?.monto && (
              <div className="pqr-monto">
                <span className="pqr-monto-label">Monto a pagar</span>
                <span className="pqr-monto-valor">
                  {formatearMonto(qrData.monto)} <span className="pqr-moneda">BOB</span>
                </span>
              </div>
            )}

            {/* Countdown */}
            <div className="pqr-countdown">
              <div className="pqr-countdown-label">Vigencia del QR</div>
              <div className="pqr-countdown-timer">{formatearTiempo(segundosRestantes)}</div>
              <div className="pqr-progress-bar">
                <div className="pqr-progress-fill" style={{ width: `${porcentaje}%` }} />
              </div>
            </div>

            {/* Estado */}
            <div className="pqr-estado">
              <div className="pqr-pulse" />
              <span>Esperando pago…</span>
            </div>
          </div>
        </div>

        {/* ── Panel derecho: instrucciones y resumen ──────────────────── */}
        <div className="pqr-panel-info">
          {/* Resumen de la compra */}
          <div className="pqr-card">
            <h2 className="pqr-titulo">Resumen de compra</h2>

            {eventoInfo && (
              <div className="pqr-resumen">
                <div className="pqr-resumen-row">
                  <span>Evento</span>
                  <strong>{eventoInfo.titulo}</strong>
                </div>
                <div className="pqr-resumen-row">
                  <span>Entradas</span>
                  <strong>{localStorage.getItem("cantidadCompra") || "—"}</strong>
                </div>
                <div className="pqr-resumen-row pqr-resumen-total">
                  <span>Total</span>
                  <strong>{formatearMonto(localStorage.getItem("totalCompra"))} BOB</strong>
                </div>
              </div>
            )}

            {qrData?.origenNumeroReferencia && (
              <div className="pqr-ref">
                <span>Ref. comercio</span>
                <code>{qrData.origenNumeroReferencia}</code>
              </div>
            )}
            {qrData?.atcReferencia && (
              <div className="pqr-ref">
                <span>Ref. ATC</span>
                <code>{qrData.atcReferencia}</code>
              </div>
            )}
          </div>

          {/* Instrucciones */}
          <div className="pqr-card pqr-instrucciones-card">
            <h3>¿Cómo pagar?</h3>
            <ol className="pqr-pasos">
              <li>
                <span className="pqr-paso-num">1</span>
                <span>Abre tu app bancaria (cualquier banco Bolivia)</span>
              </li>
              <li>
                <span className="pqr-paso-num">2</span>
                <span>Busca la opción <strong>Pago QR</strong> o <strong>Escanear QR</strong></span>
              </li>
              <li>
                <span className="pqr-paso-num">3</span>
                <span>Escanea el código QR de la izquierda</span>
              </li>
              <li>
                <span className="pqr-paso-num">4</span>
                <span>Confirma el monto de <strong>{formatearMonto(qrData?.monto)} BOB</strong></span>
              </li>
              <li>
                <span className="pqr-paso-num">5</span>
                <span>Esta página se actualizará automáticamente al recibir tu pago</span>
              </li>
            </ol>
          </div>

          {/* Verificación manual */}
          <div className="pqr-card pqr-verificar-card">
            <p>¿Ya realizaste el pago y no se actualizó automáticamente?</p>
            <button className="pqr-btn pqr-btn-verificar" onClick={verificarManual}>
              🔄 Verificar estado del pago
            </button>
          </div>

          {/* Cancelar */}
          <button className="pqr-btn pqr-btn-ghost" onClick={() => navigate('/mis-compras')}>
            ❌ Cancelar Compra
          </button>
        </div>
      </div>
    </div>
  );
};

export default PagoQR;
