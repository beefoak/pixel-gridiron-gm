'use strict';
// ================= Searchable game guide =================
// [id, category, title, keywords, html body]
const HELP = [
  // ---------- Getting started ----------
  ['start', 'Getting started', 'Your first season in 2 minutes', 'new game begin how to play basics quick start',
   `<ol><li>Pick a team on the start screen (rename teams first with <b>CUSTOMIZE TEAM NAMES</b> if you like).</li>
   <li>The season starts at Week 1. Press <b>&gt; PLAY WEEK</b> in the header to play one game, or <b>»» SIM TO PLAYOFFS</b> to fast-forward.</li>
   <li>Scouts will stop you a few times a season. Spend your points on the <b>SCOUTING</b> tab (or press <b>AUTO-SCOUT</b>), then <b>DONE SCOUTING</b>.</li>
   <li>After Week 18 the awards are handed out, then the playoffs. After the Megacup press <b>BEGIN OFFSEASON</b>.</li>
   <li>The offseason runs re-signing, free agency, the Combine and the draft. Follow the big yellow button in the header each step.</li></ol>
   <p>The <b>yellow button in the header always moves the game forward</b>. Everything else is optional management.</p>`],
  ['flow', 'Getting started', 'How a year flows (every phase in order)', 'phases order calendar season offseason timeline cycle year',
   `<ol><li><b>Regular season</b>: 18 weeks, 17 games and one bye. Scouting check-ins stop the sim after weeks 4, 9 and 14. Trade deadline after week 9.</li>
   <li><b>Awards</b>: MVP, Player of the Year, rookies, All-Pro and more, announced before the playoffs.</li>
   <li><b>Playoffs</b>: 7 teams per conference. Wild Card, Divisional, Conference Championship, then the <b>Megacup</b>.</li>
   <li><b>Begin offseason</b>: players age, develop or decline, some retire, and the draft order is set.</li>
   <li><b>Re-signing</b>: re-sign your expiring contracts (Contracts tab), or let your staff do it.</li>
   <li><b>Free agency</b>: 3 waves of signings. Shop the Free Agents tab between waves.</li>
   <li><b>Scouting Combine</b>: a big batch of scouting points and 40-yard / bench / vertical results.</li>
   <li><b>Draft</b>: 7 rounds. You pick when you're on the clock; everyone else picks automatically.</li>
   <li><b>Preseason</b>: get to 53 active players and under the cap, then <b>START SEASON</b>.</li></ol>`],
  ['header', 'Getting started', 'The header, saving and settings', 'save load autosave new game watch games header buttons menu',
   `<p>The header shows your record, the current phase and your cap space. The buttons on the right are the actions for the current phase.</p>
   <ul><li><b>Watch my games</b>: plays a pixel replay of your game after each week.</li>
   <li><b>Auto-manage injuries</b>: your staff signs fill-ins and trims the roster when injuries pile up (see Injuries).</li>
   <li><b>SAVE</b>: the game also saves automatically after every action, in this browser only.</li>
   <li><b>NEW GAME</b>: returns to the start screen. Your save is overwritten only when you pick a new team.</li></ul>`],
  ['tabs', 'Getting started', 'What every tab is for', 'tabs navigation menu screens pages where',
   `<table class="tbl"><tr><td><b>HOME</b></td><td>Your team, this week's game, top stories and news.</td></tr>
   <tr><td><b>ROSTER</b></td><td>Your players, contracts and cut buttons.</td></tr><tr><td><b>DEPTH</b></td><td>Set who starts.</td></tr>
   <tr><td><b>TRAINING</b></td><td>Weekly focus training.</td></tr><tr><td><b>SCHEDULE / STANDINGS / PLAYOFFS</b></td><td>Games, box scores and the playoff picture.</td></tr>
   <tr><td><b>LEADERS</b></td><td>Player stat leaders, plus a TEAM STATS table.</td></tr><tr><td><b>INJURIES</b></td><td>Who's hurt and for how long.</td></tr>
   <tr><td><b>NEWS</b></td><td>Storylines: records, returns, rivalries, signings.</td></tr><tr><td><b>FREE AGENTS</b></td><td>Unsigned players you can negotiate with.</td></tr>
   <tr><td><b>TRADE</b></td><td>Build and propose trades.</td></tr><tr><td><b>CONTRACTS</b></td><td>Cap, re-signing, extensions, restructures, cuts.</td></tr>
   <tr><td><b>SCOUTING / DRAFT</b></td><td>The next draft class, and the draft itself.</td></tr><tr><td><b>AWARDS / HISTORY / RECORDS</b></td><td>Past seasons, honors and the record book.</td></tr></table>
   <p>Click any player name for their card, or any team for its stats, roster and history.</p>`],

  // ---------- Season ----------
  ['playing', 'Season', 'Playing and simming games', 'play week sim season replay box score watch',
   `<p><b>&gt; PLAY WEEK</b> plays one week for the whole league. <b>»» SIM TO PLAYOFFS</b> plays every remaining week but still stops for scouting check-ins.</p>
   <p>Every play is simulated. Open any played game from the Schedule tab for its box score, scoring summary and (for your games) a play-by-play replay.</p>`],
  ['standings', 'Season', 'Standings, tiebreakers and playoff seeding', 'standings seeding playoffs wild card bye division conference tiebreaker',
   `<p>There are two conferences (American and National), each with four divisions (North, South, East, West).</p>
   <p>Each conference sends 7 teams: the 4 division winners (seeds 1-4, by record) and 3 wild cards (seeds 5-7). The <b>1 seed gets a bye</b> through the Wild Card round. Higher seeds host. Ties are broken by head-to-head, division record, conference record, then point differential.</p>`],
  ['schedule', 'Season', 'How the schedule is made', 'schedule opponents strength next year rotation',
   `<p>Each team plays its division twice, one full division from its own conference and one from the other (rotating each year), plus extra games against teams that finished in the <b>same place</b> in their divisions last year. A good season means a tougher schedule next year.</p>`],
  ['awards', 'Season', 'Awards and honors', 'awards mvp opoy dpoy rookie all-pro hall of fame',
   `<p>Awards are announced after Week 18, before the playoffs: MVP, Offensive and Defensive Player of the Year, Offensive and Defensive Rookie of the Year, and All-Pro teams. The Megacup also crowns an MVP. Great careers can end in the Hall of Fame (History tab).</p>`],
  ['injuries', 'Season', 'Injuries, illness and IR', 'injury injured hurt illness sick ir injured reserve return fill-in',
   `<p>Players can get hurt in games or fall ill during the week. Each injury has a set number of weeks. Anything 4 weeks or longer moves the player to <b>IR</b>, which frees his active-roster spot.</p>
   <p>Serious injuries (torn ACL or Achilles, for example) can permanently cost speed or agility. Hurt players are skipped on game day; if a position runs dry, a player from a similar position fills in.</p>
   <p>With <b>Auto-manage injuries</b> on, your staff signs fill-in free agents when you're short and trims the roster when players return. Turn it off to do it yourself.</p>`],
  ['depth', 'Season', 'Depth chart', 'depth chart starters lineup order bench who starts',
   `<p>The DEPTH tab shows every position in order. Use the arrows (top / up / down) to change it at any time. Starters are highlighted.</p>
   <p>Positions you never touch stay on <b>AUTO</b> (best OVR starts). Once you change one it's <b>MANUAL</b>; new arrivals slot in by OVR. Press <b>AUTO</b> on a position, or <b>RESET ALL TO AUTO</b>, to undo. Injured players are skipped automatically.</p>`],
  ['training', 'Season', 'Weekly focus training', 'training practice improve develop focus slots auto',
   `<p>Each week after your game, up to 3 players get focus training. Pick a player and either one rating or <b>Balanced</b>. Gains build up over weeks and add rating points.</p>
   <p>Young players with lots of room below their potential grow fastest (GROWTH: HIGH). Veterans past their peak barely move. Any slot left on <b>AUTO</b>, or whose player is hurt, is filled by your staff's best pick, so you never have to touch it. AI teams train too.</p>`],
  ['news', 'Season', 'News and storylines', 'news stories storylines headlines rivalry record chase',
   `<p>The NEWS tab collects storylines: records broken or under threat, milestones, players returning from injury, streaks, rivalry games, big signings and trades. Filter by type at the top.</p>`],

  // ---------- Players ----------
  ['ratings', 'Players', 'Ratings, OVR and potential', 'ovr overall potential pot grade ratings attributes rating colors',
   `<p>Every player has 17 ratings (speed, strength, throw accuracy, coverage...). <b>OVR</b> is a weighted mix of the ratings that matter for his position. <b>POT</b> is his likely ceiling, shown as a grade from F to A+.</p>
   <p>Players improve toward their potential while young, peak in their mid-to-late 20s (QBs and kickers later), then decline. Breakouts and bad offseasons happen.</p>`],
  ['generational', 'Players', 'Generational "S" talents', 's potential generational rare superstar elite prospect',
   `<p>About one draft class in three has a <b>generational</b> prospect with an <span class="pot pot-s">S</span> potential grade. They come into the league around 80-86 OVR, peak for longer, decline at half the normal rate and play well into their 30s. Everyone knows who they are; they're usually gone in the first few picks.</p>`],
  ['editor', 'Players', 'Editing players', 'edit player change ratings name bio cheat customize',
   `<p>Open any player's card and press <b>EDIT PLAYER</b> to change his ratings, potential, name, college, position, number, age, height, weight or injury length. OVR recalculates when you save.</p>`],

  // ---------- Contracts & cap ----------
  ['cap', 'Contracts & cap', 'The salary cap', 'salary cap payroll space over the cap money budget',
   `<p>The cap starts at <b>$220M</b> and rises every year (usually 3-10%) as league payrolls rise. Your payroll is every active contract plus dead money.</p>
   <p>You can't start a season over the cap. If you are, release or trade players. Check the CONTRACTS tab for your space, future commitments and every team's payroll.</p>`],
  ['negotiate', 'Contracts & cap', 'Negotiating a contract', 'negotiate offer contract asking salary years accept reject chance odds',
   `<p>Click <b>NEGOTIATE</b>, <b>RE-SIGN</b>, <b>EXTEND</b> or <b>RESTRUCTURE</b> next to a player. Set a salary and length and press <b>MAKE OFFER</b>.</p>
   <p>The window shows <b>CHANCE HE SAYS YES</b>, updated as you type. Salary matters most, then length. Lowballs make him dig in, and <b>after 4 failed offers he stops talking</b>.</p>
   <p>Presets: <b>Budget</b> (cheapest plausible, risky), <b>Team friendly</b> (length that favors you: long deals for rising young players, 1 year for declining vets) and <b>Player friendly</b> (what he asked for, almost always accepted).</p>`],
  ['vets', 'Contracts & cap', 'Veterans and 1-year deals', 'veteran old declining one year prove it short deal age',
   `<p>Players past their peak, or whose OVR dropped last year, are marked <b>declining</b>. They want shorter deals and will take a <b>1-year prove-it deal</b> for noticeably less. Young improving players are the opposite: they want long deals and resist short ones.</p>`],
  ['resign', 'Contracts & cap', 'Re-signing and staff negotiations', 're-sign resign expiring sim negotiations staff auto let go plan',
   `<p>In the offseason's re-signing phase, the CONTRACTS tab lists everyone whose deal expired. Anyone you don't re-sign hits free agency.</p>
   <p>Only care about a few? Negotiate those yourself, then use the <b>PLAN</b> column (AUTO / RE-SIGN / LET GO), choose a staff approach and press <b>SIM NEGOTIATIONS</b>. AUTO lets your staff decide who's worth keeping. You get a report of every result. The same tools work for final-year extensions during the season.</p>`],
  ['extend', 'Contracts & cap', 'Extensions and restructures', 'extension extend restructure early bargain rookie deal lock up',
   `<p><b>Extend</b>: during the preseason or season, players in the last year of their deal can sign an extension that starts next year.</p>
   <p><b>Restructure</b>: players paid well under market with years left (often rookies who became starters) appear under <b>RESTRUCTURE CANDIDATES</b>. A restructure replaces the current deal with a new one starting now and running past the old end year. The player takes a discount for getting paid early, bigger the more cheap years he had left. One per player per season.</p>`],
  ['cuts', 'Contracts & cap', 'Releasing players and dead money', 'cut release dead money waive roster 53 staff cut review',
   `<p>Releasing a player under contract leaves <b>50% of this year's salary and 25% of next year's</b> on your cap as dead money. Rookies and minimum deals are cheap to cut.</p>
   <p><b>STAFF CUT REVIEW</b> (Roster and Contracts tabs) lists surplus depth and overpaid backups with the cap each cut saves. <b>AUTO-CUT TO 53</b> trims your weakest extra players.</p>`],
  ['roster', 'Contracts & cap', 'Roster limits', 'roster limit 53 active minimum full spots ir',
   `<p>You can carry <b>53 active players</b> (IR doesn't count). You need 53 or fewer and to be under the cap to start a season. If you're short, sign free agents or press <b>AUTO-FILL ROSTER</b>.</p>`],

  // ---------- Offseason ----------
  ['fa', 'Offseason', 'Free agency', 'free agency free agents waves sign bidding market',
   `<p>Free agency runs in <b>3 waves</b>. Before and between waves you can negotiate with anyone on the FREE AGENTS tab. Each wave, AI teams sign players. Top names get bid up early; whoever is left gets cheaper each wave.</p>
   <p>Press <b>FINISH FREE AGENCY</b> to sim the rest. You'll get a <b>free agency review</b>: who you signed, who left and where, your team rating change and a grade. Free agents are also available during the season at a discount.</p>`],
  ['scouting', 'Offseason', 'Scouting', 'scouting scout points prospects fog unscouted basic detailed full combine',
   `<p>Prospects' ratings are hidden behind scouting fog. Unscouted, the OVR shown can be off by about 9. Spend points to scout a prospect: <b>Basic</b> (1 pt, about ±5), <b>Detailed</b> (2 more pts, about ±2.5 and shows ratings) and <b>Full</b> (3 more pts, exact).</p>
   <p>Points come from check-ins during the season and a big batch at the <b>Scouting Combine</b>, which also posts 40-yard, bench and vertical results. <b>AUTO-SCOUT</b> spends your points on prospects that fit your needs. Prospects rise and fall during their college season.</p>`],
  ['traits', 'Offseason', 'College reports (traits)', 'traits college report strengths weaknesses scouting notes',
   `<p>Each prospect has 3-5 traits like "Breakaway speed on routes" (+ speed, agility, route running) or "Drops catchable balls" (- catching). They're tied to his real ratings. You see 2 unscouted, and one more per scouting level.</p>`],
  ['draft', 'Offseason', 'The draft and pick grades', 'draft pick grade true rank value steal reach review on the clock recommended',
   `<p>The draft is 7 rounds, ordered worst record to best (playoff teams last). When you're on the clock, pick from <b>RECOMMENDED PICKS</b> (your board blended with team needs) or the big board. Use <b>SIM TO MY PICK</b> to skip ahead.</p>
   <p>Every pick is graded: <b>picked</b> slot vs. <b>true</b> rank, where the player really ranks in the class by real ratings and position value. Taking the class's 5th-best player at #12 is +7 and a good grade. After the draft you get a <b>draft review</b> with your class grade, steals, reaches and every team's grade.</p>`],
  ['needs', 'Offseason', 'Team needs', 'needs need high med low position weakness',
   `<p>The draft and trade screens rate each position's need (HIGH / MED / LOW) from your starters vs. the league average, depth, aging starters, long injuries and young successors already on the roster.</p>`],
  ['rookies', 'Offseason', 'Rookie contracts', 'rookie contract slot salary 4 year',
   `<p>Draft picks sign 4-year rookie deals priced by draft slot; the top picks cost the most. Great rookies on cheap deals are prime restructure candidates later.</p>`],

  // ---------- Trades ----------
  ['trades', 'Trades', 'Making trades', 'trade trading propose offer balance players picks deadline',
   `<p>On the TRADE tab, choose a partner, then click assets on both sides: players and future draft picks. Press <b>WHAT WOULD IT TAKE?</b> to have the other team add what they'd want from you, or <b>PROPOSE TRADE</b> to send it.</p>
   <p>AI teams value players by talent, age, need, contract and cap fit. The trade deadline is after <b>week 9</b>; trading reopens after the Megacup.</p>`],
  ['picks', 'Trades', 'Draft pick value', 'pick value elite high mid low tier projected order',
   `<p>Future picks are valued by where the team is <b>projected</b> to pick, from current strength and record. Tiers: <b>ELITE</b> (top 5), <b>HIGH</b> (6-12), <b>MID</b> (13-22) and <b>LOW</b>. A bad team's first-rounder is worth a lot more than a contender's.</p>`],

  // ---------- History ----------
  ['hof', 'History & stats', 'Hall of Fame voting', 'hall of fame hof vote ballot induct legends enshrine',
   `<p>After every Megacup you hold the Hall of Fame vote. Press <b>HALL OF FAME VOTE</b> in the header, click any name to review his full career and highlights, and induct up to <b>${HOF_MAX_VOTES}</b> players. Players reach the ballot ${HOF_WAIT} seasons after retiring and stay on it for up to 10 years. The Hall of Fame (History tab) already holds legends from 1967 on.</p>`],
  ['lore', 'History & stats', 'League history since 1967', 'history 1967 lore past champions banners franchise leaders seasons',
   `<p>The league has history back to ${LORE_START}: every season's standings, playoffs and Megacup champion, plus a roster with stats for every team. Open a team, then <b>HISTORY</b> and click any year to see who played and what they did. <b>FRANCHISE LEADERS</b> shows all-time team leaders.</p>`],
  ['banners', 'History & stats', 'Team banners', 'banners titles division conference championship pennant',
   `<p>Every team profile shows its banners: a pennant for each Megacup title and conference title, and its division titles. They update as you win.</p>`],
  ['classes', 'Offseason', 'Draft class strength and settings', 'draft class strength stacked weak deep thin settings position',
   `<p>Draft classes vary: some are <b>stacked</b>, some <b>weak</b>, and individual positions can be <b>deep</b> (more and better prospects) or <b>thin</b>. The class outlook is at the top of the SCOUTING tab.</p>
   <p>Open <b>DRAFT CLASS SETTINGS</b> there to set the overall class and each position to LOW, AVG, HIGH or RANDOM. Settings apply to the next class generated (when a season starts). During week 1, before the first scouting report, you can regenerate the current class too.</p>`],

  ['records', 'History & stats', 'Records and history', 'records record book history hall of fame past seasons',
   `<p>The league starts with a record book and veterans with real career histories. The RECORDS tab tracks single-game, season, career and team records (current-season marks update live). HISTORY has past champions, awards and the Hall of Fame.</p>`],
  ['teamstats', 'History & stats', 'Team stats', 'team stats ranks offense defense points yards leaders compare',
   `<p>Click any team to open its <b>TEAM STATS</b>: per-game offense and defense with league ranks (green = top 8, red = bottom 8) and team leaders. LEADERS → <b>TEAM STATS</b> compares every team in a sortable table.</p>`],
];

// What to do right now, based on the current phase.
function helpNow() {
  if (!G) return 'Pick a team below to start. You can rename the teams first.';
  if (G.scoutStop) return `<b>${esc(G.scoutStop.name)}</b>: spend scouting points on the SCOUTING tab (or AUTO-SCOUT), then press <b>DONE SCOUTING</b>.`;
  return ({
    regular: `Week ${G.week}. Press <b>PLAY WEEK</b> (or SIM TO PLAYOFFS). Optional: set your depth chart and training, check injuries${G.week <= TRADE_DEADLINE_WEEK ? ', make trades before the deadline' : ''}.`,
    awards: 'The regular season is over. Look over the awards, then press <b>START PLAYOFFS</b>.',
    playoffs: 'Playoff time. Press <b>PLAY</b> for one round or <b>SIM PLAYOFFS</b>.',
    postseason: 'The season is over. Press <b>BEGIN OFFSEASON</b> to age players and set the draft order.',
    resign: 'Re-signing. On CONTRACTS, re-sign who you want (or SIM NEGOTIATIONS), then press <b>BEGIN FREE AGENCY</b>.',
    freeagency: `Free agency (wave ${G.faWave}/${FA_WAVES}). Shop FREE AGENTS, sim waves, then press <b>FINISH FREE AGENCY</b>.`,
    draft: 'Draft time. Finish Combine scouting if it\'s open, then make your picks on the DRAFT tab.',
    preseason: 'Preseason. Get to 53 active players and under the cap (STAFF CUT REVIEW helps), then <b>START SEASON</b>.',
  })[G.phase] || '';
}
function helpBody() {
  const cats = [...new Set(HELP.map(h => h[1]))];
  const cat = UI.helpCat || 'ALL';
  return `<div class="help">
    <div class="panel help-now"><b class="px small gold">WHAT DO I DO NOW?</b><p>${helpNow()}</p></div>
    <input id="helpQ" class="help-q" type="search" placeholder="Search the guide (e.g. cap, injuries, draft grade, restructure)..." value="${esc(UI.helpQ || '')}" autocomplete="off">
    <div class="filters">${['ALL', ...cats].map(c => `<button class="chip ${cat === c ? 'on' : ''}" data-act="helpCat" data-v="${esc(c)}">${esc(c.toUpperCase())}</button>`).join('')}</div>
    <p id="helpEmpty" class="dim hidden">No topics match. Try a simpler word like "cap", "draft" or "injury".</p>
    <div class="help-list">${HELP.map(([id, c, title, kw, body]) => `<details class="help-item panel" data-id="${id}" data-cat="${esc(c)}" data-title="${esc(title.toLowerCase())}" data-kw="${esc(kw.toLowerCase())}" data-text="${esc((title + ' ' + kw + ' ' + c + ' ' + body.replace(/<[^>]+>/g, ' ')).toLowerCase())}"><summary><span class="dim small">${esc(c)}</span> <b>${esc(title)}</b></summary><div class="help-body">${body}</div></details>`).join('')}</div>
  </div>`;
}
function vHelp() { return helpBody(); }
function openHelpModal() { openModal(`<h3 class="px">HOW TO PLAY</h3>${helpBody()}`, true); filterHelp(); }
function filterHelp() {
  const q = (UI.helpQ || '').toLowerCase().trim(), cat = UI.helpCat || 'ALL';
  const STOP = new Set(['how', 'do', 'i', 'a', 'an', 'the', 'to', 'my', 'what', 'is', 'can', 'does', 'of', 'in', 'on', 'for', 'and', 'why', 'when', 'where']);
  const words = q.split(/\s+/).filter(w => w && !STOP.has(w)).map(w => w.replace(/(ing|s)$/, '') || w);
  let shown = 0;
  const list = document.querySelector('.help-list'); if (!list) return;
  const items = [...list.querySelectorAll('.help-item')];
  // Relevance: title hits beat keyword hits beat body text; ties keep guide order.
  const score = (el) => words.reduce((s, w) => s + (el.dataset.title.includes(w) ? 10 : el.dataset.kw.includes(w) ? 4 : 1), 0);
  const ranked = items.map((el, i) => ({ el, i, ok: (cat === 'ALL' || el.dataset.cat === cat) && words.every(w => el.dataset.text.includes(w)), s: words.length ? score(el) : 0 }));
  ranked.sort((a, b) => b.s - a.s || HELP.findIndex(h => h[0] === a.el.dataset.id) - HELP.findIndex(h => h[0] === b.el.dataset.id));
  for (const r of ranked) {
    list.appendChild(r.el);
    r.el.classList.toggle('hidden', !r.ok);
    if (r.ok) shown++;
    r.el.open = r.ok && words.length > 0 && shown <= 2;
  }
  const e = $('#helpEmpty'); if (e) e.classList.toggle('hidden', shown > 0);
}
document.addEventListener('input', (e) => { if (e.target.id === 'helpQ') { UI.helpQ = e.target.value; filterHelp(); } });
