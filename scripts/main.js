import { getConfig, applyConfigToTheme } from './config.js';
import { fetchProducts, apiUpdateProducto, apiCreateProducto, apiDeleteProducto } from "./api.js";
import { state, setProducts, calcStats } from './store.js';
import { renderProducts, renderStats, setLoading } from './ui.js';

// ============================
// State
// ============================
let cfg = getConfig();
let editingProduct = null;

let stockTargetProduct = null;
let stockMode = "add"; // "add" | "sub"

let deletingProduct = null;
let deleteStep = 1; // 1 o 2

let activeCategoryKey = "__all__";
let activeCategoryLabel = "Todas";

let activeSort = "none"; // "none" | "stock_desc" | "stock_asc"

// normalizador simple para categorías
const norm = (s) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

// búsqueda
let searchQuery = "";

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
  loadingOverlay: document.getElementById('loadingOverlay'),

  // filtro único (categoría + orden)
  filterBtn: document.getElementById("filterBtn"),
  filterLabel: document.getElementById("filterLabel"),
  filterMenu: document.getElementById("filterMenu"),

  // buscador
  searchInput: document.getElementById("searchInput"),

  // Delete modal (2 pasos)
  deleteStep1: document.getElementById("deleteStep1"),
  deleteStep2: document.getElementById("deleteStep2"),
  deleteProductName: document.getElementById("deleteProductName"),
  deleteProductName2: document.getElementById("deleteProductName2"),
  deleteConfirmInput: document.getElementById("deleteConfirmInput"),
  confirmDeleteBtn: document.getElementById("confirmDeleteBtn"),

  // Modal producto
  modalTitle: document.getElementById('modalTitle'),
  productForm: document.getElementById('productForm'),
  inputTitle: document.getElementById('inputTitle'),
  inputCategory: document.getElementById('inputCategory'),
  inputImage: document.getElementById('inputImage'),
  inputStock: document.getElementById('inputStock'),
  inputPrice: document.getElementById('inputPrice'),
  submitBtn: document.getElementById('submitBtn'),

  // Modal stock +/- 
  stockProductName: document.getElementById("stockProductName"),
  inputStockDelta: document.getElementById("inputStockDelta"),
  confirmAddStockBtn: document.getElementById("confirmAddStockBtn"),
  stockModalTitle: document.getElementById("stockModalTitle"),
};

// Contenedor del stock (para ocultar/mostrar en modal de producto)
el.stockField = el.inputStock?.closest(".col-6");

// Bootstrap modals
const bs = window.bootstrap;
const productModal = bs.Modal.getOrCreateInstance(document.getElementById('productModal'));
const stockModal = bs.Modal.getOrCreateInstance(document.getElementById("stockModal"));
const deleteModal = bs.Modal.getOrCreateInstance(document.getElementById("deleteModal"));

//============================
// Normalizar texto para búsqueda (quita acentos)
//============================
function normText(s){
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita acentos
    .replace(/\s+/g, " ")
    .trim();
}

//============================
// Filtrado + orden (dropdown único)
//============================
function updateFilterLabel(){
  const sortText =
    activeSort === "stock_desc" ? "Stock ↓" :
    activeSort === "stock_asc"  ? "Stock ↑" :
    "Sin orden";

  el.filterLabel.textContent = `${activeCategoryLabel} · ${sortText}`;
}

function buildFilterMenu(){
  // Map key(normalizado) -> label (original)
  const map = new Map();

  for (const p of state.products){
    const label = String(p.category ?? "").trim();
    if (!label) continue;
    const key = norm(label);
    if (!map.has(key)) map.set(key, label);
  }

  const entries = [...map.entries()].sort((a,b) =>
    a[1].localeCompare(b[1], 'es', { sensitivity: 'base' })
  );

  el.filterMenu.innerHTML = `
    <!-- Orden -->
    <li class="px-3 py-1 small text-secondary">Ordenar por stock</li>
    <li><button class="dropdown-item" type="button" data-sort="none">Ninguno</button></li>
    <li><button class="dropdown-item" type="button" data-sort="stock_desc">Stock: mayor → menor</button></li>
    <li><button class="dropdown-item" type="button" data-sort="stock_asc">Stock: menor → mayor</button></li>

    <li><hr class="dropdown-divider"></li>

    <!-- Categorías -->
    <li class="px-3 py-1 small text-secondary">Categoría</li>
    <li><button class="dropdown-item" type="button" data-cat="__all__" data-catlabel="Todas">Todas</button></li>
    ${entries.map(([key,label]) => `
      <li><button class="dropdown-item" type="button" data-cat="${key}" data-catlabel="${label}">${label}</button></li>
    `).join("")}
  `;

  // Si la categoría activa ya no existe, vuelve a Todas
  if (activeCategoryKey !== "__all__" && !map.has(activeCategoryKey)){
    activeCategoryKey = "__all__";
    activeCategoryLabel = "Todas";
  }

  updateFilterLabel();
}

function getVisibleProducts(){
  // 1) Filtrar por categoría
  let list = (activeCategoryKey === "__all__")
    ? [...state.products]
    : state.products.filter(p => norm(p.category) === activeCategoryKey);

  // 2) Filtrar por búsqueda (nombre del producto)
  const q = normText(searchQuery);
  if (q) {
    list = list.filter(p => normText(p.title).includes(q));
  }

  // 3) Ordenar por stock
  if (activeSort === "stock_asc") {
    list.sort((a,b) => (a.stock ?? 0) - (b.stock ?? 0));
  } else if (activeSort === "stock_desc") {
    list.sort((a,b) => (b.stock ?? 0) - (a.stock ?? 0));
  }

  return list;
}

// ============================
// UI helpers
// ============================
function refreshUI(){
  const visible = getVisibleProducts();
  renderProducts(el, visible, cfg.currency_symbol, onEdit, onAddStock, onSubStock, onDelete);
  renderStats(el, calcStats(visible), cfg.currency_symbol);
}

// ============================
// Stock modal (+ / -)
// ============================
function onAddStock(product) {
  openStockModal(product, "add");
}

function onSubStock(product) {
  openStockModal(product, "sub");
}

function openStockModal(product, mode) {
  stockTargetProduct = product;
  stockMode = mode;

  el.stockModalTitle.textContent = (mode === "add") ? "Agregar stock" : "Disminuir stock";
  el.stockProductName.textContent = product.title ?? "—";
  el.inputStockDelta.value = "";
  stockModal.show();
}

async function handleAddStock() {
  if (!stockTargetProduct) return;

  const delta = parseInt(el.inputStockDelta.value, 10);
  if (!Number.isFinite(delta) || delta <= 0) {
    alert("Ingresa un número mayor a 0");
    return;
  }

  el.confirmAddStockBtn.disabled = true;
  el.confirmAddStockBtn.textContent = "Aplicando...";

  try {
    const fresh = await fetchProducts();
    const current = fresh.find(p => p.sheetProducto === stockTargetProduct.sheetProducto);
    const currentStock = current?.stock ?? stockTargetProduct.stock ?? 0;

    const newStock = currentStock + (stockMode === "add" ? delta : -delta);

    if (newStock < 0) {
      alert("No puedes dejar el stock en negativo.");
      return;
    }

    await apiUpdateProducto(stockTargetProduct.sheetProducto, { INVENTARIO: newStock });

    setProducts(await fetchProducts());
    buildFilterMenu();
    refreshUI();

    stockModal.hide();
    stockTargetProduct = null;

  } catch (err) {
    console.error(err);
    alert("No se pudo actualizar stock: " + err.message);
  } finally {
    el.confirmAddStockBtn.disabled = false;
    el.confirmAddStockBtn.textContent = "Aceptar";
  }
}

// ============================
// Product modal (Create / Edit)
// ============================
function openAddModal() {
  editingProduct = null;

  el.modalTitle.textContent = "Nuevo Producto";
  el.productForm.reset();

  el.inputTitle.disabled = false;
  el.inputTitle.classList.remove("bg-light", "text-secondary");

  el.inputCategory.disabled = false;
  el.inputCategory.classList.remove("bg-light", "text-secondary");

  // mostrar stock en "nuevo"
  el.stockField?.classList.remove("d-none");

  productModal.show();
}

function onEdit(product) {
  editingProduct = product;

  el.modalTitle.textContent = "Editar Producto";

  // PRODUCTO como llave
  el.inputTitle.value = product.title ?? "";
  el.inputTitle.disabled = true;
  el.inputTitle.classList.add("bg-light", "text-secondary");

  el.inputCategory.value = product.category ?? "";
  el.inputCategory.disabled = false;
  el.inputCategory.classList.remove("bg-light", "text-secondary");

  el.inputImage.value = product.image_url ?? "";
  el.inputPrice.value = product.price ?? 0;

  // ocultar stock en editar
  el.stockField?.classList.add("d-none");

  productModal.show();
}

// ============================
// Delete modal (doble confirmación)
// ============================
function onDelete(product){
  deletingProduct = product;
  deleteStep = 1;

  el.deleteStep1.classList.remove("d-none");
  el.deleteStep2.classList.add("d-none");

  el.deleteProductName.textContent = product.title ?? "—";
  el.deleteProductName2.textContent = product.title ?? "—";

  el.deleteConfirmInput.value = "";
  el.confirmDeleteBtn.disabled = false;
  el.confirmDeleteBtn.textContent = "Continuar";

  deleteModal.show();
}

async function handleConfirmDelete(){
  if (!deletingProduct) return;

  if (deleteStep === 1) {
    deleteStep = 2;

    el.deleteStep1.classList.add("d-none");
    el.deleteStep2.classList.remove("d-none");

    el.confirmDeleteBtn.textContent = "Eliminar";
    el.confirmDeleteBtn.disabled = true;
    el.deleteConfirmInput.focus();
    return;
  }

  const typed = el.deleteConfirmInput.value.trim().toUpperCase();
  if (typed !== "ELIMINAR") {
    alert('Escribe "ELIMINAR" para confirmar.');
    return;
  }

  el.confirmDeleteBtn.disabled = true;
  el.confirmDeleteBtn.textContent = "Eliminando...";

  try{
    const productoKey = deletingProduct.sheetProducto || deletingProduct.title;
    await apiDeleteProducto(productoKey);

    setProducts(await fetchProducts());
    buildFilterMenu();
    refreshUI();

    deleteModal.hide();
    deletingProduct = null;
    deleteStep = 1;

  } catch(err){
    console.error(err);
    alert("No se pudo eliminar: " + err.message);
  } finally {
    if (deleteStep === 2) {
      el.confirmDeleteBtn.textContent = "Eliminar";
      el.confirmDeleteBtn.disabled = (el.deleteConfirmInput.value.trim().toUpperCase() !== "ELIMINAR");
    } else {
      el.confirmDeleteBtn.textContent = "Continuar";
      el.confirmDeleteBtn.disabled = false;
    }
  }
}

// Reset al cerrar modal
document.getElementById("deleteModal").addEventListener("hidden.bs.modal", () => {
  deletingProduct = null;
  deleteStep = 1;

  el.deleteStep1.classList.remove("d-none");
  el.deleteStep2.classList.add("d-none");
  el.deleteConfirmInput.value = "";
  el.confirmDeleteBtn.textContent = "Continuar";
  el.confirmDeleteBtn.disabled = false;
});

// Habilitar botón solo si escribe ELIMINAR en paso 2
el.deleteConfirmInput.addEventListener("input", () => {
  if (deleteStep !== 2) return;
  const ok = el.deleteConfirmInput.value.trim().toUpperCase() === "ELIMINAR";
  el.confirmDeleteBtn.disabled = !ok;
});

// ============================
// Submit (Create / Update)
// ============================
async function handleSubmit(e) {
  e.preventDefault();

  const newTitle = el.inputTitle.value.trim();
  const newCategory = el.inputCategory.value.trim();
  const newImage = el.inputImage.value.trim() || "";
  const newStock = parseInt(el.inputStock.value, 10) || 0;
  const newPrice = parseFloat(el.inputPrice.value) || 0;

  if (!newTitle) { alert("Escribe un nombre de producto"); return; }
  if (!newCategory) { alert("Escribe una categoría"); return; }
  if (newStock < 0) { alert("El stock no puede ser negativo"); return; }
  if (newPrice < 0) { alert("El precio no puede ser negativo"); return; }

  el.submitBtn.disabled = true;
  el.submitBtn.textContent = "Guardando...";

  try {
    if (editingProduct) {
      const productoViejo = editingProduct.sheetProducto;

      const updates = {
        CATEGORIA: newCategory,
        IMAGEN: newImage,
        PRECIO: newPrice
      };

      await apiUpdateProducto(productoViejo, updates);
    } else {
      await apiCreateProducto({
        PRODUCTO: newTitle,
        CATEGORIA: newCategory,
        INVENTARIO: newStock,
        PRECIO: newPrice,
        IMAGEN: newImage
      });
    }

    setProducts(await fetchProducts());
    buildFilterMenu();
    refreshUI();

    productModal.hide();
    editingProduct = null;

  } catch (err) {
    console.error(err);
    alert("No se pudo guardar: " + err.message);
  } finally {
    el.submitBtn.disabled = false;
    el.submitBtn.textContent = "Guardar";
  }
}

// ============================
// Init
// ============================
async function init() {
  setLoading(el, true);
  try {
    cfg = getConfig();
    applyConfigToTheme(cfg, el);

    const list = await fetchProducts();
    setProducts(list);

    buildFilterMenu();
    refreshUI();

  } catch (err) {
    console.error(err);
    setProducts([]);
    buildFilterMenu();
    refreshUI();
  } finally {
    setLoading(el, false);
  }
}

// ============================
// Events
// ============================
el.addBtn.addEventListener("click", openAddModal);
el.productForm.addEventListener('submit', handleSubmit);
el.confirmAddStockBtn.addEventListener("click", handleAddStock);
el.confirmDeleteBtn.addEventListener("click", handleConfirmDelete);

// ✅ dropdown único: categoría + orden
el.filterMenu.addEventListener("click", (e) => {
  const sortBtn = e.target.closest("button[data-sort]");
  if (sortBtn){
    activeSort = sortBtn.dataset.sort;
    updateFilterLabel();
    refreshUI();
    return;
  }

  const catBtn = e.target.closest("button[data-cat]");
  if (catBtn){
    activeCategoryKey = catBtn.dataset.cat;
    activeCategoryLabel = catBtn.dataset.catlabel;
    updateFilterLabel();
    refreshUI();
  }
});

// ✅ buscador en vivo
el.searchInput.addEventListener("input", () => {
  searchQuery = el.searchInput.value;
  refreshUI();
});

// Go
init();