import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const api = process.env.API_URL ?? "http://localhost:3001";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Remotion + Mediabunny pèsent ~400 ko gzip ; l'export est chargé à la demande.
  build: { chunkSizeWarningLimit: 1600 },
  server: {
    port: 5173,
    // En dev, l'API et les médias passent par Vite : même origine qu'en prod.
    proxy: {
      "/api": api,
      "/files": api,
    },
  },
});
