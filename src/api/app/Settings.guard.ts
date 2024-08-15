/*
 * Generated type guards for "Settings.ts".
 * WARNING: Do not manually change this file.
 */
import { ControlSchemeType, MouseButton, UserSettings } from "./Settings";

export function isUserSettings(obj: unknown): obj is UserSettings {
    const typedObj = obj as UserSettings
    return (
        (typedObj !== null &&
            typeof typedObj === "object" ||
            typeof typedObj === "function") &&
        (typedObj["gridSettings"] !== null &&
            typeof typedObj["gridSettings"] === "object" ||
            typeof typedObj["gridSettings"] === "function") &&
        typeof typedObj["gridSettings"]["size"] === "number" &&
        typeof typedObj["gridSettings"]["divisions"] === "number" &&
        typeof typedObj["gridSettings"]["visible"] === "boolean" &&
        (typedObj["displaySettings"] !== null &&
            typeof typedObj["displaySettings"] === "object" ||
            typeof typedObj["displaySettings"] === "function") &&
        typeof typedObj["displaySettings"]["cameraFOV"] === "number" &&
        typeof typedObj["displaySettings"]["textureResolutionScale"] === "number" &&
        (typedObj["controlsSettings"] !== null &&
            typeof typedObj["controlsSettings"] === "object" ||
            typeof typedObj["controlsSettings"] === "function") &&
        (typedObj["controlsSettings"]["scheme"] === ControlSchemeType.PHOTOSHOP ||
            typedObj["controlsSettings"]["scheme"] === ControlSchemeType.MAYA ||
            typedObj["controlsSettings"]["scheme"] === ControlSchemeType.BLENDER ||
            typedObj["controlsSettings"]["scheme"] === ControlSchemeType.CUSTOM) &&
        (typeof typedObj["controlsSettings"]["customSceme"] === "undefined" ||
            (typedObj["controlsSettings"]["customSceme"] !== null &&
                typeof typedObj["controlsSettings"]["customSceme"] === "object" ||
                typeof typedObj["controlsSettings"]["customSceme"] === "function") &&
            typeof typedObj["controlsSettings"]["customSceme"]["scrollZoomEnabled"] === "boolean" &&
            (typeof typedObj["controlsSettings"]["customSceme"]["pan"] === "undefined" ||
                (typedObj["controlsSettings"]["customSceme"]["pan"] !== null &&
                    typeof typedObj["controlsSettings"]["customSceme"]["pan"] === "object" ||
                    typeof typedObj["controlsSettings"]["customSceme"]["pan"] === "function") &&
                (typeof typedObj["controlsSettings"]["customSceme"]["pan"]["key"] === "undefined" ||
                    typeof typedObj["controlsSettings"]["customSceme"]["pan"]["key"] === "string") &&
                (typedObj["controlsSettings"]["customSceme"]["pan"]["mouseButton"] === MouseButton.LEFT ||
                    typedObj["controlsSettings"]["customSceme"]["pan"]["mouseButton"] === MouseButton.MIDDLE ||
                    typedObj["controlsSettings"]["customSceme"]["pan"]["mouseButton"] === MouseButton.RIGHT)) &&
            (typeof typedObj["controlsSettings"]["customSceme"]["zoom"] === "undefined" ||
                (typedObj["controlsSettings"]["customSceme"]["zoom"] !== null &&
                    typeof typedObj["controlsSettings"]["customSceme"]["zoom"] === "object" ||
                    typeof typedObj["controlsSettings"]["customSceme"]["zoom"] === "function") &&
                (typeof typedObj["controlsSettings"]["customSceme"]["zoom"]["key"] === "undefined" ||
                    typeof typedObj["controlsSettings"]["customSceme"]["zoom"]["key"] === "string") &&
                (typedObj["controlsSettings"]["customSceme"]["zoom"]["mouseButton"] === MouseButton.LEFT ||
                    typedObj["controlsSettings"]["customSceme"]["zoom"]["mouseButton"] === MouseButton.MIDDLE ||
                    typedObj["controlsSettings"]["customSceme"]["zoom"]["mouseButton"] === MouseButton.RIGHT)) &&
            (typeof typedObj["controlsSettings"]["customSceme"]["rotate"] === "undefined" ||
                (typedObj["controlsSettings"]["customSceme"]["rotate"] !== null &&
                    typeof typedObj["controlsSettings"]["customSceme"]["rotate"] === "object" ||
                    typeof typedObj["controlsSettings"]["customSceme"]["rotate"] === "function") &&
                (typeof typedObj["controlsSettings"]["customSceme"]["rotate"]["key"] === "undefined" ||
                    typeof typedObj["controlsSettings"]["customSceme"]["rotate"]["key"] === "string") &&
                (typedObj["controlsSettings"]["customSceme"]["rotate"]["mouseButton"] === MouseButton.LEFT ||
                    typedObj["controlsSettings"]["customSceme"]["rotate"]["mouseButton"] === MouseButton.MIDDLE ||
                    typedObj["controlsSettings"]["customSceme"]["rotate"]["mouseButton"] === MouseButton.RIGHT)))
    )
}
