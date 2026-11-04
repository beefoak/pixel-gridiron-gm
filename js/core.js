'use strict';
// ================= RNG / helpers =================
const R = {
  rand: (a = 0, b = 1) => a + Math.random() * (b - a),
  int: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
  gauss: (m = 0, s = 1) => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return m + s * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); },
  expo: (mean) => -Math.log(1 - Math.random()) * mean,
  pick: (arr) => arr[Math.floor(Math.random() * arr.length)],
  chance: (p) => Math.random() < p,
  weighted: (items, wfn) => {
    let tot = 0; const ws = items.map(i => { const w = Math.max(0, wfn(i)); tot += w; return w; });
    let r = Math.random() * tot;
    for (let i = 0; i < items.length; i++) { r -= ws[i]; if (r <= 0) return items[i]; }
    return items[items.length - 1];
  },
  shuffle: (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; },
};
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// ================= League structure =================
// [conf, div, city, name, abbr, primary, secondary]
const TEAMS_DATA = [
  ['American', 'East', 'Buffalo', 'Blizzard', 'BUF', '#00338D', '#C60C30'],
  ['American', 'East', 'Miami', 'Riptide', 'MIA', '#008E97', '#FC4C02'],
  ['American', 'East', 'New England', 'Ironsides', 'NE', '#002244', '#C60C30'],
  ['American', 'East', 'New York', 'Jackals', 'NYJ', '#125740', '#FFFFFF'],
  ['American', 'North', 'Baltimore', 'Corsairs', 'BAL', '#241773', '#9E7C0C'],
  ['American', 'North', 'Cincinnati', 'Riverhawks', 'CIN', '#FB4F14', '#000000'],
  ['American', 'North', 'Cleveland', 'Forge', 'CLE', '#311D00', '#FF3C00'],
  ['American', 'North', 'Pittsburgh', 'Smelters', 'PIT', '#101820', '#FFB612'],
  ['American', 'South', 'Houston', 'Wildcatters', 'HOU', '#03202F', '#A71930'],
  ['American', 'South', 'Indianapolis', 'Speedsters', 'IND', '#002C5F', '#FFFFFF'],
  ['American', 'South', 'Jacksonville', 'Barracudas', 'JAX', '#006778', '#D7A22A'],
  ['American', 'South', 'Tennessee', 'Stallions', 'TEN', '#0C2340', '#4B92DB'],
  ['American', 'West', 'Denver', 'Peaks', 'DEN', '#FB4F14', '#002244'],
  ['American', 'West', 'Kansas City', 'Stampede', 'KC', '#E31837', '#FFB81C'],
  ['American', 'West', 'Las Vegas', 'High Rollers', 'LV', '#000000', '#A5ACAF'],
  ['American', 'West', 'Los Angeles', 'Condors', 'LAC', '#0080C6', '#FFC20E'],
  ['National', 'East', 'Dallas', 'Wranglers', 'DAL', '#003594', '#869397'],
  ['National', 'East', 'New York', 'Gothams', 'NYG', '#0B2265', '#A71930'],
  ['National', 'East', 'Philadelphia', 'Founders', 'PHI', '#004C54', '#A5ACAF'],
  ['National', 'East', 'Washington', 'Sentinels', 'WAS', '#5A1414', '#FFB612'],
  ['National', 'North', 'Chicago', 'Windstorm', 'CHI', '#0B162A', '#C83803'],
  ['National', 'North', 'Detroit', 'Gearheads', 'DET', '#0076B6', '#B0B7BC'],
  ['National', 'North', 'Green Bay', 'Lumberjacks', 'GB', '#203731', '#FFB612'],
  ['National', 'North', 'Minnesota', 'Voyageurs', 'MIN', '#4F2683', '#FFC62F'],
  ['National', 'South', 'Atlanta', 'Firebirds', 'ATL', '#A71930', '#000000'],
  ['National', 'South', 'Carolina', 'Copperheads', 'CAR', '#0085CA', '#101820'],
  ['National', 'South', 'New Orleans', 'Krewe', 'NO', '#101820', '#D3BC8D'],
  ['National', 'South', 'Tampa Bay', 'Cutlasses', 'TB', '#D50A0A', '#34302B'],
  ['National', 'West', 'Arizona', 'Scorpions', 'ARI', '#97233F', '#FFB612'],
  ['National', 'West', 'Los Angeles', 'Rattlers', 'LAR', '#003594', '#FFA300'],
  ['National', 'West', 'San Francisco', 'Prospectors', 'SF', '#AA0000', '#B3995D'],
  ['National', 'West', 'Seattle', 'Sasquatch', 'SEA', '#002244', '#69BE28'],
];
const DIVS = ['East', 'North', 'South', 'West'];
const CONFS = ['American', 'National'];
const DIV_DISPLAY = ['North', 'South', 'East', 'West'];
const CONF_SHORT = { American: 'AMER', National: 'NATL', MC: 'MEGACUP' };
const DEFAULT_TEAM_NAMES = TEAMS_DATA.map(t => t[3]);

// ================= Positions / ratings =================
const POSITIONS = ['QB', 'RB', 'WR', 'TE', 'OL', 'DE', 'DT', 'LB', 'CB', 'S', 'K', 'P'];
const OFFENSE = ['QB', 'RB', 'WR', 'TE', 'OL'];
const DEFENSE = ['DE', 'DT', 'LB', 'CB', 'S'];
const ROSTER_TEMPLATE = { QB: 3, RB: 4, WR: 7, TE: 3, OL: 10, DE: 4, DT: 4, LB: 6, CB: 6, S: 4, K: 1, P: 1 }; // 53
const ROSTER_MIN = { QB: 2, RB: 3, WR: 5, TE: 2, OL: 8, DE: 3, DT: 3, LB: 4, CB: 4, S: 3, K: 1, P: 1 };
const HEALTHY_NEED = { QB: 2, RB: 2, WR: 4, TE: 2, OL: 7, DE: 3, DT: 3, LB: 4, CB: 4, S: 3, K: 1, P: 1 };
const STARTERS = { QB: 1, RB: 1, WR: 3, TE: 1, OL: 5, DE: 2, DT: 2, LB: 3, CB: 3, S: 2, K: 1, P: 1 };
const ROSTER_LIMIT = 53;

const ATTRS = ['spd', 'str', 'agi', 'awr', 'thp', 'tha', 'car', 'cth', 'rte', 'rbk', 'pbk', 'prs', 'rdf', 'tkl', 'cov', 'kpw', 'kac'];
const ATTR_NAMES = { spd: 'Speed', str: 'Strength', agi: 'Agility', awr: 'Awareness', thp: 'Throw Power', tha: 'Throw Accuracy', car: 'Ball Security', cth: 'Catching', rte: 'Route Running', rbk: 'Run Block', pbk: 'Pass Block', prs: 'Pass Rush', rdf: 'Run Defense', tkl: 'Tackling', cov: 'Coverage', kpw: 'Kick Power', kac: 'Kick Accuracy' };
const OVR_WEIGHTS = {
  QB: { tha: .36, thp: .2, awr: .3, agi: .07, spd: .07 },
  RB: { spd: .25, agi: .2, car: .2, str: .1, cth: .1, awr: .15 },
  WR: { spd: .25, cth: .3, rte: .25, agi: .1, awr: .1 },
  TE: { cth: .25, rte: .15, rbk: .2, str: .15, spd: .1, awr: .1, pbk: .05 },
  OL: { rbk: .4, pbk: .4, str: .15, awr: .05 },
  DE: { prs: .4, rdf: .2, str: .15, spd: .15, tkl: .1 },
  DT: { rdf: .35, prs: .25, str: .3, tkl: .1 },
  LB: { tkl: .3, rdf: .2, cov: .2, spd: .15, awr: .15 },
  CB: { cov: .45, spd: .3, agi: .1, awr: .1, tkl: .05 },
  S: { cov: .3, tkl: .25, spd: .2, awr: .2, rdf: .05 },
  K: { kpw: .5, kac: .5 },
  P: { kpw: .6, kac: .4 },
};
const ATH_BASE = {
  QB: { spd: 64, str: 60, agi: 68, awr: 70 }, RB: { spd: 88, str: 68, agi: 88, awr: 66 },
  WR: { spd: 90, str: 55, agi: 88, awr: 66 }, TE: { spd: 78, str: 74, agi: 72, awr: 68 },
  OL: { spd: 50, str: 88, agi: 55, awr: 70 }, DE: { spd: 79, str: 82, agi: 72, awr: 66 },
  DT: { spd: 62, str: 90, agi: 60, awr: 66 }, LB: { spd: 80, str: 76, agi: 75, awr: 68 },
  CB: { spd: 91, str: 55, agi: 88, awr: 66 }, S: { spd: 87, str: 62, agi: 82, awr: 68 },
  K: { spd: 55, str: 50, agi: 55, awr: 70 }, P: { spd: 55, str: 50, agi: 55, awr: 70 },
};
const CROSS = {
  QB: { car: 55 }, RB: { rte: 58, rbk: 40, pbk: 50 }, WR: { car: 55, rbk: 40 }, TE: { car: 50 },
  DE: { cov: 35 }, DT: { cov: 25 }, LB: { prs: 55 }, CB: { rdf: 45, cth: 50 }, S: { cth: 50, prs: 40 },
};
const PEAK = { QB: [27, 33], RB: [23, 27], WR: [24, 29], TE: [25, 30], OL: [25, 31], DE: [25, 30], DT: [25, 30], LB: [24, 29], CB: [24, 28], S: [25, 29], K: [26, 36], P: [26, 36] };
const HTWT = { QB: [75, 222], RB: [70, 215], WR: [72, 200], TE: [77, 250], OL: [77, 312], DE: [76, 270], DT: [75, 305], LB: [74, 240], CB: [71, 193], S: [72, 205], K: [72, 195], P: [74, 210] };
const NUMS = { QB: [[1, 19]], RB: [[20, 39]], WR: [[10, 19], [80, 89]], TE: [[80, 89], [40, 49]], OL: [[60, 79]], DE: [[90, 99], [50, 59]], DT: [[90, 99]], LB: [[40, 59]], CB: [[20, 39]], S: [[20, 49]], K: [[1, 9]], P: [[1, 19]] };
const POS_DRAFT_W = { QB: 3, RB: 4, WR: 7, TE: 3, OL: 10, DE: 4.5, DT: 4, LB: 6, CB: 6.5, S: 4, K: 0.6, P: 0.6 };

const FIRST_NAMES = ['James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph', 'Thomas', 'Chris', 'Daniel', 'Matthew', 'Anthony', 'Mark', 'Josh', 'Steven', 'Andrew', 'Kevin', 'Brian', 'Tyler', 'Justin', 'Brandon', 'Ryan', 'Jacob', 'Nick', 'Eric', 'Jonathan', 'Aaron', 'Patrick', 'Zach', 'Kyle', 'Derek', 'Marcus', 'Jalen', 'Tre', 'DeShawn', 'Darius', 'Malik', 'Jamal', 'Terrell', 'Isaiah', 'Caleb', 'Elijah', 'Jaylen', 'Cameron', 'Dylan', 'Austin', 'Logan', 'Trevor', 'Cole', 'Bryce', 'Garrett', 'Jordan', 'Devin', 'Javon', 'Deion', 'Keenan', 'Myles', 'Trent', 'Quinton', 'Rashad', 'Cedric', 'Damien', 'Xavier', 'Tavon', 'Amari', 'Khalil', 'Micah', 'Brock', 'Carson', 'Drake', 'Shane', 'Travis', 'Colby', 'Hunter', 'Mason', 'Wyatt', 'Grant', 'Blake', 'Chase', 'Reggie', 'Andre', 'Marquise', 'Kendall', 'Desmond', 'Corey', 'Antonio', 'Nate', 'Sam', 'Joe', 'Ben', 'Luke', 'Jake', 'Max', 'Owen', 'Brady', 'Gavin', 'Zion', 'Rome', 'Kenny', 'Leon', 'Omar', 'Tariq', 'Dante', 'Mike', 'Greg', 'Russell', 'Jared', 'Emeka', 'Kobe', 'Tyrell', 'Bo', 'Darnell', 'Quincy', 'Ezra', 'Silas', 'Mateo', 'Luis', 'Kai', 'Jace', 'Rhett', 'Beau', 'Cyrus'];
const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Miller', 'Davis', 'Wilson', 'Anderson', 'Taylor', 'Thomas', 'Moore', 'Martin', 'Jackson', 'Thompson', 'White', 'Harris', 'Clark', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Green', 'Baker', 'Adams', 'Nelson', 'Hill', 'Campbell', 'Mitchell', 'Roberts', 'Carter', 'Phillips', 'Evans', 'Turner', 'Parker', 'Collins', 'Edwards', 'Stewart', 'Morris', 'Murphy', 'Cook', 'Rogers', 'Morgan', 'Cooper', 'Peterson', 'Reed', 'Bailey', 'Bell', 'Kelly', 'Howard', 'Ward', 'Cox', 'Richardson', 'Wood', 'Watson', 'Brooks', 'Bennett', 'Gray', 'James', 'Hughes', 'Price', 'Sanders', 'Myers', 'Long', 'Ross', 'Foster', 'Powell', 'Jenkins', 'Perry', 'Russell', 'Sullivan', 'Fisher', 'Hayes', 'Ford', 'Graham', 'Wallace', 'Woods', 'Cole', 'West', 'Jordan', 'Owens', 'Reynolds', 'Ellis', 'Harrison', 'Gibson', 'McDonald', 'Cruz', 'Marshall', 'Gordon', 'Burns', 'Holmes', 'Stone', 'Warren', 'Dixon', 'Ramos', 'Hunt', 'Black', 'Daniels', 'Palmer', 'Mills', 'Grant', 'Knight', 'Ferguson', 'Rose', 'Hudson', 'Spencer', 'Gardner', 'Payne', 'Pierce', 'Berry', 'Matthews', 'Arnold', 'Wagner', 'Willis', 'Ray', 'Watkins', 'Olson', 'Carroll', 'Duncan', 'Snyder', 'Hart', 'Cunningham', 'Bradley', 'Lane', 'Andrews', 'Harper', 'Fox', 'Riley', 'Armstrong', 'Carpenter', 'Weaver', 'Greene', 'Lawrence', 'Elliott', 'Chavez', 'Sims', 'Austin', 'Peters', 'Franklin', 'Lawson', 'Fields', 'Hamilton', 'Moss', 'Mack', 'Bryant', 'Barnes', 'Henderson', 'Coleman', 'Simmons', 'Patterson', 'Washington', 'Butler', 'Alexander', 'Hawkins', 'Okafor', 'Adeyemi', 'Tuilagi', 'Mauga', 'Nwosu', 'Kowalski', 'Lindqvist', 'Delgado', 'Fontenot', 'Boudreaux', 'Thibodeaux', 'Mahoney', 'Castillo', 'Vance', 'Holloway', 'Pruitt', 'Banks', 'Sutton', 'Frazier', 'Tate', 'Whitfield'];
const COLLEGES = ['Alabama', 'Georgia', 'Ohio State', 'Michigan', 'LSU', 'Clemson', 'Texas', 'Oklahoma', 'USC', 'Oregon', 'Penn State', 'Florida', 'Florida State', 'Miami', 'Notre Dame', 'Auburn', 'Tennessee', 'Texas A&M', 'Wisconsin', 'Iowa', 'Washington', 'Utah', 'TCU', 'Baylor', 'Ole Miss', 'Mississippi State', 'Arkansas', 'Kentucky', 'South Carolina', 'Missouri', 'Nebraska', 'Minnesota', 'UCLA', 'Stanford', 'California', 'Arizona State', 'Colorado', 'Pittsburgh', 'Boston College', 'Virginia Tech', 'North Carolina', 'NC State', 'Louisville', 'Purdue', 'Illinois', 'Michigan State', 'Iowa State', 'Kansas State', 'Oklahoma State', 'West Virginia', 'Boise State', 'Houston', 'Cincinnati', 'Tulane', 'App State', 'N. Dakota State', 'Toledo', 'Memphis', 'Jackson State', 'SMU', 'Duke', 'Wake Forest'];

// ================= Stats =================
function emptyStats() {
  return { gp: 0, gs: 0, pAtt: 0, pCmp: 0, pYds: 0, pTd: 0, pInt: 0, sk: 0, rAtt: 0, rYds: 0, rTd: 0, rLng: 0, tgt: 0, rec: 0, reYds: 0, reTd: 0, reLng: 0, tkl: 0, sack: 0, dInt: 0, ff: 0, pd: 0, fgm: 0, fga: 0, fgLng: 0, xpm: 0, xpa: 0, pnt: 0, pntYds: 0, fum: 0 };
}
const STAT_KEYS = Object.keys(emptyStats());
const MAX_KEYS = { rLng: 1, reLng: 1, fgLng: 1 };
function addStats(dst, src) {
  for (const k of STAT_KEYS) {
    const v = src[k]; if (!v) continue;
    if (MAX_KEYS[k]) dst[k] = Math.max(dst[k] || 0, v); else dst[k] = (dst[k] || 0) + v;
  }
}
function compactStats(s) { const o = {}; for (const k of STAT_KEYS) if (s[k]) o[k] = s[k]; return o; }
function st(s, k) { return (s && s[k]) || 0; }

// ================= Players =================
function calcOvr(p) { const w = OVR_WEIGHTS[p.pos]; let s = 0; for (const k in w) s += p.attrs[k] * w[k]; return Math.round(s); }
function clampAttrs(p) { for (const k of ATTRS) p.attrs[k] = Math.round(clamp(p.attrs[k], 15, 99)); }

function createPlayer(L, pos, T, age) {
  const a = {}; const base = ATH_BASE[pos], w = OVR_WEIGHTS[pos], cross = CROSS[pos] || {};
  for (const k of ATTRS) {
    if (k in base) a[k] = base[k] + (T - 70) * 0.55 + R.gauss(0, 4);
    else if (k in w) a[k] = T + R.gauss(0, 5);
    else a[k] = (cross[k] || 25) + R.gauss(0, 8);
  }
  const p = {
    id: L.nextPid++, fn: R.pick(FIRST_NAMES), ln: R.pick(LAST_NAMES), pos, age,
    college: R.pick(COLLEGES), attrs: a, ovr: 0, pot: 0, tid: -1, exp: 0,
    injury: null, ir: false, injHist: [], stats: emptyStats(), pstats: emptyStats(),
    career: [], ovrHist: [], draft: null, awards: [], skin: R.int(0, 4),
  };
  clampAttrs(p);
  const diff = T - calcOvr(p);
  for (const k in w) a[k] += diff;
  clampAttrs(p);
  p.ovr = calcOvr(p);
  const [htM, wtM] = HTWT[pos];
  p.ht = Math.round(R.gauss(htM, 1.6)); p.wt = Math.round(R.gauss(wtM, wtM * 0.04));
  const nr = R.pick(NUMS[pos]); p.num = R.int(nr[0], nr[1]);
  const pk = PEAK[pos];
  if (age < pk[0]) p.pot = clamp(Math.round(p.ovr + (pk[0] - age) * R.rand(0.8, 3.4) + R.rand(0, 4)), p.ovr, 99);
  else p.pot = clamp(p.ovr + R.int(0, 2), p.ovr, 99);
  return p;
}

// Generational ("S") talents: rare, NFL-ready on day one, and they age gracefully.
const GEN_PEAK_BONUS = 3;
function potGrade(v, gen) { return gen ? 'S' : v >= 90 ? 'A+' : v >= 85 ? 'A' : v >= 80 ? 'B+' : v >= 75 ? 'B' : v >= 70 ? 'C+' : v >= 65 ? 'C' : v >= 60 ? 'D' : 'F'; }
function htStr(h) { return Math.floor(h / 12) + "'" + (h % 12) + '"'; }
function fullName(p) { return p.fn + ' ' + p.ln; }
function shortName(p) { return p.temp ? 'Fill-in' : p.fn[0] + '. ' + p.ln; }

// Yearly development: young players grow toward potential, vets decline past peak window.
function progressPlayer(p) {
  const pk0 = PEAK[p.pos], w = OVR_WEIGHTS[p.pos], before = p.ovr;
  const pk = p.gen ? [pk0[0], pk0[1] + GEN_PEAK_BONUS] : pk0;
  let delta;
  if (p.age <= pk[0]) { const room = Math.max(0, p.pot - p.ovr); delta = room * R.rand(0.12, 0.5) + R.gauss(0, 1.8); }
  else if (p.age <= pk[1]) { const room = Math.max(0, p.pot - p.ovr); delta = room * R.rand(0, 0.35) + R.gauss(0, 1.6); }
  else { const yrs = p.age - pk[1]; delta = (-(R.rand(0.5, 2.5) + yrs * R.rand(0.6, 1.6)) + R.gauss(0, 1.2)) * (p.gen ? 0.5 : 1); }
  if (p.age < 26 && R.chance(0.05)) delta += R.rand(3, 8);   // breakout
  if (R.chance(p.gen ? 0.015 : 0.04)) delta -= R.rand(2, 5); // bad offseason
  for (const k in w) p.attrs[k] += delta * R.rand(0.6, 1.4);
  if (p.age > pk[1]) { const k = p.gen ? 0.5 : 1; p.attrs.spd -= R.rand(0.3, 1.8) * k; p.attrs.agi -= R.rand(0.2, 1.2) * k; }
  else p.attrs.awr += R.rand(0, 2);
  clampAttrs(p);
  p.ovr = calcOvr(p);
  if (p.age > pk[1]) p.pot = p.ovr;
  else if (p.age >= pk[0]) p.pot = Math.max(p.ovr, Math.min(p.pot, p.ovr + R.int(0, 4)));
  else p.pot = clamp(Math.round(p.pot + R.gauss(0, 2)), p.ovr, 99);
  return p.ovr - before;
}

// ================= Injuries =================
// [name, weight, minWeeks, maxWeeks, attrHit]
const INJURIES = [
  ['Ankle Sprain', 18, 1, 3], ['High Ankle Sprain', 8, 3, 6], ['Hamstring Strain', 16, 1, 4], ['Concussion', 10, 1, 3],
  ['MCL Sprain', 8, 2, 6], ['Torn ACL', 3, 38, 52, { spd: [2, 6], agi: [2, 5] }], ['Shoulder Separation', 6, 2, 6],
  ['Broken Hand', 4, 3, 6], ['Groin Strain', 8, 1, 3], ['Back Spasms', 6, 1, 2], ['Rib Injury', 5, 1, 4],
  ['Torn Achilles', 1.5, 40, 55, { spd: [4, 8], agi: [2, 5] }], ['Broken Leg', 1, 14, 30, { spd: [1, 4] }], ['Turf Toe', 4, 2, 6],
  ['Torn Pectoral', 1.5, 14, 24, { str: [2, 5] }], ['Calf Strain', 6, 1, 3], ['Knee Bruise', 6, 1, 2], ['Torn Meniscus', 2.5, 4, 8, { agi: [0, 2] }],
];
const ILLNESSES = [['Flu', 4, 1, 1], ['Illness', 4, 1, 1], ['Personal Leave', 2, 1, 2], ['Food Poisoning', 1, 1, 1], ['Respiratory Virus', 2, 1, 2], ['Appendectomy', 0.6, 2, 4]];
const INJ_RATE = { QB: 0.022, RB: 0.04, WR: 0.03, TE: 0.03, OL: 0.025, DE: 0.028, DT: 0.028, LB: 0.03, CB: 0.03, S: 0.028, K: 0.002, P: 0.002 };
