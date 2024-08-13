const Queue = require('./src/queue');
const uxp = require('uxp');
const fs = require('uxp').storage.localFileSystem;
const app = require('photoshop').app;
const core = require('photoshop').core;
const PhotoshopAction = require('photoshop').action;  
const imaging = require("photoshop").imaging;
const executeAsModal = require('photoshop').core.executeAsModal;

let updates = new Queue();
let webviewReady = false;
let components = 3;

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
    setInterval(processUpdates, 6);
}

function getPixelData(documentID) {
    console.log("getting data for " + documentID);
    const imagePromise = imaging.getPixels({documentID: documentID, componentSize: 8});
    const pixelPromise = imagePromise.then(function(imageObject) {
      components = imageObject.imageData.components;
      console.log("Get Pixels: " + window.performance.now());

      return imageObject.imageData.getData({chunky: true});
    });
    
    updates.enqueue({documentID, pixelPromise});
}

function pushAllUpdates() {
  app.documents.forEach(document => {
    handleImageChanged(null, {documentID: document.id});
  });
}

async function handleImageChanged(event, descriptor)
{
    var documentID = descriptor.documentID;
    try {
        await executeAsModal((ctx,d) => getPixelData(documentID), {"commandName": "Updating Texture Data"});
    }
    catch(e) {
        if (e.number == 9) {
            showAlert("executeAsModal was rejected (some other plugin is currently inside a modal scope)");
        }
        else {
            showAlert(e);
        }
    }
}

async function processUpdates() {
  if (!webviewReady) return;

  let currentPixelDataPromise = updates.peek();
  if (currentPixelDataPromise) {
      updates.dequeue();
      console.log("Process: " + window.performance.now());
      await Promise.resolve(currentPixelDataPromise.pixelPromise).then(function(currentPixelData) {
          sendFullPixelData(currentPixelDataPromise.documentID, currentPixelData);
      });
      console.log("PostProcess: " + window.performance.now());
  }
}

function sendFullPixelData(documentID, fullPixelData) {
  const panelWebview = document.getElementById("panelWebview");
  console.log("Send start: " + window.performance.now());

  let chosenDocument;
  app.documents.forEach(d => {
    if (d.id == documentID) {
      chosenDocument = d;
    }
  });

  if (!chosenDocument) return;
  

  const width = chosenDocument.width;
  const height = chosenDocument.height;

  var modifiedPixelData;

  if (components == 4) {
    modifiedPixelData = new Array(4 * width * height);
    for (var i = 0; i < fullPixelData.length; i++) {
      modifiedPixelData[i] = String.fromCharCode(fullPixelData[i]);
    }
  }
  else {
    modifiedPixelData = new Array(4 * width * height);

    let current_pixel_index = 0;
    for (var i = 0; i < fullPixelData.length; i++) {
      let rgba_index = current_pixel_index + (i % 3);

      modifiedPixelData[rgba_index] = String.fromCharCode(fullPixelData[i]);

      // Set alpha channel to 255
      if (i % 3 == 2 && i != 0) {
        modifiedPixelData[rgba_index + 1] = "ÿ"; // The 255 charcode
        current_pixel_index += 4;
      }
    }
  }

  console.log("Conversion Done: " + window.performance.now());

  var pixelString = modifiedPixelData.join("");

  panelWebview.postMessage( {type: "FULL_UPDATE", pixels: pixelString, width: width, height: height, components: components, documentID: documentID});
  console.log("Post Done: " + window.performance.now());
}

function onSelect(event, descriptor) {
  console.log("Event:" + event + " Descriptor: " + JSON.stringify(descriptor));
  if (descriptor._target[0]._ref=="document") 
    updateDocument();
}

function updateDocument() {
  const panelWebview = document.getElementById("panelWebview");
  panelWebview.postMessage({type: "DOCUMENT_CHANGED", documentID: app.activeDocument.id});
}

async function returnPhotoshopFocus() {
  // Undo and other keyboard shortcuts break after any interaction with a UXP panel !!!! 
  // This code works to make a standalone panel return focus, but not a panel which is docked in the main window.. TODO TODO TODO once adobe fixes this issue.
  // await core.executeAsModal(async (executionContext, descriptor) => {
  //   app.bringToFront();

  // }, {"commandName": "Return Focus"});
}



