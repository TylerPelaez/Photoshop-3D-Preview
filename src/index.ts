import Queue from './lib/queue';

import { photoshop } from "./globals";
import { ActionDescriptor } from 'photoshop/dom/CoreModules';
import { notify } from './api/photoshop';

const app = photoshop.app;
const core = photoshop.core;
const PhotoshopAction = photoshop.action;  
const imaging = photoshop.imaging;
const executeAsModal = core.executeAsModal;

let updates = new Queue<ImageUpdateData>();
let webviewReady = false;

interface ImageChangeDescriptor {
    documentID: number;
}

interface ImageUpdateData {
  documentID: number,
  width: number,
  height: number,
  components: number,
  componentSize: 8 | 16 | 32,
  pixelData: Uint8Array | Uint16Array | Float32Array;
}

init();

function init()
{  
    PhotoshopAction.addNotificationListener(['historyStateChanged'], (event, descriptor) => {console.log("Event:" + event + " Descriptor: " + JSON.stringify(descriptor))});
    // historyStateChanged fires whenever the image is changed
    PhotoshopAction.addNotificationListener(['historyStateChanged'], handleImageChanged);
    PhotoshopAction.addNotificationListener(["select"], onSelect);

    window.addEventListener("message", (e) => {
      if (e.data === "Ready") {
        webviewReady = true;   
        updateDocument();     
      }
      else if (e.data === "RequestUpdate") {
        pushAllUpdates();
      }
      else if (e.data === "ReturnFocus") {
        returnPhotoshopFocus();
      }
    });
    
    updateDocument();
    // Get Current Document Pixel Data
    pushAllUpdates();
    setInterval(processUpdates, 16);
}



function pushAllUpdates() {
  app.documents.forEach(document => {
    handleImageChanged(null, {documentID: document.id});
  });
}

async function handleImageChanged(event: string | null, descriptor: ActionDescriptor | ImageChangeDescriptor)
{
    var documentID = descriptor.documentID;
    try {
        await executeAsModal((ctx,d) => queuePixelData(documentID), {"commandName": "Updating Texture Data"});
    }
    catch(e: any) {
        if (e.number == 9) {
            notify("executeAsModal was rejected (some other plugin is currently inside a modal scope)");
        }
        else {
          notify(e);
        }
    }
}

async function queuePixelData(documentID: number) {
  console.log("queuing data for " + documentID);
  console.log("Queue Pixel Data Start: " + window.performance.now());

  const imagePromise = imaging.getPixels({documentID: documentID, componentSize: 8});
  const pixelPromise = imagePromise.then(async function(getPixelsResult) {
    console.log("Pixels gotten: " + window.performance.now());
    let { width, height, components, componentSize } = getPixelsResult.imageData;

    var pixelData = await getPixelsResult.imageData.getData({chunky: true});
    
    console.log("Data gotten: " + window.performance.now());

    updates.enqueue({
      documentID, 
      width,
      height,
      components,
      componentSize,
      pixelData
    });
  });

  await pixelPromise;
}

async function processUpdates() {
  if (!webviewReady) return;

  let nextUpdate = updates.peek();
  if (nextUpdate) {
      updates.dequeue();
      console.log("Dequeued: " + window.performance.now());
      await sendFullPixelData(nextUpdate);
      console.log("PostProcess: " + window.performance.now());
  }
}

function sendFullPixelData(update: ImageUpdateData): Promise<void> {
  const {documentID, width, height, components, componentSize} = update;

  let webview = document.getElementById("panelWebview") as unknown as HTMLWebViewElement;

  console.log("Send start: " + window.performance.now());

  let chosenDocument;
  app.documents.forEach(d => {
    if (d.id == documentID) {
      chosenDocument = d;
    }
  });

  if (!chosenDocument) return Promise.resolve();

  return convertPixelDataToString(update).then(modifiedPixelData => {
    console.log("Conversion Done: " + window.performance.now());
    webview.postMessage({type: "FULL_UPDATE", pixels: modifiedPixelData, width, height, components, componentSize, documentID}, "*", null);
    console.log("Post Done: " + window.performance.now());
  });
}


async function convertPixelDataToString(update: ImageUpdateData): Promise<string | undefined> {
    try {
        const addon = await require("bolt-uxp-hybrid.uxpaddon");
        const result = addon.convert_to_string(update.width, update.height, update.components, update.pixelData.buffer);
        return result;
    } catch (err) {
        console.log("Command failed", err);
    }
}


function onSelect(event: string, descriptor: ActionDescriptor) {
  console.log("test");
  console.log("Event:" + event + " Descriptor: " + JSON.stringify(descriptor));
  if (descriptor._target[0]._ref=="document") 
    updateDocument();
}

function updateDocument() {
  const panelWebview = document.getElementById("panelWebview") as unknown as HTMLWebViewElement;
  panelWebview.postMessage({type: "DOCUMENT_CHANGED", documentID: app.activeDocument.id}, "*", null);
}

async function returnPhotoshopFocus() {
  // Undo and other keyboard shortcuts break after any interaction with a UXP panel !!!! 
  // This code works to make a standalone panel return focus, but not a panel which is docked in the main window.. TODO TODO TODO once adobe fixes this issue.
  // await core.executeAsModal(async (executionContext, descriptor) => {
  //   app.bringToFront();

  // }, {"commandName": "Return Focus"});
}



