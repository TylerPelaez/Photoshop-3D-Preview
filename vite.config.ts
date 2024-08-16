import { defineConfig } from "vite";
import { runAction, uxp } from "vite-uxp-plugin";
import { config } from "./uxp.config";
import { resolve } from "path";

const action = process.env.ACTION;
const mode = process.env.MODE;

const aliases = {
  "@api": "api"
}

const resolvedAliases = Object.fromEntries(
  Object.entries(aliases).map(([key, value]) => [key, resolve(__dirname, value)]),
);

if (action) {
  runAction({}, action);
  process.exit();
}

const shouldNotEmptyDir =
  mode === "dev" && config.manifest.requiredPermissions?.enableAddon;

export default defineConfig({
  plugins: [
    uxp(config, mode),
  ],
  build: {
    sourcemap: mode && ["dev", "build"].includes(mode) ? true : false,
    // minify: false,
    emptyOutDir: !shouldNotEmptyDir,
    rollupOptions: {
      external: [
        "photoshop",         
        "bolt-uxp-hybrid.uxpaddon",         
        "uxp",
        "fs",
        "os",
        "path",
        "process",
        "shell",
      ],
      output: {
        format: "cjs",
      },
    },
  },
  resolve: {
    alias: {
        ...resolvedAliases
    },
},
  publicDir: "public",
});
