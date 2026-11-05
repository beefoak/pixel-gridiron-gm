'use strict';
// ================= UI: banners, team seasons, Hall of Fame, draft class settings =================
UI.hofSel = [];

// ---------- Banners ----------
function bannersHtml(t) {
  const b = teamBanners(t);
  if (!b.champ.length && !b.conf.length && !b.div.length) return `<div class="banners"><span class="dim small">No banners yet · ${b.playoffs} playoff appearance${b.playoffs === 1 ? '' : 's'}</span></div>`;
  const pen = (cls, top, yr) => `<div class="pennant ${cls}" style="--c1:${t.c1};--c2:${t.c2}"><span class="pt">${top}</span><b>${yr}</b></div>`;
  let h = `<div class="banners">`;
  h += b.champ.map(y => pen('pn-champ', 'MEGACUP<br>CHAMPIONS', y)).join('');
  h += b.conf.map(y => pen('pn-conf', `${t.conf.toUpperCase()}<br>CHAMPIONS`, y)).join('');
  if (b.div.length) h += `<div class="pennant pn-div" style="--c1:${t.c1};--c2:${t.c2}"><span class="pt">${t.div.toUpperCase()} DIVISION<br>CHAMPIONS</span><b>${b.div.length}×</b><span class="yrs">${b.div.map(y => "'" + String(y).slice(2)).join(' ')}</span></div>`;
  h += `</div><div class="dim small">${b.champ.length} Megacup title${b.champ.length === 1 ? '' : 's'} · ${b.conf.length} conference title${b.conf.length === 1 ? '' : 's'} · ${b.div.length} division title${b.div.length === 1 ? '' : 's'} · ${b.playoffs} playoff appearances</div>`;
  return h;
}

// ---------- A past season's roster ----------
function nameLink(r) {
  if (r.pid !== undefined && G.players[r.pid]) return pLink(G.players[r.pid]);
  if (r.key) return `<a class="plink" data-act="hofView" data-src="lore" data-k="${r.key}">${esc(r.name)}</a>`;
  if (r.rkey) return `<a class="plink" data-act="hofView" data-src="real" data-k="${r.rkey}">${esc(r.name)}</a>`;
  return esc(r.name);
}
function teamSeasonModal(tid, year) {
  const t = TM(tid), h = t.history.find(x => x.year === year);
  const rows = teamSeasonRoster(G, tid, year);
  let html = `<div class="franchise">${helm(tid, 56)}<div><div class="px big-name">${year} ${esc(t.name)}</div><div class="sub">${h ? `${h.w}-${h.l}${h.t ? '-' + h.t : ''} · PF ${h.pf} · PA ${h.pa} · ${h.seed ? '#' + h.seed + ' seed · ' : ''}${esc(h.result)}` : ''}</div></div></div>
   <div class="pact"><button class="btn tiny alt" data-act="team" data-id="${tid}" data-v="history">&lt; BACK TO ${esc(t.abbr)}</button></div>`;
  html += rows.length ? `<div class="scroll tall"><table class="tbl"><tr><th>POS</th><th>PLAYER</th><th>AGE</th><th>OVR</th><th>GP</th><th>GS</th><th>SEASON</th></tr>${rows.map(r => `<tr><td>${r.pos}</td><td>${nameLink(r)}${r.pid !== undefined ? '' : r.rkey ? ' <span class="dim small">ret.</span>' : ''}</td><td class="dim">${r.s.age || ''}</td><td>${r.ovr ? ovrB(r.ovr) : ''}</td><td>${st(r.s, 'gp')}</td><td>${st(r.s, 'gs')}</td><td class="small">${esc(statLine({ pos: r.pos, ovr: r.ovr || 0 }, r.s))}</td></tr>`).join('')}</table></div>` : '<p class="dim">No player records for this season.</p>';
  openModal(html, true);
}
function franchiseLeadersHtml(tid) {
  const cats = franchiseLeaders(G, tid);
  return `<div class="grid3">${cats.map(c => `<div><div class="px small gold">${c.label.toUpperCase()}</div>${c.top.map((x, i) => `<div class="small">${i + 1}. ${nameLink({ name: x.name, pid: x.pid, key: x.key, rkey: x.rkey })} <b>${st(x.s, c.k).toLocaleString()}</b> <span class="dim">${x.from}-${x.to}</span></div>`).join('') || '<div class="dim small">-</div>'}</div>`).join('')}</div>`;
}

// ---------- Career view (Hall of Fame candidates, legends, retirees) ----------
function careerSource(src, key) {
  if (src === 'lore') {
    const p = lorePlayer(G, key); if (!p) return null;
    const meta = (G.hof || []).find(h => h.key === key) || (G.hofPool || []).find(h => h.key === key);
    return { name: p.fn + ' ' + p.ln, pos: p.pos, college: p.college, teams: [TM(p.tid).abbr], tid: p.tid, from: p.from, to: p.to, seasons: p.seasons.map(s => ({ ...s, tm: TM(p.tid).abbr })), awards: (G.lore.awards && G.lore.awards[key]) || [], meta };
  }
  const r = (G.retired || []).find(x => x.key === key); if (!r) return null;
  const meta = (G.hof || []).find(h => h.key === key) || r;
  return { name: r.name, pos: r.pos, teams: [...new Set((r.career || []).map(c => c.tm))], tid: (G.teams.find(t => t.abbr === r.lastTeam) || {}).id, from: r.from, to: r.to, seasons: r.career || [], awards: r.awards || [], meta };
}
function awardCounts(aw) {
  const c = { MVP: 0, OPOY: 0, DPOY: 0, AP: 0, MC: 0, MCMVP: 0 };
  for (const a of aw) {
    if (/ MVP$/.test(a) && !/Megacup/.test(a)) c.MVP++; else if (/Offensive Player/.test(a)) c.OPOY++; else if (/Defensive Player/.test(a)) c.DPOY++;
    else if (/All-Pro/.test(a)) c.AP++; else if (/Megacup MVP/.test(a)) c.MCMVP++; else if (/Megacup Champion/.test(a)) c.MC++;
  }
  return c;
}
function honorsLine(aw) {
  const c = awardCounts(aw), out = [];
  if (c.MVP) out.push(`${c.MVP}× MVP`); if (c.OPOY) out.push(`${c.OPOY}× OPOY`); if (c.DPOY) out.push(`${c.DPOY}× DPOY`);
  if (c.AP) out.push(`${c.AP}× All-Pro`); if (c.MC) out.push(`${c.MC}× Megacup champ`); if (c.MCMVP) out.push(`${c.MCMVP}× Megacup MVP`);
  return out.join(' · ') || 'No major honors';
}
function careerModal(src, key) {
  const c = careerSource(src, key); if (!c) return;
  const tot = emptyStats(); c.seasons.forEach(s => addStats(tot, s));
  const best = c.seasons.slice().sort((a, b) => seasonValue(c.pos, b) - seasonValue(c.pos, a))[0];
  const peak = Math.max(...c.seasons.map(s => s.ovr || 0));
  const inHof = (G.hof || []).find(h => h.key === key);
  const t = c.tid !== undefined ? TM(c.tid) : null;
  const titles = c.awards.filter(a => /Megacup Champion/.test(a)).map(a => a.slice(0, 4));
  let h = `<div class="pcard" style="--c1:${t ? t.c1 : '#444'};--c2:${t ? t.c2 : '#999'}"><div class="pinfo">
    <div class="px pname">${esc(c.name)} ${inHof ? `<span class="hof-badge">HALL OF FAME ${inHof.inducted}</span>` : ''}</div>
    <div>${c.pos} · ${c.teams.map(esc).join(', ')} · ${c.from}-${c.to} · ${c.seasons.length} seasons${c.college ? ' · ' + esc(c.college) : ''}</div>
    <div class="gold">${esc(honorsLine(c.awards))}</div>
    <div class="dim">Peak OVR ${peak} · Career: ${esc(careerSummary(c.pos, tot))}</div></div></div>`;
  if (UI.hofBack) h += `<div class="pact"><button class="btn tiny alt" data-act="hofBallot">&lt; BACK TO BALLOT</button></div>`;
  h += `<h4 class="px">HIGHLIGHTS</h4><ul class="news small">
    ${best ? `<li>Best season: <b>${best.year}</b> - ${esc(statLine({ pos: c.pos, ovr: best.ovr || 0 }, best))} (${best.ovr} OVR)</li>` : ''}
    ${titles.length ? `<li>Megacup champion: ${titles.join(', ')}</li>` : ''}
    ${c.awards.filter(a => / MVP$|Player of the Year/.test(a)).map(a => `<li>${esc(a)}</li>`).join('')}
    ${c.seasons.length >= 12 ? `<li>Durable: ${c.seasons.length} seasons, ${st(tot, 'gp')} games</li>` : ''}</ul>`;
  for (const g of POS_COLS[c.pos]) {
    const cols = COLS[g];
    h += `<h4 class="px">${g.toUpperCase()} STATS</h4><div class="scroll"><table class="tbl"><tr><th>YEAR</th><th>TM</th><th>OVR</th><th>GP</th>${cols.map(x => `<th>${x[0]}</th>`).join('')}</tr>${c.seasons.map(s => `<tr><td>${s.year}</td><td>${s.tm || ''}</td><td>${s.ovr || ''}</td><td>${st(s, 'gp')}</td>${cols.map(x => `<td>${cell(s, x)}</td>`).join('')}</tr>`).join('')}<tr class="tot"><td>CAREER</td><td></td><td></td><td>${tot.gp}</td>${cols.map(x => `<td>${cell(tot, x)}</td>`).join('')}</tr></table></div>`;
  }
  openModal(h, true);
}

// ---------- Hall of Fame ----------
function hofBallotModal() {
  const ballot = hofBallot(G), sel = UI.hofSel || (UI.hofSel = []);
  const voted = G.hofVoted && G.hofVoted[G.year];
  const maxS = Math.max(1, ...ballot.map(c => c.score));
  let h = `<h3 class="px">HALL OF FAME VOTE · CLASS OF ${G.year}</h3>
  <p>You hold the vote. Induct up to <b>${HOF_MAX_VOTES}</b> players. Click a name to review his career. Candidates are players retired at least ${HOF_WAIT} seasons; anyone left out stays on the ballot (up to 10 years).</p>`;
  if (voted) h += `<p class="good">You've already voted this year.</p>`;
  h += ballot.length ? `<div class="scroll tall"><table class="tbl"><tr><th></th><th>PLAYER</th><th>POS</th><th>YEARS</th><th>CAREER</th><th>HONORS</th><th>BALLOT</th><th>CASE</th></tr>${ballot.map(c => {
    const on = sel.includes(c.key);
    return `<tr class="${on ? 'rec-row' : ''}"><td>${voted ? '' : `<button class="btn tiny ${on ? '' : 'alt'}" data-act="hofPick" data-k="${c.key}">${on ? 'YES' : 'VOTE'}</button>`}</td>
    <td><a class="plink" data-act="hofView" data-src="${c.src}" data-k="${c.key}" data-b="1">${esc(c.name)}</a><div class="dim small">${esc(c.src === 'lore' ? TM(c.tid).abbr : c.lastTeam || '')}</div></td><td>${c.pos}</td><td class="small">${c.from}-${c.to}<br><span class="dim">${c.seasons} yrs</span></td>
    <td class="small">${esc(careerSummary(c.pos, c.tot))}</td><td class="small gold">${esc(honorsLine(c.awards))}</td><td class="dim small">${ordinal((c.ballots || 0) + 1)}</td>
    <td class="nbar"><div class="bar"><i class="o-great" style="width:${Math.round(c.score / maxS * 100)}%"></i></div></td></tr>`;
  }).join('')}</table></div>` : '<p class="dim">No eligible candidates this year.</p>';
  if (!voted) h += `<div class="pact"><button class="btn" data-act="hofCast" ${sel.length ? '' : 'disabled'}>INDUCT ${sel.length} PLAYER${sel.length === 1 ? '' : 'S'}</button><button class="btn alt" data-act="hofSkip">NO INDUCTEES THIS YEAR</button></div>`;
  openModal(h, true);
}
function hofPanel() {
  const list = (G.hof || []).slice().sort((a, b) => b.inducted - a.inducted || b.score - a.score);
  const classes = [...new Set(list.map(h => h.inducted))];
  const yr = UI.hofYear && classes.includes(UI.hofYear) ? UI.hofYear : 'ALL';
  const rows = yr === 'ALL' ? list : list.filter(h => h.inducted === yr);
  return panel(`HALL OF FAME (${list.length}) <select data-change="hofYear"><option value="ALL">All classes</option>${classes.map(y => `<option ${y === yr ? 'selected' : ''}>${y}</option>`).join('')}</select>${G.phase === 'postseason' ? ' <button class="btn tiny" data-act="hofBallot">VOTE</button>' : ''}`,
    `<div class="scroll tall"><table class="tbl"><tr><th>CLASS</th><th>NAME</th><th>POS</th><th>TEAM</th><th>YEARS</th><th>CAREER</th><th>HONORS</th></tr>${rows.map(h => `<tr><td class="gold">${h.inducted}</td><td>${h.src === 'lore' || (G.retired || []).some(r => r.key === h.key) ? `<a class="plink" data-act="hofView" data-src="${h.src}" data-k="${h.key}">${esc(h.name)}</a>` : esc(h.name)}</td><td>${h.pos}</td><td>${h.tid !== undefined && TM(h.tid) ? helm(h.tid, 16) + ' ' + TM(h.tid).abbr : esc(h.lastTeam || '')}</td><td class="small">${h.from}-${h.to}</td><td class="small">${esc(careerSummary(h.pos, h.tot || {}))}</td><td class="small gold">${esc(honorsLine(h.awards || []))}</td></tr>`).join('')}</table></div>`);
}

// ---------- Draft class settings (Scouting tab) ----------
const CLASS_LABELS = { weak: 'WEAK', avg: 'AVERAGE', strong: 'STACKED' }, POS_LABELS = { low: 'LOW', avg: 'AVG', high: 'HIGH' };
function draftClassPanel() {
  const prof = G.classProfile, cfg = G.classCfg || {};
  const off = isOffseason();
  const nextYear = off ? G.year + 1 : G.year + 2;
  let h = '';
  if (prof) {
    const hi = POSITIONS.filter(p => prof.pos[p] === 'high'), lo = POSITIONS.filter(p => prof.pos[p] === 'low');
    h += `<div><span class="px small">${prof.year} CLASS OUTLOOK:</span> <span class="cls-${prof.overall}">${CLASS_LABELS[prof.overall]}</span> ${hi.map(p => `<span class="tier t-elite">${p} DEEP</span>`).join(' ')} ${lo.map(p => `<span class="tier t-low">${p} THIN</span>`).join(' ')}</div>`;
  }
  const sel = (k, cur, opts, labels, extra) => `<select data-change="${k}" ${extra || ''}><option value="random" ${!cur || cur === 'random' ? 'selected' : ''}>RANDOM</option>${opts.map(o => `<option value="${o}" ${cur === o ? 'selected' : ''}>${labels[o]}</option>`).join('')}</select>`;
  const canNow = canRegenClass(G);
  h += `<details class="clsset" ${UI.clsOpen ? 'open' : ''}><summary class="px small" data-act="clsToggle">DRAFT CLASS SETTINGS</summary>
    <p class="dim small">Shape the <b>${canNow ? G.year + 1 : nextYear}</b> draft class${canNow ? '' : `, generated when the ${nextYear - 1} season starts`}. HIGH puts more prospects at a position and makes them better; LOW thins it out. RANDOM lets each class decide (some years are stacked, some are weak).</p>
    <div class="edit-grid"><label>Overall class ${sel('clsO', cfg.overall, ['weak', 'avg', 'strong'], CLASS_LABELS)}</label>${POSITIONS.map(p => `<label>${p} ${sel('clsP', cfg.pos && cfg.pos[p], ['low', 'avg', 'high'], POS_LABELS, `data-pos="${p}"`)}</label>`).join('')}</div>
    <div class="pact">${canNow ? `<button class="btn tiny" data-act="classRegen">REGENERATE ${G.year + 1} CLASS NOW</button><span class="dim small"> Available until the first scouting report; scouting points you spent are refunded.</span>` : ''}<button class="btn tiny alt" data-act="classReset">ALL RANDOM</button></div></details>`;
  return panel('', h);
}

// ---------- Handlers ----------
function onLoreClick(act, el) {
  const k = el.dataset.k;
  switch (act) {
    case 'teamSeason': teamSeasonModal(+el.dataset.id, +el.dataset.v); return true;
    case 'hofView': UI.hofBack = el.dataset.b === '1'; careerModal(el.dataset.src, k); return true;
    case 'hofBallot': hofBallotModal(); return true;
    case 'hofPick': { UI.hofSel = UI.hofSel || []; const i = UI.hofSel.indexOf(k); if (i >= 0) UI.hofSel.splice(i, 1); else if (UI.hofSel.length < HOF_MAX_VOTES) UI.hofSel.push(k); else toast(`You can induct up to ${HOF_MAX_VOTES}.`); hofBallotModal(); return true; }
    case 'hofCast': { const c = castHofVotes(G, UI.hofSel); UI.hofSel = []; UI.hofBack = false; persist(); closeModal(); render(); toast(`Hall of Fame Class of ${G.year}: ${c.map(x => x.name).join(', ')}`); return true; }
    case 'hofSkip': castHofVotes(G, []); UI.hofSel = []; UI.hofBack = false; persist(); closeModal(); render(); toast('No inductees this year.'); return true;
    case 'classRegen': { const r = regenDraftClass(G); persist(); render(); toast(`New ${G.year + 1} class generated${r ? ` · ${r} scouting pts refunded` : ''}.`); return true; }
    case 'classReset': G.classCfg = {}; persist(); render(); return true;
    case 'clsToggle': UI.clsOpen = !UI.clsOpen; return false;
  }
  return false;
}
function onLoreChange(k, el) {
  if (k === 'clsO') { G.classCfg = G.classCfg || {}; G.classCfg.overall = el.value; persist(); return true; }
  if (k === 'clsP') { G.classCfg = G.classCfg || {}; G.classCfg.pos = G.classCfg.pos || {}; G.classCfg.pos[el.dataset.pos] = el.value; persist(); return true; }
  if (k === 'hofYear') { UI.hofYear = el.value === 'ALL' ? null : +el.value; render(); return true; }
  return false;
}
