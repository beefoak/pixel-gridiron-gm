'use strict';
// Pro scheduling formula (17 games):
//  6 division games (home & away vs each rival)
//  4 vs a full division in the same conference (3-year rotation)
//  4 vs a full division in the other conference (4-year rotation)
//  2 vs same-place finishers from the two remaining same-conference divisions
//  1 vs same-place finisher from an other-conference division (17th game, rotating)
// ranks[tid] = previous season division finish (0 = 1st).
function tidOf(c, d, k) { return c * 16 + d * 4 + k; }

function makeMatchups(year, ranks) {
  const byRank = [0, 1].map(() => [[], [], [], []]);
  for (let t = 0; t < 32; t++) { const c = t >> 4, d = (t >> 2) & 3; byRank[c][d][ranks[t]] = t; }
  const games = [];
  const add = (h, a, type) => games.push({ home: h, away: a, type });
  // Division
  for (let c = 0; c < 2; c++) for (let d = 0; d < 4; d++)
    for (let k = 0; k < 4; k++) for (let l = k + 1; l < 4; l++) {
      add(tidOf(c, d, k), tidOf(c, d, l), 'div'); add(tidOf(c, d, l), tidOf(c, d, k), 'div');
    }
  // Intra-conference full division
  const kOff = (year % 3) + 1;
  for (let c = 0; c < 2; c++) for (let d = 0; d < 4; d++) {
    const e = d ^ kOff; if (d > e) continue;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      if ((i + j + year) % 2 === 0) add(tidOf(c, d, i), tidOf(c, e, j), 'conf'); else add(tidOf(c, e, j), tidOf(c, d, i), 'conf');
    }
  }
  // Inter-conference full division
  for (let d = 0; d < 4; d++) {
    const e = (d + year) % 4;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      if ((i + j + year) % 2 === 0) add(tidOf(0, d, i), tidOf(1, e, j), 'inter'); else add(tidOf(1, e, j), tidOf(0, d, i), 'inter');
    }
  }
  // Same-place intra-conference (remaining two divisions form a 4-cycle)
  const ks = [1, 2, 3].filter(k => k !== kOff);
  const cyc = [0, ks[0], ks[0] ^ ks[1], ks[1]];
  for (let c = 0; c < 2; c++) for (let i = 0; i < 4; i++) {
    const a = cyc[i], b = cyc[(i + 1) % 4];
    for (let r = 0; r < 4; r++) {
      const ta = byRank[c][a][r], tb = byRank[c][b][r];
      if (year % 2 === 0) add(ta, tb, 'place'); else add(tb, ta, 'place');
    }
  }
  // 17th game
  for (let d = 0; d < 4; d++) {
    const e = (d + year + 2) % 4;
    for (let r = 0; r < 4; r++) {
      const ta = byRank[0][d][r], tb = byRank[1][e][r];
      if (year % 2 === 0) add(ta, tb, 'g17'); else add(tb, ta, 'g17');
    }
  }
  return games;
}

// Assign 272 games to 18 weeks (each team plays once per week, one bye) using
// greedy placement with Kempe-chain repair.
function assignWeeks(games, nWeeks) {
  for (let attempt = 0; attempt < 300; attempt++) {
    const wk = Array.from({ length: nWeeks }, () => new Map());
    const gw = new Array(games.length).fill(-1);
    const place = (gi, w) => { wk[w].set(games[gi].home, gi); wk[w].set(games[gi].away, gi); gw[gi] = w; };
    const unplace = (gi) => { const w = gw[gi]; wk[w].delete(games[gi].home); wk[w].delete(games[gi].away); gw[gi] = -1; };
    const kempe = (gi) => {
      const a = games[gi].home, b = games[gi].away;
      const freeA = [], freeB = [];
      for (let w = 0; w < nWeeks; w++) { if (!wk[w].has(a)) freeA.push(w); if (!wk[w].has(b)) freeB.push(w); }
      for (const w of R.shuffle(freeA)) for (const w2 of R.shuffle(freeB.slice())) {
        if (w === w2) continue;
        const chain = []; let cur = b, col = w, hitA = false; const seen = new Set();
        for (;;) {
          const g = wk[col].get(cur); if (g === undefined || seen.has(g)) break;
          seen.add(g); chain.push(g);
          const G = games[g]; const nxt = G.home === cur ? G.away : G.home;
          if (nxt === a) { hitA = true; break; }
          cur = nxt; col = col === w ? w2 : w;
        }
        if (hitA) continue;
        const cols = chain.map(g => gw[g]);
        chain.forEach(g => unplace(g));
        chain.forEach((g, i) => place(g, cols[i] === w ? w2 : w));
        if (!wk[w].has(a) && !wk[w].has(b)) { place(gi, w); return true; }
        chain.forEach(g => unplace(g)); chain.forEach((g, i) => place(g, cols[i]));
      }
      return false;
    };
    let ok = true;
    for (const gi of R.shuffle(games.map((_, i) => i))) {
      const a = games[gi].home, b = games[gi].away;
      const cands = [];
      for (let w = 0; w < nWeeks; w++) if (!wk[w].has(a) && !wk[w].has(b)) cands.push(w);
      if (cands.length) { place(gi, R.pick(cands)); continue; }
      if (!kempe(gi)) { ok = false; break; }
    }
    if (ok) return gw;
  }
  return null;
}

function makeSchedule(year, ranks) {
  const games = makeMatchups(year, ranks);
  let gw = assignWeeks(games, 18);
  let nWeeks = 18;
  if (!gw) { nWeeks = 19; gw = assignWeeks(games, 19); } // practically never
  // Move weeks with byes to the middle of the season.
  const counts = new Array(nWeeks).fill(0); gw.forEach(w => counts[w]++);
  const full = [], bye = [];
  for (let w = 0; w < nWeeks; w++) (counts[w] === 16 ? full : bye).push(w);
  const front = full.slice(0, Math.min(4, full.length));
  const back = full.slice(front.length);
  const orderWeeks = [...front, ...bye, ...back];
  const remap = {}; orderWeeks.forEach((w, i) => remap[w] = i + 1);
  const sched = games.map((g, i) => ({ id: 'g' + year + '_' + i, week: remap[gw[i]], home: g.home, away: g.away, type: g.type, played: false }));
  sched.sort((a, b) => a.week - b.week);
  return sched;
}
