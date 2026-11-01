/* Hero tooth, built from two photos (dirty + clean) supplied in assets/tooth/.
   WebGL draws them on a quad that turns in 3D as you scroll. The plaque dissolves in an organic pattern behind a foam
   front, the enamel highlights slide across as it turns, then a polish sweep + sparkles finish it.
   Plain WebGL, no libraries.  window.Tooth.setProgress(p) takes hero scroll 0..1. */
(function () {
  const root = document.querySelector('[data-tooth]');
  if (!root) return;
  const cvGL = root.querySelector('[data-gl]');
  const cvFX = root.querySelector('[data-fx]');
  const fallback = root.querySelector('[data-fallback]');

  /* ---- settings ---- */
  const CFG = {
    cleanFrom: 0.08, cleanUntil: 0.85,   // scroll window where plaque is brushed away
    turnFrom: -30, turnTo: 24,           // degrees the tooth turns (left -> right) over the whole scroll
    tiltFrom: -7, tiltTo: 5,             // up/down tilt in degrees
    size: 0.84                           // tooth size inside its box (leaves room to turn)
  };
  const SPARKLE = [36, 71, 232];         // #2347E8
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp01 = v => Math.max(0, Math.min(1, v));
  const smooth = v => v * v * (3 - 2 * v);
  const lerp = (a, b, t) => a + (b - a) * t;

  const VERT = `attribute vec2 a;
uniform vec3 uRot; uniform float uSize; uniform float uTime; uniform vec2 uAspect;
varying vec2 vUv;
void main(){
  vec3 p = vec3(a.x * uSize, a.y * uSize, 0.0);
  float cy = cos(uRot.y), sy = sin(uRot.y), cx = cos(uRot.x), sx = sin(uRot.x), cz = cos(uRot.z), sz = sin(uRot.z);
  p = vec3(cz*p.x - sz*p.y, sz*p.x + cz*p.y, p.z);          // roll
  p = vec3(p.x, cx*p.y - sx*p.z, sx*p.y + cx*p.z);          // tilt
  p = vec3(cy*p.x + sy*p.z, p.y, -sy*p.x + cy*p.z);         // turn
  p.y += sin(uTime * 1.1) * 0.018;                          // gentle float
  float w = 1.0 - p.z * 0.55;                                // perspective
  gl_Position = vec4(p.xy, 0.0, w);
  vUv = a * 0.5 + 0.5;
}`;

  const FRAG = `precision highp float;
varying vec2 vUv;
uniform sampler2D uD; uniform sampler2D uC;
uniform float uClean; uniform float uTime; uniform float uAng; uniform vec2 uTexel;
float hash(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
float noise(vec2 x){ vec2 i=floor(x), f=fract(x); f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float s=0.0, a=0.5; for(int i=0;i<4;i++){ s+=a*noise(p); p*=2.03; a*=0.5; } return s; }
float voro(vec2 p){ vec2 b=floor(p), f=fract(p); float d=1.0;
  for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){ vec2 g=vec2(float(i),float(j)); vec2 o=vec2(hash(b+g),hash(b+g+7.7)); vec2 r=g+o-f; d=min(d,dot(r,r)); }
  return sqrt(d); }
float lum(vec3 c){ return dot(c, vec3(0.299,0.587,0.114)); }
void main(){
  vec2 uv = vUv;
  vec4 d = texture2D(uD, uv);
  vec4 c = texture2D(uC, uv);
  float al = c.a;
  if (al < 0.003) { gl_FragColor = vec4(0.0); return; }

  /* brushing front: sweeps left -> right with a ragged organic edge */
  float w = uv.x * 0.78 + (1.0 - uv.y) * 0.22;
  float n = fbm(uv * 7.0 + 3.1);
  float front = mix(-0.22, 1.22, uClean);
  float edge = front + (n - 0.5) * 0.34;
  float cleaned = smoothstep(w - 0.035, w + 0.035, edge);
  if (uClean >= 0.999) cleaned = 1.0;
  if (uClean <= 0.0005) cleaned = 0.0;
  vec3 base = mix(d.rgb, c.rgb, cleaned);

  /* foam riding the front */
  float band = exp(-abs(w - edge) * 16.0) * step(0.004, uClean) * step(uClean, 0.992);
  float cell = voro(uv * 26.0 + vec2(0.0, uTime * 0.35));
  float bub = smoothstep(0.42, 0.16, cell);
  float rim = smoothstep(0.30, 0.42, cell) * smoothstep(0.55, 0.36, cell);
  float foam = clamp(band * (0.5 + 0.5 * bub), 0.0, 1.0);
  base = mix(base, vec3(1.0) * al, foam * 0.9);
  base += vec3(0.55, 0.68, 0.9) * rim * band * 0.28 * al;

  /* lighting from the picture's own luminance, so highlights slide as the tooth turns */
  float lx = lum(texture2D(uC, uv + vec2(uTexel.x, 0.0)).rgb) - lum(texture2D(uC, uv - vec2(uTexel.x, 0.0)).rgb);
  float ly = lum(texture2D(uC, uv + vec2(0.0, uTexel.y)).rgb) - lum(texture2D(uC, uv - vec2(0.0, uTexel.y)).rgb);
  vec3 N = normalize(vec3(-lx * 5.0, -ly * 5.0, 1.0));
  vec3 L = normalize(vec3(-0.45 - sin(uAng) * 1.6, 0.65, 0.75));
  vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
  float polish = smoothstep(0.55, 1.0, uClean) * cleaned;
  float spec = pow(max(dot(N, H), 0.0), 26.0) * (0.10 + 0.55 * polish) * al;
  float hi = smoothstep(0.80, 0.985, lum(c.rgb / max(al, 0.001)));        // only the brightest enamel glints
  base += vec3(1.0) * spec * (0.35 + 0.65 * hi);

  /* polish sweep: one bright band crossing the finished tooth */
  float ph = clamp((uClean - 0.78) / 0.22, 0.0, 1.0);
  float sw = mix(-0.35, 1.35, ph);
  float line = uv.x * 0.75 + (1.0 - uv.y) * 0.45 - 0.2;
  float band2 = smoothstep(0.16, 0.0, abs(line - sw)) * step(0.001, ph) * (1.0 - step(0.999, ph)) * cleaned;
  base += vec3(1.0, 1.0, 1.0) * band2 * 0.38 * (0.25 + 0.75 * hi) * al;

  /* the side turning away goes a touch cooler and darker */
  float side = sin(uAng) * (uv.x - 0.5) * 2.0;
  base *= 1.0 - 0.14 * max(side, 0.0);
  base += vec3(0.02, 0.04, 0.08) * max(side, 0.0) * al;

  gl_FragColor = vec4(clamp(base, 0.0, 1.0), al);
}`;

  /* scroll progress -> pose */
  function pose(e) {
    const clean = clamp01((e - CFG.cleanFrom) / Math.max(0.01, CFG.cleanUntil - CFG.cleanFrom));
    const k = smooth(e), r = Math.PI / 180;
    return { clean, turn: lerp(CFG.turnFrom, CFG.turnTo, k) * r, tilt: lerp(CFG.tiltFrom, CFG.tiltTo, k) * r, roll: lerp(-0.05, 0.03, k) };
  }

  let target = reduced ? 1 : 0, eased = target;
  const api = { onFrame: null, setProgress(p) { target = reduced ? 1 : clamp01(p); } };
  window.Tooth = api;

  const gl = cvGL.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: true });
  const useFallback = () => { cvGL.hidden = cvFX.hidden = true; if (fallback) fallback.hidden = false; };
  if (!gl) { useFallback(); return; }

  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { useFallback(); return; }
  gl.useProgram(prog);

  /* quad as two triangles, finely subdivided is not needed: the perspective is per-vertex-exact */
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'a');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = n => gl.getUniformLocation(prog, n);
  const uRot = U('uRot'), uSize = U('uSize'), uTime = U('uTime'), uClean = U('uClean'), uAng = U('uAng'), uTexel = U('uTexel');
  gl.uniform1i(U('uD'), 0);
  gl.uniform1i(U('uC'), 1);
  gl.uniform1f(uSize, CFG.size);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  /* load the two photos */
  let loaded = 0, imgW = 691, imgH = 734;
  function tex(unit, src) {
    const t = gl.createTexture();
    const img = new Image();
    img.onload = () => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      imgW = img.naturalWidth; imgH = img.naturalHeight;
      gl.uniform2f(uTexel, 1 / imgW, 1 / imgH);
      loaded++;
      if (reduced && loaded === 2) render(0, 0.016);
    };
    img.onerror = useFallback;
    img.src = src;
  }
  tex(0, 'assets/tooth/dirty.webp');
  tex(1, 'assets/tooth/clean.webp');

  const fx = cvFX.getContext('2d');
  let W = 1, H = 1, DPR = 1;
  function resize() {
    const r = root.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    DPR = Math.min(window.devicePixelRatio || 1, W < 500 ? 2 : 1.75);
    cvGL.width = cvFX.width = Math.round(W * DPR);
    cvGL.height = cvFX.height = Math.round(H * DPR);
    gl.viewport(0, 0, cvGL.width, cvGL.height);
    if (reduced && loaded === 2) render(0, 0.016);
  }
  resize();
  new ResizeObserver(resize).observe(root);

  /* soft contact shadow, floating bubbles, sparkles: overlay canvas */
  const bubbles = [];
  const sc = SPARKLE.join(',');
  function star(x, y, r, alpha) {
    fx.save(); fx.translate(x, y); fx.globalAlpha = alpha; fx.fillStyle = 'rgb(' + sc + ')';
    fx.beginPath();
    for (let i = 0; i < 8; i++) { const t = i * Math.PI / 4, rr = i % 2 === 0 ? r : r * 0.22; fx.lineTo(Math.cos(t) * rr, Math.sin(t) * rr); }
    fx.closePath(); fx.fill(); fx.restore();
  }
  function drawFX(time, dt, ps, speed) {
    fx.setTransform(DPR, 0, 0, DPR, 0, 0);
    fx.clearRect(0, 0, W, H);
    const m = Math.min(W, H), cx = W / 2, cy = H / 2;
    const th = CFG.size * 0.5 * m;                       // half size of the tooth on screen
    const clean = ps.clean;
    const rate = (clean > 0.01 && clean < 0.99 ? Math.sin(Math.PI * clean) : 0) * (0.6 + Math.min(1.5, speed * 40));
    if (Math.random() < rate * dt * 16) {
      const px = cx + (clean * 1.3 - 0.65) * th * 1.5 + (Math.random() - 0.5) * th * 0.5;   // follows the brushing front
      bubbles.push({ x: px, y: cy + th * (0.05 - Math.random() * 0.75), r: m * (0.005 + Math.random() * 0.016),
        vy: -m * (0.04 + Math.random() * 0.08), vx: (Math.random() - 0.5) * m * 0.03, life: 0, max: 1.2 + Math.random() * 1.4 });
    }
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      b.life += dt; b.x += b.vx * dt + Math.sin(time * 3 + i) * 0.2; b.y += b.vy * dt;
      if (b.life >= b.max) { bubbles.splice(i, 1); continue; }
      const k = Math.sin(Math.PI * Math.min(1, b.life / b.max));
      fx.beginPath(); fx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      fx.fillStyle = 'rgba(255,255,255,' + (0.35 * k) + ')'; fx.fill();
      fx.lineWidth = 1; fx.strokeStyle = 'rgba(150,175,215,' + (0.6 * k) + ')'; fx.stroke();
    }
    const s = clamp01((clean - 0.88) / 0.12);
    if (s > 0) {
      [[-0.30, -0.30, 1], [0.22, -0.36, 0.75], [0.34, -0.08, 0.55], [-0.36, 0.02, 0.5], [0.02, -0.40, 0.55], [0.12, 0.12, 0.4]].forEach(([dx, dy, sz], i) => {
        const tw = 0.55 + 0.45 * Math.sin(time * 2.4 + i * 1.7);
        star(cx + dx * th * 2 * 0.95, cy + dy * th * 2 * 0.95, m * 0.032 * sz * tw * s, s * (0.6 + 0.4 * tw));
      });
    }
  }

  function render(time, dt) {
    if (loaded < 2) return;
    const prev = eased;
    eased += (target - eased) * Math.min(1, dt * 7);
    if (Math.abs(target - eased) < 5e-4) eased = target;
    const ps = pose(eased);
    gl.uniform3f(uRot, ps.tilt, ps.turn, ps.roll);
    gl.uniform1f(uTime, time);
    gl.uniform1f(uClean, ps.clean);
    gl.uniform1f(uAng, ps.turn);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    drawFX(time, dt, ps, Math.abs(eased - prev));
    if (api.onFrame) api.onFrame(ps.clean, eased);
  }
  api.renderAt = p => { target = eased = clamp01(p); render(performance.now() / 1000, 0.016); };

  if (reduced) return;

  let visible = true, raf = 0, last = performance.now();
  function loop(now) {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    render(now / 1000, dt);
    if (visible) raf = requestAnimationFrame(loop);
  }
  new IntersectionObserver(es => {
    visible = es[0].isIntersecting;
    if (visible && !raf) { last = performance.now(); raf = requestAnimationFrame(loop); }
  }).observe(root);
  raf = requestAnimationFrame(loop);
})();
