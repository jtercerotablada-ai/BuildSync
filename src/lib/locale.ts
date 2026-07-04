/**
 * Single source of truth for the locale passed to toLocaleDateString /
 * toLocaleTimeString / Intl formatters across the product UI.
 *
 * The product intentionally ships English-only for now, so this is a
 * plain constant rather than an i18n framework. When per-user language
 * preferences arrive, thread them through here so every formatter
 * switches in one place instead of hunting hardcoded "en-US" literals.
 */
export const APP_LOCALE = "en-US";
