import { UXP_Manifest, UXP_Config } from "vite-uxp-plugin";
import { version } from "./package.json";


export type UXP_Manifest_Webview_Support = UXP_Manifest & {
  requiredPermissions?: {
    webview?: {
      enableMessageBridge?: string;
    }
  }
}

const extraPrefs = {
  hotReloadPort: 8080,
  copyZipAssets: ["public-zip/*"],
};

const manifest: UXP_Manifest_Webview_Support = {
  id: "3dtexture.preview",
  name: "3D Texture Preview",
  version,
  main: "index.html",
  manifestVersion: 6,
  host: [
    {
      app: "PS",
      minVersion: "24.2.0",
    },
  ],
  entrypoints: [
    {
      type: "panel",
      id: "mainPanel",
      label: {
        default: "3D Texture Preview",
      },
      minimumSize: { width: 300, height: 150 },
      maximumSize: { width: 2000, height: 2000 },
      preferredDockedSize: { width: 400, height: 300 },
      preferredFloatingSize: { width: 480, height: 320 },
      icons: [
        {
          width: 23,
          height: 23,
          path: "icons/dark.png",
          scale: [1, 2],
          theme: ["darkest", "dark", "medium"],
        },
        {
          width: 23,
          height: 23,
          path: "icons/light.png",
          scale: [1, 2],
          theme: ["lightest", "light"],
        },
      ],
    },
  ],
  requiredPermissions: {
    localFileSystem: "fullAccess",
    launchProcess: {
      schemes: ["https", "slack", "file", "ws"],
      extensions: [".psd", ".bat", ".cmd"],
    },
    network: {
      domains: [
        `ws://localhost:${extraPrefs.hotReloadPort}`, // Required for hot reload
      ],
    },
    clipboard: "readAndWrite",
    webview: {
      allow: "yes",
      domains: ["http://127.0.0.1:5173"],
      enableMessageBridge: "localAndRemote",
    },
    ipc: {
      enablePluginCommunication: true,
    },
    allowCodeGenerationFromStrings: true,

    enableAddon: true,   
  },
    addon: {
      name: "bolt-uxp-hybrid.uxpaddon",
  },
    icons: [
    {
      width: 48,
      height: 48,
      path: "icons/plugin-icon.png",
      scale: [1, 2],
      theme: ["darkest", "dark", "medium", "lightest", "light", "all"],
      species: ["pluginList"],
    },
  ],
};

export const config: UXP_Config = {
  manifest,
  ...extraPrefs,
};
