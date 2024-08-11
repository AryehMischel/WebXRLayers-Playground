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
let redraw = false;

//prebuilt layers

let bf4Layer = null;
let stereoCubeLayer = null;
let rightCubeLayer = null;
let nasaLayer = null;


let layers = []
let layersToDraw = []


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

// // Create the HTML button
// const button = document.createElement('button');
// button.innerText = 'Click Me';
// button.style.position = 'absolute';
// button.style.left = '50%';
// button.style.top = '50%';
// button.style.transform = 'translate(-50%, -50%)';
// button.style.zIndex = 1;
// button.className = "button";
// htmlContent.appendChild(button);

// // Create an HTMLMesh to attach the button to the plane
// const mesh = new HTMLMesh(button);
// mesh.position.x = - 0.75;
// mesh.position.y = 1.5;
// mesh.position.z = - 0.5;
// mesh.rotation.y = Math.PI / 4;
// mesh.scale.setScalar(2);

// group.add(mesh);


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

{ name: "cubemapRight", url: 'textures/compressedStereoCubeMaps/cubemap_uastc.ktx2', type: "cubemap" },
{ name: "Gemini", url: 'textures/compressed360/2022_03_30_Gemini_North_360_Outside_08-CC_uastc.ktx2', type: "equirectangular" },
// { name: "bf4", url: 'textures/compressed360Stereo/bf4.ktx2', type: "stereoEquirectangular" },


    { name: "stereoCubeMap", url: 'textures/compressedStereoCubeMaps/cubemapLeft.ktx2', type: "stereoCubeMap", leftSide: true },
    { name: "stereoCubeMap", url: 'textures/compressedStereoCubeMaps/cubemapRight.ktx2', type: "stereoCubeMap", leftSide: false },
{ name: "bf4", url: 'textures/compressed360Stereo/bf4.ktx2', type: "stereoEquirectangular" },

]




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

//Our three js compressed textures
let compressed360Textures = []
let compressedCubeTextures = []
let activeWebXRLayer = null;


//supported compressed formats
const supportedCompressedFormats = new Map([
    [37496, "ETC_EXT.COMPRESSED_RGBA8_ETC2_EAC"],
    [37492, "ETC_EXT.COMPRESSED_RGB8_ETC2"],
    [37808, "ASTC_EXT.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR"],
    [1023, "srgb"]

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
            if (!ASTC_EXT && !ETC_EXT) {
                //in the future we should have seperate handling for pc and vr devices. this is just a little hack for now
                console.log("no compressed texture extensions available")
                return
            }

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
                        createButton(image.name + " set layer", () => { setStereoCubeLayer() }, 0.2, offset)
                    } else {
                        let cubeLayer = new WebXRCubeLayer(null, null, texture, true, format);
                        cubeLayers[image.name] = cubeLayer
                        offset += 0.1;
                        createButton(image.name + " create layer", () => { createStereoCubeLayer(image.name, cubeLayers) }, 0, offset)
                        createButton(image.name + " set layer", () => { setStereoCubeLayer() }, 0.2, offset)


                    }

                }
            }

            if (image.type === "cubemap") {
                console.log("created cube texture, creating webxr layer")

                let cubeLayer = new WebXRCubeLayer(null, texture, null, false, format);
                cubeLayers[image.name] = cubeLayer
                offset += 0.1;
                createButton(image.name + " create layer", () => { createCubeLayer(image.name, cubeLayers) }, 0, offset)
                createButton(image.name + " set layer", () => { setLayer(image.name, cubeLayers) }, 0.2, offset)


            }
            if (image.type === "equirectangular") {
                console.log("created equirectangular texture, creating webxr layer")

                let equirectLayer = new WebXREquirectangularLayer(null, texture, false, format, eqrtRadius);
                equirectangularLayers[image.name] = equirectLayer
                offset += 0.1;
                createButton(image.name + " create layer", () => { createEquirectangularLayer(image.name, equirectangularLayers) }, 0, offset)
                createButton(image.name + " set layer", () => { setbf4Layer() }, 0.2, offset)

            }
            if (image.type === "stereoEquirectangular") {
                console.log("created stereo equirectangular texture, creating webxr layer")

                let stereoEquirectLayer = new WebXREquirectangularLayer(null, texture, true, format, eqrtRadius);
                equirectangularLayers[image.name] = stereoEquirectLayer

                offset += 0.1;
                createButton(image.name + " create layer", () => { createStereoEquirectangularLayer(image.name, equirectangularLayers) }, 0, offset)
                createButton(image.name + " set layer", () => { setbf4Layer() }, 0.2, offset)



          
            }

            // IMAGE FORMAT VALIDATION. 
            // if (texture.isCompressedCubeTexture) {
            //     VALIDATE CUBE TEXTURE
            // } else if (texture.isCompressedTexture) {
            //     VALIDATE EQUIRECTANGULAR TEXTURE
            // }

        }, null, null);
}

function createEquireLayer(texture, stereo = false) {


    let format = eval(supportedCompressedFormats.get(texture.format))
    let sphereLayer = new WebXREquirectangularLayer(null, texture, stereo, format, eqrtRadius);
    sphereLayer.createLayer()
    activeWebXRLayer = sphereLayer

    xrSession.updateRenderState({
        layers: [
            activeWebXRLayer.layer,
            xrSession.renderState.layers[xrSession.renderState.layers.length - 1]
        ]
    });


}

function createEqrtLayerByIndex(index, stereo = false) {

    if (index >= compressed360Textures.length) {
        console.log("index out of range");
        return null;
    }
    console.log("creating equirectangular layer stereo = ", stereo)

    createEquireLayer(compressed360Textures[index], stereo)

}









function createCubeLayerByIndex(index) {

    if (index >= compressedCubeTextures.length) {
        console.log("index out of range");
        return null;
    }

    createCubeLayer(compressedCubeTextures[index], null, false)

}


function createCubeLayerByIndexStereo(index_left, index_right) {
    if (index_left >= compressedCubeTextures.length || index_right >= compressedCubeTextures.length) {
        console.log("index out of range");
        console.log(compressedCubeTextures.length)
        return null;
    }

    if (compressedCubeTextures[index_left].format !== compressedCubeTextures[index_right].format) {
        console.log("formats do not match")
        return null;
    }


    createCubeLayer(compressedCubeTextures[index_left], compressedCubeTextures[index_right], true)

}

window.createCubeLayerByIndex = createCubeLayerByIndex
window.createCubeLayerByIndexStereo = createCubeLayerByIndexStereo
window.createEqrtLayerByIndex = createEqrtLayerByIndex

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


    if (session && layersToDraw.length > 0) {
        console.log("googd")
        for (let layer in layersToDraw) {
            if (layersToDraw[layer].layer.needsRedraw) {
                console.log(layersToDraw[layer].type)
                if (layersToDraw[layer].type === "WebXRCubeLayer") {
                    if (layersToDraw[layer].stereo) {
                        redrawStereoCube(layersToDraw[layer])
                        layersToDraw.splice(layer, 1);
                    } else {
                        redrawCube(layersToDraw[layer])
                        layersToDraw.splice(layer, 1);

                    }

                } else if (layersToDraw[layer].type === "WebXREquirectangularLayer") {

                    if (layersToDraw[layer].stereo) {
                        redrawStereoEquirectangular(layersToDraw[layer])
                        layersToDraw.splice(layer, 1);
                    } else {
                        redrawEquirectangular(layersToDraw[layer])
                        layersToDraw.splice(layer, 1);   
                    }
                }
            }


        }
    }


function redrawCube(layer) {
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

function redrawEquirectangular(layer) {
    console.log("redrawing equirectangular layer")
    let format = eval(layer.format);
    let width = layer.Equirectangular_Texture.mipmaps[0].width;
    let height = layer.Equirectangular_Texture.mipmaps[0].height;

    let glayer = glBinding.getSubImage(layer.layer, frame);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.bindTexture(gl.TEXTURE_2D, glayer.colorTexture);
    gl.compressedTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, format, layer.Equirectangular_Texture.mipmaps[0].data);
    gl.bindTexture(gl.TEXTURE_2D, null);
}


function redrawStereoCube(layer) {
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

function redrawStereoEquirectangular(layer) {
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

function renderByIndex(index){
    xrSession.updateRenderState({
        layers: [
            layers[index].layer,
            xrSession.renderState.layers[xrSession.renderState.layers.length - 1]
        ]
    });
}

window.renderByIndex = renderByIndex



// function redrawStereoEquirectangularCube(layer) {
//     console.log("redrawing stereo equirectangular cube layer")
//     let format = eval(layer.format);
//     let width = layer.Equirectangular_Texture.mipmaps[0].width;
//     let height = layer.Equirectangular_Texture.mipmaps[0].height;

//     let glayer = glBinding.getSubImage(layer.layer, frame);
//     gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
//     gl.bindTexture(gl.TEXTURE_2D, glayer.colorTexture);
//     gl.compressedTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, format, layer.Equirectangular_Texture.mipmaps[0].data);
//     gl.bindTexture(gl.TEXTURE_2D, null);

// }



// //stereoEquirectangularLayer
// if (session && layer && layer.layer.needsRedraw) {
//     console.log("redrawing bf4 layer")
//     let format = eval(layer.format);
//     let width = layer.Equirectangular_Texture.mipmaps[0].width;
//     let height = layer.Equirectangular_Texture.mipmaps[0].height;

//     let glayer = glBinding.getSubImage(layer.layer, frame);
//     gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
//     gl.bindTexture(gl.TEXTURE_2D, glayer.colorTexture);
//     gl.compressedTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, format, layer.Equirectangular_Texture.mipmaps[0].data);
//     gl.bindTexture(gl.TEXTURE_2D, null);
// }

// //stereoCubeLayer
// if (session && stereoCubeLayer && stereoCubeLayer.layer.needsRedraw) {

//     console.log("redrawing stereo cube layer")
//     let format = eval(stereoCubeLayer.format);
//     let width = stereoCubeLayer.Cube_Texture.source.data[0].width;


//     let glayer = glBinding.getSubImage(stereoCubeLayer.layer, frame, "left");
//     gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
//     gl.bindTexture(gl.TEXTURE_CUBE_MAP, glayer.colorTexture);


//     gl.compressedTexSubImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X, 0, 0, 0, width, width, format, stereoCubeLayer.Cube_Texture.source.data[0].mipmaps[0].data); //es
//     gl.compressedTexSubImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_X, 0, 0, 0, width, width, format, stereoCubeLayer.Cube_Texture.source.data[1].mipmaps[0].data); //es
//     gl.compressedTexSubImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Y, 0, 0, 0, width, width, format, stereoCubeLayer.Cube_Texture.source.data[2].mipmaps[0].data); //es
//     gl.compressedTexSubImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, 0, 0, 0, width, width, format, stereoCubeLayer.Cube_Texture.source.data[3].mipmaps[0].data); //es
//     gl.compressedTexSubImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Z, 0, 0, 0, width, width, format, stereoCubeLayer.Cube_Texture.source.data[4].mipmaps[0].data); //es
//     gl.compressedTexSubImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, 0, 0, 0, width, width, format, stereoCubeLayer.Cube_Texture.source.data[5].mipmaps[0].data); //es

//     gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);

//     glayer = glBinding.getSubImage(stereoCubeLayer.layer, frame, "right");
//     gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
//     gl.bindTexture(gl.TEXTURE_CUBE_MAP, glayer.colorTexture);


//     gl.compressedTexSubImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X, 0, 0, 0, width, width, format, stereoCubeLayer.Cube_Texture_Right.source.data[0].mipmaps[0].data); //es
//     gl.compressedTexSubImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_X, 0, 0, 0, width, width, format, stereoCubeLayer.Cube_Texture_Right.source.data[1].mipmaps[0].data); //es
//     gl.compressedTexSubImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Y, 0, 0, 0, width, width, format, stereoCubeLayer.Cube_Texture_Right.source.data[2].mipmaps[0].data); //es
//     gl.compressedTexSubImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, 0, 0, 0, width, width, format, stereoCubeLayer.Cube_Texture_Right.source.data[3].mipmaps[0].data); //es
//     gl.compressedTexSubImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Z, 0, 0, 0, width, width, format, stereoCubeLayer.Cube_Texture_Right.source.data[4].mipmaps[0].data); //es
//     gl.compressedTexSubImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, 0, 0, 0, width, width, format, stereoCubeLayer.Cube_Texture_Right.source.data[5].mipmaps[0].data); //es


//     gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);



// }

// if (session && rightCubeLayer && rightCubeLayer.needsRedraw) {

//     let format = eval(rightCubeLayer.format);
//     let width = rightCubeLayer.Cube_Texture.source.data[0].width;


//     let glayer = glBinding.getSubImage(rightCubeLayer.layer, frame);
//     gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
//     gl.bindTexture(gl.TEXTURE_CUBE_MAP, glayer.colorTexture);


//     gl.compressedTexSubImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X, 0, 0, 0, width, width, format, rightCubeLayer.Cube_Texture.source.data[0].mipmaps[0].data); //es
//     gl.compressedTexSubImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_X, 0, 0, 0, width, width, format, rightCubeLayer.Cube_Texture.source.data[1].mipmaps[0].data); //es
//     gl.compressedTexSubImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Y, 0, 0, 0, width, width, format, rightCubeLayer.Cube_Texture.source.data[2].mipmaps[0].data); //es
//     gl.compressedTexSubImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, 0, 0, 0, width, width, format, rightCubeLayer.Cube_Texture.source.data[3].mipmaps[0].data); //es
//     gl.compressedTexSubImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Z, 0, 0, 0, width, width, format, rightCubeLayer.Cube_Texture.source.data[4].mipmaps[0].data); //es
//     gl.compressedTexSubImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, 0, 0, 0, width, width, format, rightCubeLayer.Cube_Texture.source.data[5].mipmaps[0].data); //es

//     gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);

// }

// //equirectangular 
// if (session && nasaLayer && nasaLayer.needsRedraw) {
//     let format = eval(nasaLayer.format);
//     let width = nasaLayer.Equirectangular_Texture.mipmaps[0].width;
//     let height = nasaLayer.Equirectangular_Texture.mipmaps[0].height;

//     let glayer = glBinding.getSubImage(nasaLayer.layer, frame);
//     gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
//     gl.bindTexture(gl.TEXTURE_2D, glayer.colorTexture);
//     gl.compressedTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, format, nasaLayer.Equirectangular_Texture.mipmaps[0].data);
//     gl.bindTexture(gl.TEXTURE_2D, null);

// }



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



function selectActiveLayer(imagename = 'textures/compressedCubeMaps/cubemapRight.ktx2', imagetype = cubeLayers) {  //cubeLayers, equirectangularLayers

    let layer = imagetype[imagename]
    layer.createLayer()
    // if (activeWebXRLayer) { activeWebXRLayer.layer.destroy() }

    activeWebXRLayer = layer

    xrSession.updateRenderState({
        layers: [
            activeWebXRLayer.layer,
            xrSession.renderState.layers[xrSession.renderState.layers.length - 1]
        ]
    });
}


function createEquirectangularLayer(imagename = 'textures/compressedCubeMaps/cubemapRight.ktx2', imagetype = cubeLayers) {
    let layer = imagetype[imagename]
    layer.createLayer()
    layersToDraw.push(layer)
    layers.push(layer)
}

function createStereoEquirectangularLayer(imagename = 'textures/compressedCubeMaps/cubemapRight.ktx2', imagetype = cubeLayers){
    let layer = imagetype[imagename]
    layer.createLayer()
    layersToDraw.push(layer)
    layers.push(layer)  
}

function createStereoCubeLayer(imagename = 'textures/compressedCubeMaps/cubemapRight.ktx2', imagetype = cubeLayers) {
    stereoCubeLayer = imagetype[imagename]
    stereoCubeLayer.createLayer()
    layersToDraw.push(stereoCubeLayer)
    layers.push(stereoCubeLayer)
}

function createCubeLayer(imagename = 'textures/compressedCubeMaps/cubemapRight.ktx2', imagetype = cubeLayers){

    let cubeLayer = imagetype[imagename]
    console.log("SETTING CUBELAYER" + cubeLayer)
    cubeLayer.createLayer()
    layersToDraw.push(cubeLayer)
    layers.push(cubeLayer)
    
}



// function createCubeLayer(texture, texture_right = null, stereo = false) {
    
//     let format = eval(supportedCompressedFormats.get(texture.format))
//     let cubeLayer

//     if (!stereo) {
//         cubeLayer = new WebXRCubeLayer(null, texture, null, false, format);
//     } else {
//         cubeLayer = new WebXRCubeLayer(null, texture, texture_right, true, format);
//     }


//     cubeLayer.createLayer()
//     activeWebXRLayer = cubeLayer

//     xrSession.updateRenderState({
//         layers: [
//             activeWebXRLayer.layer,
//             xrSession.renderState.layers[xrSession.renderState.layers.length - 1]
//         ]
//     });
// }



function setStereoCubeLayer() {
    console.log("is there a " + stereoCubeLayer)
    layersToDraw.push(stereoCubeLayer)
    layers.push(stereoCubeLayer)

}



function createbf4Layer(imagename = 'textures/compressedCubeMaps/cubemapRight.ktx2', imagetype = cubeLayers) {
    bf4Layer = imagetype[imagename]
    bf4Layer.createLayer()
    layersToDraw.push(bf4Layer)

}

function setbf4Layer() {
    console.log("hmm")
    console.log(bf4Layer)
}





function renderBf4() {

    xrSession.updateRenderState({
        layers: [
            bf4Layer.layer,
            xrSession.renderState.layers[xrSession.renderState.layers.length - 1]
        ]
    });


}

function renderStereoCube() {
    xrSession.updateRenderState({
        layers: [
            stereoCubeLayer.layer,
            xrSession.renderState.layers[xrSession.renderState.layers.length - 1]
        ]
    });

}

window.Bf = renderBf4
window.Stereo = renderStereoCube

function onSessionEnd() {
    console.log("session ended")
    meshParent.visible = true;
    // if (activeWebXRLayer) {
    //     activeWebXRLayer.layer.destroy();
    // }
    // activeWebXRLayer = null;
    // xrSession = null;
}

function onSessionStart() {
    console.log("session started")
    meshParent.visible = false;
}



// function createButton(name, callbackFunction, _offset){
//     console.log(_offset)
//     let button = document.createElement('button');
//     button.onclick = () => { callbackFunction()}; //{}
//     button.innerText = `Click Me ${name}`;
//     button.style.zIndex = 1;
//     button.className = "button";
//     htmlContent.appendChild(button);

//     // Create an HTMLMesh to attach the button to the plane
//     let mesh = new HTMLMesh(button);
//     mesh.position.x = - 0.75 ;
//     mesh.position.y = 1.5 + _offset;
//     mesh.position.z = - 0.5 ;
//     mesh.rotation.y = Math.PI / 4;
//     mesh.scale.setScalar(2);

//     group.add(mesh);


// }


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


window.selectActiveLayer = selectActiveLayer
window.equirectangularLayers = equirectangularLayers
window.cubeLayers = cubeLayers
