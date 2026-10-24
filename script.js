if (document.body.classList.contains("admin-page")) {
/* ============================================================
   CONNECTION — same Supabase project as the customer site.
   The publishable key is safe in the browser; row-level security
   only lets emails on the febys.admins list change anything.
   ============================================================ */
const { SUPABASE_URL, SUPABASE_KEY } = window.FEBYS_SITE;
const BUCKET = "febys-menu";

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { db: { schema: "febys" } });

const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money = n => "AED " + Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 });
let toastT;
function toast(t, err){ const el=$("#toast"); el.textContent=t; el.classList.toggle("err",!!err); el.classList.add("show"); clearTimeout(toastT); toastT=setTimeout(()=>el.classList.remove("show"), err?4200:2200); }
function fail(e, what){
  console.error(e);
  const message=e?.message || "Something went wrong";
  const detail=/failed to fetch|networkerror/i.test(message)
    ? "Network request failed. Check your connection and admin sign-in, then reload and retry."
    : message;
  toast((what?what+": ":"") + detail, true);
}
const ICON = {
  up:'<svg viewBox="0 0 24 24"><path d="M6 15l6-6 6 6"/></svg>',
  down:'<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>',
  edit:'<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4z"/></svg>',
  del:'<svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/></svg>',
  x:'<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>'
};

/* ---------- state ---------- */
const S = { user:null, cats:[], items:[], settings:null, admins:[], cat:null, tab:"orders", orders:[], ofilter:"all", oq:"" };

/* ============================================================
   AUTH
   ============================================================ */
let loginMode = "signin"; // signin | signup | reset
function setLoginMode(m){
  loginMode = m;
  $("#pwWrap").classList.toggle("hidden", m==="reset");
  $("#pwWrap input").required = m!=="reset";
  $("#pwWrap input").autocomplete = m==="signup" ? "new-password" : "current-password";
  $("#loginBtn").textContent = {signin:"Sign in", signup:"Create account", reset:"Send reset link"}[m];
  $("#loginSub").textContent = {signin:"Sign in to manage the Febys menu.", signup:"Use the email an admin added, then choose a password.", reset:"We'll email you a link to set a new password."}[m];
  $("#modeBack").classList.toggle("hidden", m==="signin");
  $("#modeReset").classList.toggle("hidden", m!=="signin");
  $("#loginMsg").innerHTML = "";
}
$("#modeBack").onclick = () => setLoginMode("signin");
$("#modeReset").onclick = () => setLoginMode("reset");

$("#loginForm").onsubmit = async e => {
  e.preventDefault();
  const fd = new FormData(e.target), email = fd.get("email").trim().toLowerCase(), password = fd.get("password");
  const btn = $("#loginBtn"); btn.disabled = true; $("#loginMsg").innerHTML = "";
  const show = (t, ok) => $("#loginMsg").innerHTML = `<div class="msg ${ok?"ok":"err"}">${esc(t)}</div>`;
  try{
    if(loginMode==="signin"){
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if(error) throw error;
    } else if(loginMode==="signup"){
      const { data, error } = await sb.auth.signUp({ email, password, options:{ data:{ app:"febys" }, emailRedirectTo: location.href.split("#")[0] } });
      if(error) throw error;
      if(!data.session) show("Check your email to confirm your account, then come back and sign in.", true);
    } else {
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.href.split("#")[0] });
      if(error) throw error;
      show("If that email has an account, a reset link is on its way.", true);
    }
  }catch(err){ show(err.message === "Invalid login credentials" ? "Wrong email or password." : err.message); }
  btn.disabled = false;
};

let routedFor; // avoid reloading on token refreshes / tab refocus
sb.auth.onAuthStateChange((event, session) => {
  // defer: calling Supabase inside this callback can stall the client
  setTimeout(() => {
    if(event === "PASSWORD_RECOVERY") return askNewPassword();
    const uid = session?.user?.id || null;
    if(!["INITIAL_SESSION","SIGNED_IN","SIGNED_OUT"].includes(event) || (uid && uid === routedFor)) return;
    routedFor = uid;
    route(session);
  }, 0);
});
async function route(session){
  S.user = session?.user || null;
  ["#loginView","#deniedView","#appView"].forEach(v=>$(v).classList.add("hidden"));
  if(!S.user){ $("#loginView").classList.remove("hidden"); return; }
  const { data, error } = await sb.rpc("is_admin");
  if(error){ $("#loginView").classList.remove("hidden"); $("#loginMsg").innerHTML = `<div class="msg err">${esc(error.message)}</div>`; return; }
  if(!data){ $("#deniedEmail").textContent = S.user.email; $("#deniedView").classList.remove("hidden"); return; }
  $("#who").textContent = S.user.email;
  $("#appView").classList.remove("hidden");
  await loadAll();
}
$("#signOut").onclick = $("#deniedOut").onclick = () => sb.auth.signOut();

function askNewPassword(){
  modal(`<div class="mh"><h3>Set a new password</h3></div>
    <div class="mb"><label class="f">New password<input type="password" id="np" minlength="6" autocomplete="new-password"></label></div>
    <div class="mf"><button class="btn" id="npSave">Save password</button></div>`);
  $("#npSave").onclick = async () => {
    const { error } = await sb.auth.updateUser({ password: $("#np").value });
    if(error) return fail(error);
    closeModal(); toast("Password updated");
  };
}

/* ============================================================
   DATA
   ============================================================ */
async function loadAll(){
  $("#tab-menu").innerHTML = `<div class="loading">Loading menu…</div>`;
  const [c, i, s] = await Promise.all([
    sb.from("categories").select("*").order("sort").order("id"),
    sb.from("menu_items").select("*").order("sort").order("id"),
    sb.from("settings").select("*").eq("id",1).single()
  ]);
  if(c.error || i.error || s.error){ fail(c.error||i.error||s.error, "Couldn't load"); $("#tab-menu").innerHTML = `<div class="empty">Couldn't load the menu. ${esc((c.error||i.error||s.error).message)}</div>`; return; }
  S.cats = c.data; S.items = i.data; S.settings = s.data;
  if(!S.cat || !S.cats.find(x=>x.id===S.cat)) S.cat = S.cats[0]?.id ?? null;
  await loadOrders(true);
  renderTab();
  startOrderPolling();
}
const itemsOf = cid => S.items.filter(i=>i.category_id===cid).sort((a,b)=>a.sort-b.sort||a.id-b.id);
function priceText(it){
  if(it.variants?.length){
    const p = it.variants.map(v=>Number(v.price)).filter(n=>!isNaN(n));
    return p.length ? `${it.variants.length} sizes · from ${money(Math.min(...p))}` : `${it.variants.length} sizes`;
  }
  return it.price==null ? "Price on request" : money(it.price);
}

/* ============================================================
   TABS
   ============================================================ */
document.querySelectorAll("nav.tabs button").forEach(b => b.onclick = () => {
  S.tab = b.dataset.tab === "orders" && S.tab === "orders" ? null : b.dataset.tab;
  document.querySelectorAll("nav.tabs button").forEach(x=>x.classList.toggle("on", x.dataset.tab===S.tab));
  renderTab();
});
function renderTab(){
  ["orders","menu","reviews","gallery","settings","admins"].forEach(t => $("#tab-"+t).classList.toggle("hidden", t!==S.tab));
  if(S.tab==="gallery") renderGalleryTab();
  if(S.tab==="reviews") renderReviewsTab();
  if(S.tab==="orders") renderOrders();
  if(S.tab==="menu") renderMenu();
  if(S.tab==="settings") renderSettings();
  if(S.tab==="admins") renderAdmins();
}

/* ============================================================
   MENU TAB
   ============================================================ */
function renderMenu(){
  const cat = S.cats.find(c=>c.id===S.cat);
  const items = cat ? itemsOf(cat.id) : [];
  const shown = S.items.filter(i=>i.active).length;
  $("#tab-menu").innerHTML = `
    <div class="head">
      <div><h2>Menu</h2><p>${S.items.length} items · ${shown} showing on the site. Changes go live as soon as you save.</p></div>
      ${cat ? `<button class="btn" id="addItem">+ Add item</button>` : ""}
    </div>
    <div class="layout">
      <aside class="panel cats">
        <h3>Categories</h3>
        ${S.cats.map(c=>`<div class="cat ${c.id===S.cat?"on":""} ${c.active?"":"off"}" data-cat="${c.id}"><span class="name">${esc(c.name)}</span><span class="n">${itemsOf(c.id).length}</span></div>`).join("")}
        <div class="foot"><button class="btn ghost sm" id="addCat">+ New category</button></div>
      </aside>
      <section>
        ${cat ? `
        <div class="panel cat-info">
          <div class="t"><h3>${esc(cat.name)} ${cat.active?"":`<span class="pill hid">Hidden</span>`}</h3><p>${esc(cat.note||"No subtitle")}</p></div>
          <div class="acts">
            <button class="icon" title="Move up" data-catmove="-1" ${S.cats[0]?.id===cat.id?"disabled":""}>${ICON.up}</button>
            <button class="icon" title="Move down" data-catmove="1" ${S.cats.at(-1)?.id===cat.id?"disabled":""}>${ICON.down}</button>
            <button class="btn ghost sm" id="editCat">Edit category</button>
          </div>
        </div>
        <div class="items">
          ${items.length ? items.map((it,ix)=>`
            <div class="row ${it.active?"":"off"}" data-id="${it.id}">
              <div class="thumb ${it.tone}">${it.photo_url?`<img src="${esc(it.photo_url)}" alt="">`:esc(it.name.split(" ")[0])}</div>
              <div>
                <div class="nm">${esc(it.name)} ${it.badge?`<span class="pill">${esc(it.badge)}</span>`:""} ${it.active?"":`<span class="pill hid">Hidden</span>`}</div>
                <div class="meta">${esc(priceText(it))}${it.pax?` · ${esc(it.pax)}`:""}${it.includes?.length?` · ${it.includes.length} inclusions`:""}</div>
              </div>
              <div class="acts">
                <label class="switch" title="${it.active?"Showing on site":"Hidden from site"}"><input type="checkbox" data-toggle="${it.id}" ${it.active?"checked":""}><span></span></label>
                <button class="icon" title="Move up" data-move="${it.id}" data-dir="-1" ${ix===0?"disabled":""}>${ICON.up}</button>
                <button class="icon" title="Move down" data-move="${it.id}" data-dir="1" ${ix===items.length-1?"disabled":""}>${ICON.down}</button>
                <button class="icon" title="Edit" data-edit="${it.id}">${ICON.edit}</button>
                <button class="icon" title="Delete" data-del="${it.id}">${ICON.del}</button>
              </div>
            </div>`).join("") : `<div class="empty">No items in this category yet.<br><br><button class="btn" id="addItem2">+ Add the first item</button></div>`}
        </div>` : `<div class="empty">No categories yet. Create one to start adding items.</div>`}
      </section>
    </div>`;
  const tm = $("#tab-menu");
  tm.querySelectorAll("[data-cat]").forEach(el=>el.onclick=()=>{ S.cat=+el.dataset.cat; renderMenu(); });
  $("#addCat").onclick = () => editCategory(null);
  if(cat){
    $("#editCat").onclick = () => editCategory(cat);
    ($("#addItem")||{}).onclick = () => editItem(null);
    if($("#addItem2")) $("#addItem2").onclick = () => editItem(null);
    tm.querySelectorAll("[data-catmove]").forEach(b=>b.onclick=()=>moveCategory(cat, +b.dataset.catmove));
    tm.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>editItem(S.items.find(i=>i.id===+b.dataset.edit)));
    tm.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>deleteItem(S.items.find(i=>i.id===+b.dataset.del)));
    tm.querySelectorAll("[data-move]").forEach(b=>b.onclick=()=>moveItem(+b.dataset.move, +b.dataset.dir));
    tm.querySelectorAll("[data-toggle]").forEach(b=>b.onchange=()=>toggleItem(+b.dataset.toggle, b.checked));
  }
}

async function toggleItem(id, on){
  const { error } = await sb.from("menu_items").update({ active:on }).eq("id", id);
  if(error){ fail(error,"Couldn't update"); return renderMenu(); }
  S.items.find(i=>i.id===id).active = on;
  renderMenu(); toast(on ? "Now showing on the site" : "Hidden from the site");
}

async function persistOrder(table, rows){
  // write sort = position for every row in the group
  const results = await Promise.all(rows.map((r,ix)=> r.sort===ix ? null : sb.from(table).update({ sort:ix }).eq("id", r.id)));
  const err = results.find(r=>r?.error)?.error;
  if(err) throw err;
  rows.forEach((r,ix)=>r.sort=ix);
}
async function moveItem(id, dir){
  const it = S.items.find(i=>i.id===id), list = itemsOf(it.category_id);
  const ix = list.indexOf(it), j = ix+dir; if(j<0||j>=list.length) return;
  [list[ix], list[j]] = [list[j], list[ix]];
  try{ await persistOrder("menu_items", list); renderMenu(); }catch(e){ fail(e,"Couldn't reorder"); loadAll(); }
}
async function moveCategory(cat, dir){
  const list = [...S.cats], ix = list.indexOf(cat), j = ix+dir; if(j<0||j>=list.length) return;
  [list[ix], list[j]] = [list[j], list[ix]];
  try{ await persistOrder("categories", list); S.cats = list; renderMenu(); }catch(e){ fail(e,"Couldn't reorder"); loadAll(); }
}
async function deleteItem(it){
  confirmBox(`Delete “${it.name}”?`, "This removes it from the menu for good. To take it off the site for now, use the switch to hide it instead.", "Delete item", async () => {
    const { error } = await sb.from("menu_items").delete().eq("id", it.id);
    if(error) return fail(error,"Couldn't delete");
    if(it.photo_url) removePhotoFile(it.photo_url);
    S.items = S.items.filter(i=>i.id!==it.id); renderMenu(); toast("Item deleted");
  });
}

/* ---------- category editor ---------- */
function editCategory(cat){
  const isNew = !cat; cat = cat || { name:"", note:"", active:true };
  const count = cat.id ? itemsOf(cat.id).length : 0;
  modal(`
    <div class="mh"><h3>${isNew?"New category":"Edit category"}</h3><button class="x" data-close>×</button></div>
    <div class="mb">
      <label class="f">Name<input type="text" id="cName" value="${esc(cat.name)}" placeholder="e.g. Desserts"></label>
      <label class="f">Subtitle <small>Short line shown next to the category name</small><input type="text" id="cNote" value="${esc(cat.note)}" placeholder="e.g. Sweet endings"></label>
      <label class="check"><span class="switch"><input type="checkbox" id="cActive" ${cat.active?"checked":""}><span></span></span> Show this category on the site</label>
    </div>
    <div class="mf">
      ${!isNew ? `<button class="btn danger sm" id="cDel" ${count?`disabled title="Move or delete its ${count} items first"`:""}>Delete category</button>` : ""}
      <div class="grow"></div>
      <button class="btn ghost" data-close>Cancel</button>
      <button class="btn" id="cSave">${isNew?"Create":"Save"}</button>
    </div>`);
  $("#cName").focus();
  $("#cSave").onclick = async () => {
    const name = $("#cName").value.trim(); if(!name) return toast("Give the category a name", true);
    const row = { name, note: $("#cNote").value.trim() || null, active: $("#cActive").checked };
    let res;
    if(isNew){
      row.slug = name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"") + "-" + Date.now().toString(36).slice(-4);
      row.sort = S.cats.length ? Math.max(...S.cats.map(c=>c.sort))+1 : 0;
      res = await sb.from("categories").insert(row).select().single();
    } else res = await sb.from("categories").update(row).eq("id", cat.id).select().single();
    if(res.error) return fail(res.error, "Couldn't save");
    if(isNew){ S.cats.push(res.data); S.cat = res.data.id; } else Object.assign(cat, res.data);
    closeModal(); renderMenu(); toast(isNew ? "Category created" : "Category saved");
  };
  if($("#cDel")) $("#cDel").onclick = async () => {
    const { error } = await sb.from("categories").delete().eq("id", cat.id);
    if(error) return fail(error, "Couldn't delete");
    S.cats = S.cats.filter(c=>c.id!==cat.id); S.cat = S.cats[0]?.id ?? null;
    closeModal(); renderMenu(); toast("Category deleted");
  };
}

/* ---------- item editor ---------- */
function editItem(it){
  const isNew = !it;
  const d = it ? structuredClone(it) : { category_id:S.cat, name:"", pax:"", description:"", includes:[], price:null, variants:[], badge:"", tone:(S.items.find(i=>i.category_id===S.cat)?.tone)||"g1", photo_url:null, active:true };
  let mode = d.variants?.length ? "sizes" : d.price==null && !isNew ? "ask" : "fixed";
  let photoFile = null, removePhoto = false;

  modal(`
    <div class="mh"><h3>${isNew?"Add item":"Edit item"}</h3><button class="x" data-close>×</button></div>
    <div class="mb">
      <div class="two">
        <label class="f">Name<input type="text" id="iName" value="${esc(d.name)}" placeholder="e.g. Combo 7"></label>
        <label class="f">Category<select id="iCat">${S.cats.map(c=>`<option value="${c.id}" ${c.id===d.category_id?"selected":""}>${esc(c.name)}</option>`).join("")}</select></label>
      </div>
      <div class="f" style="display:grid;gap:6px;font-size:13px;font-weight:500;color:var(--ink-2)">Price
        <div class="seg" id="iMode">
          <button type="button" data-m="fixed">Fixed price</button>
          <button type="button" data-m="sizes">Sizes / options</button>
          <button type="button" data-m="ask">Price on request</button>
        </div>
      </div>
      <div id="pFixed"><label class="f">Price (AED)<input type="number" id="iPrice" min="0" step="0.5" value="${d.price??""}" placeholder="e.g. 450"></label></div>
      <div id="pSizes" style="display:grid;gap:8px">
        <div class="vrow vhead"><span>Option</span><span>Price (AED)</span><span class="rng">Show as range <small>(optional)</small></span><span></span></div>
        <div id="vList" style="display:grid;gap:8px"></div>
        <div><button type="button" class="btn ghost sm" id="vAdd">+ Add option</button></div>
      </div>
      <div id="pAsk" class="msg ok">Customers can add it to an inquiry, and you confirm the price on WhatsApp.</div>

      <div class="two">
        <label class="f">Serves <small>Optional, e.g. 10–12 pax</small><input type="text" id="iPax" value="${esc(d.pax)}"></label>
        <label class="f">Badge <small>Optional, e.g. Popular</small><input type="text" id="iBadge" value="${esc(d.badge)}"></label>
      </div>
      <label class="f">Description <small>Optional short line</small><textarea id="iDesc" rows="2">${esc(d.description)}</textarea></label>
      <label class="f">What's included <small>One per line, shown as a list</small><textarea id="iInc" rows="5" placeholder="1 kilo Lechon Roll&#10;Feby's Fried Chicken">${esc((d.includes||[]).join("\n"))}</textarea></label>

      <div class="f" style="display:grid;gap:8px;font-size:13px;font-weight:500;color:var(--ink-2)">Photo
        <div class="photo">
          <div class="pv ${d.tone}" id="pv"></div>
          <div style="display:grid;gap:8px">
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <label class="btn ghost sm" style="cursor:pointer">Upload photo<input type="file" id="iFile" accept="image/jpeg,image/png,image/webp" hidden></label>
              <button type="button" class="btn ghost sm" id="iNoPhoto">Remove photo</button>
            </div>
            <div style="font-weight:400;color:var(--muted)">No photo? The card uses this colour instead:</div>
            <div class="tones" id="iTone">${["g1","g2","g3","g4"].map(t=>`<button type="button" class="${t} ${t===d.tone?"on":""}" data-t="${t}" title="${t}"></button>`).join("")}</div>
          </div>
        </div>
      </div>
      <label class="check"><span class="switch"><input type="checkbox" id="iActive" ${d.active?"checked":""}><span></span></span> Show on the site</label>
    </div>
    <div class="mf">
      <div class="grow"></div>
      <button class="btn ghost" data-close>Cancel</button>
      <button class="btn" id="iSave">${isNew?"Add item":"Save changes"}</button>
    </div>`);

  const paintMode = () => {
    $("#iMode").querySelectorAll("button").forEach(b=>b.classList.toggle("on", b.dataset.m===mode));
    $("#pFixed").classList.toggle("hidden", mode!=="fixed");
    $("#pSizes").classList.toggle("hidden", mode!=="sizes");
    $("#pAsk").classList.toggle("hidden", mode!=="ask");
    if(mode==="sizes" && !d.variants.length){ d.variants.push({label:"",price:""}); paintVariants(); }
  };
  const paintVariants = () => {
    $("#vList").innerHTML = d.variants.map((v,i)=>`
      <div class="vrow" data-v="${i}">
        <input type="text" data-k="label" value="${esc(v.label)}" placeholder="e.g. 8 kilos">
        <input type="number" data-k="price" min="0" step="0.5" value="${v.price??""}" placeholder="900">
        <input type="text" class="rng" data-k="range" value="${esc(v.range||"")}" placeholder="e.g. 150–200">
        <button type="button" class="icon" data-vdel="${i}" title="Remove">${ICON.x}</button>
      </div>`).join("");
    $("#vList").querySelectorAll("input").forEach(inp=>inp.oninput=()=>{ d.variants[+inp.closest(".vrow").dataset.v][inp.dataset.k] = inp.value; });
    $("#vList").querySelectorAll("[data-vdel]").forEach(b=>b.onclick=()=>{ d.variants.splice(+b.dataset.vdel,1); paintVariants(); });
  };
  const paintPhoto = () => {
    const src = photoFile ? URL.createObjectURL(photoFile) : (!removePhoto && d.photo_url);
    $("#pv").className = "pv " + d.tone;
    $("#pv").innerHTML = src ? `<img src="${esc(src)}" alt="">` : esc((($("#iName")?.value)||"Febys").split(" ")[0]);
    $("#iNoPhoto").classList.toggle("hidden", !src);
  };
  $("#iMode").querySelectorAll("button").forEach(b=>b.onclick=()=>{ mode=b.dataset.m; paintMode(); });
  $("#vAdd").onclick = () => { d.variants.push({label:"",price:""}); paintVariants(); };
  $("#iTone").querySelectorAll("button").forEach(b=>b.onclick=()=>{ d.tone=b.dataset.t; $("#iTone").querySelectorAll("button").forEach(x=>x.classList.toggle("on",x===b)); paintPhoto(); });
  $("#iFile").onchange = e => { const f=e.target.files[0]; if(!f) return; if(f.size>15*1024*1024) return toast("That photo is too large (max 15 MB)", true); photoFile=f; removePhoto=false; paintPhoto(); };
  $("#iNoPhoto").onclick = () => { photoFile=null; removePhoto=true; $("#iFile").value=""; paintPhoto(); };
  $("#iName").oninput = paintPhoto;
  paintVariants(); paintMode(); paintPhoto(); $("#iName").focus();

  $("#iSave").onclick = async () => {
    const btn = $("#iSave");
    const name = $("#iName").value.trim(); if(!name) return toast("Give the item a name", true);
    const row = {
      category_id: +$("#iCat").value, name,
      pax: $("#iPax").value.trim() || null,
      badge: $("#iBadge").value.trim() || null,
      description: $("#iDesc").value.trim() || null,
      includes: $("#iInc").value.split("\n").map(s=>s.trim()).filter(Boolean),
      tone: d.tone, active: $("#iActive").checked,
      price: null, variants: []
    };
    if(mode==="fixed"){
      const p = parseFloat($("#iPrice").value);
      if(isNaN(p) || p<0) return toast("Enter a price, or choose “Price on request”", true);
      row.price = p;
    } else if(mode==="sizes"){
      const vs = d.variants.map(v=>({ label:String(v.label||"").trim(), price:parseFloat(v.price), range:String(v.range||"").trim() }))
                           .filter(v=>v.label || !isNaN(v.price));
      if(!vs.length) return toast("Add at least one option with a price", true);
      if(vs.some(v=>!v.label || isNaN(v.price) || v.price<0)) return toast("Each option needs a name and a price", true);
      row.variants = vs.map(v=> v.range ? v : { label:v.label, price:v.price });
    }
    btn.disabled = true; btn.textContent = "Saving…";
    try{
      const oldPhoto = d.photo_url;
      if(photoFile){ row.photo_url = await uploadPhoto(photoFile); }
      else if(removePhoto){ row.photo_url = null; }
      let res;
      if(isNew){
        const sibs = itemsOf(row.category_id);
        row.sort = sibs.length ? Math.max(...sibs.map(s=>s.sort))+1 : 0;
        res = await sb.from("menu_items").insert(row).select().single();
      } else {
        if(row.category_id !== it.category_id){ const sibs = itemsOf(row.category_id); row.sort = sibs.length ? Math.max(...sibs.map(s=>s.sort))+1 : 0; }
        res = await sb.from("menu_items").update(row).eq("id", it.id).select().single();
      }
      if(res.error) throw res.error;
      if(oldPhoto && (photoFile || removePhoto) && oldPhoto !== res.data.photo_url) removePhotoFile(oldPhoto);
      if(isNew) S.items.push(res.data); else Object.assign(S.items.find(i=>i.id===it.id), res.data);
      S.cat = res.data.category_id;
      closeModal(); renderMenu(); toast(isNew ? "Item added" : "Changes saved");
    }catch(e){ fail(e, "Couldn't save"); btn.disabled=false; btn.textContent = isNew?"Add item":"Save changes"; }
  };
}

/* ---------- photos ---------- */
async function shrink(file, max=1400){
  const bm = await createImageBitmap(file);
  const s = Math.min(1, max/Math.max(bm.width, bm.height));
  const c = document.createElement("canvas"); c.width = Math.round(bm.width*s); c.height = Math.round(bm.height*s);
  c.getContext("2d").drawImage(bm, 0, 0, c.width, c.height);
  return await new Promise(r=>c.toBlob(r, "image/jpeg", .84));
}
async function compressGalleryPhoto(file){
  const bm = await createImageBitmap(file);
  try{
    if(bm.width*bm.height>80000000) throw new Error("Image dimensions are too large to process safely");
    const webpTest = await new Promise(resolve=>document.createElement("canvas").toBlob(resolve,"image/webp",.8));
    const format = webpTest?.type==="image/webp" ? "image/webp" : "image/jpeg";
    let best = null;
    for(const maxDimension of [1600,1400,1200,1000]){
      const scale = Math.min(1,maxDimension/Math.max(bm.width,bm.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1,Math.round(bm.width*scale));
      canvas.height = Math.max(1,Math.round(bm.height*scale));
      const context = canvas.getContext("2d");
      if(!context) throw new Error("Couldn't prepare this image for upload");
      context.drawImage(bm,0,0,canvas.width,canvas.height);
      for(const quality of [.82,.72,.62]){
        const blob = await new Promise(resolve=>canvas.toBlob(resolve,format,quality));
        if(!blob) throw new Error("Couldn't compress this image");
        best = blob;
        if(blob.size<=450*1024) return blob;
      }
    }
    if(!best || best.size>5*1024*1024) throw new Error("Couldn't compress this image below the 5 MB storage limit");
    return best;
  }finally{ bm.close(); }
}
async function uploadPhoto(file){
  const blob = await shrink(file);
  const path = `items/${Date.now()}-${Math.random().toString(36).slice(2,8)}.jpg`;
  const { error } = await sb.storage.from(BUCKET).upload(path, blob, { contentType:"image/jpeg", cacheControl:"31536000" });
  if(error) throw error;
  return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
function removePhotoFile(url){
  const marker = `/object/public/${BUCKET}/`;
  const ix = url.indexOf(marker); if(ix<0) return;
  sb.storage.from(BUCKET).remove([decodeURIComponent(url.slice(ix+marker.length))]).catch(()=>{});
}

/* ============================================================
   REVIEWS TAB
   ============================================================ */
S.reviews = [];
const imgSrc = u => !u ? "" : /^https?:\/\//.test(u) ? u : encodeURI(u);
async function renderReviewsTab(){
  $("#tab-reviews").innerHTML = `<div class="loading">Loading reviews…</div>`;
  const { data, error } = await sb.from("reviews").select("*").order("sort").order("id");
  if(error){ $("#tab-reviews").innerHTML = `<div class="empty">Couldn't load reviews. ${esc(error.message)}</div>`; return; }
  S.reviews = data; drawReviews();
}
function drawReviews(){
  const list = S.reviews, shown = list.filter(r=>r.active).length, samples = list.filter(r=>r.is_sample).length;
  $("#tab-reviews").innerHTML = `
    <div class="head">
      <div><h2>Reviews</h2><p>${list.length} reviews · ${shown} showing in the website carousel${samples?` · ${samples} marked as samples`:""}. Only add real reviews with the customer's OK.</p></div>
      <button class="btn" id="rvAdd">+ Add review</button>
    </div>
    <div class="items">
      ${list.length ? list.map((r,ix)=>`
        <div class="row rv-row ${r.active?"":"off"}">
          <div class="thumb">${r.photo_url?`<img src="${esc(imgSrc(r.photo_url))}" alt="">`:""}</div>
          <div>
            <div class="nm">${esc(r.reviewer)}${r.dish?` <span class="pill">${esc(r.dish)}</span>`:""}${r.is_sample?` <span class="pill sample">Sample</span>`:""}${r.active?"":` <span class="pill hid">Hidden</span>`}</div>
            <div class="stars">${"★".repeat(r.rating)}${"☆".repeat(5-r.rating)}</div>
            <div class="txt">${esc(r.body)}</div>
          </div>
          <div class="acts">
            <label class="switch" title="${r.active?"Showing on site":"Hidden from site"}"><input type="checkbox" data-rvtoggle="${r.id}" ${r.active?"checked":""}><span></span></label>
            <button class="icon" title="Move up" data-rvmove="${r.id}" data-dir="-1" ${ix===0?"disabled":""}>${ICON.up}</button>
            <button class="icon" title="Move down" data-rvmove="${r.id}" data-dir="1" ${ix===list.length-1?"disabled":""}>${ICON.down}</button>
            <button class="icon" title="Edit" data-rvedit="${r.id}">${ICON.edit}</button>
            <button class="icon" title="Delete" data-rvdel="${r.id}">${ICON.del}</button>
          </div>
        </div>`).join("") : `<div class="empty">No reviews yet. The carousel stays hidden on the website until you add one.</div>`}
    </div>`;
  const t = $("#tab-reviews");
  $("#rvAdd").onclick = () => editReview(null);
  t.querySelectorAll("[data-rvedit]").forEach(b=>b.onclick=()=>editReview(S.reviews.find(r=>r.id===+b.dataset.rvedit)));
  t.querySelectorAll("[data-rvtoggle]").forEach(c=>c.onchange=async()=>{
    const id=+c.dataset.rvtoggle; const { error } = await sb.from("reviews").update({ active:c.checked }).eq("id", id);
    if(error){ fail(error,"Couldn't update"); return drawReviews(); }
    S.reviews.find(r=>r.id===id).active=c.checked; drawReviews(); toast(c.checked?"Showing on the site":"Hidden from the site");
  });
  t.querySelectorAll("[data-rvmove]").forEach(b=>b.onclick=async()=>{
    const list=[...S.reviews], i=list.findIndex(r=>r.id===+b.dataset.rvmove), j=i+(+b.dataset.dir);
    if(j<0||j>=list.length) return; [list[i],list[j]]=[list[j],list[i]];
    try{ await persistOrder("reviews", list); S.reviews=list; drawReviews(); }catch(e){ fail(e,"Couldn't reorder"); renderReviewsTab(); }
  });
  t.querySelectorAll("[data-rvdel]").forEach(b=>b.onclick=()=>{
    const r=S.reviews.find(x=>x.id===+b.dataset.rvdel);
    confirmBox("Delete this review?", "It will be removed from the website for good. To take it off for now, use the switch to hide it.", "Delete review", async()=>{
      const { error } = await sb.from("reviews").delete().eq("id", r.id);
      if(error) return fail(error,"Couldn't delete");
      if(r.photo_url) removePhotoFile(r.photo_url);
      S.reviews=S.reviews.filter(x=>x.id!==r.id); drawReviews(); toast("Review deleted");
    });
  });
}
function editReview(r){
  const isNew=!r; const d = r ? {...r} : { reviewer:"", dish:"", body:"", rating:5, photo_url:null, is_sample:false, active:true };
  let photoFile=null, removePhoto=false;
  const dishes=[...new Set(S.items.map(i=>i.name))];
  modal(`
    <div class="mh"><h3>${isNew?"Add review":"Edit review"}</h3><button class="x" data-close>×</button></div>
    <div class="mb">
      <div class="two">
        <label class="f">Customer name <small>As they agreed to be shown, e.g. “Maria S.”</small><input type="text" id="rName" maxlength="80" value="${esc(d.reviewer)}"></label>
        <label class="f">Dish ordered<input type="text" id="rDish" maxlength="120" list="rDishes" value="${esc(d.dish||"")}"><datalist id="rDishes">${dishes.map(n=>`<option value="${esc(n)}">`).join("")}</datalist></label>
      </div>
      <label class="f">Review<textarea id="rBody" rows="4" maxlength="600">${esc(d.body)}</textarea></label>
      <label class="f">Rating<select id="rRating">${[5,4,3,2,1].map(n=>`<option value="${n}" ${n===d.rating?"selected":""}>${"★".repeat(n)} ${n}</option>`).join("")}</select></label>
      <div class="f" style="display:grid;gap:8px;font-size:13px;font-weight:500;color:var(--ink-2)">Photo of the dish
        <div class="photo">
          <div class="pv g1" id="rPv"></div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <label class="btn ghost sm" style="cursor:pointer">Upload photo<input type="file" id="rFile" accept="image/jpeg,image/png,image/webp" hidden></label>
            <button type="button" class="btn ghost sm" id="rNoPhoto">Remove photo</button>
          </div>
        </div>
      </div>
      <label class="check"><input type="checkbox" id="rSample" ${d.is_sample?"checked":""}> Mark as <b>sample review</b> (shows a “Sample review” tag on the website)</label>
      <label class="check"><span class="switch"><input type="checkbox" id="rActive" ${d.active?"checked":""}><span></span></span> Show in the website carousel</label>
    </div>
    <div class="mf"><div class="grow"></div><button class="btn ghost" data-close>Cancel</button><button class="btn" id="rSave">${isNew?"Add review":"Save changes"}</button></div>`);
  const paint=()=>{ const src = photoFile ? URL.createObjectURL(photoFile) : (!removePhoto && imgSrc(d.photo_url));
    $("#rPv").innerHTML = src ? `<img src="${esc(src)}" alt="">` : "No photo"; $("#rNoPhoto").classList.toggle("hidden", !src); };
  $("#rFile").onchange=e=>{ const f=e.target.files[0]; if(!f) return; if(f.size>15*1024*1024) return toast("That photo is too large (max 15 MB)", true); photoFile=f; removePhoto=false; paint(); };
  $("#rNoPhoto").onclick=()=>{ photoFile=null; removePhoto=true; $("#rFile").value=""; paint(); };
  paint();
  $("#rSave").onclick=async()=>{
    const body=$("#rBody").value.trim(); if(!body) return toast("Write the review text", true);
    const row={ reviewer:$("#rName").value.trim()||"Customer", dish:$("#rDish").value.trim()||null, body, rating:+$("#rRating").value,
                is_sample:$("#rSample").checked, active:$("#rActive").checked };
    const btn=$("#rSave"); btn.disabled=true; btn.textContent="Saving…";
    try{
      const old=d.photo_url;
      if(photoFile) row.photo_url = await uploadPhoto(photoFile); else if(removePhoto) row.photo_url=null;
      let res;
      if(isNew){ row.sort = S.reviews.length ? Math.max(...S.reviews.map(x=>x.sort))+1 : 0; res = await sb.from("reviews").insert(row).select().single(); }
      else res = await sb.from("reviews").update(row).eq("id", r.id).select().single();
      if(res.error) throw res.error;
      if(old && (photoFile||removePhoto) && old!==res.data.photo_url) removePhotoFile(old);
      if(isNew) S.reviews.push(res.data); else Object.assign(S.reviews.find(x=>x.id===r.id), res.data);
      closeModal(); drawReviews(); toast(isNew?"Review added":"Review saved");
    }catch(e){ fail(e,"Couldn't save"); btn.disabled=false; btn.textContent=isNew?"Add review":"Save changes"; }
  };
}

/* ============================================================
   GALLERY TAB
   ============================================================ */
S.gallery = []; S.galleryFiles = [];
const ICON_LEFT = '<svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>', ICON_RIGHT = '<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>';
const safePath = p => typeof p==="string" && p.length>0 && p.length<=300 && !/^[a-z]+:/i.test(p) && !p.includes("..") && /\.(jpe?g|png|webp)$/i.test(p);
const GALLERY_CATEGORIES = [{id:"food",label:"Food"},{id:"events",label:"Events"},{id:"catering",label:"Catering"}];
const galleryCategory = photo => {
  if(GALLERY_CATEGORIES.some(c=>c.id===photo.category)) return photo.category;
  const details = `${photo.caption||""} ${photo.path||""}`.toLowerCase();
  if(/\b(event|wedding|birthday|celebration|party|function|grazing)\b/.test(details)) return "events";
  if(/\b(catering|buffet|chafing|tray|combo|package|corporate)\b/.test(details)) return "catering";
  return "food";
};
const gallerySrc = path => path.startsWith("storage/")
  ? `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path.slice(8).split("/").map(encodeURIComponent).join("/")}`
  : encodeURI(path);
const galleryCategoryOptions = selected => GALLERY_CATEGORIES.map(c=>`<option value="${c.id}" ${selected===c.id?"selected":""}>${c.label}</option>`).join("");
async function renderGalleryTab(){
  $("#tab-gallery").innerHTML = `<div class="loading">Loading gallery…</div>`;
  const [g, files] = await Promise.all([
    sb.from("gallery").select("*").order("sort").order("id"),
    fetch("images.json", { cache:"no-store" }).then(r=>r.ok?r.json():{images:[],failed:true}).catch(()=>({images:[],failed:true}))
  ]);
  if(g.error){ $("#tab-gallery").innerHTML = `<div class="empty">Couldn't load the gallery. ${esc(g.error.message)}</div>`; return; }
  S.gallery = g.data; S.galleryFiles = (files.images||[]).filter(safePath); S.galleryListFailed = !!files.failed; drawGallery();
}
function drawGallery(){
  const used = new Set(S.gallery.map(x=>x.path)), avail = S.galleryFiles.filter(p=>!used.has(p)), shown = S.gallery.filter(x=>x.active).length;
  $("#tab-gallery").innerHTML = `
    <div class="head"><div><h2>Gallery</h2><p>${shown} photo${shown===1?"":"s"} showing under “From our kitchen” on the website. The first photo is shown large.</p></div></div>
    <div class="gal-upload" id="galleryDrop">
      <div><b>Upload gallery photos</b><div class="gal-upload-hint">Drop image files here, or choose them from your device. Images are resized to at most 1600 px and compressed to about 450 KB when possible. Choose a category before uploading.</div></div>
      <div class="gal-upload-row">
        <input id="galleryFiles" type="file" accept="image/jpeg,image/png,image/webp" multiple hidden>
        <button class="btn" id="galleryChoose" type="button">Choose photos</button>
      </div>
      <div class="gal-upload-row"><select id="galleryUploadCategory" aria-label="Category for uploaded photos">${galleryCategoryOptions("food")}</select></div>
      <div class="gal-upload-status" id="galleryUploadStatus" aria-live="polite"></div>
    </div>
    ${GALLERY_CATEGORIES.map(category=>{
      const photos = S.gallery.map((x,index)=>({x,index})).filter(({x})=>galleryCategory(x)===category.id);
      return `<div class="gal-sec">${category.label} · ${photos.length}</div>
        ${photos.length ? `<div class="gal-grid">${photos.map(({x,index})=>`
          <div class="gal-card ${x.active?"":"off"}">
            <div class="ph"><img src="${esc(gallerySrc(x.path))}" alt="" loading="lazy"><span class="num">${index+1}</span></div>
            <div class="bd">
              <input type="text" maxlength="120" placeholder="Caption (optional)" value="${esc(x.caption||"")}" data-gcap="${x.id}">
              <select aria-label="Category for ${esc(x.caption||x.path)}" data-gcategory="${x.id}">${galleryCategoryOptions(galleryCategory(x))}</select>
              <div class="path">${esc(x.path)}</div>
              <div class="ctl">
                <label class="switch" title="${x.active?"Showing":"Hidden"}"><input type="checkbox" data-gtog="${x.id}" ${x.active?"checked":""}><span></span></label>
                <div class="grow"></div>
                <button class="icon" title="Move earlier" data-gmove="${x.id}" data-dir="-1" ${index===0?"disabled":""}>${ICON_LEFT}</button>
                <button class="icon" title="Move later" data-gmove="${x.id}" data-dir="1" ${index===S.gallery.length-1?"disabled":""}>${ICON_RIGHT}</button>
                <button class="icon" title="Remove from gallery (file is kept)" data-gdel="${x.id}">${ICON.del}</button>
              </div>
            </div>
          </div>`).join("")}</div>` : `<div class="empty">No ${category.label.toLowerCase()} photos yet.</div>`}`;
    }).join("")}
    <div class="gal-sec">Available photos · ${avail.length}</div>
    ${avail.length ? `<div class="gal-grid gal-avail">${avail.map(p=>`
      <div class="gal-card">
        <div class="ph" data-gadd="${esc(p)}" title="Add to gallery"><img src="${esc(gallerySrc(p))}" alt="" loading="lazy"></div>
        <div class="bd"><div class="path">${esc(p)}</div><button class="btn ghost sm" data-gadd="${esc(p)}">+ Add to gallery</button></div>
      </div>`).join("")}</div>` : `<div class="empty">${S.galleryListFailed ? "The photo list can only be read on the live site (febys.vercel.app/admin.html). You can still add a photo by its path below." : "Every photo in your folder is already in the gallery."}</div>`}
    `;
  const t = $("#tab-gallery");
  const fileInput = $("#galleryFiles"), drop = $("#galleryDrop"), choose = $("#galleryChoose");
  choose.onclick = () => fileInput.click();
  fileInput.onchange = () => { if(fileInput.files.length) uploadGalleryFiles([...fileInput.files]); fileInput.value=""; };
  ["dragenter","dragover"].forEach(name=>drop.addEventListener(name,e=>{e.preventDefault();drop.classList.add("drag");}));
  ["dragleave","drop"].forEach(name=>drop.addEventListener(name,e=>{e.preventDefault();drop.classList.remove("drag");}));
  drop.addEventListener("drop",e=>{const files=[...e.dataTransfer.files]; if(files.length) uploadGalleryFiles(files);});
  async function uploadGalleryFiles(files){
    const category=$("#galleryUploadCategory").value, status=$("#galleryUploadStatus");
    const accepted=files.filter(f=>["image/jpeg","image/png","image/webp"].includes(f.type));
    const rejected=files.length-accepted.length;
    if(!accepted.length){ status.textContent="Choose JPG, PNG or WEBP image files."; return; }
    choose.disabled=true; status.textContent=`Uploading 0 of ${accepted.length} photos…`;
    let added=0; const errors=[];
    for(const [i,file] of accepted.entries()){
      let path;
      try{
        if(file.size>20*1024*1024) throw new Error("File exceeds the 20 MB upload limit");
        const blob=await compressGalleryPhoto(file);
        const extension=blob.type==="image/webp"?"webp":"jpg";
        path=`gallery/${crypto.randomUUID()}.${extension}`;
        const {error:uploadError}=await sb.storage.from(BUCKET).upload(path,blob,{contentType:blob.type,cacheControl:"31536000"});
        if(uploadError) throw uploadError;
        const sort=S.gallery.length?Math.max(...S.gallery.map(x=>x.sort))+1:0;
        const caption=file.name.replace(/\.[^.]+$/,"").replace(/[_-]+/g," ").trim();
        const {data,error}=await sb.from("gallery").insert({path:`storage/${path}`,caption,category,sort}).select().single();
        if(error){await sb.storage.from(BUCKET).remove([path]);throw error;}
        S.gallery.push(data); added++;
      }catch(e){errors.push(`${file.name}: ${e.message||"upload failed"}`);}
      status.textContent=`Uploading ${i+1} of ${accepted.length} photos…`;
    }
    choose.disabled=false;
    drawGallery();
    const statusAfter=$("#galleryUploadStatus");
    statusAfter.textContent=[`${added} photo${added===1?"":"s"} uploaded to ${GALLERY_CATEGORIES.find(c=>c.id===category).label}.`,rejected?`${rejected} unsupported file${rejected===1?"":"s"} skipped.`:"",...errors].filter(Boolean).join(" ");
    if(errors.length||rejected) toast(`${added} uploaded; ${errors.length+rejected} failed or skipped. Check the gallery status.`,true);
    else toast(`${added} photo${added===1?"":"s"} uploaded.`);
  }
  t.querySelectorAll("[data-gcap]").forEach(inp=>inp.onchange=async()=>{
    const id=+inp.dataset.gcap, caption=inp.value.trim()||null;
    const { error } = await sb.from("gallery").update({ caption }).eq("id", id);
    if(error) return fail(error,"Couldn't save caption");
    S.gallery.find(x=>x.id===id).caption=caption; toast("Caption saved");
  });
  t.querySelectorAll("[data-gcategory]").forEach(select=>select.onchange=async()=>{
    const id=+select.dataset.gcategory, category=select.value;
    const {error}=await sb.from("gallery").update({category}).eq("id",id);
    if(error){fail(error,"Couldn't change category");return renderGalleryTab();}
    S.gallery.find(x=>x.id===id).category=category; drawGallery(); toast("Category updated");
  });
  t.querySelectorAll("[data-gtog]").forEach(c=>c.onchange=async()=>{
    const id=+c.dataset.gtog; const { error } = await sb.from("gallery").update({ active:c.checked }).eq("id", id);
    if(error){ fail(error,"Couldn't update"); return drawGallery(); }
    S.gallery.find(x=>x.id===id).active=c.checked; drawGallery(); toast(c.checked?"Showing on the website":"Hidden from the website");
  });
  t.querySelectorAll("[data-gmove]").forEach(b=>b.onclick=async()=>{
    const list=[...S.gallery], i=list.findIndex(x=>x.id===+b.dataset.gmove), j=i+(+b.dataset.dir);
    if(j<0||j>=list.length) return; [list[i],list[j]]=[list[j],list[i]];
    try{ await persistOrder("gallery", list); S.gallery=list; drawGallery(); }catch(e){ fail(e,"Couldn't reorder"); renderGalleryTab(); }
  });
  t.querySelectorAll("[data-gdel]").forEach(b=>b.onclick=async()=>{
    const id=+b.dataset.gdel; const { error } = await sb.from("gallery").delete().eq("id", id);
    if(error) return fail(error,"Couldn't remove");
    S.gallery=S.gallery.filter(x=>x.id!==id); drawGallery(); toast("Removed from gallery (the file is kept)");
  });
  t.querySelectorAll("[data-gadd]").forEach(el=>el.onclick=async()=>{
    const path=el.dataset.gadd;
    if(S.gallery.some(x=>x.path===path)) return toast("That photo is already in the gallery",true);
    const sort=S.gallery.length?Math.max(...S.gallery.map(x=>x.sort))+1:0;
    const caption=path.split("/").pop().replace(/\.[^.]+$/,"").replace(/[_-]+/g," ").trim();
    const category=galleryCategory({path});
    const {data,error}=await sb.from("gallery").insert({path,caption,category,sort}).select().single();
    if(error) return fail(error,"Couldn't add");
    S.gallery.push(data); drawGallery(); toast("Added to the gallery");
  });
}

/* ============================================================
   SETTINGS TAB
   ============================================================ */
function renderSettings(){
  const s = S.settings;
  $("#tab-settings").innerHTML = `
    <div class="head"><div><h2>Banner &amp; settings</h2><p>The red announcement bar, WhatsApp number and menu footnote.</p></div></div>
    <div class="card">
      <h3 style="padding:0">Announcement banner</h3>
      <label class="check"><span class="switch"><input type="checkbox" id="sOn" ${s.notice_on?"checked":""}><span></span></span> Show the banner at the top of the site</label>
      <div class="two">
        <label class="f">Headline <small>Shown in script lettering</small><input type="text" id="sTitle" value="${esc(s.notice_title)}"></label>
        <label class="f">Message<input type="text" id="sText" value="${esc(s.notice_text)}"></label>
      </div>
      <div class="banner-preview" id="sPrev"></div>
      <h3 style="padding:8px 0 0">Ordering</h3>
      <label class="f">WhatsApp number <small>Orders are sent here. Country code first, digits only, e.g. 971563267346</small><input type="tel" id="sWa" value="${esc(s.whatsapp)}"></label>
      <label class="f">Menu footnote <small>Small print under the menu</small><textarea id="sFoot" rows="2">${esc(s.footnote)}</textarea></label>
      <div><button class="btn" id="sSave">Save settings</button></div>
    </div>`;
  const prev = () => { $("#sPrev").innerHTML = `<b>${esc($("#sTitle").value)}</b>${esc($("#sText").value)}`; $("#sPrev").style.opacity = $("#sOn").checked ? 1 : .35; };
  ["#sTitle","#sText"].forEach(k=>$(k).oninput=prev); $("#sOn").onchange=prev; prev();
  $("#sSave").onclick = async () => {
    const wa = $("#sWa").value.replace(/\D/g,"");
    if(wa.length < 9) return toast("Check the WhatsApp number — include the country code", true);
    const row = { notice_on:$("#sOn").checked, notice_title:$("#sTitle").value.trim(), notice_text:$("#sText").value.trim(), whatsapp:wa, footnote:$("#sFoot").value.trim() };
    const { data, error } = await sb.from("settings").update(row).eq("id",1).select().single();
    if(error) return fail(error, "Couldn't save");
    S.settings = data; renderSettings(); toast("Settings saved");
  };
}

/* ============================================================
   ADMINS TAB
   ============================================================ */
async function renderAdmins(){
  $("#tab-admins").innerHTML = `<div class="loading">Loading…</div>`;
  const { data, error } = await sb.from("admins").select("*").order("created_at");
  if(error) return fail(error, "Couldn't load admins");
  S.admins = data;
  const me = S.user.email.toLowerCase();
  $("#tab-admins").innerHTML = `
    <div class="head"><div><h2>Admins</h2><p>People who can sign in here and change the menu.</p></div></div>
    <div class="card">
      <div class="alist">${S.admins.map(a=>`
        <div class="arow"><div class="e">${esc(a.name||a.email)}<br><small>${esc(a.email)}</small></div>
        ${a.email===me ? `<span class="pill">You</span>` : `<button class="btn danger sm" data-rm="${esc(a.email)}">Remove</button>`}</div>`).join("")}</div>
      <h3 style="padding:8px 0 0">Add an admin</h3>
      <div class="two">
        <label class="f">Name<input type="text" id="aName" placeholder="e.g. Feby"></label>
        <label class="f">Email<input type="email" id="aEmail" placeholder="name@example.com" autocomplete="off"></label>
      </div>
      <label class="f">Password <small>At least 6 characters. Share it with them — they sign in right away.</small>
        <input type="text" id="aPass" minlength="6" autocomplete="new-password" placeholder="Choose a password for them"></label>
      <div><button class="btn" id="aAdd">Add admin</button></div>
      <div id="aMsg"></div>
    </div>`;
  $("#aAdd").onclick = async () => {
    const btn = $("#aAdd"), msg = t => $("#aMsg").innerHTML = `<div class="msg ok">${t}</div>`;
    const email = $("#aEmail").value.trim().toLowerCase(), password = $("#aPass").value, name = $("#aName").value.trim() || null;
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return toast("Enter a valid email", true);
    if(password.length < 6) return toast("Password needs at least 6 characters", true);
    btn.disabled = true; btn.textContent = "Adding…";
    try{
      // 1) put them on the admin list (fine if they're already on it)
      const { error } = await sb.from("admins").insert({ email, name });
      if(error && error.code !== "23505") throw error;
      // 2) create their login with a separate client, so you stay signed in
      const tmp = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth:{ persistSession:false, autoRefreshToken:false, storageKey:"febys-tmp" } });
      const { data, error: e2 } = await tmp.auth.signUp({ email, password, options:{ data:{ app:"febys", name } } });
      if(e2 && !/already registered/i.test(e2.message)) throw e2;
      const existed = !!e2 || (data?.user && data.user.identities?.length === 0);
      msg(existed
        ? `<b>${esc(email)}</b> is an admin. They already had a login, so they use their existing password.`
        : `<b>${esc(email)}</b> can sign in now with the password you set.`);
      toast("Admin added"); setTimeout(renderAdmins, 2500);
    }catch(err){ fail(err, "Couldn't add admin"); }
    btn.disabled = false; btn.textContent = "Add admin";
  };
  $("#tab-admins").querySelectorAll("[data-rm]").forEach(b=>b.onclick=()=>confirmBox(`Remove ${b.dataset.rm}?`, "They won't be able to change the menu any more.", "Remove", async ()=>{
    const { error } = await sb.from("admins").delete().eq("email", b.dataset.rm);
    if(error) return fail(error);
    toast("Admin removed"); renderAdmins();
  }));
}

/* ============================================================
   ORDERS TAB
   ============================================================ */
const STATUS = { new:"New", confirmed:"Confirmed", completed:"Completed", cancelled:"Cancelled" };
let pollT, lastLoaded = null;
const expandedOrders = new Set();
async function loadOrders(silent){
  const { data, error } = await sb.from("orders").select("*").order("created_at", { ascending:false }).limit(300);
  if(error){ if(!silent) fail(error, "Couldn't load orders"); return false; }
  const before = new Set(S.orders.map(o=>o.id));
  const fresh = lastLoaded ? data.filter(o=>!before.has(o.id) && o.status==="new").length : 0;
  S.orders = data; lastLoaded = new Date();
  updateBadge();
  if(fresh) toast(`${fresh} new order${fresh>1?"s":""} received`);
  return true;
}
function updateBadge(){
  const n = S.orders.filter(o=>o.status==="new").length;
  $("#newBadge").textContent = n; $("#newBadge").classList.toggle("hidden", !n);
  document.title = (n ? `(${n}) ` : "") + "Febys Admin";
}
function startOrderPolling(){
  clearInterval(pollT);
  pollT = setInterval(async () => {
    if(document.hidden || !S.user) return;
    const typing = document.activeElement && document.activeElement.closest && document.activeElement.closest("#tab-orders textarea, #tab-orders input");
    if(await loadOrders(true) && S.tab==="orders" && !typing && !$("#modalRoot").innerHTML) renderOrders();
  }, 30000);
}
function waLink(phone){
  let d = String(phone||"").replace(/\D/g,"");
  if(d.startsWith("00")) d = d.slice(2);
  if(d.startsWith("0")) d = "971" + d.slice(1);
  else if(d.length === 9 && d.startsWith("5")) d = "971" + d;
  return `https://api.whatsapp.com/send?phone=${d}`;
}
function placedAt(ts){
  const d = new Date(ts), now = new Date();
  const t = d.toLocaleTimeString("en-US", { hour:"numeric", minute:"2-digit" });
  const day = new Date(now); day.setHours(0,0,0,0);
  const diff = Math.round((day - new Date(d).setHours(0,0,0,0)) / 864e5);
  if(diff === 0) return `Today, ${t}`;
  if(diff === 1) return `Yesterday, ${t}`;
  return d.toLocaleDateString("en-GB", { day:"numeric", month:"short" }) + `, ${t}`;
}
function forDate(o){
  if(!o.order_date) return "—";
  const d = new Date(o.order_date + "T" + (o.order_time || "12:00"));
  return d.toLocaleDateString("en-GB", { weekday:"short", day:"numeric", month:"short", year:"numeric" })
       + (o.order_time ? ", " + d.toLocaleTimeString("en-US", { hour:"numeric", minute:"2-digit" }) : "");
}
function whatsappOrderDate(date, time){
  if(!date) return "Not specified";
  const d = new Date(date + "T" + (time || "12:00"));
  return `${d.toLocaleDateString("en-GB", { weekday:"short", day:"numeric", month:"short", year:"numeric" })} · ⏰ ${d.toLocaleTimeString("en-US", { hour:"numeric", minute:"2-digit" })}`;
}
function itemPrice(i){
  if(i.price == null) return `<i style="color:var(--muted)">on request</i>`;
  if(i.range) return `AED ${esc(i.range)}${i.qty>1?` ×${i.qty}`:""}`;
  return money(Number(i.price) * (i.qty||1));
}
function orderCard(o){
  const items = Array.isArray(o.items) ? o.items : [];
  const expanded = expandedOrders.has(o.id);
  const acts = {
    new:       [["confirmed","Confirm","btn sm"],["cancelled","Cancel","btn danger sm"]],
    confirmed: [["completed","Mark completed","btn sm"],["new","Back to new","btn ghost sm"],["cancelled","Cancel","btn danger sm"]],
    completed: [["confirmed","Reopen","btn ghost sm"]],
    cancelled: [["new","Restore","btn ghost sm"]]
  }[o.status] || [];
  return `
  <article class="order st-${o.status}" data-oid="${o.id}">
    <div class="ohead">
      <button class="osummary" data-otoggle="${o.id}" aria-expanded="${expanded}" aria-controls="order-details-${o.id}">
        <span class="ref">${esc(o.ref)}</span>
        <span class="spill ${o.status}">${STATUS[o.status]}</span>
        <span class="customer">${esc(o.customer_name)}</span>
        <span class="when">Placed ${esc(placedAt(o.created_at))}</span>
        <span class="tot"><small>${o.has_estimates?"est.":""}</small>${money(o.subtotal)}</span>
        <span class="toggle-hint">${expanded?"Hide details":"View details"}</span>
      </button>
      <button class="btn ghost sm oedit" data-oedit="${o.id}">${ICON.edit} Edit</button>
    </div>
    <div class="odetails ${expanded?"":"hidden"}" id="order-details-${o.id}">
    <div class="obody">
      <div>
        <div class="olabel">Customer</div>
        <div class="okv">
          <b>${esc(o.customer_name)}</b>
          <span>${esc(o.phone)} · <a href="${waLink(o.phone)}" target="_blank" rel="noopener">WhatsApp</a> · <a href="tel:${esc(String(o.phone).replace(/[^\d+]/g,""))}">Call</a></span>
        </div>
        <div class="olabel">${esc(o.mode)}</div>
        <div class="okv">
          <span>${esc(forDate(o))}</span>
          <span>${o.mode==="Delivery" ? esc(o.address||"No address given") : "Pickup at Febys"}</span>
          ${o.chafing ? `<span>Chafing dish rental: <b>Yes</b></span>` : ""}
        </div>
        ${o.notes ? `<div class="olabel">Customer notes</div><div class="onote">${esc(o.notes)}</div>` : ""}
      </div>
      <div>
        <div class="olabel">Items · ${items.reduce((n,i)=>n+(i.qty||1),0)}</div>
        ${items.map(i=>`
          <div class="oitem">
            <div class="r"><span class="q">${i.qty||1}×</span><span><b>${esc(i.name)}</b>${i.variant?` (${esc(i.variant)})`:""}</span><span>${itemPrice(i)}</span></div>
            ${i.pax ? `<div class="sub">Good for ${esc(i.pax)}</div>` : ""}
            ${(i.includes||[]).length ? `<ul>${i.includes.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>` : ""}
          </div>`).join("")}
        <div class="osum">
          <div><span>${o.has_estimates?"Estimated subtotal":"Subtotal"}</span><b>${money(o.subtotal)}</b></div>
          <div style="color:var(--muted)"><span>Delivery fee</span><span>to confirm</span></div>
        </div>
      </div>
    </div>
    <div class="ofoot">
      <textarea data-onote="${o.id}" placeholder="Private note (e.g. paid, rider name)…">${esc(o.admin_note||"")}</textarea>
      ${acts.map(([st,label,cls])=>`<button class="${cls}" data-ost="${st}" data-oid="${o.id}">${label}</button>`).join("")}
      <button class="icon" title="Delete order" data-odel="${o.id}">${ICON.del}</button>
    </div>
    </div>
  </article>`;
}
function renderOrders(){
  const counts = { all:S.orders.length };
  Object.keys(STATUS).forEach(k=>counts[k]=S.orders.filter(o=>o.status===k).length);
  const q = S.oq.trim().toLowerCase();
  const list = S.orders.filter(o => (S.ofilter==="all" || o.status===S.ofilter) &&
    (!q || [o.ref,o.customer_name,o.phone,o.address].join(" ").toLowerCase().includes(q)));
  $("#tab-orders").innerHTML = `
    <div class="head"><div><h2>Orders</h2><p>Every order sent from the website's “Send order on WhatsApp” button. Checks for new ones every 30 seconds.</p></div>
      <button class="btn ghost" id="oRefresh">Refresh</button></div>
    <div class="otools">
      <div class="ofilters">
        ${[["all","All"],["new","New"],["confirmed","Confirmed"],["completed","Completed"],["cancelled","Cancelled"]].map(([k,l])=>`<button data-of="${k}" class="${S.ofilter===k?"on":""}">${l}<span class="c">${counts[k]}</span></button>`).join("")}
      </div>
      <input type="text" id="oSearch" placeholder="Search name, phone, ref, address" value="${esc(S.oq)}">
      <span class="upd">${lastLoaded ? "Updated " + lastLoaded.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"}) : ""}</span>
    </div>
    <div class="olist">${list.length ? list.map(orderCard).join("") :
      `<div class="empty">${S.orders.length ? "No orders match this view." : "No orders yet. They'll appear here as soon as a customer sends one."}</div>`}</div>`;
  const t = $("#tab-orders");
  t.querySelectorAll("[data-of]").forEach(b=>b.onclick=()=>{ S.ofilter=b.dataset.of; renderOrders(); });
  $("#oSearch").oninput = e => { S.oq = e.target.value; const pos = e.target.selectionStart; renderOrders(); const i=$("#oSearch"); i.focus(); i.setSelectionRange(pos,pos); };
  $("#oRefresh").onclick = async () => { if(await loadOrders()) { renderOrders(); toast("Orders up to date"); } };
  t.querySelectorAll("[data-otoggle]").forEach(b=>b.onclick=()=>{
    const id = +b.dataset.otoggle;
    if(expandedOrders.has(id)) expandedOrders.delete(id); else expandedOrders.add(id);
    renderOrders();
  });
  t.querySelectorAll("[data-oedit]").forEach(b=>b.onclick=()=>editOrder(+b.dataset.oedit));
  t.querySelectorAll("[data-ost]").forEach(b=>b.onclick=()=>setOrderStatus(+b.dataset.oid, b.dataset.ost));
  t.querySelectorAll("[data-onote]").forEach(a=>a.onchange=()=>saveOrderNote(+a.dataset.onote, a.value));
  t.querySelectorAll("[data-odel]").forEach(b=>b.onclick=()=>{
    const o = S.orders.find(x=>x.id===+b.dataset.odel);
    confirmBox(`Delete order ${o.ref}?`, "This removes it for good. To keep a record, mark it Cancelled instead.", "Delete order", async ()=>{
      const { error } = await sb.from("orders").delete().eq("id", o.id);
      if(error) return fail(error, "Couldn't delete");
      S.orders = S.orders.filter(x=>x.id!==o.id); updateBadge(); renderOrders(); toast("Order deleted");
    });
  });
}
function orderItemEditor(item={}, index=0){
  const categoryName = id=>S.cats.find(c=>c.id===id)?.name || "Uncategorized";
  const selected = S.items.find(it=>it.name===item.name && (!item.category || categoryName(it.category_id)===item.category));
  const custom = !selected;
  const categories = S.cats.map(category=>({
    name:category.name,
    items:S.items.filter(it=>it.category_id===category.id)
  })).filter(group=>group.items.length);
  const uncategorized = S.items.filter(it=>!S.cats.some(category=>category.id===it.category_id));
  if(uncategorized.length) categories.push({name:"Uncategorized",items:uncategorized});
  return `<div class="edit-item" data-edit-item="${index}">
    <label class="f f-name">Item name<select data-item-name>
      <option value="custom"${custom?" selected":""}>Custom item</option>
      ${categories.map(group=>`<optgroup label="${esc(group.name)}">${group.items.map(it=>`<option value="${it.id}"${selected?.id===it.id?" selected":""}>${esc(it.name)}${it.active?"":" (hidden)"}</option>`).join("")}</optgroup>`).join("")}
    </select></label>
    <label class="f f-custom-name ${custom?"":"hidden"}">Custom item name<input type="text" data-item-field="custom-name" maxlength="200" value="${custom?esc(item.name||""):""}"${custom?" required":""}></label>
    <label class="f">Variant<input type="text" data-item-field="variant" value="${esc(item.variant||"")}"></label>
    <label class="f">Quantity<input type="number" data-item-field="qty" min="1" step="1" value="${esc(item.qty||1)}" required></label>
    <label class="f">Unit price<input type="number" data-item-field="price" min="0" step="0.01" value="${item.price==null?"":esc(item.price)}" placeholder="On request"></label>
    <label class="f">Price range<input type="text" data-item-field="range" value="${esc(item.range||"")}" placeholder="Optional"></label>
    <button type="button" class="icon remove-item" title="Remove item" data-item-remove="${index}">${ICON.del}</button>
    <label class="f">Good for<input type="text" data-item-field="pax" value="${esc(item.pax||"")}"></label>
    <label class="f">Category<input type="text" data-item-field="category" value="${esc(item.category||"")}"></label>
    <label class="f f-includes">Includes <small>One entry per line</small><textarea data-item-field="includes">${esc(Array.isArray(item.includes)?item.includes.join("\n"):"")}</textarea></label>
  </div>`;
}
function editOrder(id){
  const o = S.orders.find(x=>x.id===id);
  if(!o) return;
  const items = Array.isArray(o.items) ? o.items : [];
  modal(`<div class="mh"><h3>Edit order ${esc(o.ref)}</h3><button class="x" data-close>×</button></div>
    <div class="mb" id="editOrderForm">
      <div class="two">
        <label class="f">Customer name<input type="text" id="editCustomer" maxlength="120" required value="${esc(o.customer_name)}"></label>
        <label class="f">Phone<input type="tel" id="editPhone" maxlength="40" required value="${esc(o.phone)}"></label>
      </div>
      <div class="two">
        <label class="f">Order type<select id="editMode"><option${o.mode==="Delivery"?" selected":""}>Delivery</option><option${o.mode==="Pickup"?" selected":""}>Pickup</option></select></label>
        <label class="f">Order date<input type="date" id="editDate" value="${esc(o.order_date||"")}"></label>
      </div>
      <div class="two">
        <label class="f">Address<input type="text" id="editAddress" maxlength="500" value="${esc(o.address||"")}"></label>
        <label class="f">Order time<input type="time" id="editTime" value="${esc((o.order_time||"").slice(0,5))}"></label>
      </div>
      <label class="f">Customer notes<textarea id="editNotes" maxlength="1000">${esc(o.notes||"")}</textarea></label>
      <div class="edit-order-checks">
        <label><input type="checkbox" id="editChafing"${o.chafing?" checked":""}> Chafing dish rental</label>
        <label><input type="checkbox" id="editEstimates"${o.has_estimates?" checked":""} disabled> Subtotal is estimated</label>
      </div>
      <label class="f">Items</label>
      <div class="edit-items" id="editItems">${items.map(orderItemEditor).join("")}</div>
      <button type="button" class="btn ghost sm" id="addOrderItem">Add item</button>
      <label class="f">Subtotal (AED) · <span id="editSubtotalLabel">${o.has_estimates?"Estimated subtotal":"Subtotal"}</span><input type="number" id="editSubtotal" min="0" step="0.01" readonly value="${esc(o.subtotal)}"></label>
    </div>
    <div class="mf"><button class="btn ghost" data-close>Cancel</button><button class="btn ghost" id="editOrderWhatsApp">WhatsApp updated details</button><button class="btn" id="saveOrderEdit">Save changes</button></div>`);
  const renderItems = rows => {
    $("#editItems").innerHTML = rows.map(orderItemEditor).join("");
    $("#editItems").querySelectorAll("[data-item-name]").forEach(select=>select.onchange=()=>{
      const row=select.closest(".edit-item");
      const customName=row.querySelector(".f-custom-name");
      const custom=select.value==="custom";
      customName.classList.toggle("hidden",!custom);
      customName.querySelector("input").required=custom;
      if(custom) return;
      const it=S.items.find(x=>x.id===Number(select.value));
      if(!it) return;
      const variant=it.variants?.[0];
      row.querySelector('[data-item-field="custom-name"]').value="";
      row.querySelector('[data-item-field="variant"]').value=variant?.label||"";
      row.querySelector('[data-item-field="price"]').value=variant?.price??it.price??"";
      row.querySelector('[data-item-field="range"]').value=variant?.range||"";
      row.querySelector('[data-item-field="pax"]').value=it.pax||"";
      row.querySelector('[data-item-field="category"]').value=S.cats.find(c=>c.id===it.category_id)?.name||"";
      row.querySelector('[data-item-field="includes"]').value=Array.isArray(it.includes)?it.includes.join("\n"):"";
    });
    $("#editItems").querySelectorAll("[data-item-remove]").forEach(b=>b.onclick=()=>{
      const current = readItems();
      current.splice(+b.dataset.itemRemove,1);
      renderItems(current);
      updateEstimatedSubtotal();
    });
  };
  const readItems = () => [...$("#editItems").querySelectorAll(".edit-item")].map(row=>{
    const value=field=>row.querySelector(`[data-item-field="${field}"]`).value.trim();
    const rawPrice=value("price");
    const selection=row.querySelector("[data-item-name]").value;
    return {
      name:selection==="custom"?value("custom-name"):S.items.find(it=>it.id===Number(selection))?.name||"",
      variant:value("variant"),qty:Number(value("qty")),
      price:rawPrice===""?null:Number(rawPrice),range:value("range"),
      pax:value("pax"),category:value("category"),
      includes:value("includes").split(/\r?\n/).map(x=>x.trim()).filter(Boolean)
    };
  });
  const updateEstimatedSubtotal = () => {
    const current=readItems();
    const subtotal=current.reduce((sum,item)=>sum+
      (Number.isFinite(item.price)?item.price:0)*(Number.isFinite(item.qty)?item.qty:0),0);
    const estimated=current.some(item=>item.price==null||item.range);
    $("#editSubtotal").value=subtotal.toFixed(2);
    $("#editEstimates").checked=estimated;
    $("#editSubtotalLabel").textContent=estimated?"Estimated subtotal":"Subtotal";
  };
  $("#editItems").addEventListener("input",updateEstimatedSubtotal);
  $("#editItems").addEventListener("change",updateEstimatedSubtotal);
  renderItems(items);
  updateEstimatedSubtotal();
  $("#addOrderItem").onclick=()=>{
    const current=readItems();
    current.push({name:"",variant:"",qty:1,price:null,range:"",pax:"",category:"",includes:[]});
    renderItems(current);
    updateEstimatedSubtotal();
  };
  $("#editOrderWhatsApp").onclick=()=>{
    const recipient=S.settings?.whatsapp;
    if(!recipient){ toast("Set the business WhatsApp number in Settings first",true); return; }
    const customer=$("#editCustomer").value.trim();
    const phone=$("#editPhone").value.trim();
    const mode=$("#editMode").value;
    const address=$("#editAddress").value.trim();
    const date=$("#editDate").value;
    const time=$("#editTime").value;
    const notes=$("#editNotes").value.trim();
    const current=readItems();
    if(!customer||phone.length<5||current.some(item=>!item.name||!Number.isInteger(item.qty)||item.qty<1)){
      toast("Complete the customer details and valid order items first",true); return;
    }
    if(mode==="Delivery"&&!address){ toast("Add a delivery address first",true); return; }
    const subtotal=current.reduce((sum,item)=>sum+
      (Number.isFinite(item.price)?item.price:0)*(Number.isFinite(item.qty)?item.qty:0),0);
    const estimated=current.some(item=>item.price==null||item.range);
    const line="━━━━━━━━━━━━━━━";
    const count=current.reduce((sum,item)=>sum+item.qty,0);
    const itemLines=current.flatMap(item=>{
      const price=item.price==null?"_price on request_":item.range?`AED ${item.range}`:money(item.price*item.qty);
      const head=`*${item.name}*${item.variant?` (${item.variant})`:""}  ×${item.qty}\n     💵 ${price}${item.qty>1&&item.price!=null&&!item.range?` _(${money(item.price)} each)_`:""}`;
      return [head,...(item.pax?[`     👥 Good for ${item.pax}`]:[]),...(item.includes||[]).map(include=>`     ▫️ ${include}`),""];
    });
    const deliveryDate=whatsappOrderDate(date,time);
    const message=[
      `*UPDATED ORDER · FEBYS*`,
      `Ref: *${o.ref}*`,
      line,
      `*MY ORDER* (${count} item${count===1?"":"s"})`,
      "",
      ...itemLines,
      line,
      `*${estimated?"Estimated subtotal":"Subtotal"}: ${money(subtotal)}*`,
      $("#editChafing").checked?"Chafing dish rental: *Yes please*":"",
      `_Delivery fee & final total to be confirmed_`,
      line,
      `*CUSTOMER*`,
      `     ${customer}`,
      `     📱 ${phone}`,
      "",
      mode==="Delivery"?"*DELIVERY*":"*PICKUP*",
      `     📅 ${deliveryDate}`,
      mode==="Delivery"?`     📍 ${address}`:"     📍 Febys, Al Rigga, Corniche Deira",
      notes?`\n*NOTES*\n     ${notes}`:"",
      line,
      `Salamat po! Looking forward to it 🙏💚`
    ].filter((value,index,all)=>!(value===""&&all[index-1]==="")).join("\n");
    window.open(`${waLink(recipient)}&text=${encodeURIComponent(message)}`,"_blank","noopener");
  };
  $("#saveOrderEdit").onclick=async()=>{
    const name=$("#editCustomer").value.trim(), phone=$("#editPhone").value.trim();
    const subtotal=Number($("#editSubtotal").value);
    const updatedItems=readItems();
    if(!name||name.length>120||phone.length<5||phone.length>40){
      toast("Enter a customer name and a valid phone number",true); return;
    }
    if(!updatedItems.length||updatedItems.some(i=>!i.name||!Number.isInteger(i.qty)||i.qty<1||
      (i.price!==null&&(!Number.isFinite(i.price)||i.price<0)))){
      toast("Add at least one valid item with a name and quantity",true); return;
    }
    if(!Number.isFinite(subtotal)||subtotal<0){
      toast("Enter a valid non-negative subtotal",true); return;
    }
    const mode=$("#editMode").value;
    const address=$("#editAddress").value.trim();
    if(address.length>500||$("#editNotes").value.length>1000){
      toast("Address or customer notes are too long",true); return;
    }
    if(mode==="Delivery"&&!address){
      toast("Add a delivery address",true); return;
    }
    const changes={
      customer_name:name,phone,mode,address:address||null,
      order_date:$("#editDate").value||null,order_time:$("#editTime").value||null,
      chafing:$("#editChafing").checked,notes:$("#editNotes").value.trim()||null,
      items:updatedItems,subtotal,has_estimates:$("#editEstimates").checked
    };
    const button=$("#saveOrderEdit"); button.disabled=true;
    const { data,error }=await sb.from("orders").update(changes).eq("id",id).select().single();
    if(error){ button.disabled=false; return fail(error,"Couldn't update order"); }
    Object.assign(o,data); expandedOrders.add(id); closeModal(); renderOrders(); toast("Order updated");
  };
}
async function setOrderStatus(id, status){
  const { data, error } = await sb.from("orders").update({ status }).eq("id", id).select().single();
  if(error) return fail(error, "Couldn't update");
  Object.assign(S.orders.find(o=>o.id===id), data); updateBadge(); renderOrders();
  toast({ confirmed:"Order confirmed", completed:"Marked completed", cancelled:"Order cancelled", new:"Moved back to New" }[status]);
}
async function saveOrderNote(id, note){
  const { error } = await sb.from("orders").update({ admin_note: note.trim() || null }).eq("id", id);
  if(error) return fail(error, "Couldn't save note");
  S.orders.find(o=>o.id===id).admin_note = note.trim() || null; toast("Note saved");
}

/* ============================================================
   MODAL HELPERS
   ============================================================ */
function modal(html){
  $("#modalRoot").innerHTML = `<div class="overlay"><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`;
  $("#modalRoot").querySelectorAll("[data-close]").forEach(b=>b.onclick=closeModal);
  $("#modalRoot .overlay").addEventListener("mousedown", e=>{ if(e.target.classList.contains("overlay")) closeModal(); });
}
function closeModal(){ $("#modalRoot").innerHTML = ""; }
document.addEventListener("keydown", e=>{ if(e.key==="Escape") closeModal(); });
function confirmBox(title, text, okLabel, onOk){
  modal(`<div class="mh"><h3>${esc(title)}</h3><button class="x" data-close>×</button></div>
    <div class="mb"><p>${esc(text)}</p></div>
    <div class="mf"><button class="btn ghost" data-close>Cancel</button><button class="btn danger" id="okBtn">${esc(okLabel)}</button></div>`);
  $("#okBtn").onclick = async () => { $("#okBtn").disabled = true; closeModal(); await onOk(); };
}

/* ---------- start ---------- */
setLoginMode("signin");
} else {
/* ============================================================
   MENU DATA — managed in admin.html (stored in Supabase).
   The list below is only a fallback, shown if the live menu
   can't be loaded (e.g. no internet).
   ============================================================ */
const { SUPABASE_URL, SUPABASE_KEY } = window.FEBYS_SITE;
let WHATSAPP = window.FEBYS_SITE.WHATSAPP;
let MENU = [
  { id:"combos", name:"Holiday Combos", note:"Bundles for gatherings", items:[
    { id:"c1", name:"Combo 1", price:180, tone:"g2", list:["1 kilo Lechon Kawali / Crispy Pata","Feby's Fried Chicken","Shanghai (30 pcs)"] },
    { id:"c2", name:"Combo 2", price:250, tone:"g2", list:["1 kilo Lechon Roll","1 kilo Lechon Kawali / Crispy Pata","Feby's Fried Chicken","Shanghai (30 pcs)"] },
    { id:"c3", name:"Combo 3", price:360, tone:"g2", list:["1 kilo Lechon Roll","1 Half Tray Kaldereta / Kare-Kare","1 Half Tray Sisig","Feby's Fried Chicken","Shanghai (30 pcs)"] },
  ]},
  { id:"packages", name:"Party Packages", note:"Complete spreads by guest count", items:[
    { id:"pa", name:"Package A", pax:"4–6 pax", price:450, tone:"g1", list:["1 Half Tray Pasta / Noodles","1 Tray Rice","1 kilo Lechon Belly Roll","2 Half Tray Main Course","1 Half Tray Kakanin"] },
    { id:"pb", name:"Package B", pax:"10–12 pax", price:800, tone:"g1", list:["1 Big Tray Pasta / Noodles","1 Big Tray Rice","2 kilos Lechon Belly Roll","2 Big Tray Main Course","1 Half Tray Kakanin"] },
  ]},
  { id:"specials", name:"Specials", note:"Lechon & cochinillo", items:[
    { id:"coch", name:"Cochinillo", tone:"g3", badge:"Whole roast pig", desc:"Whole roasted suckling pig with crackling skin. Choose the size.",
      variants:[{label:"8 kilos",price:900},{label:"9 kilos",price:1000},{label:"10 kilos",price:1100},{label:"11 kilos",price:1200}] },
    { id:"ulo", name:"Lechon Ulo", tone:"g3", desc:"Roasted lechon head. Final price depends on size — we'll confirm on WhatsApp.",
      variants:[{label:"Half",price:150,range:"150–200"},{label:"Whole",price:300,range:"300–350"}] },
  ]},
  { id:"trays", name:"Food Trays", note:"Ask us for today's prices", items:[
    { id:"t1", name:"Lechon Kawali / Crispy Pata", tone:"g4", price:null, desc:"Deep-fried pork belly or pork knuckle, served with sauce." },
    { id:"t2", name:"Lechon Belly Roll", tone:"g4", price:null, desc:"Herb-stuffed rolled pork belly, roasted until crisp." },
    { id:"t3", name:"Kare-Kare", tone:"g4", price:null, desc:"Oxtail and vegetables in rich peanut sauce with bagoong." },
  ]},
];

/* ---------- state ---------- */
let cart = [];
try { cart = JSON.parse(localStorage.getItem("febys_cart")||"[]"); } catch(e){ cart=[]; }
const save = () => { try{ localStorage.setItem("febys_cart", JSON.stringify(cart)); }catch(e){} };
const chosen = {}; // selected variant per item
const fmt = n => "AED " + n.toLocaleString("en-US");
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

/* ---------- render menu ---------- */
function renderMenu(){
  $("#tabs").innerHTML = MENU.map((c,i)=>`<button class="tab${i?"":" active"}" data-cat="${c.id}">${esc(c.name)}</button>`).join("");
  $("#menuRoot").innerHTML = MENU.map(c=>`
    <div class="cat" id="cat-${c.id}">
      <div class="cat-title"><h3>${esc(c.name)}</h3><span>${esc(c.note)}</span></div>
      <div class="grid">${c.items.map(card).join("")}</div>
    </div>`).join("");
}
function card(it){
  if(it.variants && chosen[it.id]==null) chosen[it.id]=0;
  const v = it.variants ? it.variants[chosen[it.id]] : null;
  const price = v ? v.price : it.price;
  const priceHtml = v && v.range ? `<div class="price"><small>from</small>AED ${v.range}</div>`
                  : price==null ? `<div class="price price-request"><small>Price</small>on request</div>`
                  : `<div class="price">${fmt(price)}</div>`;
  return `<article class="item" data-id="${it.id}">
    <div class="thumb ${it.tone||"g1"}">
      ${it.photo ? `<img src="${esc(it.photo)}" alt="${esc(it.name)}" loading="lazy">` : `<span class="ph">${esc(it.name.split(" ")[0])}</span>`}
      ${it.badge?`<span class="badge">${esc(it.badge)}</span>`:""}
    </div>
    <div class="body">
      <h4>${esc(it.name)}</h4>
      ${it.pax?`<div class="pax">Good for ${esc(it.pax)}</div>`:""}
      ${it.desc?`<p class="desc">${esc(it.desc)}</p>`:""}
      ${it.list?`<ul>${it.list.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`:""}
      ${it.variants?`<div class="variants">${it.variants.map((x,i)=>`<button class="${i===chosen[it.id]?"on":""}" data-var="${i}">${esc(x.label)}</button>`).join("")}</div>`:""}
      <div class="foot">${priceHtml}
        <button class="add${price==null?" ask":""}" data-add="${it.id}">${price==null?"Add to inquiry":"Add"}</button>
      </div>
    </div>
  </article>`;
}
function findItem(id){ for(const c of MENU) for(const it of c.items) if(it.id===id) return it; }

document.addEventListener("click", e=>{
  const tab = e.target.closest(".tab");
  if(tab){ document.querySelectorAll(".tab").forEach(t=>t.classList.toggle("active",t===tab));
           document.getElementById("cat-"+tab.dataset.cat).scrollIntoView({behavior:"smooth"}); return; }
  const vb = e.target.closest("[data-var]");
  if(vb){ const art = vb.closest(".item"); const it = findItem(art.dataset.id);
          chosen[it.id] = +vb.dataset.var; art.outerHTML = card(it); return; }
  const ab = e.target.closest("[data-add]");
  if(ab){ addToCart(ab.dataset.add); }
});

/* ---------- cart ---------- */
function addToCart(id){
  const it = findItem(id);
  const v = it.variants ? it.variants[chosen[id]] : null;
  const key = id + (v?"|"+v.label:"");
  const ex = cart.find(l=>l.key===key);
  if(ex) ex.qty++;
  else cart.push({ key, name:it.name, variant:v?v.label:"", price:v?v.price:it.price, range:v&&v.range?v.range:"", qty:1,
                   list: it.list || [], pax: it.pax || "", cat: (MENU.find(c=>c.items.includes(it))||{}).name || "",
                   photo: it.photo || "", tone: it.tone || "g1" });
  save(); updateCount(); toast(`${it.name}${v?" · "+v.label:""} added`);
}
function updateCount(){ $("#cartCount").textContent = cart.reduce((s,l)=>s+l.qty,0); }
function total(){ return cart.reduce((s,l)=>s+(l.price||0)*l.qty,0); }
const hasEstimates = () => cart.some(l=>l.price==null || l.range);

function openCart(){ $("#overlay").classList.add("show"); $("#drawer").classList.add("show"); renderCart(); }
function closeCart(){ $("#overlay").classList.remove("show"); $("#drawer").classList.remove("show"); }
$("#openCart").onclick = openCart; $("#closeCart").onclick = closeCart; $("#overlay").onclick = closeCart;

function renderCart(){
  $("#dTitle").textContent = "Your order";
  if(!cart.length){
    $("#dBody").innerHTML = `<div class="empty"><img class="mark" src="media/logo.jpg" alt=""><p>Your order is empty.<br>Add something delicious from the menu.</p></div>`;
    $("#dFoot").innerHTML = `<button class="btn btn-dark full" id="browseMenu">Browse the menu</button>`;
    $("#browseMenu").onclick = () => { closeCart(); document.getElementById("order").scrollIntoView({behavior:"smooth"}); };
    return;
  }
  const count = cart.reduce((n,l)=>n+l.qty,0);
  const onRequest = cart.filter(l=>l.price==null).length;
  $("#dBody").innerHTML = `<div class="cart-head"><span>${count} item${count>1?"s":""}</span><span>${cart.length} dish${cart.length>1?"es":""}</span></div>`
  + cart.map((l,i)=>{
    const each = l.price==null ? "" : l.range ? `AED ${esc(l.range)} each` : `${fmt(l.price)} each`;
    const lineTotal = l.price==null ? `<small>Price</small>on request`
                    : l.range ? `<small>approx.</small>AED ${esc(l.range)}${l.qty>1?` ×${l.qty}`:""}`
                    : fmt(l.price*l.qty);
    const list = l.list || [];
    return `
    <div class="line">
      <div class="line-top">
        <div class="lthumb ${esc(l.tone||"g1")}">${l.photo?`<img src="${esc(l.photo)}" alt="">`:esc(l.name.trim().charAt(0))}</div>
        <div>
          <b>${esc(l.name)}</b>
          ${(l.variant||l.pax||l.cat) ? `<div class="chips">
            ${l.variant?`<span class="chip">${esc(l.variant)}</span>`:""}
            ${l.pax?`<span class="chip">Good for ${esc(l.pax)}</span>`:""}
            ${l.cat?`<span class="chip alt">${esc(l.cat)}</span>`:""}
          </div>`:""}
          ${each?`<div class="each">${each}</div>`:""}
        </div>
      </div>
      ${list.length ? `<details class="incl" ${list.length<=6?"open":""}>
        <summary>What's included · ${list.length}</summary>
        <ul>${list.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>
      </details>` : ""}
      <div class="line-bot">
        <div class="qty"><button data-q="${i}" data-d="-1" aria-label="Less">−</button><span>${l.qty}</span><button data-q="${i}" data-d="1" aria-label="More">+</button></div>
        <button class="rm" data-rm="${i}">Remove</button>
        <div class="lp">${lineTotal}</div>
      </div>
    </div>`;}).join("")
  + `<div class="sum">
      <div><span>Items</span><span>${count}</span></div>
      ${onRequest?`<div class="muted"><span>${onRequest} dish${onRequest>1?"es":""} priced on request</span><span>confirmed on WhatsApp</span></div>`:""}
    </div>`;
  $("#dFoot").innerHTML = `
    <div class="tot"><span>${hasEstimates()?"Estimated subtotal":"Subtotal"}</span><b>${fmt(total())}</b></div>
    <div class="note">Excludes delivery${hasEstimates()?"; final prices for some items confirmed on WhatsApp":""}. Advance booking required.</div>
    <button class="btn btn-dark full" id="toCheckout">Continue to details</button>`;
  $("#toCheckout").onclick = renderCheckout;
}
$("#dBody").addEventListener("click", e=>{
  const rm = e.target.closest("[data-rm]");
  if(rm){ cart.splice(+rm.dataset.rm,1); save(); updateCount(); return renderCart(); }
  const b = e.target.closest("[data-q]"); if(!b) return;
  const l = cart[+b.dataset.q]; l.qty += +b.dataset.d;
  if(l.qty<=0) cart.splice(+b.dataset.q,1);
  save(); updateCount(); renderCart();
});

function renderCheckout(){
  $("#dTitle").textContent = "Your details";
  const min = new Date(Date.now()+86400000).toISOString().slice(0,10);
  $("#dBody").innerHTML = `
    <button class="back" id="back">← Back to order</button>
    <form class="co" id="co">
      <label>Full name<input name="name" required autocomplete="name"></label>
      <label>Mobile / WhatsApp<input name="phone" required type="tel" placeholder="05X XXX XXXX" autocomplete="tel"></label>
      <div class="seg">
        <input type="radio" name="mode" id="m1" value="Delivery" checked><label for="m1">Delivery</label>
        <input type="radio" name="mode" id="m2" value="Pickup"><label for="m2">Pickup</label>
      </div>
      <label id="addrWrap">Delivery address<textarea name="address" rows="2" placeholder="Building, street, area"></textarea></label>
      <div class="row2">
        <label>Date<input name="date" type="date" required min="${min}" value="${min}"></label>
        <label>Time<input name="time" type="time" required value="12:00"></label>
      </div>
      <label class="check"><input type="checkbox" name="chafing"> Add chafing dish rental (extra charge)</label>
      <label>Notes<textarea name="notes" rows="2" placeholder="Occasion, allergies, special requests"></textarea></label>
    </form>`;
  $("#dFoot").innerHTML = `
    <div class="tot"><span>${hasEstimates()?"Estimated subtotal":"Subtotal"}</span><b>${fmt(total())}</b></div>
    <div class="note">We'll confirm availability, delivery fee and final total on WhatsApp.</div>
    <button class="btn btn-dark full" id="send">Send order on WhatsApp</button>`;
  $("#back").onclick = renderCart;
  document.querySelectorAll('input[name=mode]').forEach(r=>r.onchange=()=>{
    $("#addrWrap").style.display = $("#m1").checked ? "" : "none";
  });
  $("#send").onclick = sendOrder;
}

/* ---------- WhatsApp order message ---------- */
function prettyDate(iso, time){
  try{
    const d = new Date(iso + "T" + (time||"12:00"));
    const day = d.toLocaleDateString("en-GB", { weekday:"short", day:"numeric", month:"short", year:"numeric" });
    const hr = d.toLocaleTimeString("en-US", { hour:"numeric", minute:"2-digit" });
    return `${day} · ⏰ ${hr}`;
  }catch(e){ return `${iso} · ⏰ ${time}`; }
}
function saveOrder(order){
  try{
    fetch(`${SUPABASE_URL}/rest/v1/rpc/place_order`, {
      method:"POST", keepalive:true,
      headers:{ apikey:SUPABASE_KEY, "Content-Type":"application/json", "Content-Profile":"febys" },
      body: JSON.stringify({ p: order })
    }).then(r=>{ if(!r.ok) r.text().then(t=>console.warn("Order not saved:", t)); })
      .catch(e=>console.warn("Order not saved:", e));
  }catch(e){ console.warn("Order not saved:", e); }
}
function sendOrder(){
  const f = $("#co");
  if(!f.reportValidity()) return;
  const d = Object.fromEntries(new FormData(f));
  if(d.mode==="Delivery" && !d.address.trim()){ toast("Please add a delivery address"); return; }

  const ref = "FB-" + new Date().toISOString().slice(5,10).replace("-","") + "-" + Math.floor(1000 + Math.random()*9000);
  const line = "━━━━━━━━━━━━━━━";
  const count = cart.reduce((s,l)=>s+l.qty,0);
  const items = cart.flatMap((l,i)=>{
    const price = l.price==null ? "_price on request_" : l.range ? `AED ${l.range}` : fmt(l.price*l.qty);
    const head = `*${l.name}*${l.variant?` (${l.variant})`:""}  ×${l.qty}\n     💵 ${price}${l.qty>1 && l.price!=null && !l.range ? ` _(${fmt(l.price)} each)_` : ""}`;
    const extra = [];
    if(l.pax) extra.push(`     👥 Good for ${l.pax}`);
    (l.list||[]).forEach(x=>extra.push(`     ▫️ ${x}`));
    return [head, ...extra, ""];
  });

  const msg = [
    `*NEW ORDER · FEBYS*`,
    `Ref: *${ref}*`,
    line,
    `*MY ORDER* (${count} item${count>1?"s":""})`,
    "",
    ...items,
    line,
    `*${hasEstimates()?"Estimated subtotal":"Subtotal"}: ${fmt(total())}*`,
    d.chafing ? `Chafing dish rental: *Yes please*` : "",
    `_Delivery fee & final total to be confirmed_`,
    line,
    `*CUSTOMER*`,
    `     ${d.name}`,
    `     📱 ${d.phone}`,
    "",
    d.mode==="Delivery" ? `*DELIVERY*` : `*PICKUP*`,
    `     📅 ${prettyDate(d.date, d.time)}`,
    d.mode==="Delivery" ? `     📍 ${d.address.trim()}` : `     📍 Febys, Al Rigga, Corniche Deira`,
    d.notes.trim() ? `\n*NOTES*\n     ${d.notes.trim()}` : "",
    line,
    `Salamat po! Looking forward to it 🙏💚`
  ].filter((x,i,a)=>!(x==="" && a[i-1]==="")).join("\n");

  // save a copy for the admin Orders page (runs in the background; WhatsApp opens regardless)
  saveOrder({
    ref, name: d.name.trim(), phone: d.phone.trim(), mode: d.mode,
    address: d.mode==="Delivery" ? d.address.trim() : "", date: d.date, time: d.time,
    chafing: !!d.chafing, notes: (d.notes||"").trim(),
    subtotal: total(), has_estimates: hasEstimates(),
    items: cart.map(l=>({ name:l.name, variant:l.variant||"", qty:l.qty, price:l.price, range:l.range||"", pax:l.pax||"", category:l.cat||"", includes:l.list||[] }))
  });

  // api.whatsapp.com keeps emojis intact (wa.me can turn them into � on Windows)
  window.open(`https://api.whatsapp.com/send?phone=${WHATSAPP}&text=${encodeURIComponent(msg)}`, "_blank");
  cart = []; save(); updateCount(); closeCart(); toast("Opening WhatsApp…");
}

let tt; function toast(t){ const el=$("#toast"); el.textContent=t; el.classList.add("show"); clearTimeout(tt); tt=setTimeout(()=>el.classList.remove("show"),1800); }


$("#yr").textContent = new Date().getFullYear();
renderMenu(); updateCount();

/* ---------- live menu from the admin ---------- */
async function loadLiveMenu(){
  const get = path => fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers:{ apikey:SUPABASE_KEY, "Accept-Profile":"febys" } })
                        .then(r => r.ok ? r.json() : Promise.reject(new Error(r.status)));
  try{
    const [cats, items, settings] = await Promise.all([
      get("categories?select=id,name,note,sort&active=eq.true&order=sort,id"),
      get("menu_items?select=*&active=eq.true&order=sort,id"),
      get("settings?select=*&id=eq.1")
    ]);
    const live = cats.map(c => ({
      id: "c" + c.id, name: c.name, note: c.note || "",
      items: items.filter(i => i.category_id === c.id).map(i => ({
        id: "i" + i.id, name: i.name, pax: i.pax, badge: i.badge, tone: i.tone,
        desc: i.description, photo: i.photo_url,
        list: i.includes && i.includes.length ? i.includes : null,
        price: i.price == null ? null : Number(i.price),
        variants: i.variants && i.variants.length ? i.variants.map(v => ({ ...v, price: Number(v.price) })) : null
      }))
    })).filter(c => c.items.length);
    if(live.length){ MENU = live; renderMenu(); }
    const st = settings[0];
    if(st){
      $("#notice").style.display = st.notice_on ? "" : "none";
      $("#noticeTitle").textContent = st.notice_title;
      $("#noticeText").textContent = st.notice_text;
      $("#footnote").textContent = st.footnote;
      if(st.whatsapp && st.whatsapp !== WHATSAPP){
        document.querySelectorAll('a[href*="wa.me/"]').forEach(a => a.href = a.href.replace(/wa\.me\/\d+/, "wa.me/" + st.whatsapp));
        WHATSAPP = st.whatsapp;
        const local = st.whatsapp.replace(/^971/, "0");
        if(/^0\d{9}$/.test(local)) $("#waLink").textContent = `${local.slice(0,3)} ${local.slice(3,6)} ${local.slice(6)}`;
      }
    }
  }catch(e){ console.warn("Live menu unavailable, showing built-in menu.", e); }
}
loadLiveMenu();

/* ---------- reviews (managed in admin → Reviews) ----------
   Fallback = customer messages from the Feby's Company Profile 2026. */
const PROFILE_REVIEWS = [
  "Thank you po sa pag-accept sa same day order… sa uulitin po. Totoo ang tsismis, sobrang sarap po ng mga luto n'yo!",
  "Can't wait! Thank you for my super yummy comfort food!",
  "SARAAAP!!!",
  "You just won a repeat customer!",
  "Cravings satisfied!",
  "Salamat din po, nasarapan po sila sa pang-world class na suka!",
  "Mam grabe ang sarap! Maraming salamat po! Sa uulitin po!"
].map(body => ({ body, reviewer:"", dish:"", is_sample:false }));

function renderReviews(list){
  if(!list.length){ $("#reviews").classList.add("hidden"); return; }
  const bubble = r => `
    <figure class="bubble">
      <p>${esc(r.body.replace(/^Sample review:\s*/i,""))}</p>
      ${(r.reviewer||r.dish)?`<small>${esc(r.reviewer||"")}${r.reviewer&&r.dish?" · ":""}${esc(r.dish||"")}</small>`:""}
      ${r.is_sample?`<span class="tag">Sample</span>`:""}
    </figure>`;
  const half = Math.ceil(list.length/2);
  const rows = list.length > 3 ? [list.slice(0,half), list.slice(half)] : [list, list.slice().reverse()];
  [["#rvTrack",rows[0]],["#rvTrack2",rows[1]]].forEach(([sel,row])=>{
    let r = row.slice(); while(r.length < 8) r = r.concat(row);   // fill wide screens
    const html = r.map(bubble).join("");
    $(sel).innerHTML = html + html;                                 // doubled for a seamless loop
  });
  $("#rvNote").classList.toggle("hidden", !list.some(r=>r.is_sample));
  $("#reviews").classList.remove("hidden");
}
(async function loadReviews(){
  try{
    const r = await fetch(`${SUPABASE_URL}/rest/v1/reviews?select=reviewer,dish,body,is_sample&active=eq.true&order=sort,id`,
                          { headers:{ apikey:SUPABASE_KEY, "Accept-Profile":"febys" } });
    if(!r.ok) throw new Error(r.status);
    const rows = await r.json();
    renderReviews(rows.length ? rows : PROFILE_REVIEWS);
  }catch(e){ renderReviews(PROFILE_REVIEWS); }
})();
/* ---------- photo gallery (choose photos in admin → Gallery) ---------- */
const GALLERY_FALLBACK = [
  ["media/grazing.jpg","Event grazing table"],["media/Combo1.jpg","Holiday Combo 1"],["media/halo-halo.jpg","Halo-Halo"],
  ["media/Lechon Roll.jpg","Lechon Belly Roll"],["media/yema-cake.jpg","Yema Cheezycake"],["media/chafing.jpg","Buffet catering"],
  ["media/HalfTray_Karekare.jpg","Kare-Kare"],["media/lasagna.jpg","Lasagna"],["media/cheese-bread.jpg","Cheese garlic bread"],
  ["media/Crispy Pata.jpg","Crispy Pata"],["media/milk-tea.jpg","Milk tea"],["media/Sisig.jpg","Sisig"]
].map(([path,caption])=>({path,caption}));
let galleryList = [], lbIndex = 0;
const GALLERY_CATEGORIES = [
  {id:"food", label:"Food", grid:"#gGridFood"},
  {id:"events", label:"Events", grid:"#gGridEvents"},
  {id:"catering", label:"Catering", grid:"#gGridCatering"}
];
function galleryCategory(g){
  if(GALLERY_CATEGORIES.some(category => category.id === g.category)) return g.category;
  const details = `${g.caption||""} ${g.path||""}`.toLowerCase();
  if(/\b(event|wedding|birthday|celebration|party|function|grazing)\b/.test(details)) return "events";
  if(/\b(catering|buffet|chafing|tray|combo|package|corporate)\b/.test(details)) return "catering";
  return "food";
}
function gallerySrc(path){
  if(path.startsWith("storage/")){
    const key = path.slice(8).split("/").map(encodeURIComponent).join("/");
    return `${SUPABASE_URL}/storage/v1/object/public/febys-menu/${key}`;
  }
  return encodeURI(path);
}
let galleryAll = [], galleryFilter = "all", galleryExpanded = false;
const gPhone = window.matchMedia("(max-width:860px)");
const galleryPage = () => gPhone.matches ? 6 : 8;
// tile sizes that always fill the grid with no gaps: b = big, w = wide, f = full width, s = small
function gallerySizes(n){
  const phone = gPhone.matches, out = [];
  const block = phone ? ["b","s","s","w","s","s"] : ["b","s","s","s","s","w","s","s"];
  const rest = phone ? {1:["w"],2:["s","s"],3:["w","s","s"],4:["w","s","s","w"],5:["b","s","s","s","s"]}
                     : {1:["f"],2:["w","w"],3:["w","s","s"],4:["s","s","s","s"],5:["b","s","s","s","s"],6:["w","w","s","s","s","s"],7:["w","s","s","s","s","s","s"]};
  let k = 0;
  while(n - out.length >= block.length){ out.push(...block.map((c,i)=> i===0 && !phone && k%2 ? "b r" : c)); k++; }
  const r = n - out.length; if(r) out.push(...rest[r]);
  return out;
}
function renderGallery(list){
  galleryAll = list.filter(g => g.path && !/^[a-z]+:/i.test(g.path) && !g.path.includes(".."))
                   .map(g => ({ ...g, cat: galleryCategory(g) }));
  if(!galleryAll.length){ $("#gallery").classList.add("hidden"); return; }
  $("#gallery").classList.remove("hidden");
  const count = id => id==="all" ? galleryAll.length : galleryAll.filter(g => g.cat===id).length;
  const chips = [{id:"all",label:"All"}, ...GALLERY_CATEGORIES].filter(c => c.id==="all" || count(c.id));
  $("#gFilters").innerHTML = chips.map(c =>
    `<button class="g-chip${c.id===galleryFilter?" on":""}" role="tab" aria-selected="${c.id===galleryFilter}" data-f="${c.id}">${esc(c.label)} <span>${count(c.id)}</span></button>`).join("");
  drawGalleryGrid();
}
function drawGalleryGrid(){
  galleryList = galleryFilter==="all" ? galleryAll : galleryAll.filter(g => g.cat===galleryFilter);
  const shown = galleryExpanded ? galleryList : galleryList.slice(0, galleryPage());
  const sizes = gallerySizes(shown.length);
  const label = id => (GALLERY_CATEGORIES.find(c => c.id===id)||{}).label || "";
  $("#gGrid").innerHTML = shown.length ? shown.map((g,i)=>`
    <button class="g-item ${sizes[i]}" data-g="${i}" aria-label="View ${esc(g.caption||"photo")}">
      <img src="${esc(gallerySrc(g.path))}" alt="${esc(g.caption||"Feby's food")}" loading="lazy">
      <span class="g-tag">${esc(label(g.cat))}</span>
      <span class="g-zoom" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5M11 8v6M8 11h6"/></svg></span>
      ${g.caption?`<figcaption>${esc(g.caption)}<small>${esc(label(g.cat))}</small></figcaption>`:""}
    </button>`).join("") : `<p class="g-empty">More photos coming soon.</p>`;
  const more = $("#gMore"), hidden = galleryList.length - shown.length;
  more.classList.toggle("hidden", galleryExpanded ? galleryList.length <= galleryPage() : hidden <= 0);
  more.textContent = galleryExpanded ? "Show fewer" : `View all ${galleryList.length} photos`;
  const items = $("#gGrid").querySelectorAll(".g-item");
  if("IntersectionObserver" in window){
    const io = new IntersectionObserver(es => es.forEach(e => { if(e.isIntersecting){ const k = +e.target.dataset.g; setTimeout(()=>e.target.classList.add("in"), (k % galleryPage())*70); io.unobserve(e.target); } }), { rootMargin:"0px 0px -30px 0px" });
    items.forEach(el => io.observe(el));
  } else items.forEach(el => el.classList.add("in"));
  items.forEach(el => el.onclick = () => openLightbox(+el.dataset.g));
}
$("#gFilters").addEventListener("click", e => {
  const b = e.target.closest("[data-f]"); if(!b || b.dataset.f===galleryFilter) return;
  galleryFilter = b.dataset.f; galleryExpanded = false;
  document.querySelectorAll(".g-chip").forEach(c => { const on = c===b; c.classList.toggle("on", on); c.setAttribute("aria-selected", on); });
  drawGalleryGrid();
});
if(gPhone.addEventListener) gPhone.addEventListener("change", () => { if(galleryAll.length) drawGalleryGrid(); });
$("#gMore").onclick = () => {
  galleryExpanded = !galleryExpanded; drawGalleryGrid();
  if(!galleryExpanded) $("#gallery").scrollIntoView({behavior:"smooth"});
};
function showLb(){
  const g = galleryList[lbIndex], img = $("#lbImg");
  img.classList.add("swap");
  setTimeout(() => { img.src = gallerySrc(g.path); img.alt = g.caption||"Feby's food"; img.onload = () => img.classList.remove("swap"); }, 120);
  $("#lbCap").textContent = g.caption||"";
  $("#lbCount").textContent = `${lbIndex+1} / ${galleryList.length}`;
}
function openLightbox(i){ lbIndex = i; showLb(); $("#lightbox").classList.remove("hidden"); document.body.style.overflow="hidden"; $("#lbClose").focus(); }
function closeLightbox(){ $("#lightbox").classList.add("hidden"); document.body.style.overflow=""; }
function stepLb(d){ lbIndex = (lbIndex + d + galleryList.length) % galleryList.length; showLb(); }
$("#lbClose").onclick = closeLightbox;
$("#lbPrev").onclick = () => stepLb(-1);
$("#lbNext").onclick = () => stepLb(1);
$("#lightbox").addEventListener("click", e => { if(e.target.id==="lightbox") closeLightbox(); });
document.addEventListener("keydown", e => {
  if($("#lightbox").classList.contains("hidden")) return;
  if(e.key==="Escape") closeLightbox(); if(e.key==="ArrowRight") stepLb(1); if(e.key==="ArrowLeft") stepLb(-1);
});
let lbX = null;
$("#lightbox").addEventListener("touchstart", e => { lbX = e.touches[0].clientX; }, { passive:true });
$("#lightbox").addEventListener("touchend", e => { if(lbX==null) return; const dx = e.changedTouches[0].clientX - lbX; if(Math.abs(dx)>40) stepLb(dx<0?1:-1); lbX=null; });
(async function loadGallery(){
  try{
    const r = await fetch(`${SUPABASE_URL}/rest/v1/gallery?select=path,caption,category&active=eq.true&order=sort,id`, { headers:{ apikey:SUPABASE_KEY, "Accept-Profile":"febys" } });
    if(!r.ok) throw new Error(r.status);
    renderGallery(await r.json());
  }catch(e){ renderGallery(GALLERY_FALLBACK); }
})();

/* ---------- navigation: mobile menu, active section ---------- */
const burger = $("#burger"), navLinks = $("#navLinks");
burger.onclick = () => { const open = !navLinks.classList.contains("open"); navLinks.classList.toggle("open", open); burger.setAttribute("aria-expanded", open); };
navLinks.addEventListener("click", e => { if(e.target.closest("a")){ navLinks.classList.remove("open"); burger.setAttribute("aria-expanded", false); } });
if("IntersectionObserver" in window){
  const links = [...navLinks.querySelectorAll("a")];
  const ids = ["home","about","services","order","gallery","reviews","contact"], seen = new Set();
  const spy = new IntersectionObserver(es => {
    es.forEach(e => e.isIntersecting ? seen.add(e.target.id) : seen.delete(e.target.id));
    // the Menu block sits inside Services, so the later section in the list wins
    const cur = ids.filter(id => seen.has(id)).pop();
    if(cur) links.forEach(a => a.classList.toggle("on", a.getAttribute("href") === "#" + cur));
  }, { rootMargin:"-45% 0px -50% 0px" });
  ids.forEach(id => { const el = document.getElementById(id); if(el) spy.observe(el); });
}

/* ---------- gentle reveal on scroll ---------- */
(function(){
  const els = document.querySelectorAll(".reveal");
  if(!("IntersectionObserver" in window)) return;
  document.documentElement.classList.add("js");
  const io = new IntersectionObserver(es => es.forEach(e => { if(e.isIntersecting){ e.target.classList.add("in"); io.unobserve(e.target); } }), { rootMargin:"0px 0px -60px 0px" });
  els.forEach(el => io.observe(el));
})();

/* ---------- catering inquiry → WhatsApp ---------- */
(function(){
  const f = $("#planForm"); if(!f) return;
  const min = new Date(Date.now()+86400000).toISOString().slice(0,10);
  $("#planDate").min = min;
  f.addEventListener("submit", e => {
    e.preventDefault();
    let ok = true;
    f.querySelectorAll("[required]").forEach(el => { const bad = !el.value.trim() || !el.checkValidity(); el.classList.toggle("bad", bad); if(bad) ok = false; });
    if(!ok){ toast("Please complete the highlighted fields"); return; }
    const d = Object.fromEntries(new FormData(f));
    const msg = [
      `*CATERING INQUIRY · FEBY'S*`,
      `━━━━━━━━━━━━━━━`,
      `*Name:* ${d.name.trim()}`,
      d.company.trim() ? `*Company:* ${d.company.trim()}` : "",
      `*Event:* ${d.type}`,
      `*Guests:* ${d.guests}`,
      `*Date:* ${prettyDate(d.date, "12:00").split(" · ")[0]}`,
      `*Service:* ${d.service}`,
      d.notes.trim() ? `*Notes:* ${d.notes.trim()}` : "",
      `━━━━━━━━━━━━━━━`,
      `Looking forward to your proposal. Salamat po!`
    ].filter(Boolean).join("\n");
    window.open(`https://api.whatsapp.com/send?phone=${WHATSAPP}&text=${encodeURIComponent(msg)}`, "_blank");
    toast("Opening WhatsApp…");
  });
})();

}
