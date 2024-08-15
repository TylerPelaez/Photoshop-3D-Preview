import React from 'react';
import { createRoot, Root } from 'react-dom/client';

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ViewportGizmo } from './three-viewport-gizmo/ViewportGizmo.ts';
import {Tween} from '@tweenjs/tween.js'


import './style.css'
import { UserSettings, GridSettings } from './components/Types';
import App from './components/App';
import { choiceStrings } from './components/ContextMenu.tsx';


// The Plugin host will set this on the window automatically, just clarify for typescript that the field is expected.
declare global {
  interface Window {
      uxpHost:any;
  }
}

// Content wrapper we insert the view into
const _canvas = document.getElementById('htmlCanvas') as HTMLCanvasElement;

const loaders = {  
  obj: new OBJLoader(),
  fbx: new FBXLoader(),
  gltf: new GLTFLoader(),
  glb: new GLTFLoader(),
};


const defaultUserSettings: UserSettings  = {
  gridSettings: {
    size: 10,
    divisions: 10,
    visible: true
  }
}

const raycaster = new THREE.Raycaster();

let scene : THREE.Scene;

let camera : THREE.PerspectiveCamera;
let renderer : THREE.WebGLRenderer;

let viewportGizmo : ViewportGizmo;

let currentObject : THREE.Object3D;
let controls : OrbitControls;
let grid: THREE.GridHelper;


let documentIDsToTextures = new Map<number, THREE.DataTexture>();
let textureUUIDsToMaterials = new Map<string, THREE.MeshBasicMaterial>();
let activeDocument: number;

let userSettings = defaultUserSettings;

let tween : Tween;

let root : Root;

let currentlySelectedObject : THREE.Object3D | null;
let contextMenuOpen : boolean = false;

let rightClickCancelled: boolean = false;

init();

function init() {
  // Init React
  const reactRoot = document.getElementById('reactRoot');
  root = createRoot(reactRoot as HTMLElement);

  renderUI(false, new THREE.Vector2(0, 0))

  // Init Three.js
  scene = new THREE.Scene();

  renderer = new THREE.WebGLRenderer({canvas: _canvas, antialias: true});
  renderer.setAnimationLoop( render );

  camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
  camera.position.set( 2, 3, 5 );
  scene.add(camera);

  createGrid();

  viewportGizmo = new ViewportGizmo(camera, renderer, {size: 75});
  controls = new OrbitControls( camera, renderer.domElement );
  controls.addEventListener( 'change', () => {
    rightClickCancelled = true;
    if (contextMenuOpen) renderUI(false);
    viewportGizmo.update();
    returnFocus();
  });

  viewportGizmo.target = controls.target;

  // Load Background
  new THREE.CubeTextureLoader()
    .setPath('textures/cube/')
    .load( [
      'px.bmp',
      'nx.bmp',
      'py.bmp',
      'ny.bmp',
      'pz.bmp',
      'nz.bmp'
    ], function(textureCube) {
      console.log(textureCube);
      scene.background = textureCube;
    }, function(error) {
      console.log(error);
    });

  
  onWindowResize();
  window.addEventListener("message", onMessageReceived);
  window.addEventListener("resize", onWindowResize);

  addEventListener("pointerup", onPointerUp);

  window.uxpHost.postMessage("Ready");
}

function onMessageReceived(event: MessageEvent) {
  console.log("Received: " + window.performance.now());
  let data = event.data;
  console.log("Deserialized?: " + data.type + " " + window.performance.now()); 
  if (data.type == "FULL_UPDATE" || data.type == "PARTIAL_UPDATE") {
    let width = data.width;
    let height = data.height;  
    let documentID = data.documentID;
    console.log(documentID);

    let texture: THREE.DataTexture;
    let pixelData: Uint8Array;

    let pixelDataLength = 4 * width * height;
    let pixelStringStartIndex = data.pixelBatchOffset * 4;
    let pixelStringEndIndex = pixelStringStartIndex + data.pixelBatchSize * 4;

    let updateMaterial: THREE.MeshBasicMaterial | undefined;

    if (documentIDsToTextures.has(documentID)) {
      let oldTexture = documentIDsToTextures.get(documentID)!;
      if (oldTexture.image.width != width || oldTexture.image.height != height) {
        updateMaterial = textureUUIDsToMaterials.get(oldTexture.uuid);
        textureUUIDsToMaterials.delete(oldTexture.uuid);
        documentIDsToTextures.delete(documentID);
        oldTexture?.dispose();
      }
    }


    if (!documentIDsToTextures.has(documentID)) {
      pixelData = new Uint8Array(pixelDataLength);

      for (let i = 0; i < pixelStringStartIndex; i++) {
        pixelData[i] = 0;
      }
      for (let i = pixelStringStartIndex; i < pixelStringEndIndex; i++) {
        pixelData[i] = data.pixelString[i].charCodeAt();
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
      
      documentIDsToTextures.set(documentID, texture);

      if (updateMaterial) {
        updateMaterial.map = texture;
        textureUUIDsToMaterials.set(texture.uuid, updateMaterial);
      } else {
        let material = new THREE.MeshBasicMaterial({map: texture}); 
        textureUUIDsToMaterials.set(texture.uuid, material);
      }
    } else {
      texture = documentIDsToTextures.get(documentID)!;
      pixelData = texture.image.data as Uint8Array;

      for (let i = 0; i < data.pixelString.length; i++) {
        pixelData[pixelStringStartIndex + i] = data.pixelString[i].charCodeAt();
      }
    }

    texture.needsUpdate = true;
    console.log("Decode Done: " + window.performance.now());

  } else if (data.type == "DOCUMENT_CHANGED") {
    activeDocument = data.documentID;
  }
  console.log("Message End: " + window.performance.now());
}


function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize( window.innerWidth, window.innerHeight );
  viewportGizmo.update();
}

function onPointerUp(event: PointerEvent) {
  if (rightClickCancelled) {
    rightClickCancelled = false;
    return;
  }

  rightClickCancelled = false;

  if (contextMenuOpen) {
    renderUI(false);
  }

  if (event.button == 2) {
    let pointer = new THREE.Vector2();
    pointer.x = ( event.clientX / window.innerWidth ) * 2 - 1;
    pointer.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObjects( scene.children );

    
    if (intersects.length == 0) return;

    
    let minDistance = Number.MAX_SAFE_INTEGER;
    let minIndex = -1;


    for ( let i = 0; i < intersects.length; i ++ ) {
      if (intersects[i].object instanceof THREE.GridHelper) continue;
      if (intersects[i].distance < minDistance) {
        minDistance = intersects[i].distance;
        minIndex = i;
      }      
    }


    if (minIndex < 0) return;


    currentlySelectedObject = intersects[minIndex].object;
    renderUI(true, new THREE.Vector2(event.clientX, event.clientY));
  }
}


// Something like this will be helpful: https://github.com/mrdoob/three.js/blob/master/examples/webgl_materials_texture_canvas.html

function loadObject(objectFileURL: string, objectFileName: string) {
    if (currentObject) {
        scene.remove(currentObject);
    }

    window.uxpHost.postMessage("RequestUpdate");

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

      // Assign everything to the current material
      currentObject.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.material = new THREE.MeshBasicMaterial();
        }
      });

      scene.add(currentObject);

      URL.revokeObjectURL(objectFileURL);
    }, undefined, function(error) {
        console.error(error);
        URL.revokeObjectURL(objectFileURL);
    });
}

function render(time: DOMHighResTimeStamp, _frame: XRFrame)  {
  if (tween && tween.isPlaying()) tween.update(time);
  renderer.render( scene, camera );
  viewportGizmo.render();
}

// Button callback
async function onLoadButtonClicked(){
    let file = await selectFile(".obj,.fbx,.gltf,.glb");
    let url = URL.createObjectURL(file);
    loadObject(url, file.name);
    returnFocus();
}

function onUpdateGridSettings(newSettings: GridSettings) {
  userSettings = {...userSettings, gridSettings: newSettings}

  createGrid();
  returnFocus();
}

function createGrid() {
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

function renderUI(contextMenuVisible: boolean, contextMenuPosition: THREE.Vector2 = new THREE.Vector2(0, 0)) {
  root.render(React.createElement(App, {
    initialUserSettings: userSettings, 
    onUpdateGridSettings: onUpdateGridSettings, 
    onModelLoad: onLoadButtonClicked,
    contextMenuOpen: contextMenuVisible,
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
    console.log(activeDocument);
    if (currentlySelectedObject instanceof THREE.Mesh) {
      let texture = documentIDsToTextures.get(activeDocument);
      if (texture) {
        console.log(texture);
        currentlySelectedObject.material = textureUUIDsToMaterials.get(texture.uuid);
        console.log(currentlySelectedObject.material);
      }
    }
  }

  renderUI(false, new THREE.Vector2(0, 0)); // Close the context menu
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

function returnFocus() {
  window.uxpHost.postMessage("ReturnFocus");
}