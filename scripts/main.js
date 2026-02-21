import { getConfig, applyConfigToTheme } from './config.js';
import { fetchProducts } from './api.js';
import { setProducts, state, calcStats } from './store.js';
import { renderProducts, renderStats, setLoading } from './ui.js';

const el = {
  pageTitle: document.getElementById('pageTitle'),
  totalProducts: document.getElementById('totalProducts'),
  lowStock: document.getElementById('lowStock'),
  totalValue: document.getElementById('totalValue'),
  emptyState: document.getElementById('emptyState'),
  productsRow: document.getElementById('productsRow'),
  loadingOverlay: document.getElementById('loadingOverlay'),
};

function onEdit(product){
  console.log("Editar:", product);
}

function onDelete(product){
  console.log("Eliminar:", product);
}

async function init(){
  setLoading(el, true);
  try{
    const cfg = getConfig();
    applyConfigToTheme(cfg, el);

    const list = await fetchProducts();
    setProducts(list);

    renderProducts(el, state.products, cfg.currency_symbol, onEdit, onDelete);
    renderStats(el, calcStats(state.products), cfg.currency_symbol);
  }catch(err){
    console.error(err);
    setProducts([]);
    const cfg = getConfig();
    renderProducts(el, [], cfg.currency_symbol, onEdit, onDelete);
    renderStats(el, { total:0, lowCount:0, totalVal:0 }, cfg.currency_symbol);
  }finally{
    setLoading(el, false);
  }
}

init();