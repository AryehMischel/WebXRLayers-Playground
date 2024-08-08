import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { HTMLMesh } from 'three/addons/interactive/HTMLMesh.js';
import { InteractiveGroup } from 'three/addons/interactive/InteractiveGroup.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import { XRHandModelFactory } from 'three/addons/webxr/XRHandModelFactory.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { CustomControls, CustomSkyCamera, setupScene, CustomRenderer, CustomControllers, WebXRCubeLayer, WebXREquirectangularLayer} from './main.js';


let scene, camera, renderer, controls, controllers, group, ktx2Loader, gl, glBinding, xrSpace, xrSession;
let eqrtRadius = 40;



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
    { name: "bf4", url: 'textures/compressed360Stereo/bf4.ktx2', type: "stereoEquirectangular" },
    { name: "stereoCubeMap", url: 'textures/compressedStereoCubeMaps/cubemapLeft.ktx2', type: "stereoCubeMap", leftSide: true },
    { name: "stereoCubeMap", url: 'textures/compressedStereoCubeMaps/cubemapRight.ktx2', type: "stereoCubeMap", leftSide: false },
]


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
                if(image.name in cubeLayers){
                    if(image.leftSide){
                        cubeLayers[image.name].Cube_Texture = texture
                    }else{
                        cubeLayers[image.name].Cube_Texture_Right = texture
                    }
                }else{
                    console.log("created stereo cube texture, creating webxr layer")
                    if(image.leftSide){
                        let cubeLayer = new WebXRCubeLayer(null, texture, null, true, format);
                        cubeLayers[image.name] = cubeLayer
                    }else{
                        let cubeLayer = new WebXRCubeLayer(null, null, texture, true, format);
                        cubeLayers[image.name] = cubeLayer
                    }
 
                }
            }

            if (image.type === "cubemap") {
                console.log("created cube texture, creating webxr layer")

                let cubeLayer = new WebXRCubeLayer(null, texture, null, false, format);
                cubeLayers[image.name] = cubeLayer
                //compressedCubeTextures.push(texture)
            }
            if (image.type === "equirectangular") {
                console.log("created equirectangular texture, creating webxr layer")

                let equirectLayer = new WebXREquirectangularLayer(null, texture, false, format, eqrtRadius);
                equirectangularLayers[image.name] = equirectLayer
                //compressed360Textures.push(texture)
            }
            if (image.type === "stereoEquirectangular") {
                console.log("created stereo equirectangular texture, creating webxr layer")

                let stereoEquirectLayer = new WebXREquirectangularLayer(null, texture, true, format, eqrtRadius);
                equirectangularLayers[image.name] = stereoEquirectLayer
                //compressed360Textures.push(texture)
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




function createCubeLayer(texture, texture_right = null, stereo = false) {

    let format = eval(supportedCompressedFormats.get(texture.format))
    let cubeLayer

    if (!stereo) {
        cubeLayer = new WebXRCubeLayer(null, texture, null, false, format);
    } else {
        cubeLayer = new WebXRCubeLayer(null, texture, texture_right, true, format);
    }


    cubeLayer.createLayer()
    activeWebXRLayer = cubeLayer

    xrSession.updateRenderState({
        layers: [
            activeWebXRLayer.layer,
            xrSession.renderState.layers[xrSession.renderState.layers.length - 1]
        ]
    });
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

    if (session && activeWebXRLayer && activeWebXRLayer.type === "WebXREquirectangularLayer" && activeWebXRLayer.layer.needsRedraw) {

        let format = eval(activeWebXRLayer.format);
        let width = activeWebXRLayer.Equirectangular_Texture.mipmaps[0].width;
        let height = activeWebXRLayer.Equirectangular_Texture.mipmaps[0].height;

        let glayer = glBinding.getSubImage(activeWebXRLayer.layer, frame);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.bindTexture(gl.TEXTURE_2D, glayer.colorTexture);
        gl.compressedTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, format, activeWebXRLayer.Equirectangular_Texture.mipmaps[0].data);
        gl.bindTexture(gl.TEXTURE_2D, null);

        if (!activeWebXRLayer.stereo) {


        }




    } else if (session && activeWebXRLayer && activeWebXRLayer.type === "WebXRCubeLayer" && activeWebXRLayer.layer.needsRedraw) {

        let format = eval(activeWebXRLayer.format);
        let width = activeWebXRLayer.Cube_Texture.source.data[0].width;

        if (!activeWebXRLayer.stereo) {
            let glayer = glBinding.getSubImage(activeWebXRLayer.layer, frame);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
            gl.bindTexture(gl.TEXTURE_CUBE_MAP, glayer.colorTexture);


            gl.compressedTexSubImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X, 0, 0, 0, width, width, format, activeWebXRLayer.Cube_Texture.source.data[0].mipmaps[0].data); //es
            gl.compressedTexSubImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_X, 0, 0, 0, width, width, format, activeWebXRLayer.Cube_Texture.source.data[1].mipmaps[0].data); //es
            gl.compressedTexSubImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Y, 0, 0, 0, width, width, format, activeWebXRLayer.Cube_Texture.source.data[2].mipmaps[0].data); //es
            gl.compressedTexSubImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, 0, 0, 0, width, width, format, activeWebXRLayer.Cube_Texture.source.data[3].mipmaps[0].data); //es
            gl.compressedTexSubImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Z, 0, 0, 0, width, width, format, activeWebXRLayer.Cube_Texture.source.data[4].mipmaps[0].data); //es
            gl.compressedTexSubImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, 0, 0, 0, width, width, format, activeWebXRLayer.Cube_Texture.source.data[5].mipmaps[0].data); //es

            gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
        } else {

            let glayer = glBinding.getSubImage(activeWebXRLayer.layer, frame, "left");
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
            gl.bindTexture(gl.TEXTURE_CUBE_MAP, glayer.colorTexture);


            gl.compressedTexSubImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X, 0, 0, 0, width, width, format, activeWebXRLayer.Cube_Texture.source.data[0].mipmaps[0].data); //es
            gl.compressedTexSubImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_X, 0, 0, 0, width, width, format, activeWebXRLayer.Cube_Texture.source.data[1].mipmaps[0].data); //es
            gl.compressedTexSubImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Y, 0, 0, 0, width, width, format, activeWebXRLayer.Cube_Texture.source.data[2].mipmaps[0].data); //es
            gl.compressedTexSubImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, 0, 0, 0, width, width, format, activeWebXRLayer.Cube_Texture.source.data[3].mipmaps[0].data); //es
            gl.compressedTexSubImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Z, 0, 0, 0, width, width, format, activeWebXRLayer.Cube_Texture.source.data[4].mipmaps[0].data); //es
            gl.compressedTexSubImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, 0, 0, 0, width, width, format, activeWebXRLayer.Cube_Texture.source.data[5].mipmaps[0].data); //es

            gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);

            glayer = glBinding.getSubImage(activeWebXRLayer.layer, frame, "right");
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
            gl.bindTexture(gl.TEXTURE_CUBE_MAP, glayer.colorTexture);


            gl.compressedTexSubImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X, 0, 0, 0, width, width, format, activeWebXRLayer.Cube_Texture_Right.source.data[0].mipmaps[0].data); //es
            gl.compressedTexSubImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_X, 0, 0, 0, width, width, format, activeWebXRLayer.Cube_Texture_Right.source.data[1].mipmaps[0].data); //es
            gl.compressedTexSubImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Y, 0, 0, 0, width, width, format, activeWebXRLayer.Cube_Texture_Right.source.data[2].mipmaps[0].data); //es
            gl.compressedTexSubImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, 0, 0, 0, width, width, format, activeWebXRLayer.Cube_Texture_Right.source.data[3].mipmaps[0].data); //es
            gl.compressedTexSubImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Z, 0, 0, 0, width, width, format, activeWebXRLayer.Cube_Texture_Right.source.data[4].mipmaps[0].data); //es
            gl.compressedTexSubImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, 0, 0, 0, width, width, format, activeWebXRLayer.Cube_Texture_Right.source.data[5].mipmaps[0].data); //es


            gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);



        }

    }

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
    if(activeWebXRLayer){activeWebXRLayer.layer.destroy()}

    activeWebXRLayer = layer

    xrSession.updateRenderState({
        layers: [
            activeWebXRLayer.layer,
            xrSession.renderState.layers[xrSession.renderState.layers.length - 1]
        ]
    });

}

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


window.selectActiveLayer = selectActiveLayer
window.equirectangularLayers = equirectangularLayers
window.cubeLayers = cubeLayers
