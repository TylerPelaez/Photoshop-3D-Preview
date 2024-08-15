/** @see {isUserSettings} ts-auto-guard:type-guard */
export interface UserSettings {
  gridSettings: GridSettings;
  displaySettings: DisplaySettings;
  controlsSettings: ControlsSettings;
}

export interface GridSettings {
  size: number;
  divisions: number;
  visible: boolean;
}

export interface DisplaySettings {
  cameraFOV: number,
  textureResolutionScale: number,
}

export enum ControlSchemeType {
  PHOTOSHOP,
  MAYA,
  BLENDER,
  CUSTOM,
}

export enum MouseButton {
  LEFT = 0,
  MIDDLE = 1,
  RIGHT = 2,
}

export interface InputCombination {
  key?: string,
  mouseButton: MouseButton
}

export interface ControlScheme {
  scrollZoomEnabled: boolean,
  pan?: InputCombination,
  zoom?: InputCombination,
  rotate?: InputCombination,
}

export interface ControlsSettings {
  scheme: ControlSchemeType,
  customSceme?: ControlScheme
}