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

    { name: "cubemapRight", url: 'textures/compressedStereoCubeMaps/cubemap_uastc.ktx2', type: "cubemap" },
    { name: "Gemini", url: 'textures/compressed360/2022_03_30_Gemini_North_360_Outside_08-CC_uastc.ktx2', type: "equirectangular" },
    // { name: "bf4", url: 'textures/compressed360Stereo/bf4.ktx2', type: "stereoEquirectangular" },


    { name: "stereoCubeMap", url: 'textures/compressedStereoCubeMaps/cubemapLeft.ktx2', type: "stereoCubeMap", leftSide: true },
    { name: "stereoCubeMap", url: 'textures/compressedStereoCubeMaps/cubemapRight.ktx2', type: "stereoCubeMap", leftSide: false },
    { name: "sources/Atlas1.ktx2", url: 'textures/compressed360Stereo/bf4.ktx2', type: "stereoEquirectangular" },


    { name: "cubemap_bf", url: 'textures/compressedStereoCubeMaps/cubemap_bf_left.ktx2', type: "stereoCubeMap", leftSide: true },
    { name: "cubemap_bf", url: 'textures/compressedStereoCubeMaps/cubemap_bf_right.ktx2', type: "stereoCubeMap", leftSide: false },

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
                        layersToDraw.splice(layer, 1);
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

    function drawEquirectangular(layer) {
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

function selectActiveLayerByName(name){
    
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


window.selectActiveLayer = selectActiveLayer
window.equirectangularLayers = equirectangularLayers
window.cubeLayers = cubeLayers
