'use strict';
// ================= Procedural pixel art =================
const Sprites = (() => {
  const cache = {};
  function rgb(hex) { let c = hex.replace('#', ''); if (c.length === 3) c = c.split('').map(x => x + x).join(''); return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)]; }
  function shade(hex, f) {
    let [r, g, b] = rgb(hex);
    if (f < 0) { r *= 1 + f; g *= 1 + f; b *= 1 + f; } else { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
    return '#' + [r, g, b].map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
  }
  function lum(hex) { const [r, g, b] = rgb(hex); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; }
  function draw(pattern, pal, scale) {
    scale = scale || 1;
    const h = pattern.length, w = pattern[0].length;
    const cv = document.createElement('canvas'); cv.width = w * scale; cv.height = h * scale;
    const ctx = cv.getContext('2d');
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const ch = pattern[y][x]; if (ch === '.' || !pal[ch]) continue;
      ctx.fillStyle = pal[ch]; ctx.fillRect(x * scale, y * scale, scale, scale);
    }
    return cv;
  }
  const HELMET = [
    '................',
    '.....KKKKKK.....',
    '...KKSSSSSSKK...',
    '..KPPHHPPPPPSK..',
    '.KPHHPPPPPPPPSK.',
    '.KPHPPPPPPPPPPSK',
    'KPPHPPPPPPPPPPPK',
    'KPPPPPPPPPPKKKKK',
    'KPPPPPKKKPKWWWWK',
    'KPPPPKDDDKKW..WK',
    'KPPPPKKKKPKWWWWK',
    '.KPPPPPPPPKW..W.',
    '.KPPPPPPPPKWWWW.',
    '..KKPPPPPKK.....',
    '....KKKKKK......',
    '................',
  ];
  const PLAYER = [
    '....KKKK....',
    '...KHHHHK...',
    '..KHLHHHHK..',
    '..KHHHHFFF..',
    '..KHHHSFSF..',
    '...KKSSSS...',
    '..JJJJJJJJ..',
    '.JJJJJJJJJJ.',
    '.JJNNJJNNJJ.',
    '.JJJNNNNJJJ.',
    'SJJJJJJJJJJS',
    'S.JJJJJJJJ.S',
    '...PPPPPP...',
    '...PP..PP...',
    '...PP..PP...',
    '...WW..WW...',
    '...WW..WW...',
    '..KKK..KKK..',
  ];
  const SKINS = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#5c3a1e'];
  function teamPal(t) {
    const dark = lum(t.c1) < 0.12;
    return { K: dark ? '#000000' : shade(t.c1, -0.6), P: t.c1, H: shade(t.c1, dark ? 0.35 : 0.3), S: t.c2, W: '#cfd3dc', D: '#222' };
  }
  function helmet(t) {
    const key = 'h' + t.abbr; if (cache[key]) return cache[key];
    return (cache[key] = draw(HELMET, teamPal(t), 2).toDataURL());
  }
  function player(p, t, scale) {
    const key = 'p' + p.id + '_' + (t ? t.abbr : 'fa') + '_' + scale; if (cache[key]) return cache[key];
    const c1 = t ? t.c1 : '#666666', c2 = t ? t.c2 : '#bbbbbb';
    const pal = { K: '#111', H: c1, L: shade(c1, 0.35), F: '#bbb', S: SKINS[p.skin || 0], J: c1, N: c2, P: c2 === '#FFFFFF' || lum(c2) > 0.8 ? '#e6e6e6' : c2, W: '#f4f4f4' };
    return (cache[key] = draw(PLAYER, pal, scale || 4).toDataURL());
  }
  return { helmet, player, shade, lum, draw };
})();

// ================= Field renderer (shared by replay + banner) =================
const Field = (() => {
  const W = 720, H = 300, YD = 5, EZ = 60; // 100 yds * 6px = 600 + 2*60 endzones
  const X = (abs) => EZ + abs * 6;
  function base(ctx, home, away) {
    ctx.imageSmoothingEnabled = false;
    for (let i = 0; i < 20; i++) { ctx.fillStyle = i % 2 ? '#2f8f3c' : '#37a345'; ctx.fillRect(EZ + i * 30, 0, 30, H); }
    ctx.fillStyle = home ? home.c1 : '#225'; ctx.fillRect(0, 0, EZ, H);
    ctx.fillStyle = away ? away.c1 : '#522'; ctx.fillRect(W - EZ, 0, EZ, H);
    ctx.fillStyle = '#fff';
    for (let y = 0; y <= 100; y += 5) ctx.fillRect(X(y) - 1, 0, 2, H);
    for (let y = 1; y < 100; y++) { if (y % 5 === 0) continue; ctx.fillRect(X(y), 8, 2, 6); ctx.fillRect(X(y), H - 14, 2, 6); ctx.fillRect(X(y), 112, 2, 5); ctx.fillRect(X(y), H - 117, 2, 5); }
    ctx.font = '10px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (let y = 10; y < 100; y += 10) { const n = y <= 50 ? y : 100 - y; ctx.fillText(String(n), X(y), 40); ctx.fillText(String(n), X(y), H - 30); }
    const ez = (t, x, rot) => {
      if (!t) return; ctx.save(); ctx.translate(x, H / 2); ctx.rotate(rot); ctx.font = '18px "Press Start 2P", monospace';
      ctx.fillStyle = t.c2; ctx.fillText(t.abbr, 0, 7); ctx.restore();
    };
    ez(home, EZ / 2, -Math.PI / 2); ez(away, W - EZ / 2, Math.PI / 2);
  }
  function man(ctx, x, y, t, flip) {
    x = Math.round(x); y = Math.round(y);
    ctx.fillStyle = '#111'; ctx.fillRect(x - 3, y - 7, 7, 15);
    ctx.fillStyle = t.c1; ctx.fillRect(x - 2, y - 6, 5, 4); // helmet
    ctx.fillStyle = Sprites.lum(t.c1) < 0.15 ? Sprites.shade(t.c1, 0.4) : t.c1; ctx.fillRect(x - 2, y - 2, 5, 5);
    ctx.fillStyle = t.c2; ctx.fillRect(x - 2, y + 3, 5, 3);
    ctx.fillStyle = '#ddd'; ctx.fillRect(flip ? x - 2 : x + 2, y - 5, 1, 2);
  }
  const OFF = [[-1, 0], [-1, 14], [-1, -14], [-1, 28], [-1, -28], [-1, 44], [-4, 0], [-7, 0], [-1, 118], [-1.5, -118], [-2, -80]];
  const DEF = [[1, 8], [1, -8], [1, 30], [1, -30], [5, 0], [5, 38], [5, -38], [7, 116], [7, -116], [13, 55], [13, -55]];
  function frame(ctx, home, away, e, t) {
    base(ctx, home, away);
    if (!e) return;
    const teams = [home, away];
    const off = teams[e.side], def = teams[1 - e.side];
    const dir = e.side === 0 ? 1 : -1;
    const los = e.from;
    const isKick = e.type === 'kick' || e.type === 'xp' || e.type === 'punt' || e.type === 'fg' || e.type === 'miss';
    if (!isKick) {
      ctx.fillStyle = '#4da3ff'; ctx.fillRect(X(los) - 1, 0, 3, H);
      if (e.fd > 0 && e.fd < 100) { ctx.fillStyle = '#ffd23f'; ctx.fillRect(X(e.fd) - 1, 0, 3, H); }
    }
    const cy = H / 2;
    const prog = Math.min(1, t * 1.2);
    for (const [dx, dy] of DEF) man(ctx, X(los + dx * dir * 1.0) + (dir * 6 * prog * (dx > 4 ? -1 : 0.5)), cy + dy, def, dir > 0);
    for (const [dx, dy] of OFF) man(ctx, X(los + dx * dir) + dir * 8 * prog * (Math.abs(dy) > 70 ? 2 : 0.4), cy + dy, off, dir < 0);
    // ball
    const bx = X(e.from + (e.to - e.from) * t);
    const arc = (isKick || e.type === 'pass' || e.type === 'inc') ? Math.sin(Math.PI * t) * (isKick ? 60 : 28) : 0;
    const by = cy - 3 - arc;
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(bx - 4, cy + 4, 8, 3);
    ctx.fillStyle = '#5a2d0c'; ctx.fillRect(bx - 4, by - 2, 8, 5); ctx.fillRect(bx - 5, by - 1, 10, 3);
    ctx.fillStyle = '#fff'; ctx.fillRect(bx - 1, by - 1, 3, 1);
  }
  return { W, H, base, frame };
})();
