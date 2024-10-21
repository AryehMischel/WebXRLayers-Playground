import * as THREE from 'three';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import { XRHandModelFactory } from 'three/addons/webxr/XRHandModelFactory.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { getGLBinding, getXRSpace, getASTC, getETC } from './index.js';

let sceneInstance = null;
let glBinding = null;
let xrSpace = null;
let ASTC_EXT = null
let ETC_EXT = null

export function getScene() {
    if (!sceneInstance) {
        sceneInstance = new THREE.Scene();
        // Add any initial objects or settings to the scene
    }
    return sceneInstance;
}



export function nullifyWebglBinding() {
    if(glBinding) {
        glBinding = null;
    }
    if(xrSpace) {
        xrSpace = null;
    }
   
}



export function customSkyCamera(){
    let camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, -3, 0);

    return camera;
}

export function customControls(camera, renderer){
    let controls = new OrbitControls(camera, renderer.domElement);
    controls.listenToKeyEvents(window); // optional
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    controls.enableZoom = true;
    controls.screenSpacePanning = false;
    controls.minDistance = 0.01;
    controls.maxDistance = 100;
    controls.maxPolarAngle = Math.PI / 2;

    controls.keys = {
        LEFT: 'KeyA',  // Use 'A' key to rotate left
        UP: 'KeyW',    // Use 'W' key to rotate up
        RIGHT: 'KeyD', // Use 'D' key to rotate right
        BOTTOM: 'KeyS' // Use 'S' key to rotate down
    };
    return controls;
}




export function setupScene(scene) {
    const hemLight = new THREE.HemisphereLight(0x808080, 0x606060, 3);
    const light = new THREE.DirectionalLight(0xffffff, 3);
    scene.add(hemLight, light);
}


export function customRenderer(){
    console.log("creating renderer from function ")
    let renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.precision = "lowp";
    renderer.setClearAlpha(1);
    renderer.setClearColor(new THREE.Color(0), 0);
    renderer.xr.enabled = true;
    return renderer;
}


export function customControllers(scene, renderer){
    const controllerModelFactory = new XRControllerModelFactory();
    const handModelFactory = new XRHandModelFactory().setPath('./models/fbx/');

    const lineGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, - 10)
    ]);


    const line = new THREE.Line(lineGeometry, new THREE.LineBasicMaterial({ color: 0x5555ff }));
    line.renderOrder = 1;


    let controllers = [
        renderer.xr.getController(0),
        renderer.xr.getController(1)
    ];

    controllers.forEach((controller, i) => {

        const controllerGrip = renderer.xr.getControllerGrip(i);
        controllerGrip.add(controllerModelFactory.createControllerModel(controllerGrip));
        scene.add(controllerGrip);

        const hand = renderer.xr.getHand(i);
        hand.add(handModelFactory.createHandModel(hand));

        controller.add(line.clone());
        //update raycast line visual when intersecting with objects
        controller.addEventListener('intersection', (e) => {
            controller.children[0].geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, e.data)]);

        })
        scene.add(controller, controllerGrip, hand);

    });

    return controllers;
}


//for testing, combine with WebXRCubeLayer and abstract the layer creation variables
export class WebXRCubeLayerASTC {


    constructor(faces, width, height, stereo) {
        this.layer = null;
        this.faces = faces;
        console.log("faces lenght", faces.length);
        this.stereo = stereo;
        this.format = 37808;
        this.width = width;
        this.height = height;
        this.type = "WebXRCubeLayerASTC";
       
    }

    
    // Method to create the WebXR layer
    createLayer(texture = this.Cube_Texture) {


        if (!glBinding) { glBinding = getGLBinding() }
        if (!xrSpace) { xrSpace = getXRSpace() }
        
        if(!ASTC_EXT) { ASTC_EXT = getASTC() }
        if(!ETC_EXT) { ETC_EXT = getETC()}




        this.layer = glBinding.createCubeLayer({
            space: xrSpace,
            viewPixelWidth: this.width,
            viewPixelHeight: this.height,
            layout: this.stereo ? "stereo" : "mono",
            colorFormat: 37808, 
            isStatic: false,

        });


    }

     // Method to check if the layer is stereo
     isStereo() {
        return this.stereo;
    }
}



export class WebXRCubeLayer {


    constructor(layer, Cube_Texture, Cube_Texture_Right, stereo, format) {
        this.layer = layer;
        this.Cube_Texture = Cube_Texture;
        this.Cube_Texture_Right = Cube_Texture_Right;
        this.stereo = stereo;
        this.format = format;
        this.type = "WebXRCubeLayer";
       
    }

    
    // Method to create the WebXR layer
    createLayer(texture = this.Cube_Texture) {


        if (!glBinding) { glBinding = getGLBinding() }
        if (!xrSpace) { xrSpace = getXRSpace() }
        
        if(!ASTC_EXT) { ASTC_EXT = getASTC() }
        if(!ETC_EXT) { ETC_EXT = getETC()}


        // Logic to create the WebXR layer using this.active_Cube_Texture
        console.log("Creating WebXR layer with texture:", eval(this.format));
        console.log("height, widht", texture.source.data[0].width, texture.source.data[0].height);


        this.layer = glBinding.createCubeLayer({
            space: xrSpace,
            viewPixelWidth: texture.source.data[0].width,
            viewPixelHeight: texture.source.data[0].height,
            layout: this.stereo ? "stereo" : "mono",
            colorFormat: 37808,//RGBA_ASTC_4x4_Format,//eval('ASTC_EXT.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR'),//eval(this.format), 
            isStatic: false,

        });


    }

    // Method to render the WebXR layer
    renderLayer() {
        // Logic to render the WebXR layer
        console.log("Rendering WebXR layer");
        // Example: someRenderFunction(this.cubeLayer);
    }

    // Method to check if the layer is stereo
    isStereo() {
        return this.stereo;
    }
}




export class WebXREquirectangularLayer {


    constructor(layer, Equirectangular_Texture, stereo, format, radius) {
        this.layer = layer;
        this.Equirectangular_Texture = Equirectangular_Texture;
        this.stereo = stereo;
        this.format = format;
        this.radius = radius;
        this.type = "WebXREquirectangularLayer";


    }

    // Method to create the WebXR layer
    createLayer(texture = this.Equirectangular_Texture) {
 
        if (!glBinding) { glBinding = getGLBinding() }
        if (!xrSpace) { xrSpace = getXRSpace() }

        this.layer = glBinding.createEquirectLayer({
            space: xrSpace,
            viewPixelWidth: texture.mipmaps[0].width,
            viewPixelHeight: texture.mipmaps[0].height / (this.stereo ? 2 : 1),
            layout: this.stereo ? "stereo-top-bottom" : "mono",
            colorFormat: eval(this.format), //,            // eval(),
            isStatic: "true",


        });

        this.layer.centralHorizontalAngle = Math.PI * 2;
        this.layer.upperVerticalAngle = -Math.PI / 2.0;
        this.layer.lowerVerticalAngle = Math.PI / 2.0;
        this.layer.radius = this.radius;


    }

    // Method to render the WebXR layer
    renderLayer() {
        // Logic to render the WebXR layer
        console.log("Rendering WebXR layer");
        // Example: someRenderFunction(this.cubeLayer);
    }

    // Method to check if the layer is stereo
    isStereo() {
        return this.stereo;
    }
}


export class WebXRQuadLayer {

    constructor(texture, format, stereo = false, ) {
         this.layer = null;
         this.texture = texture;
         this.format = format;
         this.type = "WebXRQuadLayer";
         this.stereo = stereo;
        //  console.log("viewPixelWidth, viewPixelHeight", texture.mipmaps[0].width, texture.mipmaps[0].height);
        //  console.log("Creating WebXR layer with texture:", texture.mipmaps[0].width, texture.mipmaps[0].height);
         console.log("format", this.format);

        // this.stereo = stereo;
        // this.radius = radius;
        // this.type = "WebXREquirectangularLayer";

    }

    // Method to create the WebXR layer
    createLayer(texture = this.texture) {
       
        if (!glBinding) { glBinding = getGLBinding() }
        if (!xrSpace) { xrSpace = getXRSpace() }
      
        //console.log("Creating quad with format:", this.format);


        this.layer = glBinding.createQuadLayer({
            space: xrSpace,
            viewPixelWidth: texture.mipmaps[0].width,
            viewPixelHeight: texture.mipmaps[0].height,
            layout: "mono",
            colorFormat: eval(this.format),


        });


        this.layer.width = 10;
        this.layer.height = 10;
        let pos = { x: 0, y: 0, z: -10 };
        let orient = { x: 0, y: 0, z: 0, w: 1 };
        this.layer.transform = new XRRigidTransform(pos, orient);


    }

    

    // Method to check if the layer is stereo
    isStereo() {
    }

} 

export class WebXRQuadUILayer {

    constructor(image, name, width, height, depth, positionX, positionY, stereo = false) {
        this.height = height;
        this.width = width;
        this.layer = null;
        this.depth = depth;
        this.stereo = stereo;
        this.positionX = positionX;
        console.log("positionX", positionX);
        this.positionY = positionY;

       // this.Equirectangular_Texture = Equirectangular_Texture;
       // this.stereo = stereo;
       // this.format = format;
       // this.radius = radius;
       this.image = image; 
       this.type = "WebXRQuadUILayer";
       // this.type = "WebXREquirectangularLayer";
       


   }

   // Method to create the WebXR layer
   createLayer(image = this.image) {

       if (!glBinding) { glBinding = getGLBinding() }
       if (!xrSpace) { xrSpace = getXRSpace() }

       this.layer = glBinding.createQuadLayer({
           space: xrSpace,
           viewPixelWidth: image.width,
           viewPixelHeight: image.height / (this.stereo? 2 : 1),
           layout: this.stereo ? "stereo-top-bottom" : "mono",


       });


       this.layer.width = this.width;
       this.layer.height = this.height;
       let pos = { x: this.positionX, y: this.positionY, z: this.depth };
       let orient = { x: 0, y: 0, z: 0, w: 1 };
       this.layer.transform = new XRRigidTransform(pos, orient);


   }

   

   // Method to check if the layer is stereo
   isStereo() {
       return this.stereo;
   }

} 


