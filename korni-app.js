'use strict';
const $ = id => document.getElementById(id);
const names = {check:'Проверяемая гласная', alternate:'Чередование в корне', dict:'Словарная гласная', special:'Другие орфограммы'};
const key = x => x.word + ':' + x.index;
const validKeys = new Set(BANK.map(key));
let saved = {};
try {
  const value = JSON.parse(localStorage.getItem('korni-v1') || '{}');
  if (value && typeof value === 'object' && !Array.isArray(value)) saved = value;
} catch {}
const count = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
let total = count(saved.total), correct = Math.min(count(saved.correct), total);
let errors = new Set(Array.isArray(saved.errors) ? saved.errors.filter(x => validKeys.has(x)) : []);
let queue = [], seen = new Map(), recent = [], current = null, locked = false;
function save() {
  try { localStorage.setItem('korni-v1', JSON.stringify({total, correct, errors:[...errors]})); } catch {}
  stats();
}
function stats() {
  $('total').textContent = total;
  $('correct').textContent = correct;
  $('accuracy').textContent = (total ? Math.round(correct / total * 100) : 0) + '%';
  $('errorTitle').textContent = 'Слова для повторения · ' + errors.size;
  $('errorList').textContent = [...new Set(BANK.filter(x => errors.has(key(x))).map(x => x.word))].join(', ') || 'Пока пусто. Ошибки будут появляться здесь.';
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
  $('category').textContent = names[current.cat];
  $('hint').textContent = current.hint || 'Выбери пропущенную букву';
  const gap = document.createElement('span');
  gap.className = 'gap'; gap.textContent = '·';
  $('word').replaceChildren(document.createTextNode(current.word.slice(0, current.index)), gap, document.createTextNode(current.word.slice(current.index + 1)));
  const chars = current.choices || [...new Set(['а', 'о', 'е', 'и', current.answer])];
  for (const char of chars) {
    const b = document.createElement('button');
    b.textContent = char; b.setAttribute('aria-label', 'Вставить ' + char);
    b.onclick = () => answer(char);
    $('answers').append(b);
  }
}
function answer(char) {
  if (locked || !current || ![...$('answers').children].some(b => b.textContent === char)) return;
  locked = true; total++;
  const ok = char === current.answer;
  if (ok) { correct++; errors.delete(key(current)); } else errors.add(key(current));
  for (const b of $('answers').children) {
    b.disabled = true;
    if (b.textContent === current.answer) b.classList.add('right');
    else if (b.textContent === char) b.classList.add('wrong');
  }
  $('word').querySelector('.gap').textContent = current.answer;
  $('feedback').replaceChildren();
  const heading = document.createElement('strong');
  heading.textContent = ok ? 'Верно! ' : 'Запомни: ' + current.word + '. ';
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
  else if (e.key.length === 1 && /^[а-яё]$/i.test(e.key)) answer(e.key.toLowerCase());
});
$('source').textContent = taskCount(BANK.length) + ': ' + BANK.filter(x => x.cat === 'check').length + ' на проверяемые гласные, ' + BANK.filter(x => x.cat === 'alternate').length + ' на чередование, ' + BANK.filter(x => x.cat === 'dict').length + ' на словарные гласные и ' + BANK.filter(x => x.cat === 'special').length + ' на другие орфограммы. Одно слово может содержать разные орфограммы: тема относится именно к пропущенной букве. Прогресс сохраняется в этом браузере. Скачанная копия работает без интернета.';
stats(); start();
