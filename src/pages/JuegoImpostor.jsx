import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import './JuegoImpostor.css';

export default function JuegoImpostor({ onSwitchToRuleta }) {
  const [socket, setSocket] = useState(null);
  const [conectado, setConectado] = useState(false);

  // Configuración inicial del servidor
  const [categoriasDisponibles, setCategoriasDisponibles] = useState([]);
  const [avataresDisponibles, setAvataresDisponibles] = useState([]);

  // Estados de Lobby
  const [nombreJugador, setNombreJugador] = useState(() => localStorage.getItem('impostor_nombre') || '');
  const [avatarSeleccionado, setAvatarSeleccionado] = useState(null);
  const [categoriaElegida, setCategoriaElegida] = useState('todas');
  const [cantImpostores, setCantImpostores] = useState(1);
  const [maxJugadores, setMaxJugadores] = useState(8);
  const [codigoInput, setCodigoInput] = useState('');
  const [tabLobby, setTabLobby] = useState('crear');
  const [errorMsg, setErrorMsg] = useState('');

  // Estado del Juego recibido por Socket
  const [sala, setSala] = useState(null);
  const [tarjetaRevelada, setTarjetaRevelada] = useState(false);
  const [miPistaTexto, setMiPistaTexto] = useState('');
  const [votoSeleccionadoId, setVotoSeleccionadoId] = useState(null);
  const [copiadoFeedback, setCopiadoFeedback] = useState(false);

  const cluesEndRef = useRef(null);

  // Auto-scroll en el chat de pistas
  useEffect(() => {
    if (cluesEndRef.current) {
      cluesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [sala?.pistas]);

  // Conexión Socket.IO con namespace /impostor
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const salaUrl = params.get('impostor') || params.get('sala_impostor');
    if (salaUrl) {
      setCodigoInput(salaUrl.toUpperCase());
      setTabLobby('unirse');
    }

    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const backendUrl = (isLocal && window.location.port === '3000')
      ? `http://${window.location.hostname}:5000/impostor`
      : '/impostor';

    const newSocket = io(backendUrl, {
      path: '/socket.io',
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      console.log('✅ Conectado al servidor de El Impostor');
      setConectado(true);

      // Cargar configuraciones iniciales
      newSocket.emit('get_config_inicial', (res) => {
        if (res) {
          if (res.categorias) setCategoriasDisponibles(res.categorias);
          if (res.avatares) {
            setAvataresDisponibles(res.avatares);
            setAvatarSeleccionado(res.avatares[0]);
          }
        }
      });
    });

    newSocket.on('disconnect', () => {
      console.log('🔌 Desconectado de El Impostor');
      setConectado(false);
    });

    newSocket.on('sala_actualizada', (salaData) => {
      setSala(salaData);
      // Resetear tarjeta revelada al cambiar de estado
      if (salaData.estado === 'LOBBY' || salaData.estado === 'PISTAS') {
        setTarjetaRevelada(false);
      }
      if (salaData.estado === 'PISTAS') {
        setVotoSeleccionadoId(null);
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // 1. Crear Sala
  const handleCrearSala = (e) => {
    e.preventDefault();
    if (!nombreJugador.trim()) {
      setErrorMsg('Por favor ingresa tu nombre de jugador');
      return;
    }
    setErrorMsg('');
    localStorage.setItem('impostor_nombre', nombreJugador.trim());

    socket.emit('crear_sala', {
      nombreJugador: nombreJugador.trim(),
      avatar: avatarSeleccionado,
      categoria: categoriaElegida,
      maxJugadores,
      cantImpostores
    }, (res) => {
      if (!res.success) {
        setErrorMsg(res.error || 'Error al crear la sala');
      } else {
        setSala(res.sala);
      }
    });
  };

  // 2. Unirse a Sala
  const handleUnirseSala = (e) => {
    e.preventDefault();
    if (!nombreJugador.trim()) {
      setErrorMsg('Por favor ingresa tu nombre de jugador');
      return;
    }
    if (!codigoInput.trim()) {
      setErrorMsg('Por favor ingresa el código de 5 letras');
      return;
    }
    setErrorMsg('');
    localStorage.setItem('impostor_nombre', nombreJugador.trim());

    socket.emit('unirse_sala', {
      codigo: codigoInput.trim().toUpperCase(),
      nombreJugador: nombreJugador.trim(),
      avatar: avatarSeleccionado
    }, (res) => {
      if (!res.success) {
        setErrorMsg(res.error || 'Error al unirse a la sala');
      } else {
        setSala(res.sala);
      }
    });
  };

  // 3. Iniciar Partida (Host)
  const handleIniciarPartida = () => {
    if (!sala || !socket) return;
    setErrorMsg('');
    socket.emit('iniciar_partida', {
      codigo: sala.codigo,
      categoria: categoriaElegida,
      cantImpostores
    }, (res) => {
      if (res && !res.success) {
        setErrorMsg(res.error || 'No se pudo iniciar la partida');
      }
    });
  };

  // 4. Confirmar Rol Visto
  const handleConfirmarRevelacion = () => {
    if (!sala || !socket) return;
    socket.emit('confirmar_revelacion', { codigo: sala.codigo });
  };

  // 5. Enviar Pista (por texto o de voz)
  const handleEnviarPistaTexto = (e) => {
    e?.preventDefault();
    if (!sala || !socket || !miPistaTexto.trim()) return;
    socket.emit('enviar_pista', {
      codigo: sala.codigo,
      texto: miPistaTexto.trim()
    }, (res) => {
      if (res?.success) {
        setMiPistaTexto('');
      } else if (res?.error) {
        setErrorMsg(res.error);
      }
    });
  };

  const handlePasarTurnoVoz = () => {
    if (!sala || !socket) return;
    socket.emit('enviar_pista', {
      codigo: sala.codigo,
      texto: '🗣️ (Hablé en voz alta)'
    });
  };

  // 6. Emitir Voto
  const handleEmitirVoto = () => {
    if (!sala || !socket || !votoSeleccionadoId) return;
    socket.emit('emitir_voto', {
      codigo: sala.codigo,
      objetivoId: votoSeleccionadoId
    });
  };

  // 7. Adivinar Palabra (Última oportunidad del impostor)
  const handleAdivinarPalabra = (palabra) => {
    if (!sala || !socket) return;
    socket.emit('adivinar_palabra', {
      codigo: sala.codigo,
      palabra
    });
  };

  // 8. Siguiente Ronda de Pistas
  const handleSiguienteRonda = () => {
    if (!sala || !socket) return;
    socket.emit('siguiente_ronda', { codigo: sala.codigo });
  };

  // 9. Reiniciar Partida
  const handleReiniciarPartida = () => {
    if (!sala || !socket) return;
    socket.emit('reiniciar_partida', { codigo: sala.codigo });
  };

  // Copiar código o link
  const copiarCodigo = () => {
    if (!sala) return;
    navigator.clipboard.writeText(sala.codigo);
    setCopiadoFeedback(true);
    setTimeout(() => setCopiadoFeedback(false), 2000);
  };

  const copiarEnlace = () => {
    if (!sala) return;
    const url = `${window.location.origin}/juegoruleta?impostor=${sala.codigo}`;
    navigator.clipboard.writeText(url);
    setCopiadoFeedback(true);
    setTimeout(() => setCopiadoFeedback(false), 2000);
  };

  // Variables calculadas
  const miSocketId = socket?.id;
  const miJugador = sala?.jugadores.find(j => j.id === miSocketId);
  const esMiTurno = sala?.estado === 'PISTAS' && sala?.turnoActualSocketId === miSocketId;
  const esHost = sala?.hostSocketId === miSocketId;
  const esImpostor = miJugador?.rol === 'impostor';
  const yaVote = miJugador?.haVotado;

  return (
    <div className="impostor-game-container">
      {/* HEADER PRINCIPAL CON SWITCH DE JUEGO */}
      <header className="impostor-header">
        <div className="impostor-brand">
          <span className="brand-badge-mode">🎮 MODO DE JUEGO</span>
          <h1 className="impostor-brand-title">
            <span className="brand-icon">🕵️‍♂️</span> EL IMPOSTOR
          </h1>
          <span className="brand-subtitle">Palabra Secreta y Deducción Social</span>
        </div>

        <div className="header-nav-actions">
          {onSwitchToRuleta && (
            <button
              onClick={onSwitchToRuleta}
              className="btn-switch-game"
              title="Cambiar al juego de la Ruleta Rusa"
            >
              💀 Ir a Ruleta Rusa
            </button>
          )}
          <div className="connection-status-pill">
            <span className={`status-dot ${conectado ? 'online' : 'offline'}`} />
            {conectado ? 'EN LÍNEA' : 'CONECTANDO...'}
          </div>
        </div>
      </header>

      {/* FEEDBACK DE COPIADO */}
      {copiadoFeedback && (
        <div className="toast-copied-notification">
          📋 ¡Copiado al portapapeles!
        </div>
      )}

      {/* ERROR BANNER */}
      {errorMsg && (
        <div className="impostor-alert-banner">
          <span>⚠️ {errorMsg}</span>
          <button onClick={() => setErrorMsg('')} className="btn-close-alert">✕</button>
        </div>
      )}

      {/* ========================================================
          VISTA 1: LOBBY DE INGRESO Y CONFIGURACIÓN (SI NO HAY SALA)
          ======================================================== */}
      {!sala && (
        <div className="impostor-lobby-view">
          <div className="lobby-welcome-hero">
            <div className="hero-spy-silhouette">🕵️‍♂️</div>
            <h2>¿Quién está mintiendo?</h2>
            <p>
              Uno de ustedes no conoce la palabra secreta. Da pistas sutiles,
              descubre al infiltrado y voten para eliminarlo antes de que sea tarde.
            </p>
          </div>

          <div className="lobby-card-glass">
            {/* TABS CREAR / UNIRSE */}
            <div className="lobby-tabs-row">
              <button
                type="button"
                className={`lobby-tab-btn ${tabLobby === 'crear' ? 'active' : ''}`}
                onClick={() => setTabLobby('crear')}
              >
                ➕ Crear Sala
              </button>
              <button
                type="button"
                className={`lobby-tab-btn ${tabLobby === 'unirse' ? 'active' : ''}`}
                onClick={() => setTabLobby('unirse')}
              >
                🔑 Unirse con Código
              </button>
            </div>

            {/* SELECCIÓN DE NOMBRE Y AVATAR */}
            <div className="form-group-impostor">
              <label className="impostor-field-label">TU NOMBRE O APODO</label>
              <input
                type="text"
                className="impostor-text-input"
                placeholder="Ej: Wilson, DetectiveX..."
                maxLength={18}
                value={nombreJugador}
                onChange={(e) => setNombreJugador(e.target.value)}
              />
            </div>

            <div className="form-group-impostor">
              <label className="impostor-field-label">ELIGE TU IDENTIDAD SECRETA</label>
              <div className="avatars-picker-grid">
                {avataresDisponibles.map((av) => (
                  <button
                    type="button"
                    key={av.id}
                    className={`avatar-pick-card ${avatarSeleccionado?.id === av.id ? 'selected' : ''}`}
                    onClick={() => setAvatarSeleccionado(av)}
                    style={{ '--avatar-accent': av.color }}
                  >
                    <span className="avatar-pick-emoji">{av.emoji}</span>
                    <span className="avatar-pick-name">{av.nombre}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* TAB CREAR SALA */}
            {tabLobby === 'crear' && (
              <form onSubmit={handleCrearSala} className="form-create-impostor">
                <div className="form-group-impostor">
                  <label className="impostor-field-label">CATEGORÍA DE PALABRAS</label>
                  <select
                    className="impostor-select-input"
                    value={categoriaElegida}
                    onChange={(e) => setCategoriaElegida(e.target.value)}
                  >
                    <option value="todas">🎲 Aleatoria (Todas las Categorías)</option>
                    {categoriasDisponibles.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.emoji} {cat.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-row-duo">
                  <div className="form-group-impostor">
                    <label className="impostor-field-label">CANT. IMPOSTORES</label>
                    <select
                      className="impostor-select-input"
                      value={cantImpostores}
                      onChange={(e) => setCantImpostores(Number(e.target.value))}
                    >
                      <option value={1}>1 Impostor</option>
                      <option value={2}>2 Impostores (para grupos grandes)</option>
                    </select>
                  </div>

                  <div className="form-group-impostor">
                    <label className="impostor-field-label">MÁX. JUGADORES</label>
                    <select
                      className="impostor-select-input"
                      value={maxJugadores}
                      onChange={(e) => setMaxJugadores(Number(e.target.value))}
                    >
                      {[3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(num => (
                        <option key={num} value={num}>{num} Jugadores</option>
                      ))}
                    </select>
                  </div>
                </div>

                <button type="submit" className="btn-action-primary-impostor">
                  🚀 CREAR SALA SECRETA
                </button>
              </form>
            )}

            {/* TAB UNIRSE A SALA */}
            {tabLobby === 'unirse' && (
              <form onSubmit={handleUnirseSala} className="form-join-impostor">
                <div className="form-group-impostor">
                  <label className="impostor-field-label">CÓDIGO DE SALA (5 LETRAS)</label>
                  <input
                    type="text"
                    className="impostor-text-input input-code-big"
                    placeholder="Ej: A7K92"
                    maxLength={5}
                    value={codigoInput}
                    onChange={(e) => setCodigoInput(e.target.value.toUpperCase())}
                  />
                </div>

                <button type="submit" className="btn-action-primary-impostor">
                  🔑 UNIRME A LA PARTIDA
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          VISTA 2: SALA DE ESPERA / LOBBY (CUANDO YA SE CREÓ O UNIÓ)
          ======================================================== */}
      {sala && sala.estado === 'LOBBY' && (
        <div className="impostor-room-lobby">
          <div className="room-code-banner">
            <span className="code-label">CÓDIGO DE LA SALA:</span>
            <div className="code-digits-row">
              <span className="code-big">{sala.codigo}</span>
              <button onClick={copiarCodigo} className="btn-copy-code" title="Copiar Código">
                📋 Copiar Código
              </button>
              <button onClick={copiarEnlace} className="btn-copy-link" title="Copiar Enlace para Celulares">
                🔗 Compartir Enlace
              </button>
            </div>
            <p className="code-hint">
              Comparte este código o enlace con tus amigos para que se unan desde sus celulares.
            </p>
          </div>

          <div className="room-roster-card">
            <div className="roster-header-row">
              <span className="roster-title">
                👥 JUGADORES EN LA SALA ({sala.jugadores.length} / {sala.maxJugadores})
              </span>
              <span className="roster-badge-min">
                {sala.jugadores.length < 3 ? '⚠️ Mínimo 3 requeridos' : '✅ Listos para jugar'}
              </span>
            </div>

            <div className="players-grid-lobby">
              {sala.jugadores.map((jug, idx) => {
                const isHostJug = jug.id === sala.hostSocketId;
                const isMe = jug.id === miSocketId;
                return (
                  <div
                    key={jug.id}
                    className={`player-lobby-seat ${isMe ? 'is-me' : ''}`}
                    style={{ '--player-color': jug.avatar?.color || '#3b82f6' }}
                  >
                    <div className="seat-avatar-bubble">
                      <span className="seat-emoji">{jug.avatar?.emoji || '👤'}</span>
                    </div>
                    <div className="seat-info">
                      <span className="seat-name">
                        {jug.nombre} {isMe && <span className="tag-you">(Tú)</span>}
                      </span>
                      <span className="seat-role-hint">
                        {isHostJug ? '👑 Anfitrión' : `Jugador #${idx + 1}`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* PANEL DE CONTROL PARA EL HOST */}
            {esHost ? (
              <div className="host-start-panel">
                <button
                  onClick={handleIniciarPartida}
                  disabled={sala.jugadores.length < 3}
                  className={`btn-start-game-impostor ${sala.jugadores.length < 3 ? 'disabled' : ''}`}
                >
                  {sala.jugadores.length < 3
                    ? `ESPERANDO JUGADORES (${sala.jugadores.length}/3 mín)`
                    : '🔥 INICIAR PARTIDA AHORA'}
                </button>
              </div>
            ) : (
              <div className="guest-waiting-panel">
                <span className="spinner-spy">⏳</span>
                <span>Esperando que el anfitrión inicie la partida...</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          VISTA 3: REVELACIÓN DE ROL Y PALABRA SECRETA (ANTITRAMPA)
          ======================================================== */}
      {sala && sala.estado === 'REVELACION' && (
        <div className="impostor-phase-view phase-reveal">
          <div className="secret-card-outer">
            <h2 className="phase-title">🔒 TU INFORMACIÓN CONFIDENCIAL</h2>
            <p className="phase-subtitle">
              Asegúrate de que nadie a tu lado esté mirando la pantalla de tu celular.
            </p>

            {/* TARJETA INTERACTIVA TOCAR PARA REVELAR */}
            <div
              className={`secret-card-flipper ${tarjetaRevelada ? 'is-revealed' : 'is-covered'}`}
              onClick={() => setTarjetaRevelada(!tarjetaRevelada)}
            >
              {!tarjetaRevelada ? (
                <div className="card-covered-face">
                  <div className="lock-icon-glow">🔐</div>
                  <h3 className="card-tap-cta">TOCA AQUÍ PARA REVELAR TU CARTA</h3>
                  <span className="tap-hint">(Toca de nuevo para ocultarla)</span>
                </div>
              ) : (
                <div className={`card-revealed-face ${esImpostor ? 'card-impostor' : 'card-innocent'}`}>
                  {esImpostor ? (
                    <div className="reveal-content impostor-theme">
                      <div className="role-giant-badge badge-red">🕵️‍♂️ ERES EL IMPOSTOR</div>
                      <div className="category-tag">📁 Categoría: {sala.categoriaNombre}</div>
                      <div className="role-mission-box">
                        <p className="mission-title">TU MISIÓN:</p>
                        <p className="mission-desc">
                          <strong>No conoces la palabra secreta.</strong> Escucha atentamente las pistas
                          de los demás, da una pista creíble y evita que te descubran en la votación.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="reveal-content innocent-theme">
                      <div className="role-giant-badge badge-blue">😇 ERES INOCENTE</div>
                      <div className="secret-word-display">
                        <span className="word-label">TU PALABRA SECRETA:</span>
                        <span className="word-text">{sala.palabraSecreta}</span>
                      </div>
                      <div className="category-tag">📁 Categoría: {sala.categoriaNombre}</div>
                      <div className="role-mission-box">
                        <p className="mission-title">TU MISIÓN:</p>
                        <p className="mission-desc">
                          Da una pista relacionada con la palabra sin decirla directamente.
                          Presta atención para detectar al jugador que esté dudando o mintiendo.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="confirm-action-row">
              <button
                onClick={handleConfirmarRevelacion}
                className="btn-action-primary-impostor btn-confirm-ready"
              >
                👁️ ¡LISTO, YA HE MEMORIZADO MI ROL!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          VISTA 4: RONDA DE PISTAS (CHAT / MENSAJES Y TURNOS)
          ======================================================== */}
      {sala && sala.estado === 'PISTAS' && (
        <div className="impostor-phase-view phase-clues">
          {/* BANNER DE TURNO GIGANTE */}
          <div className="turn-banner-impostor">
            <div className="turn-banner-left">
              <span className="turn-round-tag">RONDA #{sala.ronda}</span>
              <h2 className="turn-player-announce">
                {esMiTurno ? '🎯 ¡ES TU TURNO DE DAR PISTA!' : `⏳ Turno de: ${sala.jugadores.find(j => j.id === sala.turnoActualSocketId)?.nombre || '...'}`}
              </h2>
            </div>
            {!esImpostor && (
              <div className="word-reminder-pill" title="Solo tú y los inocentes pueden ver esto">
                <span>Tu palabra:</span>
                <strong>{sala.palabraSecreta}</strong>
              </div>
            )}
          </div>

          {/* LISTA DE JUGADORES CON ESTADO DE PISTA */}
          <div className="clues-players-status-bar">
            {sala.jugadores.filter(j => j.vivo).map(jug => {
              const esTurnoDeEste = jug.id === sala.turnoActualSocketId;
              return (
                <div
                  key={jug.id}
                  className={`player-clue-pill ${esTurnoDeEste ? 'is-turn' : ''} ${jug.haDadoPista ? 'has-given' : ''}`}
                >
                  <span className="pill-avatar">{jug.avatar?.emoji || '👤'}</span>
                  <span className="pill-name">{jug.nombre}</span>
                  <span className="pill-status-icon">
                    {jug.haDadoPista ? '✅' : esTurnoDeEste ? '🎤' : '⏳'}
                  </span>
                </div>
              );
            })}
          </div>

          {/* MURO DE PISTAS DADAS EN ESTA PARTIDA */}
          <div className="clues-feed-container">
            <div className="feed-header">
              <span>📜 HISTORIAL DE PISTAS EN VIVO</span>
            </div>
            <div className="feed-messages-scroll">
              {sala.pistas.length === 0 ? (
                <div className="feed-empty-state">
                  <span>Aún no hay pistas. ¡El primer jugador está pensando su pista!</span>
                </div>
              ) : (
                sala.pistas.map((pista, idx) => (
                  <div key={idx} className="clue-chat-bubble">
                    <span className="clue-author-avatar">{pista.jugadorAvatar?.emoji || '👤'}</span>
                    <div className="clue-bubble-content">
                      <div className="clue-author-row">
                        <strong className="clue-author-name">{pista.jugadorNombre}</strong>
                        <span className="clue-round-badge">Ronda {pista.ronda}</span>
                      </div>
                      <p className="clue-text-body">"{pista.texto}"</p>
                    </div>
                  </div>
                ))
              )}
              <div ref={cluesEndRef} />
            </div>
          </div>

          {/* PANEL DE ACCIÓN: SEGÚN EL USUARIO REQUIERE:
              "los turnos deben durar segun el jugador hable o por mensaje cada jugador decide su tiempo puede ser por mensaje en el juego como texto" */}
          {esMiTurno ? (
            <div className="my-turn-action-box">
              <h3 className="my-turn-title">✍️ Escribe tu pista o confirma que hablaste:</h3>
              <form onSubmit={handleEnviarPistaTexto} className="clue-input-form">
                <input
                  type="text"
                  className="clue-text-input"
                  placeholder="Escribe aquí tu pista breve (ej: Se utiliza para viajar)..."
                  maxLength={120}
                  value={miPistaTexto}
                  onChange={(e) => setMiPistaTexto(e.target.value)}
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={!miPistaTexto.trim()}
                  className="btn-send-clue"
                >
                  📨 Enviar Pista
                </button>
              </form>

              <div className="clue-voice-alt-row">
                <span className="or-divider">— O SI HABLAS EN PERSONA / LLAMADA —</span>
                <button
                  type="button"
                  onClick={handlePasarTurnoVoz}
                  className="btn-clue-spoke-voice"
                >
                  🗣️ Ya hablé en voz alta (Pasar Turno)
                </button>
              </div>
            </div>
          ) : (
            <div className="waiting-other-turn-box">
              <span className="pulse-dot-radar" />
              <span>
                Esperando a que <strong>{sala.jugadores.find(j => j.id === sala.turnoActualSocketId)?.nombre || 'el jugador'}</strong> dé su pista...
              </span>
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          VISTA 5: VOTACIÓN SECRETA (¿QUIÉN ES EL IMPOSTOR?)
          ======================================================== */}
      {sala && sala.estado === 'VOTACION' && (
        <div className="impostor-phase-view phase-voting">
          <div className="voting-card-container">
            <h2 className="voting-title">🤔 ¿QUIÉN ES EL IMPOSTOR?</h2>
            <p className="voting-subtitle">
              Todos han dado sus pistas. Analiza las respuestas del muro y vota por el sospechoso.
            </p>

            <div className="voting-candidates-grid">
              {sala.jugadores.filter(j => j.vivo).map(jug => {
                const isMe = jug.id === miSocketId;
                const isSelected = votoSeleccionadoId === jug.id;
                return (
                  <button
                    type="button"
                    key={jug.id}
                    disabled={isMe || yaVote}
                    onClick={() => setVotoSeleccionadoId(jug.id)}
                    className={`voting-candidate-card ${isSelected ? 'selected' : ''} ${isMe ? 'disabled-self' : ''}`}
                    style={{ '--cand-color': jug.avatar?.color || '#3b82f6' }}
                  >
                    <span className="cand-emoji">{jug.avatar?.emoji || '👤'}</span>
                    <span className="cand-name">
                      {jug.nombre} {isMe && '(Tú)'}
                    </span>
                    {jug.haVotado && <span className="cand-voted-pill">✓ Votó</span>}
                  </button>
                );
              })}
            </div>

            {!yaVote ? (
              <div className="submit-vote-row">
                <button
                  type="button"
                  disabled={!votoSeleccionadoId}
                  onClick={handleEmitirVoto}
                  className={`btn-action-primary-impostor btn-vote-confirm ${!votoSeleccionadoId ? 'disabled' : ''}`}
                >
                  🗳️ CONFIRMAR MI VOTO SECRETO
                </button>
              </div>
            ) : (
              <div className="vote-registered-notice">
                <span className="checkmark-green">✅</span>
                <h3>¡Tu voto ha sido registrado!</h3>
                <p>Esperando a que los demás jugadores terminen de votar...</p>
                <div className="votes-counter-badge">
                  {sala.jugadores.filter(j => j.vivo && j.haVotado).length} de {sala.jugadores.filter(j => j.vivo).length} votos emitidos
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          VISTA 6: RESULTADO DE LA VOTACIÓN
          ======================================================== */}
      {sala && sala.estado === 'RESULTADO' && (
        <div className="impostor-phase-view phase-result">
          <div className="result-card-container">
            <h2 className="result-title">📢 RESULTADO DE LA VOTACIÓN</h2>

            {/* CONTEO DE VOTOS */}
            <div className="votes-breakdown-list">
              {sala.jugadores.map(jug => (
                <div key={jug.id} className="vote-row-item">
                  <span className="vote-row-avatar">{jug.avatar?.emoji || '👤'}</span>
                  <span className="vote-row-name">{jug.nombre}</span>
                  <div className="vote-bar-track">
                    <div
                      className="vote-bar-fill"
                      style={{ width: `${Math.min(jug.votosRecibidos * 25, 100)}%` }}
                    />
                  </div>
                  <span className="vote-count-number">{jug.votosRecibidos} votos</span>
                </div>
              ))}
            </div>

            {/* VEREDICTO */}
            {sala.resultadoUltimaVotacion && (
              <div className={`verdict-box ${sala.resultadoUltimaVotacion.eraImpostor ? 'verdict-caught' : 'verdict-wrong'}`}>
                <h3>{sala.resultadoUltimaVotacion.mensaje}</h3>
                {sala.resultadoUltimaVotacion.eliminado && (
                  <div className="eliminated-player-banner">
                    <span className="eliminated-avatar">
                      {sala.resultadoUltimaVotacion.eliminado.avatar?.emoji || '💀'}
                    </span>
                    <span className="eliminated-name">
                      {sala.resultadoUltimaVotacion.eliminado.nombre} ha sido eliminado.
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* ACCIÓN PARA CONTINUAR */}
            <div className="result-actions-row">
              <button
                onClick={handleSiguienteRonda}
                className="btn-action-primary-impostor btn-next-round"
              >
                ⏭️ CONTINUAR A LA SIGUIENTE RONDA
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          VISTA 7: ÚLTIMA OPORTUNIDAD DEL IMPOSTOR DESCUBIERTO
          ======================================================== */}
      {sala && sala.estado === 'ADIVINAR_PALABRA' && (
        <div className="impostor-phase-view phase-guess">
          <div className="guess-card-container">
            <div className="warning-spy-icon">⚠️</div>
            <h2 className="guess-title">¡EL IMPOSTOR HA SIDO DESCUBIERTO!</h2>
            <p className="guess-subtitle">
              Pero tiene una última oportunidad para robar la victoria si adivina cuál era la palabra secreta.
            </p>

            {sala.impostorDescubiertoId === miSocketId ? (
              <div className="impostor-guess-options">
                <h3>¿Cuál crees que era la palabra de la categoría "{sala.categoriaNombre}"?</h3>
                <div className="guess-buttons-grid">
                  {sala.opcionesAdivinar?.map((palabra, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleAdivinarPalabra(palabra)}
                      className="btn-guess-choice"
                    >
                      {palabra}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="waiting-guess-box">
                <span className="pulse-dot-radar" />
                <p>El impostor está intentando adivinar la palabra secreta...</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          VISTA 8: FIN DE LA PARTIDA Y VICTORIA
          ======================================================== */}
      {sala && sala.estado === 'TERMINADA' && (
        <div className="impostor-phase-view phase-game-over">
          <div className="victory-card-container">
            <div className="victory-emojis-banner">
              {sala.ganador === 'IMPOSTOR' ? '🕵️‍♂️💥🏆' : '🎉😇🏆'}
            </div>
            <h2 className="victory-headline">
              {sala.ganador === 'IMPOSTOR'
                ? '¡VICTORIA DEL IMPOSTOR!'
                : '¡VICTORIA DE LOS INOCENTES!'}
            </h2>
            <p className="victory-motive">{sala.motivoVictoria}</p>

            <div className="secret-revealed-summary-box">
              <div className="summary-row">
                <span>Palabra Secreta:</span>
                <strong>{sala.palabraSecreta}</strong>
              </div>
              <div className="summary-row">
                <span>Categoría:</span>
                <strong>{sala.categoriaNombre}</strong>
              </div>
            </div>

            <div className="game-over-buttons-row">
              <button
                onClick={handleReiniciarPartida}
                className="btn-action-primary-impostor btn-play-again"
              >
                🔄 JUGAR OTRA PARTIDA
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
