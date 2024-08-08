const Queue = require('./src/queue');
const uxp = require('uxp');
const fs = require('uxp').storage.localFileSystem;
const app = require('photoshop').app;
const PhotoshopAction = require('photoshop').action;  
const imaging = require("photoshop").imaging;
const executeAsModal = require('photoshop').core.executeAsModal;

let updates = new Queue();
let fullPixelData;
let webviewReady = false;
let components = 3;

function init()
{  
    //PhotoshopAction.addNotificationListener(['all'], (event, descriptor) => {console.log("Event:" + event + " Descriptor: " + JSON.stringify(descriptor))});
    PhotoshopAction.addNotificationListener(['historyStateChanged'], (event, descriptor) => {console.log("Event:" + event + " Descriptor: " + JSON.stringify(descriptor))});
    // historyStateChanged fires whenever the image is changed
    PhotoshopAction.addNotificationListener(['historyStateChanged'], handleImageChanged);



    window.addEventListener("message", (e) => {
      if (e.data === "Ready") {
        webviewReady = true;        
      }
      else if (e.data == "RequestUpdate") {
        handleImageChanged();
      }
    });
    
    // Get Current Document Pixel Data
    handleImageChanged();
    setInterval(processUpdates, 6);
}

function getPixelData(executionContext, descriptor) {
    const imagePromise = imaging.getPixels({componentSize: 8});
    const pixelPromise = imagePromise.then(function(imageObject) {
      components = imageObject.imageData.components;
      console.log("Get Pixels: " + window.performance.now());

      return imageObject.imageData.getData({chunky: true});
    });
    
    updates.enqueue(pixelPromise);
}

async function handleImageChanged() 
{
    console.log("Image Changed: " + window.performance.now());
    try {
        await executeAsModal(getPixelData, {"commandName": "Updating Texture Data"});
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
      await Promise.resolve(currentPixelDataPromise).then(function(currentPixelData) {
          fullPixelData = currentPixelData;
          sendFullPixelData();
      });
      console.log("PostProcess: " + window.performance.now());
  }
}

function sendFullPixelData() {
  const panelWebview = document.getElementById("panelWebview");
//  console.log(fullPixelData);
  console.log("Send Start: " + window.performance.now());

  const width = app.activeDocument.width;
  const height = app.activeDocument.height;

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

  console.log("Pre Post: " + window.performance.now());

  var pixelString = modifiedPixelData.join("");
  console.log("Buffer: " + window.performance.now());

  panelWebview.postMessage( {type: "FULL_UPDATE", pixels: pixelString, width: width, height: height, components: components});
  console.log("Post Done: " + window.performance.now());

}

init();

