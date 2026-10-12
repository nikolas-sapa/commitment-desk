/* Static button and input styling follows the fetched project component source:
   work/build/button-source.tsx and input-source.tsx. Plain DOM port, no React or library runtime. */
(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const state = { token: '', data: null, provider: null, fixtures: [], importedFixtures: new Map(), selectedSources: new Set(), selectedMemories: new Set(), preview: null, activeView: 'work', memoryFilter: 'active', busy: false };

  function takeToken() {
    const fragment = new URLSearchParams(location.hash.slice(1));
    const incoming = fragment.get('session');
    if (incoming) {
      state.token = incoming;
      try { sessionStorage.setItem('commitment-desk-session', incoming); } catch {}
      history.replaceState(null, '', location.pathname + location.search);
    } else {
      try { state.token = sessionStorage.getItem('commitment-desk-session') || ''; } catch {}
    }
  }

  async function api(path, method = 'GET', body) {
    if (!state.token) throw new Error('Session token is missing. Reopen the local app link to start a session.');
    const headers = { 'X-Session-Token': state.token };
    const options = { method, headers, cache: 'no-store' };
    if (body !== undefined) { headers['Content-Type'] = 'application/json'; options.body = JSON.stringify(body); }
    const response = await fetch(`/api/${path}`, options);
    let data;
    try { data = await response.json(); } catch { data = {}; }
    if (!response.ok) throw new Error(data.error || data.message || `Request failed (${response.status})`);
    return data;
  }

  function setNotice(message = '', kind = 'info') {
    const box = $('#notice'); box.textContent = message; box.className = `notice ${kind}`; box.hidden = !message;
  }
  function busy(button, value, label) {
    state.busy = value;
    if (button) {
      button.disabled = value;
      if (value) { button.dataset.label = button.textContent.trim(); button.textContent = label || 'Working…'; }
      else if (button.dataset.label) { button.textContent = button.dataset.label; delete button.dataset.label; }
    }
    if (!value) { renderFixtures(); updateSelection(); }
  }
  function text(tag, value, className) {
    const node = document.createElement(tag); if (className) node.className = className; node.textContent = value == null ? '' : String(value); return node;
  }
  function normalizeFixture(f) { return { ...f, result: f.result || f.expected }; }
  function sourceById(id) { return state.data?.sources?.find(item => item.id === id) || state.fixtures.flatMap(f => f.sources || []).find(item => item.id === id); }
  function selectedFixture() {
    const ids = [...state.selectedSources].sort();
    return state.fixtures.find(f => {
      const targetKey = f.evaluation?.expectedSupersedesKey;
      const target = targetKey && (state.data?.memories || []).find(m => m.key === targetKey && m.status === 'active' && state.selectedMemories.has(m.id));
      const required = [...(f.sources || []).map(s => s.id), ...(target?.evidence || []).map(e => e.sourceId)].sort();
      return [...new Set(required)].join('|') === ids.join('|');
    }) || null;
  }

  async function load() {
    try {
      const [data, fixtures] = await Promise.all([api('state'), api('fixtures')]);
      state.data = data.state || data; state.provider = data.provider || null;
      state.fixtures = (fixtures.fixtures || fixtures).map(normalizeFixture);
      renderAll();
      const p = data.provider || {};
      $('#provider-status').textContent = p.enabled ? `Nebius ready · ${p.model || 'model configured'}` : `Live inference disabled · ${p.reason || 'not configured'}`;
      $('#provider-status').title = p.reason || (p.enabled ? 'Live inference is available.' : 'Fixture replay remains available.');
    } catch (error) {
      $('#provider-status').textContent = 'Local service unavailable';
      setNotice(error.message, 'error');
      $('#fixture-list').replaceChildren(text('p', 'Could not load the local service. Check that Commitment Desk is running, then refresh.', 'empty-state'));
    }
  }

  function renderAll() {
    renderFixtures(); renderMemoryPicker(); renderRecords(); updateSelection();
    $('#today-date').textContent = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date());
    const tasks = state.data?.tasks || [];
    $('#task-count').textContent = `${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'}`;
  }

  function renderFixtures() {
    const list = $('#fixture-list'); list.replaceChildren();
    if (!state.fixtures.length) list.append(text('p', 'No example notes are available.', 'empty-state'));
    state.fixtures.forEach(fixture => {
      const card = document.createElement('label'); card.className = 'fixture-card';
      const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = (fixture.sources || []).every(s => state.selectedSources.has(s.id)); checkbox.disabled = state.busy;
      checkbox.addEventListener('change', () => { if (checkbox.checked) importFixture(fixture); else deselectFixture(fixture); });
      const body = document.createElement('span'); body.className = 'fixture-card-body';
      const top = document.createElement('span'); top.className = 'fixture-title-row'; top.append(text('strong', fixture.title), text('span', 'SYNTHETIC', 'mini-badge'));
      body.append(top, text('span', (fixture.sources || []).map(s => s.text).join(' · '), 'fixture-excerpt'), text('span', fixture.query || 'Example source', 'fixture-query'));
      card.append(checkbox, body); list.append(card);
    });
    renderSavedSources();
  }

  function renderSavedSources() {
    const list = $('#saved-source-list'); list.replaceChildren();
    const fixtureIds = new Set(state.fixtures.flatMap(f => (f.sources || []).map(source => source.id)));
    const sources = (state.data?.sources || []).filter(source => !fixtureIds.has(source.id));
    if (!sources.length) return;
    list.append(text('div', 'YOUR SAVED SOURCES', 'saved-source-heading'));
    sources.forEach(source => {
      const card = document.createElement('label'); card.className = 'fixture-card saved-source-card';
      const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = state.selectedSources.has(source.id);
      checkbox.addEventListener('change', () => { checkbox.checked ? state.selectedSources.add(source.id) : state.selectedSources.delete(source.id); updateSelection(); clearPreview(); });
      const body = document.createElement('span'); body.className = 'fixture-card-body'; body.append(text('strong', source.title || 'Untitled source'), text('span', source.text, 'fixture-excerpt'));
      card.append(checkbox, body); list.append(card);
    });
  }

  async function importFixture(fixture) {
    const checkboxes = $$('#fixture-list input'); checkboxes.forEach(node => { node.disabled = true; });
    setNotice('Adding selected fixture notes to local sources…', 'pending');
    try {
      const imported = [];
      for (const source of fixture.sources || []) {
        let record = state.importedFixtures.get(source.id) || (state.data?.sources || []).find(item => item.id === source.id);
        if (!record) {
          const response = await api('import', 'POST', { id: source.id, title: source.title, text: source.text, eventTime: source.eventTime });
          record = response.source || response; state.importedFixtures.set(source.id, record);
        }
        imported.push(record);
      }
      imported.forEach(source => state.selectedSources.add(source.id));
      const targetKey = fixture.evaluation?.expectedSupersedesKey;
      if (targetKey) {
        const target = (state.data?.memories || []).find(memory => memory.key === targetKey && memory.status === 'active');
        if (target) {
          state.selectedMemories.add(target.id);
          (target.evidence || []).forEach(ref => state.selectedSources.add(ref.sourceId));
        }
      }
      if (fixture.query) $('#query').value = fixture.query;
      await reloadState(false); setNotice(`${imported.length} fixture ${imported.length === 1 ? 'source added' : 'sources added'}. Synthetic content only.`, 'success');
    } catch (error) { setNotice(`Fixture import failed: ${error.message}`, 'error'); }
    finally { renderFixtures(); updateSelection(); }
  }

  function deselectFixture(fixture) {
    (fixture.sources || []).forEach(source => state.selectedSources.delete(source.id));
    updateSelection(); clearPreview();
  }

  async function addNote(event) {
    event.preventDefault(); const form = event.currentTarget; const button = $('button[type="submit"]', form); busy(button, true, 'Adding source…');
    const values = new FormData(form); const payload = { title: values.get('title'), text: values.get('text') };
    if (values.get('eventTime')) payload.eventTime = new Date(values.get('eventTime')).toISOString();
    try {
      const response = await api('import', 'POST', payload); const source = response.source || response;
      state.selectedSources.add(source.id); form.reset(); await reloadState(false); switchSourceTab('fixtures'); setNotice('Note added to sources. It is selected for this preview.', 'success');
    } catch (error) { setNotice(`Could not add note: ${error.message}`, 'error'); }
    finally { busy(button, false); }
  }

  function updateSelection() {
    const count = state.selectedSources.size;
    $('#source-count').textContent = `${count} selected`;
    $('#continue-preview').disabled = count === 0 || state.busy;
    $('#make-preview').disabled = count === 0 || state.busy;
    $('#selected-summary-text').textContent = count ? `${count} ${count === 1 ? 'source' : 'sources'} selected · no other notes included` : 'Select one or more notes to continue.';
  }

  function renderMemoryPicker() {
    const wrap = $('#memory-picker'); wrap.replaceChildren();
    const active = (state.data?.memories || []).filter(m => m.status === 'active');
    if (!active.length) { wrap.append(text('p', 'No active memory yet. You can continue with sources only.', 'empty-state')); return; }
    active.forEach(memory => {
      const label = document.createElement('label'); label.className = 'memory-option';
      const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = state.selectedMemories.has(memory.id); checkbox.addEventListener('change', () => { checkbox.checked ? state.selectedMemories.add(memory.id) : state.selectedMemories.delete(memory.id); clearPreview(); });
      const inner = document.createElement('span'); inner.append(text('strong', memory.key || memory.kind, 'memory-key'), text('span', memory.text, 'memory-excerpt'));
      label.append(checkbox, inner); wrap.append(label);
    });
  }

  function clearPreview(keepReceipt = false) {
    keepReceipt = keepReceipt === true;
    state.preview = null; state.pendingProposal = null;
    $('#payload-preview').textContent = ''; $('#preview-revision').textContent = ''; $('#run-button').disabled = true;
    $('#preview-section').hidden = !keepReceipt; $('#run-result').hidden = !keepReceipt;
    if (!keepReceipt) $('#run-result').replaceChildren();
  }

  async function createPreview() {
    const button = $('#make-preview'); busy(button, true, 'Preparing exact context…'); clearPreview(); setNotice('Building a bounded preview from selected sources and memory…', 'pending');
    try {
      const fixture = selectedFixture(); const mode = $('#run-mode').value;
      const payload = { sourceIds: [...state.selectedSources], memoryIds: [...state.selectedMemories], query: $('#query').value.trim(), mode };
      if (mode === 'fixture' && fixture) payload.fixtureId = fixture.id;
      const response = await api('preview', 'POST', payload); state.preview = response.preview || response;
      renderPreview(response.envelope || (response.preview || response).envelope); setNotice('Preview ready. Review the complete payload before running.', 'success');
      $('#preview-section').hidden = false; $('#preview-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) { setNotice(`Preview failed: ${error.message}`, 'error'); }
    finally { busy(button, false); }
  }

  function renderPreview(envelope) {
    const preview = state.preview || {};
    $('#preview-revision').textContent = `Revision ${preview.revision ?? '—'} · expires in 10 min`;
    const mode = $('#run-mode').value;
    $('#preview-mode').textContent = mode === 'fixture' ? 'Fixture replay · no model call' : 'Nebius live inference';
    $('#preview-destination').textContent = mode === 'fixture' ? 'Local fixture' : (envelope?.endpoint || 'Fixed Nebius endpoint');
    $('#preview-model').textContent = mode === 'fixture' ? 'No model call' : (envelope?.model || 'Configured NVIDIA model');
    const display = envelope ? { ...envelope, body: typeof envelope.body === 'string' ? JSON.parse(envelope.body) : envelope.body } : (preview.payload || preview);
    $('#payload-preview').textContent = JSON.stringify(display, null, 2);
    const fixture = selectedFixture(); $('#fixture-select-wrap').hidden = mode !== 'fixture';
    const select = $('#fixture-select'); select.replaceChildren();
    const match = fixture ? [fixture] : [];
    if (!match.length) { const option = document.createElement('option'); option.value = ''; option.textContent = 'No exact fixture matches selected sources'; select.append(option); }
    else match.forEach(f => { const option = document.createElement('option'); option.value = f.id; option.textContent = f.title; select.append(option); });
    $('#fixture-select').disabled = !match.length;
    const live = $('#live-note'); live.hidden = mode !== 'nebius';
    if (mode === 'nebius') {
      const p = (state.data && state.provider) || null;
      live.textContent = 'Live inference may send only this reviewed payload to the configured provider. Provider availability is checked by the service when you run.';
    }
    $('#run-button').disabled = !preview.id || (mode === 'fixture' && !fixture);
  }

  async function run() {
    const button = $('#run-button'); const mode = $('#run-mode').value; const fixture = selectedFixture();
    busy(button, true, mode === 'fixture' ? 'Replaying fixture…' : 'Waiting for provider…'); $('#run-result').hidden = true; setNotice(mode === 'fixture' ? 'Fixture replay in progress. No model call will be made.' : 'Live request pending. No automatic retry will occur.', 'pending');
    try {
      const body = { previewId: state.preview.id, mode };
      if (mode === 'fixture') body.fixtureId = $('#fixture-select').value;
      const response = await api('run', 'POST', body); const proposal = response.proposal || response;
      if (!proposal.id && proposal.proposalId) proposal.id = proposal.proposalId;
      state.pendingProposal = proposal; renderProposal(proposal, response.metadata); setNotice(mode === 'fixture' ? 'Fixture replay ready for your review. No model call was made.' : 'Provider response staged for your review. Nothing is committed yet.', 'success');
    } catch (error) { setNotice(`Run failed. No automatic retry was made: ${error.message}`, 'error'); }
    finally { busy(button, false); }
  }

  function citationList(evidence) {
    const list = document.createElement('div'); list.className = 'citations';
    (evidence || []).forEach(ref => {
      const source = sourceById(ref.sourceId); const cite = document.createElement('blockquote');
      cite.append(text('span', source?.title || ref.sourceId, 'citation-source'), text('span', `“${ref.quote}”`, 'citation-quote')); list.append(cite);
    });
    if (!(evidence || []).length) list.append(text('p', 'No source evidence attached.', 'no-citation'));
    return list;
  }

  function renderProposal(proposal, metadata) {
    const wrap = $('#run-result'); wrap.replaceChildren(); wrap.hidden = false; wrap.className = 'run-result';
    const result = proposal.result || proposal.output || proposal;
    const header = document.createElement('div'); header.className = 'result-heading';
    header.append(text('div', 'STEP 03 · REVIEW BEFORE APPLY', 'step-tag'), text('span', proposal.metadata?.provider === 'fixture' || metadata?.provider === 'fixture' ? 'Fixture replay · no model call' : 'Provider response', 'run-badge'));
    wrap.append(header);
    const answer = result.answer || { text: result.text || 'No answer text returned.', evidence: result.evidence || [] };
    const answerBox = document.createElement('article'); answerBox.className = 'answer-card'; answerBox.append(text('h3', 'Suggested next step'), text('p', answer.text, 'answer-copy'), citationList(answer.evidence)); wrap.append(answerBox);
    const records = document.createElement('div'); records.className = 'proposal-columns';
    const memories = document.createElement('section'); memories.append(text('h3', `Proposed memory · ${(result.memories || []).length}`));
    (result.memories || []).forEach(memory => { const item = document.createElement('article'); item.className = 'proposal-item'; item.append(text('span', `${memory.kind || 'memory'} · ${memory.key || 'new item'}`, 'proposal-kicker'), text('p', memory.text, 'proposal-copy'), citationList(memory.evidence)); if (memory.supersedesId) item.append(text('p', `Supersedes ${memory.supersedesId}`, 'supersedes')); memories.append(item); });
    if (!(result.memories || []).length) memories.append(text('p', 'No memory changes proposed.', 'empty-state'));
    const actions = document.createElement('section'); actions.append(text('h3', `Proposed tasks · ${(result.actions || []).length}`));
    (result.actions || []).forEach(action => { const item = document.createElement('article'); item.className = 'proposal-item'; item.append(text('p', action.text, 'proposal-copy'), citationList(action.evidence)); actions.append(item); });
    if (!(result.actions || []).length) actions.append(text('p', 'No tasks proposed.', 'empty-state'));
    records.append(memories, actions); wrap.append(records);
    if (proposal.metadata || metadata) { const m = proposal.metadata || metadata; const details = text('p', `Provider: ${m.provider || 'fixture'}${m.model ? ` · ${m.model}` : ''}${m.latencyMs != null ? ` · ${m.latencyMs} ms` : ''}`, 'run-metadata'); wrap.append(details); }
    const actionsRow = document.createElement('div'); actionsRow.className = 'apply-row';
    const note = text('span', 'Applying saves proposed memory and creates only explicitly linked tasks.', 'helper');
    const apply = document.createElement('button'); apply.className = 'button button-primary'; apply.type = 'button'; apply.textContent = 'Apply reviewed proposal'; apply.addEventListener('click', () => applyProposal(proposal.id));
    actionsRow.append(note, apply); wrap.append(actionsRow);
  }

  async function applyProposal(id) {
    if (!id) { setNotice('The service returned no proposal ID. Nothing was applied.', 'error'); return; }
    const button = $('.apply-row .button'); busy(button, true, 'Applying proposal…'); setNotice('Applying reviewed proposal…', 'pending');
    try { const response = await api('apply', 'POST', { proposalId: id }); const applied = response.result || response; setNotice(`Applied. ${applied.memoryIds?.length || 0} memories and ${applied.taskIds?.length || 0} tasks committed.`, 'success'); $('#run-result').replaceChildren(text('div', 'Proposal applied', 'applied-banner'), text('p', `Receipt ${applied.proposalId || id} · outcome ${applied.outcome || 'applied'}`, 'run-metadata')); await reloadState(false, true); }
    catch (error) { setNotice(`Apply response unavailable. Outcome unknown. Refresh memory/queue or retry this same proposal safely. ${error.message}`, 'error'); }
    finally { busy(button, false); }
  }

  function renderRecords() {
    const memories = (state.data?.memories || []).filter(m => state.memoryFilter === 'history' ? m.status !== 'active' : m.status === 'active');
    const memoryList = $('#memory-list'); memoryList.replaceChildren();
    if (!memories.length) memoryList.append(text('div', state.memoryFilter === 'active' ? 'No active memory yet. Apply a reviewed proposal to save one.' : 'No superseded memory in history.', 'empty-state card-empty'));
    memories.forEach(memory => {
      const card = document.createElement('article'); card.className = 'record-card'; const header = document.createElement('div'); header.className = 'record-header';
      header.append(text('span', `${memory.kind || 'memory'} · ${memory.key || 'untitled'}`, 'record-kind'), text('span', memory.status || 'active', `status-pill ${memory.status || 'active'}`));
      card.append(header, text('p', memory.text, 'record-text'));
      const evidence = memory.evidence || []; if (evidence.length) { card.append(text('h3', 'Source', 'record-subhead'), citationList(evidence)); }
      if (memory.supersedesId) card.append(text('p', `Supersedes ${memory.supersedesId}`, 'supersedes'));
      if (memory.status === 'active') {
        const controls = document.createElement('div'); controls.className = 'record-controls';
        const correction = document.createElement('form'); correction.className = 'correction-form';
        const input = document.createElement('input'); input.type = 'text'; input.maxLength = 2000; input.required = true; input.setAttribute('aria-label', `Correct ${memory.key || 'memory'}`); input.placeholder = 'Enter corrected memory text';
        const correct = document.createElement('button'); correct.type = 'submit'; correct.className = 'button button-outline button-xs'; correct.textContent = 'Save correction'; correction.append(input, correct);
        correction.addEventListener('submit', event => correctMemory(event, memory.id, input.value));
        const del = document.createElement('button'); del.type = 'button'; del.className = 'button button-danger-outline button-xs'; del.textContent = 'Delete memory'; del.addEventListener('click', () => deleteMemory(memory));
        controls.append(correction, del); card.append(controls);
      }
      memoryList.append(card);
    });
    const tasks = state.data?.tasks || []; const taskList = $('#task-list'); taskList.replaceChildren(); $('#task-count').textContent = `${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'}`;
    if (!tasks.length) taskList.append(text('div', 'Your queue is empty. Tasks appear after you apply a reviewed proposal.', 'empty-state card-empty'));
    tasks.forEach(task => { const card = document.createElement('article'); card.className = 'task-card'; card.append(text('span', 'OPEN COMMITMENT', 'step-tag'), text('p', task.text, 'task-text'), text('span', `Linked memory ${task.memoryId}`, 'task-source')); taskList.append(card); });
  }

  async function correctMemory(event, id, value) {
    event.preventDefault(); const button = $('button[type="submit"]', event.currentTarget); busy(button, true, 'Saving correction…');
    try { await api('correct', 'POST', { memoryId: id, text: value.trim() }); setNotice('Correction saved as a new memory with a new source record.', 'success'); await reloadState(false); }
    catch (error) { setNotice(`Correction failed: ${error.message}`, 'error'); }
    finally { busy(button, false); }
  }

  async function deleteMemory(memory) {
    openDialog(`Delete “${memory.key || 'this memory'}”?`, 'Linked source records, dependent memories, tasks, and pending proposals may also be removed. This cannot be undone.', 'Delete linked records', async () => {
      try { await api('delete', 'POST', { memoryId: memory.id }); setNotice('Memory and linked records removed from active storage.', 'success'); await reloadState(false); }
      catch (error) { setNotice(`Deletion failed: ${error.message}`, 'error'); }
    });
  }

  function openDialog(title, message, confirmText, onConfirm) {
    const dialog = $('#review-dialog'); const content = $('#dialog-content'); content.replaceChildren(text('div', 'CONFIRM DELETION', 'eyebrow'), text('h2', title), text('p', message, 'dialog-copy'));
    const row = document.createElement('div'); row.className = 'dialog-actions'; const cancel = document.createElement('button'); cancel.className = 'button button-secondary'; cancel.textContent = 'Cancel'; cancel.type = 'button'; cancel.addEventListener('click', () => dialog.close());
    const confirm = document.createElement('button'); confirm.className = 'button button-danger'; confirm.textContent = confirmText; confirm.type = 'button'; confirm.addEventListener('click', async () => { confirm.disabled = true; await onConfirm(); dialog.close(); }); row.append(cancel, confirm); content.append(row); dialog.showModal();
  }

  async function reloadState(show = true, keepReceipt = false) {
    try {
      const revision = state.data?.revision;
      const response = await api('state'); state.data = response.state || response; state.provider = response.provider || null;
      const sourceIds = new Set((state.data.sources || []).map(source => source.id));
      const memoryIds = new Set((state.data.memories || []).filter(memory => memory.status === 'active').map(memory => memory.id));
      state.selectedSources.forEach(id => { if (!sourceIds.has(id)) state.selectedSources.delete(id); });
      state.selectedMemories.forEach(id => { if (!memoryIds.has(id)) state.selectedMemories.delete(id); });
      state.importedFixtures.forEach((source, id) => { if (!sourceIds.has(id)) state.importedFixtures.delete(id); });
      if (revision !== state.data.revision) clearPreview(keepReceipt === true && Boolean($('.applied-banner', $('#run-result'))));
      renderAll(); if (show) setNotice('Local state refreshed.', 'success');
    }
    catch (error) { setNotice(`Refresh failed: ${error.message}`, 'error'); }
  }

  function changeView(name) {
    state.activeView = name; $$('.view').forEach(view => { view.hidden = view.id !== `view-${name}`; });
    $$('.nav-item').forEach(item => { const active = item.dataset.view === name; item.classList.toggle('is-active', active); active ? item.setAttribute('aria-current', 'page') : item.removeAttribute('aria-current'); });
    $('#crumb-current').textContent = name === 'work' ? 'Workbench' : name === 'memory' ? 'Memory' : 'Commitment queue';
    if (name !== 'work') reloadState(false);
  }

  function switchSourceTab(name) {
    $$('[data-source-tab]').forEach(tab => { const active = tab.dataset.sourceTab === name; tab.classList.toggle('is-selected', active); tab.setAttribute('aria-selected', String(active)); });
    $('#fixture-source-panel').hidden = name !== 'fixtures'; $('#note-form').hidden = name !== 'write';
  }

  function wire() {
    document.addEventListener('click', event => {
      const viewButton = event.target.closest('[data-view]'); if (viewButton) changeView(viewButton.dataset.view);
      const tab = event.target.closest('[data-source-tab]'); if (tab) switchSourceTab(tab.dataset.sourceTab);
      const filter = event.target.closest('[data-memory-filter]'); if (filter) { state.memoryFilter = filter.dataset.memoryFilter; $$('[data-memory-filter]').forEach(item => { const active = item === filter; item.classList.toggle('is-selected', active); item.setAttribute('aria-selected', String(active)); }); renderRecords(); }
    });
    $('#note-form').addEventListener('submit', addNote);
    $('#continue-preview').addEventListener('click', () => $('#query').focus());
    $('#make-preview').addEventListener('click', createPreview);
    $('#run-button').addEventListener('click', run);
    $('#run-mode').addEventListener('change', () => { clearPreview(); });
    $('#reload-state').addEventListener('click', () => reloadState(true));
    $('#query').addEventListener('input', clearPreview);
    $('#review-dialog').addEventListener('click', event => { if (event.target === event.currentTarget) event.currentTarget.close(); });
  }

  takeToken(); wire(); load();
})();
