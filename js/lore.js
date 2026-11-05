'use strict';
// =====================================================================
//  League lore: seasons from 1967 to the year before day one.
//  Standings, playoffs and champions are stored. Franchise rosters and
//  player stats are regenerated on demand from a seed, so they cost no
//  save space and always come out identical.
// =====================================================================
const LORE_START = 1967;
const HOF_WAIT = 3;        // seasons after retirement before a player reaches the ballot
const HOF_MAX_VOTES = 5;   // how many the user may induct each year
const HOF_BALLOT_SIZE = 12;

function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
// Run fn with Math.random (and so every R helper) swapped for a seeded generator.
function withSeed(seed, fn) { const orig = Math.random; Math.random = mulberry32(seed); try { return fn(); } finally { Math.random = orig; } }
function loreGames(y) { return y < 1978 ? 14 : y < 2021 ? 16 : 17; }
function lorePlayoffTeams(y) { return y < 1978 ? 4 : y < 1990 ? 5 : y < 2020 ? 6 : 7; }
const logistic = (x) => 1 / (1 + Math.exp(-x));

// ---------- Seasons, standings, playoffs ----------
function genLoreSeasons(L, end) {
  return withSeed(L.lore.seed, () => {
    const str = L.teams.map(() => ({}));
    const s = L.teams.map(() => R.gauss(0, 3));
    const seasons = [];
    for (let y = LORE_START; y <= end; y++) {
      const G2 = loreGames(y);
      L.teams.forEach((t, i) => { s[i] = 0.74 * s[i] + R.gauss(0, 2.8); str[i][y] = Math.round(s[i] * 10) / 10; });
      const rec = L.teams.map((t, i) => {
        const p = logistic(s[i] / 5.5); let w = 0, l = 0, ti = 0;
        for (let g = 0; g < G2; g++) { if (R.chance(0.004)) ti++; else if (R.chance(p)) w++; else l++; }
        const ppg = 20.5 + s[i] * 0.55 + R.gauss(0, 1.6), papg = 20.5 - s[i] * 0.45 + R.gauss(0, 1.6);
        return { w, l, t: ti, pf: Math.round(ppg * G2), pa: Math.round(papg * G2), s: s[i] };
      });
      const elim = {}, seedOf = {};
      const better = (a, b) => (rec[b].w + rec[b].t / 2) - (rec[a].w + rec[a].t / 2) || (rec[b].pf - rec[b].pa) - (rec[a].pf - rec[a].pa);
      let finalists = [];
      for (const c of CONFS) {
        const teams = L.teams.filter(t => t.conf === c).map(t => t.id);
        const divW = DIVS.map(d => teams.filter(id => L.teams[id].div === d).sort(better)[0]).sort(better);
        const wc = teams.filter(id => !divW.includes(id)).sort(better);
        const n = lorePlayoffTeams(y);
        const seeds = [...divW, ...wc].slice(0, n);
        seeds.forEach((id, k) => seedOf[id] = k + 1);
        // Generic bracket: top seeds get byes, highest remaining seed hosts the lowest.
        const rounds = Math.ceil(Math.log2(n)), byes = Math.pow(2, rounds) - n;
        let alive = seeds.slice();
        let r = 3 - rounds; // label rounds so the last conference round is "Conf. Championship" (index 2)
        let first = true;
        while (alive.length > 1) {
          const playing = first ? alive.slice(byes) : alive.slice();
          const resting = first ? alive.slice(0, byes) : [];
          const winners = [];
          for (let k = 0; k < playing.length / 2; k++) {
            const h = playing[k], a = playing[playing.length - 1 - k];
            const win = R.chance(logistic((rec[h].s - rec[a].s) / 6.5 + 0.2)) ? h : a;
            const lose = win === h ? a : h;
            elim[lose] = Math.max(0, r); winners.push(win);
          }
          alive = [...resting, ...winners].sort((a, b) => seeds.indexOf(a) - seeds.indexOf(b));
          r++; first = false;
        }
        finalists.push(alive[0]);
      }
      const [a, b] = finalists;
      const champ = R.chance(logistic((rec[a].s - rec[b].s) / 6.5)) ? a : b, runner = champ === a ? b : a;
      elim[runner] = 3; elim[champ] = 4;
      const ws = R.int(17, 38), ls = Math.max(0, ws - R.int(1, 17));
      seasons.push({ y, rec, elim, seedOf, champ, runner, score: `${ws}-${ls}`, ot: R.chance(0.04) });
    }
    return { seasons, str };
  });
}

// ---------- Franchise rosters (regenerated on demand) ----------
const LORE_SLOTS = { QB: 2, RB: 2, WR: 4, TE: 2, OL: 5, DE: 2, DT: 2, LB: 3, CB: 3, S: 2, K: 1, P: 1 };
const _franchiseCache = {};
function genFranchise(L, tid) {
  const ck = L.lore.seed + ':' + tid;
  if (_franchiseCache[ck]) return _franchiseCache[ck];
  const str = L.lore.str[tid];
  const out = withSeed((L.lore.seed ^ ((tid + 1) * 7919)) >>> 0, () => {
    const players = []; let n = 0;
    const slots = [];
    for (const pos of POSITIONS) for (let k = 0; k < LORE_SLOTS[pos]; k++) slots.push({ pos, k, p: null });
    for (let y = LORE_START; y <= L.lore.end; y++) {
      for (const sl of slots) {
        let p = sl.p;
        if (p) {
          const age = y - p.born, pk = PEAK[p.pos];
          const retire = age >= 38 ? 0.9 : age > pk[1] + 4 ? 0.45 : age > pk[1] + 2 ? 0.22 : age > pk[1] ? 0.08 : 0.01;
          const leave = (y - p.from) >= 3 ? 0.07 : 0.02;
          if (R.chance(retire) || R.chance(leave)) { p.to = y - 1; sl.p = p = null; }
        }
        if (!p) {
          const age = sl.k === 0 && R.chance(0.3) ? R.int(24, 29) : R.int(21, 24);
          p = sl.p = { key: `${tid}_${n++}`, tid, fn: R.pick(FIRST_NAMES), ln: R.pick(LAST_NAMES), pos: sl.pos, college: R.pick(COLLEGES), born: y - age, from: y, to: null, q: R.gauss(0, 4.5) + (R.chance(0.08) ? R.rand(6, 14) : 0), seasons: [] };
          players.push(p);
        }
        const age = y - p.born, pk = PEAK[p.pos];
        const curve = age < pk[0] ? -(pk[0] - age) * 2.2 : age > pk[1] ? -(age - pk[1]) * 2.4 : 0;
        const o = clamp(Math.round(72.5 + (str[y] || 0) * 0.9 + p.q + curve - sl.k * 7), 40, 99);
        const s = compactStats(synthSeason(p.pos, o, loreGames(y)));
        s.year = y; s.ovr = o; s.age = age;
        p.seasons.push(s);
      }
    }
    for (const sl of slots) if (sl.p) sl.p.to = L.lore.end;
    return players;
  });
  _franchiseCache[ck] = out;
  return out;
}
function lorePlayer(L, key) { const tid = +key.split('_')[0]; return genFranchise(L, tid).find(p => p.key === key) || null; }

// ---------- Awards / Hall of Fame scoring ----------
function seasonValue(pos, s) {
  if (pos === 'OL') return (s.ovr - 60) * 1.4;
  if (pos === 'K' || pos === 'P') return (s.ovr - 60) * 0.5;
  if (OFFENSE.includes(pos)) return offScore({ pos }, s, 1.05);
  return defScore(s) * 1.5;
}
const HOF_POS_W = { K: 0.3, P: 0.25 };
function hofScore(seasons, awards, pos) {
  let v = 0;
  for (const s of seasons) v += Math.min(16, Math.max(0, (s.ovr || 60) - 76)) * (HOF_POS_W[pos] || 1); // capped so long elite careers don't dwarf award winners
  for (const a of awards) v += / MVP$/.test(a) && !/Megacup/.test(a) ? 30 : /Player of the Year/.test(a) ? 16 : /All-Pro/.test(a) ? 7 : /Megacup MVP/.test(a) ? 6 : /Megacup Champion/.test(a) ? 2 : 0;
  return Math.round(v);
}
// Season awards + All-Pro across all franchises; Megacup MVPs; then Hall of Fame classes.
function genLoreHonors(L, seasons) {
  const all = L.teams.flatMap(t => genFranchise(L, t.id));
  const awards = {}; for (const p of all) awards[p.key] = [];
  const byYear = {};
  for (const p of all) for (const s of p.seasons) (byYear[s.year] = byYear[s.year] || []).push([p, s]);
  for (const S of seasons) {
    const rows = byYear[S.y] || [];
    const winBonus = (p) => (S.rec[p.tid].w / loreGames(S.y)) * 40;
    const off = rows.filter(([p]) => OFFENSE.includes(p.pos) && p.pos !== 'OL').map(([p, s]) => [p, s, offScore(p, s, 1.15) + winBonus(p)]).sort((a, b) => b[2] - a[2]);
    const def = rows.filter(([p]) => DEFENSE.includes(p.pos)).map(([p, s]) => [p, s, defScore(s) + winBonus(p) * 0.3]).sort((a, b) => b[2] - a[2]);
    const give = (p, label) => awards[p.key].push(`${S.y} ${label}`);
    if (off[0]) give(off[0][0], 'MVP');
    const opoy = off.find(x => x[0] !== (off[0] && off[0][0])); if (opoy) give(opoy[0], 'Offensive Player of the Year');
    if (def[0]) give(def[0][0], 'Defensive Player of the Year');
    for (const pos of POSITIONS) rows.filter(([p]) => p.pos === pos).sort((a, b) => b[1].ovr - a[1].ovr).slice(0, STARTERS[pos]).forEach(([p]) => give(p, 'All-Pro'));
    const champRows = rows.filter(([p]) => p.tid === S.champ);
    champRows.forEach(([p, s]) => { if (s.gs > 0) give(p, 'Megacup Champion'); });
    const mvp = champRows.filter(([p]) => p.pos !== 'OL' && p.pos !== 'K' && p.pos !== 'P').map(([p, s]) => [p, OFFENSE.includes(p.pos) ? offScore(p, s, 1.2) : defScore(s) * 1.3]).sort((a, b) => b[1] - a[1])[0];
    if (mvp) { give(mvp[0], 'Megacup MVP'); S.mvp = { name: mvp[0].fn + ' ' + mvp[0].ln, pos: mvp[0].pos, key: mvp[0].key }; }
    S.seasonMvp = off[0] ? { name: off[0][0].fn + ' ' + off[0][0].ln, pos: off[0][0].pos, key: off[0][0].key, tid: off[0][0].tid } : null;
  }
  // Hall of Fame: pre-induct the strongest careers class by class; the next tier waits on the ballot.
  const cands = all.filter(p => p.seasons.length >= 4).map(p => ({ p, score: hofScore(p.seasons, awards[p.key], p.pos) })).sort((a, b) => b.score - a.score);
  const years = L.lore.end - LORE_START + 1;
  const T = cands[Math.min(cands.length - 1, Math.round(years * 3.2))].score;
  const inducted = new Set();
  const hof = [];
  for (let y = LORE_START + 8; y <= L.lore.end; y++) {
    const pool = cands.filter(c => !inducted.has(c.p.key) && c.p.to !== null && c.p.to <= y - HOF_WAIT && c.score >= T);
    pool.slice(0, R.int(3, 6)).forEach(c => { inducted.add(c.p.key); hof.push(hofEntryLore(c.p, awards[c.p.key], c.score, y)); });
  }
  const pool = cands.filter(c => !inducted.has(c.p.key) && c.score >= T * 0.45).slice(0, 160).map(c => hofEntryLore(c.p, awards[c.p.key], c.score, null));
  return { awards, hof, pool };
}
function totalsOf(seasons) { const t = emptyStats(); seasons.forEach(s => addStats(t, s)); return compactStats(t); }
function hofEntryLore(p, awards, score, year) {
  return { key: p.key, src: 'lore', tid: p.tid, name: p.fn + ' ' + p.ln, pos: p.pos, from: p.from, to: p.to, seasons: p.seasons.length, tot: totalsOf(p.seasons), awards: awards.slice(), score, inducted: year, ballots: 0, peak: Math.max(...p.seasons.map(s => s.ovr)) };
}

// ---------- Build everything (new league, or an older save) ----------
function genLore(L, opts) {
  opts = opts || {};
  const first = L.capHist && L.capHist.length ? L.capHist[0].year : L.year;
  L.lore = { seed: (Math.random() * 2147483647) | 0 || 1, end: first - 1 };
  const { seasons, str } = genLoreSeasons(L, L.lore.end);
  L.lore.str = str;
  // Team histories and champions, oldest first, ahead of any real seasons.
  L.teams.forEach((t, i) => {
    const lore = seasons.map(S => ({ year: S.y, w: S.rec[i].w, l: S.rec[i].l, t: S.rec[i].t, pf: S.rec[i].pf, pa: S.rec[i].pa, seed: S.seedOf[i] || 0, result: S.elim[i] === undefined ? 'Missed Playoffs' : ['Lost Wild Card', 'Lost Divisional', 'Lost Conf. Championship', 'Lost Megacup', 'WON MEGACUP'][S.elim[i]], lore: 1 }));
    t.history = [...lore, ...t.history.filter(h => !h.lore)];
  });
  const hon = genLoreHonors(L, seasons);
  L.champions = [...seasons.map(S => ({ year: S.y, champ: S.champ, runner: S.runner, score: S.score, ot: S.ot, mvp: S.mvp || null, seasonMvp: S.seasonMvp, lore: 1 })), ...L.champions.filter(c => !c.lore)];
  L.lore.awards = {}; for (const k in hon.awards) if (hon.awards[k].length) L.lore.awards[k] = hon.awards[k];
  L.hof = [...hon.hof, ...(L.hof || []).filter(h => h.src !== 'lore')];
  L.hofPool = hon.pool;
  // Record book: any historical season or career that beats a generated record takes it over.
  if (L.records) {
    const all = L.teams.flatMap(t => genFranchise(L, t.id));
    for (const [key, scope, , stat] of REC_DEFS) {
      if (scope !== 'season' && scope !== 'career') continue;
      for (const p of all) {
        const v = scope === 'season' ? Math.max(0, ...p.seasons.map(s => s[stat] || 0)) : p.seasons.reduce((a, s) => a + (s[stat] || 0), 0);
        const r = L.records[key];
        if (v > r.val && r.pid === null) {
          const yr = scope === 'season' ? p.seasons.find(s => (s[stat] || 0) === v).year : `${p.from}-${p.to}`;
          L.records[key] = { val: v, name: p.fn + ' ' + p.ln, abbr: L.teams[p.tid].abbr, year: yr, pid: null, lore: p.key };
        }
      }
    }
  }
  // Last season's division finishes seed the first real schedule.
  const last = seasons[seasons.length - 1];
  const ranks = {};
  for (const c of CONFS) for (const d of DIVS) L.teams.filter(t => t.conf === c && t.div === d).map(t => t.id).sort((a, b) => (last.rec[b].w - last.rec[a].w) || (last.rec[b].pf - last.rec[b].pa) - (last.rec[a].pf - last.rec[a].pa)).forEach((id, k) => ranks[id] = k);
  if (!opts.migrate) { L.lastRanks = ranks; for (const t of L.teams) t.prevWins = last.rec[t.id].w; }
  return ranks;
}

// ---------- Banners ----------
function teamBanners(t) {
  const out = { champ: [], conf: [], div: [], playoffs: 0 };
  for (const h of t.history) {
    if (h.result === 'WON MEGACUP') out.champ.push(h.year);
    if (h.result === 'WON MEGACUP' || h.result === 'Lost Megacup') out.conf.push(h.year);
    if (h.seed >= 1 && h.seed <= 4) out.div.push(h.year);
    if (h.seed) out.playoffs++;
  }
  return out;
}

// ---------- Team seasons from the past (lore + real players) ----------
// Every player season for a team in a year: [{pos, name, pid?, key?, s}]
function teamSeasonRoster(L, tid, year) {
  const ab = L.teams[tid].abbr, rows = [];
  const real = [];
  for (const p of Object.values(L.players)) for (const c of p.career) if (c.year === year && c.tm === ab) real.push({ pos: p.pos, name: fullName(p), pid: p.id, s: c, ovr: c.ovr });
  for (const r of L.retired || []) if (r.career) for (const c of r.career) if (c.year === year && c.tm === ab) real.push({ pos: r.pos, name: r.name, rkey: r.key, s: c, ovr: c.ovr });
  if (L.lore && year <= L.lore.end) {
    const lore = genFranchise(L, tid).map(p => ({ p, s: p.seasons.find(x => x.year === year) })).filter(x => x.s).map(x => ({ pos: x.p.pos, name: x.p.fn + ' ' + x.p.ln, key: x.p.key, s: x.s, ovr: x.s.ovr }));
    // Real players (current vets' back-filled careers) take their spots first; lore fills the rest of the depth chart.
    for (const pos of POSITIONS) {
      const r = real.filter(x => x.pos === pos);
      const cap = Math.max(LORE_SLOTS[pos], r.length);
      rows.push(...r, ...lore.filter(x => x.pos === pos).slice(0, Math.max(0, cap - r.length)));
    }
  } else rows.push(...real);
  return rows.sort((a, b) => POSITIONS.indexOf(a.pos) - POSITIONS.indexOf(b.pos) || (b.s.gs || 0) - (a.s.gs || 0) || (b.ovr || 0) - (a.ovr || 0));
}
// All-time franchise leaders across lore and real seasons (same merge as the season rosters, so nothing is double-counted).
function franchiseLeaders(L, tid) {
  const tot = {};
  for (let y = LORE_START; y < L.year; y++) {
    for (const r of teamSeasonRoster(L, tid, y)) {
      const id = r.pid !== undefined ? 'P' + r.pid : r.key ? 'L' + r.key : 'R' + r.rkey;
      const t = tot[id] = tot[id] || { name: r.name, pos: r.pos, s: emptyStats(), from: y, to: y, pid: r.pid, key: r.key, rkey: r.rkey };
      addStats(t.s, r.s); t.to = y;
    }
  }
  const list = Object.values(tot);
  const cats = [['Passing yards', 'pYds'], ['Passing TD', 'pTd'], ['Rushing yards', 'rYds'], ['Receiving yards', 'reYds'], ['Receptions', 'rec'], ['Sacks', 'sack'], ['Interceptions', 'dInt'], ['Tackles', 'tkl'], ['Field goals', 'fgm']];
  return cats.map(([label, k]) => ({ label, k, top: list.filter(x => st(x.s, k) > 0).sort((a, b) => st(b.s, k) - st(a.s, k)).slice(0, 3) }));
}

// ---------- Hall of Fame ballot ----------
function hofRealEntry(r) { return r.career ? hofScore(r.career, r.awards, r.pos) : 0; }
function hofBallot(L) {
  const y = L.year;
  const lore = (L.hofPool || []).filter(c => !c.inducted && c.to <= y - HOF_WAIT && (c.ballots || 0) < 10);
  const real = (L.retired || []).filter(r => r.key && !r.inducted && r.to <= y - HOF_WAIT && (r.ballots || 0) < 10 && r.career)
    .map(r => ({ key: r.key, src: 'real', name: r.name, pos: r.pos, from: r.from, to: r.to, seasons: r.seasons, tot: r.tot, awards: r.awards, score: r.score || hofRealEntry(r), lastTeam: r.lastTeam, peak: r.peak }));
  return [...real, ...lore].filter(c => c.score > 20).sort((a, b) => b.score - a.score).slice(0, HOF_BALLOT_SIZE);
}
function castHofVotes(L, keys) {
  const ballot = hofBallot(L);
  const chosen = ballot.filter(c => keys.includes(c.key)).slice(0, HOF_MAX_VOTES);
  for (const c of ballot) {
    const srcObj = c.src === 'lore' ? L.hofPool.find(x => x.key === c.key) : L.retired.find(x => x.key === c.key);
    if (!srcObj) continue;
    srcObj.ballots = (srcObj.ballots || 0) + 1;
    if (c.src === 'real' && srcObj.ballots >= 10 && !chosen.includes(c)) delete srcObj.career;
    if (chosen.includes(c)) {
      srcObj.inducted = L.year;
      L.hof.push({ ...c, inducted: L.year, tid: c.src === 'lore' ? c.tid : (L.teams.find(t => t.abbr === c.lastTeam) || {}).id });
    }
  }
  L.hofVoted = L.hofVoted || {}; L.hofVoted[L.year] = true;
  if (chosen.length) {
    story(L, 'HALL OF FAME', `Hall of Fame Class of ${L.year}`, `Enshrined this year: ${chosen.map(c => `${c.pos} ${c.name}`).join(', ')}.`, []);
    news(L, `Hall of Fame Class of ${L.year}: ${chosen.map(c => c.name).join(', ')}.`, -1);
  }
  return chosen;
}

// Committee vote when the user skips: everyone with a clear Hall of Fame case, up to the usual limit.
const HOF_AUTO_BAR = 75;
function autoHofVotes(L) {
  if (L.hofVoted && L.hofVoted[L.year]) return null;
  const b = hofBallot(L);
  let pick = b.filter(c => c.score >= HOF_AUTO_BAR).slice(0, HOF_MAX_VOTES);
  if (!pick.length && b.length && b[0].score >= 50) pick = [b[0]];
  return castHofVotes(L, pick.map(c => c.key));
}

function migrateLore(L) {
  if (!L.lore) {
    genLore(L, { migrate: true });
    // Old auto-inductions become real Hall of Famers; everyone retired gets a ballot key.
    for (const r of L.retired || []) if (r.hof && !r.inducted) { r.inducted = r.to; L.hof.push({ key: 'R' + Math.random().toString(36).slice(2, 8), src: 'real', name: r.name, pos: r.pos, from: r.from, to: r.to, seasons: r.seasons, tot: r.tot, awards: r.awards, score: 0, inducted: r.to }); }
  }
  for (const r of L.retired || []) if (!r.key) r.key = 'R' + Math.random().toString(36).slice(2, 10);
  if (!L.hofVoted) L.hofVoted = {};
}
