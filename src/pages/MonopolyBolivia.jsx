import React, { useState, useEffect, useRef } from 'react';
import {
  CASILLAS_MONOPOLY_BOLIVIA,
  FICHAS_BOLIVIA,
  CARTAS_SUERTE_BOLIVIA,
  CARTAS_CAJA_BOLIVIA
} from '../utils/monopolyBoliviaData';
import './MonopolyBolivia.css';

export default function MonopolyBolivia() {
  // Estado del jugador en el tablero
  const [posicionFicha, setPosicionFicha] = useState(0); // 0 = Salida
  const [dinero, setDinero] = useState(1500); // Dinero inicial clásico en Bs.
  const [fichaSeleccionada, setFichaSeleccionada] = useState(FICHAS_BOLIVIA[0]);
  const [propiedadesCompradas, setPropiedadesCompradas] = useState([]);

  // Dados y movimiento
  const [dados, setDados] = useState([1, 1]);
  const [tirandoDados, setTirandoDados] = useState(false);
  const [moviendoFicha, setMoviendoFicha] = useState(false);
  const [mensajeEvento, setMensajeEvento] = useState('¡Bienvenido al Monopolio Bolivia! Tira los dados para comenzar tu recorrido.');

  // Inspección de casilla (Título de propiedad / Info)
  const [casillaSeleccionada, setCasillaSeleccionada] = useState(CASILLAS_MONOPOLY_BOLIVIA[0]);
  const [modalCartaAbierto, setModalCartaAbierto] = useState(false);
  const [cartaRobada, setCartaRobada] = useState(null);

  // Zoom y vista del tablero
  const [zoomLevel, setZoomLevel] = useState(1);
  const [filtroCiudad, setFiltroCiudad] = useState('todas');

  // Sonido procedural Web Audio opcional
  const audioCtxRef = useRef(null);

  const playDiceSound = () => {
    try {
      if (!audioCtxRef.current) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) audioCtxRef.current = new AudioCtx();
      }
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
      if (!audioCtxRef.current) return;

      const now = audioCtxRef.current.currentTime;
      // 3 clics de dados rodando
      [0, 0.1, 0.22, 0.35].forEach((delay, idx) => {
        const osc = audioCtxRef.current.createOscillator();
        const gain = audioCtxRef.current.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(450 + idx * 80, now + delay);
        osc.frequency.exponentialRampToValueAtTime(150, now + delay + 0.06);
        gain.gain.setValueAtTime(0.4, now + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.06);
        osc.connect(gain);
        gain.connect(audioCtxRef.current.destination);
        osc.start(now + delay);
        osc.stop(now + delay + 0.07);
      });
    } catch (_) {}
  };

  const playMoneySound = () => {
    try {
      if (!audioCtxRef.current) return;
      const now = audioCtxRef.current.currentTime;
      const osc = audioCtxRef.current.createOscillator();
      const gain = audioCtxRef.current.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(987.77, now); // B5
      osc.frequency.setValueAtTime(1318.51, now + 0.08); // E6
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.connect(gain);
      gain.connect(audioCtxRef.current.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    } catch (_) {}
  };

  // Función para tirar dados y mover casilla por casilla
  const handleTirarDados = () => {
    if (tirandoDados || moviendoFicha) return;

    setTirandoDados(true);
    playDiceSound();

    // Animación de agitación de dados
    const interval = setInterval(() => {
      setDados([
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1
      ]);
    }, 80);

    setTimeout(() => {
      clearInterval(interval);
      const d1 = Math.floor(Math.random() * 6) + 1;
      const d2 = Math.floor(Math.random() * 6) + 1;
      setDados([d1, d2]);
      setTirandoDados(false);

      const totalPasos = d1 + d2;
      moverPasoAPaso(totalPasos);
    }, 700);
  };

  // Mover paso a paso por el tablero con animación viva
  const moverPasoAPaso = (pasosRestantes) => {
    setMoviendoFicha(true);
    let pasoActual = 0;
    let posicionTemp = posicionFicha;

    const timer = setInterval(() => {
      pasoActual++;
      posicionTemp = (posicionTemp + 1) % 40;
      setPosicionFicha(posicionTemp);

      // Si pasa por la Salida (casilla 0)
      if (posicionTemp === 0 && pasoActual < pasosRestantes) {
        setDinero(prev => prev + 200);
        playMoneySound();
      }

      if (pasoActual >= pasosRestantes) {
        clearInterval(timer);
        setMoviendoFicha(false);
        finalizarTurnoEnCasilla(posicionTemp);
      }
    }, 180);
  };

  // Al aterrizar en la casilla final
  const finalizarTurnoEnCasilla = (posFinal) => {
    const casilla = CASILLAS_MONOPOLY_BOLIVIA.find(c => c.id === posFinal);
    setCasillaSeleccionada(casilla);

    if (posFinal === 0) {
      setDinero(prev => prev + 200);
      playMoneySound();
      setMensajeEvento('🚩 ¡Caíste en la SALIDA! Cobras Bs. 200 de tu sueldo.');
    } else if (posFinal === 30) {
      // Vaya a la cárcel
      setMensajeEvento('👮‍♂️ ¡Infracción de tránsito! El oficial te manda directo a la Cárcel de San Pedro.');
      setTimeout(() => {
        setPosicionFicha(10);
      }, 1200);
    } else if (casilla.tipo === 'suerte') {
      const carta = CARTAS_SUERTE_BOLIVIA[Math.floor(Math.random() * CARTAS_SUERTE_BOLIVIA.length)];
      setCartaRobada({ ...carta, mazo: 'LA SUERTE', color: '#f59e0b', icono: '❓' });
      setModalCartaAbierto(true);
      procesarEfectoCarta(carta);
    } else if (casilla.tipo === 'comunal') {
      const carta = CARTAS_CAJA_BOLIVIA[Math.floor(Math.random() * CARTAS_CAJA_BOLIVIA.length)];
      setCartaRobada({ ...carta, mazo: 'CAJA NACIONAL', color: '#0284c7', icono: '📦' });
      setModalCartaAbierto(true);
      procesarEfectoCarta(carta);
    } else if (casilla.tipo === 'impuesto') {
      setDinero(prev => Math.max(0, prev - (casilla.costo || 100)));
      setMensajeEvento(`💸 Pagaste ${casilla.costo} Bs. por ${casilla.nombre}.`);
    } else if (casilla.tipo === 'teleferico') {
      setMensajeEvento(`🚠 Llegaste a la estación de ${casilla.nombre} (${casilla.ciudad}). Valor: Bs. ${casilla.precio}.`);
    } else if (casilla.tipo === 'propiedad') {
      setMensajeEvento(`🏙️ Llegaste a ${casilla.nombre} (${casilla.ciudad}). Valor de compra: Bs. ${casilla.precio}.`);
    } else if (casilla.tipo === 'parada') {
      setMensajeEvento('🛑 Parada Libre: Descansas en el trufi tomándote un refresco.');
    } else if (casilla.tipo === 'carcel') {
      setMensajeEvento('🔒 Cárcel de San Pedro: Solo estás de visita saludando.');
    }
  };

  const procesarEfectoCarta = (carta) => {
    if (carta.tipo === 'dinero_gana') {
      setDinero(prev => prev + carta.cantidad);
      playMoneySound();
    } else if (carta.tipo === 'dinero_pierde') {
      setDinero(prev => Math.max(0, prev - carta.cantidad));
    } else if (carta.tipo === 'carcel') {
      setTimeout(() => setPosicionFicha(10), 1000);
    } else if (carta.tipo === 'mover' && carta.accion === 'mover_salida') {
      setPosicionFicha(0);
      setDinero(prev => prev + 200);
      playMoneySound();
    } else if (carta.tipo === 'mover' && carta.casillaId !== undefined) {
      setPosicionFicha(carta.casillaId);
    }
  };

  // Comprar propiedad actual
  const handleComprarPropiedad = () => {
    if (!casillaSeleccionada || !casillaSeleccionada.precio) return;
    if (dinero < casillaSeleccionada.precio) {
      alert('¡No tienes suficiente dinero en Bolivianos (Bs.) para comprar este lugar!');
      return;
    }
    if (propiedadesCompradas.includes(casillaSeleccionada.id)) {
      alert('¡Ya posees el título de esta propiedad!');
      return;
    }

    setDinero(prev => prev - casillaSeleccionada.precio);
    setPropiedadesCompradas(prev => [...prev, casillaSeleccionada.id]);
    playMoneySound();
    setMensajeEvento(`🎉 ¡Felicidades! Adquiriste el título de ${casillaSeleccionada.nombre} por Bs. ${casillaSeleccionada.precio}.`);
  };

  // Asignar posición de CSS Grid para cada una de las 40 casillas
  const getGridStyle = (id) => {
    // Esquinas
    if (id === 20) return { gridRow: '1', gridColumn: '1' }; // Parada Libre (Sup-Izq)
    if (id === 30) return { gridRow: '1', gridColumn: '11' }; // Policía (Sup-Der)
    if (id === 0) return { gridRow: '11', gridColumn: '11' }; // Salida (Inf-Der)
    if (id === 10) return { gridRow: '11', gridColumn: '1' }; // Cárcel (Inf-Izq)

    // Lado Superior (Norte): id 21 a 29 -> Row 1, Col 2 a 10
    if (id >= 21 && id <= 29) {
      return { gridRow: '1', gridColumn: `${id - 19}` };
    }

    // Lado Derecho (Este): id 31 a 39 -> Col 11, Row 2 a 10
    if (id >= 31 && id <= 39) {
      return { gridRow: `${id - 29}`, gridColumn: '11' };
    }

    // Lado Inferior (Sur): id 1 a 9 -> Row 11, Col 10 hacia 2
    if (id >= 1 && id <= 9) {
      return { gridRow: '11', gridColumn: `${11 - id}` };
    }

    // Lado Izquierdo (Oeste): id 11 a 19 -> Col 1, Row 10 hacia 2
    if (id >= 11 && id <= 19) {
      return { gridRow: `${21 - id}`, gridColumn: '1' };
    }

    return {};
  };

  return (
    <div className="monopoly-page-wrapper">
      {/* HEADER DE MONOPOLIO BOLIVIA */}
      <header className="monopoly-header">
        <div className="header-brand-box">
          <div className="flag-badge-bolivia">🇧🇴 EDICIÓN BOLIVIA</div>
          <h1 className="header-game-title">
            <span className="title-highlight">MONOPOLIO</span> BOLIVIA
          </h1>
          <span className="header-game-tagline">
            Recorre el país en Mi Teleférico, compra ciudades y haz tu fortuna en Bolivianos (Bs.)
          </span>
        </div>

        {/* STATS DEL JUGADOR */}
        <div className="header-player-stats">
          <div className="stat-pill-token">
            <span className="token-emoji-large">{fichaSeleccionada.emoji}</span>
            <div className="token-meta">
              <span className="token-label">TU FICHA:</span>
              <strong className="token-name">{fichaSeleccionada.nombre}</strong>
            </div>
          </div>

          <div className="stat-pill-money">
            <span className="money-currency-tag">CAPITAL</span>
            <span className="money-amount">Bs. {dinero.toLocaleString('es-BO')}</span>
          </div>

          <div className="stat-pill-properties">
            <span className="prop-count-badge">🏠 {propiedadesCompradas.length}</span>
            <span className="prop-label">Propiedades</span>
          </div>
        </div>
      </header>

      {/* BANNER DE EVENTOS EN VIVO */}
      <div className="monopoly-event-ticker">
        <span className="ticker-icon">📢</span>
        <span className="ticker-text">{mensajeEvento}</span>
      </div>

      {/* CONTENEDOR PRINCIPAL: TABLERO + PANEL LATERAL */}
      <div className="monopoly-main-layout">

        {/* ─── CONTROLES DE ZOOM Y FICHA ─── */}
        <div className="board-toolbar">
          <div className="tokens-selector-row">
            <span className="toolbar-label">Cambiar Ficha:</span>
            {FICHAS_BOLIVIA.map(f => (
              <button
                key={f.id}
                onClick={() => setFichaSeleccionada(f)}
                className={`btn-token-choice ${fichaSeleccionada.id === f.id ? 'active' : ''}`}
                title={f.desc}
              >
                <span>{f.emoji}</span>
              </button>
            ))}
          </div>

          <div className="zoom-controls-row">
            <button
              onClick={() => setZoomLevel(prev => Math.max(0.7, prev - 0.1))}
              className="btn-zoom"
              title="Alejar Tablero"
            >
              🔍 -
            </button>
            <span className="zoom-indicator">{Math.round(zoomLevel * 100)}%</span>
            <button
              onClick={() => setZoomLevel(prev => Math.min(1.3, prev + 0.1))}
              className="btn-zoom"
              title="Acercar Tablero"
            >
              🔍 +
            </button>
            <button
              onClick={() => setZoomLevel(1)}
              className="btn-zoom-reset"
            >
              Reset
            </button>
          </div>
        </div>

        {/* ─── CONTENEDOR DEL TABLERO CUADRADO 11x11 ─── */}
        <div
          className="monopoly-board-viewport"
          style={{ transform: `scale(${zoomLevel})` }}
        >
          <div className="monopoly-board-grid">

            {/* RENDERIZADO DE LAS 40 CASILLAS */}
            {CASILLAS_MONOPOLY_BOLIVIA.map((casilla) => {
              const gridStyle = getGridStyle(casilla.id);
              const isSelected = casillaSeleccionada?.id === casilla.id;
              const hasPlayerToken = posicionFicha === casilla.id;
              const isBought = propiedadesCompradas.includes(casilla.id);

              return (
                <div
                  key={casilla.id}
                  onClick={() => setCasillaSeleccionada(casilla)}
                  className={`board-cell ${casilla.tipo} cell-side-${casilla.lado} ${isSelected ? 'cell-selected' : ''}`}
                  style={{
                    ...gridStyle,
                    '--cell-accent': casilla.colorGrupo || casilla.color || '#3b82f6'
                  }}
                >
                  {/* BARRITA DE COLOR DEL GRUPO (PROPIEDADES) */}
                  {casilla.tipo === 'propiedad' && (
                    <div
                      className="cell-color-band"
                      style={{ backgroundColor: casilla.colorGrupo }}
                    />
                  )}

                  {/* BARRITA DE LÍNEA DE TELEFÉRICO */}
                  {casilla.tipo === 'teleferico' && (
                    <div
                      className="cell-teleferico-band"
                      style={{ backgroundColor: casilla.colorLinea }}
                    />
                  )}

                  {/* CUERPO DE LA CASILLA */}
                  <div className="cell-content-wrap">
                    {/* ICONO */}
                    <span className="cell-icon-badge">{casilla.icono}</span>

                    {/* NOMBRE */}
                    <span className="cell-title-text">{casilla.nombre}</span>

                    {/* CIUDAD / SUBTÍTULO */}
                    {casilla.ciudad && (
                      <span className="cell-city-tag">{casilla.ciudad}</span>
                    )}
                    {casilla.subtitulo && (
                      <span className="cell-subtitle-tag">{casilla.subtitulo}</span>
                    )}

                    {/* PRECIO EN BOLIVIANOS */}
                    {casilla.precio && (
                      <span className="cell-price-tag">Bs. {casilla.precio}</span>
                    )}

                    {/* BADGE DE PROPIEDAD ADQUIRIDA */}
                    {isBought && (
                      <div className="cell-sold-stamp">MÍO</div>
                    )}
                  </div>

                  {/* FICHA DEL JUGADOR SOBRE LA CASILLA */}
                  {hasPlayerToken && (
                    <div className="board-player-token-avatar pulse-token">
                      <span className="token-emoji-flying">{fichaSeleccionada.emoji}</span>
                      <div className="token-shadow" />
                    </div>
                  )}
                </div>
              );
            })}

            {/* ─── CENTRO DEL TABLERO: LOGO, DADOS Y MAZOS DE CARTAS ─── */}
            <div className="board-center-court">
              {/* VISTA ESCÉNICA DE BOLIVIA (SILUETAS Y LOGO) */}
              <div className="center-scenic-backdrop">
                <div className="mountains-skyline" />
                <div className="cable-car-hanging">
                  <span className="mini-teleferico-cabin red">🚠</span>
                  <span className="mini-teleferico-cabin yellow">🚠</span>
                  <span className="mini-teleferico-cabin green">🚠</span>
                </div>
              </div>

              {/* LOGO GIGANTE EN EL CENTRO */}
              <div className="center-monopoly-logo-box">
                <div className="logo-red-banner">
                  <h2 className="monopoly-center-title">MONOPOLIO</h2>
                </div>
                <div className="logo-bolivia-ribbon">
                  <span>★ BOLIVIA ★</span>
                </div>
              </div>

              {/* DADOS FÍSICOS Y BOTÓN DE LANZAMIENTO */}
              <div className="center-dice-station">
                <div className="dice-pair-display">
                  <div className={`monopoly-die ${tirandoDados ? 'rolling' : ''}`}>
                    <span className="die-face-number">{dados[0]}</span>
                  </div>
                  <div className={`monopoly-die ${tirandoDados ? 'rolling' : ''}`}>
                    <span className="die-face-number">{dados[1]}</span>
                  </div>
                </div>

                <button
                  onClick={handleTirarDados}
                  disabled={tirandoDados || moviendoFicha}
                  className={`btn-roll-dice ${tirandoDados || moviendoFicha ? 'disabled' : ''}`}
                >
                  {tirandoDados ? '🎲 Rodando...' : moviendoFicha ? '🚶‍♂️ Avanzando...' : '🎲 ¡TIRAR DADOS!'}
                </button>
              </div>

              {/* MAZOS DE CARTAS (LA SUERTE & CAJA NACIONAL) */}
              <div className="center-cards-deck-row">
                <div
                  className="deck-card deck-chance"
                  onClick={() => {
                    const c = CARTAS_SUERTE_BOLIVIA[Math.floor(Math.random() * CARTAS_SUERTE_BOLIVIA.length)];
                    setCartaRobada({ ...c, mazo: 'LA SUERTE', color: '#f59e0b', icono: '❓' });
                    setModalCartaAbierto(true);
                  }}
                >
                  <span className="deck-question-mark">❓</span>
                  <span className="deck-name">LA SUERTE</span>
                </div>

                <div
                  className="deck-card deck-community"
                  onClick={() => {
                    const c = CARTAS_CAJA_BOLIVIA[Math.floor(Math.random() * CARTAS_CAJA_BOLIVIA.length)];
                    setCartaRobada({ ...c, mazo: 'CAJA NACIONAL', color: '#0284c7', icono: '📦' });
                    setModalCartaAbierto(true);
                  }}
                >
                  <span className="deck-chest-icon">📦</span>
                  <span className="deck-name">CAJA NACIONAL</span>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* ─── PANEL LATERAL DERECHO: INSPECTOR DE TÍTULO DE PROPIEDAD ─── */}
        <div className="monopoly-sidebar-inspector">

          <div className="inspector-card-header">
            <h3>📋 DETALLES DE LA CASILLA</h3>
            <span className="inspector-pos-badge">Casilla #{casillaSeleccionada.id}</span>
          </div>

          {/* TARJETA AUTÉNTICA DE TÍTULO DE PROPIEDAD */}
          {casillaSeleccionada.tipo === 'propiedad' ? (
            <div className="title-deed-card">
              <div
                className="deed-color-header"
                style={{ backgroundColor: casillaSeleccionada.colorGrupo }}
              >
                <span className="deed-title-tiny">TÍTULO DE PROPIEDAD</span>
                <h4 className="deed-property-name">{casillaSeleccionada.nombre}</h4>
                <span className="deed-city-name">{casillaSeleccionada.ciudad} - Bolivia</span>
              </div>

              <div className="deed-body-costs">
                <div className="deed-cost-row base-rent">
                  <span>Alquiler Solo Terreno:</span>
                  <strong>Bs. {casillaSeleccionada.alquiler}</strong>
                </div>

                <div className="deed-divider" />

                <div className="deed-cost-row">
                  <span>Con 1 Casa 🏠</span>
                  <strong>Bs. {casillaSeleccionada.alquilerCasas[0]}</strong>
                </div>
                <div className="deed-cost-row">
                  <span>Con 2 Casas 🏠🏠</span>
                  <strong>Bs. {casillaSeleccionada.alquilerCasas[1]}</strong>
                </div>
                <div className="deed-cost-row">
                  <span>Con 3 Casas 🏠🏠🏠</span>
                  <strong>Bs. {casillaSeleccionada.alquilerCasas[2]}</strong>
                </div>
                <div className="deed-cost-row">
                  <span>Con 4 Casas 🏠🏠🏠🏠</span>
                  <strong>Bs. {casillaSeleccionada.alquilerCasas[3]}</strong>
                </div>
                <div className="deed-cost-row hotel-row">
                  <span>Con HOTEL 🏨</span>
                  <strong>Bs. {casillaSeleccionada.alquilerHotel}</strong>
                </div>

                <div className="deed-divider" />

                <div className="deed-meta-sub">
                  <span>Costo de cada Casa:</span>
                  <span>Bs. {casillaSeleccionada.costoCasa}</span>
                </div>
                <div className="deed-meta-sub">
                  <span>Costo del Hotel:</span>
                  <span>Bs. {casillaSeleccionada.costoCasa} + 4 Casas</span>
                </div>
                <div className="deed-meta-sub">
                  <span>Valor de Hipoteca:</span>
                  <span>Bs. {casillaSeleccionada.hipoteca}</span>
                </div>
              </div>

              <div className="deed-action-footer">
                {propiedadesCompradas.includes(casillaSeleccionada.id) ? (
                  <div className="badge-already-owned">✅ Eres el dueño de esta propiedad</div>
                ) : (
                  <button
                    onClick={handleComprarPropiedad}
                    disabled={dinero < casillaSeleccionada.precio}
                    className="btn-buy-property"
                  >
                    🛒 Comprar Título (Bs. {casillaSeleccionada.precio})
                  </button>
                )}
              </div>
            </div>
          ) : casillaSeleccionada.tipo === 'teleferico' ? (
            /* TARJETA DE MI TELEFÉRICO */
            <div className="title-deed-card teleferico-card">
              <div
                className="deed-color-header teleferico-header"
                style={{ backgroundColor: casillaSeleccionada.colorLinea }}
              >
                <span className="teleferico-badge-icon">🚠</span>
                <h4 className="deed-property-name">{casillaSeleccionada.nombre}</h4>
                <span className="deed-city-name">{casillaSeleccionada.linea}</span>
              </div>

              <div className="deed-body-costs">
                <p className="teleferico-desc-text">
                  La red de transporte por cable urbano más alta y extensa del mundo.
                </p>
                <div className="deed-cost-row">
                  <span>Alquiler con 1 Línea:</span>
                  <strong>Bs. 25</strong>
                </div>
                <div className="deed-cost-row">
                  <span>Si tienes 2 Líneas de Teleférico:</span>
                  <strong>Bs. 50</strong>
                </div>
                <div className="deed-cost-row">
                  <span>Si tienes 3 Líneas de Teleférico:</span>
                  <strong>Bs. 100</strong>
                </div>
                <div className="deed-cost-row">
                  <span>Si tienes las 4 Líneas de Teleférico:</span>
                  <strong>Bs. 200</strong>
                </div>

                <div className="deed-divider" />
                <div className="deed-meta-sub">
                  <span>Valor de Hipoteca:</span>
                  <span>Bs. {casillaSeleccionada.hipoteca}</span>
                </div>
              </div>

              <div className="deed-action-footer">
                {propiedadesCompradas.includes(casillaSeleccionada.id) ? (
                  <div className="badge-already-owned">✅ Eres el dueño de esta estación</div>
                ) : (
                  <button
                    onClick={handleComprarPropiedad}
                    disabled={dinero < casillaSeleccionada.precio}
                    className="btn-buy-property"
                  >
                    🚠 Adquirir Línea (Bs. {casillaSeleccionada.precio})
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* OTRAS CASILLAS (ESQUINAS, SERVICIOS, IMPUESTOS) */
            <div className="general-square-card">
              <span className="square-big-icon">{casillaSeleccionada.icono}</span>
              <h4 className="square-big-title">{casillaSeleccionada.nombre}</h4>
              <p className="square-big-desc">
                {casillaSeleccionada.descripcion || casillaSeleccionada.subtitulo}
              </p>
              {casillaSeleccionada.costo && (
                <div className="square-cost-badge">
                  Costo: Bs. {casillaSeleccionada.costo}
                </div>
              )}
            </div>
          )}

          {/* MIS PROPIEDADES EN CARTERA */}
          <div className="portfolio-summary-box">
            <h4>TUS TÍTULOS EN BOLIVIA ({propiedadesCompradas.length}):</h4>
            {propiedadesCompradas.length === 0 ? (
              <span className="empty-portfolio-hint">Aún no has comprado propiedades. ¡Avanza y adquiere tus primeras tierras!</span>
            ) : (
              <div className="portfolio-tags-grid">
                {propiedadesCompradas.map(id => {
                  const p = CASILLAS_MONOPOLY_BOLIVIA.find(c => c.id === id);
                  return (
                    <span
                      key={id}
                      onClick={() => setCasillaSeleccionada(p)}
                      className="portfolio-tag-pill"
                      style={{ borderLeftColor: p.colorGrupo || p.colorLinea || '#3b82f6' }}
                    >
                      {p.icono} {p.nombre}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── MODAL DE CARTA ROBADA (SUERTE / CAJA NACIONAL) ─── */}
      {modalCartaAbierto && cartaRobada && (
        <div className="monopoly-modal-overlay" onClick={() => setModalCartaAbierto(false)}>
          <div
            className="monopoly-modal-card"
            onClick={e => e.stopPropagation()}
            style={{ '--modal-accent': cartaRobada.color }}
          >
            <div className="modal-header-band" style={{ backgroundColor: cartaRobada.color }}>
              <span className="modal-card-icon">{cartaRobada.icono}</span>
              <h3>{cartaRobada.mazo}</h3>
            </div>
            <div className="modal-body-content">
              <p className="modal-event-text">"{cartaRobada.texto}"</p>
              {cartaRobada.cantidad && (
                <div className="modal-money-impact">
                  {cartaRobada.tipo === 'dinero_gana' ? `+ Bs. ${cartaRobada.cantidad}` : `- Bs. ${cartaRobada.cantidad}`}
                </div>
              )}
            </div>
            <button
              onClick={() => setModalCartaAbierto(false)}
              className="btn-modal-close"
            >
              ¡ENTENDIDO!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
