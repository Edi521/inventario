// Configuración por defecto (si no llega ninguna configuración externa)
export const defaultConfig = {
  page_title: 'Control de Stock',     // Título que se muestra en el header
  currency_symbol: '$',              // Símbolo de moneda para precios/total
  background_color: '#f8fafc',       // Color de fondo general de la página
  card_color: '#ffffff',             // Color de fondo de las tarjetas (cards)
  text_color: '#1e293b',             // Color principal del texto
  primary_color: '#6366f1',          // Color principal (botones, precios, acentos)
  secondary_color: '#64748b',        // Color secundario (textos “muted”, badges, etc.)
  font_family: 'Outfit',             // Fuente principal
  font_size: 16                      // Tamaño base de fuente (px)
};

// Devuelve la configuración final a usar:
// - Si existe window.elementSdk.config, mezcla esa config con los defaults
// - Si no existe, usa solo defaultConfig
export function getConfig(){
  // El orden { ...defaultConfig, ...window.elementSdk.config } significa:
  // - Primero se ponen los defaults
  // - Luego se sobreescriben con lo que venga en elementSdk.config
  return (window.elementSdk?.config ? { ...defaultConfig, ...window.elementSdk.config } : defaultConfig);
}

// Aplica la configuración al “tema” de la UI:
// - Actualiza variables CSS (custom properties) usadas en tu CSS (inventario.css)
// - Ajusta fuente y tamaño en el body
// - Actualiza el título del header usando el objeto el (referencias DOM)
export function applyConfigToTheme(cfg, el){
  // Variables CSS globales (puedes usarlas como var(--bg), var(--primary), etc.)
  document.documentElement.style.setProperty('--bg', cfg.background_color);
  document.documentElement.style.setProperty('--card', cfg.card_color);
  document.documentElement.style.setProperty('--text', cfg.text_color);
  document.documentElement.style.setProperty('--primary', cfg.primary_color);
  document.documentElement.style.setProperty('--secondary', cfg.secondary_color);

  // Fuente y tamaño base en toda la página
  // Se deja 'Outfit' como fallback y luego sans-serif
  document.body.style.fontFamily = `${cfg.font_family}, Outfit, sans-serif`;
  document.body.style.fontSize = (cfg.font_size || 16) + 'px';

  // Actualiza el título visible en el header
  // Si cfg.page_title viene vacío, usa el default
  el.pageTitle.textContent = cfg.page_title || defaultConfig.page_title;
}