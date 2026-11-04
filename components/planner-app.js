/* eslint-disable */
// The planner UI: plain DOM code mounted into the markup rendered by Planner.tsx.
// Data comes from the Next.js API routes (Supabase behind them).
let mounted=false;
export function mountPlanner(){
if(mounted)return;mounted=true;
/* ---------- constants & defaults ---------- */
const CATS=["Proteins","Grains & bread","Dairy","Vegetables","Fruit","Nuts & seeds","Pantry","Other"];
const MEAL_TYPES=["Breakfast","Lunch","Snack","Supper"];
const WD=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
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

/* ---------- state ---------- */
const S={recipes:{},days:{},settings:null,checks:{}};
let online=false, sample=true;
const today=new Date(); today.setHours(0,0,0,0);
const ui={tab:"plan",mode:"week",anchor:mondayOf(today),day:ymd(today),meal:0,shopRange:"week",shopFrom:null,shopTo:null,recFilter:"All",recSearch:"",openRecipe:null,aiHint:"",delArm:null};

/* ---------- utils ---------- */
function esc(s){return String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}
function ymd(d){return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
function parse(s){const [y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d)}
function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x}
function mondayOf(d){const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());return addDays(x,-((x.getDay()+6)%7))}
function wdIdx(d){return (d.getDay()+6)%7}
function settings(){return Object.assign({},DEFAULTS,S.settings||{})}
function clone(o){return JSON.parse(JSON.stringify(o||{}))}
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
function toast(msg){const t=document.getElementById("toast");t.textContent=msg;t.classList.add("show");clearTimeout(toast._t);toast._t=setTimeout(()=>t.classList.remove("show"),3200)}
function banner(msg){document.getElementById("banner").innerHTML=msg?`<div>${esc(msg)}</div>`:""}

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
  await api("POST","/api/plan",{changes});
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
    S.recipes=j.recipes||{};S.days=j.days||{};S.settings=j.settings||null;S.checks=j.checks||{};
    online=true;banner("");softRender();
  }catch(e){console.error(e);banner("Couldn't load your saved data – check your connection and refresh.")}
}

/* ---------- rendering ---------- */
const main=document.getElementById("main");
let pendingRender=false;
function softRender(){
  const a=document.activeElement;
  if(a&&main.contains(a)&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)){pendingRender=true;return}
  render();
}
document.addEventListener("focusout",()=>setTimeout(()=>{if(pendingRender){pendingRender=false;softRender()}},50));

function renderNav(){
  const tabs=[["plan","Plan"],["shopping","Shopping list"],["recipes","Recipes"],["settings","Settings"]];
  document.getElementById("nav").innerHTML=tabs.map(([id,l])=>`<a href="#${id}" class="${ui.tab===id?"on":""}">${l}</a>`).join("");
}
function render(){
  renderNav();
  if(ui.tab==="plan") main.innerHTML=renderPlan();
  else if(ui.tab==="shopping") main.innerHTML=renderShopping();
  else if(ui.tab==="recipes") main.innerHTML=renderRecipes();
  else main.innerHTML=renderSettings();
}

function recipeHTML(r,{showType=true}={}){
  const v=violates(r);
  let ing="",grp="";
  (r.ingredients||[]).forEach(i=>{const g=i.group||"";if(g!==grp){grp=g;if(g)ing+=`<li class="subhead">${esc(g)}</li>`}ing+=`<li>${esc(fmtIng(i))}</li>`});
  return `${showType?`<span class="tag">${esc(r.mealType||"")}</span>`:""}
    <h3>${esc(r.title)}</h3>
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
  const aiOk=!!sample;
  let h=`<div class="toolbar">
    <div class="seg"><button data-mode="week" class="${isWeek?"on":""}">Week</button><button data-mode="month" class="${!isWeek?"on":""}">Month</button></div>
    <div class="navdate"><button class="icon" data-nav="-1" aria-label="Previous">‹</button><span class="lbl">${label}</span><button class="icon" data-nav="1" aria-label="Next">›</button><button class="link" data-nav="0">Today</button></div>
  </div>
  <div class="actions">
    <button class="btn" data-act="ai-fill" ${aiOk?"":"disabled"}>✨ Fill empty ${isWeek?"days this week":"days this month"} with AI</button>
    <button class="btn ghost" data-act="lib-fill">Fill from my recipes</button>
    <button class="btn ghost" data-act="clear">${ui.delArm==="clear"?"Tap again to clear":"Clear "+(isWeek?"week":"month")}</button>
  </div>`;
    return h+(isWeek?renderWeek(st):renderMonth(st));
}

function renderWeek(st){
  const dates=weekDates(ui.anchor);
  if(!dates.length) return `<div class="card empty"><b>No days selected</b>Choose which days to plan in Settings.</div>`;
  const ids=dates.map(ymd);
  if(!ids.includes(ui.day)) ui.day=ids.includes(ymd(today))?ymd(today):ids[0];
  if(ui.meal>=st.meals.length) ui.meal=0;
  let h=`<div class="daytabs">${dates.map(d=>{const id=ymd(d);const sl=slotsOf(id);const full=st.meals.every(m=>sl[m]&&S.recipes[sl[m]]);
    return `<button data-day="${id}" class="${id===ui.day?"on":""}">${WD[wdIdx(d)]}${full?"":'<span class="dot" title="Has empty meals"></span>'}<small>${shortDate(d)}</small></button>`}).join("")}</div>`;
  h+=`<div class="mealtabs">${st.meals.map((m,i)=>`<button data-meal="${i}" class="${i===ui.meal?"on":""}">${esc(m)}</button>`).join("")}</div>`;
  const meal=st.meals[ui.meal], date=ui.day, r=recipeAt(date,meal);
  const opts=Object.values(S.recipes).filter(x=>x.mealType===meal).sort((a,b)=>a.title.localeCompare(b.title))
    .map(x=>`<option value="${esc(x.id)}" ${r&&r.id===x.id?"selected":""}>${violates(x).length?"⚠ ":""}${esc(x.title)}</option>`).join("");
  h+=`<section class="card">`;
  h+= r? recipeHTML(r) : `<div class="empty"><b>No ${esc(meal.toLowerCase())} planned</b>Pick one of your recipes or ask AI for a new idea.</div>`;
  h+=`<div class="slotact">
    <select data-pick="${date}|${esc(meal)}"><option value="">${opts?"Choose from my recipes…":"No saved "+esc(meal.toLowerCase())+" recipes yet"}</option>${opts}</select>
    <input type="text" id="hint" placeholder="Request for AI (optional), e.g. something with beef" value="${esc(ui.aiHint)}">
    <button class="btn" data-act="ai-slot" data-date="${date}" data-meal="${esc(meal)}" ${sample?"":"disabled"}>✨ New AI idea</button>
    ${r?`<button class="btn ghost" data-act="rm-slot" data-date="${date}" data-meal="${esc(meal)}">Remove</button>`:""}
  </div></section>`;
  return h;
}

function renderMonth(st){
  const first=new Date(ui.anchor.getFullYear(),ui.anchor.getMonth(),1);
  let d=mondayOf(first);
  const last=new Date(first.getFullYear(),first.getMonth()+1,0);
  let h=`<div class="month">${WD.map(w=>`<div class="hd">${w}</div>`).join("")}`;
  while(d<=last||wdIdx(d)!==0){
    const id=ymd(d),sl=slotsOf(id),inM=d.getMonth()===first.getMonth(),on=st.days.includes(wdIdx(d));
    const lines=MEAL_TYPES.filter(m=>sl[m]&&S.recipes[sl[m]]).map(m=>`<div class="m"><b>${m[0]}</b> ${esc(S.recipes[sl[m]].title)}</div>`).join("");
    const n=MEAL_TYPES.filter(m=>sl[m]&&S.recipes[sl[m]]).length;
    h+=`<div class="cell ${inM?"":"out"} ${on?"":"off"} ${id===ymd(today)?"today":""}" data-goday="${id}"><div class="num">${d.getDate()}</div>${lines}${n?`<span class="cnt">${n} meal${n>1?"s":""}</span>`:""}</div>`;
    d=addDays(d,1);
    if(d>last&&wdIdx(d)===0)break;
  }
  return h+`</div><p class="muted" style="margin-top:10px">B = Breakfast · L = Lunch · S = Snack. Tap a day to see its recipes.</p>`;
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
  <div class="ranges">${ranges.map(([k,l])=>`<button data-range="${k}" class="${ui.shopRange===k?"on":""}">${l}</button>`).join("")}</div>`;
  if(ui.shopRange==="custom") h+=`<div class="custom"><span>From</span><input type="date" id="sfrom" value="${ymd(from)}"><span>to</span><input type="date" id="sto" value="${ymd(to)}"></div>`;
  h+=`<p class="muted">${label}: ${shortDate(from)} – ${shortDate(to)} · ${meals} planned meal${meals===1?"":"s"}. Amounts are added up across every recipe in this range.</p>`;
  if(!meals) return h+`<div class="card empty"><b>Nothing planned in this range</b>Fill the days on the Plan tab and your list appears here.</div>`;
  h+=`<div class="shop">`;
  for(const cat of CATS){
    const list=Object.values(items).filter(i=>i.cat===cat).sort((a,b)=>a.name.localeCompare(b.name));
    if(!list.length)continue;
    h+=`<section class="card"><h4>${cat}</h4>${list.map(it=>{const k=rk+"|"+it.name,on=!!S.checks[k];
      return `<div class="shopitem ${on?"done":""}" data-check="${esc(k)}"><input type="checkbox" ${on?"checked":""} tabindex="-1"><span class="nm">${esc(cap(it.name))}</span><span class="amt">${esc(fmtAmt(it))}</span></div>`}).join("")}</section>`;
  }
  return h+`</div>`;
}

/* ---------- recipes ---------- */
function renderRecipes(){
  const all=Object.values(S.recipes);
  if(ui.openRecipe&&S.recipes[ui.openRecipe]){
    const r=S.recipes[ui.openRecipe];
    return `<button class="link" data-act="close-recipe">‹ All recipes</button>
      <section class="card" style="margin-top:8px">${recipeHTML(r)}
      <div class="slotact"><button class="btn warn" data-act="del-recipe" data-id="${esc(r.id)}">${ui.delArm===r.id?"Tap again to delete":"Delete recipe"}</button></div></section>`;
  }
  const q=ui.recSearch.trim().toLowerCase();
  const list=all.filter(r=>(ui.recFilter==="All"||r.mealType===ui.recFilter)&&(!q||(r.title+" "+(r.cuisine||"")).toLowerCase().includes(q)))
    .sort((a,b)=>a.title.localeCompare(b.title));
  let h=`<div class="toolbar"><h2>Recipes</h2><span class="muted">${all.length} saved</span></div>
  <section class="card"><h4>✨ Add a recipe with AI</h4>
    <p class="muted" style="margin-top:0">Describe a dish you'd like, or paste a recipe from anywhere and it'll be tidied into your format.</p>
    <textarea id="newdesc" placeholder="e.g. A Thai green curry with chicken and lots of veg, packable for lunch"></textarea>
    <div class="row" style="margin-top:8px"><select id="newtype" style="width:auto">${MEAL_TYPES.map(m=>`<option ${m==="Lunch"?"selected":""}>${m}</option>`).join("")}</select>
    <button class="btn" data-act="ai-create" ${sample?"":"disabled"}>Create recipe</button></div>
  </section>
  <div class="row" style="margin-bottom:12px"><input type="text" id="recsearch" placeholder="Search recipes" value="${esc(ui.recSearch)}" style="flex:1 1 200px;width:auto">
    <div class="seg">${["All",...MEAL_TYPES].map(m=>`<button data-recf="${m}" class="${ui.recFilter===m?"on":""}">${m}</button>`).join("")}</div></div>`;
  if(!list.length) return h+`<div class="card empty"><b>No recipes here yet</b>Create one above, or use "Fill with AI" on the Plan tab.</div>`;
  return h+`<div class="reclist">${list.map(r=>`<div class="recitem" data-open="${esc(r.id)}"><span class="tag">${esc(r.mealType)}</span><div class="t">${violates(r).length?"⚠ ":""}${esc(r.title)}</div><div class="s">${esc([r.cuisine,r.servings].filter(Boolean).join(" · "))}</div></div>`).join("")}</div>`;
}

/* ---------- settings ---------- */
function renderSettings(){
  const st=settings();
  return `<h2>Settings</h2><p class="muted">These guide AI recipe ideas and which days and meals you plan.</p>
  <section class="card form">
    <label for="s-excl">Never include (exceptions)</label><div class="help">Comma-separated. Recipes containing these are flagged ⚠ and AI avoids them.</div>
    <input type="text" id="s-excl" value="${esc(st.exclusions.join(", "))}">
    <label for="s-diet">Diet &amp; goals</label><textarea id="s-diet">${esc(st.diet)}</textarea>
    <label for="s-notes">Lifestyle notes</label><textarea id="s-notes">${esc(st.notes)}</textarea>
    <label for="s-cuis">Cuisines to mix</label><div class="help">Comma-separated.</div>
    <input type="text" id="s-cuis" value="${esc(st.cuisines.join(", "))}">
    <label for="s-loc">Where you shop</label><input type="text" id="s-loc" value="${esc(st.location)}">
    <label>Meals to plan</label><div class="checks">${MEAL_TYPES.map(m=>`<label><input type="checkbox" name="s-meal" value="${m}" ${st.meals.includes(m)?"checked":""}>${m}</label>`).join("")}</div>
    <label>Days to plan</label><div class="checks">${WD.map((w,i)=>`<label><input type="checkbox" name="s-day" value="${i}" ${st.days.includes(i)?"checked":""}>${w}</label>`).join("")}</div>
    <label for="s-lp">Lunch portions per recipe</label><input type="number" id="s-lp" min="1" max="8" value="${esc(st.lunchPortions)}" style="width:100px">
    <div style="margin-top:18px"><button class="btn" data-act="save-settings">Save settings</button></div>
  </section>`;
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
function busy(on,text){const b=document.getElementById("busy");b.hidden=!on;if(text)document.getElementById("busytext").textContent=text}
document.getElementById("busycancel").onclick=()=>{if(abortCtl)abortCtl.abort();busy(false)};

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
    await saveRecipes(recs);ui.openRecipe=recs[0].id;toast("Recipe saved");
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
  if(filled)applyChanges(ch);
  toast(filled?`Filled ${filled} meal${filled>1?"s":""} from your recipes`+(missing.size?` (no saved ${[...missing].join("/").toLowerCase()} recipes)`:""):missing.size?"Add some recipes first, or use Fill with AI":"Every planned meal is already filled");
}
function scopeDates(){return ui.mode==="week"?weekDates(ui.anchor):monthDates(ui.anchor)}

/* ---------- events ---------- */
main.addEventListener("click",e=>{
  const t=e.target.closest("[data-mode],[data-nav],[data-day],[data-meal],[data-act],[data-goday],[data-range],[data-check],[data-recf],[data-open]");
  if(!t)return;
  const ds=t.dataset;
  if(ds.act!=="clear"&&ds.act!=="del-recipe")ui.delArm=null;
  if(ds.mode){ui.mode=ds.mode;const base=ui.day?parse(ui.day):ui.anchor;
    ui.anchor=ds.mode==="week"?mondayOf(base):new Date(base.getFullYear(),base.getMonth(),1);render();return}
  if(ds.nav!==undefined){const n=+ds.nav;
    if(n===0){if(ui.mode==="week")goToday();else{ui.anchor=new Date(today.getFullYear(),today.getMonth(),1);ui.day=ymd(today)}}
    else if(ui.mode==="week"){ui.anchor=addDays(ui.anchor,7*n);ui.day=ui.day?ymd(addDays(parse(ui.day),7*n)):null}
    else ui.anchor=new Date(ui.anchor.getFullYear(),ui.anchor.getMonth()+n,1);
    render();return}
  if(ds.day){ui.day=ds.day;render();return}
  if(ds.meal!==undefined&&!ds.act){ui.meal=+ds.meal;render();return}
  if(ds.goday){ui.mode="week";ui.day=ds.goday;ui.anchor=mondayOf(parse(ds.goday));render();return}
  if(ds.range){ui.shopRange=ds.range;if(ds.range==="custom"&&!ui.shopFrom){const m=mondayOf(today);ui.shopFrom=ymd(m);ui.shopTo=ymd(addDays(m,13))}render();return}
  if(ds.check){const k=ds.check;if(S.checks[k])delete S.checks[k];else S.checks[k]=true;
    t.classList.toggle("done",!!S.checks[k]);t.querySelector("input").checked=!!S.checks[k];api("PUT","/api/checks",{key:k,on:!!S.checks[k]});return}
  if(ds.recf){ui.recFilter=ds.recf;render();return}
  if(ds.open){ui.openRecipe=ds.open;render();window.scrollTo(0,0);return}
  switch(ds.act){
    case "ai-fill": fillAI(scopeDates());break;
    case "lib-fill": fillLib(scopeDates());break;
    case "clear":{
      if(ui.delArm!=="clear"){ui.delArm="clear";render();setTimeout(()=>{if(ui.delArm==="clear"){ui.delArm=null;render()}},4000);break}
      ui.delArm=null;const ch={};scopeDates().forEach(d=>{const id=ymd(d);const sl=slotsOf(id);if(Object.keys(sl).length){ch[id]={};Object.keys(sl).forEach(m=>ch[id][m]=null)}});
      applyChanges(ch);toast("Cleared");break}
    case "ai-slot": aiSlot(ds.date,ds.meal);break;
    case "rm-slot": applyChanges({[ds.date]:{[ds.meal]:null}});break;
    case "copy-list":{
      const [from,to]=shopRange();const {items}=buildList(from,to);
      const txt=`SHOPPING LIST ${shortDate(from)} – ${shortDate(to)}\n\n`+CATS.map(c=>{const l=Object.values(items).filter(i=>i.cat===c).sort((a,b)=>a.name.localeCompare(b.name));
        return l.length?c.toUpperCase()+"\n"+l.map(i=>"- "+cap(i.name)+" – "+fmtAmt(i)).join("\n"):""}).filter(Boolean).join("\n\n");
      navigator.clipboard.writeText(txt).then(()=>{t.textContent="Copied!";setTimeout(()=>t.textContent="Copy list",1600)}).catch(()=>toast("Copy isn't allowed here"));break}
    case "close-recipe": ui.openRecipe=null;render();break;
    case "del-recipe":{
      const id=ds.id;if(ui.delArm!==id){ui.delArm=id;render();break}
      ui.delArm=null;delete S.recipes[id];ui.openRecipe=null;api("DELETE","/api/recipes/"+encodeURIComponent(id));
      for(const [d,sl] of Object.entries(S.days))for(const [m,rid] of Object.entries(sl))if(rid===id){delete sl[m];if(!Object.keys(sl).length)delete S.days[d]}
      render();toast("Recipe deleted");break}
    case "ai-create": aiCreate(document.getElementById("newdesc").value,document.getElementById("newtype").value);break;
    case "save-settings":{
      const st=readSettings();if(!st.meals.length){toast("Pick at least one meal");break}if(!st.days.length){toast("Pick at least one day");break}
      S.settings=st;api("PUT","/api/settings",st).then(ok=>{if(ok)toast("Settings saved")});render();break}
  }
});
main.addEventListener("change",e=>{
  const t=e.target;
  if(t.dataset.pick!==undefined){const [date,meal]=t.dataset.pick.split("|");if(t.value)applyChanges({[date]:{[meal]:t.value}});return}
  if(t.id==="sfrom"||t.id==="sto"){ui.shopFrom=document.getElementById("sfrom").value||ui.shopFrom;ui.shopTo=document.getElementById("sto").value||ui.shopTo;render()}
});
main.addEventListener("input",e=>{
  if(e.target.id==="hint")ui.aiHint=e.target.value;
  if(e.target.id==="recsearch"){ui.recSearch=e.target.value;clearTimeout(main._s);main._s=setTimeout(()=>{const pos=e.target.selectionStart;render();const el=document.getElementById("recsearch");if(el){el.focus();el.setSelectionRange(pos,pos)}},250)}
});

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
goToday();
route();
loadState();
// Pick up changes made on another device when you come back to the tab
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&!pending&&!abortCtl)loadState()});

}
