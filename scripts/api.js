import { toNumber } from './format.js';

// URL base de tu Web App de Apps Script (debe terminar en /exec)
export const API_URL = "https://script.google.com/macros/s/AKfycbw09JAE1b_TdZDK0GH6uqGczeIz4i5Y9k_BPmXMTMkNAdny6UVyVYvKGZOP8_9hxmBY/exec";

/**
 * Convierte URLs de Google Drive a una URL "directa" que sí funciona en <img>.
 * Drive normalmente da links tipo /file/d/.../view, que son páginas HTML (no imagen directa).
 *
 * Soporta varios formatos:
 *  - https://drive.google.com/file/d/FILE_ID/view?...
 *  - https://drive.google.com/open?id=FILE_ID
 *  - https://drive.google.com/thumbnail?id=FILE_ID&sz=...
 *  - https://drive.google.com/uc?export=view&id=FILE_ID
 *
 * Si no detecta un ID de Drive, regresa la misma URL sin tocar.
 */
export function driveToDirectImage(url){
  // Si viene vacío/null/undefined, regresamos cadena vacía
  if(!url) return "";

  // Aseguramos string y quitamos espacios
  const u = String(url).trim();

  // Caso 1: /file/d/FILE_ID/view
  const id1 = u.match(/drive\.google\.com\/file\/d\/([^/]+)/)?.[1];

  // Caso 2: ?id=FILE_ID
  const id2 = u.match(/[?&]id=([^&]+)/)?.[1];

  // Caso 3: thumbnail?id=FILE_ID
  const id3 = u.match(/drive\.google\.com\/thumbnail\?id=([^&]+)/)?.[1];

  // Caso 4: uc?export=view&id=FILE_ID
  const id4 = u.match(/drive\.google\.com\/uc\?export=view&id=([^&]+)/)?.[1];

  // Elegimos el primer ID que exista
  const id = id1 || id2 || id3 || id4;

  // Si no hay ID, no es un link de Drive (o no coincide), regresamos la URL tal cual
  if (!id) return u;

  // Convertimos a thumbnail grande (muy compatible con <img>)
  return `https://drive.google.com/thumbnail?id=${id}&sz=w1200`;
}

/**
 * Normaliza 1 registro que viene del JSON del GET (Google Sheets).
 * Tu backend te devuelve:
 *   CATEGORIA, IMAGEN, PRODUCTO, INVENTARIO, PRECIO
 *
 * Aquí lo transformamos a tu estructura interna para la UI:
 *   { __backendId, title, image_url, stock, price, category, sheetProducto }
 */
export function normalizeApiProduct(raw, index){
  // IMAGEN llega como string (URL) => la convertimos si es Drive
  const image_url = driveToDirectImage(raw.IMAGEN);

  // Limpieza de strings
  const category = String(raw.CATEGORIA ?? "").trim();
  const title = String(raw.PRODUCTO ?? "Sin título").trim();

  // Creamos un id para la UI (solo para DOM/render).
  // No es el ID real en la hoja; el backend usa PRODUCTO como llave.
  const baseID = `${category}__${title}`.toLowerCase().replace(/\s+/g, "_");
  const id = `${baseID}__${index}`;

  return {
    __backendId: id,                    // id local para render
    title,                              // nombre del producto
    image_url,                          // url de imagen lista para <img>
    stock: toNumber(raw.INVENTARIO, 0), // INVENTARIO -> número
    price: toNumber(raw.PRECIO, 0),     // PRECIO -> número
    category,                           // CATEGORIA
    sheetProducto: String(raw.PRODUCTO ?? "").trim() // llave REAL para PUT/DELETE
  };
}

/**
 * GET: obtiene todos los productos desde Apps Script (Sheet)
 * Devuelve un arreglo normalizado para la UI.
 */
export async function fetchProducts(){
  const res = await fetch(API_URL, {
    method: "GET",
    headers: { "Accept": "application/json" },
    cache: "no-store"
  });

  // Si el servidor responde con error HTTP
  if(!res.ok){
    const txt = await res.text().catch(() => "");
    throw new Error(`GET ${API_URL} -> ${res.status}. ${txt}`);
  }

  // Parseo JSON
  const data = await res.json();

  // Tu endpoint debe devolver un arreglo []
  if (!Array.isArray(data)) throw new Error("La API no devolvió un arreglo JSON ([])");

  // Normalizamos cada fila
  return data.map((row, i) => normalizeApiProduct(row, i));
}

/**
 * PUT (vía POST): actualiza un producto existente en la hoja.
 * - Apps Script no tiene doPut en Web App; por eso usamos POST con ?_method=PUT.
 * - Convierte IMAGEN a URL directa si viene de Drive.
 *
 * @param {string} productoViejo  Nombre exacto (llave) para encontrar la fila
 * @param {object} updates        Campos a actualizar, ej: { PRECIO: 10, IMAGEN: "..." }
 */
export async function apiUpdateProducto(productoViejo, updates){
  // Construimos URL con _method=PUT
  const url = API_URL + (API_URL.includes("?") ? "&" : "?") + "_method=PUT";

  // Clonamos updates para no mutar el objeto original
  const safeUpdates = { ...updates };

  // Si llega IMAGEN y es string, la normalizamos (Drive -> thumbnail)
  if (typeof safeUpdates.IMAGEN === "string" && safeUpdates.IMAGEN.trim()) {
    safeUpdates.IMAGEN = driveToDirectImage(safeUpdates.IMAGEN);
  }

  // Payload que espera tu Apps Script
  const payload = { PRODUCTO: productoViejo, updates: safeUpdates };

  const res = await fetch(url, {
    method: "POST",
    // IMPORTANTE: text/plain evita preflight CORS en Apps Script
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
    cache: "no-store"
  });

  // Leemos texto y tratamos de parsear JSON
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { ok:false, error:text }; }

  // Si el backend dijo ok:false o el HTTP no fue 200
  if (!res.ok || !json.ok){
    throw new Error(json.error || `HTTP ${res.status}`);
  }
  return json;
}

/**
 * POST: crea un producto nuevo en la hoja.
 * - Convierte IMAGEN a URL directa si viene de Drive.
 *
 * @param {object} newProduct  { PRODUCTO, CATEGORIA, INVENTARIO, PRECIO, IMAGEN }
 */
export async function apiCreateProducto(newProduct){
  // Clonamos para poder normalizar IMAGEN sin modificar el objeto original
  const payload = { ...newProduct };

  // Normalizamos IMAGEN si viene
  if (typeof payload.IMAGEN === "string" && payload.IMAGEN.trim()) {
    payload.IMAGEN = driveToDirectImage(payload.IMAGEN);
  }

  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" }, // evita preflight
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
 * DELETE (vía POST): elimina un producto en la hoja.
 * - Usamos POST con ?_method=DELETE.
 *
 * @param {string} producto  Llave (PRODUCTO) para encontrar y borrar la fila.
 */
export async function apiDeleteProducto(producto) {
  const url = API_URL + (API_URL.includes("?") ? "&" : "?") + "_method=DELETE";

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" }, // evita preflight
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