'use strict';
// =====================================================================
//  Salary cap, contracts, league history/records and storylines
// =====================================================================
const START_CAP = 220; // $M
const POS_SAL = { QB: 1.0, DE: 0.62, WR: 0.6, CB: 0.52, OL: 0.45, DT: 0.5, LB: 0.36, S: 0.36, TE: 0.36, RB: 0.3, K: 0.12, P: 0.1 };
const FA_WAVES = 3;
const round05 = (v) => Math.round(v * 20) / 20;
const fmtM = (v) => '$' + (Math.round(v * 10) / 10).toFixed(1) + 'M';

function minSalary(L) { return round05(L.cap * 0.0045); }
function marketSalary(L, p) {
  const o = p.ovr + (p.age <= 25 ? Math.max(0, p.pot - p.ovr) * 0.3 : 0);
  const x = Math.max(0, (o - 52) / 43);
  let s = minSalary(L) + L.cap * 0.21 * POS_SAL[p.pos] * Math.pow(x, 2.6);
  if (p.age >= 31) s *= Math.max(0.35, 1 - (p.age - 30) * 0.12);
  return round05(Math.max(minSalary(L), s));
}
function rookieSalary(L, ovrPick) { return round05(L.cap * (0.0045 + 0.03 * Math.exp(-(ovrPick - 1) / 14))); }
function underContract(L, p) { return !!(p.contract && p.contract.exp >= L.year); }
function deadMoney(L, team, year) { return (team.dead && team.dead[year || L.year]) || 0; }
function payroll(L, team) { let s = 0; for (const id of team.roster) { const p = L.players[id]; if (underContract(L, p)) s += p.contract.sal; } return round05(s + deadMoney(L, team)); }
function capSpace(L, team) { return round05(L.cap - payroll(L, team)); }
function commitments(L, team, year) {
  let s = 0;
  for (const id of team.roster) {
    const c = L.players[id].contract; if (!c) continue;
    if (c.exp >= year) s += c.sal; else if (c.next && c.next.exp >= year) s += c.next.sal;
  }
  return round05(s + deadMoney(L, team, year));
}
function prefYears(p) { return p.age <= 25 ? 5 : p.age <= 28 ? 4 : p.age <= 30 ? 3 : p.age <= 32 ? 2 : 1; }
function contractStr(L, p) { if (!p.contract) return '-'; const c = p.contract; return `${fmtM(c.sal)} thru ${c.exp}${c.next ? ` (ext. ${fmtM(c.next.sal)} thru ${c.next.exp})` : ''}`; }
function reserveForRookies(L, team) { if (!L.draft) return 0; return round05(L.draft.picks.slice(L.draft.cur).filter(pk => pk.tid === team.id).reduce((s, pk) => s + rookieSalary(L, pk.ovr), 0)); }

// What the player wants. ctx: 'fa' | 'resign' | 'ext'
function askingContract(L, p, ctx) {
  if (p.greed === undefined) p.greed = Math.round(R.rand(-0.04, 0.12) * 100) / 100;
  const mv = marketSalary(L, p);
  let f = 1 + p.greed;
  let yrs = prefYears(p);
  if (ctx === 'fa') {
    if (L.phase === 'freeagency') f += clamp((p.ovr - 65) / 30, 0, 1) * 0.12; // bidding war for good players
    else { f -= 0.1; if (L.phase === 'regular') yrs = 1; }
    f *= (p.faDisc || 1);
  } else {
    const t = L.teams[p.tid]; const h = t && t.history[t.history.length - 1];
    const wp = h ? h.w / 17 : 0.5;
    f += (0.5 - wp) * 0.12; // winners get a hometown discount
  }
  return { sal: round05(Math.max(minSalary(L), mv * f)), yrs, mv };
}
// Player's response to an offer.
function offerContract(L, p, sal, yrs, ctx) {
  const key = L.year + ctx + L.phase;
  if (p.negBlock === key) return { ok: false, closed: true, msg: `${fullName(p)} has broken off talks.` };
  const a = askingContract(L, p, ctx);
  const score = sal / a.sal - Math.abs(yrs - a.yrs) * 0.035;
  if (score >= 0.985) return { ok: true, ask: a };
  p.negTries = (p.negTries || 0) + 1;
  if (score < 0.8) p.greed = Math.round((p.greed + 0.03) * 100) / 100;
  if (p.negTries >= 4) { p.negBlock = key; return { ok: false, closed: true, msg: `Talks broke down. ${fullName(p)} won't negotiate again ${ctx === 'fa' ? 'right now' : 'until next year'}.`, ask: a }; }
  const tone = score < 0.8 ? 'That offer is insulting.' : score < 0.93 ? "We're still far apart." : "We're close. Sweeten it a little.";
  return { ok: false, msg: `"${tone}" (asking ${fmtM(a.sal)}/yr for ${a.yrs} yr${a.yrs > 1 ? 's' : ''}) - ${4 - p.negTries} offer(s) left before talks end.`, ask: a };
}
// Commit a contract. Returns an error string or null.
function signContract(L, team, p, sal, yrs, ctx, silent) {
  sal = round05(sal);
  if (ctx === 'ext') {
    if (!underContract(L, p)) return 'No current contract to extend.';
    p.contract.next = { sal, exp: p.contract.exp + yrs };
  } else {
    if (ctx === 'fa' && team.id === L.userTeam && L.phase !== 'freeagency' && L.phase !== 'resign' && L.phase !== 'draft' && activeRoster(L, team).length >= ROSTER_LIMIT) return 'Roster is full.';
    if (capSpace(L, team) < sal) return `Not enough cap space (${fmtM(capSpace(L, team))} available).`;
    p.contract = { sal, exp: L.year + yrs - 1, signed: L.year };
    if (ctx === 'fa') signPlayer(L, team, p, true);
  }
  p.negTries = 0;
  if (!silent) {
    const verb = ctx === 'fa' ? 'signs with' : ctx === 'ext' ? 'agrees to an extension with' : 're-signs with';
    news(L, `${p.pos} ${fullName(p)} ${verb} ${team.abbr}: ${yrs} yr / ${fmtM(sal * yrs)} (${fmtM(sal)} per year).`, team.id);
    if (sal >= L.cap * 0.07 || team.id === L.userTeam && p.ovr >= 78) story(L, 'SIGNING', `${team.abbr} ${ctx === 'ext' ? 'extend' : ctx === 'fa' ? 'land' : 'keep'} ${fullName(p)}`, `${p.pos} ${fullName(p)} (${p.ovr} OVR, age ${p.age}) ${verb} the ${team.name} for ${yrs} year${yrs > 1 ? 's' : ''} and ${fmtM(sal * yrs)}${sal >= L.cap * 0.15 ? ' - one of the richest deals in the league' : ''}.`, [team.id], p.id);
  }
  return null;
}
function releaseDeadMoney(L, team, p) {
  if (!underContract(L, p)) { p.contract = null; return; }
  team.dead = team.dead || {};
  const c = p.contract;
  team.dead[L.year] = round05((team.dead[L.year] || 0) + c.sal * 0.5);
  if (c.exp > L.year) team.dead[L.year + 1] = round05((team.dead[L.year + 1] || 0) + c.sal * 0.25);
  p.contract = null;
}

function assignInitialContracts(L) {
  for (const t of L.teams) {
    const vet = [];
    for (const id of t.roster) {
      const p = L.players[id];
      if (p.exp <= 3 && p.draft && R.chance(0.75)) { p.contract = { sal: rookieSalary(L, p.draft.ovr), exp: p.draft.year + 3, rookie: true }; continue; }
      const yrs = clamp(R.int(1, prefYears(p) + 1), 1, 5);
      p.contract = { sal: round05(marketSalary(L, p) * R.rand(0.85, 1.15)), exp: L.year + yrs - 1 };
      vet.push(p);
    }
    const target = L.cap * R.rand(0.84, 0.97);
    const rookieSum = t.roster.reduce((s, id) => s + (L.players[id].contract.rookie ? L.players[id].contract.sal : 0), 0);
    const vetSum = vet.reduce((s, p) => s + p.contract.sal, 0);
    const k = vetSum ? clamp((target - rookieSum) / vetSum, 0.5, 2) : 1;
    vet.forEach(p => p.contract.sal = round05(Math.max(minSalary(L), p.contract.sal * k)));
  }
}

// ---------- AI contract behavior ----------
function aiCapComply(L, team) {
  let guard = 0;
  while (payroll(L, team) > L.cap && guard++ < 30) {
    const cands = team.roster.map(id => L.players[id]).filter(p => underContract(L, p) && p.contract.sal > minSalary(L) * 2 && !p.contract.rookie);
    if (!cands.length) break;
    cands.sort((a, b) => playerValue(a) / a.contract.sal - playerValue(b) / b.contract.sal);
    releasePlayer(L, cands[0], true);
  }
}
function aiResign(L, team) {
  const exp = team.roster.map(id => L.players[id]).filter(p => p.contract && p.contract.exp < L.year && !p.contract.next).sort((a, b) => playerValue(b) - playerValue(a));
  let room = L.cap * 0.97 - payroll(L, team) - reserveForRookies(L, team);
  for (const p of exp) {
    const a = askingContract(L, p, 'resign');
    const want = p.age <= 33 && (isStarterOn(L, p) || (p.age <= 27 && p.ovr >= 66) || p.ovr >= 74);
    if (want && a.sal <= room) { const sal = round05(a.sal * R.rand(0.96, 1.02)); p.contract = { sal, exp: L.year + a.yrs - 1 }; room -= sal; if (p.ovr >= 84) news(L, `${team.abbr} re-sign ${p.pos} ${fullName(p)}: ${a.yrs} yrs, ${fmtM(sal)}/yr.`, team.id); }
    else releasePlayer(L, p, true);
  }
}
function startFreeAgency(L) {
  for (const t of L.teams) {
    if (t.id === L.userTeam) {
      for (const p of t.roster.map(id => L.players[id])) if (p.contract && p.contract.exp < L.year && !p.contract.next) { news(L, `${p.pos} ${fullName(p)} leaves ${t.abbr} and hits free agency.`, t.id); releasePlayer(L, p, true); }
    } else aiResign(L, t);
  }
  for (const id of L.fa) { const p = L.players[id]; p.faDisc = 1; p.negTries = 0; }
  L.faWave = 0; L.phase = 'freeagency';
  const top = L.fa.map(id => L.players[id]).sort((a, b) => b.ovr - a.ovr).slice(0, 5);
  story(L, 'FREE AGENCY', 'Free agency opens', `The market is open. Top names available: ${top.map(p => `${p.pos} ${fullName(p)} (${p.ovr})`).join(', ')}. Teams have ${FA_WAVES} waves to make their moves.`);
}
function simFAWave(L) {
  if (L.phase !== 'freeagency') return;
  L.faWave++;
  const order = R.shuffle(L.teams.filter(t => t.id !== L.userTeam));
  for (let pass = 0; pass < 2; pass++) for (const t of order) {
    const room = capSpace(L, t) - reserveForRookies(L, t);
    const needs = teamNeeds(L, t);
    const act = activeRoster(L, t).length;
    let best = null, bv = -1e9, ask = null;
    for (const id of L.fa) {
      const p = L.players[id]; if (p.injury && p.injury.weeks > 8) continue;
      const nd = needs[p.pos]; if (nd.level === 'LOW' && act >= 50) continue;
      if (p.ovr <= nd.worstStarter - 4 && act >= 50) continue;
      const a = askingContract(L, p, 'fa'); if (a.sal > room) continue;
      const v = playerTradeFit(L, p, needs, false).v - a.sal / L.cap * 40;
      if (v > bv) { bv = v; best = p; ask = a; }
    }
    if (best && bv > 60) signContract(L, t, best, ask.sal * R.rand(0.98, 1.04), ask.yrs, 'fa', best.ovr < 80);
  }
  for (const id of L.fa) { const p = L.players[id]; p.faDisc = round05((p.faDisc || 1) * 0.9 * 20) / 20; }
  news(L, `Free agency wave ${L.faWave}/${FA_WAVES} complete.`, L.userTeam);
  if (L.faWave >= FA_WAVES) for (const t of order) { aiCapComply(L, t); }
}
function finishFreeAgency(L) {
  while (L.phase === 'freeagency' && L.faWave < FA_WAVES) simFAWave(L);
  L.phase = 'draft';
  runCombine(L);
}

// Cap growth + contract rollover; called right after the league year advances.
function bizOffseason(L, avgRatio) {
  const g = clamp(0.045 + (avgRatio - 0.9) * 0.4 + R.gauss(0, 0.012), 0.03, 0.10);
  const old = L.cap;
  L.cap = Math.round(L.cap * (1 + g) * 10) / 10;
  L.capHist = L.capHist || []; L.capHist.push({ year: L.year, cap: L.cap, g: Math.round(g * 1000) / 10 });
  story(L, 'CAP', `Salary cap rises to ${fmtM(L.cap)}`, `With league payrolls running at ${Math.round(avgRatio * 100)}% of the cap, the ${L.year} cap climbs ${(g * 100).toFixed(1)}% from ${fmtM(old)}. Market prices for players rise with it.`);
  for (const p of Object.values(L.players)) {
    p.negTries = 0; p.negBlock = null; p.faDisc = 1;
    if (p.contract && p.contract.next && p.contract.exp < L.year) p.contract = { sal: p.contract.next.sal, exp: p.contract.next.exp };
  }
  for (const t of L.teams) if (t.dead) for (const y in t.dead) if (+y < L.year) delete t.dead[y];
}
function avgPayrollRatio(L) { return L.teams.reduce((s, t) => s + payroll(L, t) / L.cap, 0) / L.teams.length; }

// =====================================================================
//  Historical careers for players who were in the league before day one
// =====================================================================
const STARTER_THRESH = { QB: 68, RB: 66, WR: 64, TE: 64, OL: 63, DE: 64, DT: 63, LB: 63, CB: 64, S: 63, K: 0, P: 0 };
function synthSeason(pos, o) {
  const s = emptyStats();
  const starter = o + R.gauss(0, 3) >= STARTER_THRESH[pos];
  let gp = starter ? R.int(12, 17) : R.int(4, 17);
  if (R.chance(0.12)) gp = R.int(1, 8);
  s.gp = gp; const g = starter ? gp : (R.chance(0.3) ? R.int(0, Math.min(4, gp)) : 0); s.gs = g;
  const bu = gp - g, q = (o - 60) / 30, n = () => R.rand(0.85, 1.15);
  switch (pos) {
    case 'QB': { const att = (g * R.rand(31, 37) + bu * 1.5) * n(); s.pAtt = att; s.pCmp = att * clamp(0.6 + q * 0.07, 0.5, 0.71); s.pYds = att * (6.4 + q) * n(); s.pTd = att * (0.035 + q * 0.012) * n(); s.pInt = att * clamp(0.027 - q * 0.006, 0.012, 0.04) * n(); s.sk = g * 2.2 * n(); s.rAtt = g * 3.2 * n(); s.rYds = s.rAtt * R.rand(3, 5.5); s.rTd = g * 0.1 * n(); break; }
    case 'RB': { const car = (g * R.rand(13, 18) + bu * 3) * n(); s.rAtt = car; s.rYds = car * (3.9 + q * 0.6) * n(); s.rTd = car * 0.028 * n(); s.rec = (g * 2.6 + bu * 0.8) * n(); s.tgt = s.rec * 1.3; s.reYds = s.rec * R.rand(6.5, 9); s.reTd = s.rec * 0.03; s.fum = car * 0.006; break; }
    case 'WR': { const rm = o >= 78 ? 1.35 : o >= 70 ? 1.0 : 0.7; s.tgt = (g * 6.5 * rm + bu * 1.2) * n(); s.rec = s.tgt * clamp(0.6 + q * 0.06, 0.5, 0.72); s.reYds = s.rec * (11.5 + q * 2) * n(); s.reTd = s.rec * (0.055 + q * 0.015) * n(); break; }
    case 'TE': { s.tgt = (g * 5 + bu) * n(); s.rec = s.tgt * 0.68; s.reYds = s.rec * 10.5 * n(); s.reTd = s.rec * 0.07 * n(); break; }
    case 'DE': s.tkl = (g * 2.8 + bu) * n(); s.sack = g * Math.max(0.05, 0.32 + q * 0.35) * n() + bu * 0.1; s.ff = g * 0.08 * n(); break;
    case 'DT': s.tkl = (g * 2.6 + bu) * n(); s.sack = g * Math.max(0.03, 0.16 + q * 0.2) * n(); break;
    case 'LB': s.tkl = (g * 6.5 + bu * 1.5) * n(); s.sack = g * 0.12 * n(); s.dInt = g * 0.04 * n(); s.pd = g * 0.25 * n(); break;
    case 'CB': s.tkl = (g * 3.8 + bu) * n(); s.dInt = g * Math.max(0.02, 0.07 + q * 0.05) * n(); s.pd = g * (0.6 + q * 0.3) * n(); break;
    case 'S': s.tkl = (g * 4.8 + bu) * n(); s.dInt = g * Math.max(0.02, 0.07 + q * 0.04) * n(); s.pd = g * 0.4 * n(); break;
    case 'K': s.fga = gp * 1.9 * n(); s.fgm = s.fga * clamp(0.8 + q * 0.12, 0.65, 0.95); s.xpa = gp * 2.4 * n(); s.xpm = s.xpa * 0.94; s.fgLng = R.int(45, 58); break;
    case 'P': s.pnt = gp * 4.6 * n(); s.pntYds = s.pnt * (44 + q * 4); break;
  }
  for (const k of STAT_KEYS) s[k] = Math.max(0, Math.round(s[k] || 0));
  s.pCmp = Math.min(s.pCmp, s.pAtt); s.rec = Math.min(s.rec, s.tgt || s.rec);
  if (s.rAtt) s.rLng = Math.min(s.rYds, R.int(12, 65)); if (s.rec) s.reLng = Math.min(s.reYds, R.int(15, 75));
  if (s.fga) s.fgLng = R.int(42, 58);
  return s;
}
function genHistory(L, p) {
  // Draft info
  const talent = p.pot * 0.6 + p.ovr * 0.4;
  const rd = clamp(Math.round(1 + (84 - talent) / 4 + R.gauss(0, 1.2)), 1, 8);
  const startYear = L.year - p.exp;
  const seasons = [];
  for (let y = startYear; y < L.year; y++) seasons.push(y);
  // Team path: current team for the last few years, earlier stops elsewhere
  const cur = p.tid;
  const tenure = seasons.length ? R.int(1, seasons.length) : 0;
  const firstTeam = cur >= 0 && R.chance(0.45) ? cur : R.int(0, 31);
  const midTeam = R.int(0, 31);
  const teamFor = (i) => { const fromEnd = seasons.length - i; if (cur >= 0 && fromEnd <= tenure) return cur; return i < (seasons.length - tenure) / 2 ? firstTeam : midTeam; };
  if (rd <= 7) { const pk = R.int(1, 32); p.draft = { year: startYear, rd, pk, ovr: (rd - 1) * 32 + pk, tid: seasons.length ? teamFor(0) : (cur >= 0 ? cur : firstTeam) }; }
  else p.draft = null;
  // Back-project ratings
  let o = p.ovr; const hist = [];
  const pk = PEAK[p.pos];
  for (let y = L.year - 1; y >= startYear; y--) {
    const age = p.age - (L.year - y);
    if (age + 1 <= pk[0]) o -= R.rand(1.5, 4.5); else if (age + 1 <= pk[1]) o -= R.rand(-1, 1.5); else o += R.rand(0.8, 2.5);
    o = clamp(Math.round(o), 38, 99); hist.unshift({ y, o });
  }
  hist.forEach((h, i) => {
    const s = synthSeason(p.pos, h.o);
    const c = compactStats(s); c.year = h.y; c.tm = L.teams[teamFor(i)].abbr; c.ovr = h.o; c.hist = 1;
    p.career.push(c); p.ovrHist.push({ y: h.y, o: h.o });
    if (s.gp <= 9 && R.chance(0.7)) { const inj = R.weighted(INJURIES, x => x[1]); p.injHist.push({ y: h.y, w: R.int(1, 16), name: inj[0], weeks: 17 - s.gp }); }
  });
}

// =====================================================================
//  Record book
// =====================================================================
// [key, scope, label, stat, base]
const REC_DEFS = [
  ['g_pYds', 'game', 'Passing Yards', 'pYds', 554], ['g_pTd', 'game', 'Passing TD', 'pTd', 7], ['g_rYds', 'game', 'Rushing Yards', 'rYds', 296],
  ['g_rTd', 'game', 'Rushing TD', 'rTd', 6], ['g_rec', 'game', 'Receptions', 'rec', 18], ['g_reYds', 'game', 'Receiving Yards', 'reYds', 336],
  ['g_reTd', 'game', 'Receiving TD', 'reTd', 5], ['g_sack', 'game', 'Sacks', 'sack', 6], ['g_dInt', 'game', 'Interceptions', 'dInt', 4],
  ['g_tkl', 'game', 'Tackles', 'tkl', 22], ['g_fgm', 'game', 'Field Goals', 'fgm', 7],
  ['s_pYds', 'season', 'Passing Yards', 'pYds', 6150], ['s_pTd', 'season', 'Passing TD', 'pTd', 56], ['s_rYds', 'season', 'Rushing Yards', 'rYds', 2105],
  ['s_rTd', 'season', 'Rushing TD', 'rTd', 28], ['s_rec', 'season', 'Receptions', 'rec', 182], ['s_reYds', 'season', 'Receiving Yards', 'reYds', 2050],
  ['s_reTd', 'season', 'Receiving TD', 'reTd', 23], ['s_sack', 'season', 'Sacks', 'sack', 23], ['s_dInt', 'season', 'Interceptions', 'dInt', 12],
  ['s_tkl', 'season', 'Tackles', 'tkl', 190], ['s_fgm', 'season', 'Field Goals', 'fgm', 44],
  ['c_pYds', 'career', 'Passing Yards', 'pYds', 80358], ['c_pTd', 'career', 'Passing TD', 'pTd', 571], ['c_rYds', 'career', 'Rushing Yards', 'rYds', 18355],
  ['c_rTd', 'career', 'Rushing TD', 'rTd', 164], ['c_rec', 'career', 'Receptions', 'rec', 1549], ['c_reYds', 'career', 'Receiving Yards', 'reYds', 22895],
  ['c_reTd', 'career', 'Receiving TD', 'reTd', 197], ['c_sack', 'career', 'Sacks', 'sack', 200], ['c_dInt', 'career', 'Interceptions', 'dInt', 81],
  ['c_tkl', 'career', 'Tackles', 'tkl', 2059], ['c_fgm', 'career', 'Field Goals', 'fgm', 599],
  ['tg_pts', 'tgame', 'Points in a Game', 'pts', 70], ['ts_pf', 'tseason', 'Points in a Season', 'pf', 606], ['ts_w', 'tseason', 'Wins in a Season', 'w', 16],
];
const REC_BY_KEY = {}; REC_DEFS.forEach(d => REC_BY_KEY[d[0]] = d);
function genRecords(L) {
  L.records = {}; L.recordLog = [];
  for (const [key, scope, , , base] of REC_DEFS) {
    const val = scope === 'tseason' && key === 'ts_w' ? base : Math.round(base * R.rand(0.96, 1.03));
    const y1 = R.int(scope === 'career' ? 1995 : 1980, L.year - 1);
    L.records[key] = { val, name: scope[0] === 't' ? '' : R.pick(FIRST_NAMES) + ' ' + R.pick(LAST_NAMES), abbr: R.pick(L.teams).abbr, year: scope === 'career' ? `${y1 - R.int(10, 17)}-${y1}` : y1, pid: null };
  }
}
function careerStat(p, k) { let t = 0; for (const c of p.career) t += c[k] || 0; return t; }
function setRecord(L, key, val, p, tid, extra) {
  const r = L.records[key]; const d = REC_BY_KEY[key];
  const sameHolder = p ? r.pid === p.id && (d[1] === 'career' || (d[1] === 'season' && r.year === L.year)) : (r.tid === tid && d[1] === 'tseason' && r.year === L.year);
  const old = { val: r.val, name: r.name || L.teams.find(t => t.abbr === r.abbr)?.name || r.abbr, year: r.year };
  r.val = val; r.abbr = L.teams[tid].abbr; r.tid = tid;
  r.name = p ? fullName(p) : L.teams[tid].city + ' ' + L.teams[tid].name; r.pid = p ? p.id : null;
  r.year = d[1] === 'career' ? `${p.career.length ? p.career[0].year : L.year}-${L.year}` : L.year;
  if (sameHolder && d[1] !== 'game' && d[1] !== 'tgame') return;
  const scopeName = { game: 'single-game', season: 'single-season', career: 'career', tgame: 'single-game team', tseason: 'single-season team' }[d[1]];
  L.recordLog.unshift({ y: L.year, w: L.week, key, scope: d[1], label: d[2], val, old: old.val, oldName: old.name, oldYear: old.year, name: r.name, abbr: r.abbr });
  if (L.recordLog.length > 120) L.recordLog.length = 120;
  story(L, 'RECORD', `RECORD: ${r.name} sets the ${scopeName} ${d[2].toLowerCase()} mark`, `${r.name} (${r.abbr}) now holds the ${scopeName} record for ${d[2].toLowerCase()} with ${val.toLocaleString()}${extra ? ' ' + extra : ''}, passing ${old.name} (${old.val.toLocaleString()}, ${old.year}).`, [tid], p ? p.id : undefined);
}
const MILESTONES = { pYds: [10000, 20000, 30000, 40000, 50000, 60000, 70000], pTd: [100, 200, 300, 400, 500], rYds: [5000, 7500, 10000, 12500, 15000], rTd: [50, 75, 100, 125], reYds: [5000, 7500, 10000, 12500, 15000], rec: [500, 750, 1000, 1250], reTd: [50, 75, 100, 125], sack: [50, 75, 100, 125, 150], dInt: [30, 40, 50, 60] };
const STAT_NAMES = { pYds: 'passing yards', pTd: 'touchdown passes', rYds: 'rushing yards', rTd: 'rushing touchdowns', reYds: 'receiving yards', rec: 'receptions', reTd: 'receiving touchdowns', sack: 'sacks', dInt: 'interceptions', tkl: 'tackles', fgm: 'field goals' };
// Called after a regular-season game's stats are added.
function checkGameRecords(L, res, g) {
  const opp = (tid) => L.teams[tid === g.home ? g.away : g.home].abbr;
  for (const pid in res.box) {
    const p = L.players[pid]; if (!p) continue; const b = res.box[pid];
    for (const [key, scope, , stat] of REC_DEFS) {
      if (scope === 'game') { if ((b[stat] || 0) > L.records[key].val) setRecord(L, key, b[stat], p, b.tid, `vs ${opp(b.tid)} in week ${L.week}`); }
      else if (scope === 'season') { const v = p.stats[stat] || 0; if (v > L.records[key].val) setRecord(L, key, v, p, b.tid); }
      else if (scope === 'career') {
        if (!b[stat]) continue;
        const v = careerStat(p, stat) + (p.stats[stat] || 0);
        if (v > L.records[key].val) setRecord(L, key, v, p, b.tid);
      }
    }
    for (const stat in MILESTONES) {
      if (!b[stat]) continue;
      const v = careerStat(p, stat) + (p.stats[stat] || 0), prev = v - b[stat];
      for (const m of MILESTONES[stat]) if (prev < m && v >= m && (b.tid === L.userTeam || m >= MILESTONES[stat][1])) story(L, 'MILESTONE', `${fullName(p)} reaches ${m.toLocaleString()} career ${STAT_NAMES[stat]}`, `${p.pos} ${fullName(p)} of the ${L.teams[b.tid].name} crossed ${m.toLocaleString()} career ${STAT_NAMES[stat]} against ${opp(b.tid)} in week ${L.week}, ${L.year}.`, [b.tid], p.id);
    }
  }
  const pts = Math.max(g.hs, g.as);
  if (pts > L.records.tg_pts.val) setRecord(L, 'tg_pts', pts, null, g.hs > g.as ? g.home : g.away, `against ${g.hs > g.as ? L.teams[g.away].abbr : L.teams[g.home].abbr}`);
}

// =====================================================================
//  Storylines
// =====================================================================
const STORY_TYPES = ['RECORD', 'CHASE', 'MILESTONE', 'RETURN', 'INJURY', 'RIVALRY', 'PREVIEW', 'STREAK', 'RACE', 'TRADE', 'SIGNING', 'FREE AGENCY', 'DRAFT', 'CAP', 'RETIREMENT', 'AWARD', 'CHAMPION'];
function story(L, type, h, b, tids, pid) {
  L.stories = L.stories || [];
  L.stories.unshift({ y: L.year, w: L.phase === 'regular' ? L.week : 0, ph: L.phase, type, h, b, tids: tids || [], pid });
  if (L.stories.length > 300) L.stories.length = 300;
}
function flagOnce(L, key) { L.flags = L.flags || {}; if (L.flags[key]) return false; L.flags[key] = 1; return true; }
const RIVALS = [['GB', 'CHI'], ['DAL', 'WAS'], ['DAL', 'PHI'], ['DAL', 'NYG'], ['PIT', 'BAL'], ['PIT', 'CLE'], ['KC', 'LV'], ['DEN', 'LV'], ['NE', 'NYJ'], ['SF', 'SEA'], ['SF', 'LAR'], ['NO', 'ATL'], ['BAL', 'CIN'], ['MIN', 'GB'], ['PHI', 'NYG'], ['BUF', 'MIA'], ['TB', 'NO'], ['DET', 'GB'], ['KC', 'DEN'], ['HOU', 'TEN'], ['IND', 'TEN'], ['ARI', 'SEA'], ['NE', 'BUF'], ['CHI', 'DET']];
function isRivalry(L, a, b) { const A = TEAMS_DATA[a][4], B = TEAMS_DATA[b][4]; return RIVALS.some(([x, y]) => (x === A && y === B) || (x === B && y === A)); }

function mvpScore(L, p) { return offScore(p, p.stats, 1) * (p.pos === 'QB' ? 1 : 0.8) + L.teams[p.tid].rec.w * (p.pos === 'QB' ? 9 : 6); }

// End-of-week storylines (called after the week counter advances).
function weeklyStories(L) {
  const wk = L.week; // upcoming week
  // Streaks
  for (const t of L.teams) {
    const s = t.rec.strk;
    if ([6, 9, 12].includes(s)) story(L, 'STREAK', `${t.name} win streak reaches ${s}`, `The ${t.city} ${t.name} (${recStr(t.rec)}) have won ${s} straight.`, [t.id]);
    if ([-6, -10].includes(s)) story(L, 'STREAK', `${t.name} have lost ${-s} in a row`, `The skid continues for the ${t.city} ${t.name}, now ${recStr(t.rec)}.`, [t.id]);
    if (t.rec.l === 0 && t.rec.t === 0 && t.rec.w >= 8 && t.rec.w % 2 === 0) story(L, 'STREAK', `${t.name} still perfect at ${t.rec.w}-0`, `Can anyone stop ${t.city}? The ${t.name} are the league's last unbeaten team.`, [t.id]);
  }
  // Record chases (season records)
  if (wk >= 7 && wk <= REG_WEEKS) {
    const pool = Object.values(L.players).filter(p => p.tid >= 0 && p.stats.gp >= 4);
    for (const [key, scope, label, stat] of REC_DEFS) {
      if (scope !== 'season') continue;
      const r = L.records[key];
      let lead = null; for (const p of pool) if (!lead || (p.stats[stat] || 0) > (lead.stats[stat] || 0)) lead = p;
      if (!lead || r.pid === lead.id) continue;
      const gp = L.teams[lead.tid].rec.w + L.teams[lead.tid].rec.l + L.teams[lead.tid].rec.t;
      const pace = Math.round((lead.stats[stat] || 0) / Math.max(1, gp) * 17);
      if (pace > r.val && flagOnce(L, `chase_${key}_${lead.id}`)) story(L, 'CHASE', `${fullName(lead)} on pace for history`, `${lead.pos} ${fullName(lead)} (${L.teams[lead.tid].abbr}) has ${(lead.stats[stat] || 0).toLocaleString()} ${label.toLowerCase()} through ${gp} games - a ${pace.toLocaleString()} pace that would top ${r.name}'s record of ${r.val.toLocaleString()} (${r.year}).`, [lead.tid], lead.id);
    }
  }
  // MVP race
  if ([9, 13, 17].includes(wk)) {
    const c = Object.values(L.players).filter(p => p.tid >= 0 && p.stats.gp > 0 && ['QB', 'RB', 'WR', 'TE'].includes(p.pos)).map(p => [p, mvpScore(L, p)]).sort((a, b) => b[1] - a[1]).slice(0, 3);
    if (c.length) story(L, 'RACE', `MVP race: ${fullName(c[0][0])} leads the pack`, c.map(([p], i) => `${i + 1}. ${p.pos} ${fullName(p)} (${L.teams[p.tid].abbr}, ${recStr(L.teams[p.tid].rec)}) - ${statLine(p)}`).join(' · '), c.map(x => x[0].tid), c[0][0].id);
  }
  // Previews for the coming week
  if (wk <= REG_WEEKS) {
    const games = L.schedule.filter(g => g.week === wk);
    let gotw = null, gv = -1;
    const used = new Set();
    for (const g of games) {
      const h = L.teams[g.home], a = L.teams[g.away];
      const v = recPct(h.rec) + recPct(a.rec);
      if (wk >= 3 && v > gv) { gv = v; gotw = g; }
    }
    if (gotw && gv >= 1.2) { used.add(gotw); const h = L.teams[gotw.home], a = L.teams[gotw.away]; story(L, 'PREVIEW', `Game of the Week: ${a.abbr} at ${h.abbr}`, `The ${a.city} ${a.name} (${recStr(a.rec)}) visit the ${h.city} ${h.name} (${recStr(h.rec)}) in week ${wk}'s marquee matchup.${prevMeeting(L, gotw)}`, [gotw.away, gotw.home]); }
    const rivalGames = games.filter(g => !used.has(g) && (isRivalry(L, g.home, g.away) || g.type === 'div')).map(g => [g, (isRivalry(L, g.home, g.away) ? 2 : 0) + recPct(L.teams[g.home].rec) + recPct(L.teams[g.away].rec) + ((g.home === L.userTeam || g.away === L.userTeam) ? 3 : 0)]).sort((a, b) => b[1] - a[1]).slice(0, 2);
    for (const [g] of rivalGames) {
      const h = L.teams[g.home], a = L.teams[g.away];
      const classic = isRivalry(L, g.home, g.away);
      story(L, 'RIVALRY', `${classic ? 'Rivalry week' : 'Division showdown'}: ${a.abbr} at ${h.abbr}`, `${classic ? 'One of the league\'s great feuds is renewed' : `${h.conf} ${h.div} bragging rights are on the line`} as ${a.city} (${recStr(a.rec)}) travels to ${h.city} (${recStr(h.rec)}).${prevMeeting(L, g)}`, [g.away, g.home]);
    }
  }
}
function prevMeeting(L, g) {
  const m = L.schedule.find(x => x.played && x.week < g.week && ((x.home === g.home && x.away === g.away) || (x.home === g.away && x.away === g.home)));
  if (!m) return ' First meeting of the season.';
  const w = m.hs > m.as ? m.home : m.away;
  return ` Rematch: ${L.teams[w].abbr} won ${Math.max(m.hs, m.as)}-${Math.min(m.hs, m.as)} in week ${m.week}.`;
}
function teamSeasonRecords(L) {
  for (const t of L.teams) {
    if (t.rec.pf > L.records.ts_pf.val) setRecord(L, 'ts_pf', t.rec.pf, null, t.id);
    if (t.rec.w > L.records.ts_w.val) setRecord(L, 'ts_w', t.rec.w, null, t.id);
  }
}

// ---------- Save migration for this feature set ----------
function migrateBiz(L) {
  if (!L.cap) { L.cap = START_CAP; L.capHist = [{ year: L.year, cap: L.cap, g: 0 }]; assignInitialContracts(L); }
  if (!L.records) genRecords(L);
  if (!L.stories) L.stories = [];
  if (!L.flags) L.flags = {};
}

function careerLineText(p, t) {
  if (p.pos === 'QB') return `${(t.pYds || 0).toLocaleString()} passing yards and ${t.pTd || 0} TD.`;
  if (p.pos === 'RB') return `${(t.rYds || 0).toLocaleString()} rushing yards and ${t.rTd || 0} TD.`;
  if (p.pos === 'WR' || p.pos === 'TE') return `${t.rec || 0} catches for ${(t.reYds || 0).toLocaleString()} yards.`;
  if (DEFENSE.includes(p.pos)) return `${t.tkl || 0} tackles, ${t.sack || 0} sacks, ${t.dInt || 0} INT.`;
  return '';
}
function summarizeAwardsText(aw) {
  const c = {}; aw.forEach(a => { const k = a.replace(/^\d+ /, ''); c[k] = (c[k] || 0) + 1; });
  return Object.entries(c).map(([k, n]) => (n > 1 ? n + 'x ' : '') + k).join(', ');
}
