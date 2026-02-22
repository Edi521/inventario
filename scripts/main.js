import { getConfig, applyConfigToTheme } from './config.js';
import { fetchProducts, apiUpdateProducto } from './api.js';
import { state, setProducts, calcStats } from './store.js';
import { renderProducts, renderStats, setLoading } from './ui.js';

let stockTargetProduct = null;
let stockMode = "add"; // "add" | "sub"

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

  // ✅ modal
  modalTitle: document.getElementById('modalTitle'),
  productForm: document.getElementById('productForm'),
  inputTitle: document.getElementById('inputTitle'),
  inputImage: document.getElementById('inputImage'),
  inputStock: document.getElementById('inputStock'),
  inputPrice: document.getElementById('inputPrice'),
  submitBtn: document.getElementById('submitBtn'),

  //añadir stock
  stockProductName: document.getElementById("stockProductName"),
  inputStockDelta: document.getElementById("inputStockDelta"),
  confirmAddStockBtn: document.getElementById("confirmAddStockBtn"),
  stockModalTitle: document.getElementById("stockModalTitle"),
};

el.stockField = el.inputStock.closest(".col-6");

const bs = window.bootstrap; // ✅ en módulos, mejor explícito
const productModal = bs.Modal.getOrCreateInstance(document.getElementById('productModal'));
const stockModal = window.bootstrap.Modal.getOrCreateInstance(document.getElementById("stockModal"));

let cfg = getConfig();
let editingProduct = null;

function refreshUI(){
  renderProducts(el, state.products, cfg.currency_symbol, onEdit, onAddStock, onSubStock, onDelete);
  renderStats(el, calcStats(state.products), cfg.currency_symbol);
}

function onAddStock(product){
  openStockModal(product, "add");
}

function onSubStock(product){
  openStockModal(product, "sub");
}

function openStockModal(product, mode){
  stockTargetProduct = product;
  stockMode = mode;

  el.stockModalTitle.textContent = (mode === "add") ? "Agregar stock" : "Disminuir stock";
  el.stockProductName.textContent = product.title ?? "—";
  el.inputStockDelta.value = "";
  stockModal.show();
}

function onEdit(product){
  editingProduct = product;

  el.modalTitle.textContent = "Editar Producto";

  el.inputTitle.value = product.title ?? "";
  el.inputTitle.disabled = true;     // ✅ bloquea solo en EDIT

  el.inputImage.value = product.image_url ?? "";
  el.stockField.classList.add("d-none");   // ✅ ocultar stock
  el.inputPrice.value = product.price ?? 0;

  productModal.show();
}

function onDelete(product){
  console.log("Eliminar pendiente:", product);
}

async function handleSubmit(e){
  e.preventDefault();

  const newTitle = el.inputTitle.value.trim();
  const newImage = el.inputImage.value.trim() || "";
  const newStock = parseInt(el.inputStock.value, 10) || 0;
  const newPrice = parseFloat(el.inputPrice.value) || 0;

  el.submitBtn.disabled = true;
  el.submitBtn.textContent = "Guardando...";

  try {
    if (!editingProduct) {
      alert("Aún no tienes endpoint CREATE. Solo está implementado EDIT (PUT).");
      return;
    }

    // ✅ IMPORTANTE: llave vieja para encontrar la fila
    const productoViejo = editingProduct.sheetProducto;

    const updates = {
      PRODUCTO: newTitle,     // renombrar si quieres
      IMAGEN: newImage,
      INVENTARIO: newStock,
      PRECIO: newPrice,
      CATEGORIA: editingProduct.category // si no la editas en el modal, conserva
    };

    // ✅ llama Apps Script
    const resp = await apiUpdateProducto(productoViejo, updates);
    console.log("PUT OK:", resp);

    // ✅ recargar lista desde la hoja
    const list = await fetchProducts();
    setProducts(list);
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

async function handleAddStock(){
  if (!stockTargetProduct) return;

  const delta = parseInt(el.inputStockDelta.value, 10);
  if (!Number.isFinite(delta) || delta <= 0) {
    alert("Ingresa un número mayor a 0");
    return;
  }

  el.confirmAddStockBtn.disabled = true;
  el.confirmAddStockBtn.textContent = "Aplicando...";

  try {
    // Tomar stock más reciente (recomendado)
    const fresh = await fetchProducts();
    const current = fresh.find(p => p.sheetProducto === stockTargetProduct.sheetProducto);
    const currentStock = current?.stock ?? stockTargetProduct.stock ?? 0;

    const newStock = currentStock + (stockMode === "add" ? delta : -delta);

    // ✅ Evitar negativos (y NO guardar)
    if (newStock < 0) {
      alert("No puedes dejar el stock en negativo.");
      return; // sale del try, y el finally re-habilita el botón
    }

    await apiUpdateProducto(stockTargetProduct.sheetProducto, { INVENTARIO: newStock });

    // refrescar UI
    setProducts(await fetchProducts());
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

el.confirmAddStockBtn.addEventListener("click", handleAddStock);

async function init(){
  setLoading(el, true);
  try{
    cfg = getConfig();
    applyConfigToTheme(cfg, el);

    const list = await fetchProducts();
    setProducts(list);
    refreshUI();
  }catch(err){
    console.error(err);
    setProducts([]);
    refreshUI();
  }finally{
    setLoading(el, false);
  }
}

el.productForm.addEventListener('submit', handleSubmit);
el.confirmAddStockBtn.addEventListener("click", handleAddStock);
init();