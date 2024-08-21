import { DebouncedFunc } from "lodash";
import throttle from 'lodash.throttle';

import { ActionDescriptor } from 'photoshop/dom/CoreModules';
import { imaging } from 'photoshop/dom/ImagingModule';

import { WebviewTargetMessage, PluginTargetMessage } from "@api/types/Messages";

import { photoshop, uxp } from "./lib/globals";
import Queue from './lib/queue';
import SettingsManager from './lib/SettingsManager';
import { notify } from "./api/photoshop";

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

let documentDebouncers = new Map<number, DebouncedFunc<typeof getPixelsAndQueueForProcessing>>();

let lastActiveDocumentId: number;

let incorrectModeDocumentIdMessageShown = new Set<number>();


let idle = true;

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

/**
 * Initialization for the UXP Plugin Panel. This is the main entrypoint and brains of the plugin. 
 * init sets up the photoshop event listeners which wait for image changes to queue data, and the main update loop which waits 
 * for queued image data to send to the webview. init also does some other housekeeping including setting up lifecycle hooks.  
 */
function init()
{ 
  // Connect Hooks for UXP Lifecycle methods -- application first opened and application closed.
  uxp.entrypoints.setup({
    panels: {
      "mainPanel": {
        create(rootNode) {
          return new Promise(function (resolve, reject) {
            exitIdle();
            resolve(null);
          });
        },
        destroy(rootNode) {
          return new Promise(function (resolve, reject) {
            enterIdle();
            resolve(null);
          });
        }
      }
    }
  })

    // Connect Hooks for UXP Lifecycle methods -- panel opened and panel closed
  document.addEventListener('uxpcommand', (event) => {
    let commandId = (event as any).commandId;
    if (commandId === 'uxpshowpanel') {
      exitIdle();
    } else if (commandId === 'uxphidepanel') {
      enterIdle();
    }
  });


  settingsManager = new SettingsManager();

  // Connect listeners for photoshop actions
  // historyStateChanged fires when the image is changed
  PhotoshopAction.addNotificationListener(['historyStateChanged'], (event, descriptor) => handleImageChanged(descriptor.documentID));
  PhotoshopAction.addNotificationListener(["select"], onSelect);
  PhotoshopAction.addNotificationListener(["close"], onClose);
  PhotoshopAction.addNotificationListener(["newDocument"], (_e, d) => updateDocument());
  PhotoshopAction.addNotificationListener(["convertMode"], onColorModeChanged);

  // Setup message handler for messages sent from webview
  window.addEventListener("message", handleMessage);
  
  // Indicate to webview what the current open document is
  updateDocument();

  // Kick off initial image data processing for any currently open documents.
  pushAllUpdates();

  // Initialize main image data queue processing loop
  setInterval(processUpdates, 16);
}

/**
 * Enter idle state, wherein we take no action when image data changes. This also sets a delay before clearing the image data cache in the C++ code
 */
function enterIdle() {
  idle = true;
  setTimeout(async () => {
    if (!addon) {
      addon = await require("bolt-uxp-hybrid.uxpaddon");
    }
    console.log("Clearing C++ cache");
    app.documents.forEach((doc) => {
      addon.close_document(doc.id);
    })
  }, 30000);
}

function exitIdle() {
  idle = false;
  updateDocument();
  pushAllUpdates();
}

function pushAllUpdates() {
  app.documents.forEach(document => {
    handleImageChanged(document.id, true);
  });
}

/**
 * 
 * @param event the message received from webview
 */
function handleMessage(event: MessageEvent<PluginTargetMessage>) {
  let data = event.data;
  
  if (data.type === "Ready") {
    webviewReady = true;

    // This sends settings the user has saved, or the defaults so the UI is in sync
    postToWebview({type: "PUSH_SETTINGS", settings: settingsManager.getSettings()});

    // Notify the current document in case any changes occurred
    updateDocument();
  }
  else if (data.type === "RequestUpdate") {
    // This is generally when a new model is loaded and new texture data is needed.
    pushAllUpdates();
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
}

/**
 * Callback for whenever a document pixel data is changed. Performs rate-limiting to ensure many changes in quick succession don't result in slowdowns.
 * 
 * @param documentID The Photoshop document ID that was changed
 * @param forceFullUpdate A flag which will be set on the pixel data to ensure the full image data is sent to the webview. 
 */
async function handleImageChanged(documentID: number, forceFullUpdate: boolean = false): Promise<void>
{
  if (idle) {
    return;
  }
  if (forceFullUpdate) return getPixelsAndQueueForProcessing(documentID, forceFullUpdate); 

  // Use throttle to keep PS performance up and prevent the webview from being spammed by too many texture updates
  if (!documentDebouncers.has(documentID)) {
    documentDebouncers.set(documentID, throttle(getPixelsAndQueueForProcessing, 1000, {trailing: true, leading: true}));
  }
  
  let debouncedFunc = documentDebouncers.get(documentID)!;
  
  return debouncedFunc(documentID, forceFullUpdate);
}

/**
 * Async function which calls into the Photoshop imaging api for pixel data and queue the data for further processing
 * 
 * @param documentID The Photoshop document ID to query for imaging data 
 * @param forceFullUpdate A flag which will be set on the queued data to ensure the full image data is sent to the webview. 
 */
async function getPixelsAndQueueForProcessing(documentID: number, forceFullUpdate: boolean): Promise<void>
{
    try {
        console.log("queuing data for " + documentID);
        let document = app.documents.find((doc) => doc.id == documentID);
        if (!document) {
          return Promise.resolve();
        }

        if (document.mode != "RGBColorMode") {
          return Promise.resolve();
        }

        // Apply user settings for texture downscaling.
        let targetSize = {
          width: Math.round(document.width * targetSizeScaling),
          height: Math.round(document.height * targetSizeScaling)
        };

        let getPixelsResult = await executeAsModal((ctx,d) => imagingApi.getPixels({documentID: documentID, componentSize: 8, targetSize}), {commandName: "Updating Texture Data", interactive: true});
        
        let { width, height, components, componentSize } = getPixelsResult.imageData;
        let imagingData = getPixelsResult.imageData;
      
        // have to cast imagingData because the type definitions in the adobe library are wrong :/
        // matching the value of chunky to imagingData.isChunky is important for performance because it prevents ps from doing costly translation 
        // which we can do ourselves in the C++ code
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

/**
 * Check if any pixel update data is queued up. If it is, pick off a batch to transform for the webview, and send the transformed batch result to the webview. 
 */
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
        break;
      }
    }
  }
}

/**
 * Call into the C++ hybrid code to convert the array buffer data into a string. and optionally send that data to the webview. 
 * The c++ code will compare against cached image data to determine if sending an update to the webview is actually necessary.
 * 
 * The data being transformed into a string is necessary because postMessage to the webview always serializes the data to a string, 
 * so the string is made in C++ to do it faster than JS.
 * 
 * C++ is also faster at the cache comparison and converting planar-formatted data into chunky formatted data which three.js expects. 
 * 
 * @param update an object which contains the arraybuffer of pixel data along with batch sizing metadata
 * @returns a Promise which resolves to true if a transformed pixel data string was created.
 */
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

function onColorModeChanged(event: string, descriptor: ActionDescriptor) {
  if (descriptor.to._class ==="RGBColorMode") {
    incorrectModeDocumentIdMessageShown.delete(app.activeDocument.id);
  }
  updateDocument();
}

function updateDocument() {
  if (idle) return;

  let id = app.activeDocument.id;

  let document = app.documents.find((doc) => doc.id == id);
  if (document && document.mode != "RGBColorMode" && !incorrectModeDocumentIdMessageShown.has(id)) {
    notify("3D Preview: Non-RGB Color Modes are not supported at this time. Modify the color mode in Image > Mode > RGB Color.");
    incorrectModeDocumentIdMessageShown.add(id);
    return;
  }

  lastActiveDocumentId = app.activeDocument.id;

  postToWebview({type: "DOCUMENT_CHANGED", documentID: app.activeDocument.id});
}

function postToWebview(msg: WebviewTargetMessage) {
  webview.postMessage(msg, "*", null);
}

const approximatelyEqual = (v1: number, v2: number, epsilon = 0.001) =>
  Math.abs(v1 - v2) < epsilon;