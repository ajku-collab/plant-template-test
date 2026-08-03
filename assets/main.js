/* Enhanced JS: handles both homepage (plants manifest) and plant pages (dataPath)
   - Adds dark mode, search, interactive maps (Leaflet + OSM), improved accessibility
*/

document.addEventListener('DOMContentLoaded', () => {
  const dataPath = document.body.dataset.dataPath; // undefined on index

  // Theme handling
  const themeToggle = document.getElementById('themeToggle');
  const saved = localStorage.getItem('theme');
  if (saved === 'dark') document.body.classList.add('dark');
  if (themeToggle) {
    themeToggle.checked = document.body.classList.contains('dark');
    themeToggle.addEventListener('change', (e)=>{
      document.body.classList.toggle('dark', e.target.checked);
      localStorage.setItem('theme', e.target.checked ? 'dark' : 'light');
    });
  }

  if (!dataPath) {
    // render index by fetching plants.json manifest
    renderIndex();
    return;
  }

  // else render a plant page
  renderPlant(dataPath);

  // ---------- Index ----------
  async function renderIndex(){
    const plantsContainer = document.getElementById('plants');
    const searchInput = document.getElementById('search');
    try{
      const res = await fetch('plants.json');
      const plants = (res.ok) ? await res.json() : [{"path":"test-plant/","name":"Test Plant","image":"test-plant/image.jpg","scientific":"Planta experimentalis","family":"Testaceae"}];

      function makeCard(p){
        const a = document.createElement('article'); a.className = 'card';
        a.innerHTML = `
          <img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" class="card-image">
          <div class="card-body">
            <h2>${escapeHtml(p.name)}</h2>
            <p class="muted">${escapeHtml(p.scientific || '')} — ${escapeHtml(p.family || '')}</p>
            <p><a class="btn" href="${p.path}">Open plant page</a> <a class="btn ghost" href="${p.path}data.json" target="_blank">View data</a></p>
          </div>
        `;
        return a;
      }

      function show(list){
        plantsContainer.innerHTML='';
        if (list.length===0) plantsContainer.innerHTML = '<p class="muted">No plants match your search.</p>';
        list.forEach(p=>plantsContainer.appendChild(makeCard(p)));
      }

      show(plants);

      searchInput.addEventListener('input', ()=>{
        const q = searchInput.value.trim().toLowerCase();
        if (!q) return show(plants);
        const filtered = plants.filter(p=> (p.name||'').toLowerCase().includes(q) || (p.scientific||'').toLowerCase().includes(q) || (p.family||'').toLowerCase().includes(q));
        show(filtered);
      });

    }catch(err){
      plantsContainer.innerHTML = '<p class="muted">Failed to load plants manifest.</p>';
      console.error(err);
    }
  }

  // ---------- Plant ----------
  async function renderPlant(path){
    try{
      const res = await fetch(path);
      if (!res.ok) throw new Error('Failed to load plant page');
      // We expect the actual entry to set dataPath to data.json (in our test-plant it's 'data.json' relative to this path)
      // But caller passed dataPath already (body.dataset.dataPath). In our test-plant/index.html we set it to 'data.json'.
      const dataRes = await fetch(path + (path.endsWith('/') ? '' : '/') + document.body.dataset.dataPath);
      const d = await dataRes.json();
      buildPlantUI(d);
    }catch(err){
      document.body.innerHTML = `<div class="container"><p>Unable to load plant data: ${err.message}</p></div>`;
      console.error(err);
    }
  }

  function buildPlantUI(d){
    const root = document.createElement('div'); root.className='container';

    const hero = document.createElement('div'); hero.className='plant-hero';
    const left = document.createElement('div');
    const right = document.createElement('aside'); right.style.width='100%';

    left.innerHTML = `
      <div class="panel">
        <h1>${escapeHtml(d.name.en || '')}</h1>
        <p class="muted"><strong>Scientific:</strong> ${escapeHtml(d.scientific_name || '')} • <strong>Family:</strong> ${escapeHtml((d.family && d.family.en) || '')}</p>
        <div><img id="plant-main-image" src="${escapeHtml(d.image)}" alt="${escapeHtml(d.name.en || '')}" class="card-image" style="max-width:540px;cursor:pointer;border-radius:10px"></div>
        <div id="sections" class="section"></div>
      </div>
    `;

    right.innerHTML = `
      <div class="panel">
        <div class="lang-toggle">
          <button id="lang-en" class="small">English</button>
          <button id="lang-hi" class="small">हिन्दी</button>
        </div>
        <div class="section">
          <h3>Location</h3>
          <p class="muted">${escapeHtml((d.location && d.location.en) || '')}</p>
          <div id="map" style="width:100%;height:220px;border-radius:8px;overflow:hidden;background:#eef"></div>
        </div>
        <div class="section">
          <h3>Share</h3>
          <div class="controls">
            <button id="copy-link" class="icon-btn small">Copy link</button>
            <button id="native-share" class="icon-btn small">Share</button>
          </div>
          <div class="qr-wrap section">
            <div id="qr"></div>
            <a id="download-qr" class="btn" href="#">Download QR</a>
          </div>
        </div>
      </div>
    `;

    hero.appendChild(left); hero.appendChild(right); root.appendChild(hero);
    document.body.innerHTML=''; document.body.appendChild(root);

    // sections
    const sectionsEl = document.getElementById('sections');
    for (const [key, value] of Object.entries(d.sections || {})){
      const el = document.createElement('details'); el.className='collapsible';
      el.innerHTML = `<summary><strong>${escapeHtml(key.replace(/_/g,' '))}</strong></summary><div class="content" style="padding:10px">${escapeHtml(value.en || '')}</div>`;
      sectionsEl.appendChild(el);
    }

    // image modal
    const img = document.getElementById('plant-main-image');
    img.addEventListener('click', ()=> openModal(d.image, d.name.en || ''));

    // lang toggle
    document.getElementById('lang-en').addEventListener('click', ()=> switchLang('en'));
    document.getElementById('lang-hi').addEventListener('click', ()=> switchLang('hi'));

    function switchLang(lang){
      // update text nodes
      document.querySelector('h1').textContent = d.name[lang] || d.name.en;
      document.querySelector('.muted').innerHTML = `<strong>Scientific:</strong> ${escapeHtml(d.scientific_name || '')} • <strong>Family:</strong> ${escapeHtml((d.family && d.family[lang]) || '')}`;
      const sectionNodes = Array.from(document.querySelectorAll('.collapsible'));
      sectionNodes.forEach((node, idx)=>{
        const key = Object.keys(d.sections)[idx];
        node.querySelector('.content').textContent = d.sections[key][lang] || d.sections[key].en;
      });
    }

    // map: use Leaflet + OSM for interactive map
    loadLeaflet().then(()=>{
      try{
        const lat = d.location.lat, lng = d.location.lng, zoom = d.location.zoom || 13;
        const map = L.map('map', {attributionControl:false}).setView([lat,lng], zoom);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom:19}).addTo(map);
        L.marker([lat,lng]).addTo(map);
      }catch(e){ console.warn('Leaflet init failed', e); }
    });

    // QR generation
    try{
      const qrContainer = document.getElementById('qr'); qrContainer.innerHTML='';
      const qr = new QRCode(qrContainer, {text: location.href, width:180, height:180,colorDark:'#000',colorLight:'#fff'});
      setTimeout(()=>{
        const imgTag = qrContainer.querySelector('img');
        if (imgTag){ document.getElementById('download-qr').href = imgTag.src; document.getElementById('download-qr').download = (d.name.en || 'plant') + '-qr.png'; }
      },300);
    }catch(e){console.warn(e)}

    // copy/share
    document.getElementById('copy-link').addEventListener('click', async ()=>{ try{ await navigator.clipboard.writeText(location.href); alert('Copied page URL to clipboard'); }catch(e){ prompt('Copy URL', location.href); } });
    document.getElementById('native-share').addEventListener('click', async ()=>{ if (navigator.share){ try{ await navigator.share({title:d.name.en, text:d.scientific_name, url:location.href}); }catch(e){} } else alert('Sharing not supported'); });

    // add JSON-LD structured data for SEO
    addJsonLd(d);
  }

  // load Leaflet only when needed
  function loadLeaflet(){
    return new Promise((resolve,reject)=>{
      if (window.L) return resolve(window.L);
      const css = document.createElement('link'); css.rel='stylesheet'; css.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(css);
      const s = document.createElement('script'); s.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'; s.onload = ()=> resolve(window.L); s.onerror = reject; document.body.appendChild(s);
    });
  }

  function openModal(src, alt){
    const modal = document.createElement('div'); modal.className='modal open';
    modal.innerHTML = `<div class="modal-inner"><img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}"><p style="text-align:right;margin:8px 0 0"><button class='btn' id='closeModal'>Close</button></p></div>`;
    document.body.appendChild(modal);
    modal.querySelector('#closeModal').addEventListener('click', ()=> modal.remove());
    modal.addEventListener('click',(e)=>{ if(e.target===modal) modal.remove(); });
    // close on esc
    function onKey(e){ if (e.key==='Escape'){ modal.remove(); document.removeEventListener('keydown', onKey); } }
    document.addEventListener('keydown', onKey);
  }

  function addJsonLd(d){
    const ld = {
      "@context": "https://schema.org",
      "@type": "Taxon",
      "name": d.name.en || '',
      "alternateName": d.name.hi || '',
      "description": Object.values(d.sections || {}).map(s=>s.en).join('\n\n'),
      "image": d.image || ''
    };
    const s = document.createElement('script'); s.type='application/ld+json'; s.textContent = JSON.stringify(ld); document.head.appendChild(s);
  }

  // Helpers
  function escapeHtml(str){ if (str==null) return ''; return String(str).replace(/[&"'<>]/g, function(s){return {'&':'&amp;','"':'&quot;',"'":'&#39;','<':'&lt;','>':'&gt;'}[s];}); }

});
