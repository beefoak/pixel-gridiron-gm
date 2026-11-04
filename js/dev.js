'use strict';
// =====================================================================
//  Player development systems: college traits, depth chart, focus
//  training, player editing, and offseason (free agency / draft) reviews
// =====================================================================

// ---------------- College report traits ----------------
// [label, positions ('ALL' or list), linked attrs, polarity (+1 strength / -1 weakness)]
const TRAITS = [
  ['Breakaway speed on routes', ['WR', 'TE', 'RB'], ['spd', 'agi', 'rte'], 1],
  ['Strong hands in traffic', ['WR', 'TE'], ['cth', 'str'], 1],
  ['Crisp route runner', ['WR', 'TE', 'RB'], ['rte', 'agi'], 1],
  ['Elusive in space', ['RB', 'WR'], ['agi', 'spd'], 1],
  ['Workhorse between the tackles', ['RB'], ['str', 'car'], 1],
  ['Never puts the ball on the turf', ['RB', 'WR', 'QB'], ['car'], 1],
  ['Soft hands out of the backfield', ['RB'], ['cth', 'rte'], 1],
  ['Cannon arm', ['QB'], ['thp'], 1],
  ['Pinpoint ball placement', ['QB'], ['tha'], 1],
  ['Reads defenses pre-snap', ['QB'], ['awr', 'tha'], 1],
  ['Extends plays outside the pocket', ['QB'], ['spd', 'agi'], 1],
  ['Road-grader in the run game', ['OL', 'TE'], ['rbk', 'str'], 1],
  ['Anchors against the bull rush', ['OL'], ['pbk', 'str'], 1],
  ['Assignment-sound blocker', ['OL'], ['awr', 'pbk', 'rbk'], 1],
  ['Light feet in pass protection', ['OL'], ['pbk', 'agi'], 1],
  ['Explosive first step', ['DE', 'DT', 'LB'], ['prs', 'spd'], 1],
  ['Relentless pass rusher', ['DE', 'DT'], ['prs'], 1],
  ['Stout at the point of attack', ['DE', 'DT', 'LB'], ['rdf', 'str'], 1],
  ['Heat-seeking tackler', ['LB', 'S', 'CB'], ['tkl'], 1],
  ['Sideline-to-sideline range', ['LB', 'S'], ['spd', 'rdf'], 1],
  ['Sticky in man coverage', ['CB', 'S'], ['cov', 'agi'], 1],
  ['Ball-hawk instincts', ['CB', 'S', 'LB'], ['cov', 'awr'], 1],
  ['Elite recovery speed', ['CB', 'S'], ['spd'], 1],
  ['Freak athlete', ['QB', 'RB', 'WR', 'TE', 'OL', 'DE', 'DT', 'LB', 'CB', 'S'], ['spd', 'agi', 'str'], 1],
  ['Film-room junkie', 'ALL', ['awr'], 1],
  ['Big leg', ['K', 'P'], ['kpw'], 1],
  ['Ice in the veins', ['K'], ['kac'], 1],
  ['Hang-time specialist', ['P'], ['kpw', 'kac'], 1],
  ['Lacks top-end speed', ['RB', 'WR', 'TE', 'LB', 'CB', 'S'], ['spd'], -1],
  ['Drops catchable balls', ['WR', 'TE', 'RB'], ['cth'], -1],
  ['Rounds off his routes', ['WR', 'TE'], ['rte'], -1],
  ['Locks onto his first read', ['QB'], ['awr'], -1],
  ['Erratic accuracy under pressure', ['QB'], ['tha'], -1],
  ['Ball-security concerns', ['RB', 'WR', 'QB'], ['car'], -1],
  ['Struggles with speed rushers', ['OL'], ['pbk', 'agi'], -1],
  ['Lunges in the run game', ['OL', 'TE'], ['rbk'], -1],
  ['Plays with high pad level', ['OL', 'DE', 'DT'], ['str'], -1],
  ['One-move pass rusher', ['DE', 'DT'], ['prs'], -1],
  ['Misses open-field tackles', ['LB', 'S', 'CB'], ['tkl'], -1],
  ['Grabby in coverage', ['CB', 'S'], ['cov'], -1],
  ['Stiff hips in transition', ['CB', 'S', 'WR'], ['agi'], -1],
  ['Raw processor', 'ALL', ['awr'], -1],
  ['Inconsistent leg', ['K', 'P'], ['kac'], -1],
];
// What a "normal" value of an attribute is for this player, so traits describe real strengths/weaknesses.
function attrExpect(p, k) {
  if (k in OVR_WEIGHTS[p.pos]) return p.ovr;
  if (k in ATH_BASE[p.pos]) return ATH_BASE[p.pos][k] + (p.ovr - 70) * 0.55;
  return (CROSS[p.pos] || {})[k] || 25;
}
function traitFits(p, t) { return t[1] === 'ALL' || t[1].includes(p.pos); }
function traitScore(p, t) { return t[2].reduce((s, k) => s + (p.attrs[k] - attrExpect(p, k)), 0) / t[2].length * t[3]; }
// Pick 3-5 traits weighted toward the player's true strengths and weaknesses.
// boost=true (fresh prospects) also nudges the linked ratings so every report is truthful.
function assignTraits(p, boost) {
  const n = R.int(3, 5), nNeg = R.chance(0.25) ? 0 : R.chance(0.6) ? 1 : 2;
  const pool = TRAITS.map((t, i) => ({ t, i })).filter(x => traitFits(p, x.t));
  const pick = (pol, count, taken) => {
    const out = [];
    for (let c = 0; c < count; c++) {
      const opts = pool.filter(x => x.t[3] === pol && !taken.has(x.i) && !out.includes(x.i));
      if (!opts.length) break;
      out.push(R.weighted(opts, x => Math.exp(clamp(traitScore(p, x.t), -6, 8) / 2.5)).i);
    }
    return out;
  };
  const neg = pick(-1, nNeg, new Set()), pos = pick(1, n - neg.length, new Set(neg));
  p.traits = R.shuffle([...pos, ...neg]);
  if (boost) {
    const o0 = p.ovr;
    for (const i of p.traits) { const t = TRAITS[i]; for (const k of t[2]) p.attrs[k] += t[3] * R.int(2, 5); }
    clampAttrs(p);
    // Re-center so traits reshape the profile without inflating overall talent.
    const shift = calcOvr(p) - o0;
    for (const k in OVR_WEIGHTS[p.pos]) p.attrs[k] -= shift;
    clampAttrs(p); p.ovr = calcOvr(p);
  }
}
// How many traits your scouts have uncovered (prospects only; pros show everything).
function visibleTraits(p) {
  if (!p.traits) return [];
  const n = p.tid === -2 ? Math.min(p.traits.length, 2 + (p.sc || 0)) : p.traits.length;
  return p.traits.slice(0, n).map(i => TRAITS[i]);
}
function traitHtml(t) { return `<span class="trait ${t[3] > 0 ? 'tp' : 'tn'}">${t[3] > 0 ? '+' : '-'} ${esc(t[0])} <i>${t[2].map(k => k.toUpperCase()).join(' · ')}</i></span>`; }

// ---------------- Depth chart ----------------
// team.depth[pos] = ordered pid list set by the user; players not in it merge in by OVR.
function depthOrder(L, team, pos, filter) {
  let list = team.roster.map(id => L.players[id]).filter(p => p && p.pos === pos);
  if (filter) list = list.filter(filter);
  list.sort((a, b) => b.ovr - a.ovr);
  const d = team.depth && team.depth[pos];
  if (!d || !d.length) return list;
  const idx = new Map(d.map((id, i) => [id, i]));
  const listed = list.filter(p => idx.has(p.id)).sort((a, b) => idx.get(a.id) - idx.get(b.id));
  const unlisted = list.filter(p => !idx.has(p.id));
  const out = []; let i = 0, j = 0;
  while (i < listed.length || j < unlisted.length) {
    if (j < unlisted.length && (i >= listed.length || unlisted[j].ovr > listed[i].ovr)) out.push(unlisted[j++]);
    else out.push(listed[i++]);
  }
  return out;
}
function depthMove(L, team, pid, to) {
  const p = L.players[pid]; if (!p || p.tid !== team.id) return;
  const ids = depthOrder(L, team, p.pos).map(x => x.id);
  const from = ids.indexOf(pid); if (from < 0) return;
  ids.splice(from, 1); ids.splice(clamp(to, 0, ids.length), 0, pid);
  team.depth = team.depth || {}; team.depth[p.pos] = ids;
}
function depthReset(team, pos) { if (!team.depth) return; if (pos) delete team.depth[pos]; else team.depth = {}; }
function isManualDepth(team, pos) { return !!(team.depth && team.depth[pos] && team.depth[pos].length); }

// ---------------- Weekly focus training ----------------
const TRAIN_SLOTS = 3;
// Attribute points per week of focus. Young players with room to grow develop fastest.
function trainRate(p) {
  const pk = PEAK[p.pos];
  const ageF = p.age <= pk[0] ? 1 : p.age <= pk[1] ? 0.55 : 0.25;
  const roomF = clamp((p.pot - p.ovr + 2) / 10, 0.2, 1.2);
  return 0.45 * ageF * roomF;
}
function trainLabel(r) { return r >= 0.4 ? 'HIGH' : r >= 0.22 ? 'MED' : 'LOW'; }
function canTrain(p) { return p && !p.temp && !p.injury && p.tid >= 0; }
function trainState(L) { if (!L.training) L.training = { slots: [], log: [], logWeek: 0 }; return L.training; }
// Auto picks: the best development bets among starters and high-ceiling depth.
function autoTrainPicks(L, team, n, exclude) {
  const ex = exclude || new Set();
  const starters = new Set(); const lu = buildLineup(L, team); lu.starters.forEach(id => starters.add(id));
  return team.roster.map(id => L.players[id]).filter(p => canTrain(p) && !ex.has(p.id))
    .map(p => ({ p, v: trainRate(p) * (starters.has(p.id) ? 1.3 : 1) * clamp((p.pot - 55) / 20, 0.3, 1.6) * POS_VALUE[p.pos] }))
    .sort((a, b) => b.v - a.v).slice(0, n).map(x => x.p);
}
// The user's slots, with empty slots (or injured picks) filled automatically.
function userTrainPlan(L) {
  const T = trainState(L), team = L.teams[L.userTeam];
  const chosen = [];
  for (let i = 0; i < TRAIN_SLOTS; i++) {
    const s = T.slots[i]; const p = s && L.players[s.pid];
    chosen.push(s && p && p.tid === team.id ? { p, attr: s.attr || 'bal', manual: true, ok: canTrain(p) } : null);
  }
  const used = new Set(chosen.filter(Boolean).map(c => c.p.id));
  const need = chosen.filter(c => !c || !c.ok).length;
  const autos = autoTrainPicks(L, team, need, used);
  return chosen.map(c => c && c.ok ? c : { p: autos.shift() || null, attr: 'bal', manual: false, ok: true, benched: c && !c.ok ? c.p : null });
}
function trainPlayer(p, attr) {
  const keys = Object.keys(OVR_WEIGHTS[p.pos]);
  const k = attr && attr !== 'bal' && p.attrs[attr] !== undefined ? attr : R.weighted(keys, x => OVR_WEIGHTS[p.pos][x]);
  const head = clamp((99 - p.attrs[k]) / 30, 0.15, 1);
  p.txp = p.txp || {};
  p.txp[k] = (p.txp[k] || 0) + trainRate(p) * head * R.rand(0.7, 1.3);
  let gain = 0;
  while (p.txp[k] >= 1 && p.attrs[k] < 99) { p.txp[k] -= 1; p.attrs[k]++; gain++; }
  const before = p.ovr;
  if (gain) { p.ovr = calcOvr(p); if (p.ovr > p.pot) p.pot = p.ovr; p.tGain = (p.tGain || 0) + gain; }
  return { k, gain, dOvr: p.ovr - before };
}
// Runs after each regular-season week: user plan (auto-filled) plus AI teams' auto picks.
function weeklyTraining(L) {
  const T = trainState(L);
  if (T.season !== L.year) { T.season = L.year; for (const p of Object.values(L.players)) if (p.tGain) p.tGain = 0; }
  T.log = []; T.logWeek = L.week;
  for (const c of userTrainPlan(L)) {
    if (!c.p) continue;
    const r = trainPlayer(c.p, c.attr);
    T.log.push({ pid: c.p.id, k: r.k, gain: r.gain, dOvr: r.dOvr, manual: c.manual });
    if (r.dOvr > 0) news(L, `Training: ${c.p.pos} ${fullName(c.p)} is now ${c.p.ovr} OVR (+${r.dOvr}).`, L.userTeam);
  }
  for (const t of L.teams) if (t.id !== L.userTeam) for (const p of autoTrainPicks(L, t, TRAIN_SLOTS)) trainPlayer(p, 'bal');
}

// ---------------- Player editor ----------------
// fields: {fn, ln, num, age, ht, wt, college, pos, pot, injWeeks, attrs:{}}
function editPlayer(L, p, f) {
  const num = (v, a, b, d) => { const n = Math.round(+v); return Number.isFinite(n) ? clamp(n, a, b) : d; };
  if (f.fn && f.fn.trim()) p.fn = f.fn.replace(/[<>]/g, '').trim().slice(0, 20);
  if (f.ln && f.ln.trim()) p.ln = f.ln.replace(/[<>]/g, '').trim().slice(0, 24);
  if (f.college && f.college.trim()) p.college = f.college.replace(/[<>]/g, '').trim().slice(0, 30);
  p.num = num(f.num, 0, 99, p.num); p.age = num(f.age, 18, 50, p.age);
  p.ht = num(f.ht, 60, 90, p.ht); p.wt = num(f.wt, 140, 400, p.wt);
  if (POSITIONS.includes(f.pos) && f.pos !== p.pos) {
    if (p.tid >= 0) { const t = L.teams[p.tid]; if (t.depth) delete t.depth[p.pos]; }
    p.pos = f.pos;
  }
  for (const k of ATTRS) if (f.attrs && f.attrs[k] !== undefined) p.attrs[k] = num(f.attrs[k], 1, 99, p.attrs[k]);
  p.ovr = calcOvr(p);
  p.pot = Math.max(p.ovr, num(f.pot, 1, 99, p.pot));
  if (f.injWeeks !== undefined && p.injury) {
    const w = num(f.injWeeks, 0, 60, p.injury.weeks);
    if (w <= 0) { p.injury = null; p.ir = false; } else p.injury.weeks = w;
  }
  if (p.tid === -2) { updateScout(p); sortBoard(L, currentBoard(L)); }
  p.edited = true;
}

// ---------------- Draft grading ----------------
// "True" board: the class ranked by real ratings and positional value - what a perfect scout would see.
function trueDraftVal(p) { return p.pot * 0.55 + p.ovr * 0.45 + (POS_VALUE[p.pos] - 1) * 8; }
function ensureTrueRank(L, D) {
  if (D.trueRank) return D.trueRank;
  const ids = [...D.pool, ...D.picks.filter(k => k.pid).map(k => k.pid)].filter(id => L.players[id]);
  ids.sort((a, b) => trueDraftVal(L.players[b]) - trueDraftVal(L.players[a]));
  D.trueRank = {}; ids.forEach((id, i) => D.trueRank[id] = i + 1);
  return D.trueRank;
}
// Positive = player was objectively better than the slot. log2 so a #2 at pick 4 counts like #50 at pick 100.
function pickScore(slot, tr) { return Math.log2(slot / tr); }
const GRADE_STEPS = [[1, 'A+'], [0.6, 'A'], [0.3, 'A-'], [0.1, 'B+'], [-0.1, 'B'], [-0.3, 'B-'], [-0.5, 'C+'], [-0.8, 'C'], [-1.2, 'D'], [-1e9, 'F']];
function letterFor(s) { return GRADE_STEPS.find(g => s >= g[0])[1]; }
function gradeCls(g) { return g[0] === 'A' ? 'g-a' : g[0] === 'B' ? 'g-b' : g[0] === 'C' ? 'g-c' : 'g-f'; }
function gradeB(g) { return `<span class="grade ${gradeCls(g)}">${g}</span>`; }
// Class grade: early rounds count more.
function classScore(picks) {
  let s = 0, w = 0;
  for (const k of picks) if (k.tr) { const wt = 1 / Math.sqrt(k.rd); s += pickScore(k.ovr, k.tr) * wt; w += wt; }
  return w ? s / w : 0;
}
function draftReviewData(L, year) {
  const hist = L.draftHistory[year] || (L.draft && L.draft.year === year ? L.draft.picks.filter(k => k.pid) : []);
  const teams = L.teams.map(t => { const ps = hist.filter(k => k.tid === t.id && k.tr); return { tid: t.id, picks: ps, score: classScore(ps) }; }).filter(x => x.picks.length);
  teams.sort((a, b) => b.score - a.score);
  const graded = hist.filter(k => k.tr).map(k => ({ ...k, s: pickScore(k.ovr, k.tr) }));
  const steals = graded.slice().sort((a, b) => b.s - a.s).slice(0, 5);
  const reaches = graded.filter(k => k.rd <= 3).sort((a, b) => a.s - b.s).slice(0, 5);
  return { year, hist, teams, steals, reaches };
}

// ---------------- Free agency review ----------------
function faSnapshot(L) {
  L.faSnap = {
    year: L.year, roster: L.teams[L.userTeam].roster.slice(), cap: capSpace(L, L.teams[L.userTeam]),
    ratings: L.teams.map(t => teamRatings(L, t).ovr), log: [],
  };
}
function faLogSigning(L, team, p, sal, yrs) {
  if (L.phase !== 'freeagency' || !L.faSnap) return;
  L.faSnap.log.push({ pid: p.id, tid: team.id, name: fullName(p), pos: p.pos, ovr: p.ovr, age: p.age, sal, yrs, wave: L.faWave, mkt: marketSalary(L, p) });
}
function buildFAReview(L) {
  const S = L.faSnap; if (!S) return null;
  const u = L.teams[L.userTeam];
  const now = L.teams.map(t => teamRatings(L, t).ovr);
  const lgDelta = now.reduce((s, v, i) => s + v - S.ratings[i], 0) / now.length;
  const myDelta = now[u.id] - S.ratings[u.id];
  const signed = S.log.filter(x => x.tid === u.id);
  const cur = new Set(u.roster);
  const lost = S.roster.filter(id => !cur.has(id)).map(id => {
    const p = L.players[id]; if (!p) return null;
    const dest = p.tid >= 0 ? L.teams[p.tid].abbr : 'Unsigned';
    const sig = S.log.find(x => x.pid === id);
    return { pid: id, name: fullName(p), pos: p.pos, ovr: p.ovr, age: p.age, dest, sal: sig ? sig.sal : null };
  }).filter(Boolean).sort((a, b) => b.ovr - a.ovr);
  const bargain = signed.length ? signed.reduce((s, x) => s + Math.log2(Math.max(0.5, x.mkt) / Math.max(0.5, x.sal)), 0) / signed.length : 0;
  const score = (myDelta - lgDelta) * 0.8 + bargain * 0.6;
  const steps = [[1.6, 'A+'], [1, 'A'], [0.6, 'A-'], [0.3, 'B+'], [0, 'B'], [-0.3, 'B-'], [-0.6, 'C+'], [-1, 'C'], [-1.6, 'D'], [-1e9, 'F']];
  const grade = steps.find(g => score >= g[0])[1];
  const top = S.log.slice().sort((a, b) => b.sal - a.sal).slice(0, 10);
  const R2 = {
    year: S.year, grade, before: S.ratings[u.id], after: now[u.id], lgDelta: Math.round(lgDelta * 10) / 10,
    capBefore: S.cap, capAfter: capSpace(L, u), signed, lost, top,
    rankBefore: 1 + S.ratings.filter((v, i) => v > S.ratings[u.id] && i !== u.id).length,
    rankAfter: 1 + now.filter((v, i) => v > now[u.id] && i !== u.id).length,
  };
  L.faReviews = L.faReviews || {}; L.faReviews[S.year] = R2;
  L.faSnap = null;
  return R2;
}

function announceGenerational(L) {
  for (const id of L.prospects || []) {
    const p = L.players[id]; if (!p.gen) continue;
    story(L, 'DRAFT', `Generational talent: ${fullName(p)}`, `Scouts are calling ${p.college} ${p.pos} ${fullName(p)} a once-in-a-generation prospect for the ${L.year + 1} Draft - pro-ready now with a ceiling nobody else in the class can touch.`, [], p.id);
    news(L, `Generational prospect alert: ${p.pos} ${fullName(p)} (${p.college}) headlines the ${L.year + 1} draft class.`, -1);
  }
}

// ---------------- Team season stats ----------------
const TEAM_STAT_DEFS = [
  ['ppg', 'Points / game', 1], ['papg', 'Points allowed / game', -1], ['ypg', 'Yards / game', 1], ['pypg', 'Pass yards / game', 1], ['rypg', 'Rush yards / game', 1],
  ['oypg', 'Yards allowed / game', -1], ['opypg', 'Pass yards allowed / game', -1], ['orypg', 'Rush yards allowed / game', -1],
  ['to', 'Turnovers', -1], ['tk', 'Takeaways', 1], ['diff', 'Turnover margin', 1], ['sack', 'Sacks', 1], ['sk', 'Sacks allowed', -1], ['fd', 'First downs / game', 1],
  ['tdp', 'Pass TD', 1], ['tdr', 'Rush TD', 1], ['fgp', 'FG %', 1], ['cmp', 'Completion %', 1],
];
function teamSeasonStats(L, tid) {
  const t = { g: 0, pf: 0, pa: 0, py: 0, ry: 0, opy: 0, ory: 0, to: 0, tk: 0, sack: 0, sk: 0, fd: 0, tdp: 0, tdr: 0, fgm: 0, fga: 0, pc: 0, pa2: 0 };
  const players = {};
  for (const g of L.schedule) {
    if (!g.played || (g.home !== tid && g.away !== tid) || !g.box) continue;
    const home = g.home === tid;
    t.g++; t.pf += home ? g.hs : g.as; t.pa += home ? g.as : g.hs;
    if (g.tstat) t.fd += (home ? g.tstat[0] : g.tstat[1]).fd || 0;
    for (const pid in g.box) {
      const b = g.box[pid];
      if (b.tid === tid) {
        t.py += st(b, 'pYds'); t.ry += st(b, 'rYds'); t.to += st(b, 'pInt') + st(b, 'fum'); t.sk += st(b, 'sk'); t.sack += st(b, 'sack');
        t.tdp += st(b, 'pTd'); t.tdr += st(b, 'rTd'); t.fgm += st(b, 'fgm'); t.fga += st(b, 'fga'); t.pc += st(b, 'pCmp'); t.pa2 += st(b, 'pAtt');
        t.tk += st(b, 'dInt') + st(b, 'ff') * 0.5;
        if (!players[pid]) players[pid] = emptyStats();
        addStats(players[pid], b);
      } else { t.opy += st(b, 'pYds'); t.ory += st(b, 'rYds'); }
    }
  }
  t.tk = Math.round(t.tk);
  const g = t.g || 1;
  const v = {
    ppg: t.pf / g, papg: t.pa / g, ypg: (t.py + t.ry) / g, pypg: t.py / g, rypg: t.ry / g, oypg: (t.opy + t.ory) / g, opypg: t.opy / g, orypg: t.ory / g,
    to: t.to, tk: t.tk, diff: t.tk - t.to, sack: t.sack, sk: t.sk, fd: t.fd / g, tdp: t.tdp, tdr: t.tdr,
    fgp: t.fga ? t.fgm / t.fga * 100 : 0, cmp: t.pa2 ? t.pc / t.pa2 * 100 : 0,
  };
  for (const k in v) v[k] = Math.round(v[k] * 10) / 10;
  v.g = t.g; v.pf = t.pf; v.pa = t.pa;
  return { v, players };
}
// League ranks (1 = best) for every team stat.
function teamStatRanks(L) {
  const all = L.teams.map(t => teamSeasonStats(L, t.id).v);
  const ranks = L.teams.map(() => ({}));
  for (const [k, , dir] of TEAM_STAT_DEFS) {
    const order = all.map((v, i) => i).sort((a, b) => (all[b][k] - all[a][k]) * dir);
    order.forEach((ti, r) => ranks[ti][k] = r + 1);
  }
  return { all, ranks };
}

function canRegenClass(L) { return L.phase === 'regular' && L.week === 1 && !L.scoutStop && (L.prospects || []).length > 0; }
function regenDraftClass(L) {
  let refund = 0;
  for (const id of L.prospects) { const p = L.players[id]; if (p) { const sc = p.sc || 0; refund += sc * (sc + 1) / 2; delete L.players[id]; } }
  L.scoutPts += refund;
  L.prospects = generateDraftClass(L, 300);
  announceGenerational(L);
  return refund;
}

// ---------------- Migration for older saves ----------------
function migrateDev(L) {
  trainState(L);
  if (!L.faReviews) L.faReviews = {};
  for (const id of [...(L.prospects || []), ...(L.draft ? L.draft.pool : [])]) { const p = L.players[id]; if (p && !p.traits) assignTraits(p, false); }
  if (L.phase === 'freeagency' && !L.faSnap) faSnapshot(L);
}
