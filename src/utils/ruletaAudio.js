/**
 * Motor de Audio para el Juego de Ruleta de Terror / Buckshot
 * Soporta:
 * 1. Música de fondo en loop (/audio/tension_soundtrack.mp3) con control independiente de volumen y silencio
 * 2. Efecto de audio de escopeta real (/audio/escopeta_disparo.mp3) para disparo cargado
 * 3. Efectos procedurales Web Audio (disparo fallido/vacío, grito de dolor agónico, campana fúnebre, latido de tensión)
 * 4. Controles separados de Música ON/OFF y Efectos ON/OFF
 */

class RuletaAudio {
  constructor() {
    this.ctx = null;
    this.efectosMuted = false;
    this.musicaMuted = false;
    this.musicaIniciada = false;
    this.audioMusica = null;
  }

  init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    // Inicializar elemento de música de fondo si no existe
    if (!this.audioMusica && typeof window !== 'undefined') {
      this.audioMusica = new Audio('/audio/tension_soundtrack.mp3');
      this.audioMusica.loop = true;
      this.audioMusica.volume = 0.35;
    }
  }

  // Iniciar la música de fondo tras la primera interacción del usuario
  startMusica() {
    this.init();
    if (!this.audioMusica || this.musicaMuted) return;
    this.audioMusica.play().then(() => {
      this.musicaIniciada = true;
    }).catch(err => {
      console.warn('Autoplay bloqueado esperando clic del usuario:', err);
    });
  }

  // Detener o pausar la música
  stopMusica() {
    if (this.audioMusica) {
      this.audioMusica.pause();
    }
  }

  // Alternar Música ON / OFF
  toggleMusica() {
    this.init();
    this.musicaMuted = !this.musicaMuted;
    if (this.musicaMuted) {
      if (this.audioMusica) this.audioMusica.pause();
    } else {
      if (this.audioMusica) {
        this.audioMusica.play().catch(() => {});
      }
    }
    return !this.musicaMuted;
  }

  // Alternar Efectos ON / OFF
  toggleEfectos() {
    this.efectosMuted = !this.efectosMuted;
    return !this.efectosMuted;
  }

  // Silenciar o activar todo
  toggleMuteAll() {
    const nuevoEstado = !(this.efectosMuted && this.musicaMuted);
    this.efectosMuted = nuevoEstado;
    this.musicaMuted = nuevoEstado;
    if (this.audioMusica) {
      if (nuevoEstado) this.audioMusica.pause();
      else this.audioMusica.play().catch(() => {});
    }
    return !nuevoEstado;
  }

  // 💥 Disparo de escopeta silenciado temporalmente a petición del usuario
  playDisparoReal() {
    // Silenciado temporalmente
    return;
  }

  // 🔕 Disparo vacío / fallido (Cartucho de fogueo / percutor en seco)
  playClickVacio() {
    if (this.efectosMuted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;

      // Clic seco metálico
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1250, now);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.05);

      gain.gain.setValueAtTime(0.8, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.08);

      // Resonancia de recámara hueca
      const hollow = this.ctx.createOscillator();
      const hollowGain = this.ctx.createGain();
      hollow.type = 'sine';
      hollow.frequency.setValueAtTime(480, now + 0.03);
      hollowGain.gain.setValueAtTime(0.25, now + 0.03);
      hollowGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      hollow.connect(hollowGain);
      hollowGain.connect(this.ctx.destination);
      hollow.start(now + 0.03);
      hollow.stop(now + 0.28);

    } catch (_) {}
  }

  // Curva de distorsión para síntesis analógica
  makeDistortionCurve(amount = 20) {
    const k = typeof amount === 'number' ? amount : 20;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  // Disparo procedural (boom bajo + pólvora)
  playDisparoProcedural() {
    if (this.efectosMuted || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const subOsc = this.ctx.createOscillator();
      const subGain = this.ctx.createGain();
      subOsc.type = 'sawtooth';
      subOsc.frequency.setValueAtTime(200, now);
      subOsc.frequency.exponentialRampToValueAtTime(28, now + 0.45);

      subGain.gain.setValueAtTime(1.0, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

      const waveshaper = this.ctx.createWaveShaper();
      waveshaper.curve = this.makeDistortionCurve(40);
      waveshaper.oversample = '4x';

      subOsc.connect(waveshaper);
      waveshaper.connect(subGain);
      subGain.connect(this.ctx.destination);

      subOsc.start(now);
      subOsc.stop(now + 0.55);

      const bufferSize = Math.floor(this.ctx.sampleRate * 0.4);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.08));
      }

      const noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = buffer;
      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(1400, now);
      noiseFilter.frequency.exponentialRampToValueAtTime(180, now + 0.35);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(1.1, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.005, now + 0.38);

      noiseSource.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);
      noiseSource.start(now);
    } catch (_) {}
  }

  // 🩸 Grito de dolor agónico de la víctima
  playGritoDolor(esMortal = false) {
    if (this.efectosMuted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const duracion = esMortal ? 1.25 : 0.65;

      // Golpe carnoso en el cuerpo
      const fleshOsc = this.ctx.createOscillator();
      const fleshGain = this.ctx.createGain();
      fleshOsc.type = 'triangle';
      fleshOsc.frequency.setValueAtTime(130, now);
      fleshOsc.frequency.exponentialRampToValueAtTime(30, now + 0.2);
      fleshGain.gain.setValueAtTime(0.75, now);
      fleshGain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      fleshOsc.connect(fleshGain);
      fleshGain.connect(this.ctx.destination);
      fleshOsc.start(now);
      fleshOsc.stop(now + 0.2);

      // Síntesis vocal humana en dolor
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.frequency.setValueAtTime(15, now);
      lfoGain.gain.setValueAtTime(80, now);

      const screamOsc = this.ctx.createOscillator();
      screamOsc.type = 'sawtooth';
      const fInicial = esMortal ? 790 : 640;
      const fFinal = esMortal ? 130 : 220;
      screamOsc.frequency.setValueAtTime(fInicial, now + 0.03);
      screamOsc.frequency.exponentialRampToValueAtTime(fFinal, now + duracion);

      lfo.connect(screamOsc.frequency);

      const throatFilter = this.ctx.createBiquadFilter();
      throatFilter.type = 'bandpass';
      throatFilter.frequency.setValueAtTime(esMortal ? 1150 : 920, now);
      throatFilter.frequency.exponentialRampToValueAtTime(360, now + duracion);
      throatFilter.Q.setValueAtTime(3.5, now);

      const screamGain = this.ctx.createGain();
      screamGain.gain.setValueAtTime(0.001, now);
      screamGain.gain.linearRampToValueAtTime(0.7, now + 0.08);
      screamGain.gain.exponentialRampToValueAtTime(0.005, now + duracion);

      screamOsc.connect(throatFilter);
      throatFilter.connect(screamGain);
      screamGain.connect(this.ctx.destination);

      lfo.start(now + 0.03);
      screamOsc.start(now + 0.03);
      lfo.stop(now + duracion);
      screamOsc.stop(now + duracion);

      if (esMortal) {
        setTimeout(() => this.playCampanaMuerte(), 380);
      }
    } catch (_) {}
  }

  // 🔔 Campana fúnebre
  playCampanaMuerte() {
    if (this.efectosMuted || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const freqs = [185, 370, 555, 740];
      freqs.forEach((f, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, now);
        gain.gain.setValueAtTime(0.3 / (i + 1), now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.4);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 2.4);
      });
    } catch (_) {}
  }

  // 🎯 Sonido de fijar puntería láser
  playApuntar() {
    if (this.efectosMuted) return;
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1400, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.12);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.12);
    } catch (_) {}
  }

  // 💓 Latido de corazón
  playLatido() {
    if (this.efectosMuted || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      this.thump(now, 68, 0.12, 0.4);
      this.thump(now + 0.22, 52, 0.15, 0.3);
    } catch (_) {}
  }

  thump(time, freq, dur, vol) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, time);
    osc.frequency.exponentialRampToValueAtTime(28, time + dur);
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(time);
    osc.stop(time + dur);
  }

  // Alerta de turno
  playAlertaTurno(esMiTurno = false) {
    if (this.efectosMuted) return;
    this.init();
    if (esMiTurno) {
      this.playLatido();
    }
  }

  // Recarga / corredera
  playRecarga() {
    if (this.efectosMuted) return;
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      this.tock(now, 720, 0.05, 0.35);
      this.tock(now + 0.12, 480, 0.08, 0.45);
    } catch (_) {}
  }

  tock(time, freq, dur, vol = 0.3) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.005, time + dur);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(time);
    osc.stop(time + dur);
  }

  // Objetos
  playSalud() {
    if (this.efectosMuted || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      [330, 440, 550, 660].forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.07);
        gain.gain.setValueAtTime(0.25, now + i * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.07 + 0.2);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + i * 0.07);
        osc.stop(now + i * 0.07 + 0.2);
      });
    } catch (_) {}
  }

  playEscudo() {
    if (this.efectosMuted || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.exponentialRampToValueAtTime(700, now + 0.3);
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    } catch (_) {}
  }

  playDobleDano() {
    if (this.efectosMuted || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(90, now);
      osc.frequency.linearRampToValueAtTime(320, now + 0.25);
      gain.gain.setValueAtTime(0.45, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    } catch (_) {}
  }

  playVista() {
    if (this.efectosMuted || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(750, now);
      osc.frequency.linearRampToValueAtTime(1150, now + 0.18);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    } catch (_) {}
  }

  playVictoria() {
    if (this.efectosMuted || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const notas = [220, 277.18, 329.63, 440, 554.37];
      notas.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const t = now + idx * 0.16;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.4, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.5);
      });
    } catch (_) {}
  }
}

export const ruletaAudio = new RuletaAudio();
