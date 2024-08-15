import Queue from './lib/queue';

import { photoshop } from "./globals";
import { ActionDescriptor } from 'photoshop/dom/CoreModules';
import { notify } from './api/photoshop';
import { imaging } from 'photoshop/dom/ImagingModule';

import { DebouncedFunc } from "lodash";
import throttle from 'lodash.throttle';

const BATCH_SIZE = 512 * 512;
let addon: any;
const app = photoshop.app;
const core = photoshop.core;
const PhotoshopAction = photoshop.action;  
const imagingApi = photoshop.imaging;
const executeAsModal = core.executeAsModal;
const webview = document.getElementById("panelWebview") as unknown as HTMLWebViewElement;


let targetSizeScaling = 0.5;
let updates = new Queue<ImageUpdateData>();
let webviewReady = false;

let documentDebouncers = new Map<number, DebouncedFunc<typeof performPixelUpdate>>();



interface ImageChangeDescriptor {
    documentID: number;
}

interface UpdateMessage {
  type: "FULL_UPDATE" | "PARTIAL_UPDATE",
  documentID: number,
  width: number,
  height: number,
  componentSize: number,
  pixelString: string,
  pixelBatchSize: number,
  pixelBatchOffset: number,
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
      else if (e.data === "HalfRes") {
        targetSizeScaling = 0.5;
        pushAllUpdates();
      } else if (e.data === "FullRes") {
        targetSizeScaling = 1;
        pushAllUpdates();
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

async function handleImageChanged(_event: string | null, descriptor: ActionDescriptor | ImageChangeDescriptor): Promise<void>
{
    var documentID = descriptor.documentID;

    if (!documentDebouncers.has(documentID)) {
      
      documentDebouncers.set(documentID, throttle(performPixelUpdate, 2000, {trailing: true, leading: true}));
    }
    
    let debouncedFunc = documentDebouncers.get(documentID)!;
    
    return debouncedFunc(documentID);
}

async function performPixelUpdate(documentID: number): Promise<void>
{
    try {
        console.log("queuing data for " + documentID);
        console.log("Queue Pixel Data Start: " + window.performance.now());

        let document = app.documents.find((doc) => doc.id == documentID)!;

        let targetSize = {
          width: Math.round(document.width * targetSizeScaling),
          height: Math.round(document.height * targetSizeScaling)
        };

        let getPixelsResult = await executeAsModal((ctx,d) => imagingApi.getPixels({documentID: documentID, componentSize: 8, targetSize}), {commandName: "Updating Texture Data", interactive: true});
        await queuePixelData(documentID, getPixelsResult);
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

async function queuePixelData(documentID: number, getPixelsResult: imaging.GetPixelsResult) {
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
    totalPixels: width * height
  });



  console.log("Data queued: " + window.performance.now());
};

async function processUpdates() {
  if (!webviewReady) return;

  let nextUpdate = updates.peek();
  if (nextUpdate) {
      await convertPixelDataToString(nextUpdate);

      if (nextUpdate.pixelsPushed >= nextUpdate.totalPixels) {
        nextUpdate.imagingData.dispose();
        updates.dequeue();
        console.log("Data dequeued: " + window.performance.now());
      }
  }
}

async function convertPixelDataToString(update: ImageUpdateData): Promise<void> {
  try {
    console.log("Start Convert: " + window.performance.now());


    if (!addon) {
      addon = await require("bolt-uxp-hybrid.uxpaddon");
    }

    const nextBatchSize = Math.min(BATCH_SIZE, update.totalPixels - update.pixelsPushed);
    
    const result = addon.convert_to_string(
      update.pixelData.buffer, update.documentID, update.components, 
      (update.imagingData as any).isChunky, update.pixelsPushed, nextBatchSize
    );
    
    if (!result) {
      update.pixelsPushed += nextBatchSize;  
      console.log("Batch skipped: " + window.performance.now());
      return;
    }

    console.log("Start Post: " + window.performance.now());

    webview.postMessage({
      type: "PARTIAL_UPDATE",
      documentID: update.documentID, 
      width: update.width, 
      height: update.height, 
      componentSize: update.componentSize,
      pixelBatchOffset: update.pixelsPushed,
      pixelBatchSize: nextBatchSize,
      pixelString: result
    }, "*", null);
    update.pixelsPushed += nextBatchSize;  

    console.log("Finish Convert: " + window.performance.now());
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



