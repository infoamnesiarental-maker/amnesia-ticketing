import path from "node:path";
import type { NextConfig } from "next";

import { SERVER_ACTION_BODY_LIMIT_BYTES } from "./src/lib/upload-limits";

const nextConfig: NextConfig = {
  // Evita que Turbopack tome la carpeta padre (donde no hay node_modules) cuando hay otro lockfile arriba.
  turbopack: {
    root: path.join(__dirname),
  },
  // Server Actions: el default es 1 MB. Subimos solo lo necesario (comprobante hasta 5 MB + overhead).
  experimental: {
    serverActions: {
      // Debe cubrir el archivo más grande que aceptamos (comprobante) + overhead del FormData.
      bodySizeLimit: SERVER_ACTION_BODY_LIMIT_BYTES,
    },
  },
};

export default nextConfig;
