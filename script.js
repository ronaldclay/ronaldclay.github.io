/* =========================================================================
   Galaxia — Día de las Flores Amarillas
   Escena 3D (Three.js): dos personajes aviadores en el centro, anillo
   dorado, y cada frase con su flor 3D, entre chispas de estrellas.

   Para cambiar las frases NO toques este archivo: edita config.js
   ========================================================================= */
(function () {
  'use strict';

  /* ------------------------------ Ajustes -------------------------------- */
  const DEFAULTS = {
    titulo: "Feliz Día de las Flores Amarillas 🌻",
    frases: ["🌻 Como el girasol, miro hacia ti"],
    cuantas: 70,
    chispas: { cantidad: 900 },
    musica: "assets/musica.mp3",
    ambiente: true
  };
  const CFG = Object.assign({}, DEFAULTS, window.FLORES || {});

  const $ = function (id) { return document.getElementById(id); };
  $('main-title').textContent = CFG.titulo;

  /* --------------------------- Motor / cámara ---------------------------- */
  const canvas = $('c');
  const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  if ('outputEncoding' in renderer) renderer.outputEncoding = THREE.sRGBEncoding;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 6000);

  let targetDist = 300, currentDist = 300, rotX = 0.2, rotY = 0;

  // Límites de inclinación vertical. Subir la vista hasta arriba (vista de
  // pájaro) dejaba ver las fotos PNG desde un ángulo que las delataba, así que
  // se recorta por arriba. ROTX_MAX es el tope "hacia arriba".
  const ROTX_MIN = -1.2, ROTX_MAX = 0.5;

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener('resize', resize);

  /* ------------------------------ Texturas ------------------------------- */
  function canvasTex(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    if ('encoding' in t) t.encoding = THREE.sRGBEncoding;
    t.anisotropy = 4;
    return t;
  }

  // Halo dorado
  const glowTexture = canvasTex(512, 512, function (g, w) {
    const grd = g.createRadialGradient(w / 2, w / 2, w * 0.03, w / 2, w / 2, w * 0.5);
    grd.addColorStop(0.00, 'rgba(255,242,170,0.60)');
    grd.addColorStop(0.45, 'rgba(255,186,30,0.24)');
    grd.addColorStop(1.00, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, w);
  });

  /* ------------------------------- Luces --------------------------------- */
  // Intensidades bajas a propósito: el fondo es negro y si se suma demasiada
  // luz las texturas se queman y las flores se ven planas.
  scene.add(new THREE.AmbientLight(0xffe9b0, 0.22));

  const keyLight = new THREE.DirectionalLight(0xfff2c8, 0.45);
  keyLight.position.set(280, 330, 250);
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0xff9c1a, 0.22);
  rimLight.position.set(-280, -160, -320);
  scene.add(rimLight);

  const coreLight = new THREE.PointLight(0xffcf5a, 0.32, 1500, 1.6);
  coreLight.position.set(0, 34, 62);   // delante y arriba, para iluminar a los personajes
  scene.add(coreLight);

  // Luz pegada a la cámara: así toda flor que mira al espectador recibe luz
  // rasante y se le ven el volumen, las sombras de los pétalos y el domo.
  const camLight = new THREE.PointLight(0xfff6dc, 0.68, 1400, 1.5);
  camLight.position.set(45, 70, 110);
  camera.add(camLight);
  scene.add(camera);

  /* --------------------------- Los personajes ---------------------------- */
  // Snoopy es la imagen snoopy.png (un sprite, siempre de cara a la cámara).
  const ALTO_PERSONAJES = 2.35;                 // altura en unidades locales
  const personajes = new THREE.Group();

  // Snoopy: la propia imagen snoopy.png. Al ser un sprite, mira siempre a la
  // cámara aunque el grupo se mueva.
  const snoopy = new THREE.Sprite(new THREE.SpriteMaterial({
    transparent: true, depthWrite: false
  }));
  snoopy.position.set(0, 1.05, 0);
  snoopy.scale.set(ALTO_PERSONAJES * 0.955, ALTO_PERSONAJES, 1);

  personajes.add(snoopy);
  personajes.scale.setScalar(72 / ALTO_PERSONAJES);
  personajes.position.y = -36;                  // centrados donde estaba el planeta
  scene.add(personajes);

  new THREE.TextureLoader().load('assets/snoopy.png', function (tex) {
    if ('encoding' in tex) tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = 4;
    snoopy.material.map = tex;
    snoopy.material.needsUpdate = true;
    const im = tex.image;
    if (im && im.width && im.height) {
      snoopy.scale.set(ALTO_PERSONAJES * (im.width / im.height), ALTO_PERSONAJES, 1);
    }
  });

  /* ---------------- Imágenes PNG (siempre miran a la cámara) -------------- */
  // Son "sprites": en Three.js un sprite siempre encara la cámara, así que se
  // ven de frente por mucho que gires la escena.
  const FOTO_SRCS = [
    'assets/rosa1.png', 'assets/rosa2.png', 'assets/rosa3.png',
    'assets/rosa4.png', 'assets/rosa5.png', 'assets/rosa6.png'
  ];

  const fotoTextures = [];   // cada imagen se carga una sola vez

  // Crea un sprite desde una textura ya cargada, respetando su proporción
  function makeFotoSprite(tex, height) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex || null, transparent: true, depthWrite: false, opacity: 0.98
    }));
    const im = tex && tex.image;
    const aspect = (im && im.width && im.height) ? (im.width / im.height) : 1;
    sp.scale.set(height * aspect, height, 1);
    return sp;
  }

  // Imágenes sueltas que flotan alrededor del centro
  const fotos = [];
  function buildFotos() {
    FOTO_SRCS.forEach(function (src, i) {
      const sp = makeFotoSprite(fotoTextures[i], 54 + (i % 3) * 14);
      sp.userData = {
        angle: (i / FOTO_SRCS.length) * Math.PI * 2 + Math.random() * 0.35,
        radius: 138 + (i % 3) * 40,
        height: -28 + (i % 4) * 24,
        spin: 0.03 + Math.random() * 0.028,
        bob: 0.5 + Math.random() * 0.5,
        bobAmp: 7 + Math.random() * 8,
        phase: Math.random() * Math.PI * 2
      };
      fotos.push(sp);
      scene.add(sp);
    });
  }

  /* -------------------------------- Halo --------------------------------- */
  // Más suave que antes: con los personajes en el centro, un halo tan fuerte
  // los dejaba a contraluz y el pajarito desaparecía en el resplandor.
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, opacity: 0.5
  }));
  glow.scale.set(320, 320, 1);
  scene.add(glow);

  /* ------------------------------ Estrellas ------------------------------ */
  (function stars() {
    const count = window.innerWidth < 768 ? 900 : 2000;
    const spread = 3000;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = spread * (0.3 + Math.random() * 0.7);
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.cos(ph);
      pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(geo, new THREE.PointsMaterial({
      size: 1.7, color: 0xffffff, depthWrite: false, transparent: true, opacity: 0.9
    })));
  })();

  /* ----------------------- Chispas doradas (destellos) -------------------- */
  // Partículas con forma de estrella de 4 puntas que titilan, en tonos
  // amarillos. Se dibujan con un shader propio para poder parpadear una a una.
  const SPARKS = (function () {
    const n = Math.max(0, Math.min(4000, (CFG.chispas && CFG.chispas.cantidad) | 0 || 900));
    if (!n) return null;

    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const siz = new Float32Array(n);
    const pha = new Float32Array(n);
    const palette = [
      [1.00, 0.93, 0.62],   // amarillo pálido
      [1.00, 0.83, 0.30],   // dorado
      [1.00, 0.68, 0.12],   // ámbar
      [1.00, 1.00, 0.92],   // blanco cálido
      [1.00, 0.88, 0.48],
      [1.00, 0.75, 0.18]
    ];

    for (let i = 0; i < n; i++) {
      const r = 140 + Math.random() * 1500;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.cos(ph) * 0.75;
      pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);

      const c = palette[(Math.random() * palette.length) | 0];
      col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];

      siz[i] = 5 + Math.random() * 26;
      pha[i] = Math.random() * Math.PI * 2;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(siz, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(pha, 1));

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPR: { value: Math.min(window.devicePixelRatio || 1, 2) }
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: [
        'attribute vec3 aColor;',
        'attribute float aSize;',
        'attribute float aPhase;',
        'uniform float uTime;',
        'uniform float uPR;',
        'varying vec3 vColor;',
        'varying float vAlpha;',
        'void main() {',
        '  vColor = aColor;',
        '  vAlpha = 0.30 + 0.70 * (0.5 + 0.5 * sin(uTime * 2.2 + aPhase));',
        '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
        '  gl_PointSize = aSize * uPR * (340.0 / max(1.0, -mv.z));',
        '  gl_Position = projectionMatrix * mv;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'varying vec3 vColor;',
        'varying float vAlpha;',
        'void main() {',
        '  vec2 uv = gl_PointCoord - vec2(0.5);',
        '  float d = length(uv);',
        '  float core = 1.0 - smoothstep(0.0, 0.5, d);',
        '  float h = (1.0 - smoothstep(0.0, 0.5, abs(uv.y) * 7.0))',
        '          * (1.0 - smoothstep(0.0, 0.5, abs(uv.x) * 1.1));',
        '  float v = (1.0 - smoothstep(0.0, 0.5, abs(uv.x) * 7.0))',
        '          * (1.0 - smoothstep(0.0, 0.5, abs(uv.y) * 1.1));',
        '  float a = core * 0.95 + (h + v) * 0.55;',
        '  if (a < 0.004) discard;',
        '  gl_FragColor = vec4(vColor, a * vAlpha);',
        '}'
      ].join('\n')
    });

    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    scene.add(points);
    return { points: points, mat: mat };
  })();

  /* ------------------------------- Frases -------------------------------- */
  const COLORS = ['#ffd700', '#ffe066', '#ffcc33', '#ffb347', '#fff2b0', '#ffaa00', '#f4c430', '#e6b800', '#ffdb58', '#f0c419'];
  const FONT = "px 'Indie Flower', 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', cursive";
  const TEXT_H = 21.8;   // alto del texto en la escena (igual para todas)
  const TEXT_MAX_W = 72; // ancho máximo: las frases largas se reducen, no se cortan
  const IMG_H = 26;      // alto de la imagen que acompaña a cada frase

  // Dibuja la frase en un canvas del ancho justo para que quepa ENTERA
  // (antes era de 512 fijo y las frases largas se cortaban por los lados).
  function makeTextTexture(text, color) {
    const fontSize = 48;
    const pad = 40;                                  // margen para el brillo
    const tmp = document.createElement('canvas').getContext('2d');
    tmp.font = fontSize + FONT;
    const textW = Math.ceil(tmp.measureText(text).width);

    const c = document.createElement('canvas');
    c.width = Math.max(64, textW + pad * 2);
    c.height = 96;

    const g = c.getContext('2d');
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#fff';
    g.shadowColor = color;
    g.shadowBlur = 24;
    g.font = fontSize + FONT;
    g.fillText(text, c.width / 2, c.height / 2);

    const t = new THREE.CanvasTexture(c);
    if ('encoding' in t) t.encoding = THREE.sRGBEncoding;
    t.anisotropy = 4;
    return t;
  }

  const units = [];

  function buildUnits() {
    const frases = (Array.isArray(CFG.frases) && CFG.frases.length) ? CFG.frases : DEFAULTS.frases;
    const TOTAL = Math.max(1, Math.min(200, (CFG.cuantas | 0) || 70));
    const paso = Math.max(1, TOTAL - 1);
    const GOLDEN = Math.PI * (3 - Math.sqrt(5));

    for (let i = 0; i < TOTAL; i++) {
      const holder = new THREE.Group();

      // la frase (siempre de cara a la cámara, con su ancho real)
      const tex = makeTextTexture(String(frases[i % frases.length]), COLORS[i % COLORS.length]);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, transparent: true, depthWrite: false
      }));
      const aspect = tex.image.width / tex.image.height;
      const w = Math.min(TEXT_H * aspect, TEXT_MAX_W);
      sp.scale.set(w, w / aspect, 1);
      holder.add(sp);

      // su imagen, una cualquiera, colgando debajo de la frase
      if (fotoTextures.length) {
        const img = makeFotoSprite(fotoTextures[(Math.random() * fotoTextures.length) | 0], IMG_H);
        img.position.y = -IMG_H * 1.3;
        holder.add(img);
      }

      // Reparto uniforme (espiral de Fibonacci) y radios escalonados
      const y = 1 - (i / paso) * 2;
      holder.userData = {
        phi: Math.acos(Math.max(-1, Math.min(1, y))),
        theta: GOLDEN * i,
        radius: 170 + 170 * (i / paso),
        speed: 0.05 + Math.random() * 0.05,
        phase: Math.random() * Math.PI * 2
      };
      holder.rotation.y = Math.random() * Math.PI * 2;
      holder.userData.frase = sp;

      units.push(holder);
      scene.add(holder);
    }
  }

  // Se monta todo cuando están listas las imágenes y la fuente (así cada
  // frase se mide bien y ya lleva su imagen).
  let fotosListas = false, fuentesListas = false;

  function construir() {
    if (!fotosListas || !fuentesListas) return;
    buildFotos();
    buildUnits();
  }

  (function cargarFotos() {
    const loader = new THREE.TextureLoader();
    let pend = FOTO_SRCS.length;
    if (!pend) { fotosListas = true; construir(); return; }
    function unaMenos() { if (--pend === 0) { fotosListas = true; construir(); } }
    FOTO_SRCS.forEach(function (src, i) {
      loader.load(src, function (tex) {
        if ('encoding' in tex) tex.encoding = THREE.sRGBEncoding;
        tex.anisotropy = 4;
        fotoTextures[i] = tex;
        unaMenos();
      }, undefined, unaMenos);
    });
  })();

  if (document.fonts && document.fonts.load) {
    document.fonts.load("40px 'Indie Flower'").catch(function () {}).then(function () {
      fuentesListas = true;
      construir();
    });
  } else {
    fuentesListas = true;
    construir();
  }

  /* ------------------------------- Controles ----------------------------- */
  let dragging = false, lastX = 0, lastY = 0;

  function onDown(e) {
    dragging = true;
    const tp = e.touches ? e.touches[0] : e;
    lastX = tp.clientX;
    lastY = tp.clientY;
  }
  function onMove(e) {
    if (!dragging) return;
    const tp = e.touches ? e.touches[0] : e;
    rotY -= (tp.clientX - lastX) / window.innerWidth * 5;
    rotX = Math.max(ROTX_MIN, Math.min(ROTX_MAX, rotX + (tp.clientY - lastY) / window.innerHeight * 3.5));
    lastX = tp.clientX;
    lastY = tp.clientY;
  }
  function onUp() { dragging = false; }

  addEventListener('mousedown', onDown);
  addEventListener('mousemove', onMove);
  addEventListener('mouseup', onUp);
  addEventListener('touchstart', onDown, { passive: true });
  addEventListener('touchmove', onMove, { passive: true });
  addEventListener('touchend', onUp, { passive: true });

  addEventListener('wheel', function (e) {
    targetDist = Math.max(160, Math.min(600, targetDist + e.deltaY * 0.25));
  }, { passive: true });

  let pinch = 0;
  addEventListener('touchmove', function (e) {
    if (e.touches && e.touches.length === 2) {
      e.preventDefault();
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      if (pinch) targetDist = Math.max(160, Math.min(600, targetDist + (pinch - d) * 0.5));
      pinch = d;
    }
  }, { passive: false });
  addEventListener('touchend', function () { pinch = 0; }, { passive: true });

  /* ------------------------------ Animación ------------------------------ */
  let t = 0, prev = 0;

  function animate(now) {
    requestAnimationFrame(animate);
    if (!prev) prev = now;
    let dt = (now - prev) / 1000;
    prev = now;
    if (!isFinite(dt) || dt <= 0) dt = 0.016;
    if (dt > 0.05) dt = 0.05;
    t += dt;

    const pulse = 1 + 0.03 * Math.sin(t * 1.6);
    glow.scale.set(320 * pulse, 320 * pulse, 1);
    personajes.position.y = -36 + Math.sin(t * 1.1) * 1.6;   // flota suave

    for (let i = 0; i < units.length; i++) {
      const u = units[i];
      const d = u.userData;
      d.theta += d.speed * dt;
      const sp = Math.sin(d.phi);
      u.position.set(
        d.radius * sp * Math.cos(d.theta),
        d.radius * Math.cos(d.phi),
        d.radius * sp * Math.sin(d.theta)
      );
      d.frase.material.opacity = 0.8 + 0.2 * Math.sin(t * 2 + d.phase);
    }

    for (let i = 0; i < fotos.length; i++) {
      const f = fotos[i];
      const d = f.userData;
      d.angle += d.spin * dt;
      f.position.set(
        Math.cos(d.angle) * d.radius,
        d.height + Math.sin(t * d.bob + d.phase) * d.bobAmp,
        Math.sin(d.angle) * d.radius
      );
    }

    if (SPARKS) SPARKS.mat.uniforms.uTime.value = t;

    currentDist += (targetDist - currentDist) * Math.min(1, 6 * dt);
    const cx = Math.cos(rotX), sx = Math.sin(rotX);
    const cy = Math.cos(rotY), sy = Math.sin(rotY);
    camera.position.set(currentDist * sy * cx, currentDist * sx, currentDist * cy * cx);
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
  }
  requestAnimationFrame(animate);

  /* -------------------------- Arranque + música -------------------------- */
  const audio = $('audio');
  if (audio) {
    const src = audio.querySelector('source');
    if (src) { src.src = CFG.musica; audio.load(); }
  }

  let ambientCtx = null;
  function startAmbient() {
    if (!CFG.ambiente || ambientCtx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      ambientCtx = new AC();
      const master = ambientCtx.createGain();
      master.gain.value = 0.0001;
      master.gain.setTargetAtTime(0.05, ambientCtx.currentTime, 3);
      master.connect(ambientCtx.destination);

      const filt = ambientCtx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = 900;
      filt.connect(master);

      const notes = [220, 277.18, 329.63, 440];
      for (let i = 0; i < notes.length; i++) {
        const osc = ambientCtx.createOscillator();
        osc.type = (i % 2) ? 'sine' : 'triangle';
        osc.frequency.value = notes[i];

        const g = ambientCtx.createGain();
        g.gain.value = 0.25 / (i + 1);

        const lfo = ambientCtx.createOscillator();
        lfo.frequency.value = 0.05 + 0.03 * i;
        const lg = ambientCtx.createGain();
        lg.gain.value = 0.06;
        lfo.connect(lg);
        lg.connect(g.gain);

        osc.connect(g);
        g.connect(filt);
        osc.start();
        lfo.start();
      }
    } catch (err) { /* sin audio no pasa nada */ }
  }

  const startScreen = $('start-screen');
  let started = false;

  function startExperience() {
    if (started) return;
    started = true;
    startScreen.classList.add('hidden');
    setTimeout(function () { startScreen.style.display = 'none'; }, 800);

    if (audio) {
      const played = audio.play();
      if (played && played.catch) played.catch(startAmbient);
    } else {
      startAmbient();
    }
  }

  startScreen.addEventListener('click', startExperience);
})();
