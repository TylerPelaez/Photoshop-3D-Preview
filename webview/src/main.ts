import React from 'react';
import { createRoot, Root } from 'react-dom/client';

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {Tween} from '@tweenjs/tween.js'

import { ControlScheme, ControlSchemeType, InputCombination, MouseButton, UserSettings } from "@api/types/Settings";
import { DocumentClosed, PartialUpdate, PluginTargetMessage, WebviewTargetMessage } from "@api/types/Messages";
import { BuiltInSchemes } from "./util/util.ts"
import ResourceManager from './util/ResourceManager.ts';
import { ViewportGizmo } from './three-viewport-gizmo/ViewportGizmo.ts';

import App from './components/App';
import { choiceStrings } from './components/ContextMenu.tsx';

import './output.css';


// The Plugin host will set this on the window automatically, just clarify for typescript that the field is expected.
declare global {
  interface Window {
      uxpHost:any;
  }
}

// React Root
let root : Root;

let scene : THREE.Scene;

let camera : THREE.PerspectiveCamera;
let renderer : THREE.WebGLRenderer;


let currentObject : THREE.Object3D;
let controls : OrbitControls;
let grid: THREE.GridHelper;

let resourceManager: ResourceManager;
let activeDocument: number;

let userSettings: UserSettings;

let tween : Tween;

let viewportGizmo : ViewportGizmo;

let currentlySelectedObject : THREE.Object3D | null;
let outlineObject: THREE.Object3D | null;

let contextMenuOpen : boolean = false;
let pressedKeys: {[_keyName: string]: boolean} = {};
let pointerDown: boolean = false;


let lightTarget: THREE.Object3D;
let light: THREE.DirectionalLight;
let lightHelper: THREE.DirectionalLightHelper;
let lightRotateStart: THREE.Vector2 | null = new THREE.Vector2();


let flipY = true;

const raycaster = new THREE.Raycaster();
const cameraInitialPosition = new THREE.Vector3( 3, 3.5, 2 );

const loaders = {  
  obj: new OBJLoader(),
  fbx: new FBXLoader(),
  gltf: new GLTFLoader(),
  glb: new GLTFLoader(),
};


init();

function init() {
  // Init React root. The actual UI Components are inserted for the first time in renderUI().
  // (UI Depends on receiving the User Settings from the plugin)
  const reactRoot = document.getElementById('reactRoot');
  root = createRoot(reactRoot as HTMLElement);

  // Init Three.js scene and helper objects
  scene = new THREE.Scene();
  scene.background = new THREE.Color("#4D4D4D");

  renderer = new THREE.WebGLRenderer({canvas: document.getElementById('htmlCanvas') as HTMLCanvasElement, antialias: true});
  renderer.setAnimationLoop( render ); // Frame update function

  camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
  camera.position.set(cameraInitialPosition.x, cameraInitialPosition.y, cameraInitialPosition.z);
  scene.add(camera);

  controls = new OrbitControls( camera, renderer.domElement );
  controls.addEventListener( 'change', onCameraMoved);

  // UI Helper Gizmo for mouse-interaction camera rotation
  viewportGizmo = new ViewportGizmo(camera, renderer, {size: 75});
  viewportGizmo.target = controls.target;

  light = new THREE.DirectionalLight();  
  lightTarget = new THREE.Object3D();

  scene.add(light);
  scene.add(lightTarget);

  light.target = lightTarget;

  // A big enough number that it should be bigger than most imports
  light.position.copy(new THREE.Vector3(100000, 100000, 100000));

  lightHelper = new THREE.DirectionalLightHelper(light);
  lightHelper.visible = false;
  scene.add(lightHelper);

  resourceManager = new ResourceManager(scene);

  window.addEventListener("message", onMessageReceived);
  window.addEventListener("resize", onWindowResize);
  window.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointerup", onPointerUp)
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener('pointermove', onPointerMove );

  onWindowResize();

  // Let UXP plugin know we're ready to receive document texture data
  postPluginMessage({type: "Ready"});
}

// Called each frame.
function render(time: DOMHighResTimeStamp, _frame: XRFrame)  {
  lightHelper.update();

  if (tween && tween.isPlaying()) tween.update(time);
  renderer.render( scene, camera );
  viewportGizmo.render();
}

function onCameraMoved() {
  if (contextMenuOpen) renderUI(false);
  viewportGizmo.update();
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

/**
 * Load the pixel data and either create a new texture (if the pixel data is for a new document or new resolution) 
 * OR update the existing texture for the document. the pixelData is read as a string for which each character is the UTF16 charCode value (0-255) corresponding to the pixel value
 * @param data object containing the updated pixel data + associated metadata
 */
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
    texture.flipY = flipY;
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

// Set the Orbit controls mouse button actions based upon the currently held keys and the user settings control scheme.
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

// Track the currently pressed keys for camera + light movement controls.
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

// Create highlight mesh + material 
function selectObject(object: THREE.Object3D | null) {
  if (currentlySelectedObject == object) return;

  // Delete the currently selected highlighter object + related resources.
  if (currentlySelectedObject != null) {
    if (outlineObject instanceof THREE.Mesh) {
      if (outlineObject.material instanceof THREE.Material) {
        outlineObject.material.dispose();
      }
      outlineObject.geometry.dispose();
    }
    scene.remove(outlineObject!);
  }

  currentlySelectedObject = object;
  // Create a "highlight" by duplicating the mesh, scaling it up, and using an inverse hull material on  
  if (currentlySelectedObject != null) {
    if (object instanceof THREE.Mesh) {
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
      outlineObject.scale.multiply(object.scale).multiplyScalar(1.05);
      scene.add(outlineObject);
    }
  }
}

function onPointerUp(event: PointerEvent) {
  pointerDown = false;
  lightRotateStart = null;
  lightHelper.visible = false;
}

/**
 * click callback: Check if an object is being selected, the context menu is being opened with RMB, or the directional light movement should begin
 */
function onPointerDown(event: PointerEvent) {
  pointerDown = true;
  if (contextMenuOpen) {
    renderUI(false);
  }

  let obj = getObjectAtCursor(event);
  
  if (event.button == 0 && controls.mouseButtons.LEFT == null) {
    selectObject(obj);
  } else if (event.button == 2 && controls.mouseButtons.RIGHT == null) {
    renderUI(true, new THREE.Vector2(event.clientX, event.clientY));
  }
  let lightKey = BuiltInSchemes.get(userSettings.controlsSettings.scheme)?.light?.key ?? "";

  if (pressedKeys[lightKey] && !controls.mouseButtons.LEFT && !controls.mouseButtons.RIGHT && !controls.mouseButtons.MIDDLE) {
    lightHelper.visible = true;
  }
}

/**
 * Check if the keybind for moving the directional light is being held and then use the mouse movement to move it 
 *  */
function onPointerMove(event: PointerEvent) {
  let lightKey = BuiltInSchemes.get(userSettings.controlsSettings.scheme)?.light?.key ?? "";

  if (!pressedKeys[lightKey] || !pointerDown) return;
  if (controls.mouseButtons.LEFT || controls.mouseButtons.RIGHT || controls.mouseButtons.MIDDLE) return;
  lightHelper.visible = true;

  let lightRotateEnd = new THREE.Vector2();
  lightRotateEnd.set(event.clientX, event.clientY);
  if (lightRotateStart == null) {
    lightRotateStart = new THREE.Vector2().copy(lightRotateEnd);
  } 

  let rotateDelta = new THREE.Vector2().subVectors(lightRotateEnd, lightRotateStart).multiplyScalar(1.0);

  let spherical = new THREE.Spherical().setFromVector3(light.position);
  spherical.theta += ( 2 * Math.PI * rotateDelta.x / window.innerHeight );

  spherical.phi += ( 2 * Math.PI * rotateDelta.y / window.innerHeight );

  spherical.makeSafe();

  let newLightPos = new THREE.Vector3().setFromSpherical(spherical);
  light.position.copy(newLightPos);

  lightRotateStart.copy(lightRotateEnd);
}

//#endregion

//#region UI Rendering and callbacks
function onLightingTogglePressed() {
  resourceManager.toggleLightingMode();
  renderUI(false);
}


function renderUI(contextMenuVisible: boolean, contextMenuPosition: THREE.Vector2 = new THREE.Vector2(0, 0)) {
  if (!userSettings) return;

  root.render(React.createElement(App, {
    userSettings: userSettings, 
    onUpdateSettings: onUpdateSettings, 
    onModelLoad: onLoadButtonClicked,
    contextMenuOpen: contextMenuVisible,
    hasObjectSelected: currentlySelectedObject != null,
    contextMenuPosition: contextMenuPosition,
    onContextMenuChoiceMade: onContextMenuChoiceMade,
    lightingEnabled: resourceManager.lightingEnabled(),
    onLightingTogglePressed: onLightingTogglePressed,
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
        let newMaterial = resourceManager.createMaterialProxy(new THREE.MeshStandardMaterial({map: texture}));
        resourceManager.addMaterialTexture(texture, newMaterial.uuid);
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

  // Controls
  updateOrbitControls();

  // Grid Settings
  updateGrid();

  // Push settings value update to UI for menus
  renderUI(false);

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

  // GLTF expects UVs to be in the opposite direction from the other formats, so we need to update textures to have their y-values flipped to acommodate
  let prevFlip = flipY;
  flipY = (key != "glb" && key != "gltf") 

  if (prevFlip != flipY) {
    resourceManager.setTexturesFlipY(flipY);
  }

  loader.load(objectFileURL, function(obj) {
    if (obj instanceof THREE.Group) {
      currentObject = obj;
    }
    else if (loader instanceof GLTFLoader) {
      currentObject = obj.scene;
    }

    resourceManager.addObjectToScene(currentObject);

    // Center camera on object and zoom to fit in view
    const boundingBox = new THREE.Box3();
    boundingBox.setFromObject(currentObject);
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    boundingBox.getCenter(center);
    boundingBox.getSize(size);
    const maxDim = Math.max( size.x, size.y, size.z );
    const fov = camera.fov * ( Math.PI / 180 );
    let cameraZ = maxDim / 2 / Math.tan( fov / 2 );

    cameraZ *= 1.25;
    let newPos = new THREE.Vector3(cameraInitialPosition.x, cameraInitialPosition.y, cameraInitialPosition.z);
    newPos.normalize();

    camera.position.copy(newPos.multiplyScalar(maxDim * 1.3));
    controls.target = center;
    camera.lookAt(center);

    camera.updateProjectionMatrix();
    controls.update();

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
