import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { ruletaAudio } from '../utils/ruletaAudio';
import JuegoImpostor from './JuegoImpostor';
import './JuegoRuleta.css';

// Diccionario de nombres y emojis de objetos
const OBJETOS_INFO = {
  SALUD: { nombre: 'Inyección de Sangre', emoji: '💉', desc: '+1 vida' },
  DOBLE_DANO: { nombre: 'Sierra Maldita', emoji: '🪚', desc: '×2 daño en próx. disparo' },
  ESCUDO: { nombre: 'Placa Blindada', emoji: '🛡️', desc: 'Bloquea el sig. daño' },
  VISTA: { nombre: 'Lupa Forense', emoji: '🔎', desc: 'Mira el cartucho en recámara' }
};

// 8 Personajes de Terror con lore macabro y títulos siniestros
export const PERSONAJES_TERROR = [
  { id: 'segador', nombre: 'El Segador', emoji: '💀', titulo: 'Heraldo de la Muerte', color: '#dc2626' },
  { id: 'titiritero', nombre: 'El Titiritero', emoji: '🎭', titulo: 'Manipulador Macabro', color: '#9333ea' },
  { id: 'carnicero', nombre: 'El Carnicero', emoji: '🩸', titulo: 'Descuartizador', color: '#b91c1c' },
  { id: 'hereje', nombre: 'El Hereje', emoji: '👁️', titulo: 'Ojo Maldito', color: '#4f46e5' },
  { id: 'verdugo', nombre: 'El Verdugo', emoji: '🪓', titulo: 'Sin Piedad', color: '#4b5563' },
  { id: 'espectro', nombre: 'El Espectro', emoji: '🩻', titulo: 'Alma en Pena', color: '#0284c7' },
  { id: 'viuda', nombre: 'La Viuda Negra', emoji: '🕷️', titulo: 'Veneno Letal', color: '#701a75' },
  { id: 'impostor', nombre: 'El Impostor', emoji: '👺', titulo: 'Demonio Rojo', color: '#ea580c' }
];

/**
 * Componente gráfico vectorial de la Escopeta Recortada Realista (Buckshot Roulette)
 */
function EscopetaRealistaSVG({ recoil, disparandoFuego }) {
  return (
    <svg viewBox="0 0 280 70" className={`escopeta-svg-render ${recoil ? 'recoil-fire' : ''}`}>
      <defs>
        <linearGradient id="gunMetal" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#4a4d52" />
          <stop offset="45%" stopColor="#22252a" />
          <stop offset="70%" stopColor="#14171a" />
          <stop offset="100%" stopColor="#32353b" />
        </linearGradient>
        <linearGradient id="darkWood" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#6e2d1b" />
          <stop offset="40%" stopColor="#4a1c10" />
          <stop offset="85%" stopColor="#2b1008" />
          <stop offset="100%" stopColor="#1a0a05" />
        </linearGradient>
        <linearGradient id="brassGold" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#d97706" />
          <stop offset="50%" stopColor="#fef08a" />
          <stop offset="100%" stopColor="#92400e" />
        </linearGradient>
        <radialGradient id="muzzleFire" cx="20%" cy="50%" r="80%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="30%" stopColor="#fef08a" />
          <stop offset="65%" stopColor="#ea580c" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>

      {/* LLAMARADA Y CHISPAS EN LA BOCA DEL CAÑÓN (AL DISPARAR) */}
      {disparandoFuego && (
        <g className="muzzle-blast-flash">
          <ellipse cx="270" cy="27" rx="35" ry="24" fill="url(#muzzleFire)" />
          <polygon points="265,27 305,12 285,27 315,35 270,38" fill="#fbbf24" opacity="0.9" />
          <circle cx="280" cy="18" r="3" fill="#ffffff" />
          <circle cx="295" cy="38" r="2.5" fill="#f97316" />
        </g>
      )}

      {/* 1. Culata recortada de madera noble oscura */}
      <path
        d="M 5 36 C 5 28, 18 24, 45 25 L 85 27 L 85 45 L 50 56 C 25 58, 8 50, 5 36 Z"
        fill="url(#darkWood)"
        stroke="#1a0a05"
        strokeWidth="1.5"
      />
      <line x1="18" y1="32" x2="60" y2="35" stroke="#3b150c" strokeWidth="1" strokeDasharray="6,4" />
      <circle cx="25" cy="40" r="2" fill="#71717a" stroke="#18181b" strokeWidth="0.8" />
      <circle cx="65" cy="38" r="2" fill="#71717a" stroke="#18181b" strokeWidth="0.8" />

      {/* 2. Guardamonte y gatillo de acero */}
      <path d="M 68 44 Q 72 58, 82 54 L 84 44 Z" fill="none" stroke="#52525b" strokeWidth="2.5" />
      <path d="M 74 44 Q 75 51, 78 49" fill="none" stroke="#d4d4d8" strokeWidth="2" />

      {/* 3. Receptor central / Caja de mecanismos */}
      <rect x="85" y="22" width="60" height="24" rx="2" fill="url(#gunMetal)" stroke="#09090b" strokeWidth="1.5" />
      {/* Ventana de expulsión de cartuchos */}
      <rect x="98" y="24" width="28" height="10" rx="1.5" fill="#18181b" stroke="#3f3f46" strokeWidth="1" />
      <rect x="102" y="26" width="16" height="6" fill="url(#brassGold)" />
      <circle cx="92" cy="34" r="2" fill="#71717a" />
      <circle cx="138" cy="34" r="2" fill="#71717a" />

      {/* 4. Cañones dobles de acero negro */}
      <rect x="145" y="22" width="118" height="11" fill="url(#gunMetal)" stroke="#09090b" strokeWidth="1" />
      <rect x="145" y="32" width="102" height="9" fill="url(#gunMetal)" stroke="#09090b" strokeWidth="1" />
      <rect x="238" y="20" width="8" height="23" rx="1" fill="#3f3f46" stroke="#09090b" strokeWidth="1" />
      <circle cx="242" cy="31" r="1.5" fill="#a1a1aa" />
      <ellipse cx="263" cy="27.5" rx="2.5" ry="5.5" fill="#09090b" stroke="#52525b" strokeWidth="1" />

      {/* 5. Corredera de bombeo de madera acanalada */}
      <rect x="150" y="30" width="46" height="15" rx="3" fill="url(#darkWood)" stroke="#1a0a05" strokeWidth="1.2" />
      <line x1="158" y1="31" x2="158" y2="44" stroke="#1a0a05" strokeWidth="1.5" />
      <line x1="165" y1="31" x2="165" y2="44" stroke="#1a0a05" strokeWidth="1.5" />
      <line x1="172" y1="31" x2="172" y2="44" stroke="#1a0a05" strokeWidth="1.5" />
      <line x1="179" y1="31" x2="179" y2="44" stroke="#1a0a05" strokeWidth="1.5" />
      <line x1="186" y1="31" x2="186" y2="44" stroke="#1a0a05" strokeWidth="1.5" />
      <path d="M 258 22 L 260 19 L 261 22 Z" fill="#d4d4d8" />
    </svg>
  );
}

export default function JuegoRuleta() {
  const [juegoActivo, setJuegoActivo] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('impostor') || params.get('sala_impostor') || params.get('modo') === 'impostor') {
      return 'impostor';
    }
    return 'ruleta';
  });

  const [socket, setSocket] = useState(null);
  const [conectado, setConectado] = useState(false);

  // Estados de lobby
  const [nombreJugador, setNombreJugador] = useState(() => localStorage.getItem('ruleta_nombre') || '');
  const [personajeSeleccionado, setPersonajeSeleccionado] = useState(PERSONAJES_TERROR[0]);
  const [nombreSala, setNombreSala] = useState('');
  const [codigoInput, setCodigoInput] = useState('');
  const [vidaInicial, setVidaInicial] = useState(5);
  const [maxJugadores, setMaxJugadores] = useState(8);
  const [tabLobby, setTabLobby] = useState('crear');
  const [errorMsg, setErrorMsg] = useState('');

  // Estado del juego
  const [sala, setSala] = useState(null);
  const [flashScreen, setFlashScreen] = useState(null);
  const [screenShake, setScreenShake] = useState(false);
  const [bloodSplatter, setBloodSplatter] = useState(false);
  const [shotgunRecoil, setShotgunRecoil] = useState(false);
  const [disparandoFuego, setDisparandoFuego] = useState(false);
  const [shotgunAngle, setShotgunAngle] = useState(0);

  // Puntería y aviso de disparo vacío
  const [apuntandoAId, setApuntandoAId] = useState(null); // socketId del objetivo fijado
  const [avisoDisparo, setAvisoDisparo] = useState(null); // { tipo: 'cargado' | 'vacio', texto: string, subtexto: string }

  // Modales
  const [modalElegirRival, setModalElegirRival] = useState(false);
  const [infoSecretaVista, setInfoSecretaVista] = useState(null);
  const [musicaActiva, setMusicaActiva] = useState(false);
  const [efectosActivos, setEfectosActivos] = useState(true);
  const [copiadoFeedback, setCopiadoFeedback] = useState(false);

  // Referencia de turno para alertas
  const prevTurnoRef = useRef(null);

  // Conexión Socket.IO
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const salaUrl = params.get('sala');
    if (salaUrl) {
      setCodigoInput(salaUrl.toUpperCase());
      setTabLobby('unirse');
    }

    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const backendUrl = (isLocal && window.location.port === '3000')
      ? `http://${window.location.hostname}:5000/ruleta`
      : '/ruleta';

    const newSocket = io(backendUrl, {
      path: '/socket.io',
      transports: ['polling', 'websocket']
    });

    newSocket.on('connect', () => {
      console.log('✅ Conectado al servidor de Ruleta');
      setConectado(true);
    });

    newSocket.on('disconnect', () => {
      console.log('🔌 Desconectado de Ruleta');
      setConectado(false);
    });

    newSocket.on('sala_actualizada', (salaData) => {
      setSala(salaData);
    });

    newSocket.on('partida_iniciada', (salaData) => {
      setSala(salaData);
      ruletaAudio.playRecarga();
      // Iniciar música si el usuario lo tenía habilitado
      if (musicaActiva) ruletaAudio.startMusica();
    });

    // 💥 Evento de disparo con mira láser previa, retroceso, fuego y disparo vacío/cargado
    newSocket.on('evento_disparo', ({ resultadoAccion, sala: salaActualizada }) => {
      const objetivoId = resultadoAccion.objetivoId;
      const esCargado = resultadoAccion.esCargado;

      // 1. Efecto de fijar puntería
      setApuntandoAId(objetivoId);
      ruletaAudio.playApuntar();

      // Calcular ángulo de la escopeta y botella hacia el objetivo
      const totalJugadores = salaActualizada.jugadores.length;
      const indexObj = salaActualizada.jugadores.findIndex(j => j.id === objetivoId);
      if (resultadoAccion.tipoAccion === 'DISPARO_PROPIO') {
        setShotgunAngle(180);
      } else if (indexObj !== -1) {
        const step = 360 / Math.max(totalJugadores, 1);
        setShotgunAngle((indexObj * step) - 90);
      }

      // 2. Ejecutar la detonación o clic seco tras 280ms de puntería
      // AUDIO: se dispara ANTES del timeout de visuals para compensar latencia de audio (~30ms)
      setTimeout(() => {
        setSala(salaActualizada);
        setShotgunRecoil(true);

        if (esCargado) {
          // DISPARO CARGADO: audio y visuals al mismo tiempo
          ruletaAudio.playDisparoReal(); // 🔊 Audio primero para compensar latencia
          setDisparandoFuego(true);
          setFlashScreen('red');
          setScreenShake(true);
          setBloodSplatter(true);

          // Grito de dolor si causó daño real (30ms después del disparo)
          if (!resultadoAccion.danoBloqueado && resultadoAccion.danoTotal > 0) {
            const victima = salaActualizada.jugadores.find(j => j.id === objetivoId);
            const esMortal = victima && victima.vida <= 0;
            setTimeout(() => {
              ruletaAudio.playGritoDolor(esMortal);
            }, 300);
          }

          setAvisoDisparo({
            tipo: 'cargado',
            texto: '💥 ¡DISPARO CARGADO!',
            subtexto: resultadoAccion.danoBloqueado
              ? '🛡️ ¡El escudo bloqueó el impacto letal!'
              : `💀 ${resultadoAccion.objetivoNombre} recibió daño (${resultadoAccion.danoTotal} de vida)`
          });

          setTimeout(() => setDisparandoFuego(false), 350);
          setTimeout(() => setScreenShake(false), 650);
          setTimeout(() => setBloodSplatter(false), 1600);

        } else {
          // DISPARO VACÍO / FALLIDO
          ruletaAudio.playClickVacio();
          setFlashScreen('blank');

          setAvisoDisparo({
            tipo: 'vacio',
            texto: '💨 ¡CLIC! DISPARO VACÍO / FALLIDO',
            subtexto: resultadoAccion.conservaTurno
              ? '🛡️ ¡Era cartucho de fogueo! ¡CONSERVAS TU TURNO!'
              : '💨 El cartucho estaba vacío. La escopeta pasó de turno.'
          });
        }

        setTimeout(() => setFlashScreen(null), 420);
        setTimeout(() => setShotgunRecoil(false), 500);
        setTimeout(() => setApuntandoAId(null), 1000);
        setTimeout(() => setAvisoDisparo(null), 3000);

        if (salaActualizada.estado === 'TERMINADA' && salaActualizada.ganador) {
          ruletaAudio.playVictoria();
        }
      }, 280);
    });

    newSocket.on('objeto_usado', ({ tipoObjeto, sala: salaActualizada }) => {
      setSala(salaActualizada);
      if (tipoObjeto === 'SALUD') ruletaAudio.playSalud();
      else if (tipoObjeto === 'ESCUDO') ruletaAudio.playEscudo();
      else if (tipoObjeto === 'DOBLE_DANO') ruletaAudio.playDobleDano();
      else if (tipoObjeto === 'VISTA') ruletaAudio.playVista();
    });

    newSocket.on('informacion_secreta', (info) => {
      setInfoSecretaVista(info);
      ruletaAudio.playVista();
    });

    newSocket.on('partida_reiniciada', (salaData) => {
      setSala(salaData);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
      ruletaAudio.stopMusica();
    };
  }, []);

  // Alerta sonora cuando cambia el turno
  useEffect(() => {
    if (!sala || sala.estado !== 'JUGANDO' || !sala.turnoActualSocketId) return;

    if (prevTurnoRef.current !== sala.turnoActualSocketId) {
      prevTurnoRef.current = sala.turnoActualSocketId;
      const esMiTurno = sala.turnoActualSocketId === socket?.id;
      ruletaAudio.playAlertaTurno(esMiTurno);

      // Si es mi turno y la escopeta apunta a cualquier lado, apuntar levemente hacia el frente
      if (esMiTurno) {
        setShotgunAngle(0);
      }
    }
  }, [sala?.turnoActualSocketId, sala?.estado, socket?.id]);

  // Guardar nombre en localStorage
  useEffect(() => {
    if (nombreJugador.trim()) {
      localStorage.setItem('ruleta_nombre', nombreJugador.trim());
    }
  }, [nombreJugador]);

  // Toggles de audio separados
  const handleToggleMusica = () => {
    const estado = ruletaAudio.toggleMusica();
    setMusicaActiva(estado);
  };

  const handleToggleEfectos = () => {
    const estado = ruletaAudio.toggleEfectos();
    setEfectosActivos(estado);
  };

  // Crear Sala
  const handleCrearSala = (e) => {
    e.preventDefault();
    if (!nombreJugador.trim()) {
      setErrorMsg('Por favor ingresa tu apodo');
      return;
    }
    setErrorMsg('');
    ruletaAudio.init();
    if (musicaActiva) ruletaAudio.startMusica();

    socket.emit('crear_sala', {
      nombreJugador: nombreJugador.trim(),
      nombreSala: nombreSala.trim(),
      vidaInicial,
      maxJugadores,
      personaje: personajeSeleccionado
    }, (res) => {
      if (res?.success) {
        setSala(res.sala);
      } else {
        setErrorMsg(res?.error || 'Error al crear la sala');
      }
    });
  };

  // Unirse a Sala
  const handleUnirseSala = (e) => {
    e.preventDefault();
    if (!nombreJugador.trim()) {
      setErrorMsg('Por favor ingresa tu apodo');
      return;
    }
    if (!codigoInput.trim() || codigoInput.trim().length !== 5) {
      setErrorMsg('Ingresa el código de 5 caracteres');
      return;
    }
    setErrorMsg('');
    ruletaAudio.init();
    if (musicaActiva) ruletaAudio.startMusica();

    socket.emit('unirse_sala', {
      codigo: codigoInput.trim().toUpperCase(),
      nombreJugador: nombreJugador.trim(),
      personaje: personajeSeleccionado
    }, (res) => {
      if (res?.success) {
        setSala(res.sala);
      } else {
        setErrorMsg(res?.error || 'Error al unirse a la sala');
      }
    });
  };

  // Iniciar Partida (Host)
  const handleIniciarPartida = () => {
    if (!sala || !socket) return;
    setErrorMsg('');
    ruletaAudio.init();
    if (musicaActiva) ruletaAudio.startMusica();

    socket.emit('iniciar_partida', { codigo: sala.codigo }, (res) => {
      if (!res?.success) {
        setErrorMsg(res?.error || 'No se pudo iniciar la partida');
      }
    });
  };

  // Disparar a rival
  const handleConfirmarDisparoRival = (objetivoSocketId) => {
    setModalElegirRival(false);
    if (!sala || !socket) return;

    socket.emit('disparar_jugador', {
      codigo: sala.codigo,
      objetivoSocketId
    }, (res) => {
      if (!res?.success) {
        alert(res?.error || 'Acción no permitida');
      }
    });
  };

  // Dispararse a uno mismo
  const handleDispararseASiMismo = () => {
    if (!sala || !socket) return;

    socket.emit('dispararse_a_si_mismo', {
      codigo: sala.codigo
    }, (res) => {
      if (!res?.success) {
        alert(res?.error || 'Acción no permitida');
      }
    });
  };

  // Usar objeto
  const handleUsarObjeto = (tipoObjeto) => {
    if (!sala || !socket) return;
    socket.emit('usar_objeto', {
      codigo: sala.codigo,
      tipoObjeto
    }, (res) => {
      if (!res?.success) {
        alert(res?.error || 'No se pudo usar el objeto');
      }
    });
  };

  // Reiniciar partida (Host)
  const handleReiniciarPartida = () => {
    if (!sala || !socket) return;
    socket.emit('reiniciar_partida', { codigo: sala.codigo });
  };

  // Copiar código o link
  const handleCopiarLink = () => {
    if (!sala) return;
    const link = `${window.location.origin}/juegoruleta?sala=${sala.codigo}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopiadoFeedback(true);
      setTimeout(() => setCopiadoFeedback(false), 2000);
    });
  };

  // Jugadores y estados
  const miJugador = sala?.jugadores?.find(j => j.id === socket?.id);
  const esMiTurno = sala?.estado === 'JUGANDO' && sala?.turnoActualSocketId === socket?.id && !miJugador?.eliminado;
  const esHost = miJugador?.esHost;
  const jugadorEnTurno = sala?.jugadores?.find(j => j.id === sala?.turnoActualSocketId);

  // Si el usuario eligió jugar a El Impostor
  if (juegoActivo === 'impostor') {
    return <JuegoImpostor onSwitchToRuleta={() => setJuegoActivo('ruleta')} />;
  }

  return (
    <div className={`ruleta-container ${flashScreen === 'red' ? 'screen-flash-red' : ''} ${flashScreen === 'blank' ? 'screen-flash-blank' : ''} ${screenShake ? 'screen-shake-violent' : ''}`}>
      {/* OVERLAY DE SANGRE TRAS IMPACTO LETAL */}
      {bloodSplatter && (
        <div className="blood-splatter-overlay">
          <div className="blood-drip drip-left" />
          <div className="blood-drip drip-right" />
          <div className="blood-splat splat-center" />
        </div>
      )}

      {/* HEADER CON CONTROLES INDEPENDIENTES DE MÚSICA Y EFECTOS */}
      <header className="ruleta-header">
        <div className="ruleta-logo-wrap" onClick={() => { if (sala && confirm('¿Deseas salir al menú principal?')) setSala(null); }}>
          <span className="ruleta-logo-icon">💀</span>
          <div className="ruleta-title-group">
            <span className="ruleta-logo-title">RULETA BUCKSHOT</span>
            <span className="ruleta-logo-sub">TEMÁTICA CLANDESTINA</span>
          </div>
        </div>

        <div className="ruleta-header-actions">
          {/* Switch al juego El Impostor */}
          <button
            className="btn-audio-toggle btn-switch-game-mode"
            onClick={() => setJuegoActivo('impostor')}
            title="Cambiar al juego de deducción El Impostor"
          >
            🕵️‍♂️ Jugar El Impostor
          </button>
          {/* Toggle de Música Soundtrack */}
          <button
            className={`btn-audio-toggle ${musicaActiva ? 'active-audio' : 'inactive-audio'}`}
            onClick={handleToggleMusica}
            title="Activar / Silenciar música de tensión"
          >
            {musicaActiva ? '🎵 Música: ON' : '🔇 Música: OFF'}
          </button>

          {/* Toggle de Efectos de Sonido */}
          <button
            className={`btn-audio-toggle ${efectosActivos ? 'active-audio' : 'inactive-audio'}`}
            onClick={handleToggleEfectos}
            title="Activar / Silenciar efectos de disparo y gritos"
          >
            {efectosActivos ? '🔊 Efectos: ON' : '🔇 Efectos: OFF'}
          </button>

          {sala && (
            <button
              className="btn-audio-toggle btn-leave-table"
              onClick={() => { if (confirm('¿Abandonar la mesa clandestina?')) { window.location.reload(); } }}
            >
              Salir
            </button>
          )}
        </div>
      </header>

      {/* =========================================================
          FASE 1: MENÚ LOBBY (CREAR O UNIRSE + SELECCIÓN DE PERSONAJE)
          ========================================================= */}
      {!sala && (
        <div className="ruleta-lobby-wrapper">
          <div className="ruleta-hero">
            <div className="horror-skull-badge">☠️</div>
            <h1>RULETA RUSA MORTAL</h1>
            <p>Estrategia y tensión con escopeta recortada (2 a 8 jugadores)</p>
          </div>

          <div className="ruleta-card horror-card">
            {errorMsg && (
              <div className="error-horror-box">
                ⚠️ {errorMsg}
              </div>
            )}

            <div className="input-group">
              <label className="input-label">Tu Nombre o Apodo:</label>
              <input
                type="text"
                className="ruleta-input"
                placeholder="Ej. Wilson, El Cazador..."
                maxLength={15}
                value={nombreJugador}
                onChange={e => setNombreJugador(e.target.value)}
              />
            </div>

            {/* SELECCIÓN DE PERSONAJES DE TERROR */}
            <div className="input-group">
              <label className="input-label">Elige tu Personaje Clandestino:</label>
              <div className="personajes-horror-grid">
                {PERSONAJES_TERROR.map(pj => {
                  const seleccionado = personajeSeleccionado.id === pj.id;
                  return (
                    <div
                      key={pj.id}
                      className={`personaje-horror-card ${seleccionado ? 'selected' : ''}`}
                      onClick={() => {
                        setPersonajeSeleccionado(pj);
                        ruletaAudio.playClickVacio();
                      }}
                      style={{ '--pj-color': pj.color }}
                    >
                      <span className="pj-emoji">{pj.emoji}</span>
                      <div className="pj-info">
                        <div className="pj-nombre">{pj.nombre}</div>
                        <div className="pj-titulo">{pj.titulo}</div>
                      </div>
                      {seleccionado && <span className="pj-check">✓</span>}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="lobby-tabs">
              <button
                className={`tab-btn ${tabLobby === 'crear' ? 'active' : ''}`}
                onClick={() => setTabLobby('crear')}
              >
                Crear Mesa
              </button>
              <button
                className={`tab-btn ${tabLobby === 'unirse' ? 'active' : ''}`}
                onClick={() => setTabLobby('unirse')}
              >
                Unirse con Código
              </button>
            </div>

            {tabLobby === 'crear' ? (
              <form onSubmit={handleCrearSala}>
                <div className="input-group">
                  <label className="input-label">Nombre de la Mesa (opcional):</label>
                  <input
                    type="text"
                    className="ruleta-input"
                    placeholder="Mesa del Sótano"
                    maxLength={25}
                    value={nombreSala}
                    onChange={e => setNombreSala(e.target.value)}
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">Vidas por Jugador:</label>
                  <div className="vida-selector">
                    {[3, 5, 8].map(v => (
                      <div
                        key={v}
                        className={`vida-option ${vidaInicial === v ? 'selected' : ''}`}
                        onClick={() => setVidaInicial(v)}
                      >
                        🩸 {v} Vidas {v === 3 ? '(Mortal)' : v === 5 ? '(Normal)' : '(Largo)'}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="input-group">
                  <label className="input-label">Máximo de Jugadores: {maxJugadores}</label>
                  <input
                    type="range"
                    min="2"
                    max="8"
                    value={maxJugadores}
                    onChange={e => setMaxJugadores(parseInt(e.target.value))}
                    style={{ width: '100%', accentColor: '#ef4444' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8' }}>
                    <span>2 min</span>
                    <span>8 max</span>
                  </div>
                </div>

                <button type="submit" className="btn-primary-action horror-btn" disabled={!conectado}>
                  {conectado ? '🔥 CREAR MESA Y OCUPAR ASIENTO' : 'Conectando al servidor...'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleUnirseSala}>
                <div className="input-group">
                  <label className="input-label">Código de la Sala (5 caracteres):</label>
                  <input
                    type="text"
                    className="ruleta-input code-input-huge"
                    placeholder="7A3K9"
                    maxLength={5}
                    value={codigoInput}
                    onChange={e => setCodigoInput(e.target.value.toUpperCase())}
                  />
                </div>

                <button type="submit" className="btn-primary-action horror-btn" disabled={!conectado}>
                  {conectado ? '🚪 OCUPAR ASIENTO' : 'Conectando al servidor...'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* =========================================================
          FASE 2: SALA DE ESPERA (LOBBY CODE)
          ========================================================= */}
      {sala && sala.estado === 'LOBBY' && (
        <div className="ruleta-lobby-wrapper">
          <div className="ruleta-room-header horror-box" style={{ width: '100%', boxSizing: 'border-box' }}>
            <h2 style={{ margin: '0 0 4px 0', fontSize: '24px', color: '#f87171' }}>{sala.nombre}</h2>
            <div style={{ color: '#94a3b8', fontSize: '13px' }}>Pasa este código a tus contrincantes para unirse:</div>

            <div className="room-code-badge horror-badge" onClick={handleCopiarLink} title="Haz clic para copiar el link">
              <span className="room-code-text">{sala.codigo}</span>
              <button type="button" className="btn-copy-code">
                {copiadoFeedback ? '¡Copiado!' : 'Copiar Enlace'}
              </button>
            </div>

            <div style={{ marginTop: '12px', fontSize: '13px', color: '#e2e8f0' }}>
              🩸 Vidas por jugador: <strong>{sala.vidaInicial}</strong> • Asientos ocupados: <strong>{sala.jugadores.length}/{sala.maxJugadores}</strong>
            </div>
          </div>

          <div style={{ width: '100%' }}>
            <div style={{ fontSize: '14px', fontWeight: 800, color: '#f87171', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Contendientes en la mesa ({sala.jugadores.length}):
            </div>

            <div className="players-grid-lobby">
              {sala.jugadores.map((jug) => (
                <div key={jug.id} className="player-lobby-card horror-player-card">
                  <div className="player-avatar-horror" style={{ borderColor: jug.personaje?.color || '#dc2626' }}>
                    {jug.personaje?.emoji || '💀'}
                  </div>
                  <div className="player-meta-box">
                    <div className="player-name-text">
                      {jug.nombre} {jug.id === socket?.id && ' (Tú)'}
                    </div>
                    <div className="player-character-title">
                      {jug.personaje?.nombre || 'Contendiente'}
                    </div>
                  </div>
                  {jug.esHost && <span className="badge-host">ANFITRIÓN</span>}
                </div>
              ))}
            </div>

            {errorMsg && (
              <div className="error-horror-box" style={{ textAlign: 'center', marginBottom: '14px' }}>
                ⚠️ {errorMsg}
              </div>
            )}

            {esHost ? (
              <button
                className="btn-primary-action horror-btn"
                disabled={sala.jugadores.length < 2}
                onClick={handleIniciarPartida}
                style={{ fontSize: '20px', padding: '18px' }}
              >
                {sala.jugadores.length < 2
                  ? '⏳ Esperando al menos 2 jugadores...'
                  : '🔥 ¡CARGAR ESCOPETA Y EMPEZAR!'}
              </button>
            ) : (
              <div className="waiting-host-box">
                🕯️ Esperando a que el anfitrión cargue la recámara e inicie el juego...
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================
          FASE 3: MESA CIRCULAR DE JUEGO & FASE 4 (VICTORIA)
          ========================================================= */}
      {sala && (sala.estado === 'JUGANDO' || sala.estado === 'TERMINADA') && (
        <div className="ruleta-game-screen">
          {/* BARRA SUPERIOR DE INFORMACIÓN DE MESA */}
          <div className="game-status-bar horror-status-bar">
            <div className="status-indicator">
              <span>Mesa: <strong style={{ color: '#ef4444' }}>{sala.codigo}</strong></span>
              <span style={{ color: '#475569' }}>|</span>
              <span>Ronda: <strong>#{sala.ronda}</strong></span>
            </div>

            <div className="shells-display horror-shells">
              <span>Recámara: <strong>{sala.cartuchosRestantesTotal}</strong> balas</span>
              {sala.cartuchosInfo && (
                <span className="shells-breakdown">
                  (🔴 {sala.cartuchosInfo.cargados} cargadas • 🔵 {sala.cartuchosInfo.vacios} vacías)
                </span>
              )}
            </div>

            {sala.dobleDanoActivo && (
              <div className="doble-dano-indicator pulse-blood">
                💥 ×2 DAÑO DUPLICADO ACTIVO
              </div>
            )}
          </div>

          {/* =======================================================
              🔥 MEGA BANNER DE TURNO EN LETRAS GRANDES
              ======================================================= */}
          {sala.estado === 'JUGANDO' && (
            <div className={`giant-horror-turn-banner ${esMiTurno ? 'my-turn-active' : 'rival-turn-active'}`}>
              {esMiTurno ? (
                <div className="turn-banner-inner">
                  <div className="turn-banner-top">
                    <span className="flame-icon">🔥</span>
                    <span className="giant-turn-title">¡ES TU TURNO!</span>
                    <span className="flame-icon">🔥</span>
                  </div>
                  <div className="giant-turn-subtitle">
                    LA ESCOPETA ESTÁ EN TUS MANOS — ELIGE TU DESTINO
                  </div>
                </div>
              ) : (
                <div className="turn-banner-inner">
                  <div className="turn-banner-top">
                    <span className="turn-rival-emoji">{jugadorEnTurno?.personaje?.emoji || '👤'}</span>
                    <span className="giant-turn-title">
                      TURNO DE: <span className="rival-highlight-name">{jugadorEnTurno?.nombre?.toUpperCase() || 'RIVAL'}</span>
                    </span>
                  </div>
                  <div className="giant-turn-subtitle">
                    {jugadorEnTurno?.personaje?.nombre
                      ? `(${jugadorEnTurno.personaje.nombre} - ${jugadorEnTurno.personaje.titulo}) tiene el arma en la mano...`
                      : 'Observa la jugada con cautela...'}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =======================================================
              CIRCULAR HORROR GAMBLING TABLE — MESA CLANDESTINA
              ======================================================= */}
          <div className="game-table-area horror-circular-table">
            <div className="horror-table-vignette" />
            <div className="hanging-lamp" />

            {/* AVISO FLOTANTE DE RESULTADO DE DISPARO */}
            {avisoDisparo && (
              <div className={`aviso-disparo-banner ${avisoDisparo.tipo}`}>
                <div className="aviso-disparo-title">{avisoDisparo.texto}</div>
                <div className="aviso-disparo-sub">{avisoDisparo.subtexto}</div>
              </div>
            )}

            {/* ESCENARIO CIRCULAR: MESA REDONDA CON ASIENTOS POSICIONADOS */}
            <div className="poker-scene-container">

              {/* JUGADORES POSICIONADOS ALREDEDOR DE LA MESA */}
              {sala.jugadores.map((jug, idx) => {
                const total = sala.jugadores.length;
                // Distribuir jugadores en círculo; primero abajo (ángulo 270° = arriba en CSS)
                const angleDeg = (idx / total) * 360 - 90; // empieza arriba
                const angleRad = (angleDeg * Math.PI) / 180;
                const RADIUS = 42; // % del contenedor
                const left = 50 + RADIUS * Math.cos(angleRad);
                const top = 50 + RADIUS * Math.sin(angleRad);

                const esSuTurno = sala.turnoActualSocketId === jug.id;
                const soyYo = jug.id === socket?.id;
                const estaSiendoApuntado = apuntandoAId === jug.id;

                // Determinar qué parte de la silla es "visible": opuesta al centro
                const sillaDeg = angleDeg; // misma dirección que el jugador desde el centro

                return (
                  <div
                    key={jug.id}
                    className={`player-scene-seat ${esSuTurno ? 'seat-active-turn' : ''} ${soyYo ? 'seat-is-me' : ''} ${jug.eliminado ? 'seat-dead' : ''} ${estaSiendoApuntado ? 'seat-targeted' : ''}`}
                    style={{
                      '--seat-color': jug.personaje?.color || '#dc2626',
                      '--seat-angle': `${sillaDeg}deg`,
                      left: `${left}%`,
                      top: `${top}%`,
                    }}
                  >
                    {/* SILLA detrás del personaje */}
                    <div className="player-chair">
                      <div className="chair-back" />
                      <div className="chair-seat-pad" />
                    </div>

                    {/* MIRA LÁSER */}
                    {estaSiendoApuntado && (
                      <div className="laser-target-reticle">
                        <div className="reticle-circle" />
                        <div className="reticle-line-h" />
                        <div className="reticle-line-v" />
                        <span className="reticle-text">EN LA MIRA</span>
                      </div>
                    )}

                    {/* AVATAR DEL PERSONAJE */}
                    <div className="scene-avatar-ring">
                      <div className="scene-avatar-emoji">
                        {jug.eliminado ? '💀' : (jug.personaje?.emoji || '👤')}
                      </div>
                      {esSuTurno && !jug.eliminado && <div className="active-flame-ring" />}
                      {jug.escudoActivo && !jug.eliminado && (
                        <div className="scene-shield-badge">🛡️</div>
                      )}
                    </div>

                    {/* INFO DEL JUGADOR */}
                    <div className="scene-player-info">
                      <div className="scene-player-name">
                        {jug.nombre}{soyYo && <span className="tag-me"> TÚ</span>}
                      </div>
                      <div className="scene-player-title">
                        {jug.personaje?.nombre || 'Condenado'}
                      </div>
                      <div className="scene-lives-row">
                        {Array.from({ length: jug.vidaMax }).map((_, i) => (
                          <span key={i} className={`heart-drop ${i < jug.vida ? 'alive' : 'dead'}`}>
                            {i < jug.vida ? '🩸' : '🖤'}
                          </span>
                        ))}
                      </div>
                      {jug.eliminado && <span className="badge-eliminated">☠️ ELIMINADO</span>}
                    </div>
                  </div>
                );
              })}

              {/* MESA CIRCULAR CENTRAL */}
              <div className="central-table-circle">
                <div className="table-felt-inner">

                  {/* ESCOPETA EN LA MESA - CENTRADA Y ROTABLE */}
                  <div className="shotgun-table-anchor">
                    <div
                      className="shotgun-on-table-wrap"
                      style={{ transform: `rotate(${shotgunAngle}deg)` }}
                    >
                      <EscopetaRealistaSVG
                        recoil={shotgunRecoil}
                        disparandoFuego={disparandoFuego}
                      />
                    </div>
                  </div>

                  {/* BOTELLA INDICADOR DE TURNO */}
                  {(() => {
                    const total = sala.jugadores.length;
                    const idxTurno = sala.jugadores.findIndex(j => j.id === sala.turnoActualSocketId);
                    const bottleAngleDeg = idxTurno >= 0
                      ? (idxTurno / total) * 360 - 90
                      : 0;
                    return (
                      <div
                        className="bottle-turn-indicator"
                        style={{ '--bottle-rot': `${bottleAngleDeg}deg` }}
                        title={`Turno de: ${sala.jugadores.find(j => j.id === sala.turnoActualSocketId)?.nombre || '?'}`}
                      >
                        <svg viewBox="0 0 24 60" className="bottle-svg">
                          <defs>
                            <linearGradient id="bottleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                              <stop offset="0%" stopColor="#4ade80" stopOpacity="0.3" />
                              <stop offset="40%" stopColor="#86efac" stopOpacity="0.9" />
                              <stop offset="70%" stopColor="#4ade80" stopOpacity="0.7" />
                              <stop offset="100%" stopColor="#166534" stopOpacity="0.5" />
                            </linearGradient>
                          </defs>
                          {/* Cuello */}
                          <rect x="9" y="2" width="6" height="10" rx="2" fill="url(#bottleGrad)" stroke="#15803d" strokeWidth="0.8" />
                          {/* Tapón */}
                          <rect x="8" y="1" width="8" height="3" rx="1.5" fill="#713f12" stroke="#451a03" strokeWidth="0.5" />
                          {/* Cuerpo */}
                          <path d="M 6 12 Q 4 14, 4 18 L 4 50 Q 4 54, 12 54 Q 20 54, 20 50 L 20 18 Q 20 14, 18 12 Z" fill="url(#bottleGrad)" stroke="#15803d" strokeWidth="0.8" />
                          {/* Líquido */}
                          <path d="M 5.5 30 Q 4.5 32, 4.5 40 L 4.5 50 Q 4.5 53, 12 53 Q 19.5 53, 19.5 50 L 19.5 40 Q 19.5 32, 18.5 30 Z" fill="#166534" opacity="0.6" />
                          {/* Brillo */}
                          <line x1="8" y1="15" x2="8" y2="48" stroke="white" strokeWidth="1" opacity="0.3" />
                        </svg>
                        <div className="bottle-arrow-tip" />
                      </div>
                    );
                  })()}

                  {/* CASQUILLOS EN LA MESA */}
                  <div className="table-spent-shells">
                    <span className="spent-shell shell-red">🔴</span>
                    <span className="spent-shell shell-blue">🔵</span>
                  </div>
                </div>
              </div>
            </div>

            {/* PANTALLA DE VICTORIA */}
            {sala.estado === 'TERMINADA' && (
              <div className="victory-screen horror-victory">
                <div className="crown-icon-horror">👑💀</div>
                <h2 className="victory-title">
                  ¡{sala.ganador ? sala.ganador.nombre.toUpperCase() : 'NADIE'} SOBREVIVIÓ!
                </h2>
                <p className="victory-desc">
                  Ha sido el último en pie en la mesa clandestina.
                </p>

                {esHost ? (
                  <button className="btn-primary-action horror-btn" style={{ maxWidth: '320px', margin: '0 auto' }} onClick={handleReiniciarPartida}>
                    🔄 JUGAR OTRA VEZ (REVANCHA)
                  </button>
                ) : (
                  <div style={{ color: '#94a3b8' }}>Esperando a que el anfitrión inicie otra ronda...</div>
                )}
              </div>
            )}
          </div>

          {/* =======================================================
              PANEL DE CONTROL INFERIOR (CONDICIONAL: SOLO EN TU TURNO)
              ======================================================= */}
          {sala.estado === 'JUGANDO' && (
            <div className="player-actions-panel horror-actions-panel">
              {esMiTurno ? (
                /* ACCIONES VISIBLES ÚNICAMENTE CUANDO ES TU TURNO */
                <div className="my-turn-actions-container">
                  {/* BOTONES DE DISPARO */}
                  <div className="action-buttons-row">
                    <button
                      className="btn-game-shoot shoot-rival can-act"
                      onClick={() => setModalElegirRival(true)}
                      title="Disparar a un contrincante"
                    >
                      <span className="shoot-btn-icon">🎯</span>
                      <div className="shoot-btn-text">
                        <span className="btn-main-label">DISPARAR A UN RIVAL</span>
                        <span className="btn-sub-label">Si está cargado, le restarás vida</span>
                      </div>
                    </button>

                    <button
                      className="btn-game-shoot shoot-self can-act"
                      onClick={handleDispararseASiMismo}
                      title="Si sale cartucho vacío conservas el turno"
                    >
                      <span className="shoot-btn-icon">🔄</span>
                      <div className="shoot-btn-text">
                        <span className="btn-main-label">DISPARARME A MÍ MISMO</span>
                        <span className="btn-sub-label">¡Si sale vacío, CONSERVAS tu turno!</span>
                      </div>
                    </button>
                  </div>

                  {/* OBJETOS DISPONIBLES EN TU TURNO */}
                  <div className="items-inventory-box horror-inventory">
                    <div className="items-label">
                      <span style={{ color: '#f87171', fontWeight: 800 }}>
                        Tus Objetos ({miJugador?.objetos?.length || 0}/4):
                      </span>
                      <span style={{ color: '#94a3b8', fontSize: '12px' }}>
                        ⚡ Toca un objeto para consumirlo antes de disparar
                      </span>
                    </div>

                    <div className="items-grid">
                      {miJugador?.objetos && miJugador.objetos.length > 0 ? (
                        miJugador.objetos.map((objTipo, idx) => {
                          const item = OBJETOS_INFO[objTipo] || { nombre: objTipo, emoji: '📦', desc: '' };
                          return (
                            <button
                              key={idx}
                              className="item-slot-btn horror-item-btn"
                              onClick={() => handleUsarObjeto(objTipo)}
                              title={`${item.nombre}: ${item.desc}`}
                            >
                              <span className="item-btn-emoji">{item.emoji}</span>
                              <div className="item-btn-info">
                                <span className="item-btn-name">{item.nombre}</span>
                                <span className="item-btn-desc">{item.desc}</span>
                              </div>
                            </button>
                          );
                        })
                      ) : (
                        <div className="no-items-text">
                          No tienes objetos en la mano. Recibirás 2 nuevos en cada recarga de la escopeta.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* CUANDO NO ES TU TURNO: PANEL DE ESPERA TENEBROSO */
                <div className="waiting-turn-box">
                  <div className="waiting-pulse-orb" />
                  <div className="waiting-text-col">
                    <div className="waiting-title">ESPERANDO TU TURNO...</div>
                    <div className="waiting-desc">
                      {jugadorEnTurno
                        ? `La escopeta está apuntando en manos de ${jugadorEnTurno.nombre}. Observa la mesa.`
                        : 'Espera pacientemente a que se resuelva la jugada...'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* =========================================================
          MODAL: SELECCIÓN DE RIVAL PARA APUNTAR
          ========================================================= */}
      {modalElegirRival && (
        <div className="ruleta-modal-overlay" onClick={() => setModalElegirRival(false)}>
          <div className="ruleta-modal horror-modal" onClick={e => e.stopPropagation()}>
            <h3 className="modal-horror-title">
              🎯 ¿A QUIÉN QUIERES APUNTAR LA ESCOPETA?
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#94a3b8' }}>
              Elige a tu víctima antes de apretar el gatillo:
            </p>

            <div className="rivals-list-modal">
              {sala?.jugadores?.filter(j => j.id !== socket?.id && !j.eliminado).map((rival) => (
                <button
                  key={rival.id}
                  className="btn-select-rival horror-rival-btn"
                  onClick={() => handleConfirmarDisparoRival(rival.id)}
                >
                  <span className="rival-btn-left">
                    <span className="rival-btn-emoji">{rival.personaje?.emoji || '👤'}</span>
                    <span className="rival-btn-name">{rival.nombre}</span>
                    {rival.escudoActivo && <span title="Escudo activo">🛡️</span>}
                  </span>
                  <span className="rival-btn-lives">
                    {'🩸'.repeat(rival.vida)}
                  </span>
                </button>
              ))}
            </div>

            <button
              className="btn-cancel-modal"
              onClick={() => setModalElegirRival(false)}
            >
              Cancelar Apuntado
            </button>
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL: INFORMACIÓN SECRETA (👁️ VISTA FORENSE)
          ========================================================= */}
      {infoSecretaVista && (
        <div className="ruleta-modal-overlay" onClick={() => setInfoSecretaVista(null)}>
          <div className="ruleta-modal secret-info-modal horror-modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0', fontSize: '20px', color: '#a78bfa' }}>
              🔎 VISTA FORENSE DE LA RECÁMARA
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '13px', margin: '6px 0 16px 0' }}>
              Solo tú puedes ver este secreto revelado:
            </p>

            <div className="secret-shell-icon">
              {infoSecretaVista.siguienteEsCargado ? '🔴' : '🔵'}
            </div>

            <div style={{
              fontSize: '22px',
              fontWeight: 900,
              color: infoSecretaVista.siguienteEsCargado ? '#ef4444' : '#60a5fa',
              marginBottom: '10px'
            }}>
              {infoSecretaVista.siguienteEsCargado
                ? '¡EL SIGUIENTE CARTUCHO ESTÁ CARGADO! 🔴'
                : '¡EL SIGUIENTE CARTUCHO ESTÁ VACÍO! 🔵'}
            </div>

            <div style={{ color: '#cbd5e1', fontSize: '13px', marginBottom: '20px' }}>
              {infoSecretaVista.siguienteEsCargado
                ? '⚠️ Si te disparas a ti mismo recibirás daño. Apunta a un rival.'
                : '💡 Puedes dispararte a ti mismo sin daño para conservar tu turno.'}
            </div>

            <button
              className="btn-primary-action horror-btn"
              style={{ background: '#7c3aed', boxShadow: '0 4px 20px rgba(124, 58, 237, 0.5)' }}
              onClick={() => setInfoSecretaVista(null)}
            >
              ¡Entendido, guardar silencio!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
