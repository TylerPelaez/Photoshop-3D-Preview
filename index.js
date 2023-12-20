const uxp = require('uxp');
const fs = require('uxp').storage.localFileSystem;

const webviewInPanel = document.getElementById("webviewInPanel");
  

const loadFile = async () => {
    const file = await fs.getFileForOpening({allowMultiple: false, types: ["obj"]});
    if (!file) {
      console.log("No file selected");
      return null;
    }

    return await file.read();
}


const handleLoadModelBtn = async () => {
    var fileData = await loadFile();
    if (!fileData) {
        console.log("No file data");
        return;
    }

    console.log("File data found");

    const panelWebview = document.getElementById("panelWebview");
    panelWebview.postMessage({path: "load", fileData: fileData}, [fileData]);
}


const loadModelBtn = document.getElementById("loadModelBtn");
loadModelBtn.onclick = handleLoadModelBtn;


// ======= receive message from webview content =======
window.addEventListener("message", (e) => {
    console.log(`Message from WebView(Origin:${e.origin}): ${e.data}`);
    if (e.data.key === "imageDetails") {
        document.getElementById("snapshot").src = e.data.value;
    } else if (e.data.key === "canvasDetails") {
        document.getElementById("logWebview").innerText = e.data.value;
    }
});
