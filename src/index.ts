import Queue from './lib/queue';

import { photoshop } from "./lib/globals";
import { ActionDescriptor } from 'photoshop/dom/CoreModules';
import { imaging } from 'photoshop/dom/ImagingModule';

import { DebouncedFunc } from "lodash";
import throttle from 'lodash.throttle';
import { WebviewTargetMessage, PluginTargetMessage } from "@api/types/Messages";
import SettingsManager from './lib/SettingsManager';

const BATCH_SIZE = 512 * 512;
let addon: any;
const app = photoshop.app;
const core = photoshop.core;
const PhotoshopAction = photoshop.action;  
const imagingApi = photoshop.imaging;
const executeAsModal = core.executeAsModal;
const webview = document.getElementById("panelWebview") as unknown as HTMLWebViewElement;


let settingsManager: SettingsManager;
let targetSizeScaling = 0.5;
let updates = new Queue<ImageUpdateData>();
let webviewReady = false;

let documentDebouncers = new Map<number, DebouncedFunc<typeof performPixelUpdate>>();

let lastActiveDocumentId: number;

interface ImageChangeDescriptor {
    documentID: number;
}

interface CloseDescriptor {
  documentID: number,
  _isCommand: boolean,
}

interface ImageUpdateData {
  documentID: number,
  width: number,
  height: number,
  components: number,
  componentSize: 8 | 16 | 32,
  pixelData: Uint8Array | Uint16Array | Float32Array;
  imagingData: imaging.PhotoshopImageData;
  totalPixels: number,
  pixelsPushed: number,
  forceFullUpdate: boolean,
}


init();

function init()
{  
  settingsManager = new SettingsManager();

  PhotoshopAction.addNotificationListener(['historyStateChanged'], (event, descriptor) => {console.log("Event:" + event + " Descriptor: " + JSON.stringify(descriptor))});
  // historyStateChanged fires whenever the image is changed
  PhotoshopAction.addNotificationListener(['historyStateChanged'], (event, descriptor) => handleImageChanged(descriptor.documentID));
  PhotoshopAction.addNotificationListener(["select"], onSelect);
  PhotoshopAction.addNotificationListener(["close"], onClose);
  PhotoshopAction.addNotificationListener(["newDocument"], (_e, d) => updateDocument());

  window.addEventListener("message", (e: MessageEvent<PluginTargetMessage>) => {
    let data = e.data;
    
    if (data.type === "Ready") {
      webviewReady = true;
      postToWebview({type: "PUSH_SETTINGS", settings: settingsManager.getSettings()});

      updateDocument();     
    }
    else if (data.type === "RequestUpdate") {
      pushAllUpdates();
    }
    else if (data.type === "ReturnFocus") {
      returnPhotoshopFocus();
    }
    else if (data.type === "UpdateSettings") {
      let newSettings = data.settings;
      settingsManager.updateSettings(newSettings);

      if (!approximatelyEqual(newSettings.displaySettings.textureResolutionScale, targetSizeScaling)) {
        targetSizeScaling = newSettings.displaySettings.textureResolutionScale;
        pushAllUpdates();
      }
    } else {
      console.error("Received Unknown Message:" + data);
    }
  });
  
  updateDocument();
  // Get Current Document Pixel Data
  pushAllUpdates();
  setInterval(processUpdates, 16);
}



function pushAllUpdates() {
  app.documents.forEach(document => {
    handleImageChanged(document.id, true);
  });
}

async function handleImageChanged(documentID: number, forceFullUpdate: boolean = false): Promise<void>
{
  if (forceFullUpdate) return performPixelUpdate(documentID, forceFullUpdate); 

  if (!documentDebouncers.has(documentID)) {
    
    documentDebouncers.set(documentID, throttle(performPixelUpdate, 2000, {trailing: true, leading: true}));
  }
  
  let debouncedFunc = documentDebouncers.get(documentID)!;
  
  return debouncedFunc(documentID, forceFullUpdate);
}

async function performPixelUpdate(documentID: number, forceFullUpdate: boolean): Promise<void>
{
    try {
        console.log("queuing data for " + documentID);
        console.log("Queue Pixel Data Start: " + window.performance.now());

        let document = app.documents.find((doc) => doc.id == documentID);
        if (!document) {
          return Promise.resolve();
        }

        let targetSize = {
          width: Math.round(document.width * targetSizeScaling),
          height: Math.round(document.height * targetSizeScaling)
        };

        let getPixelsResult = await executeAsModal((ctx,d) => imagingApi.getPixels({documentID: documentID, componentSize: 8, targetSize}), {commandName: "Updating Texture Data", interactive: true});
        await queuePixelData(documentID, getPixelsResult, forceFullUpdate);
    }
    catch(e: any) {
      if (e.number == 9) {
        console.error("executeAsModal was rejected (some other plugin is currently inside a modal scope)");
      }
      else {
        console.error(e);
      }
    }
}

async function queuePixelData(documentID: number, getPixelsResult: imaging.GetPixelsResult, forceFullUpdate: boolean) {
  console.log("Pixels gotten: " + window.performance.now());
  let { width, height, components, componentSize } = getPixelsResult.imageData;
  let imagingData = getPixelsResult.imageData;

  // force calling isChunky because the type def is inaccurate
  var pixelData = await imagingData.getData({chunky: (imagingData as any).isChunky});

  updates.enqueue({
    documentID, 
    width,
    height,
    components,
    componentSize,
    pixelData,
    imagingData,
    pixelsPushed: 0,
    totalPixels: width * height,
    forceFullUpdate,
  });


  console.log("Data queued: " + window.performance.now());
};

async function processUpdates() {
  if (!webviewReady) return;

  if (lastActiveDocumentId != app.activeDocument.id) {
    updateDocument();
  }


  let nextUpdate = updates.peek();
  if (nextUpdate) {
    let updateSent = false;
    while (!updateSent) {
      updateSent = await convertPixelDataToString(nextUpdate);

      if (nextUpdate.pixelsPushed >= nextUpdate.totalPixels) {
        if (!app.documents.find((d) => nextUpdate.documentID == d.id)) {
          // Reaffirm that we've closed all the resources in case any snuck through the end of the queue (unlikely)
          onClose(null, {documentID: nextUpdate.documentID, _isCommand: true}); 
        }

        nextUpdate.imagingData.dispose();
        updates.dequeue();
        console.log("Data dequeued: " + window.performance.now());
        break;
      }
    }
  }
}

async function convertPixelDataToString(update: ImageUpdateData): Promise<boolean> {
  try {
    if (!addon) {
      addon = await require("bolt-uxp-hybrid.uxpaddon");
    }

    const nextBatchSize = Math.min(BATCH_SIZE, update.totalPixels - update.pixelsPushed);
    
    const result = addon.convert_to_string(
      update.pixelData.buffer, update.documentID, update.components, 
      (update.imagingData as any).isChunky, update.pixelsPushed, nextBatchSize, update.forceFullUpdate
    );
    
    if (!update.forceFullUpdate && !result) {
      update.pixelsPushed += nextBatchSize;  
      return false;
    }


    postToWebview({
      type: "PARTIAL_UPDATE",
      documentID: update.documentID, 
      width: update.width, 
      height: update.height, 
      componentSize: update.componentSize,
      pixelBatchOffset: update.pixelsPushed,
      pixelBatchSize: nextBatchSize,
      pixelString: result
    });

    update.pixelsPushed += nextBatchSize;  
    return true;
  } catch (err) {
      console.log("Command failed", err);
  }
  return false;
}


function onSelect(event: string | null, descriptor: ActionDescriptor) {
  if (descriptor._target[0]._ref=="document") 
    updateDocument();
}

async function onClose(event: string | null, descriptor: ActionDescriptor | CloseDescriptor) {
  if (!descriptor._isCommand) return
  
  try {
    if (!addon) {
      addon = await require("bolt-uxp-hybrid.uxpaddon");
    }

    addon.close_document(descriptor.documentID);
    postToWebview({type: "DOCUMENT_CLOSED", documentID: descriptor.documentID});
    
    updateDocument();
  } catch (err) {
      console.log("Command failed", err);
  }
}


function updateDocument() {
  lastActiveDocumentId = app.activeDocument.id;
  postToWebview({type: "DOCUMENT_CHANGED", documentID: app.activeDocument.id});
}

function postToWebview(msg: WebviewTargetMessage) {
  webview.postMessage(msg, "*", null);
}

async function returnPhotoshopFocus() {
  // Undo and other keyboard shortcuts break after any interaction with a UXP panel !!!! 
  // This code works to make a standalone panel return focus, but not a panel which is docked in the main window.. TODO TODO TODO once adobe fixes this issue.
  // await core.executeAsModal(async (executionContext, descriptor) => {
  //   app.bringToFront();

  // }, {"commandName": "Return Focus"});
}


const approximatelyEqual = (v1: number, v2: number, epsilon = 0.001) =>
  Math.abs(v1 - v2) < epsilon;