'use strict';
const $ = id => document.getElementById(id);
const STORAGE = document.body.dataset.storage;
const NAMES = {noun:'Существительные',adj:'Прилагательные',verb:'Глаголы',adv:'Наречия',prefix:'Приставка + суффикс',suffix:'Только суффикс'};
const EXAM_BANK = typeof EXAMS === 'undefined' ? [] : EXAMS;
const TRAINING_BANK = typeof ADVERBS === 'undefined' ? BANK : [...BANK.filter(x=>x.cat!=='adv'),...ADVERBS.map(x=>({...x,cat:'adv'}))];
const ALL = [...TRAINING_BANK,...EXAM_BANK];
const valid = new Set(ALL.map(x=>x.id));
let saved={};
try { const s=JSON.parse(localStorage.getItem(STORAGE)||'{}'); if(s && typeof s==='object' && !Array.isArray(s)) saved=s; } catch {}
const count=x=>Number.isSafeInteger(x)&&x>=0?x:0;
let total=count(saved.total),correct=Math.min(total,count(saved.correct));
let errors=new Set(Array.isArray(saved.errors)?saved.errors.filter(x=>valid.has(x)):[]);
let queue=[],current=null,locked=false,selected=new Set(),stage=0;
const isExam=()=> $('format')?.value==='exam';
function pool(){
  const mode=$('mode').value;
  return (isExam()?EXAM_BANK:TRAINING_BANK).filter(x=>mode==='all'||(mode==='errors'?errors.has(x.id):x.cat===mode));
}
function shuffle(a){ for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a; }
function stats(){
  $('total').textContent=total;$('correct').textContent=correct;
  $('accuracy').textContent=(total?Math.round(correct/total*100):0)+'%';
  $('errorTitle').textContent='Для повторения · '+errors.size;
  $('errorList').textContent=ALL.filter(x=>errors.has(x.id)).map(x=>x.word||'Вариант '+x.number).join(' · ')||'Пока пусто. Ошибки появятся здесь.';
}
function save(){try{localStorage.setItem(STORAGE,JSON.stringify({total,correct,errors:[...errors]}));}catch{}stats();}
function start(){queue=shuffle(pool().slice());current=null;next();}
function masked(x,reveal=false){
  const span=document.createElement('span');
  const gap=document.createElement('span');gap.className='gap';gap.textContent=reveal?x.answer:'·';
  span.append(document.createTextNode(x.word.slice(0,x.index)),gap,document.createTextNode(x.word.slice(x.index+1)));
  return span;
}
function button(label,fn){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=fn;return b;}
function next(){
  const previous=current?.id;
  locked=false;stage=0;selected.clear();
  $('feedback').replaceChildren();$('answers').replaceChildren();$('word').replaceChildren();
  $('next').hidden=true;$('check').hidden=true;
  if($('mode').value==='errors')queue=queue.filter(x=>errors.has(x.id));
  if(!queue.length){queue=shuffle(pool().slice());if(queue.length>1&&queue[0].id===previous)[queue[0],queue[1]]=[queue[1],queue[0]];}
  current=queue.shift();
  $('progress').textContent=pool().length+' заданий в подборке';
  $('word').classList.toggle('exam',isExam());
  if(!current){$('word').textContent='Ошибок нет';$('hint').textContent='Выбери другую подборку, чтобы продолжить.';$('category').textContent='Повторение';return;}
  if(isExam()) renderExam();
  else {
    $('word').append(masked(current));$('category').textContent=NAMES[current.cat];
    renderLetters();
  }
}
function renderLetters(){
  stage=2;$('answers').replaceChildren();
  $('hint').textContent=current.base?'Выбери пропущенную букву':(current.hint?'Контекст: '+current.hint:'Выбери пропущенную букву');
  for(const char of current.choices){const b=button(char,()=>answer(char));b.setAttribute('aria-label','Вставить '+char);$('answers').append(b);}
}
function renderExam(){
  $('category').textContent='ЕГЭ · Вариант '+current.number;
  $('hint').textContent='Отметь все ряды, где в двух словах пропущена одинаковая буква.';
  current.rows.forEach((pair,i)=>{
    const b=document.createElement('button');b.type='button';b.className='exam-row';b.setAttribute('aria-pressed','false');
    const number=document.createElement('b');number.textContent=i+1;
    b.append(number);
    pair.forEach((x,j)=>{const w=document.createElement('span');w.append(masked(x));if(x.hint){const small=document.createElement('small');small.textContent=' ('+x.hint+')';w.append(small);}b.append(w);});
    b.onclick=()=>toggle(i+1);$('word').append(b);
  });
  $('check').hidden=false;
}
function toggle(n){if(locked||!current)return;selected.has(n)?selected.delete(n):selected.add(n);const b=$('word').children[n-1];b.setAttribute('aria-pressed',String(selected.has(n)));}
function record(ok){total++;if(ok){correct++;errors.delete(current.id);}else errors.add(current.id);locked=true;save();$('next').hidden=false;$('next').focus();}
function answer(char){
  if(locked||!current||stage!==2||!current.choices.includes(char))return;
  const ok=char===current.answer;
  for(const b of $('answers').children){b.disabled=true;if(b.textContent===current.answer)b.classList.add('right');else if(b.textContent===char)b.classList.add('wrong');}
  $('word').replaceChildren(masked(current,true));
  const title=document.createElement('strong');title.textContent=ok?'Верно! ':'Запомни: '+current.word+'. ';
  if(!ok)title.className='bad';
  $('feedback').replaceChildren(title,document.createTextNode(current.rule+(current.context?' Пример: '+current.context:'')));
  record(ok);
}
function check(){
  if(locked||!current)return;
  if(!selected.size){$('feedback').textContent='Сначала отметь хотя бы один ряд.';return;}
  const ok=selected.size===current.answer.length&&current.answer.every(n=>selected.has(n));
  $('check').hidden=true;$('feedback').replaceChildren();
  const title=document.createElement('strong');title.textContent=(ok?'Верно! ':'Правильный ответ: ')+current.answer.join('')+'.';if(!ok)title.className='bad';$('feedback').append(title);
  [...$('word').children].forEach((b,i)=>{
    b.disabled=true;b.classList.add(current.answer.includes(i+1)?'right':selected.has(i+1)?'wrong':'neutral');
    const pair=current.rows[i];b.replaceChildren();const num=document.createElement('b');num.textContent=i+1;b.append(num);
    for(const w of pair)b.append(masked(w,true));
    const d=document.createElement('details'),s=document.createElement('summary');s.textContent=(i+1)+'. '+pair.map(w=>w.word).join(' · ');
    const p=document.createElement('p');p.textContent=pair.map(w=>w.rule).join(' ');d.append(s,p);$('feedback').append(d);
  });
  record(ok);
}
$('next').onclick=next;$('check').onclick=check;$('mode').onchange=start;
if($('format'))$('format').onchange=()=>{for(const o of $('mode').options)o.hidden=isExam()&&!['all','errors'].includes(o.value);$('mode').value='all';start();};
$('reset').onclick=()=>{total=0;correct=0;save();start();};
$('clearErrors').onclick=()=>{errors.clear();save();if($('mode').value==='errors')start();};
document.addEventListener('keydown',e=>{
  if(e.ctrlKey||e.metaKey||e.altKey||e.repeat||e.target.isContentEditable||['SELECT','INPUT','TEXTAREA','BUTTON','SUMMARY','A'].includes(e.target.tagName))return;
  if(e.key==='Enter'&&locked){e.preventDefault();next();}
  else if(isExam()&&/^[1-5]$/.test(e.key)){e.preventDefault();toggle(Number(e.key));}
  else if(!isExam()&&e.key.length===1)answer(e.key.toLowerCase());
});
stats();start();
