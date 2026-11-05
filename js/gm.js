'use strict';
// ================= Draft pick ownership =================
// L.pickOwn[draftYear][round][originalTeam] = current owner (absent = original team).
function getPickOwner(L, year, rd, orig) { const y = L.pickOwn && L.pickOwn[year]; const r = y && y[rd]; return r && r[orig] !== undefined ? r[orig] : orig; }
function setPickOwner(L, year, rd, orig, owner) {
  L.pickOwn = L.pickOwn || {};
  const y = L.pickOwn[year] || (L.pickOwn[year] = {}); const r = y[rd] || (y[rd] = {});
  r[orig] = owner;
}

// ================= College scouting =================
const SCOUT_SPREAD = [9, 5, 2.5, 0], SCOUT_PSPREAD = [12, 7, 3, 0];
const SCOUT_LABELS = ['Unscouted', 'Basic', 'Detailed', 'Full'];
// key = week number about to be played (i.e. stop after weeks 4, 9, 14)
const SCOUT_STOPS = { 5: ['Early Season Scouting', 10], 10: ['Midseason Scouting', 10], 15: ['Late Season Scouting', 10] };

function updateScout(p) {
  const sc = p.sc || 0;
  p.sOvr = clamp(Math.round(p.ovr + (p.errO || 0) * SCOUT_SPREAD[sc]), 30, 99);
  p.sPot = clamp(Math.round(p.pot + (p.errP || 0) * SCOUT_PSPREAD[sc]), p.sOvr, 99);
}
function clearScout(p) { delete p.sOvr; delete p.sPot; delete p.sc; delete p.errO; delete p.errP; }
const boardVal = (p) => p.sPot * 0.55 + p.sOvr * 0.45;
function sortBoard(L, ids) { ids.sort((a, b) => boardVal(L.players[b]) - boardVal(L.players[a])); return ids; }
function currentBoard(L) { return L.draft ? L.draft.pool : (L.prospects || []); }
function scoutCost(p) { return (p.sc || 0) + 1; }

function scoutProspect(L, pid) {
  const p = L.players[pid];
  if (!p || p.tid !== -2 || (p.sc || 0) >= 3) return false;
  const c = scoutCost(p); if (L.scoutPts < c) return false;
  L.scoutPts -= c; p.sc = (p.sc || 0) + 1; updateScout(p);
  sortBoard(L, currentBoard(L));
  return true;
}
// ---------- Your picks and what's realistically there when you pick ----------
// Upcoming picks for a team in the next draft: actual picks during the draft, projected slots before it.
function teamDraftPicks(L, tid) {
  if (L.draft) return L.draft.picks.slice(L.draft.cur).filter(p => p.tid === tid).map(p => ({ ovr: p.ovr, rd: p.rd, pk: p.pk, before: p.ovr - 1 - L.draft.cur }));
  if (!(L.prospects || []).length) return [];
  const proj = projectDraftOrder(L), y = L.year + 1, out = [];
  for (let rd = 1; rd <= 7; rd++) for (let o = 0; o < 32; o++) if (getPickOwner(L, y, rd, o) === tid) { const ovr = (rd - 1) * 32 + proj.slot[o]; out.push({ ovr, rd, pk: proj.slot[o], before: ovr - 1, proj: true }); }
  return out.sort((a, b) => a.ovr - b.ovr);
}
// Chance a prospect at board index i (0-based) is still there after `before` picks. Rival boards differ, so it's soft.
function availProb(i, before) { return 1 / (1 + Math.exp(-(i - before + 2) / (2.5 + before * 0.12))); }
// Team needs adjusted for draft position: a need you can fill at your first picks counts for more,
// a need nobody worth taking will be left for gets dialed down.
function draftNeeds(L, team, needs, board) {
  needs = needs || teamNeeds(L, team); board = board || currentBoard(L);
  const picks = teamDraftPicks(L, team.id).filter(p => p.rd <= 2).slice(0, 2);
  if (!picks.length || !board.length) return needs;
  const out = {};
  for (const pos of POSITIONS) {
    const nd = needs[pos];
    let best = null;
    for (const pk of picks) {
      for (let i = 0; i < Math.min(board.length, 160); i++) {
        const p = L.players[board[i]]; if (!p || p.pos !== pos || availProb(i, pk.before) < 0.5) continue;
        if (!best || p.sPot * 0.55 + p.sOvr * 0.45 > best.p.sPot * 0.55 + best.p.sOvr * 0.45) best = { p, pk };
        break; // first likely-available one at this pick is the best of that position on the board
      }
    }
    let adj = 0, note = null;
    if (!best) { adj = -1.5; note = `none projected at #${picks[0].ovr}`; }
    else if (best.p.sOvr > nd.worstStarter) { adj = 1; note = `${best.p.ln} could start, likely there at #${best.pk.ovr}`; }
    else if (best.p.sPot >= nd.stAvg + 4) { adj = 0.5; note = `${best.p.ln} (${potGrade(best.p.sPot, best.p.gen)} pot) likely at #${best.pk.ovr}`; }
    else { adj = -1; note = `little value projected at #${picks[0].ovr}`; }
    if (nd.need < 2 || ((pos === 'K' || pos === 'P') && nd.need < 5)) adj = Math.min(adj, 0); // don't invent a need just because a prospect is there
    const need = Math.round(clamp(nd.need + adj, 0, 10) * 10) / 10;
    out[pos] = { ...nd, need, baseNeed: nd.need, level: need >= 6 ? 'HIGH' : need >= 3.5 ? 'MED' : 'LOW', draftNote: note };
  }
  return out;
}
// Spend remaining points on prospects that fit your needs AND are likely to be there at your picks.
function autoScout(L) {
  const ids = currentBoard(L);
  const team = L.teams[L.userTeam];
  const needs = draftNeeds(L, team, null, ids);
  const picks = teamDraftPicks(L, L.userTeam).filter(p => p.rd <= 4);
  const RD_W = [0, 1, 0.8, 0.6, 0.4];
  const scored = ids.slice(0, 200).map((id, i) => {
    const p = L.players[id]; const f = draftFit(p, needs).v;
    let rel = picks.length ? 0 : 1;
    for (const pk of picks) {
      const a = availProb(i, pk.before);
      const inRange = a * (i <= pk.before + 24 ? 1 : 0.35); // much further down = a target for a later pick
      rel = Math.max(rel, inRange * RD_W[pk.rd]);
    }
    return { p, s: f * (0.25 + rel) };
  }).sort((a, b) => b.s - a.s);
  const targets = scored.slice(0, 40).map(x => x.p);
  let spent = 0;
  for (let lvl = 1; lvl <= 3; lvl++) for (const p of targets) {
    while ((p.sc || 0) < lvl && L.scoutPts >= scoutCost(p)) { L.scoutPts -= scoutCost(p); p.sc = (p.sc || 0) + 1; updateScout(p); spent++; }
  }
  sortBoard(L, ids);
  return spent;
}
// Prospects' college seasons move their true ratings a little each checkpoint.
function prospectsDevelop(L) {
  const moves = [];
  for (const id of L.prospects || []) {
    const p = L.players[id]; const d = R.gauss(0, 1.4); const w = OVR_WEIGHTS[p.pos];
    for (const k in w) p.attrs[k] += d * R.rand(0.6, 1.4);
    clampAttrs(p);
    const before = p.ovr; p.ovr = calcOvr(p);
    p.pot = clamp(Math.round(p.pot + R.gauss(0, 1.5) + d * 0.5), p.ovr, 99);
    updateScout(p);
    moves.push([id, (p.ovr - before) + d * 0.3]);
    p.trend = Math.round(((p.trend || 0) + p.ovr - before) * 10) / 10;
  }
  return moves;
}
function startScouting(L, name, pts, combine) {
  let risers = [], fallers = [];
  if (!combine && L.prospects && L.prospects.length) {
    const top = new Set(L.prospects.slice(0, 100));
    const m = prospectsDevelop(L).filter(x => top.has(x[0])).sort((a, b) => b[1] - a[1]);
    risers = m.slice(0, 5).filter(x => x[1] > 0.5).map(x => x[0]);
    fallers = m.slice(-5).reverse().filter(x => x[1] < -0.5).map(x => x[0]);
    sortBoard(L, L.prospects);
  }
  L.scoutPts = (L.scoutPts || 0) + pts;
  L.scoutStop = { name, pts, week: L.week };
  L.scoutReport = { name, year: L.year, risers, fallers };
  news(L, `${name}: your scouts have reported in. +${pts} scouting points (${L.scoutPts} available).`, L.userTeam);
}
function finishScouting(L) { L.scoutStop = null; }
// Skipping a check-in (sim ahead): the scouts spend the points themselves.
function autoScoutStop(L) { const n = autoScout(L); finishScouting(L); return n; }
function runCombine(L) {
  for (const id of L.draft.pool) {
    const p = L.players[id], a = p.attrs;
    p.combine = { forty: +(4.22 + (99 - a.spd) * 0.028 + R.gauss(0, 0.03)).toFixed(2), bench: Math.max(0, Math.round((a.str - 35) * 0.55 + R.gauss(0, 2))), vert: +(28 + (a.agi - 50) * 0.25 + R.gauss(0, 1.5)).toFixed(1) };
  }
  startScouting(L, 'Scouting Combine', 20, true);
}

// ================= Projected draft order (from projected seeding) =================
function projectDraftOrder(L) {
  const ratings = L.teams.map(t => teamRatings(L, t).ovr);
  const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
  const inSeason = ['regular', 'awards', 'playoffs', 'postseason'].includes(L.phase);
  const proj = {}, pp = {};
  for (const t of L.teams) {
    const g = inSeason ? t.rec.w + t.rec.l + t.rec.t : 0;
    const str = clamp(0.5 + (ratings[t.id] - avg) * 0.035, 0.15, 0.85);
    proj[t.id] = (inSeason ? t.rec.w + 0.5 * t.rec.t : 0) + Math.max(0, 17 - g) * str;
    pp[t.id] = proj[t.id] / 17;
  }
  let seeds;
  if (L.playoffs) seeds = L.playoffs.seeds;
  else {
    seeds = {};
    for (const c of CONFS) {
      const ts = L.teams.filter(t => t.conf === c);
      const winners = DIVS.map(d => ts.filter(t => t.div === d).sort((a, b) => proj[b.id] - proj[a.id])[0]).sort((a, b) => proj[b.id] - proj[a.id]);
      const rest = ts.filter(t => !winners.includes(t)).sort((a, b) => proj[b.id] - proj[a.id]);
      seeds[c] = [...winners, ...rest.slice(0, 3)].map(t => t.id);
    }
  }
  const seed = {}; for (const c of CONFS) seeds[c].forEach((tid, i) => seed[tid] = i + 1);
  const EXP = [0, 2.6, 2.0, 1.7, 1.4, 1.3, 1.0, 0.8];
  const elim = L.playoffs ? L.playoffs.elim : {};
  const cur = L.playoffs ? L.playoffs.round : 0;
  const key = (t) => {
    const s = seed[t.id];
    if (!s) return -1 + pp[t.id] * 0.5;
    if (elim[t.id] !== undefined) return elim[t.id] + pp[t.id] * 0.1;
    return Math.max(cur, EXP[s]) + 0.2 + pp[t.id] * 0.1;
  };
  const order = L.teams.slice().sort((a, b) => key(a) - key(b));
  const slot = {}; order.forEach((t, i) => slot[t.id] = i + 1);
  return { slot, seed, proj };
}
function slotTier(slot) { return slot <= 5 ? 'ELITE' : slot <= 12 ? 'HIGH' : slot <= 22 ? 'MID' : 'LOW'; }

// Expected prospect value (pot*.55 + ovr*.45) at each overall pick, sampled from generated classes.
let _draftCurve = null;
function draftCurve() {
  if (_draftCurve) return _draftCurve;
  const sums = new Array(300).fill(0), N = 4;
  for (let i = 0; i < N; i++) {
    const dummy = { nextPid: 1, players: {} };
    const vals = generateDraftClass(dummy, 300).map(id => dummy.players[id]).map(p => p.pot * 0.55 + p.ovr * 0.45).sort((a, b) => b - a);
    vals.forEach((v, k) => sums[k] += v);
  }
  return (_draftCurve = sums.map(s => s / N));
}

// ================= Trade valuation =================
// Same idea as draft recommendations: talent + positional value + how badly the team needs it.
// Converted to points on an exponential curve so one star outweighs several role players.
const TRADE_DEADLINE_WEEK = 10;
function tradePoints(fit) { return 10 * Math.pow(2, (fit - 62) / 5); }
function isStarterOn(L, p) {
  const t = L.teams[p.tid]; if (!t) return false;
  const arr = t.roster.map(id => L.players[id]).filter(x => x.pos === p.pos).sort((a, b) => b.ovr - a.ovr);
  return arr.indexOf(p) < STARTERS[p.pos];
}
function playerTradeFit(L, p, needs, owned) {
  const nd = needs[p.pos], pv = POS_VALUE[p.pos];
  let base;
  if (p.age <= 25) base = p.pot * 0.55 + p.ovr * 0.45;
  else if (p.age <= 29) base = p.ovr * 0.8 + p.pot * 0.2;
  else base = p.ovr - (p.age - 29) * 2;
  let v = base + (pv - 1) * 3 + nd.need * 0.5 * pv;
  const starts = owned ? isStarterOn(L, p) : p.ovr > nd.worstStarter;
  if (starts) {
    v += 2.5 * pv;
    if (owned) { // losing a starter opens a hole behind him
      const t = L.teams[p.tid]; const arr = t.roster.map(id => L.players[id]).filter(x => x.pos === p.pos && x !== p).sort((a, b) => b.ovr - a.ovr);
      const repl = arr[STARTERS[p.pos] - 1]; v += clamp((p.ovr - (repl ? repl.ovr : 40)) * 0.25, 0, 4);
    }
  }
  if (p.injury && p.injury.weeks >= 4) v -= 2 + Math.min(p.injury.weeks, 20) * 0.25;
  if ((p.pos === 'K' || p.pos === 'P') && !starts) v -= 10;
  return { v, starts };
}
function futureDraftYears(L) { return [L.year + 1, L.year + 2]; }
function pickLabel(L, year, rd, orig, owner, ovr) {
  return `${year} R${rd}${ovr ? ' #' + ovr : ''} ${L.teams[orig].abbr}${orig !== owner ? '' : ''}`;
}
// All tradeable assets of a team, valued from the perspective of `evalTid`.
function teamAssets(L, tid, evalTid, proj, needs) {
  const team = L.teams[tid]; const out = [];
  const owned = tid === evalTid;
  for (const id of team.roster) {
    const p = L.players[id]; const f = playerTradeFit(L, p, needs, owned);
    let pts = tradePoints(f.v);
    if (underContract(L, p)) { const mv = marketSalary(L, p); pts *= clamp(1 + (mv - p.contract.sal) / Math.max(mv, 1) * 0.25, 0.6, 1.35); }
    out.push({ key: 'p' + id, type: 'player', p, label: `${p.pos} ${fullName(p)}`, pts: Math.round(pts), starts: f.starts, sal: underContract(L, p) ? p.contract.sal : 0 });
  }
  if (L.draft) {
    const D = L.draft;
    const vals = D.pool.map(id => { const p = L.players[id]; return p.pot * 0.55 + p.ovr * 0.45; }).sort((a, b) => b - a);
    for (const pk of D.picks.slice(D.cur)) {
      if (pk.tid !== tid) continue;
      const base = vals[clamp(pk.ovr - 1 - D.cur, 0, vals.length - 1)] || 50;
      out.push({ key: 'c' + pk.ovr, type: 'pick', year: D.year, rd: pk.rd, orig: pk.orig, slot: pk.pk, ovr: pk.ovr, tier: slotTier(pk.pk), cur: true, label: `${D.year} R${pk.rd} #${pk.ovr}`, pts: Math.round(tradePoints(base + 1.5)) });
    }
  }
  const curve = draftCurve();
  for (const y of futureDraftYears(L)) for (let rd = 1; rd <= 7; rd++) for (let orig = 0; orig < 32; orig++) {
    if (getPickOwner(L, y, rd, orig) !== tid) continue;
    const s = proj.slot[orig];
    const near = y === L.year + 1;
    const slot = near ? s : 16.5 + (s - 16.5) * 0.35;
    const ov = Math.round((rd - 1) * 32 + slot);
    let pts = tradePoints(curve[ov - 1] + 1.5) * (near ? (L.phase === 'draft' || L.phase === 'preseason' ? 0.88 : 0.95) : 0.8);
    out.push({ key: `f${y}_${rd}_${orig}`, type: 'pick', year: y, rd, orig, slot: Math.round(slot), tier: slotTier(slot), projected: true, near, seed: proj.seed[orig] || 0, projW: proj.proj[orig], label: `${y} R${rd} (${L.teams[orig].abbr})`, pts: Math.round(pts) });
  }
  return out;
}
function canTrade(L) {
  if (L.phase === 'regular' && L.week > TRADE_DEADLINE_WEEK) return `The trade deadline has passed (after week ${TRADE_DEADLINE_WEEK - 1}). Trading reopens after the Megacup.`;
  if (L.phase === 'awards' || L.phase === 'playoffs') return 'Trades are frozen during awards and the playoffs. Trading reopens after the Megacup.';
  return null;
}
// userKeys: assets the AI receives, aiKeys: assets the AI gives up.
function evaluateTrade(L, aiTid, userKeys, aiKeys) {
  const proj = projectDraftOrder(L);
  const needs = teamNeeds(L, L.teams[aiTid]);
  const recvAll = teamAssets(L, L.userTeam, aiTid, proj, needs), giveAll = teamAssets(L, aiTid, aiTid, proj, needs);
  const recv = recvAll.filter(a => userKeys.includes(a.key)), give = giveAll.filter(a => aiKeys.includes(a.key));
  const inP = recv.filter(a => a.type === 'player').length, outP = give.filter(a => a.type === 'player').length;
  const spotCost = Math.max(0, inP - outP) * 3;
  const r = recv.reduce((s, a) => s + a.pts, 0) - spotCost, g = give.reduce((s, a) => s + a.pts, 0);
  const need = g * 1.08 + 2;
  const salIn = recv.reduce((s, a) => s + (a.sal || 0), 0), salOut = give.reduce((s, a) => s + (a.sal || 0), 0);
  const aiPay = payroll(L, L.teams[aiTid]) + salIn - salOut, uPay = payroll(L, L.teams[L.userTeam]) - salIn + salOut;
  const aiCapBad = salIn > salOut && aiPay > L.cap, uCapBad = salOut > salIn && uPay > L.cap;
  const accept = (recv.length + give.length) > 0 && r >= need && !aiCapBad && !uCapBad;
  let msg;
  if (!recv.length && !give.length) msg = 'Add players or picks to build a trade.';
  else if (aiCapBad) msg = `${L.teams[aiTid].abbr} can't fit it: they'd be ${fmtM(aiPay - L.cap)} over the cap.`;
  else if (uCapBad) msg = `You can't fit it: you'd be ${fmtM(uPay - L.cap)} over the cap.`;
  else if (accept) msg = r > need * 1.6 && give.length ? `${L.teams[aiTid].abbr} would jump at this. You may be overpaying.` : `${L.teams[aiTid].abbr} will accept this deal.`;
  else if (r >= g * 0.85) msg = `Close. ${L.teams[aiTid].abbr} wants a little more (about ${Math.ceil(need - r)} pts).`;
  else msg = `${L.teams[aiTid].abbr} says no. They need about ${Math.ceil(need - r)} more pts of value.`;
  return { recv, give, r: Math.round(r), g: Math.round(g), need: Math.round(need), spotCost, accept, msg, salIn, salOut, aiPay, uPay, recvAll, giveAll, proj, needs };
}
// "What would it take?": add the cheapest user asset(s) that close the gap.
function balanceTrade(L, aiTid, userKeys, aiKeys) {
  let keys = userKeys.slice();
  for (let i = 0; i < 4; i++) {
    const ev = evaluateTrade(L, aiTid, keys, aiKeys);
    if (ev.accept) return { keys, ev };
    const deficit = ev.need - ev.r + 3;
    const cands = ev.recvAll.filter(a => !keys.includes(a.key)).sort((a, b) => a.pts - b.pts);
    if (!cands.length) return { keys, ev };
    const single = cands.find(a => a.pts >= deficit);
    const under = cands.filter(a => a.pts < deficit).pop();
    const pick = single && (single.pts <= deficit * 1.25 || !under) ? single : (under || cands[cands.length - 1]);
    keys.push(pick.key);
  }
  return { keys, ev: evaluateTrade(L, aiTid, keys, aiKeys) };
}
function moveAsset(L, key, from, to) {
  if (key[0] === 'p') {
    const p = L.players[+key.slice(1)]; if (!p || p.tid !== from) return null;
    L.teams[from].roster = L.teams[from].roster.filter(id => id !== p.id);
    L.teams[to].roster.push(p.id); p.tid = to;
    return `${p.pos} ${fullName(p)}`;
  }
  if (key[0] === 'c') {
    const pk = L.draft && L.draft.picks.find(x => x.ovr === +key.slice(1)); if (!pk || pk.tid !== from) return null;
    pk.tid = to; return `${L.draft.year} R${pk.rd} #${pk.ovr}`;
  }
  const [y, rd, orig] = key.slice(1).split('_').map(Number);
  if (getPickOwner(L, y, rd, orig) !== from) return null;
  setPickOwner(L, y, rd, orig, to);
  return `${y} R${rd} (${L.teams[orig].abbr})`;
}
function executeTrade(L, aiTid, userKeys, aiKeys) {
  const u = L.userTeam;
  const gave = userKeys.map(k => moveAsset(L, k, u, aiTid)).filter(Boolean);
  const got = aiKeys.map(k => moveAsset(L, k, aiTid, u)).filter(Boolean);
  L.trades = L.trades || [];
  L.trades.unshift({ y: L.year, w: L.phase === 'regular' ? L.week : 0, phase: L.phase, a: u, b: aiTid, aGave: gave, bGave: got });
  story(L, 'TRADE', `${L.teams[u].abbr} and ${L.teams[aiTid].abbr} make a deal`, `${L.teams[u].city} sends ${gave.join(', ') || 'nothing'} to ${L.teams[aiTid].city} in exchange for ${got.join(', ') || 'nothing'}.`, [u, aiTid]);
  news(L, `TRADE: ${L.teams[u].abbr} send ${gave.join(', ') || 'nothing'} to ${L.teams[aiTid].abbr} for ${got.join(', ') || 'nothing'}.`, u);
  const ai = L.teams[aiTid];
  if (L.phase === 'regular' || L.phase === 'preseason') { cutToLimit(L, ai, true); aiFillRoster(L, ai); }
}

// ================= Save migration =================
const OLD_TEAM_NAMES = ['Bills', 'Dolphins', 'Patriots', 'Jets', 'Ravens', 'Bengals', 'Browns', 'Steelers', 'Texans', 'Colts', 'Jaguars', 'Titans', 'Broncos', 'Chiefs', 'Raiders', 'Chargers', 'Cowboys', 'Giants', 'Eagles', 'Commanders', 'Bears', 'Lions', 'Packers', 'Vikings', 'Falcons', 'Panthers', 'Saints', 'Buccaneers', 'Cardinals', 'Rams', '49ers', 'Seahawks'];
function migrateNames(L) {
  const CMAP = { AFC: 'American', NFC: 'National', SB: 'MC' };
  L.teams.forEach((t, i) => { if (CMAP[t.conf]) t.conf = CMAP[t.conf]; if (t.name === OLD_TEAM_NAMES[i]) t.name = TEAMS_DATA[i][3]; });
  const fixSeeds = (o) => { if (!o) return; for (const k of ['AFC', 'NFC']) if (o[k]) { o[CMAP[k]] = o[k]; delete o[k]; } };
  if (L.playoffs) { fixSeeds(L.playoffs.seeds); fixSeeds(L.playoffs.alive); L.playoffs.games.forEach(g => { if (CMAP[g.conf]) g.conf = CMAP[g.conf]; }); }
  for (const p of Object.values(L.players)) if (p.awards) p.awards = p.awards.map(a => a.replace('Super Bowl', 'Megacup'));
  for (const t of L.teams) for (const h of t.history) if (h.result) h.result = h.result.replace(/Super Bowl/i, m => m === 'SUPER BOWL' ? 'MEGACUP' : 'Megacup');
}
function migrateLeague(L) {
  migrateNames(L);
  if (!L.pickOwn) L.pickOwn = {};
  if (!L.trades) L.trades = [];
  if (L.scoutPts === undefined) L.scoutPts = 6;
  if (L.scoutStop === undefined) L.scoutStop = null;
  if (L.draft) {
    L.draft.picks.forEach(pk => { if (pk.orig === undefined) pk.orig = pk.tid; });
    for (const id of L.draft.pool) { const p = L.players[id]; if (p.sc === undefined) { p.sc = 1; p.errO = (p.sOvr - p.ovr) / SCOUT_SPREAD[1]; p.errP = (p.sPot - p.pot) / SCOUT_PSPREAD[1]; } }
  }
  if (!L.prospects) L.prospects = L.phase === 'draft' ? [] : generateDraftClass(L, 300);
}
