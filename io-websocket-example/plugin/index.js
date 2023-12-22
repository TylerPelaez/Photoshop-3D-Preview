const { entrypoints } = require("uxp");
const fs = require('uxp').storage.localFileSystem;
const PhotoshopAction = require('photoshop').action;  
const imaging = require("photoshop").imaging;
const executeAsModal = require('photoshop').core.executeAsModal;

let initialized = false;
entrypoints.setup({
  panels: {
    websocket: {
      show() {
        // panel is already populated from the HTML; do nothing
      },
      menuItems: [
        {id: "connect", label: "Connect"}
      ],
      invokeMenu(id) {
        handleFlyout(id);
      }
    }
  }
});


async function onSendPixelData() {
  try {
      await executeAsModal(sendPixelData, {"commandName": "Updating Texture Data"})
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

async function sendPixelData(executionContext, descriptor) {
  console.log("entered");
  const imageObject = await imaging.getPixels({componentSize: 8});
  console.log("gotPixels");
  const pixelData = await imageObject.imageData.getData({chunky: false});

  websocket.send(pixelData);
}

const [ output, connectButton, disconnectButton, validateButton, state,
        randCheckbox, fastCheckbox, messageText, url ] = 
      ["output", "connect", "disconnect", "validate", "state",
       "rand", "fast", "text", "url"].map(el => document.querySelector(`#${el}`));

let websocket = null;
let receivedMessages = [];

log = msg => {
  output.textContent = msg;
}

connectButton.onclick = () => {
  if (websocket) {
    log("Already connected; disconnect first.");
    return;
  }
  receivedMessages = [];
  websocket = new WebSocket(url.value, "test-protocol");
  websocket.onopen = evt => {
    state.className="positive";
    state.textContent = "Connected";
    const menuItem = entrypoints.getPanel("websocket").menuItems.getItemAt(0);
    menuItem.label = "Disconnect";
    log("Connected");
  }
  websocket.onclose = evt => {
    console.log(JSON.stringify(evt));
    state.className="negative";
    state.textContent = "Disconnected";
    const menuItem = entrypoints.getPanel("websocket").menuItems.getItemAt(0);
    menuItem.label = "Connect";
    log("Disconnected");
    websocket = null;
  }
  websocket.onmessage = evt => {
    const [cmd, ...args] = evt.data.split("=");
    receivedMessages.push(evt.data);
    switch (cmd) {
      case "text":
        log(args.join("="));
        break;
      case "err":
        log(`Error from server: ${args.join("=")}`)
        break;
      default:
        log(`Don't know how to ${cmd}`);
    }
  }
  websocket.onerror = evt => {
    log(`Error: ${evt.data}`);
  }

}

disconnectButton.onclick = () => {
  if (websocket) {
    websocket.close();
  } else {
    log("Already disconnected.");
  }
  websocket = null;
}

validateButton.onclick = () => {
  onSendPixelData();
  // websocket.send(`validate=${receivedMessages.join("\n")}`)
}

messageText.addEventListener("keydown", evt => {
  if (evt.key === "Enter") {
    if (!websocket) {
      log("Connect first!");
      return;
    }
    websocket.send(messageText.value);
    messageText.value = "";
  }
});

randCheckbox.onclick = evt => {
  if (!websocket) {
    log("Connect first!");
    return;
  }
  const value = evt.target.checked ? "on" : "off";
  websocket.send(`rand=${value}`);
}

fastCheckbox.onclick = evt => {
  if (!websocket) {
    log("Connect first!");
    return;
  }
  const value = evt.target.checked ? "on" : "off";
  websocket.send(`fast=${value}`);
}

function handleFlyout(id) {
  switch (id) {
    case "connect": {
      if (websocket) {
        websocket.close();
      } else {
        connectButton.onclick();
      }
    }
  }
}
