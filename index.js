const Queue = require('./src/queue');
const uxp = require('uxp');
const fs = require('uxp').storage.localFileSystem;
const PhotoshopAction = require('photoshop').action;  
const imaging = require("photoshop").imaging;
const executeAsModal = require('photoshop').core.executeAsModal;

let updates = new Queue();
let currentUpdateProgress = 0;
var globalCurrentPixelData;

function init()
{
    PhotoshopAction.addNotificationListener(['historyStateChanged'], (event, descriptor) => {console.log("Event:" + event + " Descriptor: " + JSON.stringify(descriptor))});
    // historyStateChanged fires whenever the image is changed
    PhotoshopAction.addNotificationListener(['historyStateChanged'], handleImageChanged);

    setInterval(processUpdates, 33); // 30 ticks per second.
}

function getPixelData(executionContext, descriptor) {
    console.log("entered");
    const imagePromise = imaging.getPixels({componentSize: 8});
    console.log("gotPixels");
    const pixelPromise = imagePromise.then(imageObject => imageObject.imageData.getData({chunky: false}));

    console.log("gotData");
    queueUpdates(pixelPromise);
}

async function handleImageChanged() {
    try {
        await executeAsModal(getPixelData, {"commandName": "Updating Texture Data"})
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

function queueUpdates(pixelData) {
    updates.enqueue(pixelData);
}

async function processUpdates() {
  let currentPixelDataPromise = updates.peek();
  if (currentPixelDataPromise) {
      await Promise.resolve(currentPixelDataPromise).then(function(currentPixelData) {

          console.log("posting")
  
          globalCurrentPixelData = updates.dequeue();

          const panelWebview = document.getElementById("panelWebview");
          panelWebview.postMessage("dataUpdated");
      });
  }
}

// async function processUpdates() {
//     let currentPixelDataPromise = updates.peek();
//     if (currentPixelDataPromise) {
//         await Promise.resolve(currentPixelDataPromise).then(function(currentPixelData) {
//             let byteOffset = currentUpdateProgress;

//             let messageLength = currentPixelData.length / 100;
//             console.log(messageLength);

//             if (byteOffset + messageLength >= currentPixelData.length) {
//                 messageLength = currentPixelData.length - byteOffset;
//                 updates.dequeue();
//                 console.log("Dequeued");
//                 currentUpdateProgress = 0;
//             } else {
//                 currentUpdateProgress += messageLength;
//             }

//             console.log("posting")
//             let message = new Uint8Array(currentPixelData, byteOffset, messageLength); 
    
//             const panelWebview = document.getElementById("panelWebview");
//             panelWebview.postMessage(message);
//         });
//     }
// }

init();





