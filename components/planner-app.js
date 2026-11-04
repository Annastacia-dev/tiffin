/* eslint-disable */
// The planner UI: plain DOM code mounted into the markup rendered by Planner.tsx.
// Data comes from the Next.js API routes (Supabase behind them).
import { signOut } from "next-auth/react";

let mounted=false;
export function mountPlanner(){
if(mounted)return;mounted=true;
/* ---------- constants & defaults ---------- */
const CATS=["Proteins","Grains & bread","Dairy","Vegetables","Fruit","Nuts & seeds","Pantry","Other"];
const MEAL_TYPES=["Breakfast","Lunch","Snack","Supper"];
const MEAL_SHORT={Breakfast:"B",Lunch:"L",Snack:"Sn",Supper:"Su"};
const WD=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const WD_L=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const MONTHS=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTHS_L=["January","February","March","April","May","June","July","August","September","October","November","December"];
const DEFAULTS={
  exclusions:["beans","ndengu","lentils","chickpeas"],
  diet:"Eats meat, chicken and fish. Focus on gut health and high fiber: whole grains, vegetables, fruit, nuts and seeds, fermented dairy like maziwa mala.",
  cuisines:["Japanese","Mexican","Lebanese","Indian","Swahili","Chinese","Middle Eastern","Mediterranean","Thai","Italian","Ethiopian","Kenyan"],
  location:"Nairobi, Kenya – only ingredients easy to find at Carrefour, Naivas, Quickmart or local markets",
  notes:"Cooking for 1 person. Breakfast and lunch are packed for work, so they must travel well. Lunch recipes make 2–3 portions so leftovers cover supper.",
  meals:["Breakfast","Lunch","Snack"],
  days:[0,1,2,3,4],
  lunchPortions:3
};
const svg=p=>`<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const TABS=[
  ["plan","Plan",svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>')],
  ["shopping","Shopping",svg('<path d="M6 8h12l1 13H5L6 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>')],
  ["recipes","Recipes",svg('<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4z"/><path d="M5 17a3 3 0 0 1 3-3h11"/>')],
  ["settings","Settings",svg('<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>')]
];

/* ---------- state ---------- */
const S={recipes:{},days:{},settings:null,checks:{},profile:null};
let today=new Date(); today.setHours(0,0,0,0);
const ui={tab:"plan",mode:"week",anchor:mondayOf(today),day:ymd(today),meal:0,shopRange:"week",shopFrom:null,shopTo:null,hideDone:false,recFilter:"All",recSearch:"",openRecipe:null,aiHint:"",delArm:null,
  loaded:false,loadFailed:false,dirty:false,profileDirty:false,settingsDraft:null,aiOpen:null,newDesc:"",newType:"Lunch",addDate:null};

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
async function applyChanges(changes){ // changes: {date:{meal:id|null}}
  for(const [date,meals] of Object.entries(changes)){
    const day=Object.assign({},S.days[date]||{});
    for(const [m,id] of Object.entries(meals)){ if(id) day[m]=id; else delete day[m]; }
    if(Object.keys(day).length) S.days[date]=day; else delete S.days[date];
  }
  render();
  const ok=await api("POST","/api/plan",{changes});
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
    S.recipes=j.recipes||{};S.days=j.days||{};S.settings=j.settings||null;S.checks=j.checks||{};S.profile=j.profile||S.profile;
    const first=!ui.loaded;
    ui.loaded=true;ui.loadFailed=false;banner("");
    if(first){goToday();render()}else softRender();
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

function recipeHTML(r,{showType=true,showTitle=true}={}){
  const v=violates(r);
  let ing="",grp="";
  (r.ingredients||[]).forEach(i=>{const g=i.group||"";if(g!==grp){grp=g;if(g)ing+=`<li class="subhead">${esc(g)}</li>`}ing+=`<li>${esc(fmtIng(i))}</li>`});
  return `${showType?`<span class="tag">${esc(r.mealType||"")}</span>`:""}
    ${showTitle?`<h3>${esc(r.title)}</h3>`:""}
    <div class="meta">${[r.cuisine,r.servings].filter(Boolean).map(esc).join(" · ")}</div>
    ${v.length?`<div class="warnbox">⚠ Contains something on your exclusion list: ${esc(v.join(", "))}</div>`:""}
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
  const empty=total-filled,anySlots=dates.some(d=>Object.keys(slotsOf(ymd(d))).length);
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
  h+=`<h2 class="dayh">${WD_L[wdIdx(dd)]} ${shortDate(dd)}${date===todayId?' <span class="tag">Today</span>':""}</h2>`;
  h+=st.meals.map((meal,i)=>{
    const r=recipeAt(date,meal),open=i===ui.meal,bad=r&&violates(r).length;
    return `<section class="mealcard ${open?"open":""}">
      <button class="mealhead" data-meal="${i}" aria-expanded="${open}">
        <span class="mealname">${esc(meal)}</span>
        <span class="mealtitle ${r?"":"none"}">${bad?"⚠ ":""}${r?esc(r.title):"Nothing planned"}</span>
        <span class="chev" aria-hidden="true">›</span>
      </button>
      ${open?`<div class="mealbody">${r?recipeHTML(r,{showType:false,showTitle:false}):`<div class="empty"><b>No ${esc(meal.toLowerCase())} planned</b>Pick one of your recipes or ask AI for a new idea.</div>`}${slotActions(date,meal,r)}</div>`:""}
    </section>`;
  }).join("");
  return h;
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
    ${r?`<button class="btn quiet" data-act="rm-slot" data-date="${date}" data-meal="${esc(meal)}">Remove from this day</button>`:""}
  </div>`;
}

function renderMonth(st){
  const first=new Date(ui.anchor.getFullYear(),ui.anchor.getMonth(),1);
  let d=mondayOf(first);
  const last=new Date(first.getFullYear(),first.getMonth()+1,0);
  let h=`<div class="month">${WD.map(w=>`<div class="hd">${w}</div>`).join("")}`;
  while(d<=last||wdIdx(d)!==0){
    const id=ymd(d),sl=slotsOf(id),inM=d.getMonth()===first.getMonth(),on=st.days.includes(wdIdx(d));
    const planned=MEAL_TYPES.filter(m=>sl[m]&&S.recipes[sl[m]]);
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
  const items={};let meals=0;
  for(let d=new Date(from);d<=to;d=addDays(d,1)){
    const sl=slotsOf(ymd(d));
    for(const id of Object.values(sl)){const r=S.recipes[id];if(!r)continue;meals++;
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
function fmtAmt(it){
  if(it.cat==="Pantry")return"check stock";
  const parts=Object.entries(it.amounts).filter(([u])=>u!=="_").map(([u,q])=>{
    if(u==="g"&&q>=1000)return nice(Math.round(q/100)/10)+" kg";
    if(u==="ml"&&q>=1000)return nice(Math.round(q/100)/10)+" L";
    if(u==="g"||u==="ml")return Math.round(q)+" "+u;
    if(["pc","head","bunch","tin"].includes(u))q=Math.ceil(q-1e-9);
    return nice(q)+(u&&u!=="pc"?" "+u:"");
  });
  return parts.length?parts.join(" + "):"as needed";
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
  if(ui.hideDone&&done===all.length) return h+`<div class="card empty"><b>All done</b>Everything on this list is ticked.</div>`;
  h+=`<div class="shop">`;
  for(const cat of CATS){
    const list=all.filter(i=>i.cat===cat&&!(ui.hideDone&&S.checks[rk+"|"+i.name])).sort((a,b)=>a.name.localeCompare(b.name));
    if(!list.length)continue;
    h+=`<section class="card"><h4>${cat}</h4>${list.map(it=>{const k=rk+"|"+it.name,on=!!S.checks[k];
      return `<label class="shopitem ${on?"done":""}"><input type="checkbox" data-check="${esc(k)}" ${on?"checked":""}><span class="nm">${esc(cap(it.name))}</span><span class="amt">${esc(fmtAmt(it))}</span></label>`}).join("")}</section>`;
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
  const q=ui.recSearch.trim().toLowerCase();
  const list=all.filter(r=>(ui.recFilter==="All"||r.mealType===ui.recFilter)&&(!q||(r.title+" "+(r.cuisine||"")).toLowerCase().includes(q)))
    .sort((a,b)=>a.title.localeCompare(b.title));
  const aiOpen=ui.aiOpen===null?!all.length:ui.aiOpen;
  let h=`<div class="toolbar"><h2>Recipes</h2><span class="muted">${all.length} saved</span></div>
  <details class="card aiadd" id="aiadd" ${aiOpen?"open":""}><summary>✨ Add a recipe with AI</summary>
    <p class="muted">Describe a dish you'd like, or paste a recipe from anywhere and it'll be tidied into your format.</p>
    <textarea id="newdesc" aria-label="Describe or paste a recipe" placeholder="e.g. A Thai green curry with chicken and lots of veg, packable for lunch">${esc(ui.newDesc)}</textarea>
    <div class="row" style="margin-top:8px"><select id="newtype" aria-label="Meal type" style="width:auto">${MEAL_TYPES.map(m=>`<option ${m===ui.newType?"selected":""}>${m}</option>`).join("")}</select>
    <button class="btn" data-act="ai-create">Create recipe</button></div>
  </details>
  <div class="row recfilters"><input type="search" id="recsearch" aria-label="Search recipes" placeholder="Search recipes" value="${esc(ui.recSearch)}">
    <div class="seg">${["All",...MEAL_TYPES].map(m=>`<button data-recf="${m}" class="${ui.recFilter===m?"on":""}" aria-pressed="${ui.recFilter===m}">${m}</button>`).join("")}</div></div>`;
  if(!list.length) return h+(all.length
    ?`<div class="card empty"><b>No recipes match</b>Try another search or meal type.<div class="emptyact"><button class="btn ghost" data-act="clear-filters">Clear filters</button></div></div>`
    :`<div class="card empty"><b>No recipes here yet</b>Create one above, or use "Fill with AI" on the Plan tab.</div>`);
  return h+`<div class="reclist">${list.map(r=>`<button class="recitem" data-open="${esc(r.id)}"><span class="tag">${esc(r.mealType)}</span><span class="t">${violates(r).length?"⚠ ":""}${esc(r.title)}</span><span class="s">${esc([r.cuisine,r.servings].filter(Boolean).join(" · "))}</span></button>`).join("")}</div>`;
}

/* ---------- settings ---------- */
function renderSettings(){
  const st=ui.settingsDraft||settings();
  return `<h2>Settings</h2><p class="muted">These guide AI recipe ideas and which days and meals you plan.</p>
  <form id="settingsform" novalidate>
  <section class="card form">
    <h3>What to plan</h3>
    <label>Meals to plan</label><div class="checks">${MEAL_TYPES.map(m=>`<label><input type="checkbox" name="s-meal" value="${m}" ${st.meals.includes(m)?"checked":""}>${m}</label>`).join("")}</div>
    <label>Days to plan</label><div class="checks">${WD.map((w,i)=>`<label><input type="checkbox" name="s-day" value="${i}" ${st.days.includes(i)?"checked":""}>${w}</label>`).join("")}</div>
    <label for="s-lp">Lunch portions per recipe</label><input type="number" id="s-lp" min="1" max="8" value="${esc(st.lunchPortions)}" style="width:100px">
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
  <h2 id="profile" style="margin-top:28px">Profile</h2>
  <form class="card form" id="profileform" novalidate>
    <label for="p-name">Name</label><input type="text" id="p-name" autocomplete="name" value="${esc(S.profile?.name||"")}">
    <label for="p-email">Email</label><div class="help">This is what you sign in with.</div><input type="email" id="p-email" autocomplete="email" value="${esc(S.profile?.email||"")}">
    <label for="p-new">New password</label><div class="help">Leave blank to keep your current password. At least 8 characters.</div>
    <input type="password" id="p-new" autocomplete="new-password">
    <label for="p-new2">Confirm new password</label><input type="password" id="p-new2" autocomplete="new-password">
    <label for="p-cur">Current password</label><div class="help">Needed to change your email or password.</div>
    <input type="password" id="p-cur" autocomplete="current-password">
    <div class="row" style="margin-top:18px"><button class="btn" data-act="save-profile">Save profile</button><button type="button" class="link" data-act="signout">Sign out</button></div>
  </form>`;
}
function readSettings(){
  const split=s=>s.split(",").map(x=>x.trim()).filter(Boolean);
  const meals=[...document.querySelectorAll('input[name="s-meal"]:checked')].map(x=>x.value);
  const days=[...document.querySelectorAll('input[name="s-day"]:checked')].map(x=>+x.value);
  return {exclusions:split(document.getElementById("s-excl").value),diet:document.getElementById("s-diet").value.trim(),notes:document.getElementById("s-notes").value.trim(),
    cuisines:split(document.getElementById("s-cuis").value),location:document.getElementById("s-loc").value.trim(),
    meals:MEAL_TYPES.filter(m=>meals.includes(m)),days:days.sort(),lunchPortions:Math.max(1,Math.min(8,+document.getElementById("s-lp").value||3))};
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
    steps:x.steps.map(s=>String(s).slice(0,400)).filter(Boolean).slice(0,12),tip:String(x.tip||"").slice(0,300),source:"ai",createdAt:Date.now()};
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
function scopeDates(){return ui.mode==="week"?weekDates(ui.anchor):monthDates(ui.anchor)}

/* ---------- events ---------- */
main.addEventListener("submit",e=>e.preventDefault()); // buttons act through their data-act click
main.addEventListener("click",e=>{
  const t=e.target.closest("[data-mode],[data-nav],[data-day],[data-meal],[data-act],[data-goday],[data-range],[data-recf],[data-open]");
  if(!t)return;
  const ds=t.dataset;
  if(ds.act!=="del-recipe")ui.delArm=null;
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
      const ch={};scopeDates().forEach(d=>{const id=ymd(d);const sl=slotsOf(id);if(Object.keys(sl).length){ch[id]={};Object.keys(sl).forEach(m=>ch[id][m]=null)}});
      changeWithUndo(ch,(ui.mode==="week"?"Week":"Month")+" cleared");break}
    case "ai-slot": aiSlot(ds.date,ds.meal);break;
    case "rm-slot": changeWithUndo({[ds.date]:{[ds.meal]:null}},ds.meal+" removed");break;
    case "copy-list":{
      const [from,to]=shopRange();const {items}=buildList(from,to);
      const txt=`SHOPPING LIST ${shortDate(from)} – ${shortDate(to)}\n\n`+CATS.map(c=>{const l=Object.values(items).filter(i=>i.cat===c).sort((a,b)=>a.name.localeCompare(b.name));
        return l.length?c.toUpperCase()+"\n"+l.map(i=>"- "+cap(i.name)+" – "+fmtAmt(i)).join("\n"):""}).filter(Boolean).join("\n\n");
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
    case "signout": signOut({callbackUrl:"/signin"});break;
    case "save-profile":{
      const v=id=>document.getElementById(id).value;
      const body={name:v("p-name").trim(),email:v("p-email").trim()};
      if(v("p-new")){if(v("p-new")!==v("p-new2")){toast("The new passwords don't match");break}body.newPassword=v("p-new")}
      if(v("p-cur"))body.currentPassword=v("p-cur");
      fetch("/api/profile",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)})
        .then(r=>r.json().then(j=>({ok:r.ok,j}))).then(({ok,j})=>{
          if(!ok){toast(j.error||"Couldn't save your profile");return}
          S.profile={name:j.name,email:j.email};ui.profileDirty=false;render();toast("Profile saved");
          const h=document.querySelector(".sub");if(h&&j.name)h.textContent="Hi "+j.name.split(" ")[0]+" – here's what's in your lunchbox.";
        }).catch(()=>toast("Couldn't save your profile"));
      break}
    case "save-settings":{
      const st=readSettings();if(!st.meals.length){toast("Pick at least one meal");break}if(!st.days.length){toast("Pick at least one day");break}
      api("PUT","/api/settings",st).then(j=>{if(!j)return;S.settings=j.settings||st;ui.dirty=false;ui.settingsDraft=null;render();toast("Settings saved")});break}
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
  const h=new Date().getHours(),want=d.getTime()!==today.getTime()?"Breakfast":h<10?"Breakfast":h<14?"Lunch":"Snack";
  const i=st.meals.indexOf(want);ui.meal=i>=0?i:0;
}
route();
loadState();
// Pick up changes made on another device when you come back to the tab
document.addEventListener("visibilitychange",()=>{
  if(document.visibilityState!=="visible")return;
  today=new Date();today.setHours(0,0,0,0);
  if(!pending&&!abortCtl)loadState();
});

}
