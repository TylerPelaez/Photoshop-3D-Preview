import { isUserSettings } from '../api/app/Settings.guard';
import { fs } from './globals';
import { ControlSchemeType, UserSettings } from "../api/app/Settings";

const userSettingsFileName = "usersettings.json";
const userSettingsDir = "plugin-data:/";

const defaultUserSettings: UserSettings  = {
  gridSettings: {
    size: 10,
    divisions: 10,
    visible: true
  },
  displaySettings: {
    cameraFOV: 75,
    textureResolutionScale: 0.5,
  },
  controlsSettings: {
    scheme: ControlSchemeType.PHOTOSHOP
  },
};

export default class SettingsManager {
  userSettings: UserSettings;

  constructor() {
    this.userSettings = defaultUserSettings;
    this.load();
  }

  load() {
    let files = fs.readdirSync(userSettingsDir);
    let file = files.find(f => f == userSettingsFileName);
    if (!file) return;

    // include encoding to guarantee return as a string
    let text = fs.readFileSync(userSettingsDir + userSettingsFileName, {encoding: "utf-8"}) as string; 
    
    let data = JSON.parse(text);
    if (!isUserSettings(data)) {
      console.error("User Settings File Badly formatted - using defaults..");
      return;
    }

    this.userSettings = data;
  }

  updateSettings(newSettings: UserSettings) {
    this.userSettings = newSettings;
    fs.writeFile(userSettingsDir + userSettingsFileName, JSON.stringify(this.userSettings), {encoding: "utf-8"}, (err => {
      if (err) {
        console.error(err);
      }
    }));
  }

  getSettings(): UserSettings {
    return this.userSettings;
  }
}