/* ============================================================
   MENU DATA — managed in admin.html (stored in Supabase).
   The list below is only a fallback, shown if the live menu
   can't be loaded (e.g. no internet).
   ============================================================ */
const SUPABASE_URL = "https://ntohdxudxfggsmhxhvho.supabase.co";
const SUPABASE_KEY = "sb_publishable_81P5_TSD4SuHALFDM4Ao-w_W7C5UkuI";
let WHATSAPP = "971563267346";
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
    $("#dBody").innerHTML = `<div class="empty"><img class="mark" src="logo.jpg" alt=""><p>Your order is empty.<br>Add something delicious from the menu.</p></div>`;
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
  ["cp/grazing.jpg","Event grazing table"],["Combo1/Combo1.jpg","Holiday Combo 1"],["cp/halo-halo.jpg","Halo-Halo"],
  ["Combo2/Lechon Roll.jpg","Lechon Belly Roll"],["cp/yema-cake.jpg","Yema Cheezycake"],["cp/chafing.jpg","Buffet catering"],
  ["Combo3/HalfTray_Karekare.jpg","Kare-Kare"],["cp/lasagna.jpg","Lasagna"],["cp/cheese-bread.jpg","Cheese garlic bread"],
  ["Combo1/Crispy Pata.jpg","Crispy Pata"],["cp/milk-tea.jpg","Milk tea"],["Combo3/Sisig.jpg","Sisig"]
].map(([path,caption])=>({path,caption}));
let galleryList = [], lbIndex = 0;
function renderGallery(list){
  galleryList = list.filter(g => g.path && !/^[a-z]+:/i.test(g.path) && !g.path.includes(".."));
  if(!galleryList.length){ $("#gallery").classList.add("hidden"); return; }
  const MAX = 12, extra = galleryList.length - MAX;
  $("#gGrid").innerHTML = galleryList.slice(0, MAX).map((g,i)=>`
    <button class="g-item" data-g="${i}" aria-label="View ${esc(g.caption||"photo")}">
      <img src="${esc(encodeURI(g.path))}" alt="${esc(g.caption||"Febys food")}" loading="lazy">
      ${extra>0 && i===MAX-1 ? `<span class="g-more">+${extra}</span>` : (g.caption?`<figcaption>${esc(g.caption)}</figcaption>`:"")}
    </button>`).join("");
  $("#gallery").classList.remove("hidden");
  const items = document.querySelectorAll(".g-item");
  if("IntersectionObserver" in window){
    const io = new IntersectionObserver(es => es.forEach((e,k) => { if(e.isIntersecting){ setTimeout(()=>e.target.classList.add("in"), (k%4)*90); io.unobserve(e.target); } }), { rootMargin:"0px 0px -40px 0px" });
    items.forEach(el => io.observe(el));
  } else items.forEach(el => el.classList.add("in"));
  items.forEach(el => el.onclick = () => openLightbox(+el.dataset.g));
}
function showLb(){ const g = galleryList[lbIndex]; $("#lbImg").src = encodeURI(g.path); $("#lbImg").alt = g.caption||"Febys food"; $("#lbCap").textContent = g.caption||""; }
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
    const r = await fetch(`${SUPABASE_URL}/rest/v1/gallery?select=path,caption&active=eq.true&order=sort,id`, { headers:{ apikey:SUPABASE_KEY, "Accept-Profile":"febys" } });
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
  const spy = new IntersectionObserver(es => es.forEach(e => {
    if(e.isIntersecting) links.forEach(a => a.classList.toggle("on", a.getAttribute("href") === "#" + e.target.id));
  }), { rootMargin:"-45% 0px -50% 0px" });
  ["home","about","services","gallery","reviews","contact"].forEach(id => { const el = document.getElementById(id); if(el) spy.observe(el); });
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
