/** WebGL feature check — kept free of three.js imports so pages can call it without loading the 3D bundle. */
export function webglAvailable(): boolean {
  try {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("no3d") === "1") return false; // manual/test fallback
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}
