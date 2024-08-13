import { defineConfig } from "vite";
import { runAction, uxp } from "vite-uxp-plugin";
import { config } from "./uxp.config";

const action = process.env.ACTION;
const mode = process.env.MODE;

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
        "photoshop",         "3dtexturepreview.uxpaddon",         "uxp",
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
  publicDir: "public",
});
