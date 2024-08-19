import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { HTMLMesh } from 'three/addons/interactive/HTMLMesh.js';
import { InteractiveGroup } from 'three/addons/interactive/InteractiveGroup.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import { XRHandModelFactory } from 'three/addons/webxr/XRHandModelFactory.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import ThreeMeshUI from 'https://cdn.skypack.dev/three-mesh-ui';
import { CustomControls, CustomSkyCamera, setupScene, CustomRenderer, CustomControllers, WebXRCubeLayer, WebXREquirectangularLayer } from './main.js';



//testing binding all image textures to the gl context. and then just toggling which layers are in the renderstate. 
//this is a proof of concept for a future implementation where we can switch between different compressed textures in the same session.


let scene, camera, renderer, controls, controllers, group, ktx2Loader, gl, glBinding, xrSpace, xrSession;
let eqrtRadius = 40;
let needsRedraw = false;
let layers = []
let layersToDraw = []
let layersOBJ = new Object();


const htmlContent = document.querySelector('#html-content');
//create scene, add lights and some geometry
scene = new THREE.Scene();
let meshParent = new THREE.Object3D();
window.meshParent = meshParent;
scene.add(meshParent);
setupScene(scene, meshParent);

//create camera
camera = new CustomSkyCamera().camera;

//create renderer, add it to the dom and set animation loop
renderer = new CustomRenderer().renderer;
document.body.appendChild(renderer.domElement);
renderer.setAnimationLoop(animate);

//add event listeners for the start and end of the xr session
renderer.xr.addEventListener('sessionstart', () => onSessionStart());
renderer.xr.addEventListener('sessionend', () => onSessionEnd());

//add vr button
document.body.appendChild(VRButton.createButton(renderer));

//add pc controls ('awsd' to move, mouse to look around)
controls = new CustomControls(camera, renderer).controls;

//create vr hand controls with models
controllers = new CustomControllers(scene, renderer).controllers;

//create interactive group
group = new InteractiveGroup();
group.listenToXRControllerEvents(controllers[0]);
group.listenToXRControllerEvents(controllers[1]);
scene.add(group);

//create ktx2 loader ?maybe should be a function?
ktx2Loader = new KTX2Loader();
ktx2Loader.setTranscoderPath('https://cdn.jsdelivr.net/npm/three@0.154.0/examples/jsm/libs/basis/');
ktx2Loader.detectSupport(renderer);
ktx2Loader.setWorkerLimit(8);

//create objects to store our webxr layers
let equirectangularLayers = new Object();
let cubeLayers = new Object();

//mock data for gpu compressed textures
// './textures/compressed360/bf4.ktx2', './textures/compressed360/Italy_Mountains.ktx2', './textures/compressed360/SnowySnow360.ktx2', './textures/compressed360/Mountain.ktx2',
let sources = [

    // { name: "cubemapRight", url: 'textures/compressedStereoCubeMaps/cubemap_uastc.ktx2', type: "cubemap" },
    // { name: "Gemini", url: 'textures/compressed360/2022_03_30_Gemini_North_360_Outside_08-CC_uastc.ktx2', type: "equirectangular" },

    { name: "Gemini", url: 'textures/compressed360Stereo/bfleft.ktx2', type: "equirectangular" },
]

const img = new Image();
img.src = 'textures/compressed360Stereo/sources/bf2.jpg';
let data;
let dataTopLeft;
let dataTopRight;
let dataBottomLeft;
let dataBottomRight;

// const textureLoader = new THREE.TextureLoader();
// textureLoader.load('textures/compressed360Stereo/sources/bf2.jpg', (texture) => {
//     const img = texture.image;

//     // Create a canvas and draw the texture onto it
//     const canvas = document.createElement('canvas');
//     const ctx = canvas.getContext('2d');

//     canvas.width = img.width;
//     canvas.height = img.height;

//     console.log(img.height);
//     console.log(img.width);

//     ctx.drawImage(img, 0, 0);

//     // Get RGBA data
//     const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
//     const data = imageData.data; // This is a Uint8ClampedArray

//     // Calculate the number of pixels in each quarter
//     const halfWidth = Math.floor(canvas.width / 2);
//     const halfHeight = Math.floor(canvas.height / 2);
//     const quarterPixels = halfWidth * halfHeight * 4; // 4 bytes per pixel (RGBA)

//     // Split the data into four equal parts
//     dataTopLeft = new Uint8ClampedArray(quarterPixels);
//     dataTopRight = new Uint8ClampedArray(quarterPixels);
//     dataBottomLeft = new Uint8ClampedArray(quarterPixels);
//     dataBottomRight = new Uint8ClampedArray(quarterPixels);

//     for (let y = 0; y < canvas.height; y++) {
//         for (let x = 0; x < canvas.width; x++) {
//             const pixelIndex = (y * canvas.width + x) * 4;
//             const quarterIndex = ((y % halfHeight) * halfWidth + (x % halfWidth)) * 4;

//             if (y < halfHeight && x < halfWidth) {
//                 dataTopLeft.set(data.slice(pixelIndex, pixelIndex + 4), quarterIndex);
//             } else if (y < halfHeight && x >= halfWidth) {
//                 dataTopRight.set(data.slice(pixelIndex, pixelIndex + 4), quarterIndex);
//             } else if (y >= halfHeight && x < halfWidth) {
//                 dataBottomLeft.set(data.slice(pixelIndex, pixelIndex + 4), quarterIndex);
//             } else {
//                 dataBottomRight.set(data.slice(pixelIndex, pixelIndex + 4), quarterIndex);
//             }
//         }
//     }

//     console.log(dataTopLeft);
//     console.log(dataTopRight);
//     console.log(dataBottomLeft);
//     console.log(dataBottomRight);
// });

// //simple solution for now. Manu
// let dataLeft;
// let dataMiddleLeft;
// let dataMiddleRight;
// let dataRight;

// const textureLoader = new THREE.TextureLoader();
// textureLoader.load('textures/compressed360Stereo/sources/bf2.jpg', (texture) => {
//     const img = texture.image;

//     // Create a canvas and draw the texture onto it
//     const canvas = document.createElement('canvas');
//     const ctx = canvas.getContext('2d');

//     canvas.width = img.width;
//     canvas.height = img.height;

//     console.log(img.height);
//     console.log(img.width);

//     ctx.drawImage(img, 0, 0);

//     // Get RGBA data
//     const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
//     const data = imageData.data; // This is a Uint8ClampedArray

//     // Calculate the number of pixels in each quarter
//     const quarterHeight = Math.floor(canvas.height / 4);
//     const quarterPixels = quarterHeight * canvas.width * 4; // 4 bytes per pixel (RGBA)

//     // Split the data into four equal parts
//     dataTop = new Uint8ClampedArray(data.slice(0, quarterPixels));
//     dataMiddleTop = new Uint8ClampedArray(data.slice(quarterPixels, 2 * quarterPixels));
//     dataMiddleBottom = new Uint8ClampedArray(data.slice(2 * quarterPixels, 3 * quarterPixels));
//     dataBottom = new Uint8ClampedArray(data.slice(3 * quarterPixels));

//     console.log(dataTop);
//     console.log(dataMiddleTop);
//     console.log(dataMiddleBottom);
//     console.log(dataBottom);
// });







let layer = null;
let width = 7168;
let height = 7168;

function makeLayer() {

    layer = glBinding.createEquirectLayer({
        space: xrSpace,
        viewPixelWidth: 4096,//3584,
        viewPixelHeight: 4096,///8192/2,//3584, //3584
        layout: "stereo-top-bottom",
        colorFormat: ASTC_EXT.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR,
        isStatic: "false",


    });

    layer.centralHorizontalAngle = Math.PI * 1;
    layer.upperVerticalAngle = -Math.PI / 2.0;
    layer.lowerVerticalAngle = Math.PI / 2.0;
    layer.radius = 40;
    // redrawing = true

    xrSession.updateRenderState({
        layers: [
            layer,
            xrSession.renderState.layers[xrSession.renderState.layers.length - 1]
        ]
    });
 
}

window.makeLayer = makeLayer


function Framebuffer() {

    gl.finish();

    let framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, intermediateTexture, 0);
    // Ensure all previous GL commands are complete

    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE) {
        gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 0, 0, width, height);
        console.log("looking good")
    } else {
        console.error("Framebuffer is not complete.");
    }

    gl.finish();

    // Check the framebuffer status
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);

    if (status !== gl.FRAMEBUFFER_COMPLETE) {
        switch (status) {
            case gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT:
                console.error("Framebuffer incomplete: Attachment is not complete.");
                break;
            case gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT:
                console.error("Framebuffer incomplete: No attachments.");
                break;
            case gl.FRAMEBUFFER_INCOMPLETE_DIMENSIONS:
                console.error("Framebuffer incomplete: Attached images must have the same dimensions.");
                break;
            case gl.FRAMEBUFFER_UNSUPPORTED:
                console.error("Framebuffer incomplete: Unsupported framebuffer format.");
                break;
            default:
                console.error("Framebuffer incomplete: Unknown error.");
        }
    } else {
        console.log("Framebuffer is complete.");
        // // Clean up
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.deleteFramebuffer(framebuffer);

    }
}

window.Framebuffer = Framebuffer


//webgl context
gl = renderer.getContext();

//get compressed texture extensions
const ASTC_EXT = gl.getExtension("WEBGL_compressed_texture_astc")
const ETC_EXT = gl.getExtension("WEBGL_compressed_texture_etc")

if (ASTC_EXT) console.log("ASTC_EXT", ASTC_EXT)
if (ETC_EXT) console.log("ETC_EXT", ETC_EXT)


//supported compressed formats
const supportedCompressedFormats = new Map([
    [37496, "ETC_EXT.COMPRESSED_RGBA8_ETC2_EAC"],
    [37492, "ETC_EXT.COMPRESSED_RGB8_ETC2"],
    [37808, "ASTC_EXT.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR"],
    [1023, "gl.RGBA "]

]);



//this is only necessary for gpu restricted devices. In fact this approach may only be necessary for those devices that support webxr layers
//each compressed image source is loaded and then transformed to a webxr layer and stored in either equirectangularLayers or cubeLayers. 
//The underlying textures will also be used in the future for rendering outside the xr session and will then be stored in compressed360Textures or compressedCubeTextures. i.e this will be refactored
for (let i = 0; i < sources.length; i++) {
    createCompressedTextureLayer(sources[i]) //,is createLayerFromCompressedTexture a better name?
}


let offset = 0;
//create a compressed texture and then create a webxr layer from that texture. 
function createCompressedTextureLayer(image) {

    ktx2Loader.load(image.url,
        (texture) => {
            console.log("texture", texture.format)
            console.log(texture.mipmaps[0].width)
            console.log(texture.mipmaps[0].height)
            console.log(texture.mipmaps[0].data)
            if (!ASTC_EXT && !ETC_EXT) {
                //in the future we should have seperate handling for pc and vr devices. this is just a little hack for now
                console.log("no compressed texture extensions available")
                console.log(texture)
                console.log(texture.mipmaps[0].data)

                return
            }

            console.log("format", texture.format)
            let format = eval(supportedCompressedFormats.get(texture.format))



            if (image.type === "equirectangular") {
                console.log("created equirectangular texture, creating webxr layer")
                // initializeCompressed(texture.mipmaps[0].width, texture.mipmaps[0].height, texture.mipmaps[0].data.length)
                data = texture.mipmaps[0].data;
                // let equirectLayer = new WebXREquirectangularLayer(null, texture, false, format, eqrtRadius);
                // equirectangularLayers[image.name] = equirectLayer
                // offset += 0.1;
                // createButton(image.name + " create layer", () => { createEquirectangularLayer(image.name, equirectangularLayers) }, 0, offset)

            }

        }, null, null);
}

// let chunkSize = 512; // Define the size of each chunk (e.g., 512 rows)
let uploadInProgress = false;
let currentChunk = 0;
let totalChunks = 1;
let intermediateTexture = null;
// let width = 4096;   // layer.Equirectangular_Texture.mipmaps[0].width;
// let height = 2048;  // layer.Equirectangular_Texture.mipmaps[0].height;


function makeBox(){
    let geometry = new THREE.BoxGeometry(1, 1, 1);
    let material = new THREE.MeshBasicMaterial({ texture: intermediateTexture });
    let cube = new THREE.Mesh(geometry, material);
    scene.add(cube);
    cube.position.set(0, 0, -3);
}

window.makeBox = makeBox

function initialize() {
    intermediateTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, intermediateTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    console.log(intermediateTexture)
// console.log(data)
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.finish();


}



window.initialize = initialize
//animation loop
function animate(t, frame) {

    const xr = renderer.xr;
    const session = xr.getSession();
    xrSession = session;
    
    if (session && session.renderState.layers !== undefined && session.hasMediaLayer === undefined) {

        console.log("creating media layer")
        session.hasMediaLayer = true;
        session.requestReferenceSpace('local-floor').then((refSpace) => {

            glBinding = xr.getBinding();
            xrSpace = refSpace;
            // createEquireLayer(compressed360Textures[0], null, false)    


        });

    }

    if (session && layer && layer.needsRedraw) {

        // let glayer = glBinding.getSubImage(layer, frame);
        // let glayer = glBinding.getSubImage(layer, frame, 'left');
        // gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        // gl.bindTexture(gl.TEXTURE_2D, glayer.colorTexture);
        //  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width/2, height/2, gl.RGBA,gl.UNSIGNED_BYTE, dataTopLeft);
        gl.bindTexture(gl.TEXTURE_2D, null);

        // glayer = glBinding.getSubImage(layer, frame, 'left');
        // gl.bindTexture(gl.TEXTURE_2D, glayer.colorTexture);

        // gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width/2, height/2, gl.RGBA,gl.UNSIGNED_BYTE, dataTopLeft);
        // gl.bindTexture(gl.TEXTURE_2D, null);

        // let framebuffer = gl.createFramebuffer();
        // gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        // gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, intermediateTexture, 0);
        // // Ensure all previous GL commands are complete
        // console.log(intermediateTexture)

        // if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE) {
        //     console.log("looking good")
        // } else {
        //     console.error("Framebuffer is not complete.");
        // }


        // gl.bindTexture(gl.TEXTURE_2D, glayer.colorTexture);
        
        // // Copy the texture data from the framebuffer to the glayer texture
        // // gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 0, 0, width, height);

        // gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        // gl.bindTexture(gl.TEXTURE_2D, null);
        // gl.deleteFramebuffer(framebuffer);


        console.log('all is well that ends well')

        //compressed texture test
        
  
        // let width = activeWebXRLayer.Equirectangular_Texture.mipmaps[0].width;
        // let height = activeWebXRLayer.Equirectangular_Texture.mipmaps[0].height;
        let glayer = glBinding.getSubImage(layer, frame);
        // let glayer = glBinding.getSubImage(activeWebXRLayer.layer, frame);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.bindTexture(gl.TEXTURE_2D, glayer.colorTexture);
        gl.compressedTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 4096, 8192, ASTC_EXT.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR, data);
        gl.bindTexture(gl.TEXTURE_2D, null);


    }



    function drawEquirectangular(layer) {

        let format = eval(activeWebXRLayer.format);
        let width = activeWebXRLayer.Equirectangular_Texture.mipmaps[0].width;
        let height = activeWebXRLayer.Equirectangular_Texture.mipmaps[0].height;

        let glayer = glBinding.getSubImage(activeWebXRLayer.layer, frame);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.bindTexture(gl.TEXTURE_2D, glayer.colorTexture);
        gl.compressedTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, format, data);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }


    window.renderByIndex = renderByIndex


    renderer.render(scene, camera);
    controls.update();

}



function renderByIndex(index) {
    xrSession.updateRenderState({
        layers: [
            layers[index].layer,
            xrSession.renderState.layers[xrSession.renderState.layers.length - 1]
        ]
    });
}



//utils  / control-flow-logic


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



function createEquirectangularLayer(imagename = 'textures/compressedCubeMaps/cubemapRight.ktx2', imagetype = cubeLayers) {
    let layer = imagetype[imagename]
    layer.createLayer()
    layersToDraw.push(layer)
    layers.push(layer)
    layersOBJ[imagename] = layer
    offset -= 0.1;
    createButton(`show ${imagename}`, () => { selectActiveLayerByName(imagename) }, 0.2, offset)


}


function selectActiveLayerByName(name) {

    console.log(layersOBJ[name])
    xrSession.updateRenderState({
        layers: [
            layersOBJ[name].layer,
            xrSession.renderState.layers[xrSession.renderState.layers.length - 1]
        ]
    });


}

function onSessionEnd() {
    console.log("session ended")
    meshParent.visible = true;

}

function onSessionStart() {
    console.log("session started")
    meshParent.visible = false;
}



function createButton(name, callbackFunction, xOffset, yOffset) {
    let button = document.createElement('button');
    button.onclick = () => { callbackFunction() }; //{}
    button.innerText = `${name}`;
    button.style.zIndex = 1;
    button.className = "button";
    htmlContent.appendChild(button);

    // Create an HTMLMesh to attach the button to the plane
    let mesh = new HTMLMesh(button);
    mesh.position.x = - 0.75 + xOffset;
    mesh.position.y = 1.5 + (yOffset * 1.5);
    mesh.position.z = - 0.5 + (-xOffset * 4);
    mesh.rotation.y = (Math.PI / 4);
    mesh.scale.setScalar(2);

    group.add(mesh);


}



// window.selectActiveLayer = selectActiveLayer
window.equirectangularLayers = equirectangularLayers
window.cubeLayers = cubeLayers
