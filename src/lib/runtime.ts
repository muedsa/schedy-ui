/**
 * A static export (`vite build --mode static`) is served by a plain static file
 * host, so the same-origin `/__schedy` proxy does not exist. Such builds always
 * talk to Schedy directly.
 */
export const STATIC_EXPORT = import.meta.env.MODE === "static";
