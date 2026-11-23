// WebGL backdrops: a slow, flowing gradient drawn behind any [data-shader]
// element. The CSS gradient on the element stays as the fallback when WebGL
// is unavailable. Only renders while on screen; one still frame when the
// visitor prefers reduced motion.
(function () {
  const PALETTES = {
    sky: {
      light: ['#F2A7C3', '#9CB7F6', '#C6B3F1', '#B5DBF4', '#EDEFFA'],
      dark: ['#4A2A3F', '#22335E', '#35295A', '#1F3A4A', '#181A24']
    },
    aurora: {
      light: ['#F8BFA8', '#A9E8CF', '#B5C7FA', '#F4E79A', '#F5F6FA'],
      dark: ['#4A2A22', '#1E4A3C', '#23305E', '#3A3618', '#15171D']
    }
  };

  const VERTEX = `
    attribute vec2 a_pos;
    void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
  `;

  const FRAGMENT = `
    precision mediump float;
    uniform vec2 u_res;
    uniform float u_time;
    uniform vec2 u_pointer;
    uniform vec3 u_c0;
    uniform vec3 u_c1;
    uniform vec3 u_c2;
    uniform vec3 u_c3;
    uniform vec3 u_bg;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
        mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
        u.y
      );
    }

    float fbm(vec2 p) {
      float v = 0.0;
      float a = 0.5;
      for (int i = 0; i < 5; i++) {
        v += a * noise(p);
        p *= 2.03;
        a *= 0.5;
      }
      return v;
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / u_res;
      vec2 p = uv * vec2(u_res.x / u_res.y, 1.0);
      float t = u_time * 0.045;

      vec2 q = vec2(fbm(p * 1.3 + t), fbm(p * 1.3 - t + 3.1));
      vec2 r = vec2(
        fbm(p * 1.5 + 2.0 * q + vec2(1.7, 9.2) + t * 1.3 + u_pointer * 0.35),
        fbm(p * 1.5 + 2.0 * q + vec2(8.3, 2.8) - t)
      );
      float n = fbm(p * 1.1 + 2.4 * r);

      // Warm colour leans left, cool colour leans right, like a sky at dusk
      float bx = uv.x;
      vec3 col = u_bg;
      col = mix(col, u_c0, min(1.0, smoothstep(0.36, 0.56, q.x) * (1.2 - bx * 0.8)));
      col = mix(col, u_c1, min(1.0, smoothstep(0.38, 0.58, r.y) * (0.35 + bx * 0.9)));
      col = mix(col, u_c2, smoothstep(0.42, 0.62, n) * 0.6);
      col = mix(col, u_c3, smoothstep(0.62, 0.85, length(r)) * 0.45);

      // Fine grain keeps the gradient from banding
      col += (hash(gl_FragCoord.xy + fract(u_time)) - 0.5) * 0.025;
      gl_FragColor = vec4(col, 1.0);
    }
  `;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const darkScheme = window.matchMedia('(prefers-color-scheme: dark)');
  const RESOLUTION = 0.6; // soft gradient, so render below device resolution

  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }

  function isDark() {
    const theme = document.documentElement.getAttribute('data-theme');
    if (theme) return theme === 'dark';
    return darkScheme.matches;
  }

  function compile(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.warn(gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  function setup(host) {
    const palette = PALETTES[host.dataset.shader] || PALETTES.sky;
    const canvas = document.createElement('canvas');
    canvas.className = 'gl-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
    if (!gl) return;

    const vs = compile(gl, gl.VERTEX_SHADER, VERTEX);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
    if (!vs || !fs) return;
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, 'a_pos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const u = {};
    ['u_res', 'u_time', 'u_pointer', 'u_c0', 'u_c1', 'u_c2', 'u_c3', 'u_bg'].forEach((name) => {
      u[name] = gl.getUniformLocation(program, name);
    });

    function applyPalette() {
      const colors = (isDark() ? palette.dark : palette.light).map(hexToRgb);
      ['u_c0', 'u_c1', 'u_c2', 'u_c3', 'u_bg'].forEach((name, i) => gl.uniform3fv(u[name], colors[i]));
    }
    applyPalette();

    host.prepend(canvas);

    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    let visible = false;
    let frame = null;
    const start = performance.now() - Math.random() * 20000;

    function resize() {
      const ratio = Math.min(window.devicePixelRatio || 1, 2) * RESOLUTION;
      const w = Math.max(1, Math.round(host.clientWidth * ratio));
      const h = Math.max(1, Math.round(host.clientHeight * ratio));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
        gl.uniform2f(u.u_res, w, h);
      }
    }

    function draw(now) {
      pointer.x += (pointer.tx - pointer.x) * 0.04;
      pointer.y += (pointer.ty - pointer.y) * 0.04;
      gl.uniform1f(u.u_time, (now - start) / 1000);
      gl.uniform2f(u.u_pointer, pointer.x, pointer.y);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function loop(now) {
      draw(now);
      frame = visible && !reduceMotion.matches && !document.hidden ? requestAnimationFrame(loop) : null;
    }

    function kick() {
      if (frame === null) frame = requestAnimationFrame(loop);
    }

    resize();
    draw(performance.now());
    canvas.classList.add('is-ready');

    new ResizeObserver(() => {
      resize();
      draw(performance.now());
    }).observe(host);

    new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      if (visible) kick();
    }).observe(host);

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && visible) kick();
    });

    host.addEventListener('pointermove', (event) => {
      const rect = host.getBoundingClientRect();
      pointer.tx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.ty = ((event.clientY - rect.top) / rect.height) * 2 - 1;
    });

    const repaint = () => {
      applyPalette();
      draw(performance.now());
    };
    darkScheme.addEventListener('change', repaint);
    new MutationObserver(repaint).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  document.querySelectorAll('[data-shader]').forEach(setup);
})();
