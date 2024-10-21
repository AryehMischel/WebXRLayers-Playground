import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { InteractiveGroup } from 'three/addons/interactive/InteractiveGroup.js';
import Stats from 'three/addons/libs/stats.module.js';
import { customControls, customSkyCamera, setupScene, customRenderer, customControllers, WebXRQuadUILayer, WebXRCubeLayerASTC, nullifyWebglBinding} from './main.js';


let scene, camera, renderer, stats, controls, controllers, group, gl, glBinding, xrSpace, xrSession;
let layersPolyfill = new WebXRLayersPolyfill()

// to store WebXR Layers
let layers = new Object();
window.layers = layers;
let activeLayers = [];

//create scene, add lights
scene = new THREE.Scene();
setupScene(scene);

//create camera
camera = customSkyCamera();

//create renderer, add it to the dom and set animation loop
renderer = customRenderer();
document.body.appendChild(renderer.domElement);
renderer.setAnimationLoop(animate);

//add event listeners for the start and end of the xr session
renderer.xr.addEventListener('sessionstart', () => onSessionStart());
renderer.xr.addEventListener('sessionend', () => onSessionEnd());

//add vr button
document.body.appendChild(VRButton.createButton(renderer));

//add pc controls ('awsd' to move, mouse to look around)
controls = customControls(camera, renderer);

//create vr hand controls with models
controllers = customControllers(scene, renderer);

//create interactive group
group = new InteractiveGroup();
group.listenToXRControllerEvents(controllers[0]);
group.listenToXRControllerEvents(controllers[1]);
scene.add(group);

//ui stuff
let uiMesh;

//webgl context
gl = renderer.getContext();

//get webgl compressed texture extensions
const ASTC_EXT = gl.getExtension("WEBGL_compressed_texture_astc"); const ETC_EXT = gl.getExtension("WEBGL_compressed_texture_etc")

if (ASTC_EXT) { console.log("ASTC_EXT", ASTC_EXT) } else { alert("WARNING! This demo was created for VR ONLY.                                  Your Device or Browser does not support the required GPU compressed format.") }
if (ETC_EXT) { console.log("ETC_EXT", ETC_EXT) } else { console.log("no webgl extension etc2 / eac") }


let cubeMapFileExtensions = [
    'left/px.astc', 'left/nx.astc', 'left/py.astc', 'left/ny.astc', 'left/pz.astc', 'left/nz.astc',
    'right/px.astc', 'right/nx.astc', 'right/py.astc', 'right/ny.astc', 'right/pz.astc', 'right/nz.astc'
];

//cube map are stored as six image faces in the gpu compressed format COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR
let cubeMapSources = [
    { id: "dream", folder: './Assets/textures/dream', type: "stereoCubeMap", faces: [], width: 1536, height: 1536 },
    { id: "forest", folder: './Assets/textures/forest', type: "stereoCubeMap", faces: [], width: 1536, height: 1536 },
    { id: "battlefield", folder: './Assets/textures/battle', type: "stereoCubeMap", faces: [], width: 2048, height: 2048 },

];

async function loadAstcFile(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const rawData = new Uint8Array(arrayBuffer);
    return rawData;
}

async function loadFilesInFolder(source, fileExtensions) {
    const loadPromises = fileExtensions.map(extension => {
        const fileUrl = `${source.folder}/${extension}`;
        return loadAstcFile(fileUrl);
    });

    const loadedFiles = await Promise.all(loadPromises);
    source.faces.push(loadedFiles);
    // console.log(`All files in folder ${source.folder} are loaded`);
    //create webxr stereo cube layer
    let layer = new WebXRCubeLayerASTC(loadedFiles, source.width, source.height, true);
    layers[source.id] = layer;
}

async function loadAllFilesInFolders(sources, fileExtensions) {
    const folderPromises = sources.map(source => loadFilesInFolder(source, fileExtensions));
    await Promise.all(folderPromises);
    // console.log('All files in all folders are loaded');
}

if (ASTC_EXT) {
    loadAllFilesInFolders(cubeMapSources, cubeMapFileExtensions)
        .then(() => {
            console.log('All files loaded successfully');
        })
        .catch((error) => {
            console.error('Error loading files:', error);
        });
}




//animation loop
function animate(t, frame) {

    const xr = renderer.xr;
    const session = xr.getSession();
    xrSession = session;
    if (session && session.renderState.layers !== undefined && session.hasMediaLayer === undefined
    ) {

        console.log("creating media layer")
        session.hasMediaLayer = true;
        session.requestReferenceSpace('local-floor').then((refSpace) => {

            glBinding = xr.getBinding();
            xrSpace = refSpace;

        });
    }


    for (let i = 0; i < activeLayers.length; i++) {
        if (activeLayers[i].layer.needsRedraw) {
            drawWebXRLayer(activeLayers[i], session, frame)
        }
    }

    renderer.render(scene, camera);
    controls.update();
    stats.update();

}



function drawWebXRLayer(layer, session, frame) {
    if (layer.type === "WebXRQuadUILayer") {
        drawWebXRQuadUILayer(layer, session, frame)
    } else if (layer.type === "WebXRCubeLayerASTC") {
        drawWebXRCubeASTCLayer(layer, session, frame)
    }
}

function drawWebXRCubeASTCLayer(layer, session, frame) {
    let format = 37808;
    console.log("format is?", format)
    let width = layer.width;

    if (!layer.stereo) {
        console.log("drawing cube layer")
        let glayer = glBinding.getSubImage(layer.layer, frame);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, glayer.colorTexture);

        gl.compressedTexSubImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X, 0, 0, 0, width, width, format, layer.faces[0]); //es
        gl.compressedTexSubImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_X, 0, 0, 0, width, width, format, layer.faces[1]); //es
        gl.compressedTexSubImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Y, 0, 0, 0, width, width, format, layer.faces[2]); //es
        gl.compressedTexSubImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, 0, 0, 0, width, width, format, layer.faces[3]); //es
        gl.compressedTexSubImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Z, 0, 0, 0, width, width, format, layer.faces[4]); //es
        gl.compressedTexSubImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, 0, 0, 0, width, width, format, layer.faces[5]); //es
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);

    } else {

        let glayer = glBinding.getSubImage(layer.layer, frame, "left");
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, glayer.colorTexture);


        gl.compressedTexSubImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X, 0, 0, 0, width, width, format, layer.faces[0]); //es
        gl.compressedTexSubImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_X, 0, 0, 0, width, width, format, layer.faces[1]); //es
        gl.compressedTexSubImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Y, 0, 0, 0, width, width, format, layer.faces[2]); //es
        gl.compressedTexSubImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, 0, 0, 0, width, width, format, layer.faces[3]); //es
        gl.compressedTexSubImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Z, 0, 0, 0, width, width, format, layer.faces[4]); //es
        gl.compressedTexSubImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, 0, 0, 0, width, width, format, layer.faces[5]); //es

        gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);

        glayer = glBinding.getSubImage(layer.layer, frame, "right");
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, glayer.colorTexture);

        gl.compressedTexSubImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X, 0, 0, 0, width, width, format, layer.faces[6]); //es
        gl.compressedTexSubImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_X, 0, 0, 0, width, width, format, layer.faces[7]); //es
        gl.compressedTexSubImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Y, 0, 0, 0, width, width, format, layer.faces[8]); //es
        gl.compressedTexSubImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, 0, 0, 0, width, width, format, layer.faces[9]); //es
        gl.compressedTexSubImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Z, 0, 0, 0, width, width, format, layer.faces[10]); //es
        gl.compressedTexSubImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, 0, 0, 0, width, width, format, layer.faces[11]); //es


        gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
    }
}

function drawWebXRQuadUILayer(layer, session, frame) {

    let glayer = glBinding.getSubImage(layer.layer, frame);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.bindTexture(gl.TEXTURE_2D, glayer.colorTexture);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, layer.image);
    gl.bindTexture(gl.TEXTURE_2D, null);

}


function setLayer(layerID, isUIlayer = false) {

    let layerLength = xrSession.renderState.layers.length
    console.log("layer length", layerLength)

    if (layerLength === 2 || layerLength === 3) {
        if (isUIlayer) {

            xrSession.updateRenderState({
                layers: [
                    xrSession.renderState.layers[xrSession.renderState.layers.length - 2],
                    layers[layerID].layer,
                    xrSession.renderState.layers[xrSession.renderState.layers.length - 1]
                ]
            })
        } else {
            xrSession.updateRenderState({
                layers: [
                    layers[layerID].layer,
                    xrSession.renderState.layers[xrSession.renderState.layers.length - 2],
                    xrSession.renderState.layers[xrSession.renderState.layers.length - 1]
                ]
            })

        }

    } else if (layerLength === 1) {
        xrSession.updateRenderState({
            layers: [
                layers[layerID].layer,
                xrSession.renderState.layers[xrSession.renderState.layers.length - 1]
            ]
        });
    } else {
        console.log("error fried")
    }

    activeLayers[0] = layers[layerID]

}



window.addEventListener('resize', onWindowResize, false);

function onWindowResize() {
    console.log('resize')
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);

}


export function getGLBinding() {
    return glBinding;
}

export function getXRSpace() {
    return xrSpace;
}

export function getASTC() {
    return ASTC_EXT;
}

export function getETC() {
    return ETC_EXT;
}



function createLayer(imagename) {
    let layer = layers[imagename]
    layer.createLayer()
}

function destroyLayer(imagename) {
    let layer = layers[imagename]
    layer.destroy()

}


function onSessionEnd() {
    nullifyWebglBinding()
    for (let key in layers) {
        if (layers[key].layer) {
            layers[key].layer.destroy();
            layers[key].layer = null;
        }
    }
    activeLayers = [];
    uiMesh.visible = true;
    //remove layers?

}

function onSessionStart() {
    uiMesh.visible = false;
    createQuadIU()

}


//variables for setting the ui quad layer and the three js mesh colliders

let layerDepth = -1;
let quadUIpositionX = 0.125;
let quadUIpositionY = 0.8;
let quadUIscaleWidth = 0.75;
let quadUIscaleHeight = 0.75;

let canvasImage = null;
let uiCanvas = document.createElement('canvas');

uiCanvas.width = 4000;
uiCanvas.height = 4000;


let buttonHeight = 500;
let buttonWidth = 1000;


let battleX = 0;      //pixel position
let battleY = 700;    //pixel position

let forestX = 1150;    //pixel position
let forestY = 700;     //pixel position

let dreamX = 2225;     //pixel position
let dreamY = 700;      //pixel position

//3d mesh colliders to be placed in front of quad layer to simulate interactions
const planeHeight = quadUIscaleHeight * 2;
const planeWidth = quadUIscaleWidth * 2;

let widthRatio = uiCanvas.width / planeWidth;
let heightRatio = uiCanvas.height / planeHeight / 2; //divided by two because our canvas is a top-button stereo image

console.log('widthRatio', widthRatio);
console.log('heightRatio', heightRatio);

const boxWidth = buttonWidth / widthRatio      // meters 
const boxHeight = buttonHeight / heightRatio   //meters 

console.log("boxWidth", boxWidth);
console.log("boxHeight", boxHeight);

var battleCollider;
var forestCollider;
var dreamCollider;

async function createQuadIU() {
    await new Promise(resolve => setTimeout(resolve, 100));
    let layer = new WebXRQuadUILayer(canvasImage, "canvasQuad", quadUIscaleWidth, quadUIscaleHeight, layerDepth, quadUIpositionX, quadUIpositionY, true);
    layer.createLayer()
    layers["canvasQuad"] = layer
    activeLayers.push(layer)
    console.log(xrSession.renderState.layers.length)
    xrSession.updateRenderState({
        layers: [
            // xrSession.renderState.layers[xrSession.renderState.layers.length - 2],
            layer.layer,
            xrSession.renderState.layers[xrSession.renderState.layers.length - 1]
        ]
    });
}


function createCanvasUI() {
    console.log("creating canvas ui")

    let context = uiCanvas.getContext('2d');

    // context.fillStyle = 'rgba(0, 0, 0, 0.5)'; // Black with 50% opacity

    // // Fill the entire canvas
    // context.fillRect(0, 0, uiCanvas.width, uiCanvas.height);
    // context.fillStyle = 'blue';
    // context.fillRect(2000, 0, 2000, 4000);

    let bfimage = new Image();
    bfimage.src = './Assets/Images/BattleLeftBlurred.png';
    let forestimage = new Image();
    forestimage.src = './Assets/Images/ForestLeftBlurred.png';
    let dreamimage = new Image();
    dreamimage.src = './Assets/Images/DreamLeftBlurred.png';

    let bfimageRight = new Image();
    bfimageRight.src = './Assets/Images/BattleRightBlurred.png';
    let forestimageRight = new Image();
    forestimageRight.src = './Assets/Images/ForestRightBlurred.png';
    let dreamimageRight = new Image();
    dreamimageRight.src = './Assets/Images/DreamRightBlurred.png';


    Promise.all([
        new Promise((resolve) => { bfimage.onload = () => { context.drawImage(bfimage, battleX, battleY + uiCanvas.width / 2, buttonWidth, buttonHeight); resolve(); } }),
        new Promise((resolve) => { forestimage.onload = () => { context.drawImage(forestimage, forestX, battleY + uiCanvas.width / 2, buttonWidth, buttonHeight); resolve(); } }),
        new Promise((resolve) => { dreamimage.onload = () => { context.drawImage(dreamimage, dreamX, battleY + uiCanvas.width / 2, buttonWidth, buttonHeight); resolve(); } }),

        new Promise((resolve) => { bfimageRight.onload = () => { context.drawImage(bfimageRight, battleX, battleY, buttonWidth, buttonHeight); resolve(); } }),
        new Promise((resolve) => { forestimageRight.onload = () => { context.drawImage(forestimageRight, forestX, forestY, buttonWidth, buttonHeight); resolve(); } }),
        new Promise((resolve) => { dreamimageRight.onload = () => { context.drawImage(dreamimageRight, dreamX, dreamY, buttonWidth, buttonHeight); resolve(); } })

    ]).then(() => {
        console.log('All images loaded and drawn');
        
        canvasImage = new Image();
        canvasImage.src = uiCanvas.toDataURL();
        canvasImage.onload = function () {
            //console.log("creating quad ui layer")
            // context.clearRect(0, 0, uiCanvas.width, uiCanvas.height / 2);
            
            const uiTexture = new THREE.Texture(canvasImage);
            uiTexture.needsUpdate = true;
            
            // Create the material using the texture
            const uiMaterial = new THREE.MeshBasicMaterial({ map: uiTexture, transparent: true, opacity: 1.0, side: THREE.DoubleSide,  depthWrite: false});
            
            // Create the plane geometry
            const uiGeometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
            
            // Modify the UV coordinates to map only the top half of the image
            const uvAttribute = uiGeometry.attributes.uv;
            for (let i = 0; i < uvAttribute.count; i++) {
                const uv = new THREE.Vector2().fromBufferAttribute(uvAttribute, i);
                uv.y *= 0.5; // Scale the y-coordinate to map only the top half
                uvAttribute.setXY(i, uv.x, uv.y);
            }
            uiGeometry.attributes.uv.needsUpdate = true;
            // Create the mesh with the modified geometry and material
            uiMesh = new THREE.Mesh(uiGeometry, uiMaterial);
            uiMesh.renderOrder = -1;
            // Position the mesh and add it to the scene
            uiMesh.position.set(quadUIpositionX, quadUIpositionY, layerDepth);
            scene.add(uiMesh);

        }

    });

}

createCanvasUI()


function addColliders() {

    console.log("adding colliders")
    const loader = new THREE.TextureLoader();

    loader.load('./Assets/Images/border.png', function (texture) {
        console.log("texture loaded")
        const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 1.0, side: THREE.DoubleSide });
        const geometry = new THREE.BoxGeometry(boxWidth, boxHeight, 0.005);

        battleCollider = new THREE.Mesh(geometry, material);
        forestCollider = new THREE.Mesh(geometry, material);
        dreamCollider = new THREE.Mesh(geometry, material);
        group.add(battleCollider, forestCollider, dreamCollider);


        let battleTimeout;
        let battleColliderHovered = false;
        battleCollider.addEventListener('mousemove', (event) => {

            // Clear previous timeout
            clearTimeout(battleTimeout);
            if (!battleColliderHovered) {
                battleColliderHovered = true;
                battleCollider.visible = true;
            }

            // Set a new timeout to detect the end of a batch
            battleTimeout = setTimeout(() => {
                battleCollider.visible = false;
                battleColliderHovered = false;
            }, 400);

        });

        let forestTimeout;

        let forestColliderHovered = false;
        forestCollider.addEventListener('mousemove', (event) => {

            // Clear previous timeout
            clearTimeout(forestTimeout);
            if (!forestColliderHovered) {
                forestColliderHovered = true;
                forestCollider.visible = true;
            }
            // Set a new timeout to detect the end of a batch
            forestTimeout = setTimeout(() => {
                forestCollider.visible = false;
                forestColliderHovered = false;
            }, 100);

        });

        let dreamTimeout;
        let dreamColliderHovered = false;
        dreamCollider.addEventListener('mousemove', (event) => {

            // Clear previous timeout
            clearTimeout(dreamTimeout);
            if (!dreamColliderHovered) {
                dreamColliderHovered = true;
                dreamCollider.visible = true;
            }

            // Set a new timeout to detect the end of a batch
            dreamTimeout = setTimeout(() => {
                dreamCollider.visible = false;
                dreamColliderHovered = false;
            }, 400);

        });

        dreamCollider.addEventListener('click', () => {
            console.log("clicked dream")
            selectLayer("dream")
        });
        forestCollider.addEventListener('click', () => {
            console.log("clicked forest")
            selectLayer("forest")
        });
        battleCollider.addEventListener('click', () => {
            console.log("clicked battle")
            selectLayer("battlefield")
        });


        battleCollider.position.set(mapValueWidth(battleX), mapValueHeight(battleY), layerDepth) //battlePosition
        forestCollider.position.set(mapValueWidth(forestX), mapValueHeight(forestY), layerDepth)
        dreamCollider.position.set(mapValueWidth(dreamX), mapValueHeight(dreamY), layerDepth)

    });




}
// addColliders()
window.addColliders = addColliders;
addColliders()
function selectLayer(imagename) {
    if (layers[imagename]) {
        if (!layers[imagename].layer) {
            createLayer(imagename)
        }
        setLayer(imagename)
    } else {
        //handle
    }

}

function mapValueWidth(input) {
    // Define the old and new ranges
    const canvasMin = 0;
    const canvasMax = uiCanvas.width - buttonWidth;
    console.log(canvasMax);
    const boxPositionMin = -(planeWidth / 2) + (boxWidth / 2);
    const boxPositionMax = planeWidth / 2 - (boxWidth / 2);

    // lerp
    const mappedValue = ((input - canvasMin) / (canvasMax - canvasMin)) * (boxPositionMax - boxPositionMin) + boxPositionMin + quadUIpositionX;
    console.log(mappedValue);
    return mappedValue;
}

function mapValueHeight(input) {
    const canvasMin = 0;
    const canvasMax = (uiCanvas.height / 2) - buttonHeight;
    const boxPositionMin = -(planeHeight / 2) + (boxHeight / 2);
    const boxPositionMax = planeHeight / 2 - (boxHeight / 2);
    // lerp
    const mappedValue = ((input - canvasMin) / (canvasMax - canvasMin)) * (boxPositionMax - boxPositionMin) + boxPositionMin - quadUIpositionY;
    console.log(mappedValue);
    return -mappedValue;
}




//supported compressed formats, get the name of format from three js constant
const supportedCompressedFormats = new Map([
    [36196, "etc.COMPRESSED_R11_EAC"],
    [37496, "etc.COMPRESSED_RGBA8_ETC2_EAC"],
    [37492, "etc.COMPRESSED_RGB8_ETC2"],
    [37808, "astc.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR"], //
    [37840, "astc.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR"], //
    [1023, "srgb"],
]);



// creating three js stats
// copying three js stats to a canvas texture
// creating a plane geometry, adding statsTexture to the plane and adding to scene as a worldspace ui element for vr

stats = new Stats();
let statsCanvas = stats.dom.children[0];
const statsTexture = new THREE.CanvasTexture(statsCanvas);
statsTexture.minFilter = THREE.LinearFilter;
const statsMaterial = new THREE.MeshBasicMaterial({ map: statsTexture });
const statsGeometry = new THREE.PlaneGeometry(1, 1); // Adjust size as needed
const statsMesh = new THREE.Mesh(statsGeometry, statsMaterial);
statsMesh.position.set(2, 5, -10); // Adjust position as needed
scene.add(statsMesh);

setInterval(updateStatsMesh, 1000 / 60); // Update at 60 FPS
// // document.body.appendChild();
function updateStatsMesh() {
    statsMaterial.needsUpdate = true;
    statsTexture.needsUpdate = true;

}

window.statsMesh = statsMesh;

