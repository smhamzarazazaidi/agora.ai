// ─── CONFIG ───
const API_BASE = 'http://localhost:5000';

// ─── MESSAGE STORAGE ───
let genduet_messages = JSON.parse(localStorage.getItem('genduet_messages') || '[]');

function saveMessages() {
  localStorage.setItem('genduet_messages', JSON.stringify(genduet_messages));
}

function generateMsgId() {
  return "m" + Math.floor(1000 + Math.random() * 9000);
}

async function uploadDocument(file, statusElId) {
  const statusEl = document.getElementById(statusElId);
  if (statusEl) {
    statusEl.textContent = "⏳ Uploading...";
    statusEl.className = "upload-status";
  }

  const formData = new FormData();
  formData.append('document', file);

  try {
    const res = await fetch(`${API_BASE}/api/rag/upload`, {
      method: 'POST',
      body: formData,
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    const data = await res.json();
    if (data.success) {
      if (statusEl) {
        statusEl.textContent = `✓ Document loaded (${data.chunks} chunks)`;
        statusEl.className = "upload-status success";
      }
      return true;
    } else {
      throw new Error(data.error || 'Upload failed');
    }
  } catch (err) {
    console.error('[Upload Error]', err);
    if (statusEl) {
      statusEl.textContent = "✗ Upload failed";
      statusEl.className = "upload-status error";
    }
    return false;
  }
}

async function handleFileUpload(input) {
  if (!input.files || input.files.length === 0) return;
  await uploadDocument(input.files[0], 'uploadStatus');
}

let portalFile = null;
function handlePortalFile(input) {
  if (!input.files || input.files.length === 0) return;
  portalFile = input.files[0];
  const zone = document.getElementById('portalUploadZone');
  const text = document.getElementById('portalUploadText');
  zone.classList.add('ready');
  text.textContent = `✓ ${portalFile.name} ready`;
}

async function submitPortalIdea() {
  const idea = document.getElementById('portalIdeaInput').value.trim();
  const errorEl = document.getElementById('portalError');
  const startBtn = document.getElementById('portalStartBtn');

  if (!idea) {
    errorEl.style.display = 'block';
    return;
  }
  errorEl.style.display = 'none';

  if (portalFile) {
    startBtn.disabled = true;
    startBtn.textContent = "Uploading...";
    const success = await uploadDocument(portalFile, null);
    if (!success) {
      startBtn.disabled = false;
      startBtn.textContent = "Start Reasoning →";
      alert("Failed to upload document. Please try again.");
      return;
    }
  }

  document.getElementById('ideaInput').value = idea;
  showPage('app');
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const isCollapsed = sidebar.classList.toggle('collapsed');
  localStorage.setItem('sidebarCollapsed', isCollapsed);
}

// Removed startFromPortal as it is replaced by submitPortalIdea

function renderLaTeX(el) {
  if (window.renderMathInElement) {
    renderMathInElement(el, {
      delimiters: [
        {left: '$$', right: '$$', display: true},
        {left: '$', right: '$', display: false},
        {left: '\\(', right: '\\)', display: false},
        {left: '\\[', right: '\\]', display: true}
      ],
      throwOnError : false
    });
  }
}

// ─── PAGE ROUTING ───
function showPage(name){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  const target = document.getElementById('page-'+name);
  if (target) target.classList.add('active');
  window.scrollTo(0,0);
  
  if (name === 'app') {
    renderHistory();
  }
}
function switchAuthCard(mode){
  document.getElementById('auth-signup-card').style.display=mode==='signup'?'block':'none';
  document.getElementById('auth-login-card').style.display=mode==='login'?'block':'none';
}

// ─── AUTH LOGIC (Disabled) ───
let currentUser = { id: 'hackathon-user', name: 'Guest' };
let authToken = 'hackathon-bypass-token';

function handleGuestMode() {
  showPage('portal');
}

// Initial check (Simplified)
window.addEventListener('DOMContentLoaded', () => {
  const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
  if (isCollapsed) {
    document.getElementById('sidebar').classList.add('collapsed');
  }
  showPage('portal');
});

// ─── SETTINGS ───
let totalRounds=3;
let depth='fast';
function changeRounds(d){
  totalRounds=Math.min(5,Math.max(1,totalRounds+d));
  document.getElementById('roundsDisplay').textContent=totalRounds;
}
function setDepth(d){
  depth=d;
  document.getElementById('opt-fast').classList.toggle('active',d==='fast');
  document.getElementById('opt-deep').classList.toggle('active',d==='deep');
}

// ─── UI HELPERS ───
function createRoundBlock(r) {
  const body = document.getElementById('arenaBody');
  const block = document.createElement('div');
  block.className = 'round-block';
  block.id = `round-block-${r}`;
  block.innerHTML = `<div class="round-header"><span class="round-label">Round ${r}</span><div class="round-line"></div></div>`;
  body.appendChild(block);
  return block;
}

function parseReplyTags(content) {
  const regex = /<m(\d{4})-reply>([\s\S]*?)<\/m\1-reply>/g;
  return content.replace(regex, (match, id, text) => {
    return `
      <div class="quote-block">
        <div class="quote-header">replying to <a class="quote-link" onclick="jumpToMessage('m${id}')">m${id}</a></div>
        <div class="quote-content">${text}</div>
      </div>
    `;
  });
}

function jumpToMessage(id) {
  const el = document.querySelector(`[data-message-id="${id}"]`);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('highlight-msg');
    setTimeout(() => el.classList.remove('highlight-msg'), 1500);
  }
}

function renderReactions(msgId, reactions = {}) {
  const emojis = ['👍', '🔥', '🤔', '❌'];
  const userReactions = JSON.parse(localStorage.getItem('genduet_my_reactions') || '{}');
  
  return `
    <div class="reaction-bar">
      ${emojis.map(e => {
        const count = reactions[e] || 0;
        const isActive = userReactions[`${msgId}_${e}`];
        return `
          <button class="reaction-btn ${isActive ? 'active' : ''}" onclick="reactToMessage('${msgId}', '${e}')">
            <span>${e}</span>
            ${count > 0 ? `<span>${count}</span>` : ''}
          </button>
        `;
      }).join('')}
      <button class="reply-btn" onclick="openReplyInput('${msgId}')">Reply</button>
    </div>
  `;
}

function addMessageToUI(msg, container, skipSave = false) {
  const card = document.createElement('div');
  const isRight = msg.agent === 'You' || msg.agent.includes('User');
  card.className = `msg-card ${isRight ? 'right' : 'left'}`;
  
  const mId = msg.id || generateMsgId();
  card.setAttribute('data-message-id', mId);
  const contentId = `content-${mId}`;
  
  if (!skipSave) {
    genduet_messages.push({
      id: mId,
      author: msg.agent,
      content: msg.content,
      summary: msg.summary,
      color: msg.color,
      timestamp: Date.now(),
      reactions: {},
      replies: []
    });
    saveMessages();
  }

  const parsedContent = parseReplyTags(msg.content.replace(/\n/g, '<br>'));

  card.innerHTML = `
    <div class="msg-inner ${msg.color || 'blue'}">
      <div class="msg-agent">
        <span class="agent-dot ${msg.color || 'blue'}"></span>
        <span class="agent-name">${msg.agent}</span>
        <span class="msg-id-label">${mId}</span>
        ${msg.role ? `<span class="agent-role">· ${msg.role}</span>` : ''}
      </div>
      <div class="msg-summary">${msg.summary || msg.content.substring(0, 100) + '...'}</div>
      <div class="msg-content" id="${contentId}">
        ${parsedContent}
        ${msg.code_snippet ? `<div style="margin-top:1rem; background:var(--bg2); padding:.75rem; border-radius:4px; font-family:monospace; font-size:0.8rem; overflow-x:auto"><code>${msg.code_snippet}</code><br><small style="color:var(--text3)">Output: ${msg.code_output}</small></div>` : ''}
        ${msg.modelUsed ? `<div style="font-size:0.65rem; color:var(--text3); margin-top:0.75rem">Model: ${msg.modelUsed}</div>` : ''}
        ${renderReactions(mId, msg.reactions)}
        <div id="replies-container-${mId}"></div>
      </div>
      <button class="see-more-btn" onclick="toggleMessage('${contentId}', this)">
        <span class="icon">▼</span>
        <span class="label">Show Reasoning</span>
      </button>
    </div>`;
  
  container.appendChild(card);
  renderLaTeX(card);

  if (msg.replies && msg.replies.length > 0) {
    const replyContainer = card.querySelector(`#replies-container-${mId}`);
    msg.replies.forEach(r => renderReply(r, replyContainer));
  }

  requestAnimationFrame(() => requestAnimationFrame(() => card.classList.add('visible')));
  const body = document.getElementById('arenaBody');
  body.scrollTop = body.scrollHeight;
}

function renderReply(reply, container) {
  const div = document.createElement('div');
  div.className = 'quote-block';
  div.style.marginLeft = '1rem';
  div.innerHTML = `
    <div class="quote-header"><b>${reply.from}</b> replied:</div>
    <div class="quote-content">${reply.content}</div>
  `;
  container.appendChild(div);
  renderLaTeX(div);
}

function reactToMessage(msgId, emoji) {
  const userReactions = JSON.parse(localStorage.getItem('genduet_my_reactions') || '{}');
  const msgKey = `${msgId}_${emoji}`;
  const msg = genduet_messages.find(m => m.id === msgId);
  if (!msg) return;
  msg.reactions = msg.reactions || {};
  if (userReactions[msgKey]) {
    msg.reactions[emoji] = Math.max(0, (msg.reactions[emoji] || 1) - 1);
    delete userReactions[msgKey];
  } else {
    msg.reactions[emoji] = (msg.reactions[emoji] || 0) + 1;
    userReactions[msgKey] = true;
  }
  localStorage.setItem('genduet_my_reactions', JSON.stringify(userReactions));
  saveMessages();
  const card = document.querySelector(`[data-message-id="${msgId}"]`);
  const bar = card.querySelector('.reaction-bar');
  bar.outerHTML = renderReactions(msgId, msg.reactions);
}

function openReplyInput(msgId) {
  const container = document.getElementById(`content-${msgId}`);
  let wrap = container.querySelector('.reply-input-wrap');
  if (wrap) {
    wrap.remove();
    return;
  }
  wrap = document.createElement('div');
  wrap.className = 'reply-input-wrap';
  wrap.innerHTML = `
    <textarea class="reply-textarea" id="reply-input-${msgId}"><${msgId}-reply></${msgId}-reply></textarea>
    <div style="display:flex; gap:0.5rem">
      <button class="btn btn-primary" style="padding:0.4rem 0.8rem; font-size:0.8rem" onclick="submitReply('${msgId}')">Send Reply</button>
      <button class="btn btn-outline" style="padding:0.4rem 0.8rem; font-size:0.8rem" onclick="this.parentElement.parentElement.remove()">Cancel</button>
    </div>
  `;
  container.appendChild(wrap);
  const textarea = wrap.querySelector('textarea');
  const pos = `<${msgId}-reply>`.length;
  textarea.setSelectionRange(pos, pos);
  textarea.focus();
}

function submitReply(msgId) {
  const textarea = document.getElementById(`reply-input-${msgId}`);
  const raw = textarea.value;
  const match = raw.match(new RegExp(`<${msgId}-reply>([\\s\\S]*?)</${msgId}-reply>`));
  if (!match) {
    alert("Please keep the reply tags!");
    return;
  }
  const text = match[1].trim();
  if (!text) return;
  const msg = genduet_messages.find(m => m.id === msgId);
  if (!msg) return;
  const reply = { from: "User", content: text, replyTag: `${msgId}-reply` };
  msg.replies = msg.replies || [];
  msg.replies.push(reply);
  saveMessages();
  renderReply(reply, document.getElementById(`replies-container-${msgId}`));
  textarea.parentElement.remove();
}

function renderHistory() {
  const body = document.getElementById('arenaBody');
  if (genduet_messages.length > 0) {
    body.innerHTML = '';
    const block = createRoundBlock("History");
    genduet_messages.forEach(m => addMessageToUI(m, block, true));
  }
}

function toggleMessage(id, btn) {
  const content = document.getElementById(id);
  const isExpanded = content.classList.toggle('expanded');
  btn.querySelector('.label').textContent = isExpanded ? 'Show Less' : 'Show Reasoning';
  btn.querySelector('.icon').textContent = isExpanded ? '▲' : '▼';
}

function displayVerdict(verdict) {
  const body = document.getElementById('arenaBody');
  const card = document.createElement('div');
  card.className = 'verdict-card';
  const assumptionsHtml = (verdict.assumptions || []).map(a => `
    <div class="assumption-item">
      <span>${a.text}</span>
      <span class="status-badge status-${a.status.toLowerCase()}">${a.status}</span>
    </div>
  `).join('');
  const actionsHtml = (verdict.nextActions || []).map((a, i) => `
    <div class="action-item">
      <div class="action-num">${i+1}</div>
      <div>
        <div style="font-weight:600; font-size:0.95rem; margin-bottom:0.25rem">${a.action}</div>
        <div class="action-details">
          <div class="action-sub"><b>WHO:</b> ${a.who}</div>
          <div class="action-sub"><b>WHEN:</b> ${a.when}</div>
          <div class="action-sub" style="grid-column: span 2"><b>SUCCESS:</b> ${a.success}</div>
        </div>
      </div>
    </div>
  `).join('');
  card.innerHTML = `
    <div class="brief-header">
      <div class="brief-label">Decision Brief</div>
      <div class="brief-title">${verdict.decision}</div>
    </div>
    <div class="brief-section">
      <div class="brief-section-title">Core Assumptions</div>
      <div>${assumptionsHtml}</div>
    </div>
    <div class="brief-section">
      <div class="brief-grid">
        <div>
          <div class="grid-col-title">Strongest Version (Steelman)</div>
          <div class="grid-text steelman">${verdict.steelman}</div>
        </div>
        <div>
          <div class="grid-col-title">Strongest Case Against</div>
          <div class="grid-text case-against">${verdict.caseAgainst}</div>
        </div>
      </div>
    </div>
    <div class="brief-section">
      <div class="brief-section-title">What You're Missing</div>
      <div class="grid-text">${verdict.missing}</div>
    </div>
    <div class="brief-section">
      <div class="brief-section-title">Recommendation</div>
      <div class="recommendation-box" style="border-left-color: ${verdict.recommendation.action === 'PROCEED' ? 'var(--green-text)' : verdict.recommendation.action === 'PIVOT' ? 'var(--amber-text)' : '#e11d48'}">
        <div class="rec-badge rec-${verdict.recommendation.action}">${verdict.recommendation.action}</div>
        <div class="rec-condition">${verdict.recommendation.condition}</div>
      </div>
    </div>
    <div class="brief-section">
      <div class="brief-section-title">Next 3 Actions</div>
      <div>${actionsHtml}</div>
    </div>
    <div class="brief-section">
      <div class="confidence-wrap">
        <div class="confidence-score">${verdict.confidence.score}<span>%</span></div>
        <div class="confidence-basis"><b>Confidence Basis:</b><br>${verdict.confidence.basis}</div>
      </div>
    </div>
    ${verdict.rawOutput ? `
    <div class="brief-section" style="background:var(--bg2); border-top:1px solid var(--border)">
      <details>
        <summary style="font-size:0.7rem; font-weight:700; text-transform:uppercase; color:var(--text3); cursor:pointer">View Raw Decision Brief</summary>
        <pre style="font-family:var(--ff-mono); font-size:0.75rem; white-space:pre-wrap; margin-top:1rem; color:var(--text2)">${verdict.rawOutput}</pre>
      </details>
    </div>` : ''}
  `;
  body.appendChild(card);
  requestAnimationFrame(() => requestAnimationFrame(() => card.classList.add('visible')));
  body.scrollTop = body.scrollHeight;
}

async function streamDebate(url, body, onEvent) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const err = await response.json();
    if (response.status === 401) logout();
    throw new Error(err.message || err.error || 'Request failed');
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          onEvent(data);
        } catch (e) {
          console.error('Error parsing SSE data:', e);
        }
      }
    }
  }
}

let debateRunning = false;
let currentRound = 0;
let roundBlocks = {};

async function startDebate() {
  if (debateRunning) return;
  const baseIdea = document.getElementById('ideaInput').value.trim();
  if (!baseIdea) return alert('Please enter an idea to debate.');
  debateRunning = true;
  currentRound = 0;
  roundBlocks = {};
  const startBtn = document.getElementById('startBtn');
  const goal = document.getElementById('goalInput').value.trim();
  const timeframe = document.getElementById('timeframeInput').value.trim();
  const resources = document.getElementById('resourcesInput').value.trim();
  const concern = document.getElementById('concernInput').value.trim();
  let idea = `[IDEA]: ${baseIdea}`;
  if (goal) idea += `\n[GOAL]: ${goal}`;
  if (timeframe) idea += `\n[TIMEFRAME]: ${timeframe}`;
  if (resources) idea += `\n[RESOURCES]: ${resources}`;
  if (concern) idea += `\n[MAIN CONCERN]: ${concern}`;
  startBtn.disabled = true;
  startBtn.textContent = 'Running…';
  document.getElementById('arenaIdea').textContent = `"${baseIdea}"`;
  document.getElementById('emptyState').style.display = 'none';
  document.getElementById('arenaBody').innerHTML = '';
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  statusDot.className = 'status-dot running';
  statusText.textContent = 'Initializing agents...';
  const rp = document.getElementById('roundProgress');
  rp.style.display = 'flex';
  rp.innerHTML = '';
  const numPips = depth === 'deep' ? 5 : totalRounds;
  for (let i = 0; i < numPips; i++) {
    const pip = document.createElement('div');
    pip.className = 'round-pip';
    pip.id = `pip-${i}`;
    rp.appendChild(pip);
  }
  const typing = document.createElement('div');
  typing.className = 'typing-indicator';
  typing.id = 'typingIndicator';
  typing.innerHTML = `<div class="typing-dots"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div><span id="typingLabel">AI is thinking…</span>`;
  document.getElementById('arenaBody').appendChild(typing);
  try {
    const endpoint = depth === 'deep' ? `${API_BASE}/api/debate/reason` : `${API_BASE}/api/debate/start`;
    const payload = depth === 'deep' ? { idea, maxIterations: totalRounds } : { idea, rounds: totalRounds, mode: 'fast' };
    await streamDebate(endpoint, payload, (event) => {
      switch (event.type) {
        case 'init': statusText.textContent = 'Debate started'; break;
        case 'typing':
          typing.classList.add('show');
          document.getElementById('typingLabel').textContent = `${event.agent} is responding…`;
          break;
        case 'message':
          typing.classList.remove('show');
          const r = event.message.round;
          if (!roundBlocks[r]) {
            roundBlocks[r] = createRoundBlock(r);
            document.getElementById('arenaBody').appendChild(typing);
            const prevPip = document.getElementById(`pip-${r-2}`);
            if (prevPip) prevPip.className = 'round-pip done';
            const currPip = document.getElementById(`pip-${r-1}`);
            if (currPip) currPip.className = 'round-pip active';
            statusText.textContent = `Round ${r}`;
          }
          addMessageToUI(event.message, roundBlocks[r]);
          break;
        case 'verdict': typing.classList.remove('show'); displayVerdict(event.verdict); break;
        case 'error': alert(`Error: ${event.error}`); break;
        case 'done':
          statusText.textContent = 'Completed';
          statusDot.className = 'status-dot done';
          startBtn.disabled = false;
          startBtn.textContent = '▶ New Debate';
          debateRunning = false;
          document.querySelectorAll('.round-pip').forEach(p => p.className = 'round-pip done');
          break;
      }
    });
  } catch (err) {
    alert('Failed to start debate.');
    statusText.textContent = 'Connection Error';
    statusDot.className = 'status-dot';
    startBtn.disabled = false;
    startBtn.textContent = '▶ Start Debate';
    debateRunning = false;
  }
}
