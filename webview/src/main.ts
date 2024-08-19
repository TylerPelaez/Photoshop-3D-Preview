import React from 'react';
import { createRoot, Root } from 'react-dom/client';

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ViewportGizmo } from './three-viewport-gizmo/ViewportGizmo.ts';
import {Tween} from '@tweenjs/tween.js'


import { ControlScheme, ControlSchemeType, InputCombination, MouseButton, UserSettings } from "@api/types/Settings";
import { BuiltInSchemes } from "./util/util.ts"
import { DocumentClosed, PartialUpdate, PluginTargetMessage, WebviewTargetMessage } from "@api/types/Messages";

import App from './components/App';
import { choiceStrings } from './components/ContextMenu.tsx';
import './output.css';
import ResourceManager from './util/ResourceManager.ts';

// The Plugin host will set this on the window automatically, just clarify for typescript that the field is expected.
declare global {
  interface Window {
      uxpHost:any;
  }
}

const loaders = {  
  obj: new OBJLoader(),
  fbx: new FBXLoader(),
  gltf: new GLTFLoader(),
  glb: new GLTFLoader(),
};

const raycaster = new THREE.Raycaster();

let scene : THREE.Scene;

let camera : THREE.PerspectiveCamera;
let renderer : THREE.WebGLRenderer;

let viewportGizmo : ViewportGizmo;

let currentObject : THREE.Object3D;
let controls : OrbitControls;
let grid: THREE.GridHelper;

let resourceManager: ResourceManager;
let activeDocument: number;

let userSettings: UserSettings;

let tween : Tween;

let root : Root;

let currentlySelectedObject : THREE.Object3D | null;
let outlineObject: THREE.Object3D | null;

let contextMenuOpen : boolean = false;
let pressedKeys: {[_keyName: string]: boolean} = {};

let lightTarget: THREE.Object3D;
let light: THREE.DirectionalLight;

let lightingMode: "Unlit" | "Lit" = "Unlit"; 


init();

function init() {
  // Init React root. The actual UI Components are inserted for the first time in renderUI().
  // (UI Depends on receiving the User Settings from the plugin)
  const reactRoot = document.getElementById('reactRoot');
  root = createRoot(reactRoot as HTMLElement);

  // Init Three.js scene and helper oobjects
  scene = new THREE.Scene();
  scene.background = new THREE.Color("#4D4D4D");

  renderer = new THREE.WebGLRenderer({canvas: document.getElementById('htmlCanvas') as HTMLCanvasElement, antialias: true});
  renderer.setAnimationLoop( render );

  camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
  camera.position.set( 3, 3.5, 2 );
  scene.add(camera);

  controls = new OrbitControls( camera, renderer.domElement );
  controls.addEventListener( 'change', onCameraMoved);

  viewportGizmo = new ViewportGizmo(camera, renderer, {size: 75});
  viewportGizmo.target = controls.target;

  light = new THREE.DirectionalLight();
  lightTarget = new THREE.Object3D();

  scene.add(light);
  scene.add(lightTarget);

  light.position.set(-10,10,-10);
  light.target = lightTarget;


  resourceManager = new ResourceManager(scene);

  window.addEventListener("message", onMessageReceived);
  window.addEventListener("resize", onWindowResize);
  window.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  onWindowResize();

  postPluginMessage({type: "Ready"});
}

function render(time: DOMHighResTimeStamp, _frame: XRFrame)  {
  if (tween && tween.isPlaying()) tween.update(time);
  renderer.render( scene, camera );
  viewportGizmo.render();
}

function onCameraMoved() {
  if (contextMenuOpen) renderUI(false);
  viewportGizmo.update();
  returnFocus();
}

function postPluginMessage(data: PluginTargetMessage) {
  window.uxpHost.postMessage(data);
}

//#region Plugin Message Handlers
function onMessageReceived(event: MessageEvent<WebviewTargetMessage>) {
  let data = event.data;
  if (data.type == "PARTIAL_UPDATE") {
    handleUpdate(data);
  } else if (data.type == "DOCUMENT_CHANGED") {
    activeDocument = data.documentID;
  } else if (data.type == "DOCUMENT_CLOSED") {
    handleDocumentClosed(data);
  } else if (data.type == "PUSH_SETTINGS") {
    onUpdateSettings(data.settings, false);
  }
}

function handleUpdate(data: PartialUpdate) {
  let width = data.width;
  let height = data.height;  
  let documentID = data.documentID;

  let pixelData: Uint8Array;

  let pixelDataLength = 4 * width * height;
  let pixelStringStartIndex = data.pixelBatchOffset * 4;
  let pixelStringEndIndex = pixelStringStartIndex + data.pixelBatchSize * 4;


  let texture = resourceManager.getTextureForDocumentId(documentID);

  if (!texture || texture.image.width != width || texture.image.height != height) {
    pixelData = new Uint8Array(pixelDataLength);

    for (let i = 0; i < pixelStringStartIndex; i++) {
      pixelData[i] = 0;
    }
    for (let i = pixelStringStartIndex; i < pixelStringEndIndex; i++) {
      pixelData[i] = data.pixelString.charCodeAt(i - pixelStringStartIndex);
    }
    for (let i = pixelStringEndIndex; i < pixelDataLength; i++) {
      pixelData[i] = 0;
    }

    texture = new THREE.DataTexture(pixelData, width, height);
    texture.flipY = true;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = texture.minFilter = THREE.LinearFilter;
    
    resourceManager.setDocumentTexture(documentID, texture);
  } else {
    pixelData = texture.image.data as Uint8Array;

    for (let i = 0; i < data.pixelString.length; i++) {
      pixelData[pixelStringStartIndex + i] = data.pixelString.charCodeAt(i);
    }
  }


  texture.needsUpdate = true;
}


function handleDocumentClosed(data: DocumentClosed) {
  resourceManager.removeDocument(data.documentID);
}

//#endregion

//#region Input Event Handlers


function updateOrbitControls() {
  let scheme: ControlScheme;

  if (userSettings.controlsSettings.scheme != ControlSchemeType.CUSTOM) {
    scheme = BuiltInSchemes.get(userSettings.controlsSettings.scheme)!;
  } else {
    scheme = userSettings.controlsSettings.customScheme!;
  }

  controls.mouseButtons.LEFT = controls.mouseButtons.MIDDLE = controls.mouseButtons.RIGHT = null;

  const assignToCameraControl = function(inputCombo: InputCombination,  cameraControl: THREE.MOUSE) {
    if (inputCombo.key && !pressedKeys[inputCombo.key]) return;

    switch (inputCombo.mouseButton) {
      case MouseButton.LEFT:
        controls.mouseButtons.LEFT = cameraControl;
        break;
       case MouseButton.MIDDLE:
        controls.mouseButtons.MIDDLE = cameraControl;
        break;
      case MouseButton.RIGHT:
        controls.mouseButtons.RIGHT = cameraControl;
        break;
    }
  }

  if (scheme.pan) assignToCameraControl(scheme.pan, THREE.MOUSE.PAN);
  if (scheme.rotate) assignToCameraControl(scheme.rotate, THREE.MOUSE.ROTATE);
  if (scheme.zoom) assignToCameraControl(scheme.zoom, THREE.MOUSE.DOLLY);
}

function onKeyDown(event: KeyboardEvent) {
  pressedKeys[event.key] = true;
  updateOrbitControls();
}


function onKeyUp(event: KeyboardEvent) {
  pressedKeys[event.key] = false;
  updateOrbitControls();
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize( window.innerWidth, window.innerHeight );
  viewportGizmo.update();
}

function getObjectAtCursor(event: MouseEvent): THREE.Object3D | null {
  let pointer = new THREE.Vector2();
  pointer.x = ( event.clientX / window.innerWidth ) * 2 - 1;
  pointer.y = - (event.clientY / window.innerHeight ) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  let intersects = raycaster.intersectObjects( scene.children );
  
  if (intersects.length == 0) return null;

  let minDistance = Number.MAX_SAFE_INTEGER;
  let minIndex = -1;


  for ( let i = 0; i < intersects.length; i ++ ) {
    let obj = intersects[i].object;
    if (obj instanceof THREE.Line) continue;
    if (obj == outlineObject) continue;
    if (intersects[i].distance < minDistance) {
      minDistance = intersects[i].distance;
      minIndex = i;
    }
  }


  if (minIndex < 0) return null;

  return intersects[minIndex].object;
}

function selectObject(object: THREE.Object3D | null) {
  if (currentlySelectedObject == object) return;

  if (currentlySelectedObject != null) {
    scene.remove(outlineObject!);
  }

  currentlySelectedObject = object;
  if (currentlySelectedObject != null) {
    if (object instanceof THREE.Mesh) {
      console.log(object);

      let material = new THREE.MeshBasicMaterial( {color: new THREE.Color("#338EF7"), side: THREE.BackSide } );
      outlineObject = new THREE.Object3D();

      let center = new THREE.Vector3();

      object.geometry.computeBoundingBox();
      object.geometry.boundingBox.getCenter(center);

      let offset = new THREE.Vector3();
      offset.addVectors(center, object.position);

      outlineObject.position.set(offset.x, offset.y, offset.z);
      let geometry = new THREE.Mesh(object.geometry, material);
      outlineObject.attach(geometry);

      geometry.position.set(-center.x, -center.y, -center.z);
      outlineObject.scale.multiplyScalar(1.05);
      scene.add(outlineObject);
    }
  }
}


function onPointerDown(event: PointerEvent) {
  if (contextMenuOpen) {
    renderUI(false);
  }

  let obj = getObjectAtCursor(event);
  
  if (event.button == 0 && controls.mouseButtons.LEFT == null) {
    selectObject(obj);
  } else if (event.button == 2 && controls.mouseButtons.RIGHT == null) {
    renderUI(true, new THREE.Vector2(event.clientX, event.clientY));
  }
}

//#endregion

//#region UI Rendering and callbacks

function renderUI(contextMenuVisible: boolean, contextMenuPosition: THREE.Vector2 = new THREE.Vector2(0, 0)) {
  if (!userSettings) return;

  root.render(React.createElement(App, {
    userSettings: userSettings, 
    onUpdateSettings: onUpdateSettings, 
    onModelLoad: onLoadButtonClicked,
    contextMenuOpen: contextMenuVisible,
    hasObjectSelected: currentlySelectedObject != null,
    contextMenuPosition: contextMenuPosition,
    onContextMenuChoiceMade: onContextMenuChoiceMade
  }));

  contextMenuOpen = contextMenuVisible;
}

function onContextMenuChoiceMade(key: choiceStrings) {
  if (!currentlySelectedObject) {
    console.warn("No Object selected for context menu");
    return;
  }
  if (key == "FOCUS") {
    tween = new Tween(controls.target)
    .to(currentlySelectedObject.position, 75)
    .onUpdate((val) => {
      controls.target = val;
      camera.lookAt(val);
    })
    .start();
  } else if (key == "APPLY") {
    if (currentlySelectedObject instanceof THREE.Mesh) {
      let texture = resourceManager.getTextureForDocumentId(activeDocument);
      if (texture) {
        let newMaterial = new THREE.MeshBasicMaterial({map: texture});
        resourceManager.addMaterialTexture(texture, newMaterial);

        resourceManager.setMeshMaterial(currentlySelectedObject, newMaterial);
      }
    }
  }

  renderUI(false, new THREE.Vector2(0, 0)); // Close the context menu
}

function onUpdateSettings(newSettings: UserSettings, updatePlugin: boolean = true) {
  userSettings = newSettings;
  
  // Display Settings
  camera.fov = userSettings.displaySettings.cameraFOV;
  camera.updateProjectionMatrix();


  // TODO: Controls
  updateOrbitControls();

  // Grid Settings
  updateGrid();

  // Push settings value update to UI for menus
  renderUI(false);

  returnFocus();

  if (updatePlugin) {
    postPluginMessage({type: "UpdateSettings", settings: userSettings});
  }
}

//#endregion

//#region Load Model

async function onLoadButtonClicked(){
  let file = await selectFile(".obj,.fbx,.gltf,.glb");
  let url = URL.createObjectURL(file);
  loadObject(url, file.name);
  returnFocus();
}



function loadObject(objectFileURL: string, objectFileName: string) {
  if (currentObject) {
    resourceManager.removeObjectFromScene(currentObject.uuid);
  }
  selectObject(null);

  postPluginMessage({type: "RequestUpdate"});

  // Pick loader for file type
  var splitPath = objectFileName.split(".");
  var key = splitPath[splitPath.length - 1] as keyof typeof loaders;
  let loader= loaders[key];

  loader.load(objectFileURL, function(obj) {
    if (obj instanceof THREE.Group) {
      currentObject = obj;
    }
    else if (loader instanceof GLTFLoader) {
      currentObject = obj.scene;
    }

    console.log(currentObject);
    resourceManager.addObjectToScene(currentObject);

    URL.revokeObjectURL(objectFileURL);
  }, undefined, function(error) {
      console.error(error);
      URL.revokeObjectURL(objectFileURL);
  });
}



/**
 * Select file(s).
 * @param {String} contentType The content type of files you wish to select. For instance, use "image/*" to select all types of images.
 */
function selectFile(contentType: string): Promise<File> {
    return new Promise(resolve => {
        let input = document.createElement('input') as HTMLInputElement;
        input.type = 'file';
        input.accept = contentType;

        input.onchange = () => {
            if (input.files != null) {
              let files = Array.from(input.files);
              resolve(files[0]);
            }
        };
        input.click();
    });
}

//#endregion

function updateGrid() {
  if (grid) {
    scene.remove(grid);
    grid.dispose();
  }

  var gs = userSettings.gridSettings;

  if (gs.visible) {
    grid = new THREE.GridHelper( gs.size, gs.divisions, 0x0000ff, 0x808080 );
    scene.add(grid);
  }
}

function returnFocus() {
  postPluginMessage({type: "ReturnFocus"});
}