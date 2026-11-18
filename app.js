const BELIEFS = {
  failure: "I'm a failure",
  care: "Nobody cares",
  better: "It won't get better",
  burden: "I'm a burden",
  capable: "I can't do anything right"
};
const PROMPTS = {
  failure: "What did you finish today, however small?",
  care: "Who showed they care today?",
  better: "What felt even a little good today?",
  burden: "Who was glad you were around?",
  capable: "What did you handle today?"
};

const $ = id => document.getElementById(id);

// --- Storage (IndexedDB, stays on this device) ---
const dbReady = new Promise((ok, no) => {
  const r = indexedDB.open('proof', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('items', { keyPath: 'id' });
  r.onsuccess = () => ok(r.result);
  r.onerror = () => no(r.error);
});
async function tx(mode, fn) {
  const d = await dbReady;
  return new Promise((ok, no) => {
    const t = d.transaction('items', mode);
    const q = fn(t.objectStore('items'));
    t.oncomplete = () => ok(q && q.result);
    t.onerror = () => no(t.error);
  });
}
const put = item => tx('readwrite', s => s.put(item));
const all = () => tx('readonly', s => s.getAll());

// --- Tabs ---
document.querySelectorAll('nav button').forEach(b => b.onclick = () => go(b.dataset.v));

// --- Rough day: pick a belief, see matching proof ---
const chips = $('chips');
Object.entries(BELIEFS).forEach(([k, v]) => {
  const b = document.createElement('button');
  b.textContent = v;
  b.onclick = () => start(k);
  chips.appendChild(b);
});
const any = document.createElement('button');
any.textContent = "I can't explain it";
any.onclick = () => start(null);
chips.appendChild(any);

let pool = [], idx = 0, urls = [];
async function start(tag) {
  const items = await all();
  pool = items.filter(i => !tag || i.tag === tag);
  if (!pool.length) pool = items;
  pool.sort(() => Math.random() - 0.5);
  idx = 0;
  $('empty').hidden = pool.length > 0;
  $('stage').hidden = pool.length === 0;
  if (pool.length) show();
}
function show() {
  urls.forEach(URL.revokeObjectURL);
  urls = [];
  const i = pool[idx % pool.length];
  $('meta').textContent = (i.from ? 'From ' + i.from : 'You wrote this') + ' on ' + new Date(i.ts).toLocaleDateString();
  $('text').textContent = i.text || '';
  const media = (el, blob) => {
    el.hidden = !blob;
    if (blob) { const u = URL.createObjectURL(blob); urls.push(u); el.src = u; }
  };
  media($('photo'), i.photo);
  media($('audio'), i.voice);
}
$('next').onclick = () => { idx++; show(); };

// --- Add proof ---
Object.entries(BELIEFS).forEach(([k, v]) => {
  const o = document.createElement('option');
  o.value = k;
  o.textContent = 'Against: ' + v;
  $('tag').appendChild(o);
});
const setPrompt = () => $('prompt').textContent = PROMPTS[$('tag').value];
$('tag').onchange = setPrompt;
setPrompt();

let rec, voiceBlob = null;
$('rec').onclick = async () => {
  if (rec && rec.state === 'recording') { rec.stop(); return; }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const chunks = [];
    rec = new MediaRecorder(stream);
    rec.ondataavailable = e => chunks.push(e.data);
    rec.onstop = () => {
      voiceBlob = new Blob(chunks, { type: rec.mimeType });
      stream.getTracks().forEach(t => t.stop());
      $('rec').textContent = 'Record again';
      $('recnote').textContent = 'Clip ready';
    };
    rec.start();
    $('rec').textContent = 'Stop';
    $('recnote').textContent = 'Recording...';
    setTimeout(() => rec.state === 'recording' && rec.stop(), 30000);
  } catch {
    $('recnote').textContent = 'Microphone blocked. Allow it in your browser settings.';
  }
};

$('save').onclick = async () => {
  const text = $('note').value.trim();
  const photo = $('pic').files[0] || null;
  if (!text && !photo && !voiceBlob) { $('status').textContent = 'Add a note, photo, or voice clip first.'; return; }
  await put({ id: crypto.randomUUID(), tag: $('tag').value, text, photo, voice: voiceBlob, ts: Date.now() });
  $('note').value = ''; $('pic').value = ''; voiceBlob = null;
  $('rec').textContent = 'Record'; $('recnote').textContent = '';
  $('status').textContent = 'Saved. Future you will thank you.';
};

// --- Voices: friends write a note, send back a code ---
$('link').onclick = async () => {
  const name = $('who').value.trim() || 'me';
  const url = new URL('write.html', location.href);
  url.searchParams.set('to', name);
  try { await navigator.clipboard.writeText(url.href); $('linkout').textContent = 'Link copied. Send it to someone you trust.'; }
  catch { $('linkout').textContent = url.href; }
};
$('import').onclick = async () => {
  try {
    const d = JSON.parse(decodeURIComponent(atob($('code').value.trim())));
    if (!d.text || !BELIEFS[d.tag]) throw 0;
    await put({ id: crypto.randomUUID(), tag: d.tag, text: String(d.text).slice(0, 1000), from: String(d.from || 'Someone who cares').slice(0, 60), ts: Date.now() });
    $('code').value = '';
    countVoices('Saved. It will show up on a rough day.');
  } catch { $('vcount').textContent = "That code didn't work. Ask them to send it again."; }
};
async function countVoices(msg) {
  const n = (await all()).filter(i => i.from).length;
  $('vcount').textContent = (msg ? msg + ' ' : '') + n + (n === 1 ? ' note is' : ' notes are') + ' waiting for you.';
}

// ===== Safety + calming features =====
const LS = 'brainlies2';
let S = { plan: {}, contacts: [{}, {}, {}], reasons: [], country: 'PH', log: [] };
try { Object.assign(S, JSON.parse(localStorage.getItem(LS) || '{}')); } catch {}
while (S.contacts.length < 3) S.contacts.push({});
const keep = () => { try { localStorage.setItem(LS, JSON.stringify(S)); } catch {} };
const rand = a => a[Math.floor(Math.random() * a.length)];
const digits = n => String(n).replace(/[^\d+]/g, '');

function go(v) {
  document.querySelectorAll('nav button').forEach(x => x.classList.toggle('on', x.dataset.v === v));
  document.querySelectorAll('.view').forEach(x => x.hidden = x.id !== v);
  if (v === 'voices') countVoices();
  if (v === 'data') drawHist();
  window.scrollTo(0, 0);
}
document.addEventListener('click', e => {
  const c = e.target.closest('[data-crisis]'), g = e.target.closest('[data-go]');
  if (c) openCrisis();
  if (g) { if ($('crisis').open) $('crisis').close(); go(g.dataset.go); }
});

// --- Severity check ---
$('lvl').oninput = () => $('lvlv').textContent = $('lvl').value;
$('sevgo').onclick = () => {
  const n = +$('lvl').value, hi = n >= 7;
  S.log.push({ t: Date.now(), n }); S.log = S.log.slice(-60); keep();
  $('urgent').hidden = !hi;
  $('belief').hidden = hi;
  $('stage').hidden = true; $('empty').hidden = true;
  $('urgtxt').textContent = 'You said ' + n + ' out of 10. Safety comes first, and proof cards can wait.' +
    (n >= 9 ? ' If you might act on thoughts of ending your life, please use crisis help now.' : '');
  $('reason').hidden = !S.reasons.length;
  if (S.reasons.length) $('reason').textContent = 'One of your reasons: ' + rand(S.reasons);
};
$('anyway').onclick = () => { $('belief').hidden = false; };

// --- Safety plan fields ---
document.querySelectorAll('[data-plan]').forEach(t => {
  t.value = S.plan[t.dataset.plan] || '';
  t.oninput = () => { S.plan[t.dataset.plan] = t.value; keep(); };
});

// --- Trusted contacts ---
const MSG = "Hi, I'm struggling right now. Can you check in on me?";
[0, 1, 2].forEach(i => {
  const c = S.contacts[i];
  const d = document.createElement('div');
  d.className = 'card';
  d.innerHTML = `<input data-k="n" aria-label="Contact ${i + 1} name" placeholder="Name"><input data-k="p" type="tel" aria-label="Contact ${i + 1} phone" placeholder="Phone number"><input data-k="m" aria-label="Contact ${i + 1} Messenger username" placeholder="Messenger username (optional)"><div class="row"></div>`;
  const acts = d.querySelector('.row');
  const draw = () => {
    const p = digits(c.p || ''), m = (c.m || '').trim().replace(/^.*m\.me\//, '').replace(/^@/, '');
    acts.innerHTML = '';
    if (p) acts.insertAdjacentHTML('beforeend', `<a class="btn" href="sms:${p}?body=${encodeURIComponent(MSG)}">Text</a><a class="btn" href="tel:${p}">Call</a>`);
    if (m) {
      const b = document.createElement('button');
      b.textContent = 'Messenger';
      b.onclick = async () => { try { await navigator.clipboard.writeText(MSG); } catch {} open('https://m.me/' + encodeURIComponent(m), '_blank', 'noopener'); };
      acts.appendChild(b);
    }
  };
  d.querySelectorAll('input').forEach(inp => {
    inp.value = c[inp.dataset.k] || '';
    inp.oninput = () => { c[inp.dataset.k] = inp.value; keep(); draw(); };
  });
  draw();
  $('contacts').appendChild(d);
});

// --- Reasons to stay ---
function drawReasons() {
  const ul = $('rlist'); ul.innerHTML = '';
  S.reasons.forEach((r, i) => {
    const li = document.createElement('li');
    li.textContent = r + ' ';
    const b = document.createElement('button');
    b.textContent = 'Remove';
    b.setAttribute('aria-label', 'Remove reason: ' + r);
    b.onclick = () => { S.reasons.splice(i, 1); keep(); drawReasons(); };
    li.appendChild(b); ul.appendChild(li);
  });
}
$('radd').onclick = () => {
  const v = $('rin').value.trim();
  if (!v) return;
  S.reasons.push(v.slice(0, 200)); $('rin').value = ''; keep(); drawReasons();
};
drawReasons();

// --- Crisis help by country (verify numbers before release) ---
// line = [label, number to call, number to text (optional), text body (optional)]
const C = {
  PH: { n: 'Philippines', e: '911', l: [
    ['NCMH Crisis Hotline (toll-free)', '1553'],
    ['NCMH Crisis Hotline, call or text', '0917 899 8727', '0917 899 8727'],
    ['NCMH Crisis Hotline, call or text', '0966 351 4518', '0966 351 4518'],
    ['Hopeline PH (toll-free, Globe/TM)', '2919'],
    ['Hopeline PH', '(02) 8804 4673'],
    ['Hopeline PH, call or text', '0917 558 4673', '0917 558 4673'],
    ['In Touch Crisis Line', '(02) 8893 7603'],
    ['In Touch Crisis Line, call or text', '0917 800 1123', '0917 800 1123']] },
  US: { n: 'United States', e: '911', l: [['988 Suicide & Crisis Lifeline (call or text)', '988', '988'], ['Crisis Text Line (text HOME)', '741741', '741741', 'HOME']] },
  CA: { n: 'Canada', e: '911', l: [['9-8-8 Suicide Crisis Helpline (call or text)', '988', '988']] },
  GB: { n: 'United Kingdom & Ireland', e: '999', l: [['Samaritans', '116 123'], ['Shout (text SHOUT)', '85258', '85258', 'SHOUT']] },
  AU: { n: 'Australia', e: '000', l: [['Lifeline', '13 11 14'], ['Lifeline text', '0477 13 11 14', '0477 13 11 14']] },
  IN: { n: 'India', e: '112', l: [['Tele-MANAS', '14416']] },
  XX: { n: 'Other (112 works in many countries)', e: '112', l: [] }
};
Object.entries(C).forEach(([k, v]) => $('country').add(new Option(v.n, k)));
$('country').value = C[S.country] ? S.country : 'XX';
function drawLines() {
  const c = C[$('country').value];
  $('lines').innerHTML = c.l.map(([n, p, s, b]) => `<div class="card"><div>${n}</div><div class="row"><a class="btn" href="tel:${digits(p)}">Call ${p}</a>${s ? `<a class="btn" href="sms:${digits(s)}${b ? '?body=' + b : ''}">Text</a>` : ''}</div></div>`).join('');
  ['ecall', 'dcall'].forEach(id => { $(id).href = 'tel:' + c.e; $(id).textContent = 'Call ' + c.e + ' (emergency)'; });
}
$('country').onchange = () => { S.country = $('country').value; keep(); drawLines(); };
function openCrisis() {
  drawLines();
  $('lview').hidden = false; $('dview').hidden = true;
  if (!$('crisis').open) $('crisis').showModal();
}
$('dgo').onclick = () => {
  $('lview').hidden = true; $('dview').hidden = false;
  const f = S.contacts.find(c => c && c.p);
  $('dfriend').hidden = !f;
  if (f) { $('dfriend').href = 'tel:' + digits(f.p); $('dfriend').textContent = 'Call ' + (f.n || 'my trusted person'); }
};
$('dback').onclick = () => { $('lview').hidden = false; $('dview').hidden = true; };
$('cclose').onclick = () => $('crisis').close();
$('crisis').onclick = e => { if (e.target === $('crisis')) $('crisis').close(); };

// --- Guided breathing (text always updates; motion only if allowed) ---
const orb = $('orb'), motionOK = matchMedia('(prefers-reduced-motion: no-preference)').matches;
let bt, breathing = false;
function breathe(i = 0) {
  const [t, s, z] = [['Breathe in...', 4, 1.5], ['Hold...', 4, 1.5], ['Breathe out slowly...', 6, 1]][i % 3];
  $('bl').textContent = t;
  if (motionOK) { orb.style.transition = 'transform ' + (i % 3 === 1 ? 0 : s) + 's ease-in-out'; orb.style.transform = 'scale(' + z + ')'; }
  bt = setTimeout(() => breathe(i + 1), s * 1000);
}
$('bgo').onclick = () => {
  breathing = !breathing;
  clearTimeout(bt);
  $('bgo').textContent = breathing ? 'Stop' : 'Start breathing';
  if (breathing) breathe();
  else { $('bl').textContent = 'Ready when you are'; orb.style.transform = ''; }
};

// --- 5-4-3-2-1 grounding ---
const G = [['5', 'things you can see', 'Look around slowly and name five.'], ['4', 'things you can feel', 'Your feet on the floor, your clothes, a surface.'], ['3', 'things you can hear', 'Near or far, loud or quiet.'], ['2', 'things you can smell', 'Or two smells you like.'], ['1', 'thing you can taste', 'Or one thing you would like to taste.']];
let gi = -1;
$('gnext').onclick = () => {
  gi++;
  if (gi >= G.length) { gi = -1; $('gtxt').textContent = 'Well done. Notice how your body feels now. Breathe out slowly.'; $('gnext').textContent = 'Start again'; return; }
  const [n, w, h] = G[gi];
  $('gtxt').textContent = n + ' ' + w + '. ' + h;
  $('gnext').textContent = gi === G.length - 1 ? 'Finish' : 'Next';
};

// --- Wait 15 minutes ---
const WP = ['Feelings rise and fall like waves. You only need to get through this minute.', 'Have some water. Wrap yourself in something warm.', null, 'Move to a room with other people, or step outside.', 'Make your out-breath longer than your in-breath.', 'Text someone, or open your safety plan.', 'You are still here, and that is enough.', null];
let wt;
$('wgo').onclick = () => {
  clearInterval(wt);
  const end = Date.now() + 9e5;
  $('wgo').textContent = 'Restart'; $('wmore').hidden = true;
  const tick = () => {
    const left = Math.max(0, end - Date.now()), s = Math.ceil(left / 1000);
    $('wclock').textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    let m;
    if (!left) {
      clearInterval(wt); $('wmore').hidden = false;
      m = '15 minutes have passed. You stayed with it. How intense is it now? If it is still too much, please reach out.';
    } else {
      const k = Math.floor((9e5 - left) / 6e4);
      m = WP[k % WP.length];
      if (m === null) m = S.reasons.length ? 'One of your reasons: ' + S.reasons[k % S.reasons.length] : 'This feeling is not permanent.';
    }
    if ($('wmsg').textContent !== m) $('wmsg').textContent = m;
  };
  tick(); wt = setInterval(tick, 1000);
};

// --- Soothing sounds (generated on-device, no downloads) ---
let ac, snd, lfo;
function sound(kind) {
  stopSound();
  ac = ac || new (window.AudioContext || window.webkitAudioContext)();
  ac.resume();
  const len = ac.sampleRate * 2, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (kind === 'rain') d[i] = w; else { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
  }
  snd = ac.createBufferSource(); snd.buffer = buf; snd.loop = true;
  const f = ac.createBiquadFilter(), g = ac.createGain();
  f.type = kind === 'rain' ? 'highpass' : 'lowpass';
  f.frequency.value = kind === 'rain' ? 900 : 500;
  g.gain.value = kind === 'rain' ? 0.18 : 0.45;
  snd.connect(f); f.connect(g); g.connect(ac.destination);
  if (kind === 'ocean') {
    lfo = ac.createOscillator(); lfo.frequency.value = 0.1;
    const lg = ac.createGain(); lg.gain.value = 0.35;
    lfo.connect(lg); lg.connect(g.gain); lfo.start();
  }
  snd.start();
}
function stopSound() { try { snd && snd.stop(); lfo && lfo.stop(); } catch {} snd = lfo = null; }
$('rain').onclick = () => sound('rain');
$('ocean').onclick = () => sound('ocean');
$('sstop').onclick = stopSound;

// --- Gentle distraction ---
const D = ['Count backward from 100 by 3s, slowly.', 'Name an animal for each letter of the alphabet.', 'Pick a colour and find five things that colour around you.', 'Describe a meal you love in as much detail as you can.', 'Press your feet into the floor and notice how it feels.', 'Think of a place you have felt calm. What can you see there?', 'Trace slow circles in the air with one finger, then the other.'];
$('dnext').onclick = () => { $('dtxt').textContent = rand(D.filter(x => x !== $('dtxt').textContent)); };

// ===== My data: history, backup, restore, delete =====
function drawHist() {
  const l = S.log.slice(-14);
  $('hist').innerHTML = l.map(x => `<i style="height:${x.n * 10}%" title="${x.n}/10 on ${new Date(x.t).toLocaleDateString()}"></i>`).join('');
  $('histsum').textContent = l.length ? 'Last ' + l.length + ' check-ins, average ' + (l.reduce((a, x) => a + x.n, 0) / l.length).toFixed(1) + '/10. A taller bar means a harder moment.' : 'No check-ins yet.';
}
const b64 = b => b ? new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(b); }) : null;
const unb64 = async u => u ? await (await fetch(u)).blob() : null;
$('exp').onclick = async () => {
  const items = await Promise.all((await all()).map(async i => ({ ...i, photo: await b64(i.photo), voice: await b64(i.voice) })));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify({ v: 1, S, items })], { type: 'application/json' }));
  a.download = 'dark-days-backup-' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  $('bres').textContent = 'Backup downloaded. Keep it somewhere private.';
};
$('imp').onchange = async e => {
  try {
    const d = JSON.parse(await e.target.files[0].text());
    if (!d.S || !Array.isArray(d.items)) throw 0;
    Object.assign(S, d.S); keep();
    for (const i of d.items) await put({ ...i, photo: await unb64(i.photo), voice: await unb64(i.voice) });
    $('bres').textContent = 'Restored. Reloading...';
    setTimeout(() => location.reload(), 800);
  } catch { $('bres').textContent = "That file didn't work."; }
};
$('wipe').onclick = async () => {
  if (!confirm('Delete everything saved in this app on this device? This cannot be undone.')) return;
  try { localStorage.removeItem(LS); } catch {}
  await tx('readwrite', s => s.clear());
  location.reload();
};

// --- Installable + offline (PWA) ---
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
