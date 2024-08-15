import { ControlScheme, MouseButton, ControlSchemeType } from "./Settings";

export const BuiltInSchemes = new Map<ControlSchemeType, ControlScheme>([
  [ControlSchemeType.MAYA, {
    pan: { key: "Alt", mouseButton: MouseButton.MIDDLE },
    rotate: { key: "Alt", mouseButton: MouseButton.LEFT },
    zoom: { key: "Alt", mouseButton: MouseButton.RIGHT },
    scrollZoomEnabled: true,
  }],
  [ControlSchemeType.BLENDER, {
    pan: { key: "Shift", mouseButton: MouseButton.MIDDLE },
    rotate: { mouseButton: MouseButton.MIDDLE },
    zoom: { key: "Ctrl", mouseButton: MouseButton.RIGHT },
    scrollZoomEnabled: true,
  }],
  [ControlSchemeType.PHOTOSHOP, {
    pan: { key: "Space", mouseButton: MouseButton.MIDDLE },
    rotate: { key: "r", mouseButton: MouseButton.MIDDLE },
    zoom: { key: "Ctrl", mouseButton: MouseButton.RIGHT },
    scrollZoomEnabled: true,
  }]
]);