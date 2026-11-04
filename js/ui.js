'use strict';
// ================= UI =================
let G = null;
const UI = { tab: 'home', rPos: 'ALL', rSort: 'ovr', rDir: -1, faPos: 'ALL', dPos: 'ALL', schedWeek: null, leadMode: 'reg', awYear: null, injAll: false, newsAll: false, histYear: null, watch: true, tr: { partner: null, mine: [], theirs: [], msg: null }, scPos: 'ALL' };

const $ = (s) => document.querySelector(s);
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2800); }
function persist() { if (!saveLeague(G)) toast('Could not save - browser storage is full or blocked.'); }
const TM = (tid) => G.teams[tid];
function helm(tid, size) { size = size || 20; const t = TM(tid); return `<img class="helm" alt="${t.abbr}" src="${Sprites.helmet(t)}" width="${size}" height="${size}">`; }
function teamLink(tid, full) { const t = TM(tid); return `<a class="tlink" data-act="team" data-id="${tid}">${helm(tid, 20)}<span>${full ? esc(t.city + ' ' + t.name) : t.abbr}</span></a>`; }
function pLink(p, short) { return `<a class="plink" data-act="player" data-id="${p.id}">${esc(short ? shortName(p) : fullName(p))}</a>`; }
function ovrCls(v) { return v >= 90 ? 'o-elite' : v >= 80 ? 'o-great' : v >= 70 ? 'o-good' : v >= 60 ? 'o-avg' : 'o-low'; }
function ovrB(v) { return `<span class="ovr ${ovrCls(v)}">${v}</span>`; }
function potB(v, gen) { return gen ? '<span class="pot pot-s" title="Generational talent">S</span>' : `<span class="pot">${potGrade(v)}</span>`; }
function statusTag(p) { if (!p.injury) return '<span class="ok">OK</span>'; return `<span class="${p.injury.ill ? 'ill' : 'inj'}">${p.ir ? 'IR ' : ''}${esc(p.injury.name)} ${p.injury.weeks}w</span>`; }
function passerRating(s) { const a = st(s, "pAtt"); if (!a) return 0; const c = clamp((st(s, "pCmp") / a - 0.3) * 5, 0, 2.375), y = clamp((st(s, "pYds") / a - 3) * 0.25, 0, 2.375), t = clamp(st(s, "pTd") / a * 20, 0, 2.375), i = clamp(2.375 - st(s, "pInt") / a * 25, 0, 2.375); return (c + y + t + i) / 6 * 100; }
const f1 = (n, d) => d ? (n / d).toFixed(1) : '0.0';
const COLS = {
  pass: [['CMP', 'pCmp'], ['ATT', 'pAtt'], ['PCT', s => f1(st(s, 'pCmp') * 100, st(s, 'pAtt'))], ['YDS', 'pYds'], ['TD', 'pTd'], ['INT', 'pInt'], ['RTG', s => passerRating(s).toFixed(1)], ['SK', 'sk']],
  rush: [['CAR', 'rAtt'], ['YDS', 'rYds'], ['AVG', s => f1(st(s, 'rYds'), st(s, 'rAtt'))], ['TD', 'rTd'], ['LNG', 'rLng'], ['FUM', 'fum']],
  recv: [['TGT', 'tgt'], ['REC', 'rec'], ['YDS', 'reYds'], ['AVG', s => f1(st(s, 'reYds'), st(s, 'rec'))], ['TD', 'reTd'], ['LNG', 'reLng']],
  def: [['TKL', 'tkl'], ['SACK', 'sack'], ['INT', 'dInt'], ['FF', 'ff'], ['PD', 'pd']],
  kick: [['FGM', 'fgm'], ['FGA', 'fga'], ['PCT', s => f1(st(s, 'fgm') * 100, st(s, 'fga'))], ['LNG', 'fgLng'], ['XPM', 'xpm'], ['XPA', 'xpa']],
  punt: [['PUNTS', 'pnt'], ['YDS', 'pntYds'], ['AVG', s => f1(st(s, 'pntYds'), st(s, 'pnt'))]],
  ol: [['GS', 'gs']],
};
const POS_COLS = { QB: ['pass', 'rush'], RB: ['rush', 'recv'], WR: ['recv'], TE: ['recv'], OL: ['ol'], DE: ['def'], DT: ['def'], LB: ['def'], CB: ['def'], S: ['def'], K: ['kick'], P: ['punt'] };
const cell = (s, c) => typeof c[1] === 'function' ? c[1](s) : st(s, c[1]);

// ---------- Top level ----------
function render() {
  const app = $('#app');
  if (!G) { app.innerHTML = renderStart(); return; }
  app.innerHTML = renderHeader() + renderNav() + `<main id="main">${renderTab()}</main><footer class="foot">PIXEL GRIDIRON GM · fictional league, not affiliated with any pro league · autosaves in this browser</footer>`;
  if (UI.tab === 'home') drawBanner();
}

const NAMES_KEY = 'pixel_gridiron_team_names';
function startNames() {
  if (!UI.names) {
    let saved = null; try { saved = JSON.parse(localStorage.getItem(NAMES_KEY) || 'null'); } catch (e) { saved = null; }
    UI.names = TEAMS_DATA.map((t, i) => ({ name: saved && saved[i] && saved[i].name || t[3], abbr: saved && saved[i] && saved[i].abbr || t[4] }));
  }
  return UI.names;
}
function setStartName(i, field, raw) {
  const names = startNames();
  if (field === 'name') {
    const v = raw.replace(/[<>]/g, '').trim().slice(0, 18);
    names[i].name = v || TEAMS_DATA[i][3];
  } else {
    const v = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
    if (v.length < 2) { toast('Abbreviations need 2-4 letters.'); return; }
    if (names.some((n, j) => j !== i && n.abbr === v)) { toast(`${v} is already taken.`); return; }
    names[i].abbr = v;
  }
  try { localStorage.setItem(NAMES_KEY, JSON.stringify(names)); } catch (e) { /* ignore */ }
}
function renderStart() {
  const saved = hasSave();
  let h = `<div class="start"><div class="logo px">PIXEL<br><span>GRIDIRON</span> GM</div>
  <p class="tag">Run a pro football franchise. Draft, develop, survive injuries, chase the title.</p>`;
  if (saved) h += `<div class="center"><button class="btn big" data-act="continue">&gt; CONTINUE SAVED GAME</button></div>`;
  h += `<h2 class="px">${UI.editNames ? 'NAME YOUR LEAGUE' : saved ? 'OR START A NEW FRANCHISE' : 'CHOOSE YOUR TEAM'}</h2>
  <div class="center">${UI.editNames ? `<p class="dim">Rename any team and its abbreviation (2-4 letters). Cities and colors stay the same. Names are remembered in this browser.</p><button class="btn" data-act="namesDone">DONE - PICK A TEAM</button><button class="btn alt" data-act="namesReset">RESET TO DEFAULTS</button>` : `<button class="btn alt" data-act="namesEdit">CUSTOMIZE TEAM NAMES</button>`}</div><div class="pick-grid">`;
  for (const c of CONFS) for (const d of DIV_DISPLAY) {
    h += `<div class="pick-div"><div class="px small">${c.toUpperCase()} ${d.toUpperCase()}</div>`;
    TEAMS_DATA.forEach((t, i) => {
      if (t[0] !== c || t[1] !== d) return;
      const nm = startNames()[i];
      const fake = { abbr: nm.abbr, c1: t[5], c2: t[6] };
      if (UI.editNames) h += `<div class="name-edit" style="--c1:${t[5]}"><img class="helm" src="${Sprites.helmet(fake)}" width="32" height="32"><div><div class="small">${esc(t[2])}</div><input class="tn" maxlength="18" value="${esc(nm.name)}" data-change="tname" data-i="${i}" data-f="name" aria-label="${esc(t[2])} team name"><input class="ta" maxlength="4" value="${esc(nm.abbr)}" data-change="tname" data-i="${i}" data-f="abbr" aria-label="${esc(t[2])} abbreviation"></div></div>`;
      else h += `<button class="pick-team" data-act="newgame" data-id="${i}" style="--c1:${t[5]};--c2:${t[6]}"><img class="helm" src="${Sprites.helmet(fake)}" width="40" height="40"><span>${esc(t[2])}<br><b>${esc(nm.name)}</b></span></button>`;
    });
    h += `</div>`;
  }
  return h + `</div></div>`;
}

function phaseLabel() {
  switch (G.phase) {
    case 'regular': return `${G.year} · WEEK ${G.week}`;
    case 'awards': return `${G.year} · AWARDS`;
    case 'playoffs': return `${G.year} · ${ROUND_NAMES[G.playoffs.round].toUpperCase()}`;
    case 'postseason': return `${G.year} · SEASON OVER`;
    case 'draft': return `${G.year} · DRAFT`;
    case 'preseason': return `${G.year} · PRESEASON`;
    case 'resign': return `${G.year} · RE-SIGNING`;
    case 'freeagency': return `${G.year} · FREE AGENCY ${Math.min(G.faWave, FA_WAVES)}/${FA_WAVES}`;
  }
  return '';
}
function phaseButtons() {
  if (G.scoutStop) return `<span class="px small gold blink2">${esc(G.scoutStop.name.toUpperCase())}</span><button class="btn alt" data-act="tab" data-tab="scouting">SCOUTING (${G.scoutPts} PTS)</button><button class="btn" data-act="scoutDone">DONE SCOUTING &gt;</button>`;
  switch (G.phase) {
    case 'regular': return `<button class="btn" data-act="playWeek">&gt; PLAY WEEK ${G.week}</button><button class="btn alt" data-act="simSeason">»» SIM TO PLAYOFFS</button>`;
    case 'awards': return `<button class="btn alt" data-act="tab" data-tab="awards">AWARDS</button><button class="btn" data-act="startPlayoffs">&gt; START PLAYOFFS</button>`;
    case 'playoffs': return `<button class="btn" data-act="playRound">&gt; PLAY ${ROUND_NAMES[G.playoffs.round].toUpperCase()}</button><button class="btn alt" data-act="simPlayoffs">»» SIM PLAYOFFS</button>`;
    case 'postseason': return `<button class="btn" data-act="offseason">&gt; BEGIN OFFSEASON</button>`;
    case 'draft': return `${reviewButtons()}<button class="btn alt" data-act="tab" data-tab="draft">DRAFT BOARD</button><button class="btn" data-act="finishDraft">»» AUTO-FINISH DRAFT</button>`;
    case 'resign': return `<button class="btn alt" data-act="tab" data-tab="contracts">EXPIRING DEALS</button><button class="btn" data-act="startFA">BEGIN FREE AGENCY &gt;</button>`;
    case 'freeagency': return `<button class="btn alt" data-act="tab" data-tab="fa">FREE AGENTS</button>${G.faWave < FA_WAVES ? `<button class="btn alt" data-act="faWave">SIM FA WAVE ${G.faWave + 1}/${FA_WAVES}</button>` : '<span class="dim small">ALL WAVES DONE</span>'}<button class="btn" data-act="finishFA">FINISH FREE AGENCY &gt;</button>`;
    case 'preseason': return `${reviewButtons()}<button class="btn alt" data-act="autoCut">AUTO-CUT TO 53</button><button class="btn" data-act="startSeason">&gt; START ${G.year} SEASON</button>`;
  }
  return '';
}
function renderHeader() {
  const u = TM(G.userTeam);
  return `<header class="top" style="--c1:${u.c1};--c2:${u.c2}">
    <div class="brand px">PIXEL GRIDIRON GM</div>
    <div class="me">${helm(u.id, 44)}<div><div class="px tname">${esc(u.city)} ${esc(u.name)}</div><div class="sub">${recStr(u.rec)} · ${phaseLabel()} · ${capChip()}</div></div></div>
    <div class="actions">${phaseButtons()}</div>
    <div class="menu"><label class="chk"><input type="checkbox" data-change="watch" ${UI.watch ? 'checked' : ''}> Watch my games</label>
    <label class="chk"><input type="checkbox" data-change="autoRoster" ${G.autoRoster ? 'checked' : ''}> Auto-manage injuries</label>
    <button class="btn tiny alt" data-act="save">SAVE</button><button class="btn tiny danger" data-act="quit">NEW GAME</button></div>
  </header>`;
}
function renderNav() {
  const tabs = [['home', 'HOME'], ['roster', 'ROSTER'], ['depth', 'DEPTH'], ['training', 'TRAINING'], ['schedule', 'SCHEDULE'], ['standings', 'STANDINGS'], ['playoffs', 'PLAYOFFS'], ['leaders', 'LEADERS'], ['injuries', 'INJURIES'], ['news', 'NEWS'], ['fa', 'FREE AGENTS'], ['trade', 'TRADE'], ['contracts', 'CONTRACTS'], ['scouting', 'SCOUTING'], ['draft', 'DRAFT'], ['awards', 'AWARDS'], ['history', 'HISTORY'], ['records', 'RECORDS']];
  return `<nav class="tabs">${tabs.filter(([k]) => k !== 'playoffs' || G.playoffs).filter(([k]) => k !== 'draft' || G.draft || G.draftHistory[G.year]).map(([k, n]) => `<button class="tab px ${UI.tab === k ? 'on' : ''}" data-act="tab" data-tab="${k}">${n}</button>`).join('')}</nav>`;
}
function renderTab() {
  const f = { home: vHome, roster: vRoster, depth: vDepth, training: vTraining, schedule: vSchedule, standings: vStandings, playoffs: vPlayoffs, leaders: vLeaders, injuries: vInjuries, fa: vFA, trade: vTrade, news: vNews, contracts: vContracts, records: vRecords, scouting: vScouting, draft: vDraft, awards: vAwards, history: vHistory }[UI.tab] || vHome;
  return f();
}
const panel = (title, body, cls) => `<section class="panel ${cls || ''}">${title ? `<h3 class="px">${title}</h3>` : ''}${body}</section>`;

// ---------- Home ----------
function userGames() { return G.schedule.filter(g => g.home === G.userTeam || g.away === G.userTeam); }
function allUserGames() { const pg = G.playoffs ? G.playoffs.games.filter(g => g.home === G.userTeam || g.away === G.userTeam) : []; return [...userGames(), ...pg]; }
function vHome() {
  const u = TM(G.userTeam); const r = teamRatings(G, u);
  const rk = divStandings(G, u.conf, u.div).findIndex(t => t.id === u.id) + 1;
  const bar = (l, v) => `<div class="rbar"><span>${l}</span><div class="bar"><i style="width:${clamp((v - 50) * 2.2, 4, 100)}%" class="${ovrCls(v)}"></i></div><b>${v}</b></div>`;
  let h = `<canvas id="banner" class="banner" width="${Field.W}" height="${Field.H}"></canvas>`;
  h += `<div class="grid2">`;
  h += panel('FRANCHISE', `<div class="franchise">${helm(u.id, 72)}<div><div class="px big-name">${esc(u.city)}<br>${esc(u.name)}</div>
    <div class="sub">${recStr(u.rec)} · ${ordinal(rk)} in ${u.conf} ${u.div} · PF ${u.rec.pf} PA ${u.rec.pa}${u.rec.strk ? ` · Streak ${u.rec.strk > 0 ? 'W' + u.rec.strk : 'L' + -u.rec.strk}` : ''}</div></div></div>
    ${bar('OFFENSE', r.off)}${bar('DEFENSE', r.def)}${bar('OVERALL', r.ovr)}
    <div class="sub">Active roster: ${activeRoster(G, u).length}/${ROSTER_LIMIT} · IR: ${u.roster.filter(id => G.players[id].ir).length}</div>${rosterWarnings(u)}`);
  h += panel(G.phase === 'regular' ? 'THIS WEEK' : 'LATEST', homeGameCard());
  h += `</div><div class="grid3">`;
  h += panel(`${u.conf.toUpperCase()} ${u.div.toUpperCase()}`, miniDiv(u.conf, u.div));
  const tops = u.roster.map(id => G.players[id]).sort((a, b) => b.ovr - a.ovr).slice(0, 6);
  h += panel('STAR PLAYERS', `<table class="tbl">${tops.map(p => `<tr><td>${ovrB(p.ovr)}</td><td>${p.pos}</td><td>${pLink(p)}</td><td class="dim small">${esc(statLine(p))}</td></tr>`).join('')}</table>`);
  const inj = u.roster.map(id => G.players[id]).filter(p => p.injury).sort((a, b) => b.ovr - a.ovr);
  h += panel('INJURY REPORT', inj.length ? `<table class="tbl">${inj.slice(0, 8).map(p => `<tr><td>${p.pos}</td><td>${pLink(p, true)}</td><td>${statusTag(p)}</td></tr>`).join('')}</table>` : '<p class="dim">Everybody is healthy.</p>');
  h += `</div>`;
  const topStories = (G.stories || []).slice(0, 4);
  h += panel(`TOP STORIES <button class="btn tiny alt" data-act="tab" data-tab="news">ALL NEWS</button>`, topStories.length ? `<div class="stories">${topStories.map(x => storyCard(x)).join('')}</div>` : '<p class="dim">Storylines appear as the season unfolds.</p>');
  const items = G.news.filter(n => UI.newsAll || n.tid === G.userTeam || n.tid === -1).slice(0, 40);
  h += panel(`NEWS <button class="btn tiny alt" data-act="newsAll">${UI.newsAll ? 'SHOW MINE' : 'SHOW ALL'}</button>`, `<ul class="news">${items.map(n => `<li><span class="dim">${n.y}${n.w ? ' W' + n.w : ''}</span> ${n.tid >= 0 ? helm(n.tid, 16) : '★'} ${esc(n.text)}</li>`).join('') || '<li class="dim">No news yet.</li>'}</ul>`);
  return h;
}
function ordinal(n) { return n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th'); }
function rosterWarnings(u) {
  const healthy = posCounts(u.roster.map(id => G.players[id]).filter(p => !p.injury));
  const w = POSITIONS.filter(ps => healthy[ps] < STARTERS[ps]).map(ps => `${ps}: ${healthy[ps]} healthy (need ${STARTERS[ps]})`);
  const act = activeRoster(G, u).length;
  if (act > ROSTER_LIMIT) w.unshift(`Active roster ${act} > ${ROSTER_LIMIT}`);
  return w.length ? `<div class="warn">⚠ ${w.join('<br>⚠ ')}</div>` : '';
}
function homeGameCard() {
  if (G.phase === 'resign') return `<p>The new league year has begun. The cap is now <b>${fmtM(G.cap)}</b>.</p><p>You have <b>${TM(G.userTeam).roster.filter(id => negCtx(G.players[id]) === 'resign').length}</b> expiring contracts to re-sign before free agency opens.</p><button class="btn" data-act="tab" data-tab="contracts">REVIEW EXPIRING DEALS</button>`;
  if (G.phase === 'freeagency') return `<p>Free agency wave ${G.faWave}/${FA_WAVES}. Your cap space: <b>${fmtM(capSpace(G, TM(G.userTeam)))}</b>.</p><p class="dim">Top free agents get bid up early and get cheaper in later waves - if they're still around.</p><button class="btn" data-act="tab" data-tab="fa">SHOP FREE AGENTS</button>`;
  if (G.phase === 'draft') return `<p>The ${G.year} Draft is underway. You pick at: ${G.draft.picks.filter(p => p.tid === G.userTeam).map(p => '#' + p.ovr).join(', ')}</p><button class="btn" data-act="tab" data-tab="draft">GO TO DRAFT BOARD</button>`;
  if (G.phase === 'preseason') return `<p>Set your roster for ${G.year}. Active: ${activeRoster(G, TM(G.userTeam)).length}/${ROSTER_LIMIT}.</p><p class="dim">Rookies have joined the team. Cut players from the Roster tab or use AUTO-CUT.</p>`;
  let next = null, last = null;
  const gs = allUserGames();
  for (const g of gs) { if (g.played) last = g; else if (!next) next = g; }
  let h = '';
  if (G.phase === 'regular' && next && next.week === G.week) h += matchCard(next, `WEEK ${next.week}`);
  else if (G.phase === 'regular') h += `<p class="px small">WEEK ${G.week}: BYE WEEK</p>`;
  if (G.phase === 'playoffs' && next) h += matchCard(next, ROUND_NAMES[next.round].toUpperCase());
  if (G.phase === 'playoffs' && !next) h += `<p>Your season is over. The playoffs continue.</p>`;
  if (G.phase === 'awards') h += `<p>The regular season is over. ${G.playoffs ? '' : (confSeeds(G, TM(G.userTeam).conf).includes(G.userTeam) ? `<b class="good">You made the playoffs as the #${confSeeds(G, TM(G.userTeam).conf).indexOf(G.userTeam) + 1} seed!</b>` : 'You missed the playoffs.')}</p>`;
  if (G.phase === 'postseason') { const c = G.champions[G.champions.length - 1]; h += `<p class="px small">CHAMPION</p><div class="champ">${helm(c.champ, 64)}<div class="px">${esc(TM(c.champ).city)} ${esc(TM(c.champ).name)}</div><div>def. ${teamLink(c.runner)} ${c.score}</div><div class="dim">Megacup MVP: ${c.mvp ? esc(c.mvp.name) : '-'}</div></div>`; }
  if (last) h += `<div class="lastgame"><span class="dim">LAST GAME:</span> ${resultStr(last, G.userTeam)} <button class="btn tiny alt" data-act="box" data-id="${last.id}">BOX</button>${last.log ? `<button class="btn tiny" data-act="watch" data-id="${last.id}">&gt; REPLAY</button>` : ''}</div>`;
  return h;
}
function matchCard(g, label) {
  const tr = (tid) => { const t = TM(tid); return `<div class="mteam">${helm(tid, 56)}<div class="px">${t.abbr}</div><div class="dim">${recStr(t.rec)}</div><div class="small">OVR ${teamRatings(G, t).ovr}</div></div>`; };
  return `<div class="px small center">${label}${g.neutral ? ' · NEUTRAL SITE' : ''}</div><div class="match">${tr(g.away)}<div class="px vs">@</div>${tr(g.home)}</div>`;
}
function resultStr(g, tid) {
  if (!g.played) return '';
  const my = g.home === tid ? g.hs : g.as, op = g.home === tid ? g.as : g.hs, opp = g.home === tid ? g.away : g.home;
  const r = my > op ? '<b class="good">W</b>' : my < op ? '<b class="bad">L</b>' : '<b>T</b>';
  return `${r} ${my}-${op}${g.ot ? ' OT' : ''} ${g.home === tid ? 'vs' : '@'} ${teamLink(opp)}`;
}
function miniDiv(conf, div) {
  return `<table class="tbl"><tr><th></th><th>W-L-T</th><th>PF</th><th>PA</th></tr>${divStandings(G, conf, div).map(t => `<tr class="${t.id === G.userTeam ? 'me-row' : ''}"><td>${teamLink(t.id)}</td><td>${recStr(t.rec)}</td><td>${t.rec.pf}</td><td>${t.rec.pa}</td></tr>`).join('')}</table>`;
}
function drawBanner() {
  const cv = $('#banner'); if (!cv) return;
  const ctx = cv.getContext('2d');
  const u = TM(G.userTeam);
  let opp = null;
  const gs = allUserGames(); const next = gs.find(g => !g.played) || gs[gs.length - 1];
  if (next) opp = TM(next.home === u.id ? next.away : next.home);
  Field.frame(ctx, u, opp || TM((u.id + 1) % 32), { side: 0, from: 35, to: 35, fd: 45, type: 'play' }, 0);
}

// ---------- Roster ----------
function posFilter(cur, act) {
  return `<div class="filters">${['ALL', ...POSITIONS].map(ps => `<button class="chip ${cur === ps ? 'on' : ''}" data-act="${act}" data-v="${ps}">${ps}</button>`).join('')}</div>`;
}
function vRoster() { return rosterTable(G.userTeam, true); }
function rosterTable(tid, mine) {
  const t = TM(tid);
  let ps = t.roster.map(id => G.players[id]);
  if (UI.rPos !== 'ALL') ps = ps.filter(p => p.pos === UI.rPos);
  const k = UI.rSort, d = UI.rDir;
  const val = (p) => k === 'name' ? p.ln : k === 'pos' ? POSITIONS.indexOf(p.pos) * 100 - p.ovr : k === 'num' ? p.num : k === 'stat' ? 0 : p[k];
  ps.sort((a, b) => { const x = val(a), y = val(b); return (x < y ? -1 : x > y ? 1 : 0) * d; });
  const th = (key, label) => `<th class="sort ${k === key ? 'on' : ''}" data-act="rsort" data-k="${key}">${label}</th>`;
  const act = activeRoster(G, t).length;
  let h = `<div class="bar-row"><div class="px small">${esc(t.city)} ${esc(t.name)} · ACTIVE ${act}/${ROSTER_LIMIT} · IR ${t.roster.length - act}</div>${mine ? `<button class="btn tiny alt" data-act="staffCuts">STAFF CUT REVIEW</button><button class="btn tiny alt" data-act="autoCut">AUTO-CUT TO 53</button><button class="btn tiny alt" data-act="autoFill">AUTO-FILL ROSTER</button>` : ''}</div>`;
  h += posFilter(UI.rPos, 'rpos');
  h += `<div class="scroll"><table class="tbl roster"><tr>${th('num', '#')}${th('name', 'NAME')}${th('pos', 'POS')}${th('age', 'AGE')}${th('ovr', 'OVR')}${th('pot', 'POT')}${th('exp', 'EXP')}<th>HT/WT</th><th>CONTRACT</th><th>STATUS</th><th>${isOffseason() ? 'LAST SEASON' : 'SEASON'}</th>${mine ? '<th></th>' : ''}</tr>`;
  for (const p of ps) {
    const last = p.career[p.career.length - 1];
    const line = (isOffseason()) ? (last && last.year === G.year - 1 ? statLine(p, last) : p.exp === 0 ? 'Rookie' : '-') : (p.stats.gp ? statLine(p) : '-');
    h += `<tr><td class="dim">${p.num}</td><td>${pLink(p)}${p.exp === 0 ? ' <span class="rk">R</span>' : ''}</td><td>${p.pos}</td><td>${p.age}</td><td>${ovrB(p.ovr)}</td><td>${potB(p.pot, p.gen)}</td><td>${p.exp}</td><td class="dim">${htStr(p.ht)} ${p.wt}</td><td>${salCell(p)}</td><td>${statusTag(p)}</td><td class="small">${esc(line)}</td>${mine ? `<td>${negButton(p)}<button class="btn tiny danger" data-act="cut" data-id="${p.id}">CUT</button></td>` : ''}</tr>`;
  }
  return h + `</table></div>`;
}

// Depth chart view lives in ui_dev.js

// ---------- Schedule ----------
function vSchedule() {
  const mine = userGames();
  let h = `<div class="grid2">`;
  let rows = '';
  for (let w = 1; w <= REG_WEEKS; w++) {
    const g = mine.find(x => x.week === w);
    if (!g) { rows += `<tr><td>${w}</td><td colspan="3" class="dim">BYE</td></tr>`; continue; }
    const home = g.home === G.userTeam, opp = home ? g.away : g.home;
    rows += `<tr class="${w === G.week && G.phase === 'regular' ? 'me-row' : ''}"><td>${w}</td><td>${home ? 'vs' : '@'} ${teamLink(opp, true)}</td><td class="dim">${recStr(TM(opp).rec)}</td><td>${g.played ? resultStr(g, G.userTeam).split(' vs ')[0].split(' @ ')[0] + ` <button class="btn tiny alt" data-act="box" data-id="${g.id}">BOX</button>` : ''}</td></tr>`;
  }
  if (G.playoffs) for (const g of G.playoffs.games.filter(x => x.home === G.userTeam || x.away === G.userTeam)) {
    const home = g.home === G.userTeam, opp = home ? g.away : g.home;
    rows += `<tr><td class="px small">${['WC', 'DIV', 'CONF', 'CUP'][g.round]}</td><td>${home ? 'vs' : '@'} ${teamLink(opp, true)}</td><td></td><td>${g.played ? resultStr(g, G.userTeam).split(' vs ')[0].split(' @ ')[0] + ` <button class="btn tiny alt" data-act="box" data-id="${g.id}">BOX</button>` : ''}</td></tr>`;
  }
  h += panel(`${G.year} SCHEDULE`, G.schedule.length ? `<table class="tbl">${rows}</table>` : '<p class="dim">The schedule will be released when the season starts.</p>');
  const wk = UI.schedWeek || Math.max(1, Math.min(REG_WEEKS, G.phase === 'regular' ? G.week : REG_WEEKS));
  const games = G.schedule.filter(g => g.week === wk);
  let sel = `<select data-change="schedWeek">${Array.from({ length: REG_WEEKS }, (_, i) => `<option value="${i + 1}" ${i + 1 === wk ? 'selected' : ''}>Week ${i + 1}</option>`).join('')}</select>`;
  const byes = L_byes(wk);
  h += panel(`LEAGUE · ${sel}`, `<div class="games">${games.map(gameChip).join('')}</div>${byes.length ? `<p class="dim">Bye: ${byes.map(t => TM(t).abbr).join(', ')}</p>` : ''}`);
  return h + `</div>`;
}
function L_byes(wk) { const playing = new Set(); G.schedule.filter(g => g.week === wk).forEach(g => { playing.add(g.home); playing.add(g.away); }); return G.schedule.length ? G.teams.filter(t => !playing.has(t.id)).map(t => t.id) : []; }
function gameChip(g) {
  const row = (tid, s, win) => `<div class="gc-row ${win ? 'win' : ''}">${helm(tid, 18)} <span>${TM(tid).abbr}</span><b>${g.played ? s : ''}</b></div>`;
  return `<div class="gchip ${g.played ? 'click' : ''}" ${g.played ? `data-act="box" data-id="${g.id}"` : ''}>${row(g.away, g.as, g.played && g.as > g.hs)}${row(g.home, g.hs, g.played && g.hs > g.as)}<div class="dim small">${g.played ? (g.ot ? 'FINAL/OT' : 'FINAL') : 'UPCOMING'}</div></div>`;
}

// ---------- Standings ----------
function vStandings() {
  let h = `<div class="grid2">`;
  for (const c of CONFS) {
    let b = '';
    for (const d of DIV_DISPLAY) {
      b += `<div class="px small divh">${c.toUpperCase()} ${d.toUpperCase()}</div><table class="tbl"><tr><th>TEAM</th><th>W</th><th>L</th><th>T</th><th>PCT</th><th>PF</th><th>PA</th><th>DIV</th><th>CONF</th><th>STRK</th></tr>`;
      for (const t of divStandings(G, c, d)) {
        const r = t.rec;
        b += `<tr class="${t.id === G.userTeam ? 'me-row' : ''}"><td>${teamLink(t.id, true)}</td><td>${r.w}</td><td>${r.l}</td><td>${r.t}</td><td>${recPct(r).toFixed(3).replace(/^0/, '')}</td><td>${r.pf}</td><td>${r.pa}</td><td>${r.dw}-${r.dl}${r.dt ? '-' + r.dt : ''}</td><td>${r.cw}-${r.cl}${r.ct ? '-' + r.ct : ''}</td><td>${r.strk ? (r.strk > 0 ? 'W' + r.strk : 'L' + -r.strk) : '-'}</td></tr>`;
      }
      b += `</table>`;
    }
    const seeds = G.playoffs ? G.playoffs.seeds[c] : confSeeds(G, c);
    b += `<div class="px small divh">${G.playoffs ? 'PLAYOFF SEEDS' : 'PLAYOFF PICTURE (IF SEASON ENDED TODAY)'}</div><table class="tbl">${seeds.map((tid, i) => `<tr class="${tid === G.userTeam ? 'me-row' : ''}"><td class="px small">${i + 1}</td><td>${teamLink(tid, true)}</td><td>${recStr(TM(tid).rec)}</td><td class="dim">${i < 4 ? 'Division winner' : 'Wild card'}${i === 0 ? ' · BYE' : ''}</td></tr>`).join('')}</table>`;
    h += panel(c, b);
  }
  return h + '</div>';
}

// ---------- Playoffs ----------
function vPlayoffs() {
  const P = G.playoffs; if (!P) return panel('PLAYOFFS', '<p class="dim">No playoffs yet.</p>');
  let h = `<div class="bracket">`;
  for (let r = 0; r < 4; r++) {
    const games = P.games.filter(g => g.round === r);
    h += `<div class="round"><div class="px small">${ROUND_NAMES[r].toUpperCase()}</div>`;
    if (!games.length) h += `<div class="dim">TBD</div>`;
    for (const g of games) {
      const row = (tid, s) => `<div class="gc-row ${g.played && g.winner === tid ? 'win' : ''}"><span class="seed">${seedOf(G, tid)}</span>${helm(tid, 18)}<span>${TM(tid).abbr}</span><b>${g.played ? s : ''}</b></div>`;
      h += `<div class="gchip ${g.played ? 'click' : ''}" ${g.played ? `data-act="box" data-id="${g.id}"` : ''}><div class="dim small">${CONF_SHORT[g.conf] || g.conf}</div>${row(g.away, g.as)}${row(g.home, g.hs)}</div>`;
    }
    h += `</div>`;
  }
  h += `</div>`;
  if (P.champion !== null) { const c = G.champions[G.champions.length - 1]; h += panel('CHAMPION', `<div class="champ">${helm(c.champ, 96)}<div class="px">${esc(TM(c.champ).city)} ${esc(TM(c.champ).name)}</div><div>Megacup MVP: ${c.mvp ? esc(c.mvp.name) + ' (' + c.mvp.pos + ')' : '-'}</div></div>`); }
  return h;
}

// ---------- Leaders ----------
const LEADERS = [
  // Rate stats use league-style qualifiers scaled to games played (g): 14 attempts / 6.25 carries / 3 punts per team game.
  ['PASSING YARDS', s => s.pYds], ['PASSING TD', s => s.pTd], ['PASSER RATING', (s, g) => s.pAtt >= Math.max(1, 14 * g) ? +passerRating(s).toFixed(1) : null],
  ['RUSHING YARDS', s => s.rYds], ['RUSHING TD', s => s.rTd], ['YARDS PER CARRY', (s, g) => s.rAtt >= Math.max(1, 6.25 * g) ? +(s.rYds / s.rAtt).toFixed(2) : null],
  ['RECEPTIONS', s => s.rec], ['RECEIVING YARDS', s => s.reYds], ['RECEIVING TD', s => s.reTd],
  ['TACKLES', s => s.tkl], ['SACKS', s => s.sack], ['INTERCEPTIONS', s => s.dInt],
  ['FORCED FUMBLES', s => s.ff], ['FIELD GOALS', s => s.fgm], ['PUNT AVG', (s, g) => s.pnt >= Math.max(1, 3 * g) ? +(s.pntYds / s.pnt).toFixed(1) : null],
];
// Games the player's team has played (regular season), or the player's own games for playoffs / free agents.
function teamGamesFor(p, s, po) {
  if (po || p.tid < 0) return s.gp || 0;
  const r = TM(p.tid).rec; return r.w + r.l + r.t;
}
function vLeaders() {
  const po = UI.leadMode === 'po';
  const ps = Object.values(G.players).filter(p => p.tid >= 0 || p.tid === -1);
  let h = `<div class="filters"><button class="chip ${!po ? 'on' : ''}" data-act="leadMode" data-v="reg">REGULAR SEASON</button><button class="chip ${po ? 'on' : ''}" data-act="leadMode" data-v="po">PLAYOFFS</button><button class="chip ${UI.leadMode === 'team' ? 'on' : ''}" data-act="leadMode" data-v="team">TEAM STATS</button></div>`;
  if (UI.leadMode === 'team') return h + leagueTeamStatsTable();
  h += `<div class="leaders">`;
  for (const [label, fn] of LEADERS) {
    const rows = ps.map(p => { const s = po ? p.pstats : p.stats; return [p, fn(s, teamGamesFor(p, s, po))]; }).filter(x => x[1] !== null && x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 8);
    h += panel(label, rows.length ? `<table class="tbl">${rows.map(([p, v], i) => `<tr class="${p.tid === G.userTeam ? 'me-row' : ''}"><td class="dim">${i + 1}</td><td>${p.tid >= 0 ? helm(p.tid, 16) : ''} ${pLink(p, true)}</td><td class="dim">${p.pos}</td><td class="r"><b>${v}</b></td></tr>`).join('')}</table>` : '<p class="dim">No stats yet.</p>', 'lead');
  }
  return h + '</div>';
}

// ---------- Injuries ----------
function vInjuries() {
  let ps = Object.values(G.players).filter(p => p.injury && p.tid >= 0 && (UI.injAll || p.tid === G.userTeam));
  ps.sort((a, b) => a.tid - b.tid || b.ovr - a.ovr);
  let h = `<div class="filters"><button class="chip ${!UI.injAll ? 'on' : ''}" data-act="injAll" data-v="0">MY TEAM</button><button class="chip ${UI.injAll ? 'on' : ''}" data-act="injAll" data-v="1">WHOLE LEAGUE</button></div>`;
  h += panel(`INJURY & ILLNESS REPORT (${ps.length})`, ps.length ? `<div class="scroll"><table class="tbl"><tr><th>TEAM</th><th>PLAYER</th><th>POS</th><th>OVR</th><th>ISSUE</th><th>OUT</th><th>LIST</th></tr>${ps.map(p => `<tr><td>${teamLink(p.tid)}</td><td>${pLink(p)}</td><td>${p.pos}</td><td>${ovrB(p.ovr)}</td><td class="${p.injury.ill ? 'ill' : 'inj'}">${esc(p.injury.name)}</td><td>${p.injury.weeks} wk</td><td>${p.ir ? 'Injured Reserve' : 'Day-to-day'}</td></tr>`).join('')}</table></div>` : '<p class="dim">No current injuries.</p>');
  return h;
}

// ---------- Free agents ----------
function vFA() {
  const u = TM(G.userTeam); const act = activeRoster(G, u).length;
  let ps = G.fa.map(id => G.players[id]);
  if (UI.faPos !== 'ALL') ps = ps.filter(p => p.pos === UI.faPos);
  ps.sort((a, b) => b.ovr - a.ovr);
  let h = `<div class="bar-row"><div class="px small">YOUR ACTIVE ROSTER: ${act}/${ROSTER_LIMIT} · ${capChip()}</div><span class="dim">${act >= ROSTER_LIMIT ? 'Roster full - cut a player to sign someone.' : `${ROSTER_LIMIT - act} open spot(s).`}</span></div>`;
  h += posFilter(UI.faPos, 'fapos');
  h += `<div class="scroll"><table class="tbl"><tr><th>NAME</th><th>POS</th><th>AGE</th><th>OVR</th><th>POT</th><th>ASKING</th><th>STATUS</th><th>LAST SEASON</th><th>CAREER</th><th></th></tr>${ps.slice(0, 150).map(p => {
    const last = p.career[p.career.length - 1];
    return `<tr><td>${pLink(p)}</td><td>${p.pos}</td><td>${p.age}</td><td>${ovrB(p.ovr)}</td><td>${potB(p.pot, p.gen)}</td><td>${(() => { const a = askingContract(G, p, 'fa'); return `${fmtM(a.sal)} <span class="dim small">×${a.yrs}</span>`; })()}</td><td>${statusTag(p)}</td><td class="small">${last ? `${last.year} ${last.tm}: ${esc(statLine(p, last))}` : p.exp === 0 ? 'Undrafted rookie' : '-'}</td><td class="small dim">${esc(careerBrief(p))}</td><td>${negButton(p)}</td></tr>`;
  }).join('')}</table></div>`;
  return h;
}

// ---------- Draft ----------
function vDraft() {
  const D = G.draft;
  if (!D) {
    const hist = G.draftHistory[G.year] || [];
    return panel(`${G.year} DRAFT RESULTS`, draftResultsTable(hist));
  }
  if (G.phase !== 'draft') return panel(`${D.year} DRAFT ORDER`, `<p>The draft opens after free agency and the Scouting Combine.</p><table class="tbl">${D.picks.slice(0, 32).map(pk => `<tr class="${pk.tid === G.userTeam ? 'me-row' : ''}"><td class="dim">#${pk.ovr}</td><td>${teamLink(pk.tid, true)}${pk.orig !== pk.tid ? ` <span class="dim small">via ${TM(pk.orig).abbr}</span>` : ''}</td><td class="dim">${recStr(TM(pk.orig).rec)}</td></tr>`).join('')}</table><p class="dim">Your picks: ${D.picks.filter(p => p.tid === G.userTeam).map(p => '#' + p.ovr).join(', ') || 'none'}</p>`);
  const done = draftDone(G);
  const pick = done ? null : D.picks[D.cur];
  const myTurn = pick && pick.tid === G.userTeam;
  let h = `<div class="draft-banner ${myTurn ? 'mine' : ''}">${pick ? `<div class="px">ROUND ${pick.rd} · PICK ${pick.pk} (#${pick.ovr})</div><div>${helm(pick.tid, 40)} <b class="px">${esc(TM(pick.tid).city)} ${esc(TM(pick.tid).name)}</b> ${myTurn ? '<span class="blink px">YOU ARE ON THE CLOCK</span>' : 'on the clock'}</div>` : `<div class="px">DRAFT COMPLETE</div><button class="btn alt" data-act="draftReview" data-v="${D.year}">VIEW DRAFT REVIEW</button>`}
   <div class="actions">${G.scoutStop ? `<span class="dim">The ${esc(G.scoutStop.name)} is underway - finish scouting to open the draft.</span><button class="btn" data-act="tab" data-tab="scouting">GO TO SCOUTING</button>` : ''}${G.scoutStop ? '' : !myTurn && !done ? `<button class="btn" data-act="draftToMe">» SIM TO MY PICK</button><button class="btn alt" data-act="draftOne">NEXT PICK</button>` : ''}${myTurn && !G.scoutStop ? `<button class="btn alt" data-act="draftAuto">AUTO-PICK FOR ME</button>` : ''}${G.scoutStop ? '' : `<button class="btn alt" data-act="finishDraft">»» FINISH DRAFT</button>`}</div></div>`;
  const me = TM(G.userTeam);
  const needs = teamNeeds(G, me);
  const recs = done ? [] : recommendProspects(G, me, 5);
  const recIds = new Set(recs.map(r => r.p.id));
  const lvl = (l) => `<span class="need n-${l.toLowerCase()}">${l}</span>`;
  const nextMine = D.picks.slice(D.cur).find(p => p.tid === G.userTeam);
  let ps = D.pool.map(id => G.players[id]);
  if (UI.dPos === 'NEEDS') ps = ps.filter(p => needs[p.pos].level !== 'LOW');
  else if (UI.dPos !== 'ALL') ps = ps.filter(p => p.pos === UI.dPos);
  h += `<div class="grid-draft"><div>`;
  if (recs.length) {
    h += panel(`RECOMMENDED PICKS${nextMine && !myTurn ? ` <span class="dim small">(if picking now - your next pick is #${nextMine.ovr})</span>` : ''}`, `<table class="tbl recs">${recs.map((r, i) => `<tr><td class="px small gold">${i + 1}</td><td>${pLink(r.p)}<div class="dim small">${esc(r.why.join(' · '))}</div></td><td>${r.p.pos} ${lvl(needs[r.p.pos].level)}</td><td>${ovrB(r.p.sOvr)} ${potB(r.p.sPot, r.p.gen)}</td><td class="dim small">RK ${r.rank}</td><td>${myTurn && !G.scoutStop ? `<button class="btn tiny" data-act="draftPick" data-id="${r.p.id}">DRAFT</button>` : ''}</td></tr>`).join('')}</table>`, 'recpanel');
  }
  h += `<div class="filters">${['ALL', 'NEEDS', ...POSITIONS].map(x => `<button class="chip ${UI.dPos === x ? 'on' : ''}" data-act="dpos" data-v="${x}">${x === 'NEEDS' ? '★ MY NEEDS' : x}</button>`).join('')}</div>`;
  h += panel('BIG BOARD (SCOUTED)', `<div class="scroll tall"><table class="tbl"><tr><th>RK</th><th>NAME</th><th>POS</th><th>FIT</th><th>AGE</th><th>COLLEGE</th><th>PROJ</th><th>POT</th><th>HT/WT</th><th>SPD</th><th></th></tr>${ps.slice(0, 160).map(p => `<tr class="${recIds.has(p.id) ? 'rec-row' : ''}"><td class="dim">${D.pool.indexOf(p.id) + 1}</td><td>${recIds.has(p.id) ? '<span class="gold">★</span> ' : ''}${pLink(p)}${p.traits ? `<div class="traits-sm">${visibleTraits(p).map(t => `<span class="${t[3] > 0 ? 'tp' : 'tn'}">${t[3] > 0 ? '+' : '-'}${esc(t[0])}</span>`).join(' · ')}</div>` : ''}</td><td>${p.pos}</td><td>${lvl(needs[p.pos].level)}</td><td>${p.age}</td><td class="dim">${esc(p.college)}</td><td>${ovrB(p.sOvr)}</td><td>${potB(p.sPot, p.gen)}</td><td class="dim">${htStr(p.ht)} ${p.wt}</td><td>${p.attrs.spd}</td><td>${myTurn && !G.scoutStop ? `<button class="btn tiny" data-act="draftPick" data-id="${p.id}">DRAFT</button>` : ''}</td></tr>`).join('')}</table></div>`);
  h += `</div><div>`;
  const nlist = POSITIONS.map(ps2 => needs[ps2]).sort((a, b) => b.need - a.need);
  h += panel('TEAM NEEDS', `<table class="tbl needs">${nlist.map(n => `<tr><td><b>${n.pos}</b></td><td>${lvl(n.level)}</td><td class="nbar"><div class="bar"><i class="n-${n.level.toLowerCase()}" style="width:${n.need * 10}%"></i></div></td><td class="dim small">${n.stAvg} / ${n.lg}</td></tr>${n.reasons.length && n.level !== 'LOW' ? `<tr class="why"><td></td><td colspan="3" class="dim small">${esc(n.reasons.join('; '))}</td></tr>` : ''}`).join('')}</table><p class="dim small">Starter avg OVR / league avg. Need factors in starter quality, depth, aging starters, long injuries and young successors already on the roster.</p>`);
  const made = D.picks.slice(0, D.cur).reverse().slice(0, 24);
  h += panel('MY PICKS', `<table class="tbl">${D.picks.filter(p => p.tid === G.userTeam).map(p => `<tr><td class="dim">R${p.rd} #${p.ovr}${p.orig !== undefined && p.orig !== p.tid ? ' <span class="small">via ' + TM(p.orig).abbr + '</span>' : ''}</td><td>${p.pid ? `${p.pos} ${pLink(G.players[p.pid] || { id: p.pid, fn: p.name, ln: '' })}` : '<span class="dim">-</span>'}</td><td>${p.pid ? `${pickGrade(p)} <span class="dim small">${p.tr ? 'true #' + p.tr : ''}</span>` : ''}</td></tr>`).join('')}</table>${D.picks.some(p => p.tid === G.userTeam && p.pid) ? '<p class="dim small">Grade = slot you picked vs. where the player truly ranks in the class.</p>' : ''}`);
  h += panel('RECENT PICKS', `<table class="tbl">${made.map(p => `<tr><td class="dim">#${p.ovr}</td><td>${helm(p.tid, 16)}</td><td>${p.pos}</td><td>${G.players[p.pid] ? pLink(G.players[p.pid], true) : esc(p.name)}</td><td>${pickGrade(p)}</td></tr>`).join('') || '<tr><td class="dim">No picks yet.</td></tr>'}</table>`);
  return h + `</div></div>`;
}
function draftResultsTable(hist) {
  if (!hist.length) return '<p class="dim">No draft results.</p>';
  const yr = Object.keys(G.draftHistory).find(y => G.draftHistory[y] === hist);
  return `${yr ? `<button class="btn alt" data-act="draftReview" data-v="${yr}">VIEW DRAFT REVIEW &amp; GRADES</button>` : ''}<div class="scroll tall"><table class="tbl"><tr><th>PICK</th><th>TEAM</th><th>POS</th><th>PLAYER</th><th>TRUE</th><th>GRADE</th></tr>${hist.map(p => `<tr class="${p.tid === G.userTeam ? 'me-row' : ''}"><td class="dim">R${p.rd} #${p.ovr}</td><td>${teamLink(p.tid)}</td><td>${p.pos}</td><td>${G.players[p.pid] ? pLink(G.players[p.pid]) : esc(p.name)}</td><td class="dim">${p.tr ? '#' + p.tr : '-'}</td><td>${pickGrade(p)}</td></tr>`).join('')}</table></div>`;
}

// ---------- Awards ----------
const AWARD_LABELS = [['MVP', 'MOST VALUABLE PLAYER'], ['OPOY', 'OFFENSIVE PLAYER OF THE YEAR'], ['DPOY', 'DEFENSIVE PLAYER OF THE YEAR'], ['OROY', 'OFFENSIVE ROOKIE OF THE YEAR'], ['DROY', 'DEFENSIVE ROOKIE OF THE YEAR'], ['CPOY', 'COMEBACK PLAYER OF THE YEAR'], ['COY', 'COACH OF THE YEAR']];
function vAwards() {
  const years = Object.keys(G.awards).map(Number).sort((a, b) => b - a);
  if (!years.length) return panel('AWARDS', `<p class="dim">Awards are handed out at the end of the regular season (before the playoffs).</p>`);
  const y = UI.awYear && G.awards[UI.awYear] ? UI.awYear : years[0];
  const A = G.awards[y];
  const nm = (e) => e.pid && G.players[e.pid] ? pLink(G.players[e.pid]) : esc(e.name);
  let h = `<div class="bar-row"><div class="px">${y} LEAGUE HONORS</div><select data-change="awYear">${years.map(v => `<option ${v === y ? 'selected' : ''}>${v}</option>`).join('')}</select></div><div class="awards">`;
  for (const [k, label] of AWARD_LABELS) {
    const arr = A[k] || [];
    const w = arr[0];
    h += panel(label, w ? `<div class="winner">${helm(w.tid, 48)}<div><div class="px">${nm(w)}</div><div>${w.pos} · ${w.abbr}</div><div class="dim">${esc(w.line)}</div></div></div>${arr.length > 1 ? `<div class="dim small">FINALISTS: ${arr.slice(1).map(e => `${esc(e.name)} (${e.abbr})`).join(', ')}</div>` : ''}` : '<p class="dim">No qualified candidates.</p>', 'award');
  }
  h += `</div>`;
  const ap = A.allPro;
  h += panel('ALL-PRO FIRST TEAM', `<div class="allpro">${Object.keys(ap).map(pos => `<div><div class="px small">${pos}</div>${ap[pos].map(e => `<div>${helm(e.tid, 16)} ${nm(e)}</div>`).join('')}</div>`).join('')}</div>`);
  return h;
}

// ---------- History ----------
function vHistory() {
  const u = TM(G.userTeam);
  let h = `<div class="grid2">`;
  h += panel('MEGACUP CHAMPIONS', G.champions.length ? `<table class="tbl"><tr><th>YEAR</th><th>CHAMPION</th><th>RUNNER-UP</th><th>SCORE</th><th>MVP</th></tr>${G.champions.slice().reverse().map(c => `<tr><td>${c.year}</td><td>${teamLink(c.champ, true)}</td><td>${teamLink(c.runner)}</td><td>${c.score}${c.ot ? ' OT' : ''}</td><td class="small">${c.mvp ? esc(c.mvp.name) : '-'}</td></tr>`).join('')}</table>` : '<p class="dim">No champions crowned yet.</p>');
  h += panel(`${esc(u.name.toUpperCase())} HISTORY`, u.history.length ? `<table class="tbl"><tr><th>YEAR</th><th>REC</th><th>PF</th><th>PA</th><th>RESULT</th></tr>${u.history.slice().reverse().map(s => `<tr><td>${s.year}</td><td>${s.w}-${s.l}${s.t ? '-' + s.t : ''}</td><td>${s.pf}</td><td>${s.pa}</td><td class="${s.result.startsWith('WON') ? 'good' : ''}">${s.seed ? '#' + s.seed + ' seed · ' : ''}${s.result}</td></tr>`).join('')}</table>` : '<p class="dim">Complete a season to build your legacy.</p>');
  h += `</div>`;
  const hof = G.retired.slice().sort((a, b) => (b.hof - a.hof) || b.awards.length - a.awards.length);
  h += panel('HALL OF FAME & NOTABLE RETIREES', hof.length ? `<div class="scroll"><table class="tbl"><tr><th></th><th>NAME</th><th>POS</th><th>YEARS</th><th>LAST TEAM</th><th>CAREER</th><th>HONORS</th></tr>${hof.map(r => `<tr><td>${r.hof ? '<span class="gold px small">HOF</span>' : ''}</td><td>${esc(r.name)}</td><td>${r.pos}</td><td>${r.from}-${r.to}</td><td>${r.lastTeam}</td><td class="small">${esc(careerSummary(r.pos, r.tot))}</td><td class="small dim">${esc(summarizeAwards(r.awards))}</td></tr>`).join('')}</table></div>` : '<p class="dim">No notable retirements yet.</p>');
  const dYears = Object.keys(G.draftHistory).map(Number).sort((a, b) => b - a);
  if (dYears.length) {
    const y = UI.histYear && G.draftHistory[UI.histYear] ? UI.histYear : dYears[0];
    h += panel(`DRAFT HISTORY <select data-change="histYear">${dYears.map(v => `<option ${v === y ? 'selected' : ''}>${v}</option>`).join('')}</select>`, draftResultsTable(G.draftHistory[y]));
  }
  return h;
}
function careerSummary(pos, s) {
  if (pos === 'QB') return `${st(s, 'pYds')} pass yds, ${st(s, 'pTd')} TD`;
  if (pos === 'RB') return `${st(s, 'rYds')} rush yds, ${st(s, 'rTd')} TD`;
  if (pos === 'WR' || pos === 'TE') return `${st(s, 'rec')} rec, ${st(s, 'reYds')} yds, ${st(s, 'reTd')} TD`;
  if (pos === 'K') return `${st(s, 'fgm')} FG`;
  if (pos === 'P') return `${st(s, 'pnt')} punts`;
  if (pos === 'OL') return `${st(s, 'gs')} starts`;
  return `${st(s, 'tkl')} tkl, ${st(s, 'sack')} sacks, ${st(s, 'dInt')} INT`;
}
function summarizeAwards(aw) {
  const c = {}; aw.forEach(a => { const k = a.replace(/^\d+ /, ''); c[k] = (c[k] || 0) + 1; });
  return Object.entries(c).map(([k, n]) => (n > 1 ? n + 'x ' : '') + k).join(', ');
}

// ---------- Modals ----------
function openModal(html, wide) { const m = $('#modal'); m.innerHTML = `<div class="modal-box ${wide ? 'wide' : ''}"><button class="x px" data-act="close">X</button>${html}</div>`; m.classList.remove('hidden'); }
function closeModal() { stopReplay(); const m = $('#modal'); m.classList.add('hidden'); m.innerHTML = ''; }

function playerModal(pid) {
  const p = G.players[pid]; if (!p) return;
  const t = p.tid >= 0 ? TM(p.tid) : null;
  const prospect = p.tid === -2;
  const keys = Object.keys(OVR_WEIGHTS[p.pos]);
  const others = ATTRS.filter(k => !keys.includes(k));
  const abar = (k, hi) => { const v = p.attrs[k]; return `<div class="abar ${hi ? 'hi' : ''}"><span>${ATTR_NAMES[k]}</span><div class="bar"><i class="${ovrCls(v)}" style="width:${v}%"></i></div><b>${v}</b></div>`; };
  const dr = p.draft ? `${p.draft.year} R${p.draft.rd} #${p.draft.ovr} (${TM(p.draft.tid).abbr})` : (prospect ? `${G.draft ? G.draft.year : G.year + 1} prospect` : p.exp > 0 ? 'Pre-league / Undrafted' : 'Undrafted');
  let h = `<div class="pcard" style="--c1:${t ? t.c1 : '#444'};--c2:${t ? t.c2 : '#999'}">
    <img class="psprite" src="${Sprites.player(p, t, 6)}" alt="">
    <div class="pinfo"><div class="px pname">#${p.num} ${esc(fullName(p))}</div>
      <div>${p.pos} · ${t ? teamLink(t.id, true) : prospect ? 'Draft Prospect' : 'Free Agent'}</div>
      <div class="dim">Age ${p.age} · ${htStr(p.ht)} ${p.wt} lbs · ${esc(p.college)} · Exp ${p.exp} yr · Drafted: ${dr}</div>${p.contract && !prospect ? `<div>Contract: <b>${esc(contractStr(G, p))}</b> · market ${fmtM(marketSalary(G, p))}</div>` : p.tid === -1 ? `<div>Free agent · asking ${fmtM(askingContract(G, p, 'fa').sal)}/yr</div>` : ''}
      <div class="ratings"><div>OVR ${prospect ? ovrB(p.sOvr) + ` <span class="dim small">${SCOUT_SPREAD[p.sc || 0] ? '±' + Math.ceil(SCOUT_SPREAD[p.sc || 0]) : 'exact'} · ${SCOUT_LABELS[p.sc || 0]}</span>` : ovrB(p.ovr)}</div><div>POTENTIAL ${prospect && !p.sc && !p.gen ? '<span class="pot">?</span>' : potB(prospect ? p.sPot : p.pot, p.gen)}</div><div>${statusTag(p)}</div></div>
      ${p.awards.length ? `<div class="gold small">★ ${esc(summarizeAwards(p.awards))}</div>` : ''}
      <div class="pact">${p.tid === G.userTeam && !G.draft ? `<button class="btn tiny danger" data-act="cut" data-id="${p.id}">RELEASE</button>` : ''}${negButton(p)}<button class="btn tiny alt" data-act="editPlayer" data-id="${p.id}">EDIT PLAYER</button></div>
    </div></div>`;
  if (p.traits && p.traits.length) {
    const vis = visibleTraits(p), hidden = p.traits.length - vis.length;
    h += `<h4 class="px">${prospect ? 'COLLEGE REPORT' : 'SCOUTING NOTES'}</h4><div>${vis.map(traitHtml).join('')}${hidden ? `<span class="dim small">+${hidden} more - scout deeper to uncover</span>` : ''}</div>`;
  }
  if (!prospect) {
    h += `<div class="grid2"><div><h4 class="px">KEY RATINGS</h4>${keys.map(k => abar(k, true)).join('')}<h4 class="px">OTHER</h4>${others.filter(k => p.attrs[k] > 30 || ['spd', 'str', 'agi', 'awr'].includes(k)).map(k => abar(k)).join('')}</div>`;
    const hist = [...p.ovrHist, { y: G.year, o: p.ovr, cur: true }];
    h += `<div><h4 class="px">OVR HISTORY</h4><div class="ohist">${hist.map(x => `<div class="ob"><i class="${ovrCls(x.o)}" style="height:${clamp((x.o - 35) * 1.6, 4, 100)}%"></i><b>${x.o}</b><span>${String(x.y).slice(2)}${x.cur ? '*' : ''}</span></div>`).join('')}</div>
      <h4 class="px">INJURY HISTORY</h4>${p.injHist.length ? `<ul class="news small">${p.injHist.slice().reverse().slice(0, 10).map(i => `<li>${i.y} W${i.w}: ${esc(i.name)} (${i.weeks} wk)</li>`).join('')}</ul>` : '<p class="dim">Clean bill of health.</p>'}</div></div>`;
  } else {
    const sc = p.sc || 0;
    h += `<h4 class="px">SCOUTING REPORT · ${SCOUT_LABELS[sc].toUpperCase()}</h4>`;
    if (sc >= 2) h += keys.map(k => abar(k, true)).join('') + (sc < 3 ? '<p class="dim small">Detailed report: ratings are close but not exact.</p>' : '');
    else h += `<p class="dim">Scout this prospect to Detailed or better to see individual ratings.</p>`;
    if (sc < 3) h += `<button class="btn tiny" data-act="scout" data-id="${p.id}" ${G.scoutPts < scoutCost(p) ? 'disabled' : ''}>SCOUT (${scoutCost(p)} PT${scoutCost(p) > 1 ? 'S' : ''} · ${G.scoutPts} LEFT)</button>`;
    if (p.combine) h += `<h4 class="px">COMBINE</h4><p>40-yard: <b>${p.combine.forty}s</b> · Bench: <b>${p.combine.bench}</b> reps · Vertical: <b>${p.combine.vert}"</b></p>`;
    if (p.trend) h += `<p class="dim">College season trend: ${p.trend > 0 ? '<span class="good">rising +' + p.trend + '</span>' : '<span class="bad">falling ' + p.trend + '</span>'}</p>`;
  }
  // stats
  const groups = POS_COLS[p.pos];
  const rows = [...p.career.map(c => ({ lbl: c.year, tm: c.tm, s: c })), ...(p.stats.gp ? [{ lbl: G.year + '*', tm: t ? t.abbr : 'FA', s: p.stats }] : [])];
  if (rows.length) {
    const tot = emptyStats(); rows.forEach(r => addStats(tot, r.s));
    for (const gname of groups) {
      const cols = COLS[gname];
      h += `<h4 class="px">${gname.toUpperCase()} STATS</h4><div class="scroll"><table class="tbl"><tr><th>YEAR</th><th>TM</th><th>GP</th>${cols.map(c => `<th>${c[0]}</th>`).join('')}</tr>${rows.map(r => `<tr><td>${r.lbl}</td><td>${r.tm}</td><td>${st(r.s, 'gp')}</td>${cols.map(c => `<td>${cell(r.s, c)}</td>`).join('')}</tr>`).join('')}<tr class="tot"><td>CAREER</td><td></td><td>${tot.gp}</td>${cols.map(c => `<td>${cell(tot, c)}</td>`).join('')}</tr></table></div>`;
    }
    if (p.pstats.gp) h += `<p class="dim">${G.year} playoffs: ${esc(statLine(p, p.pstats))} in ${p.pstats.gp} game(s)</p>`;
  }
  openModal(h, true);
}

// Team view lives in ui_dev.js

function findGame(id) { return G.schedule.find(g => g.id === id) || (G.playoffs && G.playoffs.games.find(g => g.id === id)); }
function scoreboard(g, q, clk) {
  const qs = g.qs || [[], []]; const hasOT = (qs[0][4] || 0) + (qs[1][4] || 0) > 0 || g.ot;
  const row = (side) => { const tid = side === 0 ? g.home : g.away; return `<tr><td>${helm(tid, 24)} <b class="px">${TM(tid).abbr}</b></td>${[0, 1, 2, 3].map(i => `<td>${qs[side][i] || 0}</td>`).join('')}${hasOT ? `<td>${qs[side][4] || 0}</td>` : ''}<td class="px fin">${side === 0 ? g.hs : g.as}</td></tr>`; };
  return `<table class="sb"><tr><th></th><th>1</th><th>2</th><th>3</th><th>4</th>${hasOT ? '<th>OT</th>' : ''}<th>T</th></tr>${row(1)}${row(0)}</table>`;
}
function boxModal(id, tab) {
  const g = findGame(id); if (!g || !g.played) return;
  tab = tab || 'box';
  let h = `<div class="px small center">${g.round !== undefined ? ROUND_NAMES[g.round].toUpperCase() : 'WEEK ' + g.week} · FINAL${g.ot ? '/OT' : ''}</div>${scoreboard(g)}`;
  h += `<div class="filters center"><button class="chip ${tab === 'box' ? 'on' : ''}" data-act="boxTab" data-id="${g.id}" data-v="box">BOX SCORE</button><button class="chip ${tab === 'scoring' ? 'on' : ''}" data-act="boxTab" data-id="${g.id}" data-v="scoring">SCORING</button>${g.log ? `<button class="btn tiny" data-act="watch" data-id="${g.id}">&gt; WATCH REPLAY</button>` : ''}</div>`;
  if (tab === 'scoring') {
    h += `<table class="tbl">${(g.scoring || []).map(s => `<tr><td class="dim">${s.q > 4 ? 'OT' : 'Q' + s.q} ${fmtClock(s.clk)}</td><td>${helm(s.side === 0 ? g.home : g.away, 16)}</td><td>${esc(s.text)}</td><td>${s.as}-${s.hs}</td></tr>`).join('') || '<tr><td class="dim">No scoring.</td></tr>'}</table>`;
  } else {
    const tsum = (tid) => { let py = 0, ry = 0, to = 0; for (const pid in g.box) { const b = g.box[pid]; if (b.tid !== tid) continue; py += st(b, 'pYds'); ry += st(b, 'rYds'); to += st(b, 'pInt') + st(b, 'fum'); } return { py, ry, to }; };
    const ta = tsum(g.away), th = tsum(g.home);
    h += `<table class="tbl tstats"><tr><th></th><th>${TM(g.away).abbr}</th><th>${TM(g.home).abbr}</th></tr><tr><td>Total Yards</td><td>${ta.py + ta.ry}</td><td>${th.py + th.ry}</td></tr><tr><td>Passing</td><td>${ta.py}</td><td>${th.py}</td></tr><tr><td>Rushing</td><td>${ta.ry}</td><td>${th.ry}</td></tr><tr><td>First Downs</td><td>${g.tstat ? g.tstat[1].fd : '-'}</td><td>${g.tstat ? g.tstat[0].fd : '-'}</td></tr><tr><td>Turnovers</td><td>${ta.to}</td><td>${th.to}</td></tr></table>`;
    const sections = [['PASSING', 'pass', b => st(b, 'pAtt') > 0], ['RUSHING', 'rush', b => st(b, 'rAtt') > 0], ['RECEIVING', 'recv', b => st(b, 'tgt') > 0], ['DEFENSE', 'def', b => st(b, 'tkl') + st(b, 'sack') + st(b, 'dInt') + st(b, 'pd') > 0], ['KICKING', 'kick', b => st(b, 'fga') + st(b, 'xpa') > 0], ['PUNTING', 'punt', b => st(b, 'pnt') > 0]];
    h += `<div class="grid2">`;
    for (const tid of [g.away, g.home]) {
      let b = `<div class="px small">${helm(tid, 20)} ${TM(tid).abbr}</div>`;
      for (const [label, key, filt] of sections) {
        const rows = Object.entries(g.box).filter(([pid, x]) => x.tid === tid && filt(x)).map(([pid, x]) => [G.players[pid], x]).filter(r => r[0]);
        if (!rows.length) continue;
        const sortK = { pass: 'pAtt', rush: 'rYds', recv: 'reYds', def: 'tkl', kick: 'fga', punt: 'pnt' }[key];
        rows.sort((a, c) => st(c[1], sortK) - st(a[1], sortK));
        const cols = COLS[key];
        b += `<div class="dim small sect">${label}</div><table class="tbl small"><tr><th></th>${cols.map(c => `<th>${c[0]}</th>`).join('')}</tr>${rows.slice(0, key === 'def' ? 8 : 6).map(([p, x]) => `<tr><td>${pLink(p, true)}</td>${cols.map(c => `<td>${cell(x, c)}</td>`).join('')}</tr>`).join('')}</table>`;
      }
      h += `<div>${b}</div>`;
    }
    h += `</div>`;
  }
  openModal(h, true);
}
function fmtClock(s) { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }

// ---------- Game replay ----------
const RP = { g: null, i: 0, timer: null, raf: null, speed: 1, playing: false };
function watchGame(id) {
  const g = findGame(id); if (!g || !g.log) return;
  stopReplay();
  RP.g = g; RP.i = 0; RP.playing = true;
  const h = `<div class="px small center">${g.round !== undefined ? ROUND_NAMES[g.round].toUpperCase() : 'WEEK ' + g.week} · ${TM(g.away).abbr} @ ${TM(g.home).abbr}</div>
    <div id="rpScore" class="rp-score"></div>
    <canvas id="rpField" class="field" width="${Field.W}" height="${Field.H}"></canvas>
    <div id="rpText" class="rp-text px small">KICKOFF!</div>
    <div class="filters center"><button class="btn tiny" data-act="rpToggle" id="rpBtn">|| PAUSE</button>${[1, 2, 4, 8].map(s => `<button class="chip ${RP.speed === s ? 'on' : ''}" data-act="rpSpeed" data-v="${s}">${s}x</button>`).join('')}<button class="btn tiny alt" data-act="rpEnd">SKIP TO END</button><button class="btn tiny alt" data-act="box" data-id="${g.id}">BOX SCORE</button></div>
    <ul id="rpLog" class="rp-log"></ul>`;
  openModal(h, true);
  rpStep();
}
function stopReplay() { clearTimeout(RP.timer); cancelAnimationFrame(RP.raf); RP.playing = false; }
function rpScore(e) {
  const g = RP.g; const el = $('#rpScore'); if (!el) return;
  const dd = e && !['kick', 'xp', 'td', 'fg', 'score'].includes(e.type) ? `${ordinal(e.down)} & ${e.togo}` : '';
  const qn = e ? (e.q > 4 ? 'OT' : 'Q' + e.q) : 'Q1';
  el.innerHTML = `<div class="rs">${helm(g.away, 32)}<b class="px">${TM(g.away).abbr}</b><span class="px big">${e ? e.as : 0}</span></div><div class="rs mid"><div class="px">${qn} ${fmtClock(e ? e.clk : 900)}</div><div class="dim">${dd}</div></div><div class="rs"><span class="px big">${e ? e.hs : 0}</span><b class="px">${TM(g.home).abbr}</b>${helm(g.home, 32)}</div>`;
}
function rpStep() {
  const g = RP.g; if (!g || !$('#rpField')) return;
  if (RP.i >= g.log.length) { RP.playing = false; const b = $('#rpBtn'); if (b) b.textContent = '> REPLAY'; $('#rpText').textContent = `FINAL: ${TM(g.away).abbr} ${g.as} - ${TM(g.home).abbr} ${g.hs}${g.ot ? ' (OT)' : ''}`; return; }
  const e = g.log[RP.i++];
  const ctx = $('#rpField').getContext('2d');
  const dur = (['kick', 'punt', 'fg', 'miss'].includes(e.type) ? 900 : Math.abs(e.to - e.from) > 15 ? 800 : 500) / RP.speed;
  const t0 = performance.now();
  const home = TM(g.home), away = TM(g.away);
  const frame = (now) => {
    const t = clamp((now - t0) / dur, 0, 1);
    Field.frame(ctx, home, away, e, t);
    if (t < 1) RP.raf = requestAnimationFrame(frame);
  };
  RP.raf = requestAnimationFrame(frame);
  const prefix = e.q > 4 ? 'OT' : 'Q' + e.q;
  const tx = $('#rpText'); tx.textContent = e.text; tx.className = 'rp-text px small ' + (e.type === 'td' || e.type === 'fg' ? 'score' : e.type === 'to' ? 'turn' : '');
  const li = document.createElement('li'); li.className = e.type; li.innerHTML = `<span class="dim">${prefix} ${fmtClock(e.clk)}</span> ${helm(e.side === 0 ? g.home : g.away, 14)} ${esc(e.text)}`;
  const logEl = $('#rpLog'); logEl.insertBefore(li, logEl.firstChild);
  rpScore(e);
  if (RP.playing) RP.timer = setTimeout(rpStep, dur + (e.type === 'td' ? 900 : 250) / RP.speed);
}

// ---------- Actions ----------
function afterUserGame(week) {
  const g = allUserGames().find(x => x.played && (week === undefined ? true : x.week === week));
  return g;
}
function doPlayWeek() {
  const u = TM(G.userTeam);
  if (!G.autoRoster && activeRoster(G, u).length > ROSTER_LIMIT) return toast(`Active roster is over ${ROSTER_LIMIT}. Cut players first.`);
  const wk = G.week;
  simWeek(G);
  persist();
  const g = G.schedule.find(x => x.week === wk && (x.home === G.userTeam || x.away === G.userTeam));
  render();
  if (!g) toast(`Week ${wk}: bye week.`);
  else if (UI.watch) watchGame(g.id);
  else toast(`Week ${wk}: ${stripTags(resultStr(g, G.userTeam))}`);
  if (G.scoutStop) { UI.tab = 'scouting'; render(); if (!UI.watch || !g) toast(`${G.scoutStop.name}: check in with your scouts before continuing.`); }
  else if (G.phase === 'awards') { UI.tab = 'awards'; render(); toast('Regular season complete! Awards announced.'); }
}
function stripTags(s) { return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(); }

function onClick(e) {
  const el = e.target.closest('[data-act]'); if (!el) { if (e.target.id === 'modal') closeModal(); return; }
  if (el.disabled) return;
  const act = el.dataset.act, id = el.dataset.id, v = el.dataset.v;
  if (onBizClick(act, el)) return;
  if (onDevClick(act, el)) return;
  switch (act) {
    case 'namesEdit': UI.editNames = true; render(); break;
    case 'namesDone': UI.editNames = false; render(); break;
    case 'namesReset': UI.names = null; try { localStorage.removeItem(NAMES_KEY); } catch (e) { /* ignore */ } render(); break;
    case 'newgame': G = newLeague(+id, startNames()); UI.tab = 'home'; persist(); render(); toast(`You are the GM of the ${teamName(G, +id)}!`); break;
    case 'continue': G = loadLeague(); if (!G) { toast('Save could not be loaded.'); render(); } else render(); break;
    case 'quit': if (confirm('Start a new game? Your current save will be overwritten when you pick a team.')) { G = null; closeModal(); render(); } break;
    case 'save': persist(); toast('Game saved.'); break;
    case 'tab': UI.tab = el.dataset.tab; closeModal(); render(); window.scrollTo(0, 0); break;
    case 'playWeek': doPlayWeek(); break;
    case 'simSeason': {
      while (G.phase === 'regular' && !G.scoutStop) simWeek(G);
      persist();
      if (G.scoutStop) { UI.tab = 'scouting'; render(); toast(`${G.scoutStop.name}: check in with your scouts before continuing.`); }
      else { UI.tab = 'awards'; render(); toast('Regular season complete! Awards announced.'); }
      break;
    }
    case 'startPlayoffs': startPlayoffs(G); persist(); UI.tab = 'playoffs'; render(); break;
    case 'playRound': {
      const r = G.playoffs.round; simPlayoffRound(G); persist(); UI.tab = 'playoffs'; render();
      const g = G.playoffs.games.find(x => x.round === r && (x.home === G.userTeam || x.away === G.userTeam));
      if (g && UI.watch) watchGame(g.id);
      break;
    }
    case 'simPlayoffs': while (G.phase === 'playoffs') simPlayoffRound(G); persist(); UI.tab = 'playoffs'; render(); break;
    case 'offseason': runOffseason(G); persist(); UI.tab = 'draft'; render(); toast('Players aged and developed. Draft time!'); break;
    case 'draftToMe': simDraftToUser(G); persist(); render(); break;
    case 'draftOne': if (!draftDone(G)) aiDraftPick(G); render(); break;
    case 'draftPick': draftPlayer(G, +id); simDraftToUser(G); persist(); render(); break;
    case 'draftAuto': { const r = recommendProspects(G, TM(G.userTeam), 1)[0]; if (r) draftPlayer(G, r.p.id); else aiDraftPick(G); } simDraftToUser(G); persist(); render(); break;
    case 'finishDraft': { const yr = G.draft.year; finishDraft(G); persist(); UI.tab = 'roster'; render(); draftReviewModal(yr); break; }
    case 'autoCut': { const t = TM(G.userTeam); cutToLimit(G, t, true); persist(); render(); toast(`Roster trimmed to ${activeRoster(G, t).length}.`); break; }
    case 'autoFill': { const t = TM(G.userTeam); aiFillRoster(G, t); persist(); render(); toast(`Roster filled to ${activeRoster(G, t).length}.`); break; }
    case 'startSeason': { const err = startSeason(G); if (err) toast(err); else { persist(); UI.tab = 'home'; UI.schedWeek = null; render(); } break; }
    case 'player': playerModal(+id); break;
    case 'team': teamModal(+id, v); break;
    case 'box': stopReplay(); boxModal(id); break;
    case 'boxTab': boxModal(id, v); break;
    case 'watch': watchGame(id); break;
    case 'close': closeModal(); break;
    case 'cut': {
      const p = G.players[+id]; if (!p || p.tid !== G.userTeam) break;
      releasePlayer(G, p); persist(); render();
      if (!$('#modal').classList.contains('hidden')) closeModal();
      toast(`Released ${fullName(p)}. Re-sign from Free Agents if you change your mind.`); break;
    }
    case 'sign': {
      const p = G.players[+id]; const t = TM(G.userTeam);
      if (activeRoster(G, t).length >= ROSTER_LIMIT) { toast('Roster is full.'); break; }
      signPlayer(G, t, p); persist(); render(); if (!$('#modal').classList.contains('hidden')) closeModal(); toast(`Signed ${fullName(p)}.`); break;
    }
    case 'scoutDone': finishScouting(G); persist(); render(); toast(G.phase === 'draft' ? 'The draft is open!' : 'Back to the season.'); break;
    case 'scout': if (scoutProspect(G, +id)) { persist(); render(); if (!$('#modal').classList.contains('hidden')) playerModal(+id); } else toast('Not enough scouting points.'); break;
    case 'autoScout': { const n = autoScout(G); persist(); render(); toast(n ? `Scouts filed ${n} new report(s).` : 'No points to spend.'); break; }
    case 'scpos': UI.scPos = v; render(); break;
    case 'tradeToggle': {
      const arr = UI.tr[el.dataset.side]; const i = arr.indexOf(el.dataset.k);
      if (i >= 0) arr.splice(i, 1); else arr.push(el.dataset.k);
      UI.tr.msg = null; render(); break;
    }
    case 'tradeClear': UI.tr.mine = []; UI.tr.theirs = []; UI.tr.msg = null; render(); break;
    case 'tradeBalance': {
      if (!UI.tr.theirs.length) { toast('Pick something you want from them first.'); break; }
      const b = balanceTrade(G, UI.tr.partner, UI.tr.mine, UI.tr.theirs);
      UI.tr.mine = b.keys; UI.tr.msg = b.ev.accept ? `${TM(UI.tr.partner).abbr}: "That works for us."` : `${TM(UI.tr.partner).abbr}: "Even that isn't enough."`; render(); break;
    }
    case 'tradePropose': {
      const why = canTrade(G); if (why) { toast(why); break; }
      const ev = evaluateTrade(G, UI.tr.partner, UI.tr.mine, UI.tr.theirs);
      if (!ev.accept) { UI.tr.msg = ev.msg; render(); break; }
      executeTrade(G, UI.tr.partner, UI.tr.mine, UI.tr.theirs);
      UI.tr.mine = []; UI.tr.theirs = []; UI.tr.msg = 'Trade complete!'; persist(); render(); toast('Trade complete!'); break;
    }
    case 'rpos': UI.rPos = v; render(); break;
    case 'fapos': UI.faPos = v; render(); break;
    case 'dpos': UI.dPos = v; render(); break;
    case 'rsort': if (UI.rSort === el.dataset.k) UI.rDir *= -1; else { UI.rSort = el.dataset.k; UI.rDir = ['name', 'pos', 'num'].includes(el.dataset.k) ? 1 : -1; } render(); break;
    case 'leadMode': UI.leadMode = v; render(); break;
    case 'injAll': UI.injAll = v === '1'; render(); break;
    case 'newsAll': UI.newsAll = !UI.newsAll; render(); break;
    case 'rpToggle': if (RP.playing) { stopReplay(); el.textContent = '> PLAY'; } else { if (RP.i >= RP.g.log.length) { RP.i = 0; $('#rpLog').innerHTML = ''; } RP.playing = true; el.textContent = '|| PAUSE'; rpStep(); } break;
    case 'rpSpeed': RP.speed = +v; document.querySelectorAll('[data-act="rpSpeed"]').forEach(b => b.classList.toggle('on', b.dataset.v === v)); break;
    case 'rpEnd': { stopReplay(); const g = RP.g; const logEl = $('#rpLog'); logEl.innerHTML = ''; RP.i = g.log.length; const last = g.log[g.log.length - 1]; rpScore(last); Field.frame($('#rpField').getContext('2d'), TM(g.home), TM(g.away), null, 0); g.log.slice().reverse().slice(0, 60).forEach(x => { const li = document.createElement('li'); li.className = x.type; li.innerHTML = `<span class="dim">${x.q > 4 ? 'OT' : 'Q' + x.q} ${fmtClock(x.clk)}</span> ${esc(x.text)}`; logEl.appendChild(li); }); $('#rpText').textContent = `FINAL: ${TM(g.away).abbr} ${g.as} - ${TM(g.home).abbr} ${g.hs}`; $('#rpBtn').textContent = '> REPLAY'; break; }
  }
}
function onChange(e) {
  const el = e.target; const k = el.dataset.change; if (!k) return;
  if (onDevChange(k, el)) return;
  if (k === 'watch') UI.watch = el.checked;
  else if (k === 'autoRoster') { G.autoRoster = el.checked; persist(); }
  else if (k === 'schedWeek') { UI.schedWeek = +el.value; render(); }
  else if (k === 'awYear') { UI.awYear = +el.value; render(); }
  else if (k === 'histYear') { UI.histYear = +el.value; render(); }
  else if (k === 'tname') { setStartName(+el.dataset.i, el.dataset.f, el.value); render(); }
  else if (k === 'tradePartner') { UI.tr.partner = +el.value; UI.tr.theirs = []; UI.tr.msg = null; render(); }
}
document.addEventListener('click', onClick);
document.addEventListener('change', onChange);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
window.addEventListener('load', () => { render(); if (document.fonts) document.fonts.ready.then(() => { if (G && UI.tab === 'home') drawBanner(); }); });
