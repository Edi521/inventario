

    //API
    const API = "https://script.googleusercontent.com/macros/echo?user_content_key=AY5xjrTT4ujRHHDefnqc9Y26vdFHxQR4f8SOn0VMh6jhPJjzXHcOJbYFQWGoxIRp3RPoa4ELEA2r3rieMcqoIkN4qJbt1s8xS5ovdO5fWQi7qRqs3JpkAdbVhHbSPWNNsBdpaCaLCMm6p2qZ_fs1afVxOfyWDfFlZ5j02tXOS7Bi3zWDvmL2--5zOPC7BA8Xp-UbqebPEmLs4SXh0WfRi1HIctN2y6rl3SJ1gPCNe0TEqjWz1eiD2PYhK5xWzlD_uhgls7mYuJf6knb1lXmcAxi0cf0Q4hoYUA&lib=MjXtp5UVmE8ZqiL6ikFuBvPYkqy2-7K9Q";

    //Formateo de moneda
    const moneyFmt = new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        useGrouping: true
    });

    function formatMoney(n, symbol = '$'){
        return `${symbol}${moneyFmt.format(Number(n || 0))}`;
    }

function driveToDirectImage(url){
  if(!url) return "";
  const u = String(url).trim();

  // Saca el ID de distintas variantes de URL
  const id =
    u.match(/drive\.google\.com\/file\/d\/([^/]+)/)?.[1] ||
    u.match(/[?&]id=([^&]+)/)?.[1] ||
    u.match(/lh3\.googleusercontent\.com\/d\/([^=/?]+)/)?.[1];

  if (!id) return u;

  // ✅ ESTA es la que mejor funciona en <img>
  return `https://drive.google.com/thumbnail?id=${id}&sz=w1200`;
}

    function toNumber(v, def = 0) {
        // soporta "12", 12, "12.50", "$12.50"
        const cleaned = String(v ?? "").replace(/[^\d.-]/g, "");
        const n = Number(cleaned);
        return Number.isFinite(n) ? n : def;
    }

    function normalizeApiProduct(raw, index){
        //IMAGEN puede venir como:
        // string "https://..."
        // object {url: "..."}
        // {} (vacío)

        const image_url = driveToDirectImage(raw.IMAGEN);
        //console.log("IMAGEN RAW:", raw.IMAGEN);
        //console.log("IMAGEN FINAL:", image_url);

        const category = String(raw.CATEGORIA ?? "").trim();
        const title = String(raw.PRODUCTO ?? "Sin título").trim();

        //Como la hoja no trae ID, hacemos uno estable (si hay duplicados se distingue por index)
        const baseID = `${category}__${title}`.toLowerCase().replace(/\s+/g, "_");
        const id = `${baseID}__${index}`;

        return{
            __backendId: id,
            title,
            image_url,
            stock: toNumber(raw.INVENTARIO, 0.0),
            price: toNumber(raw.PRECIO, 0.0),
            category
        };
    }

async function fetchProductsFromApi() {
    const res = await fetch(API,{
        method: "GET",
        headers: {"Accept": "application/json"},
        cache: "no-store" // evita cache raro en Apps Script
    });

    if(!res.ok){
        const txt = await res.text().catch(() => "");
        throw new Error(`GET ${API} -> ${res.status}. ${txt}`);
    }

    // OJO: algunas implementaciones devuelven texto JSON (string),
    // esto lo maneja por si acaso.
    let data = await res.json().catch(async () => {
        const t = await res.text();
        return JSON.parse(t);
    });

    if (!Array.isArray(data)) {
        throw new Error("La API no devolvió un arreglo JSON ([])");
    }

    return data.map((row, i) => normalizeApiProduct(row, i));
}

    // ============================
    // Config (igual que tu versión)
    // ============================
    const defaultConfig = {
      page_title: 'Control de Stock',
      currency_symbol: '$',
      background_color: '#f8fafc',
      card_color: '#ffffff',
      text_color: '#1e293b',
      primary_color: '#6366f1',
      secondary_color: '#64748b',
      font_family: 'Outfit',
      font_size: 16
    };

    // ============================
    // State
    // ============================
    let products = [];
    let editingProduct = null;
    let deletingProduct = null;
    let currentRecordCount = 0;

    // ============================
    // DOM
    // ============================
    const el = {
      pageTitle: document.getElementById('pageTitle'),
      addBtn: document.getElementById('addBtn'),
      totalProducts: document.getElementById('totalProducts'),
      lowStock: document.getElementById('lowStock'),
      totalValue: document.getElementById('totalValue'),
      emptyState: document.getElementById('emptyState'),
      productsRow: document.getElementById('productsRow'),
      limitWarning: document.getElementById('limitWarning'),

      productModalEl: document.getElementById('productModal'),
      deleteModalEl: document.getElementById('deleteModal'),
      modalTitle: document.getElementById('modalTitle'),
      productForm: document.getElementById('productForm'),
      inputTitle: document.getElementById('inputTitle'),
      inputImage: document.getElementById('inputImage'),
      inputStock: document.getElementById('inputStock'),
      inputPrice: document.getElementById('inputPrice'),
      submitBtn: document.getElementById('submitBtn'),
      confirmDeleteBtn: document.getElementById('confirmDeleteBtn'),

      loadingOverlay: document.getElementById('loadingOverlay')
    };

    const productModal = new bootstrap.Modal(el.productModalEl);
    const deleteModal  = new bootstrap.Modal(el.deleteModalEl);

    function setLoading(show){
      el.loadingOverlay.style.display = show ? 'flex' : 'none';
    }

    function getConfig(){
      return (window.elementSdk?.config ? { ...defaultConfig, ...window.elementSdk.config } : defaultConfig);
    }

    function applyConfigToTheme(cfg){
      document.documentElement.style.setProperty('--bg', cfg.background_color);
      document.documentElement.style.setProperty('--card', cfg.card_color);
      document.documentElement.style.setProperty('--text', cfg.text_color);
      document.documentElement.style.setProperty('--primary', cfg.primary_color);
      document.documentElement.style.setProperty('--secondary', cfg.secondary_color);
      document.body.style.fontFamily = `${cfg.font_family}, Outfit, sans-serif`;
      document.body.style.fontSize = (cfg.font_size || 16) + 'px';
      el.pageTitle.textContent = cfg.page_title || defaultConfig.page_title;
    }

    // ============================
    // Stats
    // ============================
    function updateStats(){
      const cfg = getConfig();
      const total = products.length;
      const lowCount = products.filter(p => (p.stock ?? 0) <= 5).length;
      const totalVal = products.reduce((sum, p) => sum + ((p.stock ?? 0) * (p.price ?? 0)), 0);

      el.totalProducts.textContent = total;
      el.lowStock.textContent = lowCount;
      el.totalValue.textContent = formatMoney(totalVal, cfg.currency_symbol || '$');
    }

    // ============================
    // Card builder
    // ============================
    function stockMeta(stock){
      if (stock === 0) return { color: 'var(--danger)', text: 'Sin stock', pulse: true };
      if (stock <= 5) return { color: 'var(--warning)', text: 'Stock bajo', pulse: true };
      return { color: 'var(--success)', text: 'En stock', pulse: false };
    }

    function createProductCol(product){
      const cfg = getConfig();
      const currency = cfg.currency_symbol || '$';

      const col = document.createElement('div');
      col.className = 'col';
      col.dataset.id = product.__backendId;

      const s = stockMeta(product.stock ?? 0);

      const imgHtml = product.image_url
        ? `
          <img src="${product.image_url}"
     alt="${escapeHtml(product.title)}"
     class="w-100 h-100 object-fit-cover"
     loading="lazy"
     referrerpolicy="no-referrer"
     onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
          <div class="img-fallback ratio-1x1 w-100 h-100" style="display:none;">
            ${fallbackIcon()}
          </div>
        `
        : `
          <div class="img-fallback ratio-1x1 w-100 h-100">
            ${fallbackIcon()}
          </div>
        `;

      col.innerHTML = `
        <div class="product-card">
          <div class="position-relative ratio-1x1">
            ${imgHtml}
            <span class="stock-badge badge ${s.pulse ? 'pulse' : ''} position-absolute top-0 end-0 m-3"
                  style="background:${s.color}; font-weight:600; padding:.4rem .6rem; border-radius:999px;">
              ${s.text}
            </span>
          </div>

          <div class="p-3">
            <div class="d-flex align-items-start justify-content-between gap-2">
              <h3 class="h6 fw-semibold mb-2 text-truncate" style="max-width: 70%;">
                ${escapeHtml(product.title)}
              </h3>
              <span class="small fw-medium px-2 py-1 rounded"
                    style="background:var(--muted-bg); color:var(--secondary);">
                ${(product.stock ?? 0)} uds
              </span>
            </div>

            <div class="d-flex align-items-center justify-content-between mb-3">
              <span class="h5 m-0 fw-bold" style="color:var(--primary);">
                ${formatMoney(product.price, currency)}
              </span>
            </div>

            <div class="d-flex gap-2">
              <button class="btn btn-sm flex-fill fw-medium rounded-xl bg-muted-soft text-secondary-soft d-flex align-items-center justify-content-center gap-2 edit-btn" type="button">
                ${editIcon()}
                Editar
              </button>
              <button class="btn btn-sm fw-medium rounded-xl d-flex align-items-center justify-content-center delete-btn"
                      type="button"
                      style="background:#fef2f2; color:var(--danger); border:none; width:44px;">
                ${trashIcon()}
              </button>
            </div>
          </div>
        </div>
      `;

      col.querySelector('.edit-btn').addEventListener('click', () => openEditModal(product));
      col.querySelector('.delete-btn').addEventListener('click', () => openDeleteModal(product));
      return col;
    }

    function renderProducts(){
      const existing = new Map([...el.productsRow.children].map(x => [x.dataset.id, x]));

      products.forEach(p => {
        const newNode = createProductCol(p);
        if (existing.has(p.__backendId)){
          existing.get(p.__backendId).replaceWith(newNode);
          existing.delete(p.__backendId);
        } else {
          el.productsRow.appendChild(newNode);
        }
      });

      existing.forEach(node => node.remove());

      const hasAny = products.length > 0;
      el.emptyState.classList.toggle('d-none', hasAny);
      el.productsRow.classList.toggle('d-none', !hasAny);

      el.limitWarning.classList.toggle('d-none', currentRecordCount < 999);

      updateStats();
    }

    // ============================
    // Modals (Bootstrap)
    // ============================
    function openAddModal(){
      if (currentRecordCount >= 999){
        el.limitWarning.classList.remove('d-none');
        return;
      }
      editingProduct = null;
      el.modalTitle.textContent = 'Nuevo Producto';
      el.productForm.reset();
      productModal.show();
    }

    function openEditModal(product){
      editingProduct = product;
      el.modalTitle.textContent = 'Editar Producto';
      el.inputTitle.value = product.title ?? '';
      el.inputImage.value = product.image_url ?? '';
      el.inputStock.value = product.stock ?? 0;
      el.inputPrice.value = product.price ?? 0;
      productModal.show();
    }

    function openDeleteModal(product){
      deletingProduct = product;
      deleteModal.show();
    }

    // ============================
    // Data layer:
    // - Si existe window.dataSdk => usa create/update/delete
    // - Si NO existe => fallback localStorage
    // ============================
    const LS_KEY = 'stock_products_v1';

    function lsLoad(){
      try{
        const raw = localStorage.getItem(LS_KEY);
        return raw ? JSON.parse(raw) : [];
      }catch{ return []; }
    }

    function lsSave(list){
      localStorage.setItem(LS_KEY, JSON.stringify(list));
    }

    function ensureBackendIds(list){
      return list.map(p => ({
        __backendId: p.__backendId || crypto.randomUUID(),
        title: p.title || '',
        image_url: p.image_url || '',
        stock: Number(p.stock || 0),
        price: Number(p.price || 0),
        created_at: p.created_at || new Date().toISOString()
      }));
    }

    const localDataSdk = {
      async init(handler){
        const data = ensureBackendIds(lsLoad());
        handler.onDataChanged(data);
        return { isOk: true };
      },
      async create(product){
        const data = ensureBackendIds(lsLoad());
        const created = { ...product, __backendId: crypto.randomUUID() };
        data.push(created);
        lsSave(data);
        dataHandler.onDataChanged(data);
        return { isOk: true, value: created };
      },
      async update(product){
        const data = ensureBackendIds(lsLoad());
        const idx = data.findIndex(x => x.__backendId === product.__backendId);
        if (idx >= 0) data[idx] = { ...data[idx], ...product };
        lsSave(data);
        dataHandler.onDataChanged(data);
        return { isOk: true };
      },
      async delete(product){
        let data = ensureBackendIds(lsLoad());
        data = data.filter(x => x.__backendId !== product.__backendId);
        lsSave(data);
        dataHandler.onDataChanged(data);
        return { isOk: true };
      }
    };

    // ============================
    // Handlers
    // ============================
    const dataHandler = {
      onDataChanged(data){
        products = ensureBackendIds(data);
        currentRecordCount = products.length;
        renderProducts();
      }
    };

    async function onConfigChange(config){
      const cfg = { ...defaultConfig, ...config };
      applyConfigToTheme(cfg);
      renderProducts();
    }

    // ============================
    // Submit / Delete
    // ============================
    async function handleSubmit(e){
      e.preventDefault();

      const productData = {
        title: el.inputTitle.value.trim(),
        image_url: el.inputImage.value.trim() || '',
        stock: parseInt(el.inputStock.value, 10) || 0,
        price: parseFloat(el.inputPrice.value) || 0,
        created_at: editingProduct ? editingProduct.created_at : new Date().toISOString()
      };

      el.submitBtn.disabled = true;
      el.submitBtn.textContent = 'Guardando...';

      const sdk = window.dataSdk || localDataSdk;
      let result;
      if (editingProduct){
        result = await sdk.update({ ...editingProduct, ...productData });
      } else {
        result = await sdk.create(productData);
      }

      el.submitBtn.disabled = false;
      el.submitBtn.textContent = 'Guardar';

      if (result?.isOk){
        productModal.hide();
        editingProduct = null;
      } else {
        console.error('Error saving product:', result?.error || result);
      }
    }

    async function handleDelete(){
      if (!deletingProduct) return;

      el.confirmDeleteBtn.disabled = true;
      el.confirmDeleteBtn.textContent = 'Eliminando...';

      const sdk = window.dataSdk || localDataSdk;
      const result = await sdk.delete(deletingProduct);

      el.confirmDeleteBtn.disabled = false;
      el.confirmDeleteBtn.textContent = 'Eliminar';

      if (result?.isOk){
        deleteModal.hide();
        deletingProduct = null;
      } else {
        console.error('Error deleting product:', result?.error || result);
      }
    }

    // ============================
    // Init
    // ============================
    async function init(){
      setLoading(true);

      try{
        applyConfigToTheme(getConfig());

        // ✅ Cargar desde Google Sheets (GET)
        const apiProducts = await fetchProductsFromApi();
        dataHandler.onDataChanged(apiProducts);
      }catch(err){
        console.error("Error cargando productos:", err);
        dataHandler.onDataChanged([]); // muestra vacío si falla
      }finally{
        setLoading(false);
      }

    }

    // ============================
    // Events
    // ============================
    el.addBtn.addEventListener('click', openAddModal);
    el.productForm.addEventListener('submit', handleSubmit);
    el.confirmDeleteBtn.addEventListener('click', handleDelete);

    // ============================
    // Utils
    // ============================
    function escapeHtml(str){
      return String(str ?? '').replace(/[&<>"']/g, s => ({
        '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
      }[s]));
    }

    function fallbackIcon(){
      return `
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="1">
          <path stroke-linecap="round" stroke-linejoin="round"
            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
        </svg>
      `;
    }

    function editIcon(){
      return `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round"
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
        </svg>
      `;
    }

    function trashIcon(){
      return `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round"
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
        </svg>
      `;
    }

    // Go!
    init();
  