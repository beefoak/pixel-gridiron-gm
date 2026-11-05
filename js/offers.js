'use strict';
// ================= AI trade offers =================
// Rival front offices sometimes call you: in the weeks before the trade deadline, and when you're on the
// clock in the draft. Offers are built with the same valuation as the TRADE tab, so a team only offers
// what it would actually accept. The package can be picks, players, or a mix.
const OFFER_MAX_PER_SEASON = 3;
const OFFER_WEEK_CHANCE = (w) => w < 3 ? 0 : 0.1 + (w - 3) * 0.035; // ramps up toward the deadline
const OFFER_DRAFT_CHANCE = 0.35;
const OFFER_KINDS = ['picks', 'players', 'mix'];

function offerId(L) { L.offerSeq = (L.offerSeq || 0) + 1; return L.offerSeq; }

// Is this AI team buying (contending) or selling (rebuilding)?
function offerMode(L, tid, proj) { return proj.slot[tid] >= 17 ? 'buy' : 'sell'; }

// What the AI wants from you.
function pickOfferTarget(L, tid, needs, recvAll, mode, ctx) {
  if (ctx.want) return recvAll.find(a => a.key === ctx.want) || null;
  const cands = [];
  for (const a of recvAll) {
    if (a.type === 'player') {
      const p = a.p, nd = needs[p.pos];
      if (p.injury && p.injury.weeks >= 3) continue;
      if (p.pos === 'K' || p.pos === 'P') continue;
      if (nd.need < 3.5 || p.ovr <= nd.worstStarter) continue; // only players who'd start at a position they need
      if (mode === 'sell' && p.age > 26) continue;               // rebuilders only chase young players
      cands.push({ a, w: a.pts * (1 + nd.need / 10) });
    } else if (mode === 'sell' && a.rd <= 3 && a.near) cands.push({ a, w: a.pts * 0.8 }); // rebuilders want picks
  }
  if (!cands.length) return null;
  cands.sort((x, y) => y.w - x.w);
  const top = cands.slice(0, 6);
  return R.weighted(top, c => c.w).a;
}

// Fill the AI's side of the deal up to (but under) what it is willing to pay.
function buildOfferPackage(L, tid, target, giveAll, needs, kind, mustGive) {
  const r = target.pts - (target.type === 'player' ? 3 : 0); // a player costs them a roster spot
  const maxG = (r - 2) / 1.08;
  if (maxG < 6) return null;
  const budget = maxG * R.rand(0.82, 0.98);
  const okPlayer = (a) => {
    if (a.type !== 'player' || a.pts < 4) return false;
    const p = a.p;
    if (p.pos === 'K' || p.pos === 'P') return false;
    if (p.injury && p.injury.weeks >= 3) return false;
    if (a.starts && needs[p.pos].need >= 5) return false; // won't open a hole where they're already thin
    if (target.type === 'player' && p.pos === target.p.pos && a.starts) return false;
    return true;
  };
  const okPick = (a) => a.type === 'pick' && a.pts >= 2;
  const give = []; let tot = 0;
  if (mustGive) { if (mustGive.pts > budget) return null; give.push(mustGive); tot += mustGive.pts; }
  const take = (list, max) => {
    for (const a of list) {
      if (give.length >= 4 || max <= 0) break;
      if (give.includes(a) || tot + a.pts > budget) continue;
      give.push(a); tot += a.pts; max--;
    }
  };
  const byPts = (f) => giveAll.filter(f).sort((a, b) => b.pts - a.pts);
  if (kind === 'picks') take(byPts(okPick), 3);
  else if (kind === 'players') take(byPts(okPlayer), 2);
  else {
    // mix: one player worth up to ~70% of the budget, then picks to top it up
    const pl = byPts(okPlayer).find(a => !give.includes(a) && tot + a.pts <= budget * 0.7);
    if (pl) { give.push(pl); tot += pl.pts; }
    take(byPts(okPick), 2);
    if (!give.some(a => a.type === 'player')) take(byPts(okPlayer), 1);
  }
  const types = new Set(give.map(a => a.type));
  if (kind === 'mix' && types.size < 2) return null;
  if (kind === 'players' && !types.has('player')) return null;
  if (kind === 'picks' && !types.has('pick')) return null;
  if (!give.length || tot < maxG * 0.6) return null;
  return give;
}

// ctx: { type: 'deadline' | 'draft', want?: key, teams?: [tid], mustGive?: (giveAll) => asset }
function makeOffer(L, ctx) {
  const proj = projectDraftOrder(L);
  const teams = R.shuffle((ctx.teams || L.teams.map(t => t.id)).filter(t => t !== L.userTeam));
  for (const tid of teams.slice(0, 10)) {
    const needs = teamNeeds(L, L.teams[tid]);
    const mode = offerMode(L, tid, proj);
    const recvAll = teamAssets(L, L.userTeam, tid, proj, needs);
    const giveAll = teamAssets(L, tid, tid, proj, needs);
    const target = pickOfferTarget(L, tid, needs, recvAll, mode, ctx);
    if (!target) continue;
    for (const kind of R.shuffle(OFFER_KINDS.slice())) {
      const must = ctx.mustGive && kind !== 'players' ? ctx.mustGive(giveAll, tid) : null;
      if (ctx.mustGive && kind !== 'players' && !must) continue;
      const give = buildOfferPackage(L, tid, target, giveAll, needs, kind, must);
      if (!give) continue;
      const want = [target.key], gk = give.map(a => a.key);
      const ev = evaluateTrade(L, tid, want, gk);
      if (!ev.accept) continue;
      return { id: offerId(L), tid, want, give: gk, kind, ctx: ctx.type, year: L.year, week: L.week, mode, why: offerPitch(L, tid, target, mode, ctx), wantLbl: [target.label], giveLbl: give.map(a => a.label) };
    }
  }
  return null;
}
function offerPitch(L, tid, target, mode, ctx) {
  const t = L.teams[tid];
  if (ctx.type === 'draft') return `${t.abbr} want to move up and take their guy at #${target.ovr}.`;
  if (target.type === 'pick') return `${t.abbr} are retooling and want to stock up on picks.`;
  return mode === 'buy' ? `${t.abbr} are making a playoff push and need a ${target.p.pos}.` : `${t.abbr} see ${target.p.ln} as part of their future.`;
}
function addOffer(L, o) { L.offers = L.offers || []; L.offers.push(o); L.newOffers = (L.newOffers || 0) + 1; news(L, `TRADE OFFER: ${L.teams[o.tid].abbr} want ${o.wantLbl.join(', ')} for ${o.giveLbl.join(', ')}.`, L.userTeam); }

// Called after each regular-season week.
function maybeDeadlineOffer(L) {
  L.offers = (L.offers || []).filter(o => o.ctx !== 'deadline' || (L.phase === 'regular' && L.week <= o.exp));
  if (L.phase !== 'regular' || L.week > TRADE_DEADLINE_WEEK) return;
  L.offerCount = L.offerCount || {};
  if ((L.offerCount[L.year] || 0) >= OFFER_MAX_PER_SEASON || L.offers.length >= 2) return;
  if (!R.chance(OFFER_WEEK_CHANCE(L.week))) return;
  const o = makeOffer(L, { type: 'deadline' });
  if (!o) return;
  o.exp = Math.min(TRADE_DEADLINE_WEEK, L.week + 1); // open for this week and next, never past the deadline
  L.offerCount[L.year] = (L.offerCount[L.year] || 0) + 1;
  addOffer(L, o);
}
// Called whenever your pick comes up in the draft (once per pick).
function maybeDraftOffer(L) {
  const D = L.draft; if (!D || draftDone(L)) return;
  L.offers = (L.offers || []).filter(o => o.ctx !== 'draft' || o.exp === D.picks[D.cur].ovr);
  const pk = D.picks[D.cur];
  if (pk.tid !== L.userTeam) return;
  D.offered = D.offered || {};
  if (D.offered[pk.ovr]) return;
  D.offered[pk.ovr] = true;
  if (!R.chance(OFFER_DRAFT_CHANCE * (pk.rd <= 2 ? 1 : 0.5))) return;
  const later = D.picks.slice(D.cur + 1, D.cur + 1 + 40).filter(p => p.tid !== L.userTeam).map(p => p.tid);
  const o = makeOffer(L, {
    type: 'draft', want: 'c' + pk.ovr, teams: [...new Set(later)],
    // trading up: their next pick in this draft goes in the deal
    mustGive: (giveAll) => giveAll.filter(a => a.cur).sort((a, b) => a.ovr - b.ovr)[0] || null,
  });
  if (!o) return;
  o.exp = pk.ovr;
  addOffer(L, o);
}

// Re-check an offer against the current rosters, picks and cap.
function offerStatus(L, o) {
  if (o.ctx === 'deadline' && (L.phase !== 'regular' || L.week > TRADE_DEADLINE_WEEK)) return 'The trade deadline has passed.';
  if (o.ctx === 'deadline' && L.week > o.exp) return 'The offer has expired.';
  if (o.ctx === 'draft' && (!L.draft || draftDone(L) || L.draft.picks[L.draft.cur].ovr !== o.exp)) return 'That pick has already been made.';
  const ev = evaluateTrade(L, o.tid, o.want, o.give);
  if (ev.recv.length !== o.want.length || ev.give.length !== o.give.length) return 'Some of those assets have moved.';
  if (!ev.accept) return `${L.teams[o.tid].abbr} have pulled the offer.`;
  return null;
}
function liveOffers(L) {
  L.offers = (L.offers || []).filter(o => !offerStatus(L, o));
  return L.offers;
}
function acceptOffer(L, id) {
  const o = (L.offers || []).find(x => x.id === id); if (!o) return 'Offer not found.';
  const bad = offerStatus(L, o); if (bad) { L.offers = L.offers.filter(x => x !== o); return bad; }
  executeTrade(L, o.tid, o.want, o.give);
  L.offers = L.offers.filter(x => x !== o);
  return null;
}
function declineOffer(L, id) {
  const o = (L.offers || []).find(x => x.id === id); if (!o) return;
  L.offers = L.offers.filter(x => x !== o);
  news(L, `You turned down ${L.teams[o.tid].abbr}'s trade offer.`, L.userTeam);
}

// ---------- UI ----------
function offerAssetHtml(L, key, owner) {
  if (key[0] === 'p') {
    const p = L.players[+key.slice(1)]; if (!p) return '<li class="dim">(gone)</li>';
    return `<li>${p.pos} ${pLink(p)} ${ovrB(p.ovr)} ${potB(p.pot, p.gen)} <span class="dim small">age ${p.age}${p.contract ? ' · ' + esc(contractStr(L, p)) : ''}</span></li>`;
  }
  if (key[0] === 'c') { const pk = L.draft && L.draft.picks.find(x => x.ovr === +key.slice(1)); return `<li><b>${L.draft ? L.draft.year : ''} R${pk ? pk.rd : '?'} #${key.slice(1)}</b> <span class="dim small">(this draft)</span></li>`; }
  const [y, rd, orig] = key.slice(1).split('_').map(Number);
  const proj = projectDraftOrder(L);
  return `<li><b>${y} R${rd}</b> <span class="dim small">${L.teams[orig].abbr} pick${y === L.year + 1 || (L.phase === 'draft' && y === L.year) ? ` · projects #${(rd - 1) * 32 + proj.slot[orig]}` : ''}</span></li>`;
}
function offerCardHtml(L, o) {
  const t = L.teams[o.tid];
  const left = o.exp - L.week + 1;
  const until = o.ctx === 'draft' ? 'Expires when you make this pick.' : left > 1 ? `Open for ${left} weeks.` : o.exp === TRADE_DEADLINE_WEEK ? 'Expires at the trade deadline (this week).' : 'Expires after this week.';
  return `<div class="offer-card"><div class="offer-head">${helm(o.tid, 32)} <b class="px small">${esc(t.city)} ${esc(t.name)}</b> <span class="dim small">${recStr(t.rec)}</span></div>
    <p class="small">"${esc(o.why)}" <span class="dim">${until}</span></p>
    <div class="grid2"><div><div class="px small bad">YOU GIVE</div><ul class="dl">${o.want.map(k => offerAssetHtml(L, k)).join('')}</ul></div>
    <div><div class="px small good">YOU GET</div><ul class="dl">${o.give.map(k => offerAssetHtml(L, k)).join('')}</ul></div></div>
    <div class="pact"><button class="btn tiny" data-act="offerAccept" data-id="${o.id}">ACCEPT</button><button class="btn tiny alt" data-act="offerCounter" data-id="${o.id}">COUNTER IN TRADE TAB</button><button class="btn tiny danger" data-act="offerDecline" data-id="${o.id}">DECLINE</button></div></div>`;
}
function openOffersModal() {
  const offers = liveOffers(G);
  if (!offers.length) { closeModal(); render(); return; }
  openModal(`<h3 class="px">TRADE OFFER${offers.length > 1 ? 'S' : ''}</h3>${offers.map(o => offerCardHtml(G, o)).join('')}`, true);
}
function offersPanel() {
  const offers = liveOffers(G);
  return offers.length ? panel(`OFFERS ON THE TABLE (${offers.length})`, offers.map(o => offerCardHtml(G, o)).join('')) : '';
}
function offersButton() {
  const n = G && G.offers ? G.offers.length : 0;
  return n ? `<button class="btn tiny gold-btn" data-act="offers">⇄ OFFERS (${n})</button>` : '';
}
function onOfferClick(act, el) {
  const id = +el.dataset.id;
  switch (act) {
    case 'offers': openOffersModal(); return true;
    case 'offerAccept': {
      const o = G.offers.find(x => x.id === id); const t = o ? TM(o.tid).abbr : '';
      const err = acceptOffer(G, id);
      if (err) { toast(err); openOffersModal(); persist(); return true; }
      if (G.phase === 'draft') simDraftToUser(G);
      persist(); closeModal(); render();
      const over = G.phase === 'regular' && activeRoster(G, TM(G.userTeam)).length > ROSTER_LIMIT;
      toast(`Trade with ${t} complete!${over ? ` You're over ${ROSTER_LIMIT} players, so release someone before the next game.` : ''}`);
      if (G.newOffers) { G.newOffers = 0; openOffersModal(); }
      return true;
    }
    case 'offerDecline': declineOffer(G, id); persist(); if ((G.offers || []).length) openOffersModal(); else closeModal(); render(); return true;
    case 'offerCounter': {
      const o = G.offers.find(x => x.id === id); if (!o) return true;
      UI.tr.partner = o.tid; UI.tr.mine = o.want.slice(); UI.tr.theirs = o.give.slice(); UI.tr.msg = `${TM(o.tid).abbr}'s offer is loaded. Adjust it and propose your own version.`;
      UI.tab = 'trade'; closeModal(); render(); window.scrollTo(0, 0); return true;
    }
  }
  return false;
}
// After an action that may have produced offers (a week played, a draft pick), show them.
function showNewOffers() {
  if (!G || !G.newOffers) return;
  G.newOffers = 0;
  if ($('#modal').classList.contains('hidden') && liveOffers(G).length) openOffersModal();
  else render(); // modal busy (e.g. watching a game): the header button shows the count
}
