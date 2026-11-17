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
document.querySelectorAll('nav button').forEach(b => {
  b.onclick = () => {
    document.querySelectorAll('nav button').forEach(x => x.classList.toggle('on', x === b));
    document.querySelectorAll('.view').forEach(v => v.hidden = v.id !== b.dataset.v);
    if (b.dataset.v === 'voices') countVoices();
  };
});

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
