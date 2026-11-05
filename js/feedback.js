// Feedback / suggestions / bug reports, emailed to the developer.
// Static site, so reports go through FormSubmit (formsubmit.co), which forwards the form to the inbox below.
// The first report ever sent triggers a one-time activation email to that inbox; after confirming it,
// FormSubmit offers a random alias you can swap in for FEEDBACK_TO to keep the address out of the page source.
const FEEDBACK_TO = 'jacob.floss@gmail.com';
const FEEDBACK_URL = 'https://formsubmit.co/ajax/' + FEEDBACK_TO;
const FEEDBACK_KINDS = [['bug', 'BUG REPORT'], ['idea', 'SUGGESTION'], ['feedback', 'FEEDBACK']];
const FEEDBACK_COOLDOWN = 60 * 1000;

function gameVersion() {
  const s = [...document.scripts].map(x => x.src.match(/[?&]v=(\d+)/)).find(Boolean);
  return s ? s[1] : '?';
}
function feedbackContext() {
  const lines = [`Version: v${gameVersion()}`, `Browser: ${navigator.userAgent}`, `Screen: ${innerWidth}x${innerHeight}`];
  if (typeof G !== 'undefined' && G) {
    lines.push(`Team: ${teamName(G, G.userTeam)}`, `Season: ${G.year} · ${G.phase}${G.week ? ' · week ' + G.week : ''}`, `Tab: ${UI.tab || '-'}`);
  }
  if (feedbackErrors.length) lines.push('Recent errors:', ...feedbackErrors.slice(-5));
  return lines.join('\n');
}
// keep the last few script errors so bug reports can include them
const feedbackErrors = [];
window.addEventListener('error', e => { feedbackErrors.push(`${e.message} (${(e.filename || '').split('/').pop()}:${e.lineno})`); if (feedbackErrors.length > 10) feedbackErrors.shift(); });

function openFeedbackModal(kind) {
  kind = kind || UI.fbKind || 'bug'; UI.fbKind = kind;
  const draft = UI.fbDraft || {};
  openModal(`<h3 class="px">SEND FEEDBACK</h3>
  <p class="dim small">Found a bug, have an idea, or just want to say something? It goes straight to the developer.</p>
  <div class="mtabs">${FEEDBACK_KINDS.map(([k, l]) => `<button class="btn tiny ${k === kind ? '' : 'alt'}" data-act="fbKind" data-v="${k}">${l}</button>`).join('')}</div>
  <div class="fb-form">
    <label>Short summary<input id="fbTitle" maxlength="120" placeholder="${kind === 'bug' ? 'e.g. Draft screen freezes after pick 32' : kind === 'idea' ? 'e.g. Let me trade future picks' : 'What\'s on your mind?'}" value="${esc(draft.title || '')}"></label>
    <label>${kind === 'bug' ? 'What happened, and what were you doing right before?' : 'Details'}<textarea id="fbBody" rows="7" maxlength="5000">${esc(draft.body || '')}</textarea></label>
    <label>Your email <span class="dim">(optional, only if you'd like a reply)</span><input id="fbEmail" type="email" maxlength="120" value="${esc(draft.email || '')}"></label>
    <label class="fb-check"><input id="fbCtx" type="checkbox" ${draft.ctx === false ? '' : 'checked'}> Include game info (version, season, browser${feedbackErrors.length ? ', recent errors' : ''})</label>
  </div>
  <div class="pact"><button class="btn" data-act="fbSend">SEND</button><button class="btn alt" data-act="close">CANCEL</button></div>
  <p id="fbStatus" class="small"></p>`);
}
function readFeedbackForm() {
  const v = id => ($('#' + id) || {}).value || '';
  UI.fbDraft = { title: v('fbTitle').trim(), body: v('fbBody').trim(), email: v('fbEmail').trim(), ctx: !!($('#fbCtx') || {}).checked };
  return UI.fbDraft;
}
function feedbackMailto(kindLabel, d) {
  const body = `${d.body}\n\n${d.ctx ? '---\n' + feedbackContext() : ''}`;
  return `mailto:${FEEDBACK_TO}?subject=${encodeURIComponent(`[Pixel Gridiron GM] ${kindLabel}: ${d.title}`)}&body=${encodeURIComponent(body)}`;
}
async function sendFeedback() {
  const d = readFeedbackForm(), st = $('#fbStatus');
  const kindLabel = (FEEDBACK_KINDS.find(k => k[0] === UI.fbKind) || FEEDBACK_KINDS[0])[1];
  if (!d.title || !d.body) { st.className = 'small bad'; st.textContent = 'Please add a summary and some details.'; return; }
  if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) { st.className = 'small bad'; st.textContent = 'That email address doesn\'t look right (or leave it blank).'; return; }
  let last = 0; try { last = +localStorage.getItem('pgg_fb_last') || 0; } catch (e) { }
  if (Date.now() - last < FEEDBACK_COOLDOWN) { st.className = 'small bad'; st.textContent = 'Thanks! Please wait a minute before sending another.'; return; }
  const btn = $('[data-act=fbSend]'); btn.disabled = true; btn.textContent = 'SENDING...';
  st.className = 'small dim'; st.textContent = '';
  const payload = {
    _subject: `[Pixel Gridiron GM] ${kindLabel}: ${d.title}`, _template: 'box', _captcha: 'false',
    type: kindLabel, summary: d.title, message: d.body, reply_to: d.email || '(none)',
  };
  if (d.email) payload._replyto = d.email;
  if (d.ctx) payload.game_info = feedbackContext();
  try {
    const r = await fetch(FEEDBACK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.success === false || j.success === 'false') throw new Error(j.message || 'HTTP ' + r.status);
    try { localStorage.setItem('pgg_fb_last', String(Date.now())); } catch (e) { }
    UI.fbDraft = null;
    closeModal(); toast('Thanks! Your report was sent.');
  } catch (err) {
    btn.disabled = false; btn.textContent = 'SEND';
    st.className = 'small bad';
    st.innerHTML = `Couldn't send it right now (${esc(String(err.message || err))}). You can <a class="plink" href="${feedbackMailto(kindLabel, d)}">email it instead</a>, your text is filled in for you.`;
  }
}
function onFeedbackClick(act, el) {
  switch (act) {
    case 'feedback': openFeedbackModal(); return true;
    case 'fbKind': readFeedbackForm(); openFeedbackModal(el.dataset.v); return true;
    case 'fbSend': sendFeedback(); return true;
  }
  return false;
}
