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
    { name: "Gemini", url: 'textures/compressed360/2022_03_30_Gemini_North_360_Outside_08-CC_uastc.ktx2', type: "equirectangular" },
    // { name: "bf4", url: 'textures/compressed360Stereo/bf4.ktx2', type: "stereoEquirectangular" },


    // { name: "stereoCubeMap", url: 'textures/compressedStereoCubeMaps/cubemapLeft.ktx2', type: "stereoCubeMap", leftSide: true },
    // { name: "stereoCubeMap", url: 'textures/compressedStereoCubeMaps/cubemapRight.ktx2', type: "stereoCubeMap", leftSide: false },
    // { name: "sources/Atlas1.ktx2", url: 'textures/compressed360Stereo/bf4.ktx2', type: "stereoEquirectangular" },


    // { name: "cubemap_bf", url: 'textures/compressedStereoCubeMaps/cubemap_bf_left.ktx2', type: "stereoCubeMap", leftSide: true },
    // { name: "cubemap_bf", url: 'textures/compressedStereoCubeMaps/cubemap_bf_right.ktx2', type: "stereoCubeMap", leftSide: false },

]

const img = new Image();
img.src = 'textures/compressed360Stereo/sources/bf2.jpg';

let data = [];
const CHUNK_SIZE = 2048; // Define a chunk size that is within the browser's canvas size limit

img.onload = () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    console.log("img", img.width, img.height)
    const chunksX = Math.ceil(img.width / CHUNK_SIZE);
    const chunksY = Math.ceil(img.height / CHUNK_SIZE);

    for (let y = 0; y < chunksY; y++) {
        for (let x = 0; x < chunksX; x++) {
            const startX = x * CHUNK_SIZE;
            const startY = y * CHUNK_SIZE;
            const width = Math.min(CHUNK_SIZE, img.width - startX);
            const height = Math.min(CHUNK_SIZE, img.height - startY);

            canvas.width = width;
            canvas.height = height;

            ctx.drawImage(img, startX, startY, width, height, 0, 0, width, height);

            const imageData = ctx.getImageData(0, 0, width, height);
            data.push(...imageData.data);
        }
    }

    console.log(data);
};
let layer = null;


function makeLayer() {
    // let layer = new WebXREquirectangularLayer(null, texture, true, "gl.RGBA", eqrtRadius);
    // Method to create the WebXR layer


    layer = glBinding.createEquirectLayer({
        space: xrSpace,
        viewPixelWidth: 8192,
        viewPixelHeight: 8192 / 2,
        layout: "mono",
        colorFormat: gl.RGBA,
        isStatic: "true",


    });

    layer.centralHorizontalAngle = Math.PI * 2;
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

    uploadInProgress = true;
    // layersToDraw.push(layer)
    // layers.push(layer)
    // layersOBJ["image"] = layer
    // offset -= 0.1;
    // createButton(`show image`, () => { selectActiveLayerByName("image") }, 0.2, offset)
}

window.makeLayer = makeLayer



// { name: "bf4_1", url: 'textures/compressed360Stereo/bf4_uastc_1.ktx2', type: "stereoEquirectangular" },
// { name: "bf4_2", url: 'textures/compressed360Stereo/bf4_uastc_2.ktx2', type: "stereoEquirectangular" },
// { name: "bf4_3", url: 'textures/compressed360Stereo/bf4_uastc_3.ktx2', type: "stereoEquirectangular" },


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
                return
            }

            console.log("format", texture.format)
            let format = eval(supportedCompressedFormats.get(texture.format))


            if (image.type === "stereoCubeMap") {
                console.log(`adding other side to stereocube texture ${image.url}`)
                if (image.name in cubeLayers) {
                    if (image.leftSide) {
                        cubeLayers[image.name].Cube_Texture = texture
                    } else {
                        cubeLayers[image.name].Cube_Texture_Right = texture
                    }
                } else {
                    console.log("created stereo cube texture, creating webxr layer")
                    if (image.leftSide) {
                        let cubeLayer = new WebXRCubeLayer(null, texture, null, true, format);
                        cubeLayers[image.name] = cubeLayer
                        offset += 0.1;
                        createButton(image.name + " create layer", () => { createStereoCubeLayer(image.name, cubeLayers) }, 0, offset)
                    } else {
                        let cubeLayer = new WebXRCubeLayer(null, null, texture, true, format);
                        cubeLayers[image.name] = cubeLayer
                        offset += 0.1;
                        createButton(image.name + " create layer", () => { createStereoCubeLayer(image.name, cubeLayers) }, 0, offset)


                    }

                }
            }

            if (image.type === "cubemap") {
                console.log("created cube texture, creating webxr layer")

                let cubeLayer = new WebXRCubeLayer(null, texture, null, false, format);
                cubeLayers[image.name] = cubeLayer
                offset += 0.1;
                createButton(image.name + " create layer", () => { createCubeLayer(image.name, cubeLayers) }, 0, offset)


            }
            if (image.type === "equirectangular") {
                console.log("created equirectangular texture, creating webxr layer")

                initializeCompressed(texture.mipmaps[0].width, texture.mipmaps[0].height, texture.mipmaps[0].data.length)
                // console.log(texture.mipmaps[0].data)
                let equirectLayer = new WebXREquirectangularLayer(null, texture, false, format, eqrtRadius);
                equirectangularLayers[image.name] = equirectLayer
                offset += 0.1;
                createButton(image.name + " create layer", () => { createEquirectangularLayer(image.name, equirectangularLayers) }, 0, offset)

            }
            if (image.type === "stereoEquirectangular") {
                console.log("created stereo equirectangular texture, creating webxr layer")

                let stereoEquirectLayer = new WebXREquirectangularLayer(null, texture, true, format, eqrtRadius);
                equirectangularLayers[image.name] = stereoEquirectLayer

                offset += 0.1;
                createButton(image.name + " create layer", () => { createStereoEquirectangularLayer(image.name, equirectangularLayers) }, 0, offset)




            }

        }, null, null);
}

// let chunkSize = 512; // Define the size of each chunk (e.g., 512 rows)
let uploadInProgress = false;
// let redrawing = false
// let width = 4096
// let height = 2048
// let currentChunk = 0;
// let totalChunks = Math.ceil(height / chunkSize);

// function uploadNextChunk() {

//     if (currentChunk < totalChunks) {
//         console.log("huh")
//         let startRow = currentChunk * chunkSize;
//         let endRow = Math.min(startRow + chunkSize, height);
//         let chunkHeight = endRow - startRow;
//         let chunkData = data.subarray(startRow * width * 4, endRow * width * 4);

//         gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, startRow, width, chunkHeight, gl.RGBA, gl.UNSIGNED_BYTE, chunkData);

//         currentChunk++;
//     } else {
//         console.log("Texture upload complete");
//         // Mark the texture as fully loaded
//         redrawing = false
//         layer.needsRedraw = false;
//     }
// }

let currentChunk = 0;
let totalChunks = 1;
let intermediateTexture = null;
let width = 8192;   // layer.Equirectangular_Texture.mipmaps[0].width;
let height = 8192 ;  // layer.Equirectangular_Texture.mipmaps[0].height;


function calculateASTCDataSize(textureWidth, textureHeight, blockWidth, blockHeight) {
    const blockSize = 16;  // Each ASTC block is 16 bytes (128 bits)

    // Calculate the number of blocks in each dimension, rounding up
    const numBlocksWidth = Math.ceil(textureWidth / blockWidth);
    const numBlocksHeight = Math.ceil(textureHeight / blockHeight);

    // Calculate the total number of blocks
    const totalBlocks = numBlocksWidth * numBlocksHeight;

    // Calculate the total size in bytes
    const totalSize = totalBlocks * blockSize;

    return totalSize;
}

function initialize() {
    intermediateTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, intermediateTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

}

function initializeCompressed(width, height, dataSize) {
    // const dataSize = calculateASTCDataSize(width, height, 4, 4);
    // console.log(`Data size for ASTC texture: ${dataSize} bytes`);
    console.log("initializing compressed intermediate texture")

    // console.log("width", width)
    // console.log("height", height)
    // console.log("dataSize", dataSize)
    // Create the placeholder Uint8Array
    let placeholderData = new Uint8Array(dataSize);
    intermediateTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, intermediateTexture);
    gl.compressedTexImage2D(gl.TEXTURE_2D, 0, ASTC_EXT.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR, width, height, 0, placeholderData);

}

window.initialize = initialize
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
            // createEquireLayer(compressed360Textures[0], null, false)    


        });

    }

    if (session && layer && layer.needsRedraw) {


            // let format = eval(layer.format);
            // let width = layer.Equirectangular_Texture.mipmaps[0].width;
            // let height = layer.Equirectangular_Texture.mipmaps[0].height;

            let glayer = glBinding.getSubImage(layer.layer, frame);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
            gl.bindTexture(gl.TEXTURE_2D, glayer.colorTexture);
            gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, data);
            gl.bindTexture(gl.TEXTURE_2D, null);
        
        // console.log("redrawing");
        // if (currentChunk < totalChunks) {
        //     console.log("uploading data to intermediate texture");

        //     // Step 1: Create a new WebGL texture
        //     let halfHeight = Math.floor(height / 2);
        //     gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, halfHeight * currentChunk, width, halfHeight, gl.RGBA, gl.UNSIGNED_BYTE, data.subarray(0, width * halfHeight * 4));
        //     currentChunk++;
        // } else {
        //     console.log("transfering data from intermediate texture to layer texture");

        //     // Step 3: Bind the tempTexture to the glayer
        //     let glayer = glBinding.getSubImage(layer, frame);
        //     gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

        //     let framebuffer = gl.createFramebuffer();
        //     gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        //     gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, intermediateTexture, 0)

        //     if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
        //         console.error("Framebuffer is not complete");
        //     }

        //     gl.bindTexture(gl.TEXTURE_2D, glayer.colorTexture);
        //     gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 0, 0, width, height);

        //     // Clean up
        //     gl.bindTexture(gl.TEXTURE_2D, null);
        //     gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        //     gl.deleteFramebuffer(framebuffer);
        //     gl.deleteTexture(intermediateTexture);
        }



        // Step 2: Incrementally upload data to the texture




        // let halfHeight = Math.floor(height / 2);
        // gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, halfHeight, width, halfHeight, gl.RGBA, gl.UNSIGNED_BYTE, data.subarray(0, width * halfHeight * 4));
        // gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, halfHeight, gl.RGBA, gl.UNSIGNED_BYTE, data.subarray(0, width * halfHeight * 4));

    }

    if (session && layersToDraw.length > 0) {
        console.log("keep drawing")
        for (let layer in layersToDraw) {
            if (layersToDraw[layer].layer.needsRedraw) {
                console.log(layersToDraw[layer].type)
                if (layersToDraw[layer].type === "WebXRCubeLayer") {
                    if (layersToDraw[layer].stereo) {
                        drawStereoCube(layersToDraw[layer])
                        layersToDraw.splice(layer, 1);
                    } else {
                        drawCube(layersToDraw[layer])
                        layersToDraw.splice(layer, 1);

                    }

                } else if (layersToDraw[layer].type === "WebXREquirectangularLayer") {

                    if (layersToDraw[layer].stereo) {
                        drawStereoEquirectangular(layersToDraw[layer])
                        layersToDraw.splice(layer, 1);
                    } else {
                        drawEquirectangular(layersToDraw[layer])
                    }
                }
            }


        }
    }


    function drawCube(layer) {
        console.log("redrawing cube layer")

        let format = eval(layer.format);
        let width = layer.Cube_Texture.source.data[0].width;


        let glayer = glBinding.getSubImage(layer.layer, frame);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, glayer.colorTexture);


        gl.compressedTexSubImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X, 0, 0, 0, width, width, format, layer.Cube_Texture.source.data[0].mipmaps[0].data); //es
        gl.compressedTexSubImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_X, 0, 0, 0, width, width, format, layer.Cube_Texture.source.data[1].mipmaps[0].data); //es
        gl.compressedTexSubImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Y, 0, 0, 0, width, width, format, layer.Cube_Texture.source.data[2].mipmaps[0].data); //es
        gl.compressedTexSubImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, 0, 0, 0, width, width, format, layer.Cube_Texture.source.data[3].mipmaps[0].data); //es
        gl.compressedTexSubImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Z, 0, 0, 0, width, width, format, layer.Cube_Texture.source.data[4].mipmaps[0].data); //es
        gl.compressedTexSubImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, 0, 0, 0, width, width, format, layer.Cube_Texture.source.data[5].mipmaps[0].data); //es

        gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);

    }

    // let currentChunk = 0;
    // let totalChunks = 2;

    function drawEquirectangular(layer) {

        //     let width = layer.Equirectangular_Texture.mipmaps[0].width;
        //     let height = layer.Equirectangular_Texture.mipmaps[0].height;
        //     const compressedData = layer.Equirectangular_Texture.mipmaps[0].data; // Your ASTC 4x4 compressed texture data array

        //     console.log("redrawing");

        //     if (currentChunk < totalChunks) {
        //         console.log("uploading data to intermediate texture");

        //         let chunkHeight = Math.floor(height / totalChunks);
        //         let mipSize = getMipSize(width, chunkHeight, ASTC_FORMAT);
        //         let mipData = compressedData.subarray(currentChunk * mipSize, (currentChunk + 1) * mipSize);

        //         if (!intermediateTexture) {
        //             intermediateTexture = gl.createTexture();
        //             gl.bindTexture(gl.TEXTURE_2D, intermediateTexture);
        //             gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        //             gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        //             gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        //             gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        //         } else {
        //             gl.bindTexture(gl.TEXTURE_2D, intermediateTexture);
        //         }

        //         gl.compressedTexImage2D(gl.TEXTURE_2D, 0, ASTC_FORMAT, width, chunkHeight, 0, mipData);

        //         currentChunk++;
        //     } else {
        //         console.log("transferring data from intermediate texture to layer texture");
        //         copyDataToLayer(gl, layer, frame, width, height, intermediateTexture);
        //     }

        //     checkGLError(gl);

        // //original code
        //     console.log("redrawing stereo equirectangular cube layer")
        //     let format = eval(layer.format);
        //     let width = layer.Equirectangular_Texture.mipmaps[0].width;
        //     let height = layer.Equirectangular_Texture.mipmaps[0].height;

        //     let glayer = glBinding.getSubImage(layer.layer, frame);
        //     gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        //     gl.bindTexture(gl.TEXTURE_2D, glayer.colorTexture);
        //     gl.compressedTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, format, layer.Equirectangular_Texture.mipmaps[0].data);
        //     gl.bindTexture(gl.TEXTURE_2D, null);


        // if (currentChunk < totalChunks) {
        //     console.log("uploading data to intermediate texture");

        //     // Step 1: Create a new WebGL texture
        //     let halfHeight = Math.floor(height / 2);
        //     gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, halfHeight * currentChunk, width, halfHeight, gl.RGBA, gl.UNSIGNED_BYTE, data.subarray(0, width * halfHeight * 4));
        //     currentChunk++;
        // } else {
        //     console.log("transfering data from intermediate texture to layer texture");

        //     // Step 3: Bind the tempTexture to the glayer
        //     let glayer = glBinding.getSubImage(layer, frame);
        //     gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

        //     let framebuffer = gl.createFramebuffer();
        //     gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        //     gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, intermediateTexture, 0)

        //     if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
        //         console.error("Framebuffer is not complete");
        //     }

        //     gl.bindTexture(gl.TEXTURE_2D, glayer.colorTexture);
        //     gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 0, 0, width, height);

        //     // Clean up
        //     gl.bindTexture(gl.TEXTURE_2D, null);
        //     gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        //     gl.deleteFramebuffer(framebuffer);
        //     gl.deleteTexture(intermediateTexture);
        // }
        let width = layer.Equirectangular_Texture.mipmaps[0].width;
        let height = layer.Equirectangular_Texture.mipmaps[0].height;
        const textureData = layer.Equirectangular_Texture.mipmaps[0].data; // Your ASTC 4x4 compressed texture data array

        if (currentChunk < totalChunks) {
            console.log("uploading data to intermediate texture");

            // Step 1: Create a new WebGL texture
            // Assuming `compressedData` contains the ASTC compressed data for the current chunk
            //let compressedData = getCompressedDataForChunk(data, width, halfHeight, currentChunk); // You need to implement this function

            gl.bindTexture(gl.TEXTURE_2D, intermediateTexture);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
            // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

            let portionX = 0; // Starting x position, must be multiple of 4
            let portionY = Math.floor(height / 2);//Math.floor(height / 2); // Starting y position (halfway down), must be multiple of 4
            portionY = portionY - (portionY % 4); // Adjust to be multiple of 4
            let portionWidth = width; // Width of the portion
            let portionHeight = Math.floor(height / 2); // Height of the portion (half the texture height)
            portionHeight = portionHeight - (portionHeight % 4); // Adjust to be multiple of 4

            // Get the block size for the format
            const blockSize = 16;

            if (blockSize === 0) {
                console.error('Unsupported texture format:', format);
                return;
            }

            // Calculate the number of blocks in the portion
            let numBlocksX = Math.ceil(portionWidth / 4);
            let numBlocksY = Math.ceil(portionHeight / 4);

            // Calculate the byte offset for the starting position
            let startBlockX = Math.floor(portionX / 4);
            let startBlockY = Math.floor(portionY / 4);
            let byteOffset = (startBlockY * Math.ceil(width / 4) + startBlockX) * blockSize;

            // Calculate the size of the portion in bytes
            let portionSize = numBlocksX * numBlocksY * blockSize;

            // Extract the portion of the texture data
            let compressedData = textureData.subarray(byteOffset, byteOffset + portionSize);

            gl.compressedTexSubImage2D(gl.TEXTURE_2D, 0, portionX, portionY, portionWidth, portionHeight, ASTC_EXT.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR, compressedData);
            gl.finish();
            currentChunk++;
        } else if (currentChunk === totalChunks) {
            console.log("transferring data from intermediate texture to layer texture");
            gl.bindTexture(gl.TEXTURE_2D, intermediateTexture);

            // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            // Step 3: Bind the tempTexture to the glayer
            let glayer = glBinding.getSubImage(layer.layer, frame);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

            let framebuffer = gl.createFramebuffer();
            gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, intermediateTexture, 0);
    // Ensure all previous GL commands are complete
    gl.finish();
            // if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
            //     console.error("Framebuffer is not complete");
            // }

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
                gl.bindTexture(gl.TEXTURE_2D, glayer.colorTexture);
                gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 0, 0, width, height);

                // Clean up
                gl.bindTexture(gl.TEXTURE_2D, null);
                gl.bindFramebuffer(gl.FRAMEBUFFER, null);
                gl.deleteFramebuffer(framebuffer);
                gl.deleteTexture(intermediateTexture);
            }

            currentChunk++;


        } else {
            console.log("Texture upload complete");
            // Mark the texture as fully loaded
        }
        // working sub compressed image
        // let width = layer.Equirectangular_Texture.mipmaps[0].width;
        // let height = layer.Equirectangular_Texture.mipmaps[0].height;
        // let format = eval(layer.format);

        // const textureData = layer.Equirectangular_Texture.mipmaps[0].data; // Your ASTC 4x4 compressed texture data array

        // // Define the portion of the texture you want to copy
        // let portionX = 0; // Starting x position, must be multiple of 4
        // let portionY = 0;//Math.floor(height / 2); // Starting y position (halfway down), must be multiple of 4
        // portionY = portionY - (portionY % 4); // Adjust to be multiple of 4
        // let portionWidth = width; // Width of the portion
        // let portionHeight = Math.floor(height / 2); // Height of the portion (half the texture height)
        // portionHeight = portionHeight - (portionHeight % 4); // Adjust to be multiple of 4

        // // Get the block size for the format
        // const blockSize = 16;

        // if (blockSize === 0) {
        //     console.error('Unsupported texture format:', format);
        //     return;
        // }

        // // Calculate the number of blocks in the portion
        // let numBlocksX = Math.ceil(portionWidth / 4);
        // let numBlocksY = Math.ceil(portionHeight / 4);

        // // Calculate the byte offset for the starting position
        // let startBlockX = Math.floor(portionX / 4);
        // let startBlockY = Math.floor(portionY / 4);
        // let byteOffset = (startBlockY * Math.ceil(width / 4) + startBlockX) * blockSize;

        // // Calculate the size of the portion in bytes
        // let portionSize = numBlocksX * numBlocksY * blockSize;

        // // Extract the portion of the texture data
        // let portionData = textureData.subarray(byteOffset, byteOffset + portionSize);


        // let glayer = glBinding.getSubImage(layer.layer, frame);
        // gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        // gl.bindTexture(gl.TEXTURE_2D, glayer.colorTexture);

        // // Upload the portion of the texture data
        // gl.compressedTexSubImage2D(gl.TEXTURE_2D, 0, portionX, portionY, portionWidth, portionHeight, ASTC_EXT.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR, portionData);

        // gl.bindTexture(gl.TEXTURE_2D, null);





    }

    function copyDataToLayer(gl, layer, frame, width, height, intermediateTexture) {
        let glayer = glBinding.getSubImage(layer, frame);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

        let framebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, intermediateTexture, 0);

        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
            console.error("Framebuffer is not complete");
        }

        gl.bindTexture(gl.TEXTURE_2D, glayer.colorTexture);
        gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 0, 0, width, height);

        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.deleteFramebuffer(framebuffer);

        checkGLError(gl);
    }


    function getMipSize(width, height) {
        let blockSize = 16;
        let blockWidth = Math.ceil(width / 4);
        let blockHeight = Math.ceil(height / 4);
        return blockWidth * blockHeight * blockSize;
    }

    function checkGLError(gl) {
        let error = gl.getError();
        if (error !== gl.NO_ERROR) {
            console.error("WebGL Error: ", error);
        }
    }



    function transferTextureToLayer(texture, width, height, format) {
        // Bind the layer's texture
        gl.bindTexture(gl.TEXTURE_2D, layer.Equirectangular_Texture);

        // Transfer the data from the intermediate texture to the layer texture
        gl.compressedTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, format, layer.Equirectangular_Texture.mipmaps[0].data);

        // Clean up
        gl.bindTexture(gl.TEXTURE_2D, null);
    }


    function drawStereoCube(layer) {
        console.log("redrawing stereo cube layer")
        let format = eval(layer.format);
        let width = layer.Cube_Texture.source.data[0].width;


        let glayer = glBinding.getSubImage(layer.layer, frame, "left");
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, glayer.colorTexture);


        gl.compressedTexSubImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X, 0, 0, 0, width, width, format, layer.Cube_Texture.source.data[0].mipmaps[0].data); //es
        gl.compressedTexSubImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_X, 0, 0, 0, width, width, format, layer.Cube_Texture.source.data[1].mipmaps[0].data); //es
        gl.compressedTexSubImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Y, 0, 0, 0, width, width, format, layer.Cube_Texture.source.data[2].mipmaps[0].data); //es
        gl.compressedTexSubImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, 0, 0, 0, width, width, format, layer.Cube_Texture.source.data[3].mipmaps[0].data); //es
        gl.compressedTexSubImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Z, 0, 0, 0, width, width, format, layer.Cube_Texture.source.data[4].mipmaps[0].data); //es
        gl.compressedTexSubImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, 0, 0, 0, width, width, format, layer.Cube_Texture.source.data[5].mipmaps[0].data); //es

        gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);

        glayer = glBinding.getSubImage(layer.layer, frame, "right");
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, glayer.colorTexture);


        gl.compressedTexSubImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X, 0, 0, 0, width, width, format, layer.Cube_Texture_Right.source.data[0].mipmaps[0].data); //es
        gl.compressedTexSubImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_X, 0, 0, 0, width, width, format, layer.Cube_Texture_Right.source.data[1].mipmaps[0].data); //es
        gl.compressedTexSubImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Y, 0, 0, 0, width, width, format, layer.Cube_Texture_Right.source.data[2].mipmaps[0].data); //es
        gl.compressedTexSubImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, 0, 0, 0, width, width, format, layer.Cube_Texture_Right.source.data[3].mipmaps[0].data); //es
        gl.compressedTexSubImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Z, 0, 0, 0, width, width, format, layer.Cube_Texture_Right.source.data[4].mipmaps[0].data); //es
        gl.compressedTexSubImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, 0, 0, 0, width, width, format, layer.Cube_Texture_Right.source.data[5].mipmaps[0].data); //es


        gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
    }

    function drawStereoEquirectangular(layer) {
        console.log("redrawing stereo equirectangular cube layer")
        let format = eval(layer.format);
        let width = layer.Equirectangular_Texture.mipmaps[0].width;
        let height = layer.Equirectangular_Texture.mipmaps[0].height;

        let glayer = glBinding.getSubImage(layer.layer, frame);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.bindTexture(gl.TEXTURE_2D, glayer.colorTexture);
        gl.compressedTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, format, layer.Equirectangular_Texture.mipmaps[0].data);
        gl.bindTexture(gl.TEXTURE_2D, null);

    }

    function renderByIndex(index) {
        xrSession.updateRenderState({
            layers: [
                layers[index].layer,
                xrSession.renderState.layers[xrSession.renderState.layers.length - 1]
            ]
        });
    }

    window.renderByIndex = renderByIndex


    renderer.render(scene, camera);
    controls.update();

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

function createStereoEquirectangularLayer(imagename = 'textures/compressedCubeMaps/cubemapRight.ktx2', imagetype = cubeLayers) {
    let layer = imagetype[imagename]
    layer.createLayer()
    layersToDraw.push(layer)
    layers.push(layer)
    layersOBJ[imagename] = layer
    offset -= 0.1;


    createButton(`show ${imagename}`, () => { selectActiveLayerByName(imagename) }, 0.2, offset)

}

function createStereoCubeLayer(imagename = 'textures/compressedCubeMaps/cubemapRight.ktx2', imagetype = cubeLayers) {
    let layer = imagetype[imagename]
    layer.createLayer()
    layersToDraw.push(layer)
    layers.push(layer)
    layersOBJ[imagename] = layer

    offset -= 0.1;

    createButton(`show ${imagename}`, () => { selectActiveLayerByName(imagename) }, 0.2, offset)


}

function createCubeLayer(imagename = 'textures/compressedCubeMaps/cubemapRight.ktx2', imagetype = cubeLayers) {

    let cubeLayer = imagetype[imagename]
    console.log("SETTING CUBELAYER" + cubeLayer)
    cubeLayer.createLayer()
    layersToDraw.push(cubeLayer)
    layers.push(cubeLayer)
    layersOBJ[imagename] = cubeLayer

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


// Helper function to extract the sub-image data with block-aligned dimensions
function extractSubImageData(data, alignedWidth, alignedHeight, textureWidth) {
    let subImageData = new Uint8Array(alignedWidth * alignedHeight * 4); // Assuming 4 bytes per pixel (RGBA)
    for (let row = 0; row < alignedHeight; row++) {
        let srcStart = row * textureWidth * 4;
        let srcEnd = srcStart + alignedWidth * 4;
        let destStart = row * alignedWidth * 4;
        subImageData.set(data.subarray(srcStart, srcEnd), destStart);
    }
    return subImageData;
}

function extractBottomHalfTexture(textureData, width, height, blockSize) {
    // Determine the number of 4x4 blocks in width and height
    const blocksPerRow = width / 4;
    const blocksPerColumn = height / 4;

    // Calculate the start row index for the bottom half
    const startBlockRow = blocksPerColumn / 2;
    const endBlockRow = blocksPerColumn;

    // Calculate the starting and ending indices in the textureData array
    const startIndex = startBlockRow * blocksPerRow * blockSize;
    const endIndex = endBlockRow * blocksPerRow * blockSize;

    // Extract the bottom half texture data
    const bottomHalfTextureData = textureData.slice(startIndex, endIndex);

    return bottomHalfTextureData;
}

// Example usage



// window.selectActiveLayer = selectActiveLayer
window.equirectangularLayers = equirectangularLayers
window.cubeLayers = cubeLayers
