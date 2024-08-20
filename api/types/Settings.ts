/** @see {isUserSettings} ts-auto-guard:type-guard */
interface UserSettings {
  gridSettings: GridSettings;
  displaySettings: DisplaySettings;
  controlsSettings: ControlsSettings;
}

interface GridSettings {
  size: number;
  divisions: number;
  visible: boolean;
}

interface DisplaySettings {
  cameraFOV: number,
  textureResolutionScale: number,
}

enum ControlSchemeType {
  PHOTOSHOP,
  MAYA,
  BLENDER,
  CUSTOM,
}

enum MouseButton {
  LEFT = 0,
  MIDDLE = 1,
  RIGHT = 2,
}

interface InputCombination {
  key?: string,
  mouseButton: MouseButton
}

interface ControlScheme {
  scrollZoomEnabled: boolean,
  pan?: InputCombination,
  zoom?: InputCombination,
  rotate?: InputCombination,
  light?: InputCombination,
}

interface ControlsSettings {
  scheme: ControlSchemeType,
  customScheme?: ControlScheme
}

export type {UserSettings, GridSettings, DisplaySettings, ControlsSettings, ControlScheme, InputCombination};

export {ControlSchemeType, MouseButton};