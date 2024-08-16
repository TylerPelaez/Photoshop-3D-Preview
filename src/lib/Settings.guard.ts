/*
 * Generated type guards for "Settings.d.ts".
 * WARNING: Do not manually change this file.
 */
import { ControlSchemeType, MouseButton, UserSettings } from "@api/types/Settings";

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
        (typeof typedObj["controlsSettings"]["customScheme"] === "undefined" ||
            (typedObj["controlsSettings"]["customScheme"] !== null &&
                typeof typedObj["controlsSettings"]["customScheme"] === "object" ||
                typeof typedObj["controlsSettings"]["customScheme"] === "function") &&
            typeof typedObj["controlsSettings"]["customScheme"]["scrollZoomEnabled"] === "boolean" &&
            (typeof typedObj["controlsSettings"]["customScheme"]["pan"] === "undefined" ||
                (typedObj["controlsSettings"]["customScheme"]["pan"] !== null &&
                    typeof typedObj["controlsSettings"]["customScheme"]["pan"] === "object" ||
                    typeof typedObj["controlsSettings"]["customScheme"]["pan"] === "function") &&
                (typeof typedObj["controlsSettings"]["customScheme"]["pan"]["key"] === "undefined" ||
                    typeof typedObj["controlsSettings"]["customScheme"]["pan"]["key"] === "string") &&
                (typedObj["controlsSettings"]["customScheme"]["pan"]["mouseButton"] === MouseButton.LEFT ||
                    typedObj["controlsSettings"]["customScheme"]["pan"]["mouseButton"] === MouseButton.MIDDLE ||
                    typedObj["controlsSettings"]["customScheme"]["pan"]["mouseButton"] === MouseButton.RIGHT)) &&
            (typeof typedObj["controlsSettings"]["customScheme"]["zoom"] === "undefined" ||
                (typedObj["controlsSettings"]["customScheme"]["zoom"] !== null &&
                    typeof typedObj["controlsSettings"]["customScheme"]["zoom"] === "object" ||
                    typeof typedObj["controlsSettings"]["customScheme"]["zoom"] === "function") &&
                (typeof typedObj["controlsSettings"]["customScheme"]["zoom"]["key"] === "undefined" ||
                    typeof typedObj["controlsSettings"]["customScheme"]["zoom"]["key"] === "string") &&
                (typedObj["controlsSettings"]["customScheme"]["zoom"]["mouseButton"] === MouseButton.LEFT ||
                    typedObj["controlsSettings"]["customScheme"]["zoom"]["mouseButton"] === MouseButton.MIDDLE ||
                    typedObj["controlsSettings"]["customScheme"]["zoom"]["mouseButton"] === MouseButton.RIGHT)) &&
            (typeof typedObj["controlsSettings"]["customScheme"]["rotate"] === "undefined" ||
                (typedObj["controlsSettings"]["customScheme"]["rotate"] !== null &&
                    typeof typedObj["controlsSettings"]["customScheme"]["rotate"] === "object" ||
                    typeof typedObj["controlsSettings"]["customScheme"]["rotate"] === "function") &&
                (typeof typedObj["controlsSettings"]["customScheme"]["rotate"]["key"] === "undefined" ||
                    typeof typedObj["controlsSettings"]["customScheme"]["rotate"]["key"] === "string") &&
                (typedObj["controlsSettings"]["customScheme"]["rotate"]["mouseButton"] === MouseButton.LEFT ||
                    typedObj["controlsSettings"]["customScheme"]["rotate"]["mouseButton"] === MouseButton.MIDDLE ||
                    typedObj["controlsSettings"]["customScheme"]["rotate"]["mouseButton"] === MouseButton.RIGHT)))
    )
}
