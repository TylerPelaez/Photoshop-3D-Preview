import { ControlScheme, MouseButton, ControlSchemeType } from "@api/types/Settings";

export function isValidNumber(value: string): boolean {
  value = value.trim();
  if (!value) {
    return false;
  }
  value = value.replace(/^0+/, "") || "0";
  var n = Math.floor(Number(value));
  return n !== Infinity && String(n) === value && n > 0;
};

export const BuiltInSchemes = new Map<ControlSchemeType, ControlScheme>([
  [ControlSchemeType.MAYA, {
    pan: { key: "Alt", mouseButton: MouseButton.MIDDLE },
    rotate: { key: "Alt", mouseButton: MouseButton.LEFT },
    zoom: { key: "Alt", mouseButton: MouseButton.RIGHT },
    light: { key: "l", mouseButton: MouseButton.LEFT },
    scrollZoomEnabled: true,
  }],
  [ControlSchemeType.BLENDER, {
    pan: { key: "Shift", mouseButton: MouseButton.MIDDLE },
    rotate: { mouseButton: MouseButton.MIDDLE },
    zoom: { key: "Control", mouseButton: MouseButton.MIDDLE },
    light: { key: "l", mouseButton: MouseButton.LEFT },
    scrollZoomEnabled: true,
  }],
  [ControlSchemeType.PHOTOSHOP, {
    pan: { key: " ", mouseButton: MouseButton.LEFT },
    rotate: { key: "r", mouseButton: MouseButton.LEFT },
    zoom: { key: "z", mouseButton: MouseButton.LEFT },
    light: { key: "l", mouseButton: MouseButton.LEFT },
    scrollZoomEnabled: true, 
  }]
]);