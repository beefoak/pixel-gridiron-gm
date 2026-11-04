'use strict';
// ================= League state & season flow =================
const SAVE_KEY = 'pixel_gridiron_gm_v1';
const ROUND_NAMES = ['Wild Card', 'Divisional', 'Conference Championship', 'Megacup'];
const REG_WEEKS = 18;

function newRec() { return { w: 0, l: 0, t: 0, pf: 0, pa: 0, dw: 0, dl: 0, dt: 0, cw: 0, cl: 0, ct: 0, h2h: {}, strk: 0 }; }
function pct(w, l, t) { const g = w + l + t; return g ? (w + 0.5 * t) / g : 0; }
function recPct(r) { return pct(r.w, r.l, r.t); }
function recStr(r) { return r.w + '-' + r.l + (r.t ? '-' + r.t : ''); }

function news(L, text, tid) {
  L.news.unshift({ y: L.year, w: L.week, text, tid: tid === undefined ? -1 : tid });
  if (L.news.length > 250) L.news.length = 250;
}

function playerValue(p) {
  let v = p.ovr;
  if (p.age <= 24) v += (p.pot - p.ovr) * 0.5; else if (p.age <= 26) v += (p.pot - p.ovr) * 0.25;
  v -= Math.max(0, p.age - 30) * 1.5;
  if (p.injury) v -= Math.min(12, p.injury.weeks) * 0.6;
  return v;
}

// ---------- Creation ----------
function newLeague(userTeam, customNames) {
  const L = {
    version: 1, year: 2026, phase: 'regular', week: 1, userTeam, autoRoster: true, nextPid: 1, players: {}, teams: [],
    schedule: [], fa: [], news: [], awards: {}, champions: [], retired: [], draftHistory: {}, playoffs: null, draft: null, lastRanks: null,
  };
  TEAMS_DATA.forEach((t, i) => L.teams.push({ id: i, conf: t[0], div: t[1], city: t[2], name: (customNames && customNames[i] && customNames[i].name) || t[3], abbr: (customNames && customNames[i] && customNames[i].abbr) || t[4], c1: t[5], c2: t[6], roster: [], rec: newRec(), history: [], prevWins: null }));
  for (const team of L.teams) {
    const q = R.gauss(0, 2.5);
    for (const pos of POSITIONS) {
      for (let i = 0; i < ROSTER_TEMPLATE[pos]; i++) {
        const starter = i < STARTERS[pos];
        let T = starter ? R.gauss(73, 6.5) : (i === STARTERS[pos] ? R.gauss(64, 5) : R.gauss(59, 6));
        T += q;
        if (starter && R.chance(0.07)) T += R.rand(6, 14);
        T = clamp(T, 40, 97);
        const age = Math.round(clamp(starter ? R.gauss(27, 3) : R.gauss(25, 3), 21, pos === 'K' || pos === 'P' ? 38 : 35));
        const p = createPlayer(L, pos, T, age);
        p.exp = clamp(age - 22 + R.int(-1, 1), 0, 16);
        p.tid = team.id; L.players[p.id] = p; team.roster.push(p.id);
      }
    }
  }
  for (let i = 0; i < 90; i++) addFreeAgent(L, R.weighted(POSITIONS, ps => POS_DRAFT_W[ps]), R.gauss(54, 6), R.int(23, 32));
  for (const p of Object.values(L.players)) genHistory(L, p);
  L.cap = START_CAP; L.capHist = [{ year: L.year, cap: L.cap, g: 0 }];
  assignInitialContracts(L);
  genRecords(L); L.stories = []; L.flags = {};
  const ranks = {};
  for (let c = 0; c < 2; c++) for (let d = 0; d < 4; d++) { const order = R.shuffle([0, 1, 2, 3]); for (let k = 0; k < 4; k++) ranks[tidOf(c, d, k)] = order[k]; }
  L.schedule = makeSchedule(L.year, ranks);
  L.pickOwn = {}; L.trades = []; L.scoutPts = 6; L.scoutStop = null; L.scoutReport = null;
  L.prospects = generateDraftClass(L, 300);
  news(L, `Welcome to the ${L.year} season! You are now GM of the ${teamName(L, userTeam)}.`, userTeam);
  return L;
}
function addFreeAgent(L, pos, T, age) {
  const p = createPlayer(L, pos, clamp(T, 35, 80), age);
  p.exp = Math.max(0, age - 22); p.tid = -1; L.players[p.id] = p; L.fa.push(p.id);
  return p;
}
function teamName(L, tid) { const t = L.teams[tid]; return t.city + ' ' + t.name; }

// ---------- Roster management ----------
function activeRoster(L, team) { return team.roster.map(id => L.players[id]).filter(p => !p.ir); }
function releasePlayer(L, p, silent) {
  const team = L.teams[p.tid]; if (!team) return;
  team.roster = team.roster.filter(id => id !== p.id);
  releaseDeadMoney(L, team, p);
  p.tid = -1; p.ir = false; L.fa.push(p.id);
  if (!silent && team.id === L.userTeam) news(L, `${team.abbr} released ${p.pos} ${fullName(p)}.`, team.id);
}
function signPlayer(L, team, p, silent) {
  L.fa = L.fa.filter(id => id !== p.id);
  if (!underContract(L, p)) { const a = askingContract(L, p, 'fa'); p.contract = { sal: a.sal, exp: L.year + a.yrs - 1, signed: L.year }; }
  p.tid = team.id; p.ir = false; team.roster.push(p.id);
  if (!silent && (team.id === L.userTeam || p.ovr >= 75)) news(L, `${team.abbr} signed ${p.pos} ${fullName(p)} (${p.ovr} OVR).`, team.id);
}
function posCounts(players) { const c = {}; POSITIONS.forEach(ps => c[ps] = 0); players.forEach(p => c[p.pos]++); return c; }

function cutToLimit(L, team, silent) {
  let active = activeRoster(L, team);
  while (active.length > ROSTER_LIMIT) {
    const cnt = posCounts(active);
    const cands = active.filter(p => cnt[p.pos] > ROSTER_MIN[p.pos]);
    if (!cands.length) break;
    let worst = null, wv = 1e9;
    for (const p of cands) {
      const v = playerValue(p) - Math.max(0, cnt[p.pos] - ROSTER_TEMPLATE[p.pos]) * 6;
      if (v < wv) { wv = v; worst = p; }
    }
    releasePlayer(L, worst, silent);
    active = activeRoster(L, team);
  }
}

function bestFA(L, pos, healthyOnly, budget) {
  let best = null, bv = -1e9;
  for (const id of L.fa) {
    const p = L.players[id]; if (p.pos !== pos || (healthyOnly && p.injury)) continue;
    if (budget !== undefined && askingContract(L, p, 'fa').sal > Math.max(budget, minSalary(L))) continue;
    const v = playerValue(p); if (v > bv) { bv = v; best = p; }
  }
  return best;
}

// AI: keep enough healthy bodies at each position, keep roster at 53.
function aiManageRoster(L, team) {
  const players = team.roster.map(id => L.players[id]);
  for (const p of players) if (p.injury && p.injury.weeks >= 4 && !p.ir) p.ir = true;
  for (const pos of POSITIONS) {
    let healthy = team.roster.map(id => L.players[id]).filter(p => p.pos === pos && !p.injury).length;
    let guard = 0;
    while (healthy < HEALTHY_NEED[pos] && guard++ < 6) {
      let fa = bestFA(L, pos, true, capSpace(L, team));
      if (!fa) fa = addFreeAgent(L, pos, R.gauss(52, 5), R.int(24, 30));
      if (activeRoster(L, team).length >= ROSTER_LIMIT) {
        // cut someone at a surplus position to make room
        const act = activeRoster(L, team); const cnt = posCounts(act);
        const cands = act.filter(p => p.pos !== pos && cnt[p.pos] > HEALTHY_NEED[p.pos] + 1 && !(p.injury && p.injury.weeks < 4 && p.ovr > 70));
        if (!cands.length) break;
        cands.sort((a, b) => playerValue(a) - playerValue(b));
        releasePlayer(L, cands[0], true);
      }
      signPlayer(L, team, fa, true);
      healthy++;
    }
  }
  cutToLimit(L, team, true);
}

function aiFillRoster(L, team) {
  let guard = 0;
  while (activeRoster(L, team).length < ROSTER_LIMIT && guard++ < 30) {
    const cnt = posCounts(activeRoster(L, team));
    let pos = POSITIONS.slice().sort((a, b) => (cnt[a] - ROSTER_TEMPLATE[a]) - (cnt[b] - ROSTER_TEMPLATE[b]))[0];
    let fa = bestFA(L, pos, false, capSpace(L, team));
    if (!fa) fa = addFreeAgent(L, pos, R.gauss(52, 5), R.int(23, 29));
    signPlayer(L, team, fa, true);
  }
}

// ---------- Injuries ----------
function weeksLeftInSeason(L) {
  if (L.phase === 'regular') return (REG_WEEKS - L.week) + 4;
  if (L.phase === 'playoffs') return 4 - (L.playoffs ? L.playoffs.round : 0);
  return 0;
}
function injurePlayer(L, p, inj, illness) {
  const weeks = R.int(inj[2], inj[3]);
  p.injury = { name: inj[0], weeks, fresh: !illness, ill: !!illness };
  p.injHist.push({ y: L.year, w: L.week, name: inj[0], weeks });
  if (inj[4]) for (const k in inj[4]) { const [a, b] = inj[4][k]; p.attrs[k] = clamp(p.attrs[k] - R.int(a, b), 15, 99); }
  if (inj[4]) { p.ovr = calcOvr(p); }
  if (weeks >= 4 && p.tid >= 0) p.ir = true;
  if (p.tid >= 0 && (p.tid === L.userTeam || p.ovr >= 82)) {
    const t = L.teams[p.tid];
    const left = weeksLeftInSeason(L);
    const dur = weeks >= left ? 'out for the season' : `out ${weeks} week${weeks > 1 ? 's' : ''}`;
    news(L, `${t.abbr} ${p.pos} ${fullName(p)} ${illness ? 'is sick' : 'injured'} (${inj[0]}) - ${dur}.`, p.tid);
    if (!illness && weeks >= 4 && p.ovr >= 84) story(L, 'INJURY', `${fullName(p)} ${weeks >= left ? 'lost for the season' : `out ${weeks} weeks`}`, `A major blow for the ${t.city} ${t.name}: ${p.pos} ${fullName(p)} (${p.ovr} OVR) suffered a ${inj[0].toLowerCase()}.`, [p.tid], p.id);
  }
}
function postGameInjuries(L, res) {
  for (const side of res.part) for (const e of side) {
    const p = L.players[e.id]; if (!p || p.injury) continue;
    const rate = INJ_RATE[p.pos] * (e.st ? 1 : 0.4) * (p.age > 31 ? 1.15 : 1);
    if (R.chance(rate)) injurePlayer(L, p, R.weighted(INJURIES, i => i[1]), false);
  }
}
function weeklyHealth(L) {
  for (const id in L.players) {
    const p = L.players[id];
    if (p.tid === -2) continue;
    if (p.injury) {
      if (p.injury.fresh) p.injury.fresh = false;
      else if (--p.injury.weeks <= 0) {
        if (p.tid >= 0 && (p.tid === L.userTeam || p.ovr >= 82)) news(L, `${L.teams[p.tid].abbr} ${p.pos} ${fullName(p)} has returned from ${p.injury.name}.`, p.tid);
        const last = p.injHist[p.injHist.length - 1];
        if (p.tid >= 0 && !p.injury.ill && last && last.weeks >= 4 && (p.ovr >= 84 || p.tid === L.userTeam)) story(L, 'RETURN', `${fullName(p)} is back`, `${L.teams[p.tid].abbr} ${p.pos} ${fullName(p)} (${p.ovr} OVR) has been cleared to return after missing ${last.weeks} weeks with a ${p.injury.name.toLowerCase()}.${L.phase === 'regular' ? ` The ${L.teams[p.tid].name} are ${recStr(L.teams[p.tid].rec)}.` : ''}`, [p.tid], p.id);
        p.injury = null; p.ir = false;
      }
    } else if (p.tid >= 0 && R.chance(0.0022)) {
      injurePlayer(L, p, R.weighted(ILLNESSES, i => i[1]), true);
      p.injury.fresh = false;
    }
  }
  for (const t of L.teams) {
    if (t.id !== L.userTeam || L.autoRoster) aiManageRoster(L, t);
    else for (const id of t.roster) { const p = L.players[id]; if (p.injury && p.injury.weeks >= 4) p.ir = true; }
  }
}

// ---------- Games ----------
function updateRecords(L, g) {
  const h = L.teams[g.home], a = L.teams[g.away];
  h.rec.pf += g.hs; h.rec.pa += g.as; a.rec.pf += g.as; a.rec.pa += g.hs;
  const res = g.hs > g.as ? 1 : g.hs < g.as ? -1 : 0;
  const apply = (t, o, r) => {
    const c = t.rec;
    if (r > 0) c.w++; else if (r < 0) c.l++; else c.t++;
    if (t.conf === o.conf && t.div === o.div) { if (r > 0) c.dw++; else if (r < 0) c.dl++; else c.dt++; }
    if (t.conf === o.conf) { if (r > 0) c.cw++; else if (r < 0) c.cl++; else c.ct++; }
    const h2 = c.h2h[o.id] || (c.h2h[o.id] = [0, 0, 0]); h2[r > 0 ? 0 : r < 0 ? 1 : 2]++;
    c.strk = r > 0 ? (c.strk > 0 ? c.strk + 1 : 1) : r < 0 ? (c.strk < 0 ? c.strk - 1 : -1) : 0;
  };
  apply(h, a, res); apply(a, h, -res);
}

function gameSummary(L, res) {
  const out = [];
  for (const side of [0, 1]) {
    const tid = side === 0 ? res.home : res.away;
    let qb = null, rb = null, wr = null;
    for (const pid in res.box) {
      const b = res.box[pid]; if (b.tid !== tid) continue;
      if (!qb || b.pYds > qb[1].pYds) qb = [pid, b];
      if (!rb || b.rYds > rb[1].rYds) rb = [pid, b];
      if (!wr || b.reYds > wr[1].reYds) wr = [pid, b];
    }
    const nm = (x) => x && L.players[x[0]] ? shortName(L.players[x[0]]) : '-';
    out.push({
      pass: qb ? `${nm(qb)} ${qb[1].pCmp}/${qb[1].pAtt} ${qb[1].pYds}y ${qb[1].pTd}TD` : '',
      rush: rb ? `${nm(rb)} ${rb[1].rAtt}-${rb[1].rYds}y` : '',
      rec: wr ? `${nm(wr)} ${wr[1].rec}-${wr[1].reYds}y` : '',
    });
  }
  return out;
}

function playGame(L, g, playoff) {
  const isUser = g.home === L.userTeam || g.away === L.userTeam;
  const res = simGame(L, g.home, g.away, { log: isUser, playoff, neutral: !!g.neutral });
  g.played = true; g.hs = res.hs; g.as = res.as; g.ot = res.ot;
  g.summary = gameSummary(L, res);
  const cbox = {}; for (const pid in res.box) { const c = compactStats(res.box[pid]); c.tid = res.box[pid].tid; cbox[pid] = c; }
  g.box = cbox; g.qs = res.qs; g.scoring = res.scoring; g.tstat = res.tstat;
  if (isUser) g.log = res.log;
  for (const pid in res.box) { const p = L.players[pid]; if (p) addStats(playoff ? p.pstats : p.stats, res.box[pid]); }
  if (!playoff) { updateRecords(L, g); checkGameRecords(L, res, g); }
  postGameInjuries(L, res);
  return res;
}

function userActiveCount(L) { return activeRoster(L, L.teams[L.userTeam]).length; }

function simWeek(L) {
  if (L.phase !== 'regular' || L.scoutStop) return;
  for (const g of L.schedule) if (g.week === L.week && !g.played) playGame(L, g, false);
  weeklyHealth(L);
  weeklyTraining(L);
  L.week++;
  teamSeasonRecords(L);
  weeklyStories(L);
  const stop = SCOUT_STOPS[L.week];
  if (stop && L.week <= REG_WEEKS) startScouting(L, stop[0], stop[1]);
  if (L.week > REG_WEEKS) endRegularSeason(L);
}

// ---------- Standings ----------
function cmpTeams(a, b) {
  const pa = recPct(a.rec), pb = recPct(b.rec);
  if (pa !== pb) return pb - pa;
  const h = a.rec.h2h[b.id];
  if (h && h[0] !== h[1]) return h[0] > h[1] ? -1 : 1;
  if (a.conf === b.conf && a.div === b.div) { const da = pct(a.rec.dw, a.rec.dl, a.rec.dt), db = pct(b.rec.dw, b.rec.dl, b.rec.dt); if (da !== db) return db - da; }
  if (a.conf === b.conf) { const ca = pct(a.rec.cw, a.rec.cl, a.rec.ct), cb = pct(b.rec.cw, b.rec.cl, b.rec.ct); if (ca !== cb) return cb - ca; }
  const da = a.rec.pf - a.rec.pa, db = b.rec.pf - b.rec.pa; if (da !== db) return db - da;
  return a.id - b.id;
}
function divStandings(L, conf, div) { return L.teams.filter(t => t.conf === conf && t.div === div).sort(cmpTeams); }
function confSeeds(L, conf) {
  const winners = DIVS.map(d => divStandings(L, conf, d)[0]).sort(cmpTeams);
  const rest = L.teams.filter(t => t.conf === conf && !winners.includes(t)).sort(cmpTeams);
  return [...winners, ...rest.slice(0, 3)].map(t => t.id);
}
function computeRanks(L) {
  const ranks = {};
  for (const c of CONFS) for (const d of DIVS) divStandings(L, c, d).forEach((t, i) => ranks[t.id] = i);
  return ranks;
}

// ---------- Awards ----------
function offScore(p, s, qbFactor) {
  if (p.pos === 'QB') return (st(s, 'pYds') / 25 + st(s, 'pTd') * 4 - st(s, 'pInt') * 2.5 + st(s, 'rYds') / 10 + st(s, 'rTd') * 6 - st(s, 'fum') * 2) * qbFactor;
  return (st(s, 'rYds') + st(s, 'reYds')) / 10 + (st(s, 'rTd') + st(s, 'reTd')) * 6 + st(s, 'rec') * 0.3 - st(s, 'fum') * 2;
}
function defScore(s) { return st(s, 'sack') * 7 + st(s, 'dInt') * 8 + st(s, 'tkl') * 0.6 + st(s, 'ff') * 5 + st(s, 'pd') * 1.5; }
function statLine(p, s) {
  s = s || p.stats;
  if (p.pos === 'QB') return `${st(s, 'pYds')} yds, ${st(s, 'pTd')} TD, ${st(s, 'pInt')} INT`;
  if (p.pos === 'RB') return `${st(s, 'rYds')} rush yds, ${st(s, 'rTd') + st(s, 'reTd')} TD, ${st(s, 'reYds')} rec yds`;
  if (p.pos === 'WR' || p.pos === 'TE') return `${st(s, 'rec')} rec, ${st(s, 'reYds')} yds, ${st(s, 'reTd')} TD`;
  if (p.pos === 'K') return `${st(s, 'fgm')}/${st(s, 'fga')} FG, long ${st(s, 'fgLng')}`;
  if (p.pos === 'P') return `${st(s, 'pnt')} punts, ${st(s, 'pnt') ? (s.pntYds / s.pnt).toFixed(1) : 0} avg`;
  if (p.pos === 'OL') return `${st(s, 'gs')} starts, ${p.ovr} OVR`;
  return `${st(s, 'tkl')} tkl, ${st(s, 'sack')} sacks, ${st(s, 'dInt')} INT`;
}
function awardEntry(L, p, score) { return { pid: p.id, name: fullName(p), pos: p.pos, tid: p.tid, abbr: p.tid >= 0 ? L.teams[p.tid].abbr : 'FA', line: statLine(p), score: Math.round(score) }; }

function computeAwards(L) {
  const pool = Object.values(L.players).filter(p => p.tid >= 0 && p.stats.gp > 0);
  const wins = (p) => L.teams[p.tid].rec.w;
  const top = (arr, fn, n = 3) => arr.map(p => [p, fn(p)]).sort((a, b) => b[1] - a[1]).slice(0, n).map(([p, s]) => awardEntry(L, p, s));
  const offense = pool.filter(p => OFFENSE.includes(p.pos) && p.pos !== 'OL');
  const defense = pool.filter(p => DEFENSE.includes(p.pos));
  const A = {};
  A.MVP = top(offense, p => offScore(p, p.stats, 1) * (p.pos === 'QB' ? 1 : 0.8) + wins(p) * (p.pos === 'QB' ? 9 : 6));
  A.OPOY = top(offense, p => offScore(p, p.stats, 0.72));
  A.DPOY = top(defense, p => defScore(p.stats) + wins(p) * 0.8);
  A.OROY = top(offense.filter(p => p.exp === 0), p => offScore(p, p.stats, 0.85));
  A.DROY = top(defense.filter(p => p.exp === 0), p => defScore(p.stats));
  const comeback = pool.filter(p => { const last = p.career[p.career.length - 1]; return p.exp > 0 && last && last.year === L.year - 1 && (last.gp || 0) <= 7; });
  A.CPOY = top(comeback, p => (DEFENSE.includes(p.pos) ? defScore(p.stats) : offScore(p, p.stats, 0.72)) + p.ovr * 0.5);
  // Coach of the year: biggest improvement (or best record in year 1)
  const coy = L.teams.map(t => [t, t.prevWins === null ? t.rec.w + (t.rec.pf - t.rec.pa) / 50 : (t.rec.w - t.prevWins) * 2 + t.rec.w]).sort((a, b) => b[1] - a[1]).slice(0, 3);
  A.COY = coy.map(([t]) => ({ tid: t.id, name: `Head Coach, ${t.city} ${t.name}`, abbr: t.abbr, line: recStr(t.rec), pos: 'HC' }));
  // All-Pro first team
  const ap = {};
  const byPos = (pos) => pool.filter(p => p.pos === pos && p.stats.gp >= 8);
  const ovrScore = p => p.ovr * 2 + p.stats.gs;
  ap.QB = top(byPos('QB'), p => offScore(p, p.stats, 1) + wins(p) * 3, 1);
  ap.RB = top(byPos('RB'), p => offScore(p, p.stats, 1), 1);
  ap.WR = top(byPos('WR'), p => offScore(p, p.stats, 1), 3);
  ap.TE = top(byPos('TE'), p => offScore(p, p.stats, 1), 1);
  ap.OL = top(byPos('OL'), ovrScore, 5);
  ap.DE = top(byPos('DE'), p => defScore(p.stats) + p.ovr * 0.5, 2);
  ap.DT = top(byPos('DT'), p => defScore(p.stats) + p.ovr * 0.5, 2);
  ap.LB = top(byPos('LB'), p => defScore(p.stats) + p.ovr * 0.3, 3);
  ap.CB = top(byPos('CB'), p => defScore(p.stats) + p.ovr * 0.5, 2);
  ap.S = top(byPos('S'), p => defScore(p.stats) + p.ovr * 0.5, 2);
  ap.K = top(byPos('K'), p => st(p.stats, 'fgm') * 3 - (st(p.stats, 'fga') - st(p.stats, 'fgm')) * 4 + p.ovr * 0.3, 1);
  ap.P = top(byPos('P'), p => (p.stats.pnt ? p.stats.pntYds / p.stats.pnt : 0) * 3 + p.ovr * 0.3, 1);
  A.allPro = ap;
  const label = { MVP: 'MVP', OPOY: 'Offensive Player of the Year', DPOY: 'Defensive Player of the Year', OROY: 'Offensive Rookie of the Year', DROY: 'Defensive Rookie of the Year', CPOY: 'Comeback Player of the Year' };
  for (const k in label) {
    const w = A[k][0]; if (!w) continue;
    const p = L.players[w.pid]; p.awards.push(`${L.year} ${k}`);
    news(L, `${L.year} ${label[k]}: ${w.name} (${w.pos}, ${w.abbr}) - ${w.line}`, w.tid);
    if (k === 'MVP' || k === 'DPOY' || k === 'OROY') story(L, 'AWARD', `${w.name} wins ${label[k]}`, `${w.pos} ${w.name} (${w.abbr}) takes home ${label[k]} honors: ${w.line}.${A[k][1] ? ` Runner-up: ${A[k][1].name} (${A[k][1].abbr}).` : ''}`, [w.tid], w.pid);
  }
  for (const pos in ap) for (const e of ap[pos]) L.players[e.pid].awards.push(`${L.year} All-Pro`);
  L.awards[L.year] = A;
}

function endRegularSeason(L) {
  L.phase = 'awards';
  L.lastRanks = computeRanks(L);
  computeAwards(L);
  startScouting(L, 'Bowl Season Scouting', 15);
}

// ---------- Playoffs ----------
function startPlayoffs(L) {
  const seeds = { American: confSeeds(L, 'American'), National: confSeeds(L, 'National') };
  L.playoffs = { seeds, round: 0, games: [], elim: {}, alive: { American: seeds.American.slice(), National: seeds.National.slice() }, champion: null };
  L.phase = 'playoffs';
  for (const c of CONFS) news(L, `${c} playoff field: ` + seeds[c].map((t, i) => `${i + 1}. ${L.teams[t].abbr}`).join(', '));
  setupRound(L);
}
function seedOf(L, tid) { const P = L.playoffs; for (const c of CONFS) { const i = P.seeds[c].indexOf(tid); if (i >= 0) return i + 1; } return 0; }
function setupRound(L) {
  const P = L.playoffs, r = P.round;
  const mk = (home, away, conf, neutral) => P.games.push({ id: `p${L.year}_${r}_${P.games.length}`, round: r, conf, home, away, played: false, neutral: !!neutral, week: REG_WEEKS + 1 + r });
  if (r < 3) {
    for (const c of CONFS) {
      const alive = P.alive[c].slice().sort((a, b) => P.seeds[c].indexOf(a) - P.seeds[c].indexOf(b));
      if (r === 0) { mk(alive[1], alive[6], c); mk(alive[2], alive[5], c); mk(alive[3], alive[4], c); }
      else if (r === 1) { mk(alive[0], alive[3], c); mk(alive[1], alive[2], c); }
      else mk(alive[0], alive[1], c);
    }
  } else {
    const a = P.alive.American[0], n = P.alive.National[0];
    if (L.year % 2 === 0) mk(a, n, 'MC', true); else mk(n, a, 'MC', true);
  }
}
function simPlayoffRound(L) {
  const P = L.playoffs; const r = P.round;
  for (const g of P.games) {
    if (g.round !== r || g.played) continue;
    playGame(L, g, true);
    const winner = g.hs > g.as ? g.home : g.away, loser = winner === g.home ? g.away : g.home;
    g.winner = winner;
    const lc = L.teams[loser].conf;
    P.alive[lc] = P.alive[lc].filter(t => t !== loser);
    P.elim[loser] = r;
    if (loser === L.userTeam || winner === L.userTeam) news(L, `${ROUND_NAMES[r]}: ${L.teams[winner].abbr} def. ${L.teams[loser].abbr} ${Math.max(g.hs, g.as)}-${Math.min(g.hs, g.as)}${g.ot ? ' (OT)' : ''}`, L.userTeam);
  }
  weeklyHealth(L);
  if (r === 3) {
    const g = P.games.find(x => x.round === 3);
    P.champion = g.winner; P.elim[g.winner] = 4;
    const loser = g.winner === g.home ? g.away : g.home;
    // Megacup MVP: best single-game performer on the winning side
    let mvp = null, mv = -1e9;
    for (const pid in g.box) {
      const b = g.box[pid]; if (b.tid !== g.winner) continue; const p = L.players[pid]; if (!p) continue;
      const v = (st(b, 'pYds') / 20 + st(b, 'pTd') * 5 - st(b, 'pInt') * 4) + (st(b, 'rYds') + st(b, 'reYds')) / 10 + (st(b, 'rTd') + st(b, 'reTd')) * 6 + defScore(b) * 1.1;
      if (v > mv) { mv = v; mvp = p; }
    }
    if (mvp) mvp.awards.push(`${L.year} Megacup MVP`);
    const champT = L.teams[g.winner];
    L.champions.push({ year: L.year, champ: g.winner, runner: loser, score: `${Math.max(g.hs, g.as)}-${Math.min(g.hs, g.as)}`, ot: g.ot, mvp: mvp ? { name: fullName(mvp), pos: mvp.pos, pid: mvp.id } : null });
    story(L, 'CHAMPION', `${champT.city} ${champT.name} win the Megacup`, `The ${champT.name} beat the ${L.teams[loser].city} ${L.teams[loser].name} ${Math.max(g.hs, g.as)}-${Math.min(g.hs, g.as)}${g.ot ? ' in overtime' : ''}. Megacup MVP: ${mvp ? mvp.pos + ' ' + fullName(mvp) : '-'}.`, [g.winner, loser], mvp ? mvp.id : undefined);
    news(L, `MEGACUP: The ${champT.city} ${champT.name} are champions! Beat ${L.teams[loser].abbr} ${Math.max(g.hs, g.as)}-${Math.min(g.hs, g.as)}. MVP: ${mvp ? fullName(mvp) : '-'}`, g.winner);
    L.phase = 'postseason';
  } else {
    P.round++;
    setupRound(L);
  }
}

// ---------- Offseason ----------
function playoffResult(L, tid) {
  const P = L.playoffs; if (!P) return 'Missed Playoffs';
  const e = P.elim[tid]; if (e === undefined) return 'Missed Playoffs';
  return ['Lost Wild Card', 'Lost Divisional', 'Lost Conf. Championship', 'Lost Megacup', 'WON MEGACUP'][e];
}
function computeDraftOrder(L) {
  const elim = L.playoffs ? L.playoffs.elim : {};
  const key = t => [elim[t.id] === undefined ? -1 : elim[t.id], recPct(t.rec), t.rec.pf - t.rec.pa];
  return L.teams.slice().sort((a, b) => { const ka = key(a), kb = key(b); for (let i = 0; i < 3; i++) if (ka[i] !== kb[i]) return ka[i] - kb[i]; return Math.random() - 0.5; }).map(t => t.id);
}
function retireChance(p) {
  const pk = PEAK[p.pos][1] + (p.gen ? GEN_PEAK_BONUS : 0);
  let c = 0;
  if (p.age >= 39) c = 0.9; else if (p.age >= pk + 5) c = 0.6; else if (p.age >= pk + 3) c = 0.3; else if (p.age > pk) c = 0.08;
  if (p.ovr < 55 && p.age >= 29) c += 0.3;
  if (p.ovr >= 85) c *= 0.5;
  if (p.tid === -1 && p.age >= 30) c += 0.25;
  return clamp(c, 0, 0.97);
}
function careerTotals(p) { const t = emptyStats(); p.career.forEach(c => addStats(t, c)); return t; }

function runOffseason(L) {
  const season = L.year;
  for (const t of L.teams) {
    t.history.push({ year: season, w: t.rec.w, l: t.rec.l, t: t.rec.t, pf: t.rec.pf, pa: t.rec.pa, seed: L.playoffs ? seedOf(L, t.id) : 0, result: playoffResult(L, t.id), ts: teamSeasonStats(L, t.id).v });
    t.prevWins = t.rec.w;
  }
  for (const p of Object.values(L.players)) {
    if (p.tid === -2) continue;
    if (p.stats.gp > 0 || p.pstats.gp > 0) {
      const c = compactStats(p.stats); c.year = season; c.tm = p.tid >= 0 ? L.teams[p.tid].abbr : 'FA'; c.ovr = p.ovr;
      if (p.pstats.gp) c.pgp = p.pstats.gp;
      p.career.push(c);
    }
    if (p.tid >= 0) p.ovrHist.push({ y: season, o: p.ovr });
  }
  const order = computeDraftOrder(L);
  const capRatio = avgPayrollRatio(L);
  L.year++;
  L.flags = {};
  bizOffseason(L, capRatio);
  // Aging, development, retirement
  let retiredCount = 0;
  for (const p of Object.values(L.players)) {
    if (p.tid === -2) continue;
    p.age++; p.exp++;
    const d = progressPlayer(p);
    if (p.tid === L.userTeam && Math.abs(d) >= 4) news(L, `${p.pos} ${fullName(p)} ${d > 0 ? 'improved' : 'declined'} ${d > 0 ? '+' : ''}${d} to ${p.ovr} OVR.`, p.tid);
    p.stats = emptyStats(); p.pstats = emptyStats();
    if (p.injury) { p.injury.weeks -= 26; if (p.injury.weeks <= 0) { p.injury = null; p.ir = false; } }
    if (R.chance(retireChance(p))) {
      retiredCount++;
      const tot = careerTotals(p);
      const notable = p.awards.length > 0 || p.career.length >= 10 || Math.max(p.ovr, ...p.ovrHist.map(h => h.o)) >= 88;
      if (notable) {
        const majors = p.awards.filter(a => /MVP|POY|All-Pro/.test(a)).length;
        L.retired.push({ name: fullName(p), pos: p.pos, from: p.career.length ? p.career[0].year : L.year - 1, to: L.year - 1, seasons: p.career.length, awards: p.awards.slice(), tot: compactStats(tot), hof: majors >= 4 || p.awards.some(a => / MVP$/.test(a) && !/Megacup|Super/.test(a)) && majors >= 2, lastTeam: p.career.length ? p.career[p.career.length - 1].tm : '' });
      }
      if (notable && (p.awards.length >= 2 || p.ovr >= 82)) story(L, 'RETIREMENT', `${fullName(p)} retires`, `${p.pos} ${fullName(p)} calls it a career after ${p.career.length} seasons. ${careerLineText(p, tot)}${p.awards.length ? ' Honors: ' + summarizeAwardsText(p.awards) + '.' : ''}`, p.tid >= 0 ? [p.tid] : [], undefined);
      if ((p.tid === L.userTeam) || p.ovr >= 82 || notable) news(L, `${p.pos} ${fullName(p)} (${p.tid >= 0 ? L.teams[p.tid].abbr : 'FA'}) has retired after ${p.career.length} seasons.`, p.tid);
      if (p.tid >= 0) { const t = L.teams[p.tid]; t.roster = t.roster.filter(id => id !== p.id); }
      else L.fa = L.fa.filter(id => id !== p.id);
      delete L.players[p.id];
    }
  }
  for (const t of L.teams) t.rec = newRec();
  L.schedule = [];
  L.playoffs = null;
  // Draft
  const pool = (L.prospects && L.prospects.length) ? L.prospects.slice() : generateDraftClass(L, 300);
  L.prospects = [];
  const picks = [];
  for (let rd = 1; rd <= 7; rd++) order.forEach((orig, i) => picks.push({ rd, pk: i + 1, ovr: (rd - 1) * 32 + i + 1, tid: getPickOwner(L, L.year, rd, orig), orig, pid: null }));
  if (L.pickOwn) delete L.pickOwn[L.year];
  L.draft = { year: L.year, picks, pool, cur: 0 };
  sortBoard(L, L.draft.pool);
  L.phase = 'resign'; L.week = 0;
  news(L, `${retiredCount} players retired. The ${L.year} Draft order is set - ${L.teams[picks[0].tid].abbr} picks first. Re-sign your expiring players before free agency opens.`, L.userTeam);
}

function generateDraftClass(L, n) {
  const ids = [];
  for (let i = 0; i < n; i++) {
    const pos = R.weighted(POSITIONS, ps => POS_DRAFT_W[ps]);
    const q = Math.pow(Math.random(), 2.3);
    const age = R.int(21, 23);
    const p = createPlayer(L, pos, 42 + q * 36 + R.gauss(0, 2), age);
    p.tid = -2; p.exp = 0;
    assignTraits(p, true);
    p.pot = clamp(Math.round(p.ovr + R.rand(3, 20) + q * 8 + (age === 21 ? 3 : 0)), p.ovr, 99);
    p.sc = 0; p.errO = R.gauss(0, 1); p.errP = R.gauss(0, 1);  // scouting fog: your view = truth + err * spread[level]
    updateScout(p);
    L.players[p.id] = p; ids.push(p.id);
  }
  const nGen = R.chance(0.3) ? (R.chance(0.12) ? 2 : 1) : 0;
  for (let i = 0; i < nGen; i++) { const p = makeGenerational(L); L.players[p.id] = p; ids.push(p.id); }
  return sortBoard(L, ids);
}
// A once-in-a-generation prospect: starts around 80-86 OVR with 96-99 potential.
function makeGenerational(L) {
  const pos = R.weighted(POSITIONS.filter(ps => ps !== 'K' && ps !== 'P'), ps => POS_DRAFT_W[ps] * POS_VALUE[ps]);
  const p = createPlayer(L, pos, R.rand(80, 86), R.int(20, 22));
  p.tid = -2; p.exp = 0; p.gen = true;
  assignTraits(p, true);
  p.pot = clamp(R.int(96, 99), p.ovr + 6, 99);
  p.sc = 0; p.errO = R.gauss(0, 0.4); p.errP = R.gauss(0, 0.3);  // everyone has seen the tape
  updateScout(p);
  return p;
}

function draftPlayer(L, pid) {
  const D = L.draft; const pick = D.picks[D.cur]; const p = L.players[pid]; const team = L.teams[pick.tid];
  p.tid = team.id; team.roster.push(p.id);
  p.draft = { year: D.year, rd: pick.rd, pk: pick.pk, ovr: pick.ovr, tid: team.id };
  p.contract = { sal: rookieSalary(L, pick.ovr), exp: D.year + 3, rookie: true };
  if (pick.ovr === 1) story(L, 'DRAFT', `${team.abbr} take ${fullName(p)} first overall`, `The ${team.city} ${team.name} open the ${D.year} Draft by selecting ${p.pos} ${fullName(p)} out of ${p.college}. Rookie deal: 4 years at ${fmtM(p.contract.sal)} per year.`, [team.id], p.id);
  clearScout(p);
  D.pool = D.pool.filter(id => id !== pid);
  pick.tr = ensureTrueRank(L, D)[pid];
  pick.pid = pid; pick.name = fullName(p); pick.pos = p.pos; pick.pOvr = p.ovr; pick.pPot = p.pot;
  D.cur++;
  if (pick.rd === 1 || team.id === L.userTeam) news(L, `Draft R${pick.rd} #${pick.ovr}: ${team.abbr} select ${p.pos} ${fullName(p)} (${p.college}).`, team.id);
}
// ---------- Roster needs analysis ----------
// How much each position matters when weighing a need (QB is king, specialists are cheap).
const POS_VALUE = { QB: 1.5, RB: 0.8, WR: 1.1, TE: 0.85, OL: 1.15, DE: 1.2, DT: 1.0, LB: 0.9, CB: 1.15, S: 0.9, K: 0.35, P: 0.3 };

function leagueStarterAvg(L) {
  const sum = {}, n = {};
  POSITIONS.forEach(ps => { sum[ps] = 0; n[ps] = 0; });
  for (const t of L.teams) {
    const by = {}; POSITIONS.forEach(ps => by[ps] = []);
    for (const id of t.roster) { const p = L.players[id]; by[p.pos].push(p.ovr); }
    for (const ps of POSITIONS) { const arr = by[ps].sort((a, b) => b - a).slice(0, STARTERS[ps]); arr.forEach(v => { sum[ps] += v; n[ps]++; }); }
  }
  const out = {}; POSITIONS.forEach(ps => out[ps] = n[ps] ? sum[ps] / n[ps] : 70);
  return out;
}

// Need score 0-10 per position, with the reasons behind it.
function teamNeeds(L, team, lgAvg) {
  lgAvg = lgAvg || leagueStarterAvg(L);
  const roster = team.roster.map(id => L.players[id]);
  const out = {};
  for (const pos of POSITIONS) {
    const arr = roster.filter(p => p.pos === pos).sort((a, b) => b.ovr - a.ovr);
    const n = STARTERS[pos];
    const starters = arr.slice(0, n);
    const stVals = starters.map(p => p.ovr); while (stVals.length < n) stVals.push(40);
    const stAvg = stVals.reduce((a, b) => a + b, 0) / n;
    const lg = lgAvg[pos];
    const gap = lg - stAvg;
    const depthShort = Math.max(0, ROSTER_TEMPLATE[pos] - arr.length);
    const pk = PEAK[pos][1];
    const aging = starters.filter(p => p.age >= pk + 1);
    const hurt = starters.filter(p => p.injury && p.injury.weeks >= 8);
    const successor = arr.slice(n).find(p => p.age <= 24 && p.pot >= stAvg + 3);
    const surplus = Math.max(0, arr.length - ROSTER_TEMPLATE[pos]);
    const drafted = L.draft ? L.draft.picks.filter(k => k.tid === team.id && k.pid && k.pos === pos).length : 0;
    const score = gap * 0.45 + depthShort * 1.2 + (aging.length / n) * 3 + (hurt.length / n) * 2.5 - (successor ? 1.5 : 0) - surplus * 1.2 - drafted * 3 + 2;
    const need = Math.round(clamp(score, 0, 10) * 10) / 10;
    const reasons = [];
    if (gap >= 3) reasons.push(`starters ${Math.round(stAvg)} OVR vs league ${Math.round(lg)}`);
    else if (gap <= -4) reasons.push(`strong starters (${Math.round(stAvg)} vs ${Math.round(lg)})`);
    if (depthShort) reasons.push(`thin depth (${arr.length}/${ROSTER_TEMPLATE[pos]})`);
    if (aging.length) reasons.push(`aging: ${aging.map(p => p.ln + ' ' + p.age).join(', ')}`);
    if (hurt.length) reasons.push(`injured starter: ${hurt.map(p => p.ln).join(', ')}`);
    if (successor) reasons.push(`young successor: ${successor.ln}`);
    if (drafted) reasons.push(`already drafted ${drafted} this year`);
    out[pos] = { pos, need, level: need >= 6 ? 'HIGH' : need >= 3.5 ? 'MED' : 'LOW', stAvg: Math.round(stAvg), lg: Math.round(lg), count: arr.length, worstStarter: stVals[n - 1], reasons };
  }
  return out;
}

// Board value blended with team fit. Prospects use scouted ratings (sOvr / sPot).
// ai=true: AI front offices use their own (good, slightly noisy) scouting instead of your estimates.
function draftFit(p, needs, ai) {
  const nd = needs[p.pos], pv = POS_VALUE[p.pos];
  const o = ai ? p.ovr + R.gauss(0, 2) : p.sOvr, pt = ai ? p.pot + R.gauss(0, 2.5) : p.sPot;
  const base = pt * 0.55 + o * 0.45;
  let v = base + (pv - 1) * 3 + nd.need * 0.5 * pv;
  const startsNow = o > nd.worstStarter;
  if (startsNow) v += 2.5 * pv;
  if ((p.pos === 'K' || p.pos === 'P') && nd.count >= 1 && nd.worstStarter >= o) v -= 10;
  return { v, base, startsNow };
}
function recommendProspects(L, team, n, ids) {
  const D = L.draft; ids = ids || (D ? D.pool : null); if (!ids || !ids.length) return [];
  const needs = teamNeeds(L, team);
  const pool = ids.slice(0, 120).map(id => L.players[id]);
  const scored = pool.map((p, i) => ({ p, rank: i + 1, ...draftFit(p, needs) })).sort((a, b) => b.v - a.v).slice(0, n || 5);
  for (const r of scored) {
    const nd = needs[r.p.pos]; const why = [];
    if (r.rank <= 3) why.push(`#${r.rank} on the board`);
    if (nd.level !== 'LOW') why.push(`${nd.level} need at ${r.p.pos}`);
    if (r.startsNow) why.push(`could start now (${r.p.sOvr} vs your ${nd.worstStarter})`);
    if (r.p.sPot >= 85) why.push(`high ceiling (${potGrade(r.p.sPot, r.p.gen)})`);
    if (!why.length) why.push('best value available');
    r.why = why;
  }
  return scored;
}

function aiDraftPick(L) {
  const D = L.draft; const pick = D.picks[D.cur]; const team = L.teams[pick.tid];
  const needs = teamNeeds(L, team);
  let best = null, bv = -1e9;
  for (const pid of D.pool.slice(0, 120)) {
    const p = L.players[pid];
    const v = draftFit(p, needs, true).v + R.gauss(0, 2);
    if (v > bv) { bv = v; best = p; }
  }
  draftPlayer(L, best.id);
}
function draftDone(L) { return !L.draft || L.draft.cur >= L.draft.picks.length; }
function simDraftToUser(L) { while (!draftDone(L) && L.draft.picks[L.draft.cur].tid !== L.userTeam) aiDraftPick(L); }
function simDraftAll(L) { while (!draftDone(L)) aiDraftPick(L); }
function finishDraft(L) {
  simDraftAll(L);
  const D = L.draft;
  L.draftHistory[D.year] = D.picks.map(p => ({ ovr: p.ovr, rd: p.rd, pk: p.pk, tid: p.tid, name: p.name, pos: p.pos, pid: p.pid, tr: p.tr }));
  D.pool.forEach((pid, i) => {
    const p = L.players[pid];
    if (i < 70) { p.tid = -1; clearScout(p); L.fa.push(pid); } else delete L.players[pid];
  });
  L.draft = null;
  for (const t of L.teams) {
    if (t.id === L.userTeam) continue;
    cutToLimit(L, t, true); aiCapComply(L, t); aiFillRoster(L, t);
  }
  // prune free agent pool
  L.fa.sort((a, b) => playerValue(L.players[b]) - playerValue(L.players[a]));
  const keep = L.fa.slice(0, 180), drop = L.fa.slice(180);
  drop.forEach(id => delete L.players[id]);
  L.fa = keep;
  L.phase = 'preseason';
  news(L, `The draft is complete. Cut your roster to ${ROSTER_LIMIT} and sign free agents before the season.`, L.userTeam);
}
function startSeason(L) {
  const u = L.teams[L.userTeam];
  if (activeRoster(L, u).length > ROSTER_LIMIT) return `Your active roster has ${activeRoster(L, u).length} players. Cut down to ${ROSTER_LIMIT} first.`;
  if (payroll(L, u) > L.cap) return `You are ${fmtM(payroll(L, u) - L.cap)} over the ${fmtM(L.cap)} salary cap. Release or trade players first.`;
  for (const t of L.teams) if (t.id !== L.userTeam) { aiCapComply(L, t); cutToLimit(L, t, true); aiFillRoster(L, t); }
  L.schedule = makeSchedule(L.year, L.lastRanks);
  L.week = 1; L.phase = 'regular';
  L.prospects = generateDraftClass(L, 300);
  announceGenerational(L);
  news(L, `The ${L.year} regular season begins! Scouts are on the road evaluating the ${L.year + 1} draft class.`, L.userTeam);
  return null;
}

// ---------- Save / Load ----------
function serializeLeague(L) {
  return JSON.stringify(L, function (k, v) {
    if ((k === 'stats' || k === 'pstats') && v && typeof v === 'object' && 'pAtt' in v) return compactStats(v);
    return v;
  });
}
function saveLeague(L) {
  try { localStorage.setItem(SAVE_KEY, serializeLeague(L)); return true; } catch (e) { return false; }
}
function loadLeague() {
  try { const s = localStorage.getItem(SAVE_KEY); if (!s) return null; const L = JSON.parse(s); if (!L || L.version !== 1) return null; for (const id in L.players) { const p = L.players[id]; p.stats = Object.assign(emptyStats(), p.stats); p.pstats = Object.assign(emptyStats(), p.pstats); } migrateLeague(L); migrateBiz(L); migrateDev(L); return L; } catch (e) { return null; }
}
function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }
function deleteSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ } }
