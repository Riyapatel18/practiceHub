// ============================================
// STATE
// ============================================
const STORAGE_KEY = 'riya_prep_progress_v1';

function getProgress() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch (e) { return {}; }
}
function saveProgress(progress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}
function isMarked(qid) {
  return !!getProgress()[qid];
}
function toggleMarked(qid) {
  const progress = getProgress();
  if (progress[qid]) delete progress[qid];
  else progress[qid] = true;
  saveProgress(progress);
}

// ============================================
// UTIL
// ============================================
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Minimal markdown-ish formatter for answers: supports `inline code`,
// ```code blocks```, and blank-line-separated paragraphs.
function formatAnswer(text) {
  if (!text) return '';
  const blocks = text.split(/```/);
  let html = '';
  blocks.forEach((block, i) => {
    if (i % 2 === 1) {
      html += `<pre><code>${escapeHtml(block.trim())}</code></pre>`;
    } else {
      const paras = block.split(/\n\s*\n/).filter(p => p.trim());
      paras.forEach(p => {
        const withCode = escapeHtml(p.trim()).replace(/`([^`]+)`/g, '<code>$1</code>');
        html += `<p>${withCode.replace(/\n/g, '<br>')}</p>`;
      });
    }
  });
  return html;
}

// ============================================
// SIDEBAR
// ============================================
function renderSidebarNav(activeId) {
  const list = document.getElementById('tableList');
  list.innerHTML = '';

  const homeBtn = document.createElement('button');
  homeBtn.className = 'table-item' + (activeId === 'home' ? ' active' : '');
  homeBtn.innerHTML = `<span class="row-icon">⌂</span><span>home</span>`;
  homeBtn.onclick = () => navigate('home');
  list.appendChild(homeBtn);

  TOPICS.forEach(t => {
    const btn = document.createElement('button');
    btn.className = 'table-item' + (activeId === t.id ? ' active' : '');
    const data = dataCache[t.id];
    const count = data ? data.questions.length : '';
    btn.innerHTML = `<span class="row-icon">▸</span><span>${t.name.toLowerCase().replace(/\s+/g, '_')}</span>${count !== '' ? `<span class="table-count">${count}</span>` : ''}`;
    btn.onclick = () => navigate(t.id);
    list.appendChild(btn);
  });
}

async function updateOverallProgress() {
  const all = await loadAllTopicsData();
  let total = 0, done = 0;
  const progress = getProgress();
  Object.values(all).forEach(topicData => {
    (topicData.questions || []).forEach(q => {
      total++;
      if (progress[q.id]) done++;
    });
  });
  const pct = total ? Math.round((done / total) * 100) : 0;
  document.getElementById('overallProgressFill').style.width = pct + '%';
  document.getElementById('overallProgressText').textContent = `${done} / ${total} reviewed`;
  renderSidebarNav(currentTopic || 'home');
}

// ============================================
// HOME PAGE
// ============================================
async function renderHome() {
  document.getElementById('breadcrumbCurrent').textContent = 'home';
  const content = document.getElementById('content');
  const all = await loadAllTopicsData();
  const progress = getProgress();

  const cards = TOPICS.map(t => {
    const data = all[t.id] || { questions: [] };
    const total = data.questions.length;
    const done = data.questions.filter(q => progress[q.id]).length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    return `
      <button class="topic-card" onclick="navigate('${t.id}')">
        <div class="topic-card-top">
          <span class="topic-card-name">${t.name}</span>
          <span class="topic-card-count">${done}/${total}</span>
        </div>
        <div class="topic-card-bar"><div class="topic-card-bar-fill" style="width:${pct}%"></div></div>
      </button>`;
  }).join('');

  content.innerHTML = `
    <div class="hero">
      <div class="hero-eyebrow">// interview prep console</div>
      <div class="hero-query"><span class="kw">SELECT</span> confidence <span class="kw">FROM</span> riya
<span class="kw">WHERE</span> topic <span class="kw">IN</span> (<span class="str">'sql'</span>, <span class="str">'excel'</span>, <span class="str">'power_bi'</span>, <span class="str">'python'</span>, <span class="str">'stats'</span>)
<span class="kw">AND</span> prep_status = <span class="str">'in_progress'</span>; <span class="cmt">-- restarting after a 2-month break, one topic at a time</span><span class="cursor"></span></div>
      <p class="hero-sub">One place for every revision topic — no more juggling tabs. Expand a question, review the answer, mark it done, and pick up right where you left off.</p>
    </div>

    <div class="section-label">topics</div>
    <div class="topic-grid">${cards}</div>
  `;
}

// ============================================
// TOPIC PAGE
// ============================================
let currentTopic = null;

async function renderTopic(topicId) {
  const topic = TOPICS.find(t => t.id === topicId);
  if (!topic) { navigate('home'); return; }
  currentTopic = topicId;
  document.getElementById('breadcrumbCurrent').textContent = topic.name.toLowerCase().replace(/\s+/g, '_');

  const content = document.getElementById('content');
  content.innerHTML = `<div class="empty-state">loading ${topic.name.toLowerCase()}...</div>`;

  const data = await loadTopicData(topicId);
  const questions = data.questions || [];

  // group by subtopic
  const groups = {};
  questions.forEach(q => {
    const key = q.subtopic || 'General';
    if (!groups[key]) groups[key] = [];
    groups[key].push(q);
  });

  const subtopicNames = Object.keys(groups);

  let bodyHtml = `
    <div class="topic-header">
      <h1 class="topic-title">${topic.name}</h1>
      <p class="topic-desc">${data.description || ''}</p>
    </div>
  `;

  if (subtopicNames.length > 1) {
    bodyHtml += `<div class="pill-nav">${subtopicNames.map(s => `<button onclick="scrollToSubtopic('${slugify(s)}')">${s}</button>`).join('')}</div>`;
  }

  if (questions.length === 0) {
    bodyHtml += `<div class="empty-state">No questions added yet for ${topic.name}. Add them to data/${topic.file.split('/').pop()}</div>`;
  } else {
    subtopicNames.forEach(sub => {
      bodyHtml += `<div class="section-label" id="sub-${slugify(sub)}">${sub}</div>`;
      bodyHtml += `<div class="qa-table">`;
      groups[sub].forEach((q, i) => {
        const marked = isMarked(q.id);
        bodyHtml += `
          <div class="qa-row" data-qid="${q.id}">
            <details>
              <summary class="qa-row-header">
                <span class="qa-index">${String(i + 1).padStart(2, '0')}</span>
                <span class="qa-question">${escapeHtml(q.question)}</span>
                ${q.difficulty ? `<span class="qa-difficulty ${q.difficulty}">${q.difficulty}</span>` : ''}
                <span class="qa-chevron">▶</span>
              </summary>
              <div class="qa-answer">
                ${formatAnswer(q.answer)}
                <button class="qa-mark-btn ${marked ? 'marked' : ''}" onclick="event.stopPropagation(); handleMarkClick(this, '${q.id}')">
                  ${marked ? 'reviewed' : 'mark as reviewed'}
                </button>
              </div>
            </details>
          </div>`;
      });
      bodyHtml += `</div>`;
    });
  }

  // Practice section
  if (data.practice && data.practice.length > 0) {
    bodyHtml += `<div class="section-label">practice — answers go to your prep partner</div>`;
    data.practice.forEach((p, i) => {
      bodyHtml += renderPracticeBox(topic.id, p, i);
    });
  }

  content.innerHTML = bodyHtml;
  wireUpPracticeForms();
}

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function scrollToSubtopic(slug) {
  const el = document.getElementById('sub-' + slug);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function handleMarkClick(btn, qid) {
  toggleMarked(qid);
  const marked = isMarked(qid);
  btn.classList.toggle('marked', marked);
  btn.textContent = marked ? 'reviewed' : 'mark as reviewed';
  updateOverallProgress();
}

// ============================================
// PRACTICE FORM (Formspree)
// ============================================
function renderPracticeBox(topicId, p, i) {
  const boxId = `practice-${topicId}-${i}`;
  return `
    <div class="practice-box">
      <div class="practice-prompt">${escapeHtml(p.question)}</div>
      <div class="practice-meta">Write your answer below, then submit — it'll land straight in your prep partner's inbox for review.</div>
      <form class="practice-form" id="${boxId}" data-question="${escapeHtml(p.question)}" data-topic="${topicId}">
        <input type="email" name="_replyto" placeholder="your email (optional, in case they want to reply)">
        <textarea name="answer" placeholder="Type your answer here..." required></textarea>
        <div class="practice-actions">
          <button type="submit" class="btn-submit">Submit answer</button>
          <span class="practice-status"></span>
        </div>
      </form>
    </div>`;
}

function wireUpPracticeForms() {
  document.querySelectorAll('.practice-form').forEach(form => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const statusEl = form.querySelector('.practice-status');
      const btn = form.querySelector('.btn-submit');
      const question = form.dataset.question;
      const topic = form.dataset.topic;
      const answer = form.querySelector('textarea[name="answer"]').value;
      const replyto = form.querySelector('input[name="_replyto"]').value;

      if (FORMSPREE_ENDPOINT_ID === 'YOUR_FORM_ID_HERE') {
        statusEl.textContent = 'Formspree not configured yet — see js/data-loader.js';
        statusEl.classList.add('error');
        return;
      }

      btn.disabled = true;
      statusEl.textContent = 'Sending...';
      statusEl.classList.remove('error');

      try {
        const res = await fetch(`https://formspree.io/f/${FORMSPREE_ENDPOINT_ID}`, {
          method: 'POST',
          headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic,
            question,
            answer,
            _replyto: replyto || undefined,
            _subject: `Riya's practice answer — ${topic}`,
          }),
        });
        if (res.ok) {
          statusEl.textContent = 'Sent ✓';
          form.querySelector('textarea').value = '';
        } else {
          throw new Error('Request failed');
        }
      } catch (err) {
        statusEl.textContent = 'Failed to send — try again.';
        statusEl.classList.add('error');
      } finally {
        btn.disabled = false;
      }
    });
  });
}

// ============================================
// SEARCH
// ============================================
let searchDebounce;
document.getElementById('searchInput').addEventListener('input', (e) => {
  clearTimeout(searchDebounce);
  const q = e.target.value.trim();
  searchDebounce = setTimeout(() => runSearch(q), 200);
});

async function runSearch(query) {
  if (!query) {
    if (currentTopic) renderTopic(currentTopic); else renderHome();
    return;
  }
  const all = await loadAllTopicsData();
  const lower = query.toLowerCase();
  const results = [];
  TOPICS.forEach(t => {
    (all[t.id]?.questions || []).forEach(q => {
      if (q.question.toLowerCase().includes(lower) || (q.answer || '').toLowerCase().includes(lower)) {
        results.push({ ...q, topicName: t.name, topicId: t.id });
      }
    });
  });

  document.getElementById('breadcrumbCurrent').textContent = `search: "${query}"`;
  const content = document.getElementById('content');
  if (results.length === 0) {
    content.innerHTML = `<div class="empty-state">No matches for "${escapeHtml(query)}"</div>`;
    return;
  }
  let html = `<div class="topic-header"><h1 class="topic-title">Search results</h1><p class="topic-desc">${results.length} match(es) for "${escapeHtml(query)}"</p></div><div class="qa-table">`;
  results.forEach((q, i) => {
    const marked = isMarked(q.id);
    html += `
      <div class="qa-row">
        <details>
          <summary class="qa-row-header">
            <span class="qa-index">${String(i + 1).padStart(2, '0')}</span>
            <span class="qa-question">${escapeHtml(q.question)} <span style="color:var(--text-faint);font-family:var(--font-mono);font-size:11px;">— ${q.topicName}</span></span>
            <span class="qa-chevron">▶</span>
          </summary>
          <div class="qa-answer">
            ${formatAnswer(q.answer)}
            <button class="qa-mark-btn ${marked ? 'marked' : ''}" onclick="event.stopPropagation(); handleMarkClick(this, '${q.id}')">
              ${marked ? 'reviewed' : 'mark as reviewed'}
            </button>
          </div>
        </details>
      </div>`;
  });
  html += `</div>`;
  content.innerHTML = html;
}

// ============================================
// ROUTING
// ============================================
async function navigate(id) {
  window.location.hash = id;
  closeSidebar();
  document.getElementById('searchInput').value = '';
  if (id === 'home') {
    currentTopic = null;
    await renderHome();
  } else {
    await renderTopic(id);
  }
  renderSidebarNav(id);
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', () => {
  const id = window.location.hash.replace('#', '') || 'home';
  navigate(id);
});

// ============================================
// SIDEBAR TOGGLE (mobile)
// ============================================
function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebarScrim').classList.add('show');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarScrim').classList.remove('show');
}
document.getElementById('menuBtn').addEventListener('click', openSidebar);
document.getElementById('sidebarClose').addEventListener('click', closeSidebar);
document.getElementById('sidebarScrim').addEventListener('click', closeSidebar);

// ============================================
// INIT
// ============================================
(async function init() {
  await loadAllTopicsData();
  const startId = window.location.hash.replace('#', '') || 'home';
  renderSidebarNav(startId);
  if (startId === 'home') await renderHome(); else await renderTopic(startId);
  await updateOverallProgress();
})();
