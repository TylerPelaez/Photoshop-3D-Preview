import { defineConfig } from 'vite';
import { resolve } from "path";


const aliases = {
  "@api": "../api"
}

const resolvedAliases = Object.fromEntries(
  Object.entries(aliases).map(([key, value]) => [key, resolve(__dirname, value)]),
);


// vite.config.js
export default defineConfig({
  base: '/Photoshop-3D-Preview/',
  server: {
    watch: {
      usePolling: true
    }
  },
  resolve: {
    alias: {
        ...resolvedAliases
    },
},
})