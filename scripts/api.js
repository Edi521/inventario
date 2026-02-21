import { toNumber } from './format.js';

// ✅ USA /exec (Web App), no googleusercontent echo
export const API_URL = "https://script.google.com/macros/s/AKfycbw09JAE1b_TdZDK0GH6uqGczeIz4i5Y9k_BPmXMTMkNAdny6UVyVYvKGZOP8_9hxmBY/exec";

export function driveToDirectImage(url){
  if(!url) return "";
  const u = String(url).trim();

  const id =
    u.match(/drive\.google\.com\/file\/d\/([^/]+)/)?.[1] ||
    u.match(/[?&]id=([^&]+)/)?.[1];

  if (!id) return u;

  // ✅ thumbnail funciona mejor en <img>
  return `https://drive.google.com/thumbnail?id=${id}&sz=w1200`;
}

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

    // ✅ CLAVE REAL para ubicar fila en la hoja
    sheetProducto: String(raw.PRODUCTO ?? "").trim()
  };
}

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

// ✅ PUT (vía POST) para Apps Script
export async function apiUpdateProducto(productoViejo, updates){
  const url = API_URL + (API_URL.includes("?") ? "&" : "?") + "_method=PUT";

  const payload = { PRODUCTO: productoViejo, updates };

  const res = await fetch(url, {
    method: "POST",
    // ✅ EVITA PREFLIGHT CORS en Apps Script
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