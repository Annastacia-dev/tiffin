/* eslint-disable */
// The planner UI: plain DOM code mounted into the markup rendered by Planner.tsx.
// Data comes from the Next.js API routes (Supabase behind them).
import { signOut } from "next-auth/react";
import { fmtWall, prepSchedule, wallToInstant } from "../lib/reminders";

let mounted=false;
export function mountPlanner(){
if(mounted)return;mounted=true;
/* ---------- constants & defaults ---------- */
const CATS=["Proteins","Grains & bread","Dairy","Vegetables","Fruit","Nuts & seeds","Pantry","Other"];
const MEAL_TYPES=["Breakfast","Lunch","Dinner","Snack"];
const MEAL_SHORT={Breakfast:"B",Lunch:"L",Dinner:"D",Snack:"S"};
const WD=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const WD_L=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const MONTHS=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTHS_L=["January","February","March","April","May","June","July","August","September","October","November","December"];
const DEFAULTS={
  exclusions:["beans","ndengu","lentils","chickpeas"],
  diet:"Eats meat, chicken and fish. Focus on gut health and high fiber: whole grains, vegetables, fruit, nuts and seeds, fermented dairy like maziwa mala.",
  cuisines:["Japanese","Mexican","Lebanese","Indian","Swahili","Chinese","Middle Eastern","Mediterranean","Thai","Italian","Ethiopian","Kenyan"],
  location:"Nairobi, Kenya – only ingredients easy to find at Carrefour, Naivas, Quickmart or local markets",
  notes:"Cooking for 1 person. Breakfast and lunch are packed for work, so they must travel well. Lunch recipes make 2–3 portions so leftovers cover dinner.",
  meals:["Breakfast","Lunch","Snack"],
  days:[0,1,2,3,4],
  lunchPortions:3,
  showCalories:false,
  showPrices:false,
  currency:"KES",
  mealTimes:{Breakfast:"07:00",Lunch:"12:30",Dinner:"19:00",Snack:"15:30"},
  reminders:{prep:true,cook:false},
  quietStart:"22:00",
  quietEnd:"07:00",
  timezone:"Africa/Nairobi"
};
const svg=p=>`<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const ICON_MOVE=svg('<path d="M4 12h15"/><path d="M13 6l6 6-6 6"/>');
const ICON_SWITCH=svg('<path d="M3 8h17"/><path d="M16 4l4 4-4 4"/><path d="M21 16H4"/><path d="M8 12l-4 4 4 4"/>');
const ICON_REMOVE=svg('<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/><path d="M10 11v5"/><path d="M14 11v5"/>');
const ICON_CLOSE=svg('<path d="M6 6l12 12"/><path d="M18 6L6 18"/>');
const TABS=[
  ["plan","Plan",svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>')],
  ["shopping","Shopping",svg('<path d="M6 8h12l1 13H5L6 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>')],
  ["recipes","Recipes",svg('<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4z"/><path d="M5 17a3 3 0 0 1 3-3h11"/>')],
  ["settings","Settings",svg('<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>')]
];

/* ---------- state ---------- */
const S={recipes:{},days:{},settings:null,checks:{},profile:null,pushKey:null,prices:{}};
let today=new Date(); today.setHours(0,0,0,0);
const ui={tab:"plan",mode:"week",anchor:mondayOf(today),day:ymd(today),meal:0,shopRange:"week",shopFrom:null,shopTo:null,hideDone:false,recFilter:"All",recSearch:"",openRecipe:null,aiHint:"",delArm:null,
  loaded:false,loadFailed:false,dirty:false,profileDirty:false,settingsDraft:null,aiOpen:null,newDesc:"",newType:"Lunch",addDate:null,push:"checking",slotMove:null};

/* ---------- utils ---------- */
function esc(s){return String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}
function ymd(d){return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
function parse(s){const [y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d)}
function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x}
function mondayOf(d){const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());return addDays(x,-((x.getDay()+6)%7))}
function wdIdx(d){return (d.getDay()+6)%7}
function settings(){return Object.assign({},DEFAULTS,S.settings||{})}
function newId(){return "r"+Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
function cap(s){s=String(s||"");return s.charAt(0).toUpperCase()+s.slice(1)}
function shortDate(d){return d.getDate()+" "+MONTHS[d.getMonth()]}
function nice(q){
  if(q==null||q==="")return"";q=Number(q);if(!isFinite(q))return"";
  const w=Math.floor(q+1e-9),f=q-w,fr=[[.25,"¼"],[.33,"⅓"],[.5,"½"],[.67,"⅔"],[.75,"¾"]];
  for(const [v,c] of fr) if(Math.abs(f-v)<.04) return (w||"")+c;
  if(f>.04) return String(Math.round(q*10)/10);
  return String(w);
}
function fmtIng(i){const u=i.unit&&i.unit!=="pc"?i.unit:"";return [nice(i.qty),u,i.item].filter(Boolean).join(" ")+(i.note?", "+i.note:"")}
function escRe(s){return s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}
function violates(r){
  const terms=(settings().exclusions||[]).map(t=>String(t).trim().toLowerCase()).filter(Boolean);
  if(!r||!terms.length)return[];
  const text=[r.title,...(r.ingredients||[]).map(i=>(i.item||"")+" "+(i.note||""))].join(" ").toLowerCase();
  return terms.filter(t=>new RegExp("\\b"+escRe(t)).test(text));
}
function toast(msg,undo){
  const t=document.getElementById("toast");
  t.innerHTML=`<span>${esc(msg)}</span>${undo?'<button type="button">Undo</button>':""}`;
  if(undo)t.querySelector("button").onclick=()=>{t.classList.remove("show");undo()};
  t.classList.add("show");clearTimeout(toast._t);toast._t=setTimeout(()=>t.classList.remove("show"),undo?7000:3200);
}
function banner(msg){document.getElementById("banner").innerHTML=msg?`<div>${esc(msg)}</div>`:""}
function progress(done,total,label){
  const pct=total?Math.round(done/total*100):0;
  return `<div class="progress"><div class="progress-label">${esc(label)}</div><div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${done}" aria-label="${esc(label)}"><span style="width:${pct}%"></span></div></div>`;
}

/* ---------- plan helpers ---------- */
function slotsOf(date){return S.days[date]||{}}
function recipeAt(date,meal){const id=slotsOf(date)[meal];return id?S.recipes[id]:null}
function weekDates(mon){const st=settings();return [...Array(7)].map((_,i)=>addDays(mon,i)).filter(d=>st.days.includes(wdIdx(d)))}
function monthDates(first){const st=settings(),out=[];let d=new Date(first.getFullYear(),first.getMonth(),1);while(d.getMonth()===first.getMonth()){if(st.days.includes(wdIdx(d)))out.push(new Date(d));d=addDays(d,1)}return out}
// One save at a time, in order, so a quick Undo can't be overwritten by the change it undoes
let planSaves=Promise.resolve();
async function applyChanges(changes){ // changes: {date:{meal:id|null}}
  for(const [date,meals] of Object.entries(changes)){
    const day=Object.assign({},S.days[date]||{});
    for(const [m,id] of Object.entries(meals)){ if(id) day[m]=id; else delete day[m]; }
    if(Object.keys(day).length) S.days[date]=day; else delete S.days[date];
  }
  render();
  const ok=await (planSaves=planSaves.then(()=>api("POST","/api/plan",{changes})));
  if(!ok)loadState(); // the save failed: go back to what the server has
}
function changeWithUndo(changes,msg){
  const prev={};
  for(const [date,meals] of Object.entries(changes)){prev[date]={};for(const m of Object.keys(meals))prev[date][m]=slotsOf(date)[m]||null}
  applyChanges(changes);
  toast(msg,()=>applyChanges(prev));
}

/* ---------- API ---------- */
let pending=0;
async function api(method,url,body){
  pending++;
  try{
    const r=await fetch(url,{method,headers:body?{"Content-Type":"application/json"}:{},body:body?JSON.stringify(body):undefined});
    if(r.status===401){location.href="/signin";return null}
    const j=await r.json().catch(()=>({}));
    if(!r.ok){const e=new Error(j.error||("HTTP "+r.status));e.code=j.code;e.status=r.status;throw e}
    return j;
  }catch(e){
    if(url!=="/api/ai"){console.error(e);toast("Couldn't save – check your connection");return null}
    throw e;
  }finally{pending--}
}
async function loadState(){
  try{
    const r=await fetch("/api/state",{cache:"no-store"});
    if(r.status===401){location.href="/signin";return}
    if(!r.ok)throw new Error("HTTP "+r.status);
    const j=await r.json();
    S.recipes=j.recipes||{};S.days=j.days||{};S.settings=j.settings||null;S.checks=j.checks||{};S.profile=j.profile||S.profile;S.pushKey=j.push?.publicKey||null;S.prices=j.prices||{};
    ui.offline=!!r.headers.get("x-tiffin-offline");
    const first=!ui.loaded;
    ui.loaded=true;ui.loadFailed=false;
    banner(r.headers.get("x-tiffin-offline")?"You're offline. This is your last saved plan, and changes won't save until you reconnect.":"");
    if(first){goToday();render();refreshPush()}else softRender();
  }catch(e){
    console.error(e);
    if(ui.loaded)banner("Couldn't refresh your saved data – check your connection.");
    else{ui.loadFailed=true;render()}
  }
}

/* ---------- rendering ---------- */
const main=document.getElementById("main");
let pendingRender=false;
function softRender(){
  if(ui.tab==="settings"&&(ui.dirty||ui.profileDirty))return; // don't wipe what's being typed
  const a=document.activeElement;
  if(a&&main.contains(a)&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)){pendingRender=true;return}
  render();
}
document.addEventListener("focusout",()=>setTimeout(()=>{if(pendingRender){pendingRender=false;softRender()}},50));

function renderNav(){
  const nav=document.getElementById("nav");
  if(!nav.children.length)nav.innerHTML=TABS.map(([id,l,icon])=>`<a href="#${id}" data-tab="${id}">${icon}<span>${l}</span></a>`).join("");
  nav.querySelectorAll("a").forEach(a=>{const on=a.dataset.tab===ui.tab;a.classList.toggle("on",on);if(on)a.setAttribute("aria-current","page");else a.removeAttribute("aria-current")});
}
// Rendering replaces the DOM, so remember what had focus and put it back
function focusKey(el){
  if(el.id)return "#"+CSS.escape(el.id);
  for(const k of ["act","mode","nav","day","meal","goday","range","recf","open","check","pick"]){
    const v=el.dataset&&el.dataset[k];
    if(v!==undefined)return `[data-${k}="${CSS.escape(v)}"]`;
  }
  return null;
}
function skeleton(){
  return `<div class="skel" aria-busy="true" aria-label="Loading your plan"><div class="skel-line" style="width:45%"></div><div class="skel-block" style="height:64px"></div><div class="skel-block"></div><div class="skel-block"></div></div>`;
}
function render(){
  renderNav();
  const a=document.activeElement,fk=a&&main.contains(a)?focusKey(a):null;
  if(ui.dirty&&document.getElementById("s-excl"))ui.settingsDraft=readSettings();
  if(!ui.loaded){
    main.innerHTML=ui.loadFailed?`<div class="card empty"><b>Couldn't load your plan</b>Check your connection and try again.<div class="emptyact"><button class="btn" data-act="retry-load">Try again</button></div></div>`:skeleton();
    return;
  }
  if(ui.tab==="plan") main.innerHTML=renderPlan();
  else if(ui.tab==="shopping") main.innerHTML=renderShopping();
  else if(ui.tab==="recipes") main.innerHTML=renderRecipes();
  else main.innerHTML=renderSettings();
  if(fk){const el=main.querySelector(fk)||main.querySelector('.mealhead[aria-expanded="true"]');if(el)el.focus({preventScroll:true})}
}

function kcal(n){return "≈"+Number(n).toLocaleString()+" kcal"}
function hoursLabel(h){return h+(h===1?" hour":" hours")}
function prepHTML(r,date,meal){
  if(!r.prep||!r.prep.length)return"";
  const st=settings(),sched=date?prepSchedule(r,date,meal,st):r.prep;
  return `<div class="prepbox"><h4>Prep ahead</h4><ul>${sched.map(s=>{
    const passed=date&&wallToInstant(s.wall,st.timezone).getTime()<Date.now();
    return `<li><b>${esc(s.task)}</b> <span class="muted">${hoursLabel(s.hoursBefore)} before cooking${date?(passed?" · start time has passed":" · start by "+fmtWall(s.wall)):""}</span></li>`}).join("")}</ul></div>`;
}
function recipeHTML(r,{showType=true,showTitle=true,date=null,meal=null}={}){
  const v=violates(r);
  let ing="",grp="";
  (r.ingredients||[]).forEach(i=>{const g=i.group||"";if(g!==grp){grp=g;if(g)ing+=`<li class="subhead">${esc(g)}</li>`}ing+=`<li>${esc(fmtIng(i))}</li>`});
  return `${showType?`<span class="tag">${esc(r.mealType||"")}</span>`:""}
    ${showTitle?`<h3>${esc(r.title)}</h3>`:""}
    <div class="meta">${[r.cuisine,r.servings,settings().showCalories&&r.calories?kcal(r.calories)+" per portion":""].filter(Boolean).map(esc).join(" · ")}</div>
    ${v.length?`<div class="warnbox">⚠ Contains something on your exclusion list: ${esc(v.join(", "))}</div>`:""}
    ${prepHTML(r,date,meal)}
    <div class="cols"><div><h4>Ingredients</h4><ul class="ing">${ing}</ul></div>
    <div><h4>Recipe</h4><ol class="steps">${(r.steps||[]).map(s=>`<li>${esc(s)}</li>`).join("")}</ol>
    ${r.tip?`<div class="tip"><b>Tip:</b> ${esc(r.tip)}</div>`:""}</div></div>`;
}

function renderPlan(){
  const st=settings();
  const isWeek=ui.mode==="week";
  let label;
  if(isWeek){const end=addDays(ui.anchor,6);label=shortDate(ui.anchor)+" – "+shortDate(end)+" "+end.getFullYear()}
  else label=MONTHS_L[ui.anchor.getMonth()]+" "+ui.anchor.getFullYear();
  const dates=scopeDates(),total=dates.length*st.meals.length;
  let filled=0;dates.forEach(d=>st.meals.forEach(m=>{if(recipeAt(ymd(d),m))filled++}));
  const empty=total-filled,anySlots=dates.some(d=>st.meals.some(m=>slotsOf(ymd(d))[m]));
  let h=`<div class="toolbar">
    <div class="seg"><button data-mode="week" class="${isWeek?"on":""}" aria-pressed="${isWeek}">Week</button><button data-mode="month" class="${!isWeek?"on":""}" aria-pressed="${!isWeek}">Month</button></div>
    <div class="navdate"><button class="icon" data-nav="-1" aria-label="Previous ${isWeek?"week":"month"}">‹</button><span class="lbl" aria-live="polite">${label}</span><button class="icon" data-nav="1" aria-label="Next ${isWeek?"week":"month"}">›</button><button class="link" data-nav="0">Today</button></div>
  </div>
  ${total?progress(filled,total,`${filled} of ${total} meals planned`):""}
  <div class="actions">
    <button class="btn" data-act="ai-fill" ${empty?"":"disabled"}>✨ ${empty?`Fill ${empty} empty meal${empty>1?"s":""} with AI`:"Everything's planned"}</button>
    <button class="btn ghost" data-act="lib-fill" ${empty?"":"disabled"}>Fill from my recipes</button>
    <button class="btn quiet" data-act="clear" ${anySlots?"":"disabled"}>Clear ${isWeek?"week":"month"}</button>
  </div>`;
  return h+(isWeek?renderWeek(st):renderMonth(st));
}

function renderWeek(st){
  const dates=weekDates(ui.anchor);
  if(!dates.length) return `<div class="card empty"><b>No days selected</b>Choose which days to plan in Settings.<div class="emptyact"><a class="btn ghost" href="#settings">Open settings</a></div></div>`;
  const ids=dates.map(ymd),todayId=ymd(today);
  if(!ids.includes(ui.day)) ui.day=ids.includes(todayId)?todayId:ids[0];
  if(ui.meal>=st.meals.length) ui.meal=0;
  let h=`<div class="daytabs">${dates.map(d=>{const id=ymd(d);const n=st.meals.filter(m=>recipeAt(id,m)).length;
    return `<button data-day="${id}" class="${id===ui.day?"on":""} ${id===todayId?"today":""}" aria-pressed="${id===ui.day}" aria-label="${WD_L[wdIdx(d)]} ${shortDate(d)}${id===todayId?", today":""}, ${n} of ${st.meals.length} meals planned">${WD[wdIdx(d)]}<small>${shortDate(d)}</small><span class="pips" aria-hidden="true">${st.meals.map(m=>`<i class="${recipeAt(id,m)?"f":""}"></i>`).join("")}</span></button>`}).join("")}</div>`;
  const date=ui.day,dd=parse(date);
  const dayRecipes=st.meals.map(m=>recipeAt(date,m)).filter(Boolean),dayCal=dayRecipes.reduce((n,r)=>n+(r.calories||0),0),noCal=dayRecipes.filter(r=>!r.calories).length;
  h+=`<h2 class="dayh">${WD_L[wdIdx(dd)]} ${shortDate(dd)}${date===todayId?' <span class="tag">Today</span>':""}${st.showCalories&&dayCal?`<span class="daykcal">${kcal(dayCal)}${noCal?` + ${noCal} unknown`:""}</span>`:""}</h2>`;
  h+=st.meals.map((meal,i)=>{
    const r=recipeAt(date,meal),open=i===ui.meal,bad=r&&violates(r).length;
    return `<section class="mealcard ${open?"open":""}">
      <button class="mealhead" data-meal="${i}" aria-expanded="${open}">
        <span class="mealname">${esc(meal)}</span>
        <span class="mealtitle ${r?"":"none"}">${bad?"⚠ ":""}${r?esc(r.title):"Nothing planned"}${r?mealSub(r,date,meal,st):""}</span>
        <span class="chev" aria-hidden="true">›</span>
      </button>
      ${open?`<div class="mealbody">${slotTools(date,meal,r)}${r?recipeHTML(r,{showType:false,showTitle:false,date,meal}):`<div class="empty"><b>No ${esc(meal.toLowerCase())} planned</b>Pick one of your recipes or ask AI for a new idea.</div>`}${slotActions(date,meal,r)}</div>`:""}
    </section>`;
  }).join("");
  return h;
}
function mealSub(r,date,meal,st){
  const bits=[];
  if(st.showCalories&&r.calories)bits.push(kcal(r.calories));
  const sched=prepSchedule(r,date,meal,st).sort((a,b)=>a.wall-b.wall)[0];
  if(sched)bits.push("Start prep "+fmtWall(sched.wall));
  return bits.length?`<small class="mealsub">${esc(bits.join(" · "))}</small>`:"";
}
function dayLabel(d){return WD[wdIdx(d)]+" "+shortDate(d)}
function slotTools(date,meal,r){
  if(!r)return "";
  const m=ui.slotMove&&ui.slotMove.date===date&&ui.slotMove.meal===meal?ui.slotMove:null;
  const tool=(act,icon,label,kind)=>`<button type="button" class="tool ${kind&&m&&m.kind===kind?"on":""} ${act==="rm-slot"?"danger":""}" data-act="${act}" data-date="${date}" data-meal="${esc(meal)}" ${kind?`aria-expanded="${!!m&&m.kind===kind}"`:""}>${icon}<span>${label}</span></button>`;
  return `<div class="slottools" role="group" aria-label="Change this ${esc(meal.toLowerCase())}">${tool("slot-move",ICON_MOVE,"Move","move")}${tool("slot-switch",ICON_SWITCH,"Switch","switch")}${tool("rm-slot",ICON_REMOVE,"Remove")}</div>${m?movePanel(m,r):""}`;
}
// Moving replaces whatever the other day has for this meal. Switching needs something to swap with.
function movePanel(m,r){
  const move=m.kind==="move",end=addDays(m.anchor,6);
  const days=weekDates(m.anchor).filter(d=>ymd(d)!==m.date).map(d=>{
    const id=ymd(d),other=recipeAt(id,m.meal),same=other&&other.id===r.id,off=same||(!move&&!other);
    const note=same?"Same recipe":other?(move?"Replaces ":"Swaps with ")+other.title:move?"Empty":"Nothing to switch with";
    return `<button type="button" class="dayopt" data-act="slot-target" data-target="${id}" ${off?"disabled":""}><b>${dayLabel(d)}</b><span>${esc(note)}</span></button>`}).join("");
  return `<div class="movepanel">
    <div class="movehead"><span>${move?"Move":"Switch"} ${esc(m.meal.toLowerCase())} ${move?"to":"with"}</span><button type="button" class="icon" data-act="slot-close" aria-label="Close">${ICON_CLOSE}</button></div>
    <div class="moveweek"><button type="button" class="icon" data-act="slot-week" data-step="-1" aria-label="Previous week">‹</button><span aria-live="polite">${shortDate(m.anchor)} – ${shortDate(end)}</span><button type="button" class="icon" data-act="slot-week" data-step="1" aria-label="Next week">›</button></div>
    ${days||'<p class="muted">No days to plan in this week.</p>'}
  </div>`;
}
function slotActions(date,meal,r){
  const opts=Object.values(S.recipes).filter(x=>x.mealType===meal).sort((a,b)=>a.title.localeCompare(b.title))
    .map(x=>`<option value="${esc(x.id)}" ${r&&r.id===x.id?"selected":""}>${violates(x).length?"⚠ ":""}${esc(x.title)}</option>`).join("");
  return `<div class="slotact">
    <label class="field"><span>${r?"Swap for another recipe":"Choose from my recipes"}</span>
      <select data-pick="${date}|${esc(meal)}" ${opts?"":"disabled"}><option value="">${opts?"Select a recipe…":"No saved "+esc(meal.toLowerCase())+" recipes yet"}</option>${opts}</select></label>
    <form class="aiform"><label class="field"><span>Or ask AI for a new idea</span>
      <input type="text" id="hint" placeholder="Optional, e.g. something with beef" value="${esc(ui.aiHint)}"></label>
      <button class="btn" data-act="ai-slot" data-date="${date}" data-meal="${esc(meal)}">✨ New idea</button></form>
  </div>`;
}

function renderMonth(st){
  const first=new Date(ui.anchor.getFullYear(),ui.anchor.getMonth(),1);
  let d=mondayOf(first);
  const last=new Date(first.getFullYear(),first.getMonth()+1,0);
  let h=`<div class="month">${WD.map(w=>`<div class="hd">${w}</div>`).join("")}`;
  while(d<=last||wdIdx(d)!==0){
    const id=ymd(d),sl=slotsOf(id),inM=d.getMonth()===first.getMonth(),on=st.days.includes(wdIdx(d));
    const planned=st.meals.filter(m=>sl[m]&&S.recipes[sl[m]]);
    const lines=planned.map(m=>`<span class="m"><b>${MEAL_SHORT[m]}</b> ${esc(S.recipes[sl[m]].title)}</span>`).join("");
    const n=planned.length;
    h+=`<button class="cell ${inM?"":"out"} ${on?"":"off"} ${id===ymd(today)?"today":""}" data-goday="${id}" aria-label="${WD_L[wdIdx(d)]} ${d.getDate()} ${MONTHS_L[d.getMonth()]}, ${n} meal${n===1?"":"s"} planned"><span class="num">${d.getDate()}</span>${lines}${n?`<span class="cnt">${n} meal${n>1?"s":""}</span>`:""}</button>`;
    d=addDays(d,1);
    if(d>last&&wdIdx(d)===0)break;
  }
  const legend=MEAL_TYPES.filter(m=>st.meals.includes(m)).map(m=>`${MEAL_SHORT[m]} = ${m}`).join(" · ");
  return h+`</div><p class="muted" style="margin-top:10px">${legend}. Tap a day to see its recipes.</p>`;
}

/* ---------- shopping ---------- */
function shopRange(){
  const mon=mondayOf(today);
  switch(ui.shopRange){
    case "week": return [mon,addDays(mon,6),"This week"];
    case "next": return [addDays(mon,7),addDays(mon,13),"Next week"];
    case "2w": return [mon,addDays(mon,13),"Next 2 weeks"];
    case "month": return [new Date(today.getFullYear(),today.getMonth(),1),new Date(today.getFullYear(),today.getMonth()+1,0),"This month"];
    case "nmonth": return [new Date(today.getFullYear(),today.getMonth()+1,1),new Date(today.getFullYear(),today.getMonth()+2,0),"Next month"];
    default:{const f=ui.shopFrom?parse(ui.shopFrom):mon,t=ui.shopTo?parse(ui.shopTo):addDays(mon,6);return [f,t<f?f:t,"Custom"]}
  }
}
function buildList(from,to){
  const items={},on=settings().meals;let meals=0;
  for(let d=new Date(from);d<=to;d=addDays(d,1)){
    const sl=slotsOf(ymd(d));
    for(const [m,id] of Object.entries(sl)){const r=S.recipes[id];if(!r||!on.includes(m))continue;meals++;
      (r.ingredients||[]).forEach(i=>{
        const name=String(i.item||"").trim().toLowerCase();if(!name||name==="water")return;
        const cat=CATS.includes(i.category)?i.category:"Other";
        const it=items[name]||(items[name]={name,cat,amounts:{},uses:0});it.uses++;
        let u=String(i.unit||"").trim().toLowerCase(),q=(typeof i.qty==="number"&&isFinite(i.qty))?i.qty:null;
        if(u==="kg"){u="g";if(q!=null)q*=1000} if(["l","litre","liter","litres","liters"].includes(u)){u="ml";if(q!=null)q*=1000}
        if(u==="pcs"||u==="piece"||u==="pieces")u="pc";
        if(q!=null) it.amounts[u]=(it.amounts[u]||0)+q; else it.amounts["_"]=1;
      });
    }
  }
  return {items,meals};
}
const WHOLE_UNITS=["pc","head","bunch","tin"];
function fmtAmt(it){
  if(it.cat==="Pantry")return"check stock";
  const parts=Object.entries(it.amounts).filter(([u])=>u!=="_").map(([u,q])=>{
    if(u==="g"&&q>=1000)return nice(Math.round(q/100)/10)+" kg";
    if(u==="ml"&&q>=1000)return nice(Math.round(q/100)/10)+" L";
    if(u==="g"||u==="ml")return Math.round(q)+" "+u;
    if(WHOLE_UNITS.includes(u))q=Math.ceil(q-1e-9);
    return nice(q)+(u&&u!=="pc"?" "+u:"");
  });
  return parts.length?parts.join(" + "):"as needed";
}
/* Pantry items say "check stock", so they may not need buying and stay out of the total */
function itemPrice(it){
  const parts=Object.entries(it.amounts).filter(([u])=>u!=="_");
  if(it.cat==="Pantry"||!parts.length)return null;
  let sum=0;
  for(const [u,q] of parts){const p=S.prices[it.name+"|"+u];if(p==null)return null;sum+=p*(WHOLE_UNITS.includes(u)?Math.ceil(q-1e-9):q)}
  return sum;
}
function money(n){const d=n>=20?0:2;return new Intl.NumberFormat(undefined,{style:"currency",currency:settings().currency,currencyDisplay:"code",minimumFractionDigits:d,maximumFractionDigits:d}).format(n)}
function shopTotalHTML(all,rk){
  const priced=all.filter(i=>itemPrice(i)!=null),sum=l=>l.reduce((t,i)=>t+itemPrice(i),0);
  if(!priced.length&&ui.pricing)return '<section class="card shoptotal"><p class="muted" role="status">Estimating prices…</p></section>';
  if(!priced.length&&!ui.priceError)return "";
  const left=priced.filter(i=>!S.checks[rk+"|"+i.name]);
  const pantry=all.filter(i=>i.cat==="Pantry").length,unknown=all.length-priced.length-pantry;
  const out=[pantry?`${pantry} pantry item${pantry>1?"s":""}`:"",unknown&&!ui.pricing?`${unknown} item${unknown>1?"s":""} with no estimate`:""].filter(Boolean).join(" and ");
  return `<section class="card shoptotal">${priced.length?`<div class="sum"><span>Estimated total</span><b>${esc(money(sum(priced)))}</b></div>
    ${left.length<priced.length?`<div class="sum"><span>Left to buy</span><span>${esc(money(sum(left)))}</span></div>`:""}
    <p class="muted">An AI guide for the amounts needed. Whole packs can cost more.${out?` Doesn't include ${out}.`:""}${ui.pricing?" Still estimating…":""}</p>`:""}
    ${ui.priceError?'<p class="muted">Couldn\'t estimate prices right now. <button type="button" class="link" data-act="price-retry">Try again</button></p>':""}</section>`;
}
function renderShopping(){
  const [from,to,label]=shopRange();
  const {items,meals}=buildList(from,to);
  const rk=ymd(from)+"_"+ymd(to);
  const ranges=[["week","This week"],["next","Next week"],["2w","2 weeks"],["month","This month"],["nmonth","Next month"],["custom","Custom"]];
  let h=`<div class="toolbar"><h2>Shopping list</h2><button class="btn" data-act="copy-list" ${meals?"":"disabled"}>Copy list</button></div>
  <div class="ranges">${ranges.map(([k,l])=>`<button data-range="${k}" class="${ui.shopRange===k?"on":""}" aria-pressed="${ui.shopRange===k}">${l}</button>`).join("")}</div>`;
  if(ui.shopRange==="custom") h+=`<div class="custom"><label for="sfrom">From</label><input type="date" id="sfrom" value="${ymd(from)}"><label for="sto">to</label><input type="date" id="sto" value="${ymd(to)}"></div>`;
  h+=`<p class="muted">${label}: ${shortDate(from)} – ${shortDate(to)} · ${meals} planned meal${meals===1?"":"s"}. Amounts are added up across every recipe in this range.</p>`;
  if(!meals) return h+`<div class="card empty"><b>Nothing planned in this range</b>Fill the days on the Plan tab and your list appears here.<div class="emptyact"><a class="btn ghost" href="#plan">Go to plan</a></div></div>`;
  const all=Object.values(items),done=all.filter(i=>S.checks[rk+"|"+i.name]).length;
  h+=`<div class="shophead">${progress(done,all.length,`${done} of ${all.length} items ticked`)}<label class="toggle"><input type="checkbox" id="hidedone" ${ui.hideDone?"checked":""}>Hide ticked</label></div>`;
  if(settings().showPrices){h+=shopTotalHTML(all,rk);setTimeout(fillPrices)}
  if(ui.hideDone&&done===all.length) return h+`<div class="card empty"><b>All done</b>Everything on this list is ticked.</div>`;
  h+=`<div class="shop">`;
  for(const cat of CATS){
    const list=all.filter(i=>i.cat===cat&&!(ui.hideDone&&S.checks[rk+"|"+i.name])).sort((a,b)=>a.name.localeCompare(b.name));
    if(!list.length)continue;
    h+=`<section class="card"><h4>${cat}</h4>${list.map(it=>{const k=rk+"|"+it.name,on=!!S.checks[k];
      return `<label class="shopitem ${on?"done":""}"><input type="checkbox" data-check="${esc(k)}" ${on?"checked":""}><span class="nm">${esc(cap(it.name))}</span><span class="amt">${esc(fmtAmt(it))}${settings().showPrices&&itemPrice(it)!=null?`<span class="price">${esc(money(itemPrice(it)))}</span>`:""}</span></label>`}).join("")}</section>`;
  }
  return h+`</div>`;
}

/* ---------- recipes ---------- */
function renderRecipes(){
  const all=Object.values(S.recipes);
  if(ui.openRecipe&&S.recipes[ui.openRecipe]){
    const r=S.recipes[ui.openRecipe],planned=settings().meals.includes(r.mealType);
    return `<button class="link" data-act="close-recipe">‹ All recipes</button>
      <section class="card" style="margin-top:8px">${recipeHTML(r)}
      <div class="slotact">
        ${planned?`<form class="aiform"><label class="field"><span>Add to my plan as ${esc(r.mealType.toLowerCase())}</span><input type="date" id="adddate" value="${esc(ui.addDate||ui.day||ymd(today))}"></label><button class="btn" data-act="add-to-plan" data-id="${esc(r.id)}">Add to plan</button></form>`
        :`<p class="muted">Turn on ${esc(r.mealType)} in Settings to add this to your plan.</p>`}
        <button class="btn quiet danger" data-act="del-recipe" data-id="${esc(r.id)}">${ui.delArm===r.id?"Tap again to delete":"Delete recipe"}</button>
      </div></section>`;
  }
  const on=settings().meals;
  if(ui.recFilter!=="All"&&!on.includes(ui.recFilter))ui.recFilter="All";
  if(!on.includes(ui.newType))ui.newType=on.includes("Lunch")?"Lunch":on[0];
  const q=ui.recSearch.trim().toLowerCase();
  const list=all.filter(r=>(ui.recFilter==="All"||r.mealType===ui.recFilter)&&(!q||(r.title+" "+(r.cuisine||"")).toLowerCase().includes(q)))
    .sort((a,b)=>a.title.localeCompare(b.title));
  const aiOpen=ui.aiOpen===null?!all.length:ui.aiOpen;
  let h=`<div class="toolbar"><h2>Recipes</h2><span class="muted">${all.length} saved</span></div>
  <details class="card aiadd" id="aiadd" ${aiOpen?"open":""}><summary>✨ Add a recipe with AI</summary>
    <p class="muted">Describe a dish you'd like, or paste a recipe from anywhere and it'll be tidied into your format.</p>
    <textarea id="newdesc" aria-label="Describe or paste a recipe" placeholder="e.g. A Thai green curry with chicken and lots of veg, packable for lunch">${esc(ui.newDesc)}</textarea>
    <div class="row" style="margin-top:8px"><select id="newtype" aria-label="Meal type" style="width:auto">${on.map(m=>`<option ${m===ui.newType?"selected":""}>${m}</option>`).join("")}</select>
    <button class="btn" data-act="ai-create">Create recipe</button></div>
  </details>
  <div class="row recfilters"><input type="search" id="recsearch" aria-label="Search recipes" placeholder="Search recipes" value="${esc(ui.recSearch)}">
    <div class="seg">${["All",...on].map(m=>`<button data-recf="${m}" class="${ui.recFilter===m?"on":""}" aria-pressed="${ui.recFilter===m}">${m}</button>`).join("")}</div></div>`;
  if(!list.length) return h+(all.length
    ?`<div class="card empty"><b>No recipes match</b>Try another search or meal type.<div class="emptyact"><button class="btn ghost" data-act="clear-filters">Clear filters</button></div></div>`
    :`<div class="card empty"><b>No recipes here yet</b>Create one above, or use "Fill with AI" on the Plan tab.</div>`);
  return h+`<div class="reclist">${list.map(r=>`<button class="recitem" data-open="${esc(r.id)}"><span class="tag">${esc(r.mealType)}</span><span class="t">${violates(r).length?"⚠ ":""}${esc(r.title)}</span><span class="s">${esc([r.cuisine,r.servings,settings().showCalories&&r.calories?kcal(r.calories):""].filter(Boolean).join(" · "))}</span></button>`).join("")}</div>`;
}

/* ---------- settings ---------- */
function renderSettings(){
  const st=ui.settingsDraft||settings();
  return `<h2>Settings</h2><p class="muted">These guide AI recipe ideas and which days and meals you plan.</p>
  <form id="settingsform" novalidate>
  <section class="card form">
    <h3>What to plan</h3>
    <label>Meals to plan</label><div class="help">Switched-off meals leave your plan and shopping list. Their recipes and planned days are kept, so switching one back on restores them.</div><div class="checks">${MEAL_TYPES.map(m=>`<label><input type="checkbox" name="s-meal" value="${m}" ${st.meals.includes(m)?"checked":""}>${m}</label>`).join("")}</div>
    <label>Days to plan</label><div class="checks">${WD.map((w,i)=>`<label><input type="checkbox" name="s-day" value="${i}" ${st.days.includes(i)?"checked":""}>${w}</label>`).join("")}</div>
    <label for="s-lp">Portions per lunch or dinner recipe</label><input type="number" id="s-lp" min="1" max="8" value="${esc(st.lunchPortions)}" style="width:100px">
    <label>Calories</label><div class="help">AI estimates per portion. They're a guide, not a measurement.</div>
    <div class="checks"><label><input type="checkbox" id="s-cal" ${st.showCalories?"checked":""}>Show calories for each meal</label></div>
  </section>
  <section class="card form">
    <h3>Shopping list</h3>
    <label>Prices</label><div class="help">AI estimates each item for where you shop, using a little of your API credit the first time an item appears. They're a guide, and the list shows a total.</div>
    <div class="checks"><label><input type="checkbox" id="s-prices" ${st.showPrices?"checked":""}>Show estimated prices</label></div>
    <label for="s-cur">Currency</label><div class="help">A 3-letter code, like KES or USD.</div><input type="text" id="s-cur" maxlength="3" autocapitalize="characters" value="${esc(st.currency)}" style="width:100px;text-transform:uppercase">
    ${Object.keys(S.prices).length?'<label>Saved estimates</label><div class="help">Prices are estimated once per item. Start over if they look out of date, or you shop somewhere new.</div><button type="button" class="btn ghost" data-act="reprice">Estimate again</button>':""}
  </section>
  <section class="card form">
    <h3>Cook times &amp; reminders</h3>
    <label>When do you cook each meal?</label><div class="help">Prep reminders count back from these times.</div>
    <div class="timegrid">${MEAL_TYPES.map(m=>`<label class="field"><span>${m}</span><input type="time" id="s-time-${m}" value="${esc(st.mealTimes[m]||DEFAULTS.mealTimes[m])}"></label>`).join("")}</div>
    <label>What to remind me about</label>
    <div class="checks"><label><input type="checkbox" id="s-rem-prep" ${st.reminders.prep?"checked":""}>Prep ahead, like marinating or soaking</label><label><input type="checkbox" id="s-rem-cook" ${st.reminders.cook?"checked":""}>Time to cook</label></div>
    <label>Quiet hours</label><div class="help">A prep reminder that lands in these hours comes 30 minutes before they start. So an overnight chia soak reminds you the evening before.</div>
    <div class="timegrid"><label class="field"><span>From</span><input type="time" id="s-quiet-start" value="${esc(st.quietStart)}"></label><label class="field"><span>To</span><input type="time" id="s-quiet-end" value="${esc(st.quietEnd)}"></label></div>
    ${enrichHTML()}
    <label>Notifications on this device</label>${pushHTML()}
  </section>
  <section class="card form">
    <h3>Food preferences</h3>
    <label for="s-excl">Never include</label><div class="help">Comma-separated. Recipes containing these are flagged ⚠ and AI avoids them.</div>
    <input type="text" id="s-excl" value="${esc(st.exclusions.join(", "))}">
    <label for="s-diet">Diet &amp; goals</label><textarea id="s-diet">${esc(st.diet)}</textarea>
    <label for="s-notes">Lifestyle notes</label><textarea id="s-notes">${esc(st.notes)}</textarea>
    <label for="s-cuis">Cuisines to mix</label><div class="help">Comma-separated.</div>
    <input type="text" id="s-cuis" value="${esc(st.cuisines.join(", "))}">
    <label for="s-loc">Where you shop</label><input type="text" id="s-loc" value="${esc(st.location)}">
  </section>
  <div class="savebar ${ui.dirty?"dirty":""}" id="savebar"><span class="muted" id="dirtynote" role="status">${ui.dirty?"Unsaved changes":""}</span><button class="btn" data-act="save-settings">Save settings</button></div>
  </form>
  ${installStatus()?`<section class="card form"><h3>Install Tiffin</h3>${installStatus()==="ios"?'<p class="muted">Tap Share in Safari, then Add to Home Screen.</p>':'<p class="muted">Open it from your home screen, like any other app.</p><button type="button" class="btn ghost" data-act="install">Install app</button>'}</section>`:""}
  <h2 id="profile" style="margin-top:28px">Profile</h2>
  <form class="card form" id="profileform" novalidate>
    <label for="p-name">Name</label><input type="text" id="p-name" autocomplete="name" value="${esc(S.profile?.name||"")}">
    <label for="p-email">Email</label><div class="help">This is what you sign in with. Google sign-in only works while this matches your Google email.</div><input type="email" id="p-email" autocomplete="email" value="${esc(S.profile?.email||"")}">
    <label for="p-new">${S.profile?.hasPassword===false?"Add a password":"New password"}</label><div class="help">${S.profile?.hasPassword===false?"Optional. You signed up with Google, and a password lets you sign in with your email too. At least 8 characters.":"Leave blank to keep your current password. At least 8 characters."}</div>
    <input type="password" id="p-new" autocomplete="new-password">
    <label for="p-new2">Confirm password</label><input type="password" id="p-new2" autocomplete="new-password">
    ${S.profile?.hasPassword===false?"":'<label for="p-cur">Current password</label><div class="help">Needed to change your email or password.</div><input type="password" id="p-cur" autocomplete="current-password">'}
    <div class="row" style="margin-top:18px"><button class="btn" data-act="save-profile">Save profile</button><button type="button" class="link" data-act="signout">Sign out</button></div>
  </form>`;
}
function enrichHTML(){
  const n=Object.values(S.recipes).filter(r=>r.calories==null||r.prep==null).length;
  return n?`<label>Saved recipes</label><div class="help">${n} saved recipe${n>1?"s don't":" doesn't"} have calories or prep times yet. New AI recipes get them automatically.</div><button type="button" class="btn ghost" data-act="enrich">✨ Add them with AI</button>`:"";
}
function pushHTML(){
  switch(ui.push){
    case "checking": return '<p class="muted">Checking…</p>';
    case "unconfigured": return '<p class="muted">Notifications aren\'t set up on the server yet. The README explains how.</p>';
    case "ios-install": return '<p class="muted">On iPhone and iPad, install Tiffin first: tap Share in Safari, then Add to Home Screen. Then open it from your home screen and come back here.</p>';
    case "unsupported": return '<p class="muted">This browser can\'t receive notifications.</p>';
    case "denied": return '<p class="muted">Notifications are blocked for Tiffin. Allow them in your browser or phone settings, then reload.</p>';
    case "on": return '<p class="muted">On. You\'ll get reminders here even when Tiffin is closed.</p><div class="row"><button type="button" class="btn ghost" data-act="push-test">Send a test</button><button type="button" class="btn quiet" data-act="push-off">Turn off</button></div>';
    default: return '<button type="button" class="btn" data-act="push-on">Turn on notifications</button>';
  }
}
function readSettings(){
  const split=s=>s.split(",").map(x=>x.trim()).filter(Boolean);
  const meals=[...document.querySelectorAll('input[name="s-meal"]:checked')].map(x=>x.value);
  const days=[...document.querySelectorAll('input[name="s-day"]:checked')].map(x=>+x.value);
  return {exclusions:split(document.getElementById("s-excl").value),diet:document.getElementById("s-diet").value.trim(),notes:document.getElementById("s-notes").value.trim(),
    cuisines:split(document.getElementById("s-cuis").value),location:document.getElementById("s-loc").value.trim(),
    meals:MEAL_TYPES.filter(m=>meals.includes(m)),days:days.sort(),lunchPortions:Math.max(1,Math.min(8,+document.getElementById("s-lp").value||3)),
    showCalories:document.getElementById("s-cal").checked,
    showPrices:document.getElementById("s-prices").checked,
    currency:document.getElementById("s-cur").value.trim().toUpperCase(),
    mealTimes:Object.fromEntries(MEAL_TYPES.map(m=>[m,document.getElementById("s-time-"+m).value||DEFAULTS.mealTimes[m]])),
    reminders:{prep:document.getElementById("s-rem-prep").checked,cook:document.getElementById("s-rem-cook").checked},
    quietStart:document.getElementById("s-quiet-start").value||DEFAULTS.quietStart,
    quietEnd:document.getElementById("s-quiet-end").value||DEFAULTS.quietEnd,
    timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||DEFAULTS.timezone};
}

/* ---------- AI ---------- */
let abortCtl=null;
function busy(on,text){
  const b=document.getElementById("busy"),was=!b.hidden;b.hidden=!on;
  if(text)document.getElementById("busytext").textContent=text;
  if(on&&!was)document.getElementById("busycancel").focus();
}
function cancelBusy(){if(abortCtl)abortCtl.abort();busy(false)}
document.getElementById("busycancel").onclick=cancelBusy;
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!document.getElementById("busy").hidden)cancelBusy()});

async function aiCall(body,signal){
  const r=await fetch("/api/ai",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),signal});
  if(r.status===401){location.href="/signin";return {recipes:[]}}
  const j=await r.json().catch(()=>({}));
  if(!r.ok){const e=new Error(j.error||"AI request failed");e.code=j.code||("http_"+r.status);throw e}
  return j;
}
function cleanRecipe(x,meal){
  if(!x||typeof x!=="object"||!x.title||!Array.isArray(x.ingredients)||!Array.isArray(x.steps))return null;
  return {title:String(x.title).slice(0,120),mealType:meal,cuisine:String(x.cuisine||"").slice(0,60),servings:String(x.servings||"").slice(0,60),
    ingredients:x.ingredients.filter(i=>i&&i.item).slice(0,40).map(i=>({qty:(typeof i.qty==="number"&&isFinite(i.qty))?i.qty:(isFinite(parseFloat(i.qty))?parseFloat(i.qty):null),
      unit:String(i.unit||"").slice(0,20),item:String(i.item).toLowerCase().slice(0,80),note:String(i.note||"").slice(0,80),
      category:CATS.includes(i.category)?i.category:"Other",group:String(i.group||"").slice(0,40)})),
    steps:x.steps.map(s=>String(s).slice(0,400)).filter(Boolean).slice(0,12),tip:String(x.tip||"").slice(0,300),source:"ai",createdAt:Date.now(),calories:x.calories??null,prep:Array.isArray(x.prep)?x.prep:[]};
}
async function genRecipes(meal,n,opts={}){
  const out=[];const avoid=Object.values(S.recipes).map(r=>r.title);
  while(out.length<n){
    const k=Math.min(4,n-out.length);
    const res=await aiCall({meal,n:k,hint:opts.hint||"",paste:!!opts.paste,avoid:[...avoid,...out.map(r=>r.title)]},opts.signal);
    const arr=(res&&Array.isArray(res.recipes))?res.recipes:Array.isArray(res)?res:[];
    let got=0;
    for(const x of arr){const r=cleanRecipe(x,meal);if(r&&!violates(r).length){r.id=newId();out.push(r);got++}}
    if(!got)break;
    if(opts.paste)break;
  }
  return out;
}
function aiError(e){
  if(e&&e.name==="AbortError")return;
  const c=e&&e.code;
  if(c==="rate_limited")toast("Too many AI requests – try again in a minute");
  else toast("AI request failed"+(c?" ("+c+")":""));
  console.error(e);
}
async function saveRecipes(list){for(const r of list)S.recipes[r.id]=r;await api("POST","/api/recipes",{recipes:list})}

async function fillAI(dates){
  const st=settings();
  const todo=[];// {meal, dates[]} per week
  for(const meal of st.meals){
    const byWeek={};
    dates.forEach(d=>{const id=ymd(d);if(!recipeAt(id,meal)){const w=ymd(mondayOf(d));(byWeek[w]=byWeek[w]||[]).push(id)}});
    for(const [w,ds] of Object.entries(byWeek)) todo.push({meal,week:w,dates:ds});
  }
  if(!todo.length){toast("Every planned meal is already filled");return}
  abortCtl=new AbortController();let made=0;
  try{
    for(let i=0;i<todo.length;i++){
      const t=todo[i];
      busy(true,`Creating ${t.meal.toLowerCase()} ideas for week of ${shortDate(parse(t.week))}… (${i+1}/${todo.length})`);
      const n=t.meal==="Snack"?Math.min(3,t.dates.length):t.dates.length;
      const recs=await genRecipes(t.meal,n,{signal:abortCtl.signal,hint:ui.aiHint});
      if(!recs.length)continue;
      await saveRecipes(recs);made+=recs.length;
      const ch={};t.dates.forEach((d,j)=>{ch[d]={[t.meal]:recs[j%recs.length].id}});
      await applyChanges(ch);
    }
    toast(made?`Added ${made} new recipe${made>1?"s":""} to your plan`:"No recipes were created – try again");
  }catch(e){aiError(e)}finally{busy(false);abortCtl=null;render()}
}
async function aiSlot(date,meal){
  abortCtl=new AbortController();busy(true,`Thinking up a new ${meal.toLowerCase()}…`);
  try{const recs=await genRecipes(meal,1,{signal:abortCtl.signal,hint:ui.aiHint});
    if(!recs.length){toast("Couldn't create a recipe – try again");return}
    await saveRecipes(recs);await applyChanges({[date]:{[meal]:recs[0].id}});toast("New recipe added");
  }catch(e){aiError(e)}finally{busy(false);abortCtl=null;render()}
}
async function aiCreate(desc,meal){
  if(!desc.trim()){toast("Describe or paste a recipe first");return}
  abortCtl=new AbortController();busy(true,"Creating your recipe…");
  try{const recs=await genRecipes(meal,1,{signal:abortCtl.signal,hint:desc.trim(),paste:true});
    if(!recs.length){toast("Couldn't create that recipe – check it doesn't use an excluded ingredient");return}
    await saveRecipes(recs);ui.openRecipe=recs[0].id;ui.newDesc="";toast("Recipe saved");
  }catch(e){aiError(e)}finally{busy(false);abortCtl=null;render()}
}
function fillLib(dates){
  const st=settings();const ch={};let filled=0,missing=new Set();
  for(const meal of st.meals){
    const pool=Object.values(S.recipes).filter(r=>r.mealType===meal&&!violates(r).length).sort(()=>Math.random()-.5);
    let i=0;
    dates.forEach(d=>{const id=ymd(d);if(recipeAt(id,meal))return;if(!pool.length){missing.add(meal);return}
      (ch[id]=ch[id]||{})[meal]=pool[i++%pool.length].id;filled++});
  }
  const extra=missing.size?` (no saved ${[...missing].join("/").toLowerCase()} recipes)`:"";
  if(filled)changeWithUndo(ch,`Filled ${filled} meal${filled>1?"s":""} from your recipes`+extra);
  else toast(missing.size?"Add some recipes first, or use Fill with AI":"Every planned meal is already filled");
}
async function enrichRecipes(){
  const total=Object.values(S.recipes).filter(r=>r.calories==null||r.prep==null).length;
  abortCtl=new AbortController();let done=0;
  try{
    while(done<total){
      busy(true,`Checking your recipes… (${done}/${total})`);
      const r=await fetch("/api/ai/enrich",{method:"POST",signal:abortCtl.signal});
      if(r.status===401){location.href="/signin";return}
      const j=await r.json().catch(()=>({}));
      if(!r.ok){const e=new Error(j.error||"AI request failed");e.code=j.code||("http_"+r.status);throw e}
      if(!j.updated?.length)break;
      for(const u of j.updated)if(S.recipes[u.id]){S.recipes[u.id].calories=u.calories;S.recipes[u.id].prep=u.prep}
      done+=j.updated.length;
    }
    toast(done?`Updated ${done} recipe${done>1?"s":""}`:"Couldn't update your recipes – try again");
  }catch(e){aiError(e)}finally{busy(false);abortCtl=null;render()}
}
/* ---------- prices ---------- */
// Fills in prices for the list on screen. An item missing from a reply is only asked about once per visit.
const priceTried=new Set();
async function fillPrices(){
  if(ui.pricing||ui.priceError||ui.tab!=="shopping"||!settings().showPrices||ui.offline||!navigator.onLine)return;
  const [from,to]=shopRange(),want=[];
  for(const it of Object.values(buildList(from,to).items)){
    if(it.cat==="Pantry")continue;
    for(const u of Object.keys(it.amounts)){const k=it.name+"|"+u;if(u!=="_"&&!(k in S.prices)&&!priceTried.has(k))want.push({item:it.name,unit:u})}
  }
  if(!want.length)return;
  ui.pricing=true;softRender();
  try{
    while(want.length){
      const batch=want.splice(0,40);
      const r=await fetch("/api/ai/prices",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({items:batch})});
      if(r.status===401){location.href="/signin";return}
      const j=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(j.error||"HTTP "+r.status);
      batch.forEach(b=>priceTried.add(b.item+"|"+b.unit));
      if(j.currency===settings().currency)Object.assign(S.prices,j.prices);
      softRender();
    }
  }catch(e){console.error(e);ui.priceError=true}
  ui.pricing=false;softRender();
}
/* ---------- notifications ---------- */
function isIos(){return /iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1)}
function isStandalone(){return window.matchMedia("(display-mode: standalone)").matches||navigator.standalone===true}
function pushKeyBytes(){const s=S.pushKey.replace(/-/g,"+").replace(/_/g,"/");const raw=atob(s+"=".repeat((4-s.length%4)%4));return Uint8Array.from(raw,c=>c.charCodeAt(0))}
async function currentSub(){
  if(!("serviceWorker" in navigator))return null;
  const reg=await navigator.serviceWorker.getRegistration();
  return reg?reg.pushManager.getSubscription():null;
}
async function refreshPush(){
  const supported="serviceWorker" in navigator&&"PushManager" in window&&"Notification" in window;
  if(!S.pushKey)ui.push="unconfigured";
  else if(!supported)ui.push=isIos()&&!isStandalone()?"ios-install":"unsupported";
  else if(Notification.permission==="denied")ui.push="denied";
  else{try{ui.push=(await currentSub())?"on":"off"}catch(e){console.error(e);ui.push="off"}}
  if(ui.tab==="settings")softRender();
}
async function pushOn(){
  try{
    if(await Notification.requestPermission()!=="granted"){await refreshPush();render();toast("Notifications weren't allowed");return}
    await navigator.serviceWorker.register("/sw.js");
    const reg=await navigator.serviceWorker.ready;
    const sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:pushKeyBytes()});
    const ok=await api("POST","/api/push",{subscription:sub.toJSON(),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone});
    if(!ok){await sub.unsubscribe();return}
    ui.push="on";render();toast("Notifications are on");
  }catch(e){console.error(e);toast("Couldn't turn on notifications")}
}
async function pushOff(){
  try{
    const sub=await currentSub();
    if(sub){await api("DELETE","/api/push",{endpoint:sub.endpoint});await sub.unsubscribe()}
    ui.push="off";render();toast("Notifications are off");
  }catch(e){console.error(e);toast("Couldn't turn off notifications")}
}
async function signOutHere(){
  // This device shouldn't keep getting reminders, or keep personal data, once signed out
  try{
    const sub=await currentSub();
    if(sub){await api("DELETE","/api/push",{endpoint:sub.endpoint});await sub.unsubscribe()}
    if(window.caches)for(const k of await caches.keys())if(k.startsWith("tiffin-pages"))await caches.delete(k);
  }catch(e){console.error(e)}
  signOut({callbackUrl:"/signin"});
}
/* ---------- install ---------- */
const INSTALL_SNOOZE="tiffin-install-snoozed";
function installStatus(){
  if(isStandalone())return null;
  if(window.__tiffinInstallPrompt)return "prompt";
  return isIos()?"ios":null;
}
function renderInstallBar(){
  const el=document.getElementById("installbar"),status=installStatus();
  const snoozed=Number(localStorage.getItem(INSTALL_SNOOZE)||0)>Date.now();
  if(!status||snoozed){el.innerHTML="";return}
  el.innerHTML=`<div class="installbar"><img src="/icons/logo.svg" alt="" width="36" height="36"><span>${status==="ios"?"Install Tiffin: tap Share in Safari, then Add to Home Screen.":"Install Tiffin for quick access and prep reminders."}</span>${status==="prompt"?'<button type="button" class="btn" data-install="go">Install</button>':""}<button type="button" class="btn quiet" data-install="later">Not now</button></div>`;
}
async function installApp(){
  const p=window.__tiffinInstallPrompt;if(!p)return;
  p.prompt();
  const choice=await p.userChoice.catch(()=>null);
  window.__tiffinInstallPrompt=null;
  renderInstallBar();if(ui.tab==="settings")softRender();
  if(choice&&choice.outcome==="accepted")toast("Tiffin is installed");
}
document.getElementById("installbar").addEventListener("click",e=>{
  const a=e.target.closest("[data-install]");if(!a)return;
  if(a.dataset.install==="go")installApp();
  else{localStorage.setItem(INSTALL_SNOOZE,String(Date.now()+30*864e5));renderInstallBar()}
});
window.addEventListener("tiffin-install-ready",()=>{renderInstallBar();if(ui.tab==="settings")softRender()});
window.addEventListener("appinstalled",()=>{window.__tiffinInstallPrompt=null;renderInstallBar()});
window.addEventListener("online",()=>loadState());
window.addEventListener("offline",()=>loadState());
function scopeDates(){return ui.mode==="week"?weekDates(ui.anchor):monthDates(ui.anchor)}

/* ---------- events ---------- */
main.addEventListener("submit",e=>e.preventDefault()); // buttons act through their data-act click
main.addEventListener("click",e=>{
  const t=e.target.closest("[data-mode],[data-nav],[data-day],[data-meal],[data-act],[data-goday],[data-range],[data-recf],[data-open]");
  if(!t)return;
  const ds=t.dataset;
  if(ds.act!=="del-recipe")ui.delArm=null;
  if(!/^slot-/.test(ds.act||""))ui.slotMove=null;
  if(ds.mode){ui.mode=ds.mode;const base=ui.day?parse(ui.day):ui.anchor;
    ui.anchor=ds.mode==="week"?mondayOf(base):new Date(base.getFullYear(),base.getMonth(),1);render();return}
  if(ds.nav!==undefined){const n=+ds.nav;
    if(n===0){if(ui.mode==="week")goToday();else{ui.anchor=new Date(today.getFullYear(),today.getMonth(),1);ui.day=ymd(today)}}
    else if(ui.mode==="week"){ui.anchor=addDays(ui.anchor,7*n);ui.day=ui.day?ymd(addDays(parse(ui.day),7*n)):null}
    else ui.anchor=new Date(ui.anchor.getFullYear(),ui.anchor.getMonth()+n,1);
    render();return}
  if(ds.day){ui.day=ds.day;render();return}
  if(ds.meal!==undefined&&!ds.act){ui.meal=ui.meal===+ds.meal?-1:+ds.meal;render();return}
  if(ds.goday){ui.mode="week";ui.day=ds.goday;ui.anchor=mondayOf(parse(ds.goday));render();window.scrollTo(0,0);return}
  if(ds.range){ui.shopRange=ds.range;if(ds.range==="custom"&&!ui.shopFrom){const m=mondayOf(today);ui.shopFrom=ymd(m);ui.shopTo=ymd(addDays(m,13))}render();return}
  if(ds.recf){ui.recFilter=ds.recf;render();return}
  if(ds.open){ui.openRecipe=ds.open;ui.addDate=null;render();window.scrollTo(0,0);return}
  switch(ds.act){
    case "retry-load": ui.loadFailed=false;render();loadState();break;
    case "ai-fill": fillAI(scopeDates());break;
    case "lib-fill": fillLib(scopeDates());break;
    case "clear":{
      const ch={};scopeDates().forEach(d=>{const id=ymd(d);const ms=settings().meals.filter(m=>slotsOf(id)[m]);if(ms.length){ch[id]={};ms.forEach(m=>ch[id][m]=null)}});
      changeWithUndo(ch,(ui.mode==="week"?"Week":"Month")+" cleared");break}
    case "ai-slot": aiSlot(ds.date,ds.meal);break;
    case "slot-move":case "slot-switch":{
      const kind=ds.act==="slot-move"?"move":"switch",m=ui.slotMove;
      ui.slotMove=m&&m.kind===kind&&m.date===ds.date&&m.meal===ds.meal?null:{kind,date:ds.date,meal:ds.meal,anchor:mondayOf(parse(ds.date))};
      render();break}
    case "slot-close": ui.slotMove=null;render();break;
    case "slot-week": ui.slotMove.anchor=addDays(ui.slotMove.anchor,7*+ds.step);render();break;
    case "slot-target":{
      const {kind,date,meal}=ui.slotMove,to=ds.target,r=recipeAt(date,meal),other=recipeAt(to,meal),day=dayLabel(parse(to));
      if(!r||(kind==="switch"&&!other))break;
      ui.slotMove=null;
      changeWithUndo({[date]:{[meal]:kind==="move"?null:other.id},[to]:{[meal]:r.id}},kind==="switch"?meal+" switched with "+day:meal+" moved to "+day);break}
    case "rm-slot": changeWithUndo({[ds.date]:{[ds.meal]:null}},ds.meal+" removed");break;
    case "copy-list":{
      const [from,to]=shopRange();const {items}=buildList(from,to);
      const showP=settings().showPrices,est=i=>{const p=showP?itemPrice(i):null;return p==null?"":` (about ${money(p)})`},tot=Object.values(items).reduce((s,i)=>s+(itemPrice(i)||0),0);
      const txt=`SHOPPING LIST ${shortDate(from)} – ${shortDate(to)}\n\n`+CATS.map(c=>{const l=Object.values(items).filter(i=>i.cat===c).sort((a,b)=>a.name.localeCompare(b.name));
        return l.length?c.toUpperCase()+"\n"+l.map(i=>"- "+cap(i.name)+" – "+fmtAmt(i)+est(i)).join("\n"):""}).filter(Boolean).join("\n\n")+(showP&&tot?`\n\nESTIMATED TOTAL: ${money(tot)}`:"");
      navigator.clipboard.writeText(txt).then(()=>{t.textContent="Copied!";setTimeout(()=>t.textContent="Copy list",1600)}).catch(()=>toast("Copy isn't allowed here"));break}
    case "close-recipe": ui.openRecipe=null;render();break;
    case "clear-filters": ui.recFilter="All";ui.recSearch="";render();break;
    case "add-to-plan":{
      const r=S.recipes[ds.id],date=document.getElementById("adddate").value;
      if(!r)break;
      if(!date){toast("Pick a date first");break}
      ui.addDate=date;
      changeWithUndo({[date]:{[r.mealType]:r.id}},`Added to ${shortDate(parse(date))}`);break}
    case "del-recipe":{
      const id=ds.id;
      if(ui.delArm!==id){ui.delArm=id;render();setTimeout(()=>{if(ui.delArm===id){ui.delArm=null;render()}},4000);break}
      ui.delArm=null;delete S.recipes[id];ui.openRecipe=null;
      api("DELETE","/api/recipes/"+encodeURIComponent(id)).then(j=>{if(!j)loadState()});
      for(const [d,sl] of Object.entries(S.days))for(const [m,rid] of Object.entries(sl))if(rid===id){delete sl[m];if(!Object.keys(sl).length)delete S.days[d]}
      render();toast("Recipe deleted");break}
    case "ai-create": aiCreate(document.getElementById("newdesc").value,document.getElementById("newtype").value);break;
    case "signout": signOutHere();break;
    case "enrich": enrichRecipes();break;
    case "price-retry": ui.priceError=false;priceTried.clear();render();break;
    case "reprice": api("DELETE","/api/ai/prices").then(j=>{if(!j)return;S.prices={};priceTried.clear();ui.priceError=false;render();toast("Prices will be estimated again on your shopping list")});break;
    case "install": installApp();break;
    case "push-on": pushOn();break;
    case "push-off": pushOff();break;
    case "push-test":
      api("POST","/api/push/test").then(j=>{if(j)toast(j.sent?"Test sent":"No device received it – try turning notifications off and on")});break;
    case "save-profile":{
      const v=id=>document.getElementById(id)?.value||"";
      const body={name:v("p-name").trim(),email:v("p-email").trim()};
      if(v("p-new")){if(v("p-new")!==v("p-new2")){toast("The new passwords don't match");break}body.newPassword=v("p-new")}
      if(v("p-cur"))body.currentPassword=v("p-cur");
      fetch("/api/profile",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)})
        .then(r=>r.json().then(j=>({ok:r.ok,j}))).then(({ok,j})=>{
          if(!ok){toast(j.error||"Couldn't save your profile");return}
          S.profile={name:j.name,email:j.email,hasPassword:j.hasPassword};ui.profileDirty=false;render();toast("Profile saved");
          const h=document.querySelector(".sub");if(h&&j.name)h.textContent="Hi "+j.name.split(" ")[0]+" – here's what's in your lunchbox.";
        }).catch(()=>toast("Couldn't save your profile"));
      break}
    case "save-settings":{
      const st=readSettings();if(!st.meals.length){toast("Pick at least one meal");break}if(!st.days.length){toast("Pick at least one day");break}if(!/^[A-Z]{3}$/.test(st.currency)){toast("Use a 3-letter currency code, like KES");break}
      const oldCurrency=settings().currency;
      api("PUT","/api/settings",st).then(j=>{if(!j)return;S.settings=j.settings||st;ui.dirty=false;ui.settingsDraft=null;ui.priceError=false;if(S.settings.currency!==oldCurrency){S.prices={};priceTried.clear();loadState()}render();toast("Settings saved")});break}
  }
});
main.addEventListener("change",e=>{
  const t=e.target;
  if(t.dataset.pick!==undefined){const [date,meal]=t.dataset.pick.split("|");if(t.value)applyChanges({[date]:{[meal]:t.value}});return}
  if(t.dataset.check!==undefined){const k=t.dataset.check;if(t.checked)S.checks[k]=true;else delete S.checks[k];
    render();api("PUT","/api/checks",{key:k,on:t.checked}).then(j=>{if(!j)loadState()});return}
  if(t.id==="hidedone"){ui.hideDone=t.checked;render();return}
  if(t.id==="newtype"){ui.newType=t.value;return}
  if(t.id==="adddate"){ui.addDate=t.value;return}
  if(t.id==="sfrom"||t.id==="sto"){ui.shopFrom=document.getElementById("sfrom").value||ui.shopFrom;ui.shopTo=document.getElementById("sto").value||ui.shopTo;render()}
});
main.addEventListener("input",e=>{
  if(e.target.id==="hint")ui.aiHint=e.target.value;
  if(e.target.id==="newdesc")ui.newDesc=e.target.value;
  if(e.target.closest("#settingsform")){ui.dirty=true;document.getElementById("dirtynote").textContent="Unsaved changes";document.getElementById("savebar").classList.add("dirty")}
  if(e.target.closest("#profileform"))ui.profileDirty=true;
  if(e.target.id==="recsearch"){ui.recSearch=e.target.value;clearTimeout(main._s);main._s=setTimeout(()=>{const el0=document.getElementById("recsearch");const pos=el0?el0.selectionStart:0;render();const el=document.getElementById("recsearch");if(el){el.focus();el.setSelectionRange(pos,pos)}},250)}
});
main.addEventListener("toggle",e=>{if(e.target.id==="aiadd")ui.aiOpen=e.target.open},true);

function route(){const h=(location.hash||"#plan").slice(1);ui.tab=["plan","shopping","recipes","settings"].includes(h)?h:"plan";render();window.scrollTo(0,0)}
window.addEventListener("hashchange",route);

/* ---------- boot ---------- */
function goToday(){
  const st=settings();let d=new Date(today);
  for(let i=0;i<7&&!st.days.includes(wdIdx(d));i++)d=addDays(d,1); // weekend/off day -> next planned day
  ui.mode="week";ui.day=ymd(d);ui.anchor=mondayOf(d);
  const h=new Date().getHours(),want=d.getTime()!==today.getTime()?"Breakfast":h<10?"Breakfast":h<14?"Lunch":h<17?"Snack":"Dinner";
  const i=st.meals.indexOf(want);ui.meal=i>=0?i:0;
}
route();
renderInstallBar();
loadState();
// Pick up changes made on another device when you come back to the tab
document.addEventListener("visibilitychange",()=>{
  if(document.visibilityState!=="visible")return;
  today=new Date();today.setHours(0,0,0,0);
  if(!pending&&!abortCtl)loadState();
});

}
