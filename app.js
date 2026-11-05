/* 楞嚴經選注：開發版前端（無框架） */
(() => {
  const D = window.SURANGAMA;
  if (!D) { document.body.innerHTML = '<p style="padding:20px">data.js 沒載入</p>'; return; }

  const ZHU_ORDER = Object.keys(D.zhu);
  const KE_ORDER = Object.keys(D.ke);
  const JUAN_LABEL = (j) => (j === 0 ? '卷首' : '卷' + j);
  const state = { juan: 1, sel: null, tab: 'notes', cat: null, dq: '', ke: KE_ORDER[0] };

  const $ = (s) => document.querySelector(s);
  const textPane = $('#textPane'), notesPane = $('#notesPane'), kePane = $('#kePane');
  const altPane = $('#altPane'), dictPane = $('#dictPane');
  const fullPane = $('#fullPane'), fullSel = $('#fullSel'), fullBody = $('#fullBody');
  const juanSel = $('#juan'), q = $('#q'), hint = $('#hint');
  const keSel = $('#keSel'), keBody = $('#keBody'), altHead = $('#altHead'), altBody = $('#altBody');

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------- 卷選單
  const juans = [...new Set(D.sutra.sentences.map((s) => s.juan))].sort((a, b) => a - b);
  for (const j of juans) {
    const o = document.createElement('option');
    o.value = String(j); o.textContent = JUAN_LABEL(j);
    juanSel.appendChild(o);
  }
  juanSel.value = String(state.juan);
  juanSel.onchange = () => { state.juan = Number(juanSel.value); state.sel = null; renderText(); renderNotes(); };

  // ---------- 經文
  function renderText() {
    const kw = q.value.trim();
    const list = D.sutra.sentences.filter((s) => s.juan === state.juan && (!kw || s.text.includes(kw)));
    textPane.innerHTML = '';
    let lastPage = '';
    for (const s of list) {
      const div = document.createElement('div');
      div.className = 'sent' + (s.i === state.sel ? ' sel' : '');
      div.dataset.s = String(s.i);
      if (s.page && s.page !== lastPage) {
        const pg = document.createElement('span');
        pg.className = 'page'; pg.textContent = s.page;
        div.appendChild(pg);
        lastPage = s.page;
      }
      const t = document.createElement('span');
      t.textContent = s.text;
      div.appendChild(t);
      div.onclick = () => selectSentence(s.i);
      textPane.appendChild(div);
    }
    hint.textContent = kw ? `命中 ${list.length} 句` : `${list.length} 句`;
    if (!list.length) textPane.innerHTML = '<p class="empty">沒有符合的句子。</p>';
  }

  function selectSentence(i) {
    state.sel = i;
    for (const el of textPane.querySelectorAll('.sent.sel')) el.classList.remove('sel');
    const el = textPane.querySelector(`.sent[data-s="${i}"]`);
    if (el) { el.classList.add('sel'); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    if (state.tab === 'notes') renderNotes();
  }

  // ---------- 注疏
  function renderNotes() {
    if (state.sel == null) {
      notesPane.innerHTML = '<p class="empty">點一句經文，這裡列出六家注疏與圓瑛講義。</p>';
      return;
    }
    const s = state.sel;
    const parts = [];
    for (const id of ZHU_ORDER) {
      const w = D.zhu[id];
      const fr = D.align[id] && D.align[id][s];
      if (!fr || !fr.length) continue;
      const frags = fr.map((f) => {
        const [start, end, page] = f;
        const text = w.text.slice(start, end).replace(/\s+/g, ' ').trim();
        return `<div class="frag">${esc(text)}${page ? `<span class="pg">p.${esc(String(page))}</span>` : ''}</div>`;
      }).join('');
      parts.push(`<div class="note"><h3>${esc(w.title)}<span class="author">${esc(w.author)}</span></h3>${frags}</div>`);
    }
    notesPane.innerHTML = parts.length ? parts.join('') : '<p class="empty">這一句目前沒有對上的注疏。</p>';
  }

  // ---------- 科判
  for (const id of KE_ORDER) {
    const o = document.createElement('option');
    o.value = id; o.textContent = `${D.ke[id].title}${D.ke[id].author ? '（' + D.ke[id].author + '）' : ''}`;
    keSel.appendChild(o);
  }
  keSel.onchange = () => { state.ke = keSel.value; renderKe(); };
  function renderKe() {
    const w = D.ke[state.ke];
    if (!w) { keBody.textContent = '沒有資料。'; return; }
    keBody.innerHTML = `<h3>${esc(w.title)}<span class="author">${esc(w.author)}</span></h3><pre>${esc(w.text)}</pre>`;
  }

  // ---------- 別譯
  function renderAlt() {
    const t = D.english && D.english.juan[String(state.juan)];
    altHead.textContent = `${D.english.label}・${JUAN_LABEL(state.juan)}`;
    altBody.innerHTML = t ? `<pre>${esc(t)}</pre>` : '<p class="empty">這一卷沒有英譯。</p>';
  }

  // ---------- 全文
  const FULL_LIST = [
    ...ZHU_ORDER.map((id) => ({ id, g: '注疏', t: D.zhu[id].title })),
    ...KE_ORDER.map((id) => ({ id, g: '科判', t: D.ke[id].title })),
    ...(D.extra ? Object.entries(D.extra).map(([id, x]) => ({ id, g: '當代', t: x.title })) : []),
  ];
  for (const it of FULL_LIST) {
    const o = document.createElement('option');
    o.value = it.id; o.textContent = `${it.g}｜${it.t}`;
    fullSel.appendChild(o);
  }
  state.full = FULL_LIST[0] ? FULL_LIST[0].id : null;
  fullSel.value = state.full;
  fullSel.onchange = () => renderFull(fullSel.value);

  function fullSrc(id) { return D.zhu[id] || D.ke[id] || (D.extra && D.extra[id]); }

  function renderFull(id, pos) {
    const src = fullSrc(id);
    if (!src) return;
    state.full = id;
    if (fullSel.value !== id) fullSel.value = id;
    fullBody.textContent = src.text;
    if (typeof pos === 'number' && pos >= 0) {
      const node = fullBody.firstChild;
      if (node && node.textContent) {
        const len = node.textContent.length;
        const start = Math.min(pos, len);
        const r = document.createRange();
        r.setStart(node, start);
        r.setEnd(node, Math.min(start + 1, len));
        const sel = window.getSelection();
        sel.removeAllRanges(); sel.addRange(r);
        const rect = r.getBoundingClientRect();
        const host = fullPane.getBoundingClientRect();
        fullPane.scrollTop += rect.top - host.top - 120;
      }
    }
  }

  // ---------- 辭典
  const chips = $('#chips'), dq = $('#dq'), dictList = $('#dictList'), dictDetail = $('#dictDetail');
  const CATS = [{ id: null, label: '全部' }, ...D.glossary.categories.map((c) => ({ id: c.id, label: c.label }))];
  for (const c of CATS) {
    const b = document.createElement('button');
    b.textContent = c.id ? `${c.label} ${D.glossary.categories.find((x) => x.id === c.id).count}` : '全部';
    b.className = c.id === null ? 'on' : '';
    b.onclick = () => {
      state.cat = c.id;
      for (const x of chips.children) x.classList.toggle('on', x === b);
      renderDictList();
    };
    chips.appendChild(b);
  }
  dq.oninput = () => { state.dq = dq.value.trim().toLowerCase(); renderDictList(); };

  function match(e) {
    if (state.cat && e.category !== state.cat) return false;
    if (!state.dq) return true;
    const hay = [e.term, ...(e.aliases || []), e.gloss, e.sa, e.tib, e.en, e.ref, e.category].filter(Boolean).join(' ').toLowerCase();
    return hay.includes(state.dq);
  }

  function renderDictList() {
    const list = D.glossary.entries.filter(match);
    dictList.innerHTML = '';
    for (const e of list) {
      const b = document.createElement('button');
      b.innerHTML = `${esc(e.term)}<small>${e.count || "—"}</small>`;
      b.onclick = () => showEntry(e);
      dictList.appendChild(b);
    }
    if (!list.length) dictList.innerHTML = '<p class="empty">沒有符合的詞條。</p>';
  }

  function showEntry(e) {
    const lex = [['梵', e.sa], ['藏', e.tib], ['英', e.en]].filter(([, v]) => v)
      .map(([k, v]) => `<div><b>${k}</b>${esc(v)}</div>`).join('');
    const ref = e.ref ? `<div><b>呂</b>${esc(e.ref)}</div>` : '';
    const hits = Object.entries(e.workHits || {}).sort((a, b) => b[1] - a[1])
      .map(([id, n]) => `${(D.zhu[id] || {}).title || id} ${n}`).join('、');
    const occ = (e.occurrences || []).slice(0, 5).map((o) =>
      `<div class="occ" data-s="${o.s}" data-j="${o.juan}"><span class="pg">${JUAN_LABEL(o.juan)} ${esc(o.page)}</span>${esc(o.quote)}</div>`
    ).join('');
    const rel = (e.related || []).map((id) => {
      const t = D.glossary.entries.find((x) => x.id === id);
      return t ? `<button class="rel" data-id="${esc(id)}">${esc(t.term)}</button>` : '';
    }).join('');
    const wl = (e.workLinks || []).map((l) => {
      const src = D.zhu[l.id] || D.ke[l.id] || (D.extra && D.extra[l.id]) || {};
      return `<button class="wl" data-id="${esc(l.id)}" data-pos="${l.pos}">${esc(src.title || l.id)}</button>`;
    }).join('');
    dictDetail.innerHTML = `
      <h2>${esc(e.term)}</h2>
      <div class="cat">${esc(e.category)}${e.ref ? '・呂澂' + esc(e.ref) : ''}</div>
      <div class="gloss">${esc(e.gloss)}</div>
      ${e.editorNote ? `<div class="editorNote"><b>編者按</b>${esc(e.editorNote)}</div>` : ''}
      ${rel ? `<div class="related"><b>相關</b>${rel}</div>` : ''}
      ${wl ? `<div class="related"><b>原文</b>${wl}</div>` : ''}
      <div class="lex">${lex}${ref}${hits ? `<div><b>注</b>${esc(hits)}</div>` : ''}</div>
      <div class="cat" style="margin-top:10px">主文出現 ${e.count} 次${e.truncated ? '（只列前 200 筆）' : ''}</div>
      ${occ || '<p class="empty">研究條目，無主文出處。</p>'}`;
    for (const el of dictDetail.querySelectorAll('.wl')) {
      el.onclick = () => { switchTab('full'); renderFull(el.dataset.id, Number(el.dataset.pos)); };
    }
    for (const el of dictDetail.querySelectorAll('.rel')) {
      el.onclick = () => {
        const t = D.glossary.entries.find((x) => x.id === el.dataset.id);
        if (t) showEntry(t);
      };
    }
    for (const el of dictDetail.querySelectorAll('.occ')) {
      el.onclick = () => {
        const s = Number(el.dataset.s), j = Number(el.dataset.j);
        state.juan = j; juanSel.value = String(j);
        renderText();
        selectSentence(s);
        switchTab('notes');
      };
    }
  }

  // ---------- 分頁
  const panes = { notes: notesPane, ke: kePane, alt: altPane, dict: dictPane, full: fullPane };
  function switchTab(name) {
    state.tab = name;
    for (const b of document.querySelectorAll('.tabs button')) b.classList.toggle('on', b.dataset.tab === name);
    for (const [k, el] of Object.entries(panes)) el.hidden = k !== name;
    if (name === 'notes') renderNotes();
    if (name === 'ke') renderKe();
    if (name === 'alt') renderAlt();
    if (name === 'full') renderFull(state.full);
  }
  for (const b of document.querySelectorAll('.tabs button')) b.onclick = () => switchTab(b.dataset.tab);

  q.oninput = () => renderText();

  // ---------- 初始
  renderText();
  renderNotes();
  renderKe();
  renderAlt();
  renderDictList();
})();
