import { escapeHtml, formatMoney } from './format.js';

export function setLoading(el, show){
  el.loadingOverlay.style.display = show ? 'flex' : 'none';
}

//Funcion para definir colores segun el numero de stock
function stockMeta(stock){
  if (stock === 0) return { color: 'var(--danger)', text: 'Sin stock', pulse: true };
  if (stock <= 5) return { color: 'var(--warning)', text: 'Stock bajo', pulse: true };
  return { color: 'var(--success)', text: 'En stock', pulse: false };
}

function fallbackIcon(){
  return `
    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="1">
      <path stroke-linecap="round" stroke-linejoin="round"
        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
    </svg>`;
}

export function renderStats(el, stats, currencySymbol){
  el.totalProducts.textContent = stats.total;
  el.lowStock.textContent = stats.lowCount;
  el.totalValue.textContent = formatMoney(stats.totalVal, currencySymbol);
}

export function renderProducts(el, products, currencySymbol, onEdit, onAddStock, onSubStock, onDelete){
  el.productsRow.innerHTML = "";

  const hasAny = products.length > 0;
  el.emptyState.classList.toggle('d-none', hasAny);
  el.productsRow.classList.toggle('d-none', !hasAny);

  products.forEach(p => {
    const s = stockMeta(p.stock ?? 0);

    const imgHtml = p.image_url
      ? `
        <img src="${p.image_url}"
             alt="${escapeHtml(p.title)}"
             class="w-100 h-100 object-fit-cover"
             loading="lazy"
             referrerpolicy="no-referrer"
             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
        <div class="img-fallback ratio-1x1 w-100 h-100" style="display:none;">
          ${fallbackIcon()}
        </div>`
      : `<div class="img-fallback ratio-1x1 w-100 h-100">${fallbackIcon()}</div>`;

    const col = document.createElement("div");
    col.className = "col";
    col.dataset.id = p.__backendId; // ✅

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
            <h3 class="h6 fw-semibold mb-2 text-truncate" style="max-width:70%;">${escapeHtml(p.title)}</h3>
            <span class="small fw-medium px-2 py-1 rounded"
                  style="background:var(--muted-bg); color:var(--secondary);">${p.stock} uds</span>
          </div>

          <div class="d-flex align-items-center justify-content-between mb-3">
            <span class="h5 m-0 fw-bold" style="color:var(--primary);">
              ${formatMoney(p.price, currencySymbol)}
            </span>
          </div>

        <div class="d-flex gap-2">
            <button class="btn btn-sm flex-fill fw-medium rounded-xl bg-muted-soft text-secondary-soft edit-btn" type="button">
                Editar
            </button>

            <button class="btn btn-sm fw-medium rounded-xl bg-muted-soft text-secondary-soft add-stock-btn" type="button">
                + Stock
            </button>

            <button class="btn btn-sm fw-medium rounded-xl bg-muted-soft text-secondary-soft sub-stock-btn" type="button">
                - Stock
            </button>

            <button class="btn btn-sm fw-medium rounded-xl delete-btn" type="button"
                    style="background:#fef2f2; color:var(--danger); border:none; width:44px;">
                🗑️
            </button>
        </div>

        </div>
      </div>`;

    col.querySelector(".edit-btn").addEventListener("click", () => onEdit(p));
    col.querySelector(".add-stock-btn").addEventListener("click", () => onAddStock(p));
    col.querySelector(".sub-stock-btn").addEventListener("click", () => onSubStock(p));
    col.querySelector(".delete-btn").addEventListener("click", () => onDelete(p));


    el.productsRow.appendChild(col);
  });
}