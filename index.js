const Queue = require('./src/queue');
const uxp = require('uxp');
const fs = require('uxp').storage.localFileSystem;
const PhotoshopAction = require('photoshop').action;  
const imaging = require("photoshop").imaging;
const executeAsModal = require('photoshop').core.executeAsModal;

let updates = new Queue();
let currentUpdateProgress = 0;

function init()
{
    PhotoshopAction.addNotificationListener(['historyStateChanged'], (event, descriptor) => {console.log("Event:" + event + " Descriptor: " + JSON.stringify(descriptor))});
    // historyStateChanged fires whenever the image is changed
    PhotoshopAction.addNotificationListener(['historyStateChanged'], handleImageChanged);

    setInterval(processUpdates, 33); // 30 ticks per second.
}


async function loadFile() {
    const file = await fs.getFileForOpening({allowMultiple: false, types: ["obj"]});
    if (!file) {
      console.log("No file selected");
      return null;
    }

    return await file.read();
}

async function handleLoadModelBtn() {
    var fileData = await loadFile();
    if (!fileData) {
        console.log("No file data");
        return;
    }

    console.log("File data found");

    const panelWebview = document.getElementById("panelWebview");
    panelWebview.postMessage({path: "load", fileData: fileData}, [fileData]);
}

async function getPixelData(executionContext, descriptor) {
    console.log("entered");
    const imageObj = await imaging.getPixels({componentSize: 8});
    console.log("gotPixels");
    const pixelData = await imageObj.imageData.getData({chunky: false});
    console.log("gotData");
    queueUpdates(pixelData);
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

function processUpdates() {
    var currentPixelData = updates.peek();
    const panelWebview = document.getElementById("panelWebview");
    panelWebview.postMessage(currentPixelData);
    console.log("Queued");
}

init();





