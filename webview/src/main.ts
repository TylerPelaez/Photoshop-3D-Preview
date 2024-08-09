import './style.css'
import * as THREE from 'three';

import { UserSettings, GridSettings } from './components/App';
import { createRoot } from 'react-dom/client';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import React from 'react';
import App from './components/App';
import { user } from '@nextui-org/react';


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


let defaultUserSettings: UserSettings  = {
  gridSettings: {
    size: 100,
    divisions: 40,
    visible: true
  }
}

let scene : THREE.Scene;


let camera : THREE.PerspectiveCamera;
let renderer : THREE.WebGLRenderer;
let currentObject : THREE.Object3D;
let controls : OrbitControls;
let material : THREE.MeshBasicMaterial;

let pixelData : Uint8Array;
let texture : THREE.DataTexture;

let userSettings = defaultUserSettings;
let grid: THREE.GridHelper;


init();

function init() {
    // Init React
    const reactRoot = document.getElementById('reactRoot') as Element;
    const root = createRoot(reactRoot);

   
    root.render(React.createElement(App, {initialUserSettings: userSettings, onUpdateGridSettings: onUpdateGridSettings, onModelLoad: onLoadButtonClicked}));

    // Init Three.js
    scene = new THREE.Scene();

    renderer = new THREE.WebGLRenderer({canvas: _canvas, antialias: true});
    renderer.setAnimationLoop( render );

    camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
    camera.position.set( 2, 3, 5 );
    scene.add(camera);

    onWindowResize();

    createGrid();



    controls = new OrbitControls( camera, renderer.domElement );
    controls.addEventListener( 'change', render );

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

    pixelData = new Uint8Array(3);
    pixelData[0] = 255;
    pixelData[1] = 255;
    pixelData[2] = 255;

    texture = new THREE.DataTexture(pixelData, 1, 1);
    material = new THREE.MeshBasicMaterial({map: texture});

    window.uxpHost.postMessage("Ready");
}

function onMessageReceived(event: MessageEvent) {
    let data = event.data;
    console.log("Message Start: " + window.performance.now());
    if (data.type == "FULL_UPDATE") {
      let width = data.width;
      let height = data.height;  
      console.log()
      
      pixelData = new Uint8Array(4 * width * height);
      for (let i = 0; i < data.pixels.length; i++) {
        pixelData[i] = data.pixels[i].charCodeAt();
      }

      // pixelData = Uint8Array.from(Array.from(data.pixels).map(ch => ch.charCodeAt()));

      if (texture) {
        texture.dispose();
      }
      texture = new THREE.DataTexture(pixelData, width, height);
      texture.flipY = true;
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.magFilter = texture.minFilter = THREE.LinearFilter;

      texture.needsUpdate = true;
      
      material.map = texture;
    }
    console.log("Message End: " + window.performance.now());
}


function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize( window.innerWidth, window.innerHeight );
}


// Something like this will be helpful: https://github.com/mrdoob/three.js/blob/master/examples/webgl_materials_texture_canvas.html

function loadObject(objectFileURL: string, objectFileName: string) {
    if (currentObject) {
        scene.remove(currentObject);
    }

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
          child.material = material;
        }
      });

      scene.add(currentObject);

      window.uxpHost.postMessage("RequestUpdate");
      URL.revokeObjectURL(objectFileURL);
    }, undefined, function(error) {
        console.error(error);
        URL.revokeObjectURL(objectFileURL);
    });
}

function render() {
  renderer.render( scene, camera );
}

// Button callback
async function onLoadButtonClicked(){
    let file = await selectFile(".obj,.fbx,.gltf,.glb");
    let url = URL.createObjectURL(file);
    loadObject(url, file.name);
}

function onUpdateGridSettings(newSettings: GridSettings) {
  userSettings = {...userSettings, gridSettings: newSettings}

  createGrid();
}

function createGrid() {
  if (grid) {
    scene.remove(grid);
    grid.dispose();
  }

  var gs = userSettings.gridSettings;

  if (gs.visible && gs.size != null) {
    grid = new THREE.GridHelper( gs.size, gs.divisions == null ? 1 : gs.divisions, 0x0000ff, 0x808080 );
    scene.add(grid);
  }
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