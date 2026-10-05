// 폭죽·폭탄·효과음·우승 음악 (선생님 화면, 학생 화면 공용)
// 필요한 캔버스와 오버레이는 스스로 만들어 붙입니다.
(function () {
  const css = `
#fx{position:fixed;inset:0;pointer-events:none;z-index:50}
#fxFlash{position:fixed;inset:0;opacity:0;pointer-events:none;z-index:49}
#fxFlash.boom{animation:fxFlash .6s ease-out}
@keyframes fxFlash{0%{opacity:.95;background:#fff7d6}30%{opacity:.7;background:#ff6a00}100%{opacity:0}}
.fx-shake{animation:fxShake .6s}
@keyframes fxShake{10%,90%{transform:translate(-4px,2px)}20%,80%{transform:translate(8px,-6px)}
  30%,50%,70%{transform:translate(-14px,8px)}40%,60%{transform:translate(14px,-8px)}}
#fxBomb{position:fixed;inset:0;display:none;place-items:center;pointer-events:none;z-index:51}
#fxBomb.on{display:grid}
#fxBomb .b{font-size:min(45vw,260px);line-height:1}
#fxBomb .b.drop{animation:fxDrop .75s cubic-bezier(.5,0,.75,1) forwards}
@keyframes fxDrop{0%{transform:translateY(-80vh) rotate(-30deg)}70%{transform:translateY(0) rotate(10deg)}
  80%{transform:translateY(-20px) rotate(-6deg) scale(1.05)}90%{transform:translateY(0) rotate(4deg)}100%{transform:scale(1.15)}}
#fxBomb .b.ex{animation:fxEx .7s ease-out forwards}
@keyframes fxEx{0%{transform:scale(.4);opacity:1}60%{transform:scale(2.4);opacity:1}100%{transform:scale(3);opacity:0}}
#fxToast{position:fixed;left:50%;top:22%;transform:translate(-50%,-50%);z-index:52;pointer-events:none;text-align:center;
  font-family:'Black Han Sans',sans-serif;font-size:clamp(36px,8vw,96px);opacity:0;white-space:nowrap;text-shadow:0 6px 0 #0008}
#fxToast.show{animation:fxToast 1.6s ease-out forwards}
@keyframes fxToast{0%{opacity:0;transform:translate(-50%,-50%) scale(.4)}20%{opacity:1;transform:translate(-50%,-50%) scale(1.15)}
  35%{transform:translate(-50%,-50%) scale(1)}80%{opacity:1}100%{opacity:0;transform:translate(-50%,-70%)}}`;
  const st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);
  const cv = document.createElement('canvas');
  cv.id = 'fx';
  const flash = Object.assign(document.createElement('div'), { id: 'fxFlash' });
  const bombEl = Object.assign(document.createElement('div'), { id: 'fxBomb', innerHTML: '<div class="b">💣</div>' });
  const toast = Object.assign(document.createElement('div'), { id: 'fxToast' });
  document.body.append(cv, flash, bombEl, toast);

  /* ---------- 파티클 ---------- */
  const ctx = cv.getContext('2d');
  let parts = [], raf = null;
  function resize() {
    cv.width = innerWidth * devicePixelRatio;
    cv.height = innerHeight * devicePixelRatio;
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  }
  addEventListener('resize', resize);
  resize();

  function burst(x, y, colors, n = 80, speed = 7, opt = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = speed * (0.35 + Math.random() * 0.75);
      const life = opt.life || 60 + Math.random() * 40;
      parts.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life,
        c: colors[(Math.random() * colors.length) | 0], s: opt.size || 2 + Math.random() * 2.5,
        g: opt.g ?? 0.09, drag: opt.drag ?? 0.985, shape: opt.shape || 'dot', rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
      });
    }
    if (!raf) raf = requestAnimationFrame(tick);
  }
  function rocket(tx, ty, colors) {
    const x0 = tx + (Math.random() - 0.5) * 120, y0 = innerHeight + 10, steps = 32;
    let k = 0;
    const iv = setInterval(() => {
      k++;
      const x = x0 + ((tx - x0) * k) / steps, y = y0 + ((ty - y0) * k) / steps;
      parts.push({ x, y, vx: (Math.random() - 0.5) * 0.6, vy: 1, life: 22, max: 22, c: '#fff3b0', s: 2, g: 0, drag: 0.95, shape: 'dot', rot: 0, vr: 0 });
      if (!raf) raf = requestAnimationFrame(tick);
      if (k >= steps) {
        clearInterval(iv);
        burst(x, y, colors, 110, 8);
        burst(x, y, ['#ffffff'], 25, 3, { life: 30 });
        sfx.pop();
      }
    }, 16);
  }
  const PALETTES = [['#ffd23f', '#ff9f1c', '#fff3b0'], ['#7ad7ff', '#c9a2ff', '#ffffff'], ['#ff7eb6', '#ff4d6d', '#ffd6e7'], ['#2ee59d', '#b8ffde', '#ffd23f'], ['#ff9f1c', '#ff7eb6', '#7ad7ff']];
  function fireworks(count = 6) {
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        const x = innerWidth * (0.12 + Math.random() * 0.76), y = innerHeight * (0.12 + Math.random() * 0.35);
        rocket(x, y, PALETTES[(Math.random() * PALETTES.length) | 0]);
      }, i * 230 + Math.random() * 120);
    }
    burst(innerWidth / 2, innerHeight * 0.35, ['#ffd23f', '#7ad7ff', '#ff7eb6', '#2ee59d', '#c9a2ff'], 70, 11, { shape: 'rect', g: 0.18, life: 120, size: 5, drag: 0.97 });
  }
  function tick() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    ctx.globalCompositeOperation = 'lighter';
    parts = parts.filter((p) => p.life > 0);
    for (const p of parts) {
      p.vx *= p.drag; p.vy = p.vy * p.drag + p.g; p.x += p.vx; p.y += p.vy; p.life--; p.rot += p.vr;
      const a = Math.max(0, p.life / p.max);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.c;
      if (p.shape === 'rect') {
        ctx.save(); ctx.globalCompositeOperation = 'source-over'; ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillRect(-p.s, -p.s / 2, p.s * 2, p.s); ctx.restore();
      } else if (p.shape === 'smoke') {
        ctx.save(); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = a * 0.5;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.s * (2 - a), 0, 7); ctx.fill(); ctx.restore();
      } else {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, 7); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    raf = parts.length ? requestAnimationFrame(tick) : null;
  }

  /* ---------- 폭탄 ---------- */
  let bombBusy = false;
  function bomb() {
    if (bombBusy) return;
    bombBusy = true;
    const b = bombEl.firstElementChild;
    bombEl.classList.add('on');
    b.textContent = '💣';
    b.className = 'b drop';
    sfx.fuse();
    setTimeout(() => {
      b.textContent = '💥';
      b.className = 'b ex';
      flash.classList.remove('boom'); void flash.offsetWidth; flash.classList.add('boom');
      document.body.classList.remove('fx-shake'); void document.body.offsetWidth; document.body.classList.add('fx-shake');
      const cx = innerWidth / 2, cy = innerHeight / 2;
      burst(cx, cy, ['#ff6a00', '#ff2d2d', '#ffd23f', '#fff3b0'], 160, 14, { g: 0.15, life: 70 });
      burst(cx, cy, ['#3a3a3a', '#555', '#2a2a2a'], 40, 5, { shape: 'smoke', size: 18, g: -0.03, life: 80, drag: 0.96 });
      burst(cx, cy, ['#222', '#444', '#7a4a20'], 40, 12, { shape: 'rect', size: 6, g: 0.3, life: 90, drag: 0.98 });
      sfx.boom();
      if (navigator.vibrate) navigator.vibrate([200, 60, 300]);
    }, 780);
    setTimeout(() => {
      bombEl.classList.remove('on');
      document.body.classList.remove('fx-shake');
      bombBusy = false;
    }, 1500);
  }

  function say(text, color) {
    toast.textContent = text;
    toast.style.color = color || '#fff';
    toast.classList.remove('show'); void toast.offsetWidth; toast.classList.add('show');
  }

  /* ---------- 소리 (WebAudio 합성, 파일 없음) ---------- */
  let AC = null;
  const state = { soundOn: true };
  function ac() {
    if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state === 'suspended') AC.resume();
    return AC;
  }
  function noise(dur) {
    const a = ac(), buf = a.createBuffer(1, a.sampleRate * dur, a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const s = a.createBufferSource();
    s.buffer = buf;
    return s;
  }
  function tone(freq, start, dur, type = 'sine', vol = 0.2, dest) {
    const a = ac(), o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, a.currentTime + start);
    g.gain.linearRampToValueAtTime(vol, a.currentTime + start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + start + dur);
    o.connect(g).connect(dest || a.destination);
    o.start(a.currentTime + start);
    o.stop(a.currentTime + start + dur + 0.05);
  }
  const sfx = {
    click() { if (state.soundOn) tone(660, 0, 0.06, 'square', 0.05); },
    tick() { if (state.soundOn) tone(1000, 0, 0.05, 'square', 0.08); },
    buzz() { if (state.soundOn) tone(140, 0, 0.25, 'sawtooth', 0.12); },
    join() { if (state.soundOn) [784, 1047].forEach((f, i) => tone(f, i * 0.08, 0.15, 'triangle', 0.12)); },
    win() { if (state.soundOn) [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.3, 'triangle', 0.18)); },
    bingo() { if (state.soundOn) [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.1, 0.35, 'square', 0.09)); },
    pop() {
      if (!state.soundOn) return;
      const a = ac(), s = noise(0.3), f = a.createBiquadFilter(), g = a.createGain();
      f.type = 'highpass'; f.frequency.value = 1500;
      g.gain.setValueAtTime(0.35, a.currentTime); g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.3);
      s.connect(f).connect(g).connect(a.destination); s.start();
    },
    fuse() {
      if (!state.soundOn) return;
      const a = ac(), s = noise(0.75), f = a.createBiquadFilter(), g = a.createGain();
      f.type = 'bandpass'; f.frequency.value = 4000; g.gain.value = 0.12;
      s.connect(f).connect(g).connect(a.destination); s.start();
      tone(900, 0, 0.7, 'sine', 0.04);
    },
    boom() {
      if (!state.soundOn) return;
      const a = ac(), s = noise(1.6), f = a.createBiquadFilter(), g = a.createGain();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(1200, a.currentTime); f.frequency.exponentialRampToValueAtTime(60, a.currentTime + 1.4);
      g.gain.setValueAtTime(1, a.currentTime); g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 1.6);
      s.connect(f).connect(g).connect(a.destination); s.start();
      const o = a.createOscillator(), og = a.createGain();
      o.frequency.setValueAtTime(120, a.currentTime); o.frequency.exponentialRampToValueAtTime(30, a.currentTime + 0.8);
      og.gain.setValueAtTime(0.8, a.currentTime); og.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.9);
      o.connect(og).connect(a.destination); o.start(); o.stop(a.currentTime + 1);
    },
  };

  /* ---------- 우승 음악: 직접 작곡한 8비트 팡파레 (약 15초) ---------- */
  const N = { G3: 196, A3: 220, B3: 247, C4: 262, D4: 294, E4: 330, F4: 349, G4: 392, A4: 440, B4: 494, C5: 523, D5: 587, E5: 659, F5: 698, G5: 784, A5: 880, B5: 988, C6: 1047 };
  // [음, 박자] — 0은 쉼표
  const MELODY = [
    ['G4', .5], ['C5', .5], ['E5', .5], ['G5', 1], ['E5', .5], ['G5', 1.5],
    ['A4', .5], ['C5', .5], ['F5', .5], ['A5', 1], ['F5', .5], ['A5', 1.5],
    ['B4', .5], ['D5', .5], ['G5', .5], ['B5', 1], ['A5', .5], ['B5', 1.5],
    ['C6', 1], ['G5', .5], ['E5', .5], ['C6', 2],
    ['E5', .5], ['E5', .5], ['F5', .5], ['G5', .5], ['G5', .5], ['F5', .5], ['E5', .5], ['D5', .5],
    ['C5', .5], ['C5', .5], ['D5', .5], ['E5', .5], ['E5', .75], ['D5', .25], ['D5', 1],
    ['E5', .5], ['E5', .5], ['F5', .5], ['G5', .5], ['G5', .5], ['F5', .5], ['E5', .5], ['D5', .5],
    ['C5', .5], ['C5', .5], ['D5', .5], ['E5', .5], ['D5', .75], ['C5', .25], ['C5', 1],
    ['G5', .5], ['G5', .5], ['A5', .5], ['B5', .5], ['C6', 3],
  ];
  const BASS = ['C4', 'F4', 'G3', 'C4', 'C4', 'G3', 'C4', 'G3', 'C4', 'G3', 'C4', 'G3', 'C4', 'G3', 'G3', 'C4'];
  let music = null;
  function playMusic() {
    stopMusic();
    if (!state.soundOn) return;
    const a = ac(), out = a.createGain();
    out.gain.value = 0.9;
    out.connect(a.destination);
    const beat = 60 / 150;
    let t = 0.05;
    for (const [n, b] of MELODY) {
      if (n) { tone(N[n], t, b * beat * 0.95, 'square', 0.11, out); tone(N[n] * 2, t, b * beat * 0.5, 'triangle', 0.04, out); }
      t += b * beat;
    }
    const total = t;
    // 베이스 + 북: 2박마다
    for (let i = 0, bt = 0.05; bt < total - 0.2; i++, bt += beat * 2) {
      const n = BASS[i % BASS.length];
      tone(N[n] / 2, bt, beat * 0.9, 'triangle', 0.25, out);
      tone(N[n] / 2, bt + beat, beat * 0.9, 'triangle', 0.18, out);
      [0, 1].forEach((k) => {
        const s = noise(0.12), f = a.createBiquadFilter(), g = a.createGain(), at = a.currentTime + bt + k * beat;
        f.type = k ? 'highpass' : 'lowpass'; f.frequency.value = k ? 6000 : 300;
        g.gain.setValueAtTime(k ? 0.12 : 0.5, at); g.gain.exponentialRampToValueAtTime(0.001, at + 0.12);
        s.connect(f).connect(g).connect(out); s.start(at);
      });
    }
    music = { out, end: setTimeout(() => (music = null), total * 1000) };
  }
  function stopMusic() {
    if (!music) return;
    clearTimeout(music.end);
    try {
      music.out.gain.setTargetAtTime(0, ac().currentTime, 0.05);
      const o = music.out;
      setTimeout(() => o.disconnect(), 300);
    } catch {}
    music = null;
  }

  window.FX = {
    burst, fireworks, bomb, say, sfx, playMusic, stopMusic,
    unlock: ac,
    get musicPlaying() { return !!music; },
    get soundOn() { return state.soundOn; },
    set soundOn(v) { state.soundOn = v; if (!v) stopMusic(); },
  };
})();
