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
let light;
let controls;

init();

function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
    renderer = new THREE.WebGLRenderer({canvas: _canvas});
    light = new THREE.DirectionalLight(0xffffff, 0.5);
    controls = new OrbitControls( camera, renderer.domElement );
    scene.add(light);
    
    loadBtn.onclick = onLoadButtonClicked;
    initializeCanvas();
    window.addEventListener("resize", initializeCanvas);

    animate();
}

function initializeCanvas() {
    renderer.setSize(window.innerWidth, window.innerHeight - 80); 
}


function initializeScene(modelFilePath) {
    const material = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
    loader.load(modelFilePath, function(obj) {
        model = obj;
        scene.add(obj);
        URL.revokeObjectURL(modelFilePath);
    }, undefined, function(error) {
        console.error(error);
        URL.revokeObjectURL(modelFilePath);
    });

    camera.position.z = 10;
    controls.update();
}

function animate() {
    if (renderer) {
        requestAnimationFrame( animate );
        controls.update();
        light.position.x = camera.position.x;
        light.position.y = camera.position.y;
        light.position.z = camera.position.z;
        renderer.render( scene, camera );
    }
}


// Button callback
async function onLoadButtonClicked(){
    let file = await selectFile(".obj", false);
    let url = URL.createObjectURL(file);
    initializeScene(url);
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