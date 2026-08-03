/* Shared JavaScript for the Plant Template site
   - Loads data.json when body[data-data-path] is set
   - Renders plant content, map, QR, and interactive UI
*/

document.addEventListener('DOMContentLoaded', () => {
  const dataPath = document.body.dataset.dataPath;
  if (!dataPath) return; // main landing doesn't need JS

  const state = { lang: 'en', data: null };

  async function loadData() {
    try {
      const res = await fetch(dataPath);
      if (!res.ok) throw new Error('Failed to load data.json');
      state.data = await res.json();
      render();
    } catch (err) {
      document.body.innerHTML = `<div class="container"><p>Unable to load plant data: ${err.message}</p></div>`;
      console.error(err);
    }
  }

  function render() {
    const d = state.data;
    document.title = d.name[state.lang] + ' — Plant';

    const root = document.createElement('div');
    root.className = 'container';

    // hero and right panel
    const hero = document.createElement('div');
    hero.className = 'plant-hero';

    const left = document.createElement('div');
    const right = document.createElement('aside');
    right.style.width = '100%';

    // Left: details
    const heroPanel = document.createElement('div');
    heroPanel.className = 'panel';
    heroPanel.innerHTML = `
      <h1>${escapeHtml(d.name[state.lang])}</h1>
      <p class="muted"><strong>Scientific:</strong> ${escapeHtml(d.scientific_name)} • <strong>Family:</strong> ${escapeHtml(d.family[state.lang])}</p>
      <div>
        <img id="plant-main-image" src="${escapeHtml(d.image)}" alt="${escapeHtml(d.name[state.lang])}" class="card-image" style="max-width:420px;cursor:pointer;border-radius:8px">
      </div>
      <div class="section" id="sections"></div>
    `;

    left.appendChild(heroPanel);

    // Right: controls, map, QR
    const controlPanel = document.createElement('div');
    controlPanel.className = 'panel';
    controlPanel.innerHTML = `
      <div class="lang-toggle">
        <button id="lang-en" class="small">English</button>
        <button id="lang-hi" class="small">हिन्दी</button>
      </div>
      <div class="section">
        <h3>Location</h3>
        <p class="muted">${escapeHtml(d.location[state.lang] || '')}</p>
        <div id="map" style="width:100%;height:180px;border-radius:8px;overflow:hidden;background:#eee"></div>
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
    `;

    right.appendChild(controlPanel);

    hero.appendChild(left);
    hero.appendChild(right);

    root.appendChild(hero);

    // Append root into body
    document.body.innerHTML = '';
    document.body.appendChild(root);

    // Render sections
    const sectionsEl = document.getElementById('sections');
    for (const [key, val] of Object.entries(d.sections || {})) {
      const el = document.createElement('details');
      el.className = 'collapsible';
      el.innerHTML = `<summary><strong>${escapeHtml(key.replace(/_/g,' '))}</strong></summary><div class="content" style="padding:10px">${escapeHtml(val[state.lang])}</div>`;
      sectionsEl.appendChild(el);
    }

    // Image modal
    const img = document.getElementById('plant-main-image');
    img.addEventListener('click', () => openModal(d.image, d.name[state.lang]));

    // Language buttons
    document.getElementById('lang-en').addEventListener('click', () => { state.lang='en'; loadData(); });
    document.getElementById('lang-hi').addEventListener('click', () => { state.lang='hi'; loadData(); });

    // Map embed
    const mapEl = document.getElementById('map');
    mapEl.innerHTML = `<iframe src="https://maps.google.com/maps?q=${encodeURIComponent(d.location.lat)},${encodeURIComponent(d.location.lng)}&z=${encodeURIComponent(d.location.zoom)}&output=embed" style="width:100%;height:100%;border:0"></iframe>`;

    // QR code generation using qrcodejs (loaded from CDN in HTML)
    const qrContainer = document.getElementById('qr');
    qrContainer.innerHTML = '';
    const qr = new QRCode(qrContainer, {text: location.href, width:160, height:160,colorDark:'#000000',colorLight:'#ffffff'});

    // Download QR by drawing to canvas
    setTimeout(()=>{
      try{
        const imgTag = qrContainer.querySelector('img');
        if (imgTag) {
          document.getElementById('download-qr').href = imgTag.src;
          document.getElementById('download-qr').download = (d.name[state.lang] || 'plant') + '-qr.png';
        }
      }catch(e){/*ignore*/}
    },300);

    // copy/link and share
    document.getElementById('copy-link').addEventListener('click', async ()=>{
      try{ await navigator.clipboard.writeText(location.href); alert('Copied page URL to clipboard'); }catch(e){ prompt('Copy this URL', location.href); }
    });

    document.getElementById('native-share').addEventListener('click', async ()=>{
      if (navigator.share) {
        try{ await navigator.share({title: d.name[state.lang], text: d.scientific_name, url: location.href}); } catch(e){}
      } else { alert('Sharing not supported in this browser. Use copy link or QR.'); }
    });

    // Image modal definition
    function openModal(src, alt){
      const modal = document.createElement('div'); modal.className='modal open';
      modal.innerHTML = `<div class="modal-inner"><img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}"><p style="text-align:right;margin:8px 0 0"><button class='btn' id='closeModal'>Close</button></p></div>`;
      document.body.appendChild(modal);
      modal.querySelector('#closeModal').addEventListener('click',()=>{ modal.remove(); });
      modal.addEventListener('click',(e)=>{ if(e.target===modal) modal.remove(); });
    }
  }

  // Utils: escape plain text into safe HTML
  function escapeHtml(str){ if(str==null) return ''; return String(str).replace(/[&"'<>]/g, function(s){return {'&':'&amp;','"':'&quot;',"'":'&#39;','<':'&lt;','>':'&gt;'}[s];}); }

  loadData();
});
