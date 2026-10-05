// 의존성 없는 서버: 정적 파일 + 실시간 멀티플레이 빙고 (SSE)
// Railway는 PORT 환경변수를 넣어 줍니다
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const WORDS = require('./data/words');

const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname, 'public');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};
const MAX_PLAYERS = 60;

/* ================= 게임 로직 ================= */
const LINES = (() => {
  const L = [];
  for (let r = 0; r < 5; r++) L.push([0, 1, 2, 3, 4].map((c) => r * 5 + c));
  for (let c = 0; c < 5; c++) L.push([0, 1, 2, 3, 4].map((r) => r * 5 + c));
  L.push([0, 6, 12, 18, 24], [4, 8, 12, 16, 20]);
  return L;
})();
const shuffle = (a) => {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const norm = (s) => String(s).toLowerCase().replace(/[\s·\-_.,!?'"()]/g, '');
const isCorrect = (q, text) => [q.w, ...(q.a || [])].some((x) => norm(x) === norm(text));
const newBoard = () => shuffle(WORDS.map((_, i) => i)).slice(0, 25);
const countLines = (p) => LINES.filter((l) => l.every((i) => p.marked.has(p.board[i]))).length;
const lineCells = (p) => {
  const s = new Set();
  LINES.forEach((l) => l.every((i) => p.marked.has(p.board[i])) && l.forEach((i) => s.add(i)));
  return [...s];
};
function hintText(q, level) {
  if (!level) return '';
  const plain = [...q.w.replace(/\s/g, '')];
  const n = Math.min(level, Math.max(1, plain.length - 1));
  return plain.map((ch, i) => (i < n ? ch : '○')).join(' ');
}

const rooms = new Map();

function createRoom(settings) {
  let code;
  do code = String(crypto.randomInt(1000, 10000));
  while (rooms.has(code));
  const room = {
    code,
    hostKey: crypto.randomBytes(12).toString('hex'),
    settings: {
      lines: clampInt(settings.lines, 1, 5, 4),
      time: [0, 15, 20, 30, 45, 60].includes(+settings.time) ? +settings.time : 20,
    },
    status: 'lobby', // lobby | question | reveal | over
    players: new Map(),
    hostConns: new Set(),
    deck: [],
    qNo: 0,
    cur: null, // { id, hint, endsAt, answers: Map(pid -> 'correct'|'wrong') }
    timer: null,
    winner: null,
    lastActive: Date.now(),
  };
  rooms.set(code, room);
  return room;
}
function clampInt(v, lo, hi, def) {
  v = parseInt(v, 10);
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : def;
}

function startGame(room) {
  room.deck = shuffle(WORDS.map((_, i) => i));
  room.qNo = 0;
  room.winner = null;
  nextQuestion(room);
}
function nextQuestion(room) {
  clearTimeout(room.timer);
  if (!room.deck.length) return finish(room);
  const id = room.deck.shift();
  room.qNo++;
  room.status = 'question';
  room.cur = {
    id,
    hint: 0,
    endsAt: room.settings.time ? Date.now() + room.settings.time * 1000 : null,
    answers: new Map(),
  };
  if (room.cur.endsAt) room.timer = setTimeout(() => endQuestion(room), room.settings.time * 1000 + 300);
}
function endQuestion(room) {
  clearTimeout(room.timer);
  if (room.status !== 'question') return;
  room.status = room.deck.length ? 'reveal' : 'over';
  broadcast(room);
}
function finish(room) {
  clearTimeout(room.timer);
  room.status = 'over';
}
function resetGame(room) {
  clearTimeout(room.timer);
  room.status = 'lobby';
  room.cur = null;
  room.winner = null;
  room.qNo = 0;
  for (const p of room.players.values()) {
    p.board = newBoard();
    p.marked = new Set();
    p.lines = 0;
    p.correct = 0;
  }
}

function ranking(room) {
  return [...room.players.values()]
    .map((p) => ({ id: p.id, name: p.name, lines: p.lines, marks: p.marked.size, correct: p.correct, online: p.conns.size > 0 }))
    .sort((a, b) => b.lines - a.lines || b.marks - a.marks || b.correct - a.correct || a.name.localeCompare(b.name));
}

function questionView(room, withAnswer) {
  if (!room.cur) return null;
  const q = WORDS[room.cur.id];
  return {
    no: room.qNo,
    total: WORDS.length,
    topic: q.t,
    chosung: q.c,
    eng: !!q.e,
    desc: q.d,
    hint: hintText(q, room.cur.hint),
    endsAt: room.cur.endsAt,
    answer: withAnswer ? q.w : null,
  };
}
function hostView(room) {
  const showAnswer = room.status !== 'question';
  let correct = 0, wrong = 0;
  if (room.cur) for (const v of room.cur.answers.values()) v === 'correct' ? correct++ : wrong++;
  return {
    role: 'host',
    code: room.code,
    status: room.status,
    settings: room.settings,
    serverNow: Date.now(),
    q: questionView(room, showAnswer),
    remaining: room.status === 'lobby' ? WORDS.length : room.deck.length,
    stats: { correct, wrong, players: room.players.size },
    players: ranking(room).map((r) => ({ ...r, ans: room.cur ? room.cur.answers.get(r.id) || null : null })),
    winner: room.winner,
  };
}
function playerView(room, p) {
  const showAnswer = room.status !== 'question';
  const rank = ranking(room);
  return {
    role: 'player',
    code: room.code,
    status: room.status,
    settings: room.settings,
    serverNow: Date.now(),
    q: questionView(room, showAnswer),
    me: {
      id: p.id,
      name: p.name,
      board: p.board.map((w) => WORDS[w].w),
      marked: p.board.map((w) => p.marked.has(w)),
      lineCells: lineCells(p),
      lines: p.lines,
      ans: room.cur ? room.cur.answers.get(p.id) || null : null,
      rank: rank.findIndex((r) => r.id === p.id) + 1,
    },
    players: room.players.size,
    top: rank.slice(0, 5).map((r) => ({ name: r.name, lines: r.lines, marks: r.marks })),
    winner: room.winner,
  };
}

function sse(res, data) {
  try {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  } catch {}
}
function broadcast(room) {
  room.lastActive = Date.now();
  const hv = hostView(room);
  for (const res of room.hostConns) sse(res, hv);
  for (const p of room.players.values()) {
    if (!p.conns.size) continue;
    const pv = playerView(room, p);
    for (const res of p.conns) sse(res, pv);
  }
}

/* ================= API ================= */
function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}
function readBody(req) {
  return new Promise((resolve) => {
    let b = '';
    req.on('data', (c) => {
      b += c;
      if (b.length > 10000) req.destroy();
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(b || '{}'));
      } catch {
        resolve({});
      }
    });
  });
}

async function api(req, res, url) {
  const p = url.pathname;

  if (p === '/api/events' && req.method === 'GET') {
    const room = rooms.get(url.searchParams.get('code'));
    if (!room) return json(res, 404, { error: '방을 찾을 수 없습니다' });
    const hostKey = url.searchParams.get('host');
    const player = room.players.get(url.searchParams.get('pid'));
    if (hostKey !== room.hostKey && !player) return json(res, 403, { error: '참가 정보가 없습니다' });
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write('retry: 2000\n\n');
    const set = hostKey === room.hostKey ? room.hostConns : player.conns;
    set.add(res);
    broadcast(room); // 접속 상태가 다른 화면에도 반영되도록
    const ping = setInterval(() => res.write(': ping\n\n'), 20000);
    req.on('close', () => {
      clearInterval(ping);
      set.delete(res);
      if (rooms.has(room.code)) broadcast(room);
    });
    return;
  }

  if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });
  const body = await readBody(req);

  if (p === '/api/room') {
    const room = createRoom(body);
    return json(res, 200, { code: room.code, hostKey: room.hostKey });
  }

  const room = rooms.get(String(body.code || ''));
  if (!room) return json(res, 404, { error: '방 번호를 확인해 주세요' });

  if (p === '/api/join') {
    let name = String(body.name || '').trim().replace(/\s+/g, ' ').slice(0, 10);
    if (!name) return json(res, 400, { error: '이름을 입력해 주세요' });
    if (room.players.size >= MAX_PLAYERS) return json(res, 400, { error: '방이 가득 찼습니다' });
    const names = new Set([...room.players.values()].map((x) => x.name));
    if (names.has(name)) {
      let k = 2;
      while (names.has(`${name}${k}`)) k++;
      name = `${name}${k}`;
    }
    const id = crypto.randomBytes(8).toString('hex');
    room.players.set(id, { id, name, board: newBoard(), marked: new Set(), lines: 0, correct: 0, conns: new Set() });
    broadcast(room);
    return json(res, 200, { pid: id, name });
  }

  if (p === '/api/answer') {
    const pl = room.players.get(body.pid);
    if (!pl) return json(res, 403, { error: '참가 정보가 없습니다' });
    if (room.status !== 'question') return json(res, 400, { error: '지금은 답할 수 없어요' });
    if (room.cur.answers.has(pl.id)) return json(res, 400, { error: '이번 문제는 이미 답했어요' });
    if (!String(body.text || '').trim()) return json(res, 400, { error: '정답을 입력해 주세요' });
    const q = WORDS[room.cur.id];
    const ok = isCorrect(q, body.text);
    room.cur.answers.set(pl.id, ok ? 'correct' : 'wrong');
    let onBoard = false, newLines = 0, won = false;
    if (ok) {
      pl.correct++;
      onBoard = pl.board.includes(room.cur.id);
      if (onBoard) {
        pl.marked.add(room.cur.id);
        const before = pl.lines;
        pl.lines = countLines(pl);
        newLines = pl.lines - before;
        if (pl.lines >= room.settings.lines && !room.winner) {
          room.winner = { id: pl.id, name: pl.name, lines: pl.lines, at: Date.now() };
          won = true;
          finish(room);
        }
      }
    }
    // 모두 답했으면 문제를 바로 마감
    if (room.status === 'question' && room.cur.answers.size >= room.players.size) endQuestion(room);
    else broadcast(room);
    return json(res, 200, { result: ok ? 'correct' : 'wrong', onBoard, lines: pl.lines, newLines, won, answer: ok ? q.w : null });
  }

  if (p === '/api/host') {
    if (body.hostKey !== room.hostKey) return json(res, 403, { error: '선생님 화면에서만 할 수 있어요' });
    switch (body.action) {
      case 'start':
        if (room.status === 'lobby') startGame(room);
        break;
      case 'next':
        if (room.status === 'question' || room.status === 'reveal') nextQuestion(room);
        break;
      case 'close':
        endQuestion(room);
        break;
      case 'hint':
        if (room.status === 'question') room.cur.hint++;
        break;
      case 'restart':
        resetGame(room);
        break;
      case 'kick':
        room.players.get(body.pid)?.conns.forEach((r) => r.end());
        room.players.delete(body.pid);
        break;
      case 'settings':
        if (room.status === 'lobby') {
          room.settings.lines = clampInt(body.lines, 1, 5, room.settings.lines);
          if ([0, 15, 20, 30, 45, 60].includes(+body.time)) room.settings.time = +body.time;
        }
        break;
      default:
        return json(res, 400, { error: 'unknown action' });
    }
    broadcast(room);
    return json(res, 200, { ok: true });
  }

  json(res, 404, { error: 'not found' });
}

// 3시간 동안 아무 일이 없는 방은 정리
setInterval(() => {
  const cutoff = Date.now() - 3 * 3600 * 1000;
  for (const [code, room] of rooms) {
    if (room.lastActive < cutoff && !room.hostConns.size) {
      clearTimeout(room.timer);
      rooms.delete(code);
    }
  }
}, 10 * 60 * 1000).unref();

/* ================= 정적 파일 ================= */
function serveStatic(req, res, urlPath) {
  let file = path.normalize(path.join(ROOT, urlPath));
  if (!file.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end();
  }
  if (urlPath.endsWith('/')) file = path.join(file, 'index.html');
  fs.readFile(file, (err, data) => {
    if (err) {
      // 알 수 없는 경로는 첫 화면으로
      return fs.readFile(path.join(ROOT, 'index.html'), (e2, html) => {
        res.writeHead(e2 ? 404 : 200, { 'Content-Type': TYPES['.html'] });
        res.end(e2 ? 'Not found' : html);
      });
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}

http
  .createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      return res.end('ok');
    }
    if (url.pathname.startsWith('/api/')) {
      return api(req, res, url).catch((e) => {
        console.error(e);
        if (!res.headersSent) json(res, 500, { error: '서버 오류' });
      });
    }
    serveStatic(req, res, decodeURIComponent(url.pathname));
  })
  .listen(PORT, () => console.log(`Bingo game running on port ${PORT}`));
