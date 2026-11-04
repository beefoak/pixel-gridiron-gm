'use strict';
// ================= Play-by-play game engine =================
const FALLBACK = { QB: ['RB', 'WR'], RB: ['WR', 'TE'], WR: ['TE', 'RB', 'CB'], TE: ['WR', 'OL'], OL: ['DT', 'DE', 'TE'], DE: ['DT', 'LB'], DT: ['DE', 'OL'], LB: ['S', 'DE'], CB: ['S', 'WR'], S: ['CB', 'LB'], K: ['P'], P: ['K'] };
const LINEUP_EXTRA = { RB: 1, WR: 2, TE: 1, DE: 1, DT: 1, LB: 1, CB: 1, S: 1 };

let _tempId = 0;
function makeTemp(pos) {
  const p = { id: 'tmp' + (_tempId++), temp: true, fn: 'Emergency', ln: 'Fill-in', pos, attrs: {}, ovr: 38 };
  for (const k of ATTRS) p.attrs[k] = 38;
  return p;
}

function buildLineup(L, team) {
  const avail = team.roster.map(id => L.players[id]).filter(p => p && !p.injury);
  const by = {}; for (const ps of POSITIONS) by[ps] = depthOrder(L, team, ps, p => !p.injury);
  const used = new Set();
  const take = (pos, n, fall) => {
    const out = []; const lists = fall ? [pos, ...FALLBACK[pos]] : [pos];
    for (const ps of lists) {
      for (const p of by[ps]) { if (out.length >= n) break; if (!used.has(p.id)) { used.add(p.id); out.push(p); } }
      if (out.length >= n) break;
    }
    while (fall && out.length < n) out.push(makeTemp(pos));
    return out;
  };
  const lu = { team };
  for (const ps of POSITIONS) lu[ps] = take(ps, STARTERS[ps], true);
  for (const ps in LINEUP_EXTRA) lu[ps] = lu[ps].concat(take(ps, LINEUP_EXTRA[ps], false));
  lu.starters = new Set();
  lu.all = [];
  for (const ps of POSITIONS) { lu[ps].slice(0, STARTERS[ps]).forEach(p => lu.starters.add(p.id)); lu.all.push(...lu[ps]); }
  const avg = (arr, f) => arr.length ? arr.reduce((s, p) => s + f(p.attrs), 0) / arr.length : 40;
  const OL = lu.OL.slice(0, 5);
  lu.passBlock = avg(OL, a => a.pbk);
  lu.runBlock = avg(OL, a => a.rbk) * 0.85 + lu.TE[0].attrs.rbk * 0.15;
  lu.passRush = avg(lu.DE.slice(0, 2), a => a.prs) * 0.6 + avg(lu.DT.slice(0, 2), a => a.prs) * 0.4;
  lu.runDef = avg(lu.DT.slice(0, 2), a => a.rdf) * 0.35 + avg(lu.DE.slice(0, 2), a => a.rdf) * 0.25 + avg(lu.LB.slice(0, 3), a => (a.rdf + a.tkl) / 2) * 0.4;
  const C = lu.CB, S = lu.S;
  lu.coverage = C[0].attrs.cov * .22 + C[1].attrs.cov * .2 + C[2].attrs.cov * .13 + S[0].attrs.cov * .17 + S[1].attrs.cov * .15 + avg(lu.LB.slice(0, 3), a => a.cov) * .13;
  return lu;
}

function teamRatings(L, team) {
  const lu = buildLineup(L, team);
  const offIds = ['QB', 'RB', 'WR', 'TE', 'OL'], defIds = ['DE', 'DT', 'LB', 'CB', 'S'];
  const avgOvr = (ids) => { let s = 0, n = 0; for (const ps of ids) for (const p of lu[ps].slice(0, STARTERS[ps])) { s += p.ovr * (ps === 'QB' ? 3 : 1); n += ps === 'QB' ? 3 : 1; } return n ? s / n : 0; };
  const off = avgOvr(offIds), def = avgOvr(defIds);
  return { off: Math.round(off), def: Math.round(def), ovr: Math.round(off * 0.55 + def * 0.45) };
}

function simGame(L, homeId, awayId, opts) {
  opts = opts || {};
  const teams = [L.teams[homeId], L.teams[awayId]];
  const lu = [buildLineup(L, teams[0]), buildLineup(L, teams[1])];
  const neutral = !!opts.neutral, playoff = !!opts.playoff;
  const box = {}; const DUMMY = emptyStats();
  const score = [0, 0]; const qs = [[0, 0, 0, 0, 0], [0, 0, 0, 0, 0]];
  const tstat = [0, 1].map(() => ({ plays: 0, fd: 0, to: 0, pen: 0 }));
  const log = opts.log ? [] : null; const scoring = [];
  const ln = (p, side) => {
    if (p.temp) return DUMMY;
    let b = box[p.id]; if (!b) { b = emptyStats(); b.tid = teams[side].id; box[p.id] = b; }
    return b;
  };
  for (let s = 0; s < 2; s++) for (const p of lu[s].all) { const b = ln(p, s); b.gp = 1; if (lu[s].starters.has(p.id)) b.gs = 1; }

  let q = 1, clock = 900, poss = 0, ballOn = 25, down = 1, togo = 10, ot = false, over = false;
  const otDone = [0, 0];
  let snap = null;
  const absX = (side, on) => side === 0 ? on : 100 - on;
  const ab = (s) => teams[s].abbr;
  const yardStr = (side, on) => on === 50 ? 'the 50' : on < 50 ? ab(side) + ' ' + on : ab(1 - side) + ' ' + (100 - on);
  const hfa = (side) => (!neutral && side === 0) ? 1 : 0;

  function addPts(side, pts) { score[side] += pts; qs[side][Math.min(q, 5) - 1] += pts; }
  function logIt(text, toAbs, type) {
    if (log) {
      const s = snap || { side: poss, from: absX(poss, ballOn), down, togo, fd: absX(poss, Math.min(100, ballOn + togo)) };
      log.push({ side: s.side, from: s.from, to: toAbs === undefined ? s.from : toAbs, down: s.down, togo: s.togo, fd: s.fd, q, clk: clock, hs: score[0], as: score[1], text, type: type || 'play' });
    }
    snap = null;
  }
  function endPoss(side) { if (ot) { otDone[side]++; if (otDone[0] >= 1 && otDone[1] >= 1 && score[0] !== score[1]) over = true; } }
  function setDrive(side, on) { poss = side; ballOn = clamp(on, 1, 99); down = 1; togo = Math.min(10, 100 - ballOn); }
  function changePoss(newOn) { endPoss(poss); setDrive(1 - poss, newOn); }

  function kickoff(recv, spot) {
    if (over) return;
    snap = null;
    const kt = 1 - recv;
    if (spot === undefined && R.chance(0.0025)) {
      setDrive(recv, 99);
      logIt(`${ab(kt)} kicks off... RETURNED ALL THE WAY! TOUCHDOWN ${ab(recv)}!`, absX(recv, 100), 'td');
      return td(recv, `${ab(recv)} kickoff return TD`);
    }
    const on = spot !== undefined ? spot : (R.chance(0.55) ? 35 : clamp(Math.round(R.gauss(29, 8)), 8, 60));
    setDrive(recv, on);
    logIt(`${ab(kt)} kicks off. ${ab(recv)} ball at ${yardStr(recv, on)}.`, absX(recv, on), 'kick');
  }

  function td(side, desc) {
    addPts(side, 6);
    const k = lu[side].K[0]; const kb = ln(k, side);
    const d = score[side] - score[1 - side];
    let txt;
    if (q >= 4 && clock < 600 && [-2, -5, -10, 1, 5].includes(d)) {
      const ok = R.chance(0.48); if (ok) addPts(side, 2);
      txt = ok ? '2-pt conversion GOOD' : '2-pt conversion failed';
    } else {
      kb.xpa++;
      const ok = R.chance(clamp(0.94 + (k.attrs.kac - 75) * 0.003, 0.75, 0.995));
      if (ok) { kb.xpm++; addPts(side, 1); }
      txt = ok ? 'XP good' : 'XP NO GOOD';
    }
    scoring.push({ q, clk: clock, side, text: desc + ' (' + txt + ')', hs: score[0], as: score[1] });
    logIt(txt + '.', absX(side, 100), 'xp');
    endPoss(side);
    if (!over) kickoff(1 - side);
  }

  function safety() {
    const side = 1 - poss; addPts(side, 2);
    scoring.push({ q, clk: clock, side, text: 'Safety', hs: score[0], as: score[1] });
    logIt('SAFETY!', absX(poss, 0), 'score');
    endPoss(poss);
    if (!over) kickoff(side, R.int(30, 45));
  }

  function resolve(yds, secs, text, type) {
    ballOn += yds; clock = Math.max(0, clock - secs);
    if (ballOn >= 100) { ballOn = 100; logIt(text + ' TOUCHDOWN!', absX(poss, 100), 'td'); return td(poss, text); }
    if (ballOn <= 0) { logIt(text, absX(poss, 0), 'play'); return safety(); }
    togo -= yds;
    const to = absX(poss, ballOn);
    if (togo <= 0) { down = 1; togo = Math.min(10, 100 - ballOn); tstat[poss].fd++; logIt(text + ' First down.', to, type); return; }
    down++;
    if (down > 4) { logIt(text + ' Turnover on downs.', to, 'to'); return changePoss(100 - ballOn); }
    logIt(text, to, type);
  }

  function pickDef(def, kind) {
    const c = [];
    const addG = (arr, nStart, wStart, wBack, f) => arr.forEach((p, i) => c.push([p, (i < nStart ? wStart : wBack) * f(p.attrs)]));
    if (kind === 'run') {
      addG(def.DE, 2, 1.3, 0.5, a => a.tkl / 70); addG(def.DT, 2, 1.2, 0.5, a => a.tkl / 70);
      addG(def.LB, 3, 3, 0.8, a => a.tkl / 70); addG(def.S, 2, 1.2, 0.3, a => a.tkl / 70); addG(def.CB, 3, 0.7, 0.2, a => a.tkl / 70);
    } else if (kind === 'pass') {
      addG(def.CB, 3, 2.2, 0.5, a => a.tkl / 70); addG(def.S, 2, 1.8, 0.4, a => a.tkl / 70);
      addG(def.LB, 3, 1.6, 0.4, a => a.tkl / 70); addG(def.DE, 2, 0.3, 0.1, () => 1); addG(def.DT, 2, 0.2, 0.1, () => 1);
    } else if (kind === 'sack') {
      addG(def.DE, 2, 3, 1.2, a => Math.pow(a.prs / 70, 1.6)); addG(def.DT, 2, 1.6, 0.6, a => Math.pow(a.prs / 70, 2));
      addG(def.LB, 3, 0.8, 0.2, a => Math.pow(a.prs / 70, 2)); addG(def.S, 2, 0.2, 0, () => 1);
    } else {
      addG(def.CB, 3, 3, 0.6, a => Math.pow(a.cov / 70, 2)); addG(def.S, 2, 2, 0.4, a => Math.pow(a.cov / 70, 2));
      addG(def.LB, 3, 1, 0.2, a => Math.pow(a.cov / 70, 2));
    }
    return R.weighted(c, x => x[1])[0];
  }

  function pickTarget(off) {
    const rr = p => (p.attrs.cth * 0.4 + p.attrs.rte * 0.35 + p.attrs.spd * 0.25);
    const c = [[off.WR[0], 24], [off.WR[1], 19], [off.WR[2], 13], [off.TE[0], 15], [off.RB[0], 11], [off.RB[1], 5], [off.WR[3], 4], [off.TE[1], 4], [off.WR[4], 1.5]].filter(x => x[0]);
    return R.weighted(c, x => x[1] * Math.pow(rr(x[0]) / 72, 1.3))[0];
  }

  function passPlay(hurry) {
    const off = lu[poss], def = lu[1 - poss]; const qb = off.QB[0], qa = qb.attrs; const qbl = ln(qb, poss);
    const h = hfa(poss);
    const sackP = 0.066 * Math.pow(def.passRush / off.passBlock, 3) * clamp(1 - (qa.awr - 75) * 0.01, 0.6, 1.4) * (1 - 0.08 * h);
    if (R.chance(sackP)) {
      const loss = R.int(2, 10);
      const sacker = pickDef(def, 'sack'); const sb = ln(sacker, 1 - poss);
      sb.sack++; sb.tkl++; qbl.sk++;
      if (R.chance(0.07)) {
        sb.ff++;
        if (R.chance(0.5)) {
          qbl.fum++; tstat[poss].to++;
          const spot = Math.max(1, ballOn - loss);
          clock = Math.max(0, clock - 6);
          logIt(`${shortName(qb)} SACKED by ${shortName(sacker)} and FUMBLES! Recovered by ${ab(1 - poss)}.`, absX(poss, spot), 'to');
          return changePoss(100 - spot);
        }
      }
      return resolve(-loss, hurry ? 10 : 32, `${shortName(qb)} sacked by ${shortName(sacker)} for -${loss}.`, 'sack');
    }
    // QB scramble
    if (R.chance(clamp(0.035 + (qa.spd - 65) * 0.0015, 0.01, 0.09))) {
      let yds = R.int(-1, 8) + (R.chance(0.15) ? R.int(5, 20) : 0);
      yds = Math.min(yds, 100 - ballOn);
      qbl.rAtt++; qbl.rYds += yds; qbl.rLng = Math.max(qbl.rLng, yds);
      if (ballOn + yds >= 100) qbl.rTd++; else ln(pickDef(def, 'run'), 1 - poss).tkl++;
      return resolve(yds, hurry ? 12 : 32, `${shortName(qb)} scrambles for ${yds} yds.`, 'run');
    }
    const tgt = pickTarget(off), ta = tgt.attrs, tb = ln(tgt, poss);
    const rr = ta.cth * 0.4 + ta.rte * 0.35 + ta.spd * 0.25;
    const dr = Math.random();
    let depth = dr < 0.6 ? 0 : dr < 0.87 ? 1 : 2;
    if (100 - ballOn <= 12) depth = 0;
    let comp = [0.735, 0.545, 0.36][depth] + (qa.tha - 75) * 0.0045 + (rr - 75) * 0.003 - (def.coverage - 75) * 0.0045 + (off.passBlock - def.passRush) * 0.002 + 0.012 * h;
    if (depth === 2) comp += (qa.thp - 75) * 0.003;
    comp = clamp(comp, 0.2, 0.9);
    const intP = [0.017, 0.033, 0.056][depth] * clamp(1 + (def.coverage - 75) * 0.03 - ((qa.tha + qa.awr) / 2 - 75) * 0.03, 0.35, 2.5);
    qbl.pAtt++; tb.tgt++;
    let air = depth === 0 ? R.int(-3, 9) : depth === 1 ? R.int(10, 19) : R.int(20, 45);
    if (R.chance(intP)) {
      const d = pickDef(def, 'cover'); const db = ln(d, 1 - poss);
      qbl.pInt++; db.dInt++; tstat[poss].to++;
      const caught = Math.min(99, ballOn + Math.max(1, air));
      if (R.chance(0.045)) {
        clock = Math.max(0, clock - 12);
        logIt(`${shortName(qb)} pass INTERCEPTED by ${shortName(d)}... PICK SIX!`, absX(poss, 0), 'td');
        endPoss(poss); setDrive(1 - poss, 99);
        return td(poss, `${shortName(d)} interception return TD`);
      }
      const ret = R.chance(0.3) ? 0 : R.int(0, 25);
      const newOn = clamp(100 - caught + ret, 1, 99);
      clock = Math.max(0, clock - 10);
      logIt(`${shortName(qb)} pass INTERCEPTED by ${shortName(d)}, returned ${ret} yds.`, absX(1 - poss, newOn), 'to');
      return changePoss(newOn);
    }
    if (R.chance(comp)) {
      let yac = (depth === 0 ? R.expo(3.0) : depth === 1 ? R.expo(2.4) : R.expo(3.6)) * clamp(ta.spd / 85, 0.6, 1.3);
      if (R.chance(0.025)) yac += R.expo(18);
      let yds = Math.round(air + yac);
      yds = Math.min(yds, 100 - ballOn);
      if (ballOn + yds <= 0) yds = 1 - ballOn;
      const isTD = ballOn + yds >= 100;
      qbl.pCmp++; qbl.pYds += yds; tb.rec++; tb.reYds += yds; tb.reLng = Math.max(tb.reLng, yds);
      if (isTD) { qbl.pTd++; tb.reTd++; }
      else {
        ln(pickDef(def, 'pass'), 1 - poss).tkl++;
        if (R.chance(0.004)) {
          tb.fum++; tstat[poss].to++;
          const spot = ballOn + yds; clock = Math.max(0, clock - 8);
          logIt(`${shortName(qb)} to ${shortName(tgt)} for ${yds}... FUMBLE! ${ab(1 - poss)} recovers.`, absX(poss, spot), 'to');
          return changePoss(100 - spot);
        }
      }
      const oob = R.chance(hurry ? 0.45 : 0.25);
      return resolve(yds, oob ? 8 : (hurry ? 16 : 34), `${shortName(qb)} pass to ${shortName(tgt)} for ${yds} yds.`, 'pass');
    }
    if (R.chance(0.35)) ln(pickDef(def, 'cover'), 1 - poss).pd++;
    return resolve(0, 6, `${shortName(qb)} pass incomplete, intended for ${shortName(tgt)}.`, 'inc');
  }

  function runPlay(hurry, milk) {
    const off = lu[poss], def = lu[1 - poss]; const qb = off.QB[0];
    const r = Math.random(); const qbRun = clamp(0.05 + (qb.attrs.spd - 65) * 0.004, 0.02, 0.18);
    let car;
    if (r < qbRun) car = qb; else if (r < qbRun + 0.3 && off.RB[1]) car = off.RB[1]; else if (r < qbRun + 0.33 && off.WR[0]) car = off.WR[0]; else car = off.RB[0];
    const ca = car.attrs, cb = ln(car, poss);
    const cr = car.pos === 'RB' ? (ca.spd * 0.3 + ca.agi * 0.25 + ca.car * 0.1 + ca.str * 0.15 + ca.awr * 0.2) : (ca.spd * 0.5 + ca.agi * 0.3 + ca.str * 0.2) - 5;
    const adv = ((off.runBlock * 0.6 + cr * 0.4) - def.runDef) / 10 + 0.15 * hfa(poss);
    let yds = Math.round(R.gauss(3.4 + adv * 1.1, 3.5));
    if (yds < -4) yds = -R.int(1, 4);
    if (togo <= 1 && yds < 1 && R.chance(0.35)) yds = 1;
    if (R.chance(clamp(0.032 + adv * 0.008, 0.01, 0.07))) yds += Math.round(R.expo(15)) + 4;
    yds = Math.min(yds, 100 - ballOn);
    if (ballOn + yds <= 0) yds = -ballOn;
    cb.rAtt++; cb.rYds += yds; cb.rLng = Math.max(cb.rLng, yds);
    const isTD = ballOn + yds >= 100;
    if (isTD) cb.rTd++;
    else {
      const t = pickDef(def, 'run'); ln(t, 1 - poss).tkl++;
      if (R.chance(0.0075 * clamp(80 / ca.car, 0.7, 1.6))) {
        ln(t, 1 - poss).ff++;
        if (R.chance(0.55)) {
          cb.fum++; tstat[poss].to++;
          const spot = Math.max(1, ballOn + yds); clock = Math.max(0, clock - 8);
          logIt(`${shortName(car)} runs for ${yds}... FUMBLE! Recovered by ${ab(1 - poss)}.`, absX(poss, spot), 'to');
          return changePoss(100 - spot);
        }
      }
    }
    return resolve(yds, hurry ? 18 : milk ? 42 : 38, `${shortName(car)} runs for ${yds} yds.`, 'run');
  }

  function fieldGoal() {
    const k = lu[poss].K[0], ka = k.attrs, kb = ln(k, poss); const d = 117 - ballOn;
    let p = 0.99 - Math.max(0, d - 30) * 0.008 - Math.max(0, d - 48) * 0.03 + (ka.kac - 75) * 0.004 - Math.max(0, d - 45) * Math.max(0, 80 - ka.kpw) * 0.002;
    p = clamp(p, 0.03, 0.995); kb.fga++; clock = Math.max(0, clock - 5);
    if (R.chance(p)) {
      kb.fgm++; kb.fgLng = Math.max(kb.fgLng, d); addPts(poss, 3);
      const txt = `${shortName(k)} ${d} yd field goal is GOOD.`;
      scoring.push({ q, clk: clock, side: poss, text: txt, hs: score[0], as: score[1] });
      logIt(txt, absX(poss, 100), 'fg');
      const s = poss; endPoss(s); if (!over) kickoff(1 - s);
    } else {
      logIt(`${shortName(k)} ${d} yd field goal is NO GOOD.`, absX(poss, 100), 'miss');
      changePoss(Math.max(20, 107 - ballOn));
    }
  }

  function punt() {
    const p = lu[poss].P[0], pa = p.attrs, pb = ln(p, poss);
    const dist = clamp(Math.round(R.gauss(45 + (pa.kpw - 75) * 0.3, 6)), 25, 70);
    const land = ballOn + dist; pb.pnt++; clock = Math.max(0, clock - 7);
    const ks = poss; let newOn, txt;
    if (land >= 100) {
      if (ballOn >= 45 && R.chance(0.55)) { newOn = R.int(2, 12); pb.pntYds += 100 - ballOn - newOn; txt = `${shortName(p)} punts, downed at the ${ab(1 - ks)} ${newOn}.`; }
      else { newOn = 20; pb.pntYds += 100 - ballOn; txt = `${shortName(p)} punts into the end zone. Touchback.`; }
    } else {
      if (R.chance(0.004)) {
        pb.pntYds += dist; logIt(`${shortName(p)} punts ${dist} yds... RETURNED FOR A TOUCHDOWN!`, absX(ks, 0), 'td');
        endPoss(ks); setDrive(1 - ks, 99); return td(1 - ks, `${ab(1 - ks)} punt return TD`);
      }
      const ret = R.chance(0.45) ? 0 : Math.max(0, Math.round(R.gauss(9, 7)));
      pb.pntYds += dist; newOn = clamp(100 - land + ret, 1, 99);
      txt = `${shortName(p)} punts ${dist} yds${ret ? `, returned ${ret}` : ', fair catch'}.`;
    }
    logIt(txt, absX(1 - ks, newOn), 'punt');
    changePoss(newOn);
  }

  function play() {
    snap = { side: poss, from: absX(poss, ballOn), down, togo, fd: absX(poss, Math.min(100, ballOn + togo)) };
    tstat[poss].plays++;
    const off = lu[poss]; const diff = score[poss] - score[1 - poss];
    const k = off.K[0]; const fgDist = 117 - ballOn; const maxFG = 50 + (k.attrs.kpw - 60) * 0.25;
    const hurry = (q === 2 && clock <= 120) || (q >= 4 && clock <= 300 && diff < 0);
    const milk = q >= 4 && clock <= 480 && diff > 0;
    if ((q === 2 || q === 4 || ot) && clock <= 22 && fgDist <= maxFG + 3 && (q === 2 || (diff >= -3 && diff <= 0))) return fieldGoal();
    if (q === 4 && !ot && diff > 0 && ballOn > 3 && clock <= (5 - down) * 41) {
      return resolve(-1, 41, `${shortName(off.QB[0])} kneels.`, 'kneel');
    }
    if (down === 4) {
      let go = false;
      if (togo <= 1 && ballOn >= 40 && ballOn <= 90) go = R.chance(0.45);
      if (togo <= 3 && ballOn >= 55 && fgDist > maxFG) go = go || R.chance(0.5);
      if (q >= 4 && diff < 0) {
        if (clock <= 150) go = !(diff >= -3 && fgDist <= maxFG);
        else if (clock <= 420 && diff < -3 && ballOn >= 35) go = true;
      }
      if (q >= 4 && diff < -8 && clock <= 600) go = true;
      if (!go) return fgDist <= maxFG ? fieldGoal() : punt();
    }
    let pp = 0.53;
    if (down === 3 && togo >= 7) pp = 0.88; else if (down === 3 && togo >= 4) pp = 0.7; else if (togo <= 2) pp = 0.38; else if (down === 1) pp = 0.5;
    if (hurry) pp += 0.25; if (milk) pp -= 0.25;
    pp += (off.QB[0].attrs.tha - 75) * 0.004;
    if (R.chance(clamp(pp, 0.15, 0.95))) passPlay(hurry); else runPlay(hurry, milk);
  }

  const first = R.chance(0.5) ? 0 : 1;
  kickoff(first);
  let guard = 0;
  for (;;) {
    while (clock > 0 && !over && guard++ < 1500) play();
    if (over) break;
    if (!ot) {
      if (q === 1 || q === 3) { q++; clock = 900; continue; }
      if (q === 2) { q = 3; clock = 900; kickoff(1 - first); continue; }
      if (score[0] !== score[1]) break;
      ot = true; q = 5; clock = playoff ? 900 : 600; kickoff(R.chance(0.5) ? 0 : 1); continue;
    } else {
      if (score[0] !== score[1] || !playoff) break;
      q++; clock = 900; continue;
    }
  }
  return {
    home: homeId, away: awayId, hs: score[0], as: score[1], ot, box, scoring, log, qs, tstat,
    part: lu.map(l => l.all.filter(p => !p.temp).map(p => ({ id: p.id, st: l.starters.has(p.id) }))),
  };
}
