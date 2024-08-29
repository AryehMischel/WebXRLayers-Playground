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

let pxLayer = null;
let nxLayer = null;
let pyLayer = null;
let nyLayer = null;
let pzLayer = null;
let nzLayer = null;

let pxLayerRight = null;
let nxLayerRight = null;
let pyLayerRight = null;
let nyLayerRight = null;
let pzLayerRight = null;
let nzLayerRight = null;
//mock data for gpu compressed textures
// './textures/compressed360/bf4.ktx2', './textures/compressed360/Italy_Mountains.ktx2', './textures/compressed360/SnowySnow360.ktx2', './textures/compressed360/Mountain.ktx2',
let sources = [

    { name: "cubemapRight", url: 'textures/compressedStereoCubeMaps/cubemap_uastc.ktx2', type: "cubemap" },
    { name: "Gemini", url: 'textures/compressed360/2022_03_30_Gemini_North_360_Outside_08-CC_uastc.ktx2', type: "equirectangular" },
    { name: "bf4", url: 'textures/compressed360Stereo/bf4.ktx2', type: "stereoEquirectangular" },


    { name: "stereoCubeMap", url: 'textures/compressedStereoCubeMaps/cubemapLeft.ktx2', type: "stereoCubeMap", leftSide: true },
    { name: "stereoCubeMap", url: 'textures/compressedStereoCubeMaps/cubemapRight.ktx2', type: "stereoCubeMap", leftSide: false },
    { name: "sources/Atlas1.ktx2", url: 'textures/compressed360Stereo/bf4.ktx2', type: "stereoEquirectangular" },


    { name: "cubemap_bf", url: 'textures/compressedStereoCubeMaps/cubemap_bf_left.ktx2', type: "stereoCubeMap", leftSide: true },
    // { name: "cubemap_bf", url: 'textures/compressedCubeMaps/cubemap_uastc.ktx2', type: "stereoCubeMap", leftSide: false },


]
let testCubeTexture = null;

function createQuad() {
    console.log(texture.source.data[0].mipmaps[0].data)
    pxLayer = new Object();
    pxLayer.data = texture.source.data[0].mipmaps[0].data;
    pxLayer.width = texture.source.data[0].width;
    pxLayer.height = texture.source.data[0].height;
    pxLayer.layer = glBinding.createQuadLayer({
        space: xrSpace,
        viewPixelWidth: pxLayer.width,
        viewPixelHeight: pxLayer.height,
        colorFormat: ETC_EXT.COMPRESSED_RGB8_ETC2, //ETC_EXT.COMPRESSED_RGB8_ETC2
        isStatic: true,
    });
    console.log(pxLayer.layer.antialias)

    pxLayer.layer.width = 2;
    pxLayer.layer.height = 2;
    let pos = { x: 0, y: 1, z: -2 };
    let orient = { x: 0, y: 0, z: 1, w: 0 };

    pxLayer.layer.transform = new XRRigidTransform(pos, orient);


    // console.log(pxLayer.layer)
    // console.log(pxLayer.data)
    // console.log(pxLayer.width)
    // console.log(pxLayer.height)

    xrSession.updateRenderState({
        layers: [
            pxLayer.layer,
            xrSession.renderState.layers[xrSession.renderState.layers.length - 1]
        ]
    });


}
function makeLayers() {
    createQuad();
    createQuad2();
    createQuad3();
    createQuad4();
    createQuad5();
    createQuad6();
}

window.makeLayers = makeLayers;

function createQuad2() {
    nxLayer = new Object();
    nxLayer.data = texture.source.data[1].mipmaps[0].data;
    nxLayer.width = texture.source.data[1].width;
    nxLayer.height = texture.source.data[1].height;
    nxLayer.layer = glBinding.createQuadLayer({
        space: xrSpace,
        viewPixelWidth: nxLayer.width,
        viewPixelHeight: nxLayer.height,
        colorFormat: ETC_EXT.COMPRESSED_RGB8_ETC2, //ASTC_EXT.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR
        isStatic: true,
    });

    nxLayer.layer.width = 2;
    nxLayer.layer.height = 2;
    let pos = { x: 0, y: 1, z: 2 };

    // Quaternion for 180-degree rotation around the Z-axis
    let q1 = { x: 0, y: 0, z: 1, w: 0 };

    // Quaternion for 180-degree rotation around the Y-axis
    let q2 = { x: 0, y: 1, z: 0, w: 0 };

    // Combine the quaternions
    let orient = {
        x: q1.w * q2.x + q1.x * q2.w + q1.y * q2.z - q1.z * q2.y,
        y: q1.w * q2.y - q1.x * q2.z + q1.y * q2.w + q1.z * q2.x,
        z: q1.w * q2.z + q1.x * q2.y - q1.y * q2.x + q1.z * q2.w,
        w: q1.w * q2.w - q1.x * q2.x - q1.y * q2.y - q1.z * q2.z
    };


    nxLayer.layer.transform = new XRRigidTransform(pos, orient);

    xrSession.updateRenderState({
        layers: [
            nxLayer.layer,
            pxLayer.layer,
            xrSession.renderState.layers[xrSession.renderState.layers.length - 1]
        ]
    });

}


function createQuad3() {
    pyLayer = new Object();
    pyLayer.data = texture.source.data[2].mipmaps[0].data;
    pyLayer.width = texture.source.data[2].width;
    pyLayer.height = texture.source.data[2].height;
    pyLayer.layer = glBinding.createQuadLayer({
        space: xrSpace,
        viewPixelWidth: pyLayer.width,
        viewPixelHeight: pyLayer.height,
        colorFormat: ETC_EXT.COMPRESSED_RGB8_ETC2, //ASTC_EXT.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR
        isStatic: true,
    });

    pyLayer.layer.width = 2;
    pyLayer.layer.height = 2;
    let pos = { x: 0, y: 3, z: 0 };

    // let orient = { x: 0, y: 0, z: 0, w: 1 };
    // let orient = { x: Math.sqrt(0.5), y: 0, z: 0, w: Math.sqrt(0.5) };
    // let orient = { x: 0.5, y: -0.5, z: 0.5, w: 0.5 };
    let orient = { x: 0, y: -Math.sqrt(0.5), z: Math.sqrt(0.5), w: 0 };
    // let orient = { x: 0, y: -Math.sqrt(0.5), z: Math.sqrt(0.5), w: 0 };

    // Quaternion for 90-degree rotation around the Z-axis
    let q90Z = { x: 0, y: 0, z: Math.sqrt(0.5), w: Math.sqrt(0.5) };
    
    // Combine the quaternions
    let combinedOrient = {
        x: orient.w * q90Z.x + orient.x * q90Z.w + orient.y * q90Z.z - orient.z * q90Z.y,
        y: orient.w * q90Z.y - orient.x * q90Z.z + orient.y * q90Z.w + orient.z * q90Z.x,
        z: orient.w * q90Z.z + orient.x * q90Z.y - orient.y * q90Z.x + orient.z * q90Z.w,
        w: orient.w * q90Z.w - orient.x * q90Z.x - orient.y * q90Z.y - orient.z * q90Z.z
    };
    


    pyLayer.layer.transform = new XRRigidTransform(pos,combinedOrient);

    xrSession.updateRenderState({
        layers: [
            pyLayer.layer,
            pxLayer.layer,
            nxLayer.layer,
            xrSession.renderState.layers[xrSession.renderState.layers.length - 1]
        ]
    });

}

function createQuad4() {
    nyLayer = new Object();
    nyLayer.data = texture.source.data[3].mipmaps[0].data;
    nyLayer.width = texture.source.data[3].width;
    nyLayer.height = texture.source.data[3].height;
    nyLayer.layer = glBinding.createQuadLayer({
        space: xrSpace,
        viewPixelWidth: nyLayer.width,
        viewPixelHeight: nyLayer.height,
        colorFormat: ETC_EXT.COMPRESSED_RGB8_ETC2, //ASTC_EXT.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR
        isStatic: true,
    });

    nyLayer.layer.width = 2;
    nyLayer.layer.height = 2;
    let pos = { x: 0, y: -1, z: 0 };

    // let orient = { x: -Math.sqrt(0.5), y: 0, z: 0, w: Math.sqrt(0.5) };
    // let orient = { x:  -0.8509035, y: 0, z: 0, w: 0.525322 };
    // let orient = { x:  -0.707, y: 0, z: 0, w: 0.707 };

    let orient = { x: -0.5, y: 0.5, z: 0.5, w: 0.5 };
    //-0.4469983, 0.7240368, 0.4469983, 0.2759632

    // let orient = { x: 0, y: 0, z: 0, w: 1 };
    // let orient = { x: 2.3, y: 0, z: 0, w: 2.3 };
    // let orient = { x: 0.5, y: -0.5, z: 0.5, w: 0.5 };
    // let orient = { x: 0, y: -Math.sqrt(0.5), z: Math.sqrt(0.5), w: 0 };


    nyLayer.layer.transform = new XRRigidTransform(pos, orient);

    xrSession.updateRenderState({
        layers: [
            nyLayer.layer,
            pxLayer.layer,
            nxLayer.layer,
            pyLayer.layer,
            xrSession.renderState.layers[xrSession.renderState.layers.length - 1]
        ]
    });

}

function createQuad5() {
    pzLayer = new Object();
    pzLayer.data = texture.source.data[4].mipmaps[0].data;
    pzLayer.width = texture.source.data[4].width;
    pzLayer.height = texture.source.data[4].height;
    pzLayer.layer = glBinding.createQuadLayer({
        space: xrSpace,
        viewPixelWidth: pzLayer.width,
        viewPixelHeight: pzLayer.height,
        colorFormat: ETC_EXT.COMPRESSED_RGB8_ETC2, //ASTC_EXT.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR
        isStatic: true,
    });

    pzLayer.layer.width = 2;
    pzLayer.layer.height = 2;
    let pos = { x: 2, y: 1, z: 0 };
    // let orient = { x: Math.sqrt(0.5), y: 0, z: 0, w: Math.sqrt(0.5) };
    // let orient = { x: 0, y: 0, z: 0, w: 1 };
    // Quaternion for 90-degree rotation around the Y-axis

    // Quaternion for 90-degree rotation around the X-axis

    // Combine the quaternions
    // let orient = { x: 0, y: 0.707, z: 0, w:  0.707};
    // let orient = { x: 0.707, y: 0, z: 0.707, w: -0.707 };

    // Quaternion for 90-degree rotation around the Y-axis
    let orient = { x: 0, y: 0.707, z: 0, w: 0.707 };

    // Quaternion for 180-degree rotation around the Z-axis
    let q180Z = { x: 0, y: 0, z: 1, w: 0 };

    // Combine the quaternions for Z-axis rotation
    let combinedOrientZ = {
        x: orient.w * q180Z.x + orient.x * q180Z.w + orient.y * q180Z.z - orient.z * q180Z.y,
        y: orient.w * q180Z.y - orient.x * q180Z.z + orient.y * q180Z.w + orient.z * q180Z.x,
        z: orient.w * q180Z.z + orient.x * q180Z.y - orient.y * q180Z.x + orient.z * q180Z.w,
        w: orient.w * q180Z.w - orient.x * q180Z.x - orient.y * q180Z.y - orient.z * q180Z.z
    };

    // Quaternion for 180-degree rotation around the Y-axis
    let q180Y = { x: 0, y: 1, z: 0, w: 0 };

    // Combine the quaternions for Y-axis rotation
    let combinedOrient = {
        x: combinedOrientZ.w * q180Y.x + combinedOrientZ.x * q180Y.w + combinedOrientZ.y * q180Y.z - combinedOrientZ.z * q180Y.y,
        y: combinedOrientZ.w * q180Y.y - combinedOrientZ.x * q180Y.z + combinedOrientZ.y * q180Y.w + combinedOrientZ.z * q180Y.x,
        z: combinedOrientZ.w * q180Y.z + combinedOrientZ.x * q180Y.y - combinedOrientZ.y * q180Y.x + combinedOrientZ.z * q180Y.w,
        w: combinedOrientZ.w * q180Y.w - combinedOrientZ.x * q180Y.x - combinedOrientZ.y * q180Y.y - combinedOrientZ.z * q180Y.z
    };


    // let orient = { x: - 0.707, y: 0, z: 0, w:  0.707};

    // let orient = { x: Math.sqrt(0.5), y: 0, z: 0, w: Math.sqrt(0.5) };
    //let orient = { x: 0, y: Math.sqrt(0.5), z: Math.sqrt(0.5), w: 0 };

    pzLayer.layer.transform = new XRRigidTransform(pos, combinedOrient);

    xrSession.updateRenderState({
        layers: [
            pzLayer.layer,
            pxLayer.layer,
            nxLayer.layer,
            pyLayer.layer,
            nyLayer.layer,
            xrSession.renderState.layers[xrSession.renderState.layers.length - 1]
        ]
    });
}

function createQuad6() {
    nzLayer = new Object();
    nzLayer.data = texture.source.data[5].mipmaps[0].data;
    nzLayer.width = texture.source.data[5].width;
    nzLayer.height = texture.source.data[5].height;
    nzLayer.layer = glBinding.createQuadLayer({
        space: xrSpace,
        viewPixelWidth: nzLayer.width,
        viewPixelHeight: nzLayer.height,
        colorFormat: ETC_EXT.COMPRESSED_RGB8_ETC2, //ASTC_EXT.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR
        isStatic: true,
    });

    nzLayer.layer.width = 2;
    nzLayer.layer.height = 2;
    let pos = { x: -2, y: 1, z: 0 };
    // Quaternion for 90-degree rotation around the Y-axis
    let orient = { x: 0, y: 0.707, z: 0, w: 0.707 };

    // Quaternion for 180-degree rotation around the Z-axis
    let q180 = { x: 0, y: 0, z: 1, w: 0 };

    // Combine the quaternions
    let combinedOrient = {
        x: orient.w * q180.x + orient.x * q180.w + orient.y * q180.z - orient.z * q180.y,
        y: orient.w * q180.y - orient.x * q180.z + orient.y * q180.w + orient.z * q180.x,
        z: orient.w * q180.z + orient.x * q180.y - orient.y * q180.x + orient.z * q180.w,
        w: orient.w * q180.w - orient.x * q180.x - orient.y * q180.y - orient.z * q180.z
    };

    // let orient = { x: 0.707, y: 0, z: 0.707, w: -0.707 };
    // let orient = { x: -0.5, y: 0.5, z: 0.5, w: 0.5 };
    // let orient = { x: 0, y: 0, z: 0, w: 1 };
    // let orient = { x: Math.sqrt(0.5), y: 0, z: 0, w: Math.sqrt(0.5) };

    // let orient = { x: Math.sqrt(0.5), y: 0, z: 0, w: Math.sqrt(0.5) };
    // let orient = { x: 0, y: Math.sqrt(0.5), z: Math.sqrt(0.5), w: 0 };

    nzLayer.layer.transform = new XRRigidTransform(pos, combinedOrient);

    xrSession.updateRenderState({
        layers: [
            nzLayer.layer,
            pxLayer.layer,
            nxLayer.layer,
            pyLayer.layer,
            nyLayer.layer,
            pzLayer.layer,
            xrSession.renderState.layers[xrSession.renderState.layers.length - 1]
        ]
    });
}




window.createQuad = createQuad
window.createQuad2 = createQuad2
window.createQuad3 = createQuad3
window.createQuad4 = createQuad4

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

function loadimages(){
    for (let i = 0; i < sources.length; i++) {
        createCompressedTextureLayer(sources[i]) //,is createLayerFromCompressedTexture a better name?
    }

}
window.loadimages = loadimages;


let offset = 0;
//create a compressed texture and then create a webxr layer from that texture. 
function createCompressedTextureLayer(image) {

    ktx2Loader.load(image.url,
        (texture) => {
            console.log("texture", texture)
            if (!ASTC_EXT && !ETC_EXT) {
                //in the future we should have seperate handling for pc and vr devices. this is just a little hack for now
                console.log("no compressed texture extensions available")

                return
            }

            testCubeTexture = texture;
            window.texture = texture;

            let format = eval(supportedCompressedFormats.get(texture.format))
            console.log("format", format)


            if (image.type === "stereoCubeMap") {

                if (image.name in cubeLayers) {
                    console.log(`adding other side to stereocube texture ${image.url}`)

                    // testCubeTexture = texture;
                    // window.texture = texture;
                    if (image.leftSide) {
                        cubeLayers[image.name].Cube_Texture = texture
                    } else {
                        cubeLayers[image.name].Cube_Texture_Right = texture
                    }
                } else {
                    console.log("created stereo cube texture, creating webxr layer")
                    if (image.leftSide) {
                        console.log("left side")

                        let cubeLayer = new WebXRCubeLayer(null, texture, null, true, format);
                        cubeLayers[image.name] = cubeLayer
                        offset += 0.1;
                        createButton(image.name + " create layer", () => { makeLayers() }, 0, offset)  //createStereoCubeLayer(image.name, cubeLayers)
                    } else {
                        console.log("right side")

                        let cubeLayer = new WebXRCubeLayer(null, null, texture, true, format);
                        cubeLayers[image.name] = cubeLayer
                        offset += 0.1;
                        createButton(image.name + " create layer", () => { makeLayers() }, 0, offset)


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
            console.log("binding", glBinding)
            console.log(glBinding.antialias)
            xrSpace = refSpace;
            // createEquireLayer(compressed360Textures[0], null, false)    


        });

    }


    if (session && pxLayer && pxLayer.layer.needsRedraw) {

        let glayer = glBinding.getSubImage(pxLayer.layer, frame);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.bindTexture(gl.TEXTURE_2D, glayer.colorTexture);
        gl.compressedTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, pxLayer.width, pxLayer.height, ETC_EXT.COMPRESSED_RGB8_ETC2, texture.source.data[0].mipmaps[0].data);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }

    if (session && nxLayer && nxLayer.layer.needsRedraw) {

        let glayer = glBinding.getSubImage(nxLayer.layer, frame);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.bindTexture(gl.TEXTURE_2D, glayer.colorTexture);
        gl.compressedTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, nxLayer.width, nxLayer.height, ETC_EXT.COMPRESSED_RGB8_ETC2, texture.source.data[1].mipmaps[0].data);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }

    if (session && pyLayer && pyLayer.layer.needsRedraw) {

        let glayer = glBinding.getSubImage(pyLayer.layer, frame);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.bindTexture(gl.TEXTURE_2D, glayer.colorTexture);
        gl.compressedTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, pyLayer.width, pyLayer.height, ETC_EXT.COMPRESSED_RGB8_ETC2, texture.source.data[2].mipmaps[0].data);
        gl.bindTexture(gl.TEXTURE_2D, null);

    }

    if (session && nyLayer && nyLayer.layer.needsRedraw) {

        let glayer = glBinding.getSubImage(nyLayer.layer, frame);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.bindTexture(gl.TEXTURE_2D, glayer.colorTexture);
        gl.compressedTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, nyLayer.width, nyLayer.height, ETC_EXT.COMPRESSED_RGB8_ETC2, texture.source.data[3].mipmaps[0].data);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }

    if (session && pzLayer && pzLayer.layer.needsRedraw) {

        let glayer = glBinding.getSubImage(pzLayer.layer, frame);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.bindTexture(gl.TEXTURE_2D, glayer.colorTexture);
        gl.compressedTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, pzLayer.width, pzLayer.height, ETC_EXT.COMPRESSED_RGB8_ETC2, texture.source.data[4].mipmaps[0].data);
        gl.bindTexture(gl.TEXTURE_2D, null);


    }

    if (session && nzLayer && nzLayer.layer.needsRedraw) {

        let glayer = glBinding.getSubImage(nzLayer.layer, frame);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.bindTexture(gl.TEXTURE_2D, glayer.colorTexture);
        gl.compressedTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, nzLayer.width, nzLayer.height, ETC_EXT.COMPRESSED_RGB8_ETC2, texture.source.data[5].mipmaps[0].data);
        gl.bindTexture(gl.TEXTURE_2D, null);

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
