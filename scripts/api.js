import { toNumber } from './format.js';

export const API_URL = "https://script.googleusercontent.com/macros/echo?user_content_key=AY5xjrTT4ujRHHDefnqc9Y26vdFHxQR4f8SOn0VMh6jhPJjzXHcOJbYFQWGoxIRp3RPoa4ELEA2r3rieMcqoIkN4qJbt1s8xS5ovdO5fWQi7qRqs3JpkAdbVhHbSPWNNsBdpaCaLCMm6p2qZ_fs1afVxOfyWDfFlZ5j02tXOS7Bi3zWDvmL2--5zOPC7BA8Xp-UbqebPEmLs4SXh0WfRi1HIctN2y6rl3SJ1gPCNe0TEqjWz1eiD2PYhK5xWzlD_uhgls7mYuJf6knb1lXmcAxi0cf0Q4hoYUA&lib=MjXtp5UVmE8ZqiL6ikFuBvPYkqy2-7K9Q";

export function driveToDirectImage(url){
  if(!url) return "";
  const u = String(url).trim();
  const id =
    u.match(/drive\.google\.com\/file\/d\/([^/]+)/)?.[1] ||
    u.match(/[?&]id=([^&]+)/)?.[1];
  if (!id) return u;
  return `https://drive.google.com/thumbnail?id=${id}&sz=w1200`;
}

export function normalizeApiProduct(raw, index){
  const image_url = driveToDirectImage(raw.IMAGEN);
  const category = String(raw.CATEGORIA ?? "").trim();
  const title = String(raw.PRODUCTO ?? "Sin título").trim();

  const baseID = `${category}__${title}`.toLowerCase().replace(/\s+/g, "_");
  const id = `${baseID}__${index}`;

  return {
    __backendId: id,
    title,
    image_url,
    stock: toNumber(raw.INVENTARIO, 0),
    price: toNumber(raw.PRECIO, 0),
    category
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