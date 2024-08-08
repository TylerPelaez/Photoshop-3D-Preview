import './style.css'
import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const _canvas = document.querySelector('#htmlCanvas');
const loader = new OBJLoader();


// Content wrapper element
let loadBtn = document.getElementById("loadBtn");

let scene;
let camera;
let renderer;
let model;
let controls;
let material;

let pixelData;
let texture;

init();

function init() {
    renderer = new THREE.WebGLRenderer({canvas: _canvas, antialias: true});
    renderer.setAnimationLoop( render );
    
    initializeCanvas();
    scene = new THREE.Scene();


    camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
    camera.position.set( 2, 3, 5 );
    scene.add(camera);

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


    loadBtn.onclick = onLoadButtonClicked;
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

function onMessageReceived(event) {
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

function initializeCanvas() {
    renderer.setSize(window.innerWidth, window.innerHeight - 80); 
}

function onWindowResize() {

  camera.aspect = window.innerWidth / window.innerHeight;

  camera.updateProjectionMatrix();

  renderer.setSize( window.innerWidth, window.innerHeight );
}


// Something like this will be helpful: https://github.com/mrdoob/three.js/blob/master/examples/webgl_materials_texture_canvas.html

function loadModel(modelFilePath) {
    if (model) {
        scene.remove(model);
        model.dispose();
    }


    loader.load(modelFilePath, function(obj) {
        obj.traverse( child => {
            console.log(child);
            child.material = material;
        } );
        model = obj;
        scene.add(model);
        window.uxpHost.postMessage("RequestUpdate");


        URL.revokeObjectURL(modelFilePath);
    }, undefined, function(error) {
        console.error(error);
        URL.revokeObjectURL(modelFilePath);
    });
}

function render() {
  renderer.render( scene, camera );
}

// Button callback
async function onLoadButtonClicked(){
    let file = await selectFile(".obj", false);
    let url = URL.createObjectURL(file);
    loadModel(url);
}

/**
 * Select file(s).
 * @param {String} contentType The content type of files you wish to select. For instance, use "image/*" to select all types of images.
 * @param {Boolean} multiple Indicates if the user can select multiple files.
 * @returns {Promise<File|File[]>} A promise of a file or array of files in case the multiple parameter is true.
 */
function selectFile(contentType, multiple){
    return new Promise(resolve => {
        let input = document.createElement('input');
        input.type = 'file';
        input.multiple = multiple;
        input.accept = contentType;

        input.onchange = () => {
            let files = Array.from(input.files);
            if (multiple)
                resolve(files);
            else
                resolve(files[0]);
        };

        input.click();
    });
}