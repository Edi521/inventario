// Convierte un valor cualquiera a número seguro.
// - Acepta: "12", "12.50", "$12.50", "  1,234.00 " (aunque quita comas y símbolos)
// - Si no se puede convertir, devuelve el valor por defecto (def)
export function toNumber(v, def = 0){
  // Convierte a string y elimina todo lo que no sea dígito, punto o signo negativo
  // Ej: "$1,234.50" -> "1234.50"
  const cleaned = String(v ?? "").replace(/[^\d.-]/g, "");

  // Intenta convertir a Number
  const n = Number(cleaned);

  // Si es un número válido, lo regresa; si no, regresa el default
  return Number.isFinite(n) ? n : def;
}

// Formateador de dinero:
// - 'en-US' => usa punto como decimal (1234.50)
// - useGrouping:false => no pone separadores de miles (sin comas)
const moneyFmt = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,  // siempre 2 decimales
  maximumFractionDigits: 2,  // máximo 2 decimales
  useGrouping: false         // sin separador de miles
});

// Formatea un número como dinero con símbolo.
// Ej: formatMoney(35, "$") -> "$35.00"
export function formatMoney(n, symbol = '$'){
  // Number(n || 0): si n viene vacío/undefined, usa 0
  return `${symbol}${moneyFmt.format(Number(n || 0))}`;
}

// Escapa HTML para evitar que un texto rompa tu template o inyecte HTML.
// Convierte caracteres especiales a entidades HTML.
// Ej: <script> -> &lt;script&gt;
export function escapeHtml(str){
  return String(str ?? '').replace(/[&<>"']/g, s => ({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;'
  }[s]));
}