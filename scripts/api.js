import { toNumber } from './format.js';

// ✅ Web App /exec
export const API_URL = "https://script.google.com/macros/s/AKfycbw09JAE1b_TdZDK0GH6uqGczeIz4i5Y9k_BPmXMTMkNAdny6UVyVYvKGZOP8_9hxmBY/exec";

/**
 * Extrae el fileId de varias URLs de Drive y devuelve una URL directa compatible con <img>.
 * Si no es una URL de Drive, regresa la misma URL.
 */
export function driveToDirectImage(url){
  if(!url) return "";
  const u = String(url).trim();

  // /file/d/FILE_ID/view
  const id1 = u.match(/drive\.google\.com\/file\/d\/([^/]+)/)?.[1];

  // ?id=FILE_ID
  const id2 = u.match(/[?&]id=([^&]+)/)?.[1];

  // thumbnail?id=FILE_ID
  const id3 = u.match(/drive\.google\.com\/thumbnail\?id=([^&]+)/)?.[1];

  // uc?export=view&id=FILE_ID
  const id4 = u.match(/drive\.google\.com\/uc\?export=view&id=([^&]+)/)?.[1];

  const id = id1 || id2 || id3 || id4;
  if (!id) return u;

  // ✅ muy compatible con <img>
  return `https://drive.google.com/thumbnail?id=${id}&sz=w1200`;
}

/**
 * Normaliza un registro del JSON que viene del GET.
 */
export function normalizeApiProduct(raw, index){
  const image_url = driveToDirectImage(raw.IMAGEN);
  const category = String(raw.CATEGORIA ?? "").trim();
  const title = String(raw.PRODUCTO ?? "Sin título").trim();

  // id para UI (no afecta al update)
  const baseID = `${category}__${title}`.toLowerCase().replace(/\s+/g, "_");
  const id = `${baseID}__${index}`;

  return {
    __backendId: id,
    title,
    image_url,
    stock: toNumber(raw.INVENTARIO, 0),
    price: toNumber(raw.PRECIO, 0),
    category,

    // ✅ clave real para ubicar fila en la hoja
    sheetProducto: String(raw.PRODUCTO ?? "").trim()
  };
}

/**
 * GET: trae productos
 */
export async function fetchProducts(){
  const res = await fetch(API_URL, {
    method: "GET",
    headers: { "Accept": "application/json" },
    cache: "no-store"
  });

  if(!res.ok){
    const txt = await res.text().catch(() => "");
    throw new Error(`GET ${API_URL} -> ${res.status}. ${txt}`);
  }

  const data = await res.json();
  if (!Array.isArray(data)) throw new Error("La API no devolvió un arreglo JSON ([])");

  return data.map((row, i) => normalizeApiProduct(row, i));
}

/**
 * PUT (vía POST): editar producto
 * - Convierte IMAGEN a URL directa si viene de Drive.
 */
export async function apiUpdateProducto(productoViejo, updates){
  const url = API_URL + (API_URL.includes("?") ? "&" : "?") + "_method=PUT";

  // ✅ normaliza IMAGEN si viene
  const safeUpdates = { ...updates };
  if (typeof safeUpdates.IMAGEN === "string" && safeUpdates.IMAGEN.trim()) {
    safeUpdates.IMAGEN = driveToDirectImage(safeUpdates.IMAGEN);
  }

  const payload = { PRODUCTO: productoViejo, updates: safeUpdates };

  const res = await fetch(url, {
    method: "POST",
    // ✅ evita preflight CORS en Apps Script
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
    cache: "no-store"
  });

  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { ok:false, error:text }; }

  if (!res.ok || !json.ok){
    throw new Error(json.error || `HTTP ${res.status}`);
  }
  return json;
}

/**
 * POST: crear producto
 * - Convierte IMAGEN a URL directa si viene de Drive.
 */
export async function apiCreateProducto(newProduct){
  const payload = { ...newProduct };

  if (typeof payload.IMAGEN === "string" && payload.IMAGEN.trim()) {
    payload.IMAGEN = driveToDirectImage(payload.IMAGEN);
  }

  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
    cache: "no-store"
  });

  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { ok:false, error:text }; }

  if (!res.ok || !json.ok){
    throw new Error(json.error || `HTTP ${res.status}`);
  }
  return json;
}

//Funcion para eliminar producto
export async function apiDeleteProducto(producto) {
  const url = API_URL + (API_URL.includes("?") ? "&" : "?") + "_method=DELETE";

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" }, // ✅ sin preflight
    body: JSON.stringify({ PRODUCTO: producto }),
    cache: "no-store"
  });

  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { ok:false, error:text }; }

  if (!res.ok || !json.ok) {
    throw new Error(json.error || `HTTP ${res.status}`);
  }
  return json;
}