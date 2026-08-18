import { Platform } from "./platform.js?v=build-20260813-1";
import { DEFAULT_BRAND_THEME, LOCAL_THEME_KEY, applyThemeTokens, normalizeBrandTheme } from "./brand-theme.js?v=build-20260817-3";

export const Theme = {
  value: normalizeBrandTheme({ ...DEFAULT_BRAND_THEME, ...Platform.storage.get(LOCAL_THEME_KEY, {}) }),
  apply(next = {}) {
    this.value = applyThemeTokens({ ...this.value, ...next });
    document.title = `${this.value.brandName} - Aluno`;
    Platform.storage.set(LOCAL_THEME_KEY, this.value);
    window.dispatchEvent(new CustomEvent("app:theme", { detail: this.value }));
  },
  reset() {
    this.value = { ...DEFAULT_BRAND_THEME };
    this.apply();
  }
};
