import { UserSettings } from "./Settings";

export interface PartialUpdate {
  type: "PARTIAL_UPDATE",
  documentID: number, 
  width: number,
  height: number, 
  componentSize: number,
  pixelBatchOffset: number,
  pixelBatchSize: number,
  pixelString: string,
}

export interface DocumentClosed {
  type: "DOCUMENT_CLOSED",
  documentID: number,
}

export interface DocumentChanged {
  type: "DOCUMENT_CHANGED",
  documentID: number,
}

export interface PushSettings {
  type: "PUSH_SETTINGS",
  settings: UserSettings,
}


export interface Ready { type: "Ready" };
export interface RequestUpdate { type: "RequestUpdate" };
export interface UpdateSettings { type: "UpdateSettings", settings: UserSettings };


export type WebviewTargetMessage = PartialUpdate | DocumentChanged | DocumentClosed | PushSettings;
export type PluginTargetMessage = Ready | RequestUpdate | UpdateSettings;