export const state = {
  products: [],
  currentRecordCount: 0
};

export function setProducts(list){
  state.products = list;
  state.currentRecordCount = list.length;
}

export function calcStats(products){
  const total = products.length;
  const lowCount = products.filter(p => (p.stock ?? 0) <= 5).length;
  const totalVal = products.reduce((sum, p) => sum + ((p.stock ?? 0) * (p.price ?? 0)), 0);
  return { total, lowCount, totalVal };
}