/* Hero tooth: real-time 3D molar (ray-marched in a WebGL fragment shader).
   Scroll turns it, brushes the plaque away with foam, then polishes it and adds sparkles.
   Plain WebGL, no libraries. Exposes window.Tooth.setProgress(p) where p is hero scroll 0..1. */
(function () {
  const root = document.querySelector('[data-tooth]');
  if (!root) return;
  const cvGL = root.querySelector('[data-gl]');
  const cvFX = root.querySelector('[data-fx]');
  const fallback = root.querySelector('[data-fallback]');

  /* ---- settings (same defaults as the original hero) ---- */
  const CFG = { cleanFrom: 0.08, cleanUntil: 0.85, turn: 95 };
  const AMBIENT = [0.74, 0.84, 0.98];   // sky tint  #BCD6FA
  const SHADOW  = [0.20, 0.30, 0.50];   // contact shadow #334D80
  const FOAM    = [1, 1, 1];
  const SPARKLE = [0.14, 0.28, 0.91];   // #2347E8
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp01 = v => Math.max(0, Math.min(1, v));
  const smooth = v => v * v * (3 - 2 * v);

  const VERT = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.0,1.0);}';
  const FRAG = `precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uClean;
uniform vec3 uRot;
uniform float uScale;
uniform vec3 uTint;
uniform vec3 uShadow;
uniform vec3 uFoam;

float hash(vec3 p){ p = fract(p*0.3183099+.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float noise(vec3 x){
  vec3 i = floor(x); vec3 f = fract(x); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(hash(i+vec3(0,0,0)),hash(i+vec3(1,0,0)),f.x), mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x), mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float fbm(vec3 p){ float a=0.5, s=0.0; for(int i=0;i<4;i++){ s+=a*noise(p); p*=2.03; a*=0.5; } return s; }
float voro(vec3 p){
  vec3 b = floor(p); vec3 f = fract(p); float d = 1.0;
  for(int k=-1;k<=1;k++) for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){
    vec3 g = vec3(float(i),float(j),float(k));
    vec3 o = vec3(hash(b+g), hash(b+g+11.3), hash(b+g+27.1));
    vec3 r = g + o - f; d = min(d, dot(r,r));
  }
  return sqrt(d);
}
float smin(float a, float b, float k){ float h = clamp(0.5+0.5*(b-a)/k,0.0,1.0); return mix(b,a,h)-k*h*(1.0-h); }
float smax(float a, float b, float k){ return -smin(-a,-b,k); }
float sdRoundBox(vec3 p, vec3 b, float r){ vec3 q = abs(p)-b; return length(max(q,0.0))+min(max(q.x,max(q.y,q.z)),0.0)-r; }
float sdEll(vec3 p, vec3 r){ float k0 = length(p/r); float k1 = length(p/(r*r)); return k0*(k0-1.0)/k1; }
float sdRoundCone(vec3 p, vec3 a, vec3 b, float r1, float r2){
  vec3 ba = b-a; float l2 = dot(ba,ba); float rr = r1-r2; float a2 = l2-rr*rr; float il2 = 1.0/l2;
  vec3 pa = p-a; float y = dot(pa,ba); float z = y-l2; vec3 xv = pa*l2-ba*y; float x2 = dot(xv,xv);
  float y2 = y*y*l2; float z2 = z*z*l2; float k = sign(rr)*rr*rr*x2;
  if(sign(z)*a2*z2 > k) return sqrt(x2+z2)*il2-r2;
  if(sign(y)*a2*y2 < k) return sqrt(x2+y2)*il2-r1;
  return (sqrt(x2*a2*il2)+y*rr)*il2-r1;
}
mat3 rotM(vec3 a){
  float cx=cos(a.x), sx=sin(a.x), cy=cos(a.y), sy=sin(a.y), cz=cos(a.z), sz=sin(a.z);
  mat3 rx = mat3(1,0,0, 0,cx,sx, 0,-sx,cx);
  mat3 ry = mat3(cy,0,-sy, 0,1,0, sy,0,cy);
  mat3 rz = mat3(cz,sz,0, -sz,cz,0, 0,0,1);
  return rz*rx*ry;
}
// Molar: wide crown with four cusps and a central fissure, three splayed roots.
float sdTooth(vec3 p){
  float crown = sdRoundBox(p-vec3(0.0,0.36,0.0), vec3(0.46,0.20,0.38), 0.32);
  crown = smin(crown, sdEll(p-vec3(0.0,0.30,0.0), vec3(0.86,0.42,0.74)), 0.12);
  float c = sdEll(p-vec3( 0.32,0.84, 0.26), vec3(0.34,0.30,0.33));
  c = min(c, sdEll(p-vec3(-0.32,0.84, 0.26), vec3(0.34,0.30,0.33)));
  c = min(c, sdEll(p-vec3( 0.32,0.84,-0.26), vec3(0.34,0.30,0.33)));
  c = min(c, sdEll(p-vec3(-0.32,0.84,-0.26), vec3(0.34,0.30,0.33)));
  crown = smin(crown, c, 0.16);
  crown = smax(crown, -sdEll(p-vec3(0.0,1.04,0.0), vec3(0.11,0.16,0.60)), 0.10);
  crown = smax(crown, -sdEll(p-vec3(0.0,1.04,0.0), vec3(0.60,0.14,0.10)), 0.10);
  float r1 = sdRoundCone(p, vec3( 0.32,-0.02, 0.08), vec3( 0.44,-1.12, 0.14), 0.38, 0.17);
  float r2 = sdRoundCone(p, vec3(-0.32,-0.02, 0.08), vec3(-0.42,-1.08, 0.16), 0.38, 0.17);
  float r3 = sdRoundCone(p, vec3( 0.00,-0.02,-0.26), vec3( 0.02,-0.98,-0.44), 0.34, 0.16);
  float roots = smin(smin(r1, r2, 0.10), r3, 0.12);
  return smin(crown, roots, 0.30);
}
mat3 gR;
float gS;
float map(vec3 p){ vec3 q = gR*(p/gS); return sdTooth(q)*gS; }
vec3 calcN(vec3 p){
  const vec2 k = vec2(1.0,-1.0); float e = 0.0015;
  return normalize(k.xyy*map(p+k.xyy*e)+k.yyx*map(p+k.yyx*e)+k.yxy*map(p+k.yxy*e)+k.xxx*map(p+k.xxx*e));
}
float calcAO(vec3 p, vec3 n){ float o=0.0, s=1.0; for(int i=1;i<=4;i++){ float h = 0.05*float(i); o += (h-map(p+n*h))*s; s*=0.6; } return clamp(1.0-2.2*o,0.0,1.0); }

void main(){
  vec2 uv = (gl_FragCoord.xy*2.0-uRes)/min(uRes.x,uRes.y);
  float bob = sin(uTime*1.1)*0.03;
  gR = rotM(uRot); gS = uScale;
  vec3 ro = vec3(0.0, bob, 5.2);
  vec3 rd = normalize(vec3(uv*0.78, -2.6));
  float b = dot(ro,rd); float cc = dot(ro,ro)-(2.1*gS)*(2.1*gS); float hh = b*b-cc;
  float t = 0.0; bool hit = false;
  if(hh > 0.0){
    t = max(-b-sqrt(hh), 0.0);
    for(int i=0;i<110;i++){
      vec3 p = ro+rd*t; float d = map(p);
      if(d < 0.0008){ hit = true; break; }
      t += d; if(t > 9.0) break;
    }
  }
  if(!hit){
    float sh = exp(-(uv.x*uv.x)/(0.30*gS) - pow((uv.y+0.92*gS-bob*0.4)/0.07,2.0));
    float a = sh*0.22*(1.0-bob*2.0);
    gl_FragColor = vec4(uShadow*a, a);
    return;
  }
  vec3 p = ro+rd*t; vec3 n = calcN(p);
  vec3 q = gR*(p/gS);
  vec3 l = normalize(vec3(-0.55,0.75,0.65));
  vec3 h = normalize(l-rd);
  float ao = calcAO(p,n);
  float crownMix = smoothstep(-0.02, 0.10, q.y);
  vec3 rootCol = vec3(0.80,0.86,0.95);
  vec3 enamel = vec3(0.97,0.98,1.0);
  vec3 base = mix(rootCol, enamel, crownMix);
  float st = fbm(q*3.2+vec3(1.7,0.3,2.1));
  float gum = smoothstep(0.30,0.0,abs(q.y-0.06));
  float fiss = smoothstep(0.80,1.0,q.y)*smoothstep(0.32,0.0,min(abs(q.x),abs(q.z)));
  float stainMask = clamp(smoothstep(0.56,0.70,st)*0.8 + gum*0.65 + fiss*0.9, 0.0, 1.0) * smoothstep(-0.55,-0.1,q.y+0.0);
  float w = q.y*0.85 + q.x*0.35 + q.z*0.2;
  float front = mix(1.35, -1.7, uClean);
  float cleaned = smoothstep(front-0.05, front+0.05, w);
  float dirt = stainMask*(1.0-cleaned);
  float dull = (1.0-cleaned)*crownMix;
  vec3 stainCol = mix(vec3(0.93,0.84,0.58), vec3(0.78,0.64,0.38), fbm(q*7.0));
  base = mix(base, base*vec3(1.0,0.93,0.78), dull*0.9);
  base = mix(base, stainCol, dirt*0.85);
  float band = exp(-abs(w-front)*7.0) * step(0.02, uClean) * step(uClean, 0.985);
  float bub = smoothstep(0.32, 0.12, voro(q*9.0 + vec3(0.0, uTime*0.6, 0.0)));
  float foam = clamp(band*(0.55+0.45*bub), 0.0, 1.0);
  float dif = clamp((dot(n,l)+0.45)/1.45, 0.0, 1.0);
  float gloss = mix(14.0, 60.0, cleaned*crownMix);
  float spec = pow(clamp(dot(n,h),0.0,1.0), gloss) * mix(0.25, 1.0, cleaned) * (0.4+0.6*crownMix);
  float fre = pow(1.0-clamp(dot(n,-rd),0.0,1.0), 3.0);
  vec3 sky = uTint;
  vec3 col = base*(0.50*sky + 0.58*dif*vec3(1.0,0.99,0.97)) * (0.50+0.50*ao);
  col += sky*fre*0.35*ao;
  col += vec3(1.0)*spec*0.75;
  col = mix(col, uFoam, foam*0.92);
  col += vec3(0.05,0.07,0.10)*smoothstep(0.4,1.0,fre)*crownMix;
  col = pow(col, vec3(0.92));
  gl_FragColor = vec4(col, 1.0);
}`;

  /* scroll progress -> tooth pose (same curve as the original) */
  function pose(e) {
    const clean = clamp01((e - CFG.cleanFrom) / Math.max(0.01, CFG.cleanUntil - CFG.cleanFrom));
    const a = CFG.turn * Math.PI / 180;
    return {
      clean,
      rot: [0.32 - 0.22 * e, -a * 0.6 + a * smooth(e), -0.14 + 0.2 * e],
      scale: 0.96 + 0.08 * smooth(e)
    };
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

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'a');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = n => gl.getUniformLocation(prog, n);
  const uRes = U('uRes'), uTime = U('uTime'), uClean = U('uClean'), uRot = U('uRot'), uScale = U('uScale');
  gl.uniform3fv(U('uTint'), AMBIENT);
  gl.uniform3fv(U('uShadow'), SHADOW);
  gl.uniform3fv(U('uFoam'), FOAM);

  const fx = cvFX.getContext('2d');
  let W = 1, H = 1, DPR = 1;
  function resize() {
    const r = root.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    DPR = Math.min(window.devicePixelRatio || 1, W < 500 ? 1.5 : 1.25);
    cvGL.width = cvFX.width = Math.round(W * DPR);
    cvGL.height = cvFX.height = Math.round(H * DPR);
    gl.viewport(0, 0, cvGL.width, cvGL.height);
  }
  resize();
  new ResizeObserver(resize).observe(root);

  /* foam bubbles + sparkles, drawn on the overlay canvas */
  const bubbles = [];
  const sparkCol = SPARKLE.map(v => Math.round(v * 255)).join(',');
  function star(x, y, r, alpha) {
    fx.save(); fx.translate(x, y); fx.globalAlpha = alpha; fx.fillStyle = 'rgb(' + sparkCol + ')';
    fx.beginPath();
    for (let i = 0; i < 8; i++) { const t = i * Math.PI / 4, rr = i % 2 === 0 ? r : r * 0.22; fx.lineTo(Math.cos(t) * rr, Math.sin(t) * rr); }
    fx.closePath(); fx.fill(); fx.restore();
  }
  function drawFX(time, dt, clean, speed) {
    fx.setTransform(DPR, 0, 0, DPR, 0, 0);
    fx.clearRect(0, 0, W, H);
    const m = Math.min(W, H), cx = W / 2, cy = H / 2;
    const rate = (clean > 0.01 && clean < 0.99 ? Math.sin(Math.PI * clean) : 0) * (0.6 + Math.min(1.5, speed * 40));
    if (Math.random() < rate * dt * 14) {
      const ang = Math.random() * Math.PI * 2;
      bubbles.push({ x: cx + Math.cos(ang) * m * (0.12 + Math.random() * 0.2), y: cy + m * (0.05 - Math.random() * 0.3),
        r: m * (0.006 + Math.random() * 0.018), vy: -m * (0.04 + Math.random() * 0.08), vx: (Math.random() - 0.5) * m * 0.03,
        life: 0, max: 1.2 + Math.random() * 1.4 });
    }
    const fc = FOAM.map(v => Math.round(v * 255)).join(',');
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      b.life += dt; b.x += b.vx * dt + Math.sin(time * 3 + i) * 0.2; b.y += b.vy * dt;
      if (b.life >= b.max) { bubbles.splice(i, 1); continue; }
      const k = Math.sin(Math.PI * Math.min(1, b.life / b.max));
      fx.beginPath(); fx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      fx.fillStyle = 'rgba(' + fc + ',' + (0.35 * k) + ')'; fx.fill();
      fx.lineWidth = 1; fx.strokeStyle = 'rgba(150,175,215,' + (0.55 * k) + ')'; fx.stroke();
    }
    const s = clamp01((clean - 0.88) / 0.12);
    if (s > 0) {
      [[-0.13, -0.2, 1], [0.12, -0.25, 0.7], [0.2, -0.06, 0.55], [-0.2, -0.02, 0.45], [0.03, -0.31, 0.5]].forEach(([dx, dy, sz], i) => {
        const tw = 0.55 + 0.45 * Math.sin(time * 2.4 + i * 1.7);
        star(cx + dx * m, cy + dy * m, m * 0.03 * sz * tw * s, s * (0.6 + 0.4 * tw));
      });
    }
  }

  function render(time, dt) {
    const prev = eased;
    eased += (target - eased) * Math.min(1, dt * 7);
    if (Math.abs(target - eased) < 5e-4) eased = target;
    const ps = pose(eased);
    gl.uniform2f(uRes, cvGL.width, cvGL.height);
    gl.uniform1f(uTime, time);
    gl.uniform1f(uClean, ps.clean);
    gl.uniform3f(uRot, ps.rot[0], ps.rot[1], ps.rot[2]);
    gl.uniform1f(uScale, ps.scale);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    drawFX(time, dt, ps.clean, Math.abs(eased - prev));
    if (api.onFrame) api.onFrame(ps.clean, eased);
  }

  api.renderAt = p => { target = eased = clamp01(p); render(performance.now() / 1000, 0.016); };
  if (reduced) { render(0, 0.016); return; }

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
