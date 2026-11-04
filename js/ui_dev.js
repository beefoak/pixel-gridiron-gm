'use strict';
// ================= UI: depth chart, training, player editor, offseason reviews =================

// ---------- Depth chart ----------
function vDepth() {
  const u = TM(G.userTeam);
  const lu = buildLineup(G, u);
  let h = `<div class="bar-row"><p class="dim">Set your depth chart with the arrows. Injured players are skipped on game day; new arrivals slot in by OVR. Positions you haven't touched stay on AUTO (sorted by OVR).</p><button class="btn tiny alt" data-act="depthResetAll">RESET ALL TO AUTO</button></div><div class="depth">`;
  for (const ps of POSITIONS) {
    const order = depthOrder(G, u, ps);
    const start = lu[ps].slice(0, STARTERS[ps]);
    const startIds = new Set(start.map(p => p.id));
    const outOfPos = start.filter(p => p.temp || p.pos !== ps);
    let healthy = 0;
    const rows = order.map((p, i) => {
      const slot = p.injury ? '-' : ++healthy;
      return `<li class="${startIds.has(p.id) ? 'starter' : ''} ${p.injury ? 'out' : ''}"><span class="slot">${slot}</span>${ovrB(p.ovr)}<span class="nm">${pLink(p, true)} ${p.injury ? statusTag(p) : ''}</span>
        <button class="btn tiny alt arw" data-act="depthMv" data-id="${p.id}" data-v="0" ${i === 0 ? 'disabled' : ''} title="Move to top">&#8679;</button><button class="btn tiny alt arw" data-act="depthMv" data-id="${p.id}" data-v="${i - 1}" ${i === 0 ? 'disabled' : ''} title="Move up">&#9650;</button><button class="btn tiny alt arw" data-act="depthMv" data-id="${p.id}" data-v="${i + 1}" ${i === order.length - 1 ? 'disabled' : ''} title="Move down">&#9660;</button></li>`;
    }).join('');
    const tag = isManualDepth(u, ps) ? `<span class="gold small">MANUAL</span> <button class="btn tiny alt" data-act="depthReset" data-v="${ps}">AUTO</button>` : '<span class="dim small">AUTO</span>';
    const note = outOfPos.length ? `<p class="small bad">${outOfPos.map(p => p.temp ? 'No healthy player - emergency fill-in' : `${esc(shortName(p))} (${p.pos}) filling in`).join('; ')}</p>` : '';
    h += panel(`${ps} <span class="dim small">${STARTERS[ps]} START</span> ${tag}`, `<ol class="dlist">${rows || '<li class="dim">Nobody at this position.</li>'}</ol>${note}`, 'dpanel');
  }
  return h + '</div>';
}

// ---------- Focus training ----------
function trainAttrs(p) { return [...new Set([...Object.keys(OVR_WEIGHTS[p.pos]), 'spd', 'str', 'agi', 'awr'])]; }
function vTraining() {
  const T = trainState(G), u = TM(G.userTeam);
  const plan = userTrainPlan(G);
  const roster = u.roster.map(id => G.players[id]).sort((a, b) => POSITIONS.indexOf(a.pos) - POSITIONS.indexOf(b.pos) || b.ovr - a.ovr);
  let h = `<p>Pick up to ${TRAIN_SLOTS} players for focus training each week. Leave a slot on <b>AUTO</b> and your staff picks the best development bet. Young players with room below their potential improve fastest; veterans past their peak barely move. Training runs after every regular-season game.</p>`;
  let body = '';
  plan.forEach((c, i) => {
    const s = T.slots[i]; const manual = s && G.players[s.pid] && G.players[s.pid].tid === u.id;
    const p = c.p;
    const opts = `<option value="">AUTO (staff picks)</option>` + roster.map(x => `<option value="${x.id}" ${manual && s.pid === x.id ? 'selected' : ''}>${x.pos} ${esc(shortName(x))} · ${x.ovr}${x.injury ? ' (hurt)' : ''}</option>`).join('');
    const attrSel = p ? `<select data-change="trainA" data-i="${i}" ${manual ? '' : 'disabled'}><option value="bal">Balanced (key ratings)</option>${trainAttrs(p).map(k => `<option value="${k}" ${manual && s.attr === k ? 'selected' : ''}>${ATTR_NAMES[k]} (${p.attrs[k]})</option>`).join('')}</select>` : '';
    const rate = p ? trainLabel(trainRate(p)) : '';
    body += `<div class="train-slot"><div class="px gold">${i + 1}</div>
      <div><select data-change="trainP" data-i="${i}">${opts}</select>${c.benched ? `<div class="small bad">${esc(shortName(c.benched))} is hurt - auto fill-in this week</div>` : ''}</div>
      <div>${p ? `${c.manual ? '' : '<span class="dim small">AUTO:</span> '}${ovrB(p.ovr)} ${pLink(p, true)} <span class="dim small">${p.pos} · age ${p.age} · POT ${potGrade(p.pot)}</span><div>${attrSel}</div>` : '<span class="dim">No healthy player available.</span>'}</div>
      <div class="small">${p ? `GROWTH <span class="need n-${rate === 'HIGH' ? 'low' : rate === 'MED' ? 'med' : 'high'}">${rate}</span><div class="dim">Season gains: +${p.tGain || 0} pts</div>` : ''}</div></div>`;
  });
  h += panel(`THIS WEEK'S FOCUS <button class="btn tiny alt" data-act="trainAuto">ALL AUTO</button>`, body);
  const log = T.log || [];
  h += panel(`LAST SESSION${T.logWeek ? ` · WEEK ${T.logWeek}` : ''}`, log.length ? `<table class="tbl">${log.map(x => { const p = G.players[x.pid]; if (!p) return ''; return `<tr><td>${p.pos}</td><td>${pLink(p)}</td><td>${x.manual ? 'Manual' : '<span class="dim">Auto</span>'}</td><td>${ATTR_NAMES[x.k]}</td><td>${x.gain ? `<span class="good">+${x.gain}</span>` : '<span class="dim">progress</span>'}</td><td>${x.dOvr ? `<span class="good">OVR +${x.dOvr}</span>` : ''}</td></tr>`; }).join('')}</table>` : '<p class="dim">No sessions yet - training starts with your first game.</p>');
  const gains = u.roster.map(id => G.players[id]).filter(p => p.tGain).sort((a, b) => b.tGain - a.tGain).slice(0, 10);
  if (gains.length) h += panel('SEASON TRAINING GAINS', `<table class="tbl">${gains.map(p => `<tr><td>${p.pos}</td><td>${pLink(p)}</td><td>${ovrB(p.ovr)}</td><td class="good">+${p.tGain} rating pts</td></tr>`).join('')}</table>`);
  return h;
}

// ---------- Player editor ----------
function editModal(pid) {
  const p = G.players[pid]; if (!p) return;
  const inp = (id, v, type, cls) => `<input id="ed_${id}" type="${type || 'number'}" value="${esc(v)}" class="${cls || ''}">`;
  let h = `<h3 class="px">EDIT PLAYER</h3><p class="dim">Change any rating or bio detail. OVR is recalculated from the ratings for the chosen position.</p>
  <h4 class="px">BIO</h4><div class="edit-grid">
    <label>First ${inp('fn', p.fn, 'text', 'wide')}</label><label>Last ${inp('ln', p.ln, 'text', 'wide')}</label>
    <label>College ${inp('college', p.college, 'text', 'wide')}</label>
    <label>Position <select id="ed_pos">${POSITIONS.map(x => `<option ${x === p.pos ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
    <label>Number ${inp('num', p.num)}</label><label>Age ${inp('age', p.age)}</label>
    <label>Height (in) ${inp('ht', p.ht)}</label><label>Weight ${inp('wt', p.wt)}</label>
    <label>Potential ${inp('pot', p.pot)}</label>${p.injury ? `<label>Injury wks ${inp('inj', p.injury.weeks)}</label>` : ''}
  </div><h4 class="px">RATINGS</h4><div class="edit-grid">${ATTRS.map(k => `<label>${ATTR_NAMES[k]} ${inp('a_' + k, p.attrs[k])}</label>`).join('')}</div>
  <div class="pact"><button class="btn" data-act="editSave" data-id="${p.id}">SAVE CHANGES</button><button class="btn alt" data-act="player" data-id="${p.id}">CANCEL</button></div>`;
  openModal(h, true);
}
function readEditForm() {
  const v = (id) => { const el = $('#ed_' + id); return el ? el.value : undefined; };
  const attrs = {}; for (const k of ATTRS) attrs[k] = v('a_' + k);
  return { fn: v('fn'), ln: v('ln'), college: v('college'), pos: v('pos'), num: v('num'), age: v('age'), ht: v('ht'), wt: v('wt'), pot: v('pot'), injWeeks: v('inj'), attrs };
}

// ---------- Reviews ----------
function reviewButtons() {
  let h = '';
  if (G.faReviews && G.faReviews[G.year]) h += `<button class="btn alt" data-act="faReview" data-v="${G.year}">FA REVIEW</button>`;
  if (G.draftHistory[G.year]) h += `<button class="btn alt" data-act="draftReview" data-v="${G.year}">DRAFT REVIEW</button>`;
  return h;
}
function pickGrade(k) { return k.tr ? gradeB(letterFor(pickScore(k.ovr, k.tr))) : '<span class="dim">-</span>'; }
function pickDiff(k) { if (!k.tr) return ''; const d = k.ovr - k.tr; return d > 0 ? `<span class="good">+${d}</span>` : d < 0 ? `<span class="bad">${d}</span>` : '<span class="dim">0</span>'; }
function faReviewModal(year) {
  const R2 = G.faReviews && G.faReviews[year]; if (!R2) return;
  const d = R2.after - R2.before;
  const pl = (x) => G.players[x.pid] ? pLink(G.players[x.pid]) : esc(x.name);
  const valTag = (x) => { const r = x.mkt / Math.max(0.5, x.sal); return r >= 1.15 ? '<span class="good">BARGAIN</span>' : r <= 0.85 ? '<span class="bad">OVERPAY</span>' : '<span class="dim">FAIR</span>'; };
  let h = `<h3 class="px">${year} FREE AGENCY REVIEW</h3>
  <div class="rv-head">${gradeB(R2.grade).replace('grade ', 'grade big ')}<div>
    <div>Team rating <b>${R2.before}</b> &rarr; <b>${R2.after}</b> (${d >= 0 ? '<span class="good">+' + d + '</span>' : '<span class="bad">' + d + '</span>'}) · league average ${R2.lgDelta >= 0 ? '+' : ''}${R2.lgDelta}</div>
    <div>League rank by rating: ${ordinal(R2.rankBefore)} &rarr; <b>${ordinal(R2.rankAfter)}</b></div>
    <div>Cap space: ${fmtM(R2.capBefore)} &rarr; <b>${fmtM(R2.capAfter)}</b></div>
    <div class="dim small">Grade weighs your rating change against the league's and the price of your signings against their market value.</div></div></div>`;
  h += `<h4 class="px">SIGNED (${R2.signed.length})</h4>` + (R2.signed.length ? `<table class="tbl"><tr><th>PLAYER</th><th>POS</th><th>AGE</th><th>OVR</th><th>CONTRACT</th><th>MARKET</th><th>VALUE</th><th>WHEN</th></tr>${R2.signed.map(x => `<tr><td>${pl(x)}</td><td>${x.pos}</td><td>${x.age}</td><td>${ovrB(x.ovr)}</td><td>${fmtM(x.sal)} ×${x.yrs}</td><td class="dim">${fmtM(x.mkt)}</td><td>${valTag(x)}</td><td class="dim small">${x.wave ? 'after wave ' + x.wave : 'opening day'}</td></tr>`).join('')}</table>` : '<p class="dim">You did not sign anyone.</p>');
  h += `<h4 class="px">DEPARTED (${R2.lost.length})</h4>` + (R2.lost.length ? `<table class="tbl"><tr><th>PLAYER</th><th>POS</th><th>AGE</th><th>OVR</th><th>NOW</th></tr>${R2.lost.map(x => `<tr><td>${pl(x)}</td><td>${x.pos}</td><td>${x.age}</td><td>${ovrB(x.ovr)}</td><td>${esc(x.dest)}${x.sal ? ` <span class="dim small">${fmtM(x.sal)}/yr</span>` : ''}</td></tr>`).join('')}</table>` : '<p class="dim">Nobody left.</p>');
  h += `<h4 class="px">BIGGEST DEALS LEAGUE-WIDE</h4><table class="tbl">${R2.top.map(x => `<tr class="${x.tid === G.userTeam ? 'me-row' : ''}"><td>${helm(x.tid, 16)} ${TM(x.tid).abbr}</td><td>${x.pos}</td><td>${pl(x)}</td><td>${ovrB(x.ovr)}</td><td>${fmtM(x.sal)} ×${x.yrs}</td></tr>`).join('') || '<tr><td class="dim">No signings.</td></tr>'}</table>`;
  openModal(h, true);
}
function draftReviewModal(year) {
  const D = draftReviewData(G, year);
  if (!D.hist.length) return;
  const mine = D.hist.filter(k => k.tid === G.userTeam);
  const myRank = D.teams.findIndex(t => t.tid === G.userTeam) + 1;
  const my = D.teams.find(t => t.tid === G.userTeam);
  const pl = (k) => G.players[k.pid] ? pLink(G.players[k.pid]) : esc(k.name || '-');
  const nowR = (k) => { const p = G.players[k.pid]; return p ? `${ovrB(p.ovr)} ${potB(p.pot)}` : ''; };
  let h = `<h3 class="px">${year} DRAFT REVIEW</h3>
  <div class="rv-head">${my ? gradeB(letterFor(my.score)).replace('grade ', 'grade big ') : ''}<div>
    <div>${my ? `Your class ranks <b>${ordinal(myRank)}</b> of ${D.teams.length}.` : 'You made no picks.'}</div>
    <div class="dim small"><b>Picked</b> = the slot you used. <b>True</b> = where the player ranks in the class by real ratings and positional value. A player who was truly the 5th-best prospect taken at #12 is +7 of value. Early rounds count more toward the class grade.</div></div></div>`;
  if (mine.length) h += `<table class="tbl"><tr><th>RD</th><th>PICKED</th><th>TRUE</th><th>+/-</th><th>GRADE</th><th>POS</th><th>PLAYER</th><th>RATINGS</th></tr>${mine.map(k => `<tr><td>R${k.rd}</td><td>#${k.ovr}</td><td>${k.tr ? '#' + k.tr : '-'}</td><td>${pickDiff(k)}</td><td>${pickGrade(k)}</td><td>${k.pos}</td><td>${pl(k)}</td><td>${nowR(k)}</td></tr>`).join('')}</table>`;
  h += `<div class="grid2"><div><h4 class="px">STEALS OF THE DRAFT</h4><table class="tbl">${D.steals.map(k => `<tr class="${k.tid === G.userTeam ? 'me-row' : ''}"><td>${helm(k.tid, 16)}</td><td>#${k.ovr}</td><td>${k.pos} ${pl(k)}</td><td class="dim">true #${k.tr}</td><td>${pickGrade(k)}</td></tr>`).join('')}</table></div>
    <div><h4 class="px">BIGGEST REACHES</h4><table class="tbl">${D.reaches.map(k => `<tr class="${k.tid === G.userTeam ? 'me-row' : ''}"><td>${helm(k.tid, 16)}</td><td>#${k.ovr}</td><td>${k.pos} ${pl(k)}</td><td class="dim">true #${k.tr}</td><td>${pickGrade(k)}</td></tr>`).join('')}</table></div></div>`;
  h += `<h4 class="px">LEAGUE DRAFT GRADES</h4><div class="scroll"><table class="tbl"><tr><th>#</th><th>TEAM</th><th>GRADE</th><th>PICKS</th><th>BEST VALUE</th></tr>${D.teams.map((t, i) => { const best = t.picks.slice().sort((a, b) => pickScore(b.ovr, b.tr) - pickScore(a.ovr, a.tr))[0]; return `<tr class="${t.tid === G.userTeam ? 'me-row' : ''}"><td class="dim">${i + 1}</td><td>${teamLink(t.tid)}</td><td>${gradeB(letterFor(t.score))}</td><td class="dim">${t.picks.length}</td><td class="small">${best ? `#${best.ovr} ${best.pos} ${esc(best.name || '')} (true #${best.tr})` : ''}</td></tr>`; }).join('')}</table></div>`;
  openModal(h, true);
}

// ---------- Handlers ----------
function onDevClick(act, el) {
  const id = el.dataset.id, v = el.dataset.v;
  switch (act) {
    case 'depthMv': depthMove(G, TM(G.userTeam), +id, +v); persist(); render(); return true;
    case 'depthReset': depthReset(TM(G.userTeam), v); persist(); render(); return true;
    case 'depthResetAll': depthReset(TM(G.userTeam)); persist(); render(); toast('Depth chart reset to auto (by OVR).'); return true;
    case 'trainAuto': trainState(G).slots = []; persist(); render(); toast('All training slots set to auto.'); return true;
    case 'editPlayer': editModal(+id); return true;
    case 'editSave': { const p = G.players[+id]; if (!p) return true; editPlayer(G, p, readEditForm()); persist(); render(); playerModal(p.id); toast(`Saved ${fullName(p)} (${p.ovr} OVR).`); return true; }
    case 'faReview': faReviewModal(+v); return true;
    case 'draftReview': draftReviewModal(+v); return true;
  }
  return false;
}
function onDevChange(k, el) {
  const T = G && trainState(G);
  if (k === 'trainP') {
    const i = +el.dataset.i; const pid = el.value ? +el.value : null;
    if (pid !== null) T.slots.forEach((s, j) => { if (s && s.pid === pid && j !== i) T.slots[j] = null; });
    T.slots[i] = pid !== null ? { pid, attr: 'bal' } : null;
    persist(); render(); return true;
  }
  if (k === 'trainA') { const i = +el.dataset.i; if (T.slots[i]) T.slots[i].attr = el.value; persist(); render(); return true; }
  return false;
}
