// Estado global simple de la app.
// Aquí guardamos la lista de productos ya normalizados (los que se muestran en la UI)
// y un contador para saber cuántos registros existen (útil para mostrar límites, etc.)
export const state = {
  products: [],           // Arreglo de productos: [{ title, stock, price, ... }, ...]
  currentRecordCount: 0   // Número total de productos cargados
};

// Actualiza el estado con una nueva lista de productos.
// - Guarda la lista completa en state.products
// - Actualiza el contador con la longitud de la lista
export function setProducts(list){
  state.products = list;
  state.currentRecordCount = list.length;
}

// Calcula estadísticas a partir de una lista de productos:
// - total: cuántos productos hay
// - lowCount: cuántos tienen stock bajo (<= 5)
// - totalVal: suma del valor total del inventario = Σ(stock * price)
export function calcStats(products){
  // Total de productos
  const total = products.length;

  // Productos con stock bajo (si stock viene null/undefined, usa 0)
  const lowCount = products.filter(p => (p.stock ?? 0) <= 5).length;

  // Valor total del inventario:
  // acumula stock * price para cada producto (si faltan valores, usa 0)
  const totalVal = products.reduce(
    (sum, p) => sum + ((p.stock ?? 0) * (p.price ?? 0)),
    0
  );

  // Regresamos un objeto para usarlo en renderStats()
  return { total, lowCount, totalVal };
}