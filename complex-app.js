'use strict';
const $ = id => document.getElementById(id);
const key = x => x.id;
const validKeys = new Set(BANK.map(key));
let saved = {};
try {
  const value = JSON.parse(localStorage.getItem('complex-v1') || '{}');
  if (value && typeof value === 'object' && !Array.isArray(value)) saved = value;
} catch {}
const count = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
let total = count(saved.total), correct = Math.min(count(saved.correct), total);
let errors = new Set(Array.isArray(saved.errors) ? saved.errors.filter(x => validKeys.has(x)) : []);
let queue = [], seen = new Map(), recent = [], current = null, locked = false;
function save() {
  try { localStorage.setItem('complex-v1', JSON.stringify({total, correct, errors:[...errors]})); } catch {}
  stats();
}
function stats() {
  $('total').textContent = total;
  $('correct').textContent = correct;
  $('accuracy').textContent = (total ? Math.round(correct / total * 100) : 0) + '%';
  $('errorTitle').textContent = 'Задания для повторения · ' + errors.size;
  $('errorList').textContent = [...new Set(BANK.filter(x => errors.has(key(x))).map(x => x.before + x.word + x.after))].join(' • ') || 'Пока пусто. Ошибки будут появляться здесь.';
}
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function pool() {
  const m = $('mode').value;
  return BANK.filter(x => m === 'all' || (m === 'errors' ? errors.has(key(x)) : x.cat === m));
}
function taskCount(n) {
  const form = n % 100 >= 11 && n % 100 <= 14 ? 'заданий' : n % 10 === 1 ? 'задание' : n % 10 >= 2 && n % 10 <= 4 ? 'задания' : 'заданий';
  return n + ' ' + form;
}
function start() { queue = shuffle(pool().slice()); seen.clear(); recent = []; next(); }
function next() {
  locked = false;
  $('feedback').textContent = '';
  $('next').hidden = true;
  $('answers').replaceChildren();
  if ($('mode').value === 'errors') queue = queue.filter(x => errors.has(key(x)));
  if (!queue.length) {
    queue = shuffle(pool().slice());
    if (queue.length > 1 && current && key(queue[0]) === key(current)) [queue[0], queue[1]] = [queue[1], queue[0]];
  }
  if (!queue.length) {
    current = null;
    $('word').textContent = 'Ошибок нет';
    $('hint').textContent = 'Выбери другую тему, чтобы продолжить.';
    $('category').textContent = 'Повторение';
    $('progress').textContent = '';
    return;
  }
  const available = pool();
  const recentLimit = Math.min(5, Math.max(0, available.length - 1));
  const avoid = new Set(recent.slice(-recentLimit));
  if (!recentLimit) avoid.clear();
  const eligible = x => !avoid.has(key(x));
  const review = available.filter(x => seen.has(key(x)) && eligible(x));
  // Random review appears between new cards, without waiting for the entire bank.
  if (review.length && Math.random() < 0.3) {
    current = review[Math.floor(Math.random() * review.length)];
  } else {
    let index = queue.findIndex(eligible);
    if (index < 0) {
      queue = shuffle(available.slice());
      index = queue.findIndex(eligible);
    }
    current = queue.splice(index < 0 ? 0 : index, 1)[0];
  }
  seen.set(key(current), current);
  recent.push(key(current));
  if (recent.length > 5) recent.shift();
  $('progress').textContent = taskCount(pool().length) + ' в теме';
  $('category').textContent = 'Определи вид предложения';
  $('hint').textContent = 'Найди основы и определи связь между частями';
  const gap = document.createElement('span');
  gap.className = 'sentence'; gap.textContent = current.word;
  $('word').replaceChildren(document.createTextNode(current.before), gap, document.createTextNode(current.after));
  const chars = ['ssp','spp','bsp','mixed'];
  for (const char of chars) {
    const b = document.createElement('button');
    b.textContent = (chars.indexOf(char)+1) + '. ' + TYPES[char]; b.dataset.case = char;
    b.setAttribute('aria-label', TYPES[char]);
    b.onclick = () => answer(char);
    $('answers').append(b);
  }
}
function answer(char) {
  if (locked || !current || ![...$('answers').children].some(b => b.dataset.case === char)) return;
  locked = true; total++;
  const ok = char === current.answer;
  if (ok) { correct++; errors.delete(key(current)); } else errors.add(key(current));
  for (const b of $('answers').children) {
    b.disabled = true;
    if (b.dataset.case === current.answer) b.classList.add('right');
    else if (b.dataset.case === char) b.classList.add('wrong');
  }

  $('feedback').replaceChildren();
  const heading = document.createElement('strong');
  const info = {name:TYPES[current.answer]};
  heading.textContent = (ok ? 'Верно! ' : 'Правильный ответ: ') + info.name + '. ';
  if (!ok) heading.style.color = 'var(--bad)';
  $('feedback').append(heading, document.createTextNode(current.rule));
  $('next').hidden = false;
  save();
  $('next').focus();
}
$('next').onclick = next;
$('mode').onchange = start;
$('reset').onclick = () => { total = 0; correct = 0; save(); start(); };
$('clearErrors').onclick = () => { errors.clear(); save(); if ($('mode').value === 'errors') start(); };
document.addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || e.target.isContentEditable || ['SELECT','INPUT','TEXTAREA'].includes(e.target.tagName)) return;
  if (e.key === 'Enter' && locked) { e.preventDefault(); next(); }
  else if (/^[1-4]$/.test(e.key)) { e.preventDefault(); answer($('answers').children[Number(e.key)-1]?.dataset.case); }
});
$('source').textContent = taskCount(BANK.length) + ' · по 8 на каждый тип. Задания идут случайно и возвращаются для повторения. Клавиши 1–4 — ответ, Enter — следующее задание. Прогресс сохраняется отдельно.';
stats(); start();
