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
  return null;
}
function negButton(p) {
  const ctx = negCtx(p); if (!ctx) return '';
  const label = ctx === 'fa' ? 'NEGOTIATE' : ctx === 'resign' ? 'RE-SIGN' : 'EXTEND';
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
  const space = ctx === 'ext' ? round05(G.cap - commitments(G, u, G.year + 1)) : capSpace(G, u);
  const title = ctx === 'fa' ? 'FREE AGENT NEGOTIATION' : ctx === 'ext' ? 'CONTRACT EXTENSION' : 'RE-SIGN NEGOTIATION';
  const interest = ctx === 'fa' && G.phase === 'freeagency' && p.ovr >= 70 ? '<span class="gold">Several teams are interested - expect a bidding war.</span>' : ctx === 'fa' && G.phase !== 'freeagency' ? '<span class="dim">Unsigned free agent - may take a discount.</span>' : '';
  const h = `<div class="px small center">${title}</div>
   <div class="pcard" style="--c1:${p.tid >= 0 ? TM(p.tid).c1 : '#444'}"><img class="psprite" src="${Sprites.player(p, p.tid >= 0 ? TM(p.tid) : null, 6)}" alt=""><div class="pinfo">
     <div class="px pname">${esc(fullName(p))}</div><div>${p.pos} · age ${p.age} · OVR ${ovrB(p.ovr)} · POT ${potB(p.pot)} · ${statusTag(p)}</div>
     <div class="dim">Last season: ${last ? `${last.year} ${last.tm}: ${esc(statLine(p, last))}` : 'none'}</div>
     <div class="dim">Career: ${esc(careerBrief(p))}</div>
     <div>Current deal: ${p.contract ? esc(contractStr(G, p)) : 'none'}</div></div></div>
   <div class="grid2"><div><table class="tbl"><tr><td>Market value</td><td><b>${fmtM(a.mv)}</b>/yr</td></tr><tr><td>Asking</td><td><b class="gold">${fmtM(a.sal)}</b>/yr for <b>${a.yrs}</b> yr${a.yrs > 1 ? 's' : ''}</td></tr>
     <tr><td>${ctx === 'ext' ? 'Cap room next year' : 'Your cap space'}</td><td class="${space < a.sal ? 'bad' : 'good'}">${fmtM(space)}</td></tr><tr><td>Salary cap</td><td>${fmtM(G.cap)}</td></tr></table>${interest}</div>
   <div><label>Salary per year ($M)<br><input id="negSal" type="number" step="0.05" min="${minSalary(G)}" value="${a.sal}"></label><br><label>Years<br><select id="negYrs">${[1, 2, 3, 4, 5].map(y => `<option ${y === a.yrs ? 'selected' : ''}>${y}</option>`).join('')}</select></label>
     <div><button class="btn" data-act="negOffer" data-id="${p.id}" data-v="${ctx}">MAKE OFFER</button><button class="btn alt" data-act="negMatch" data-id="${p.id}" data-v="${ctx}">MATCH ASKING</button></div></div></div>
   <p id="negMsg" class="rp-text px small">${UI.negMsg ? esc(UI.negMsg) : 'Players weigh salary first, and want a contract length close to what they ask for. Lowball offers make them dig in. After 4 failed offers they stop talking.'}</p>`;
  openModal(h);
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
  h += `</div>`;
  if (G.phase === 'resign') {
    const exp = ps.filter(p => negCtx(p) === 'resign').sort((a, b) => b.ovr - a.ovr);
    h += panel(`EXPIRING CONTRACTS (${exp.length}) - RE-SIGN BEFORE FREE AGENCY`, exp.length ? `<table class="tbl"><tr><th>PLAYER</th><th>POS</th><th>AGE</th><th>OVR</th><th>LAST DEAL</th><th>ASKING</th><th>LAST SEASON</th><th></th></tr>${exp.map(p => { const a = askingContract(G, p, 'resign'); const l = p.career[p.career.length - 1]; return `<tr><td>${pLink(p)}</td><td>${p.pos}</td><td>${p.age}</td><td>${ovrB(p.ovr)}</td><td class="dim">${fmtM(p.contract.sal)}</td><td>${fmtM(a.sal)} × ${a.yrs}</td><td class="small">${l ? esc(statLine(p, l)) : '-'}</td><td>${negButton(p)}</td></tr>`; }).join('')}</table><p class="dim">Anyone you don't re-sign hits free agency when it opens.</p>` : '<p class="dim">No expiring contracts.</p>', 'dealpanel');
  } else if (G.phase === 'regular' || G.phase === 'preseason') {
    const fin = ps.filter(p => negCtx(p) === 'ext').sort((a, b) => b.ovr - a.ovr);
    if (fin.length) h += panel(`FINAL-YEAR CONTRACTS (${fin.length}) - EXTEND NOW OR NEGOTIATE NEXT OFFSEASON`, `<table class="tbl"><tr><th>PLAYER</th><th>POS</th><th>AGE</th><th>OVR</th><th>SALARY</th><th>ASKING</th><th></th></tr>${fin.map(p => { const a = askingContract(G, p, 'ext'); return `<tr><td>${pLink(p)}</td><td>${p.pos}</td><td>${p.age}</td><td>${ovrB(p.ovr)}</td><td>${fmtM(p.contract.sal)}</td><td>${fmtM(a.sal)} × ${a.yrs}</td><td>${negButton(p)}</td></tr>`; }).join('')}</table>`);
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
    h += panel(label, `<table class="tbl">${defs.map(d => { const r = G.records[d[0]]; const mine = r.pid !== null && r.pid !== undefined || r.tid !== undefined; const live = r.year === G.year && (sc === 'season' || sc === 'tseason'); return `<tr class="${mine ? 'rec-row' : ''}"><td>${d[2]}</td><td class="r"><b class="${mine ? 'gold' : ''}">${r.val.toLocaleString()}</b></td><td>${r.pid && G.players[r.pid] ? pLink(G.players[r.pid]) : esc(r.name || r.abbr)}${live ? ' <span class="blink2 small good">LIVE</span>' : ''}</td><td class="dim small">${r.abbr} ${r.year}</td></tr>`; }).join('')}</table>`);
  }
  h += `</div>`;
  const log = G.recordLog || [];
  h += panel('RECORDS BROKEN', log.length ? `<table class="tbl">${log.slice(0, 40).map(l => `<tr><td class="dim">${l.y}${l.w ? ' W' + (l.w - (l.scope === 'game' || l.scope === 'tgame' ? 0 : 0)) : ''}</td><td>${esc(l.name)} (${l.abbr})</td><td>${l.scope} ${l.label.toLowerCase()}</td><td><b>${l.val.toLocaleString()}</b> <span class="dim small">prev ${l.old.toLocaleString()} - ${esc(l.oldName)} ${l.oldYear}</span></td></tr>`).join('')}</table>` : '<p class="dim">No records have fallen yet. Who will be first?</p>');
  return h;
}
const STORY_ICON = { RECORD: '★', CHASE: '»', MILESTONE: '◆', RETURN: '+', INJURY: '✚', RIVALRY: '⚔', PREVIEW: '▶', STREAK: '~', RACE: '#', TRADE: '⇄', SIGNING: '$', 'FREE AGENCY': '$', DRAFT: '◎', CAP: '$', RETIREMENT: '☾', AWARD: '♛', CHAMPION: '♛' };
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
    case 'negMatch': { const a = askingContract(G, G.players[+id], v); $('#negSal').value = a.sal; $('#negYrs').value = a.yrs; return true; }
    case 'negOffer': {
      const p = G.players[+id]; const sal = round05(parseFloat($('#negSal').value) || 0), yrs = +$('#negYrs').value;
      if (sal < minSalary(G)) { $('#negMsg').textContent = `The league minimum is ${fmtM(minSalary(G))}.`; return true; }
      const u = TM(G.userTeam);
      if (v !== 'ext' && capSpace(G, u) < sal) { $('#negMsg').textContent = `You only have ${fmtM(capSpace(G, u))} in cap space.`; return true; }
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
