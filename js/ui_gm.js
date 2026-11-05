'use strict';
// ================= Trade + Scouting screens =================
function tierChip(t) { return `<span class="tier t-${t.toLowerCase()}">${t}</span>`; }
function projDesc(a) {
  if (a.seed) return `proj. ${ordinal(a.seed)} seed`;
  const w = Math.round(a.projW); return `proj. ${w}-${17 - w}, no playoffs`;
}
function assetRow(a, side, sel, myNeeds) {
  const on = sel.includes(a.key);
  let info;
  if (a.type === 'player') {
    const p = a.p; const nd = myNeeds[p.pos];
    info = `${ovrB(p.ovr)} ${pLink(p)} <span class="dim">${p.pos} · ${p.age}y · POT ${potGrade(p.pot, p.gen)}${p.injury ? ' · <span class="inj">' + esc(p.injury.name) + '</span>' : ''}</span>`
      + (side === 'theirs' ? ` <span class="need n-${nd.level.toLowerCase()}" title="Your need at ${p.pos}">${nd.level}</span>` : '')
      + (a.starts ? ' <span class="dim small">starter</span>' : '');
  } else {
    const via = a.orig !== (side === 'mine' ? G.userTeam : UI.tr.partner) ? ` <span class="dim small">via ${TM(a.orig).abbr}</span>` : '';
    info = `<b>${esc(a.label)}</b>${via} ${tierChip(a.tier)} <span class="dim small">${a.cur ? 'pick #' + a.ovr : a.near ? `proj. pick #${a.slot} · ${projDesc(a)}` : `~#${a.slot} (early estimate)`}</span>`;
  }
  return `<tr class="asset ${on ? 'sel' : ''}" data-act="tradeToggle" data-side="${side}" data-k="${a.key}"><td class="cbox">${on ? '■' : '□'}</td><td>${info}</td><td class="r"><b>${a.pts}</b></td></tr>`;
}
function assetTable(list, side, sel, myNeeds) {
  const pl = list.filter(a => a.type === 'player').sort((a, b) => b.pts - a.pts);
  const pk = list.filter(a => a.type === 'pick').sort((a, b) => a.year - b.year || a.rd - b.rd || a.slot - b.slot);
  return `<div class="scroll tall"><table class="tbl assets"><tr><th></th><th>DRAFT PICKS</th><th class="r">VALUE</th></tr>${pk.map(a => assetRow(a, side, sel, myNeeds)).join('') || '<tr><td></td><td class="dim">No picks.</td><td></td></tr>'}
    <tr><th></th><th>PLAYERS</th><th class="r">VALUE</th></tr>${pl.map(a => assetRow(a, side, sel, myNeeds)).join('')}</table></div>`;
}
function vTrade() {
  const why = canTrade(G);
  if (UI.tr.partner === null || UI.tr.partner === G.userTeam) UI.tr.partner = G.userTeam === 0 ? 1 : 0;
  const pt = UI.tr.partner, P = TM(pt);
  const ev = evaluateTrade(G, pt, UI.tr.mine, UI.tr.theirs);
  const myNeeds = teamNeeds(G, TM(G.userTeam));
  const theirNeeds = Object.values(ev.needs).filter(n => n.level !== 'LOW').sort((a, b) => b.need - a.need);
  const ps = ev.proj.seed[pt];
  let h = offersPanel();
  if (why) h += `<div class="warn">${esc(why)} You can still explore offers.</div>`;
  h += `<div class="bar-row"><div class="px small">TRADE PARTNER <select data-change="tradePartner">${G.teams.filter(t => t.id !== G.userTeam).map(t => `<option value="${t.id}" ${t.id === pt ? 'selected' : ''}>${esc(t.city + ' ' + t.name)}</option>`).join('')}</select></div>
    <div>${helm(pt, 28)} ${recStr(P.rec)} · ${ps ? `projected ${ordinal(ps)} seed` : 'projected to miss playoffs'} · their pick projects #${ev.proj.slot[pt]} · ${tierChip(slotTier(ev.proj.slot[pt]))}</div></div>`;
  h += `<div class="dim small">They're looking for: ${theirNeeds.length ? theirNeeds.map(n => `<b>${n.pos}</b> <span class="need n-${n.level.toLowerCase()}">${n.level}</span>`).join(' ') : 'nothing in particular'}</div>`;
  // Deal summary
  const pctv = ev.need ? clamp(ev.r / ev.need, 0, 1.5) : 0;
  const cls = ev.accept ? 'good' : pctv >= 0.85 ? 'gold' : 'bad';
  const list = (arr) => arr.length ? arr.map(a => `<li>${a.type === 'player' ? `${ovrB(a.p.ovr)} ${a.p.pos} ${esc(fullName(a.p))}` : `${esc(a.label)} ${tierChip(a.tier)}`}</li>`).join('') : '<li class="dim">-</li>';
  h += panel('THE DEAL', `<div class="grid2 deal"><div><div class="px small">YOU SEND</div><ul class="dl">${list(ev.recv)}</ul></div><div><div class="px small">YOU RECEIVE</div><ul class="dl">${list(ev.give)}</ul></div></div>
    <div class="meter"><div class="bar"><i class="${ev.accept ? 'o-great' : pctv >= 0.85 ? 'o-elite' : 'm-bad'}" style="width:${pctv / 1.5 * 100}%"></i><span class="mark" style="left:${100 / 1.5}%"></span></div>
    <div class="small">${P.abbr} value received <b>${ev.r}</b>${ev.spotCost ? ` <span class="dim">(after -${ev.spotCost} roster-spot cost)</span>` : ''} · value given <b>${ev.g}</b> · needs <b>${ev.need}</b> to accept</div></div>
    <p class="${cls}">${esc(UI.tr.msg || ev.msg)}</p>
    <div><button class="btn" data-act="tradePropose" ${why || !(ev.recv.length + ev.give.length) ? 'disabled' : ''}>PROPOSE TRADE</button><button class="btn alt" data-act="tradeBalance">WHAT WOULD IT TAKE?</button><button class="btn alt" data-act="tradeClear">CLEAR</button></div>
    <p class="dim small">Values are ${P.abbr}'s view: talent and age, positional value, their needs at the position, and starters cost more to pry loose. Picks are valued by projected draft slot from projected seeding - bad teams' picks are worth more, and picks two drafts out are discounted.</p>`, 'dealpanel');
  h += `<div class="grid2">`;
  h += panel(`YOUR ASSETS <span class="dim small">(value to ${P.abbr})</span>`, assetTable(ev.recvAll, 'mine', UI.tr.mine, myNeeds));
  h += panel(`${P.abbr} ASSETS <span class="dim small">(FIT = your need)</span>`, assetTable(ev.giveAll, 'theirs', UI.tr.theirs, myNeeds));
  h += `</div>`;
  const hist = (G.trades || []).slice(0, 15);
  if (hist.length) h += panel('TRADE HISTORY', `<table class="tbl">${hist.map(t => `<tr><td class="dim">${t.y}${t.w ? ' W' + t.w : ' ' + t.phase}</td><td>${teamLink(t.a)} sent ${esc(t.aGave.join(', ') || 'nothing')}</td><td>${teamLink(t.b)} sent ${esc(t.bGave.join(', ') || 'nothing')}</td></tr>`).join('')}</table>`);
  return h;
}

function scoutPips(sc) { return `<span class="pips" title="${SCOUT_LABELS[sc]}">${[1, 2, 3].map(i => `<i class="${i <= sc ? 'on' : ''}"></i>`).join('')}</span>`; }
function nextScoutLabel() {
  if (G.phase === 'regular') {
    const w = Object.keys(SCOUT_STOPS).map(Number).find(k => k > G.week);
    return w ? `${SCOUT_STOPS[w][0]} after week ${w - 1}` : 'Bowl Season Scouting after week 18';
  }
  if (G.phase === 'awards' || G.phase === 'playoffs' || G.phase === 'postseason') return 'Scouting Combine before the draft';
  if (G.phase === 'preseason') return 'Early Season Scouting after week 4';
  return 'Early Season Scouting next season';
}
// Your upcoming picks and how each position's need looks from where you pick.
function draftNeedsPanel(needs) {
  const picks = teamDraftPicks(G, G.userTeam);
  if (!picks.length) return '';
  const lvl = (l) => `<span class="need n-${l.toLowerCase()}">${l}</span>`;
  const top = POSITIONS.map(ps => needs[ps]).filter(n => n.level !== 'LOW' || (n.baseNeed !== undefined && n.baseNeed >= 3.5)).sort((a, b) => b.need - a.need);
  const arrow = (n) => n.baseNeed === undefined || Math.abs(n.need - n.baseNeed) < 0.3 ? '' : n.need > n.baseNeed ? ' <span class="good">▲</span>' : ' <span class="bad">▼</span>';
  return panel(`NEEDS AT YOUR PICKS <span class="dim small">${picks.slice(0, 4).map(p => `R${p.rd} #${p.ovr}`).join(' · ')}${picks[0].proj ? ' (projected)' : ''}</span>`,
    `<p class="dim small">Needs are adjusted for where you pick: ▲ a good fit is likely to be there, ▼ nothing worth taking is projected. Auto-scout focuses on prospects in range of your picks.</p>` +
    (top.length ? `<table class="tbl">${top.map(n => `<tr><td><b>${n.pos}</b></td><td>${lvl(n.level)}${arrow(n)}</td><td class="small dim">${esc(n.draftNote || '')}</td><td class="small dim">${esc(n.reasons.slice(0, 2).join(' · '))}</td></tr>`).join('')}</table>` : '<p class="dim">No pressing needs.</p>'));
}
function vScouting() {
  const board = currentBoard(G);
  const stop = G.scoutStop;
  const year = G.draft ? G.draft.year : G.year + 1;
  let h = `<div class="draft-banner ${stop ? 'mine' : ''}"><div><div class="px">${stop ? esc(stop.name.toUpperCase()) : `${year} DRAFT CLASS SCOUTING`}</div>
    <div>${stop ? 'Your scouts are back from the road. Spend points to sharpen reports, then press DONE SCOUTING to continue.' : `Next check-in: ${esc(nextScoutLabel())}.`}</div></div>
    <div class="actions"><span class="px small gold">${G.scoutPts} PTS</span><button class="btn alt" data-act="autoScout" ${G.scoutPts ? '' : 'disabled'}>AUTO-SCOUT</button>${stop ? `<button class="btn" data-act="scoutDone">DONE SCOUTING &gt;</button>` : ''}</div></div>`;
  h += draftClassPanel();
  if (!board.length) return h + panel('PROSPECTS', '<p class="dim">The next draft class will be revealed when the season starts.</p>');
  const rep = G.scoutReport;
  const me = TM(G.userTeam); const needs = draftNeeds(G, me, null, board);
  const recs = recommendProspects(G, me, 8, board); const recIds = new Set(recs.map(r => r.p.id));
  h += draftNeedsPanel(needs);
  h += `<div class="grid2">`;
  const plist = (ids, up) => ids.map(id => G.players[id]).filter(Boolean).map(p => `<li>${up ? '<span class="good">▲</span>' : '<span class="bad">▼</span>'} ${p.pos} ${pLink(p)} <span class="dim">${esc(p.college)}</span> ${ovrB(p.sOvr)}</li>`).join('') || '<li class="dim">No big movers.</li>';
  h += panel(`STOCK REPORT${rep ? ' · ' + esc(rep.name.toUpperCase()) : ''}`, rep ? `<div class="grid2"><div><div class="px small good">RISING</div><ul class="dl">${plist(rep.risers, true)}</ul></div><div><div class="px small bad">FALLING</div><ul class="dl">${plist(rep.fallers, false)}</ul></div></div>` : '<p class="dim">No reports yet this season.</p>');
  h += panel('HOW SCOUTING WORKS', `<p class="small">Unscouted prospects show a rough projection (±9 OVR, wide POT). Each scouting level costs more and narrows it: <b>Basic</b> 1 pt (±5), <b>Detailed</b> 2 pts (±2.5, reveals ratings), <b>Full</b> 3 pts (exact). Points arrive at check-ins after weeks 4, 9 and 14 (10 each), during bowl season (15) and at the Combine (20, which also posts 40 times). Prospects' stock moves during their college season. Rival teams have their own scouting, so an unscouted board leaves you guessing.</p>`);
  h += `</div>`;
  let ps = board.map(id => G.players[id]);
  if (UI.scPos === 'NEEDS') ps = ps.filter(p => needs[p.pos].level !== 'LOW');
  else if (UI.scPos === 'UNSCOUTED') ps = ps.filter(p => !(p.sc > 0));
  else if (UI.scPos !== 'ALL') ps = ps.filter(p => p.pos === UI.scPos);
  h += `<div class="filters">${['ALL', 'NEEDS', 'UNSCOUTED', ...POSITIONS].map(x => `<button class="chip ${UI.scPos === x ? 'on' : ''}" data-act="scpos" data-v="${x}">${x === 'NEEDS' ? '★ MY NEEDS' : x}</button>`).join('')}</div>`;
  const lvl = (l) => `<span class="need n-${l.toLowerCase()}">${l}</span>`;
  h += panel(`${year} BIG BOARD (YOUR SCOUTS' VIEW)`, `<div class="scroll tall"><table class="tbl"><tr><th>RK</th><th>NAME</th><th>POS</th><th>FIT</th><th>AGE</th><th>COLLEGE</th><th>SCOUTED</th><th>PROJ</th><th>POT</th><th>40YD</th><th>TREND</th><th></th></tr>${ps.slice(0, 160).map(p => {
    const sc = p.sc || 0; const sp = SCOUT_SPREAD[sc];
    return `<tr class="${recIds.has(p.id) ? 'rec-row' : ''}"><td class="dim">${board.indexOf(p.id) + 1}</td><td>${recIds.has(p.id) ? '<span class="gold">★</span> ' : ''}${pLink(p)}</td><td>${p.pos}</td><td title="${esc(needs[p.pos].draftNote || '')}">${lvl(needs[p.pos].level)}</td><td>${p.age}</td><td class="dim">${esc(p.college)}</td><td>${scoutPips(sc)}</td><td>${ovrB(p.sOvr)}${sp ? ` <span class="dim small">±${Math.ceil(sp)}</span>` : ''}</td><td>${sc === 0 && !p.gen ? '<span class="dim">?</span>' : potB(p.sPot, p.gen)}</td><td>${p.combine ? p.combine.forty : '<span class="dim">-</span>'}</td><td>${p.trend ? (p.trend > 0 ? `<span class="good">+${p.trend}</span>` : `<span class="bad">${p.trend}</span>`) : ''}</td><td>${sc < 3 ? `<button class="btn tiny" data-act="scout" data-id="${p.id}" ${G.scoutPts < scoutCost(p) ? 'disabled' : ''}>SCOUT ${scoutCost(p)}</button>` : '<span class="good small">FULL</span>'}</td></tr>`;
  }).join('')}</table></div>`);
  return h;
}
