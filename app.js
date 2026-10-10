'use strict';
const storageKey = 'workflow-studio-v1';
const status = document.querySelector('#status');
let workflows = [];
try { workflows = JSON.parse(localStorage.getItem(storageKey) || '[]'); if (!Array.isArray(workflows)) workflows = []; }
catch { status.textContent = 'Saved entries could not be loaded. You can still add and export workflows.'; }
const approaches = {
  writing: 'Use AI to draft from your notes and a reusable template. Review facts, tone, and recipients before sending.',
  research: 'Use AI to summarize supplied sources into a consistent brief. Check the original sources for important claims.',
  data: 'Start with a template or deterministic rule for moving information between tools. Use AI for messy text that needs classification, and review exceptions.',
  planning: 'Use AI to turn your task list and constraints into a proposed plan. Confirm priorities and deadlines yourself.'
};
function save() { try { localStorage.setItem(storageKey, JSON.stringify(workflows)); status.textContent = 'Saved in this browser.'; } catch { status.textContent = 'Browser storage is unavailable. Export your workflows before closing this page.'; } }
function element(tag, text) { const node = document.createElement(tag); node.textContent = text; return node; }
function render() {
  const container = document.querySelector('#opportunities'); container.replaceChildren();
  document.querySelector('#summary').textContent = workflows.length ? `${workflows.length} recurring tasks · ${workflows.reduce((sum, w) => sum + w.frequency * w.minutes, 0)} minutes of work per week. This is current effort, not estimated savings.` : 'Add your first task to start mapping your week.';
  if (!workflows.length) { const empty = element('p', 'Try email follow-ups, meeting summaries, weekly reports, research, or copying information between tools.'); empty.className = 'empty'; container.append(empty); }
  [...workflows].sort((a,b) => b.frequency*b.minutes-a.frequency*a.minutes).forEach(w => {
    const card = document.createElement('article');
    card.append(element('h3', w.task));
    const tag = element('span', `${w.frequency*w.minutes} min/week`); tag.className = 'tag'; card.append(tag);
    if (w.tools) card.append(element('p', `Tools: ${w.tools}`));
    if (w.notes) card.append(element('p', w.notes));
    card.append(element('p', approaches[w.kind] || approaches.planning));
    const remove = element('button', 'Remove'); remove.className = 'secondary'; remove.addEventListener('click', () => { workflows = workflows.filter(item => item.id !== w.id); save(); render(); }); card.append(remove); container.append(card);
  });
}
document.querySelector('#workflow-form').addEventListener('submit', event => {
  event.preventDefault(); const field = id => document.getElementById(id).value;
  const task = field('task').trim(); if (!task) return;
  workflows.push({id: crypto.randomUUID(), task, tools: field('tools').trim(), frequency: Number(field('frequency')), minutes: Number(field('minutes')), kind: field('kind'), notes: field('notes').trim()});
  save(); render(); event.target.reset();
});
document.querySelector('#export').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(workflows, null, 2)], {type:'application/json'}));
  const link = document.createElement('a'); link.href = url; link.download = 'my-workflows.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  status.textContent = 'Export downloaded.';
});
render();
