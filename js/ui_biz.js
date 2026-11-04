'use strict';
// ================= Contracts / Records / News screens =================
UI.newsType = 'ALL'; UI.negMsg = null; UI.recScope = 'all';
function isOffseason() { return ['resign', 'freeagency', 'draft', 'preseason'].includes(G.phase); }
function capChip() { const u = TM(G.userTeam); const sp = capSpace(G, u); return `<span class="${sp < 0 ? 'bad' : 'good'}">CAP SPACE ${fmtM(sp)}</span>`; }
function salCell(p) {
  if (!p.contract) return '<span class="dim">-</span>';
  const c = p.contract;
  if (c.exp < G.year) return `<span class="ill">EXPIRED</span>`;
  return `${fmtM(c.sal)} <span class="dim small">'${String(c.exp).slice(2)}${c.rookie ? ' R' : ''}${c.next ? ' +ext' : ''}</span>`;
}
function negCtx(p) {
  if (p.tid === -1) return 'fa';
  if (p.tid !== G.userTeam || !p.contract) return null;
  if (G.phase === 'resign' && p.contract.exp < G.year && !p.contract.next) return 'resign';
  if ((G.phase === 'regular' || G.phase === 'preseason') && p.contract.exp === G.year && !p.contract.next) return 'ext';
  if (G.phase !== 'playoffs' && G.phase !== 'awards' && canRestructure(G, p)) return 'rst';
  return null;
}
function negButton(p) {
  const ctx = negCtx(p); if (!ctx) return '';
  const label = ctx === 'fa' ? 'NEGOTIATE' : ctx === 'resign' ? 'RE-SIGN' : ctx === 'rst' ? 'RESTRUCTURE' : 'EXTEND';
  return `<button class="btn tiny" data-act="neg" data-id="${p.id}" data-v="${ctx}">${label}</button>`;
}
function careerBrief(p) {
  const real = p.career; if (!real.length) return p.exp === 0 ? 'Rookie' : '-';
  const t = emptyStats(); real.forEach(c => addStats(t, c));
  return `${real.length} yrs · ${careerSummary(p.pos, t)}`;
}
function negModal(pid, ctx) {
  const p = G.players[pid]; if (!p) return;
  const u = TM(G.userTeam); const a = askingContract(G, p, ctx);
  const last = p.career[p.career.length - 1];
  const space = ctx === 'ext' ? round05(G.cap - commitments(G, u, G.year + 1)) : ctx === 'rst' ? round05(capSpace(G, u) + p.contract.sal) : capSpace(G, u);
  const title = ctx === 'fa' ? 'FREE AGENT NEGOTIATION' : ctx === 'ext' ? 'CONTRACT EXTENSION' : ctx === 'rst' ? 'CONTRACT RESTRUCTURE' : 'RE-SIGN NEGOTIATION';
  const minY = ctx === 'rst' ? rstMinYears(G, p) : 1;
  const presets = contractPresets(G, p, ctx);
  const dec = isDeclining(p);
  const mood = dec ? '<span class="gold">Past his peak - open to a 1-year prove-it deal.</span>' : isRising(p) ? '<span class="dim">Still improving - long deals cost a little more per year.</span>' : '';
  const rstNote = ctx === 'rst' ? `<p class="small">Tear up his current deal (<b>${fmtM(p.contract.sal)}</b> thru ${p.contract.exp}) and sign a new one starting now. He takes a discount for getting paid early - the more cheap years left on his deal, the bigger the discount; the new deal must run past ${p.contract.exp}. One restructure per player per season.</p>` : '';
  const interest = ctx === 'fa' && G.phase === 'freeagency' && p.ovr >= 70 ? '<span class="gold">Several teams are interested - expect a bidding war.</span>' : ctx === 'fa' && G.phase !== 'freeagency' ? '<span class="dim">Unsigned free agent - may take a discount.</span>' : '';
  const h = `<div class="px small center">${title}</div>
   <div class="pcard" style="--c1:${p.tid >= 0 ? TM(p.tid).c1 : '#444'}"><img class="psprite" src="${Sprites.player(p, p.tid >= 0 ? TM(p.tid) : null, 6)}" alt=""><div class="pinfo">
     <div class="px pname">${esc(fullName(p))}</div><div>${p.pos} · age ${p.age} · OVR ${ovrB(p.ovr)} · POT ${potB(p.pot, p.gen)} · ${statusTag(p)}</div>
     <div class="dim">Last season: ${last ? `${last.year} ${last.tm}: ${esc(statLine(p, last))}` : 'none'}</div>
     <div class="dim">Career: ${esc(careerBrief(p))}</div>
     <div>Current deal: ${p.contract ? esc(contractStr(G, p)) : 'none'}</div></div></div>
   <div class="grid2"><div><table class="tbl"><tr><td>Market value</td><td><b>${fmtM(a.mv)}</b>/yr</td></tr><tr><td>Asking</td><td><b class="gold">${fmtM(a.sal)}</b>/yr for <b>${a.yrs}</b> yr${a.yrs > 1 ? 's' : ''}</td></tr>
     <tr><td>${ctx === 'ext' ? 'Cap room next year' : ctx === 'rst' ? 'Room (space + current deal)' : 'Your cap space'}</td><td class="${space < a.sal ? 'bad' : 'good'}">${fmtM(space)}</td></tr><tr><td>Salary cap</td><td>${fmtM(G.cap)}</td></tr></table>${interest}${mood}${rstNote}</div>
   <div><label>Salary per year ($M)<br><input id="negSal" type="number" step="0.05" min="${minSalary(G)}" value="${a.sal}"></label><br><label>Years<br><select id="negYrs">${[1, 2, 3, 4, 5].filter(y => y >= minY).map(y => `<option ${y === a.yrs ? 'selected' : ''}>${y}</option>`).join('')}</select></label>
     <div id="negOdds" class="px small" data-id="${p.id}" data-ctx="${ctx}">${oddsText(p, ctx, a.sal, a.yrs)}</div>
     <div class="presets">${presets.map(x => `<button class="btn tiny alt" data-act="negPreset" data-id="${p.id}" data-v="${ctx}" data-sal="${x.sal}" data-yrs="${x.yrs}">${x.label}<br><span class="small">${fmtM(x.sal)} ×${x.yrs} · ${Math.round(x.chance * 100)}%</span></button>`).join('')}</div>
     <div><button class="btn" data-act="negOffer" data-id="${p.id}" data-v="${ctx}">MAKE OFFER</button><button class="btn alt" data-act="negMatch" data-id="${p.id}" data-v="${ctx}">MATCH ASKING</button></div></div></div>
   <p id="negMsg" class="rp-text px small">${UI.negMsg ? esc(UI.negMsg) : 'Salary matters most, then length. Offers near the asking price are a coin flip; the chance updates as you type. Lowballs make players dig in, and after 4 failed offers they stop talking.'}</p>`;
  openModal(h);
}
function oddsText(p, ctx, sal, yrs) {
  const c = acceptChance(offerScore(G, p, sal, yrs, ctx));
  const cls = c >= 0.8 ? 'good' : c >= 0.4 ? 'gold' : 'bad';
  return `CHANCE HE SAYS YES: <span class="${cls}">${Math.round(c * 100)}%</span>`;
}
function updOdds() {
  const o = $('#negOdds'); if (!o) return;
  const p = G.players[+o.dataset.id]; const sal = parseFloat($('#negSal').value) || 0, yrs = +$('#negYrs').value;
  o.innerHTML = oddsText(p, o.dataset.ctx, sal, yrs);
}
document.addEventListener('input', (e) => { if (e.target.id === 'negSal' || e.target.id === 'negYrs') updOdds(); });
document.addEventListener('change', (e) => { if (e.target.id === 'negYrs') updOdds(); });
function planSelect(p, ctx) {
  const cur = (G.negPlan && G.negPlan[p.id]) || 'auto';
  const w = staffWantsKeep(G, p, ctx);
  return `<select data-change="negPlan" data-id="${p.id}"><option value="auto" ${cur === 'auto' ? 'selected' : ''}>AUTO (staff: ${w.keep ? 'keep' : 'let go'})</option><option value="keep" ${cur === 'keep' ? 'selected' : ''}>RE-SIGN</option><option value="let" ${cur === 'let' ? 'selected' : ''}>LET GO</option></select>`;
}
function simBar(ctx, n) {
  const s = G.negStrat || 'team';
  return `<div class="bar-row"><span class="dim small">Handle the ones you care about yourself, then let your staff negotiate the rest. AUTO = staff decides who's worth keeping; LET GO = ${ctx === 'resign' ? 'he walks in free agency' : 'no extension'}.</span>
    <label class="small">Staff approach <select data-change="negStrat">${NEG_PRESETS.map(([k, l]) => `<option value="${k}" ${s === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <button class="btn tiny" data-act="negSim" data-v="${ctx}">SIM NEGOTIATIONS (${n})</button></div>`;
}
function negResultsModal(res, ctx) {
  const lbl = { signed: '<span class="good">SIGNED</span>', let: '<span class="dim">LET GO</span>', walked: '<span class="bad">NO DEAL</span>', cap: '<span class="bad">NO CAP ROOM</span>', fail: '<span class="bad">FAILED</span>' };
  const n = res.filter(r => r.res === 'signed');
  const h = `<h3 class="px">STAFF NEGOTIATIONS</h3><p>${n.length} ${ctx === 'ext' ? 'extended' : 're-signed'} for ${fmtM(n.reduce((s, r) => s + r.sal, 0))}/yr total · ${res.length - n.length} not retained. Cap space now ${fmtM(capSpace(G, TM(G.userTeam)))}.</p>
  <table class="tbl"><tr><th>PLAYER</th><th>POS</th><th>AGE</th><th>OVR</th><th>RESULT</th><th>DETAILS</th></tr>${res.map(r => `<tr><td>${pLink(r.p)}</td><td>${r.p.pos}</td><td>${r.p.age}</td><td>${ovrB(r.p.ovr)}</td><td>${lbl[r.res]}</td><td class="small">${r.res === 'signed' ? `${fmtM(r.sal)} ×${r.yrs}${r.tries > 1 ? ` (${r.tries} offers)` : ''}` : esc(r.why || '')}</td></tr>`).join('') || '<tr><td class="dim">Nothing to negotiate.</td></tr>'}</table>
  ${ctx === 'resign' ? '<p class="dim small">Players you didn\'t keep hit free agency when it opens - you can still bid on them there.</p>' : ''}`;
  openModal(h, true);
}
function staffCutModal() {
  const c = staffCutCandidates(G, TM(G.userTeam));
  const u = TM(G.userTeam);
  const h = `<h3 class="px">STAFF CUT REVIEW</h3><p class="dim">Players your staff would release: depth beyond a normal roster at each position, and overpaid backups. Young players with upside are kept. Releasing a player under contract leaves 50% of this year's salary (and 25% of next year's) as dead money.</p>
  <p>Active roster ${activeRoster(G, u).length}/${ROSTER_LIMIT} · cap space ${fmtM(capSpace(G, u))}</p>
  ${c.length ? `<table class="tbl"><tr><th>PLAYER</th><th>POS</th><th>AGE</th><th>OVR</th><th>CONTRACT</th><th>WHY</th><th>CAP SAVED</th><th></th></tr>${c.map(x => `<tr><td>${pLink(x.p)}</td><td>${x.p.pos}</td><td>${x.p.age}</td><td>${ovrB(x.p.ovr)}</td><td>${salCell(x.p)}</td><td class="small">${esc(x.why)}</td><td class="good">${x.save ? fmtM(x.save) : '-'}</td><td><button class="btn tiny danger" data-act="staffCut" data-id="${x.p.id}">CUT</button></td></tr>`).join('')}</table>
  <div class="pact"><button class="btn danger" data-act="staffCutAll">CUT ALL ${c.length} (SAVE ${fmtM(c.reduce((s, x) => s + x.save, 0))})</button></div>` : '<p class="good">No cuts recommended - the roster looks lean.</p>'}`;
  openModal(h, true);
}
function vContracts() {
  const u = TM(G.userTeam);
  const ps = u.roster.map(id => G.players[id]);
  const pay = payroll(G, u), dead = deadMoney(G, u), space = round05(G.cap - pay);
  const res = reserveForRookies(G, u);
  let h = `<div class="grid3">`;
  h += panel('SALARY CAP', `<table class="tbl"><tr><td>${G.year} cap</td><td class="r"><b>${fmtM(G.cap)}</b></td></tr><tr><td>Payroll</td><td class="r">${fmtM(pay)}</td></tr><tr><td>Dead money</td><td class="r ${dead ? 'bad' : ''}">${fmtM(dead)}</td></tr><tr><td>Cap space</td><td class="r ${space < 0 ? 'bad' : 'good'}"><b>${fmtM(space)}</b></td></tr>${res ? `<tr><td>Rookie class (reserve)</td><td class="r dim">${fmtM(res)}</td></tr>` : ''}</table>
    <div class="meter"><div class="bar"><i class="${pay > G.cap ? 'm-bad' : pay > G.cap * 0.95 ? 'o-elite' : 'o-great'}" style="width:${clamp(pay / G.cap * 100, 0, 100)}%"></i></div></div>`);
  h += panel('FUTURE COMMITMENTS', `<table class="tbl">${[1, 2, 3].map(k => { const y = G.year + k; const c = commitments(G, u, y); return `<tr><td>${y}</td><td class="r">${fmtM(c)}</td><td class="dim small r">${ps.filter(p => p.contract && (p.contract.exp >= y || (p.contract.next && p.contract.next.exp >= y))).length} players</td></tr>`; }).join('')}</table><p class="dim small">Next year's cap isn't set yet. It has risen ${G.capHist && G.capHist.length > 1 ? G.capHist[G.capHist.length - 1].g + '%' : 'about 5%'} most recently.</p>`);
  h += panel('CAP HISTORY', `<table class="tbl">${(G.capHist || []).slice().reverse().map(c => `<tr><td>${c.year}</td><td class="r">${fmtM(c.cap)}</td><td class="r dim">${c.g ? '+' + c.g + '%' : 'start'}</td></tr>`).join('')}</table>`);
  h += `</div><div class="bar-row"><span></span><button class="btn tiny alt" data-act="staffCuts">STAFF CUT REVIEW</button></div>`;
  if (G.phase === 'resign') {
    const exp = ps.filter(p => negCtx(p) === 'resign').sort((a, b) => b.ovr - a.ovr);
    h += panel(`EXPIRING CONTRACTS (${exp.length}) - RE-SIGN BEFORE FREE AGENCY`, exp.length ? `${simBar('resign', exp.length)}<table class="tbl"><tr><th>PLAYER</th><th>POS</th><th>AGE</th><th>OVR</th><th>LAST DEAL</th><th>ASKING</th><th>LAST SEASON</th><th>PLAN</th><th></th></tr>${exp.map(p => { const a = askingContract(G, p, 'resign'); const l = p.career[p.career.length - 1]; return `<tr><td>${pLink(p)}${isDeclining(p) ? ' <span class="dim small">declining</span>' : ''}</td><td>${p.pos}</td><td>${p.age}</td><td>${ovrB(p.ovr)}</td><td class="dim">${fmtM(p.contract.sal)}</td><td>${fmtM(a.sal)} × ${a.yrs}</td><td class="small">${l ? esc(statLine(p, l)) : '-'}</td><td>${planSelect(p, 'resign')}</td><td>${negButton(p)}</td></tr>`; }).join('')}</table><p class="dim">Anyone you don't re-sign hits free agency when it opens.</p>` : '<p class="dim">No expiring contracts.</p>', 'dealpanel');
  } else if (G.phase === 'regular' || G.phase === 'preseason') {
    const fin = ps.filter(p => negCtx(p) === 'ext').sort((a, b) => b.ovr - a.ovr);
    if (fin.length) h += panel(`FINAL-YEAR CONTRACTS (${fin.length}) - EXTEND NOW OR NEGOTIATE NEXT OFFSEASON`, `${simBar('ext', fin.length)}<table class="tbl"><tr><th>PLAYER</th><th>POS</th><th>AGE</th><th>OVR</th><th>SALARY</th><th>ASKING</th><th>PLAN</th><th></th></tr>${fin.map(p => { const a = askingContract(G, p, 'ext'); return `<tr><td>${pLink(p)}${isDeclining(p) ? ' <span class="dim small">declining</span>' : ''}</td><td>${p.pos}</td><td>${p.age}</td><td>${ovrB(p.ovr)}</td><td>${fmtM(p.contract.sal)}</td><td>${fmtM(a.sal)} × ${a.yrs}</td><td>${planSelect(p, 'ext')}</td><td>${negButton(p)}</td></tr>`; }).join('')}</table>`);
  }
  const rst = ps.filter(p => negCtx(p) === 'rst').sort((a, b) => (marketSalary(G, b) - b.contract.sal) - (marketSalary(G, a) - a.contract.sal));
  if (rst.length) {
    h += panel(`RESTRUCTURE CANDIDATES (${rst.length}) - LOCK UP BARGAINS EARLY`, `<p class="dim small">Players paid well under market. Restructure now and they take a discount for getting paid early (bigger with more cheap years left), before their market price rises.</p><table class="tbl"><tr><th>PLAYER</th><th>POS</th><th>AGE</th><th>OVR</th><th>CURRENT</th><th>MARKET</th><th>ASKING</th><th></th></tr>${rst.map(p => { const a = askingContract(G, p, 'rst'); return `<tr><td>${pLink(p)}</td><td>${p.pos}</td><td>${p.age}</td><td>${ovrB(p.ovr)}</td><td>${salCell(p)}</td><td class="dim">${fmtM(marketSalary(G, p))}</td><td>${fmtM(a.sal)} × ${a.yrs}</td><td>${negButton(p)}</td></tr>`; }).join('')}</table>`);
  }
  const sorted = ps.filter(p => p.contract).sort((a, b) => (underContract(G, b) ? b.contract.sal : 0) - (underContract(G, a) ? a.contract.sal : 0));
  h += panel('ALL CONTRACTS', `<div class="scroll tall"><table class="tbl"><tr><th>PLAYER</th><th>POS</th><th>AGE</th><th>OVR</th><th>SALARY</th><th>THRU</th><th>% CAP</th><th>VS MARKET</th><th></th></tr>${sorted.map(p => { const mv = marketSalary(G, p); const live = underContract(G, p); const d = live ? mv - p.contract.sal : 0; return `<tr><td>${pLink(p)}</td><td>${p.pos}</td><td>${p.age}</td><td>${ovrB(p.ovr)}</td><td>${salCell(p)}</td><td>${p.contract.exp}${p.contract.next ? ' → ' + p.contract.next.exp : ''}</td><td class="dim">${live ? (p.contract.sal / G.cap * 100).toFixed(1) + '%' : '-'}</td><td class="${d >= 0 ? 'good' : 'bad'} small">${live ? (d >= 0 ? 'bargain +' : 'overpaid ') + fmtM(Math.abs(d)) : ''}</td><td>${negButton(p)}</td></tr>`; }).join('')}</table></div>`);
  const lg = G.teams.map(t => ({ t, pay: payroll(G, t) })).sort((a, b) => a.pay - b.pay);
  h += panel('LEAGUE CAP SPACE', `<div class="scroll tall"><table class="tbl"><tr><th>TEAM</th><th>PAYROLL</th><th>SPACE</th><th>TOP CONTRACT</th></tr>${lg.map(({ t, pay }) => { const top = t.roster.map(id => G.players[id]).filter(p => underContract(G, p)).sort((a, b) => b.contract.sal - a.contract.sal)[0]; return `<tr class="${t.id === G.userTeam ? 'me-row' : ''}"><td>${teamLink(t.id, true)}</td><td>${fmtM(pay)}</td><td class="${G.cap - pay < 0 ? 'bad' : ''}">${fmtM(G.cap - pay)}</td><td class="small">${top ? `${top.pos} ${esc(shortName(top))} ${fmtM(top.contract.sal)}` : '-'}</td></tr>`; }).join('')}</table></div>`);
  return h;
}
function vRecords() {
  const scopes = [['game', 'SINGLE GAME'], ['season', 'SINGLE SEASON'], ['career', 'CAREER'], ['tgame', 'TEAM'], ['tseason', 'TEAM SEASON']];
  let h = `<p class="dim">The league record book. Records set by players in your league are highlighted; current-season marks update live.</p><div class="records">`;
  for (const [sc, label] of scopes) {
    const defs = REC_DEFS.filter(d => d[1] === sc); if (!defs.length) continue;
    h += panel(label, `<table class="tbl">${defs.map(d => { const r = G.records[d[0]]; const mine = r.pid !== null && r.pid !== undefined || r.tid !== undefined; const live = r.year === G.year && (sc === 'season' || sc === 'tseason'); return `<tr class="${mine ? 'rec-row' : ''}"><td>${d[2]}</td><td class="r"><b class="${mine ? 'gold' : ''}">${r.val.toLocaleString()}</b></td><td class="rholder">${r.pid && G.players[r.pid] ? pLink(G.players[r.pid]) : esc(r.name || r.abbr)}${live ? ' <span class="blink2 small good">LIVE</span>' : ''}<div class="dim small">${r.name ? r.abbr + ' · ' : ''}${r.year}</div></td></tr>`; }).join('')}</table>`);
  }
  h += `</div>`;
  const log = G.recordLog || [];
  h += panel('RECORDS BROKEN', log.length ? `<table class="tbl">${log.slice(0, 40).map(l => `<tr><td class="dim">${l.y}${l.w ? ' W' + (l.w - (l.scope === 'game' || l.scope === 'tgame' ? 0 : 0)) : ''}</td><td>${esc(l.name)} (${l.abbr})</td><td>${l.scope} ${l.label.toLowerCase()}</td><td><b>${l.val.toLocaleString()}</b> <span class="dim small">prev ${l.old.toLocaleString()} - ${esc(l.oldName)} ${l.oldYear}</span></td></tr>`).join('')}</table>` : '<p class="dim">No records have fallen yet. Who will be first?</p>');
  return h;
}
const STORY_ICON = { RECORD: '★', CHASE: '»', MILESTONE: '◆', RETURN: '+', INJURY: '✚', RIVALRY: '⚔', PREVIEW: '▶', STREAK: '~', RACE: '#', TRADE: '⇄', SIGNING: '$', 'FREE AGENCY': '$', DRAFT: '◎', CAP: '$', RETIREMENT: '☾', AWARD: '♛', CHAMPION: '♛', 'HALL OF FAME': '♛' };
function storyCard(s, big) {
  const when = s.w ? `${s.y} · Week ${s.w}` : `${s.y} · ${({ resign: 'Offseason', freeagency: 'Free Agency', draft: 'Draft', preseason: 'Preseason', awards: 'Awards', playoffs: 'Playoffs', postseason: 'Postseason', regular: 'Season' })[s.ph] || ''}`;
  const p = s.pid && G.players[s.pid];
  return `<article class="story st-${s.type.replace(' ', '')} ${big ? 'big' : ''}"><div class="stag px">${STORY_ICON[s.type] || '•'} ${s.type}</div><h4 class="px">${esc(s.h)}</h4><p>${esc(s.b)}</p><div class="smeta dim small">${(s.tids || []).slice(0, 2).map(t => helm(t, 18)).join('')} ${when}${p ? ` · ${pLink(p)}` : ''}</div></article>`;
}
function vNews() {
  const types = ['ALL', 'MY TEAM', ...STORY_TYPES];
  let list = G.stories || [];
  if (UI.newsType === 'MY TEAM') list = list.filter(s => (s.tids || []).includes(G.userTeam));
  else if (UI.newsType !== 'ALL') list = list.filter(s => s.type === UI.newsType);
  let h = `<div class="filters">${types.map(t => `<button class="chip ${UI.newsType === t ? 'on' : ''}" data-act="newsType" data-v="${t}">${t}</button>`).join('')}</div>`;
  if (!list.length) return h + panel('NEWS', '<p class="dim">No stories yet. Play some games!</p>');
  h += `<div class="stories">${list.slice(0, 80).map((s, i) => storyCard(s, i === 0 && UI.newsType === 'ALL')).join('')}</div>`;
  return h;
}
function onBizClick(act, el) {
  const id = el.dataset.id, v = el.dataset.v;
  switch (act) {
    case 'neg': UI.negMsg = null; negModal(+id, v); return true;
    case 'negMatch': { const a = askingContract(G, G.players[+id], v); $('#negSal').value = a.sal; $('#negYrs').value = Math.max(a.yrs, v === 'rst' ? rstMinYears(G, G.players[+id]) : 1); updOdds(); return true; }
    case 'negPreset': $('#negSal').value = el.dataset.sal; $('#negYrs').value = el.dataset.yrs; updOdds(); return true;
    case 'negSim': {
      const res = simNegotiations(G, v, G.negPlan, G.negStrat || 'team'); persist(); render(); negResultsModal(res, v); return true;
    }
    case 'staffCuts': staffCutModal(); return true;
    case 'staffCut': { const p = G.players[+id]; if (p && p.tid === G.userTeam) { releasePlayer(G, p); persist(); render(); staffCutModal(); toast(`Released ${fullName(p)}.`); } return true; }
    case 'staffCutAll': { const c = staffCutCandidates(G, TM(G.userTeam)); c.forEach(x => releasePlayer(G, x.p)); persist(); render(); closeModal(); toast(`Released ${c.length} player(s), saving ${fmtM(c.reduce((s, x) => s + x.save, 0))} this year.`); return true; }
    case 'negOffer': {
      const p = G.players[+id]; const sal = round05(parseFloat($('#negSal').value) || 0), yrs = +$('#negYrs').value;
      if (sal < minSalary(G)) { $('#negMsg').textContent = `The league minimum is ${fmtM(minSalary(G))}.`; return true; }
      const u = TM(G.userTeam);
      const room = v === 'rst' ? capSpace(G, u) + p.contract.sal : capSpace(G, u);
      if (v !== 'ext' && room < sal) { $('#negMsg').textContent = `You only have ${fmtM(room)} of room.`; return true; }
      if (v === 'fa' && G.phase === 'regular' && activeRoster(G, u).length >= ROSTER_LIMIT) { $('#negMsg').textContent = 'Your roster is full - release someone first.'; return true; }
      const r = offerContract(G, p, sal, yrs, v);
      if (!r.ok) { UI.negMsg = r.msg; persist(); negModal(p.id, v); return true; }
      const err = signContract(G, u, p, sal, yrs, v);
      if (err) { $('#negMsg').textContent = err; return true; }
      persist(); closeModal(); render(); toast(`${fullName(p)} signed: ${yrs} yr / ${fmtM(sal)} per year.`); return true;
    }
    case 'startFA': startFreeAgency(G); persist(); UI.tab = 'fa'; render(); toast('Free agency is open! Other teams sign players in waves.'); return true;
    case 'faWave': if (G.faWave >= FA_WAVES) { toast('All free agency waves are done.'); return true; } simFAWave(G); persist(); render(); toast(`Wave ${G.faWave}/${FA_WAVES} done.`); return true;
    case 'finishFA': { finishFreeAgency(G); persist(); UI.tab = 'scouting'; render(); const rv = G.lastFAReview; if (rv) faReviewModal(rv.year); toast('Free agency closed. The Scouting Combine is underway.'); return true; }
    case 'newsType': UI.newsType = v; render(); return true;
  }
  return false;
}
