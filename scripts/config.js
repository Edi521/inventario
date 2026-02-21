export const defaultConfig = {
  page_title: 'Control de Stock',
  currency_symbol: '$',
  background_color: '#f8fafc',
  card_color: '#ffffff',
  text_color: '#1e293b',
  primary_color: '#6366f1',
  secondary_color: '#64748b',
  font_family: 'Outfit',
  font_size: 16
};

export function getConfig(){
  return (window.elementSdk?.config ? { ...defaultConfig, ...window.elementSdk.config } : defaultConfig);
}

export function applyConfigToTheme(cfg, el){
  document.documentElement.style.setProperty('--bg', cfg.background_color);
  document.documentElement.style.setProperty('--card', cfg.card_color);
  document.documentElement.style.setProperty('--text', cfg.text_color);
  document.documentElement.style.setProperty('--primary', cfg.primary_color);
  document.documentElement.style.setProperty('--secondary', cfg.secondary_color);
  document.body.style.fontFamily = `${cfg.font_family}, Outfit, sans-serif`;
  document.body.style.fontSize = (cfg.font_size || 16) + 'px';
  el.pageTitle.textContent = cfg.page_title || defaultConfig.page_title;
}