import * as THREE from 'three';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { HTMLMesh } from 'three/addons/interactive/HTMLMesh.js';
import { InteractiveGroup } from 'three/addons/interactive/InteractiveGroup.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import { XRHandModelFactory } from 'three/addons/webxr/XRHandModelFactory.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
let sceneInstance = null;

export function getScene() {
    if (!sceneInstance) {
        sceneInstance = new THREE.Scene();
        // Add any initial objects or settings to the scene
    }
    return sceneInstance;
}

export class test {
    constructor(string) {
        this.string = string;
        console.log(string)
    }
}

export class customControls {
    constructor(camera, renderer) {
        this.controls = new OrbitControls(camera, renderer.domElement);
        this.controls.listenToKeyEvents(window); // optional
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.25;
        this.controls.enableZoom = true;
        this.controls.screenSpacePanning = false;
        this.controls.minDistance = 0;
        this.controls.maxDistance = 500;
        this.controls.maxPolarAngle = Math.PI / 2;

        this.controls.keys = {
            LEFT: 'KeyA',  // Use 'A' key to rotate left
            UP: 'KeyW',    // Use 'W' key to rotate up
            RIGHT: 'KeyD', // Use 'D' key to rotate right
            BOTTOM: 'KeyS' // Use 'S' key to rotate down
        };
    }
}

export class customSkyCamera {
    constructor() {
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 1000);
        this.camera.position.set(400, 200, 0);
    }

}

export function setupScene(scene) {
    const hemLight = new THREE.HemisphereLight(0x808080, 0x606060, 3);
    const light = new THREE.DirectionalLight(0xffffff, 3);
    scene.add(hemLight, light);

    let geometry = new THREE.ConeGeometry(10, 30, 4, 1);
    let material = new THREE.MeshPhongMaterial({ color: 0xffffff, flatShading: true });

    for (let i = 0; i < 500; i++) {

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.x = Math.random() * 1600 - 800;
        mesh.position.y = 0;
        mesh.position.z = Math.random() * 1600 - 800;
        mesh.updateMatrix();
        mesh.matrixAutoUpdate = false;
        scene.add(mesh);

    }
    const dirLight1 = new THREE.DirectionalLight(0xffffff, 3);
    dirLight1.position.set(1, 1, 1);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x002288, 3);
    dirLight2.position.set(- 1, - 1, - 1);
    scene.add(dirLight2);

    const ambientLight = new THREE.AmbientLight(0x555555);
    scene.add(ambientLight);

}


export class customRenderer {
    constructor() {
        console.log("creating")
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.precision = "highp";
        this.renderer.setClearAlpha(1);
        this.renderer.setClearColor(new THREE.Color(0), 0);
        this.renderer.xr.enabled = true;

    }
}

export class customControllers {

    constructor(scene, renderer) {
        const controllerModelFactory = new XRControllerModelFactory();
        const handModelFactory = new XRHandModelFactory().setPath('./models/fbx/');

        const lineGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 0, - 10)
        ]);


        const line = new THREE.Line(lineGeometry, new THREE.LineBasicMaterial({ color: 0x5555ff }));
        line.renderOrder = 1;


        this.controllers = [
            renderer.xr.getController(0),
            renderer.xr.getController(1)
        ];

        this.controllers.forEach((controller, i) => {

            const controllerGrip = renderer.xr.getControllerGrip(i);
            controllerGrip.add(controllerModelFactory.createControllerModel(controllerGrip));
            scene.add(controllerGrip);

            const hand = renderer.xr.getHand(i);
            hand.add(handModelFactory.createHandModel(hand));

            controller.add(line.clone());
            scene.add(controller, controllerGrip, hand);

        });
    }

}



export class WebXRCubeLayer {

    
    constructor(cubeLayer, Cube_Texture, Cube_Texture_Right, stereo, xrSpace, glBinding, format) {
        this.cubeLayer = cubeLayer;
        this.Cube_Texture = Cube_Texture;
        this.Cube_Texture_Right = Cube_Texture_Right;
        this.stereo = stereo;
        this.xrSpace = xrSpace;
        this.glBinding = glBinding;
        this.format = format;
        this.type = "WebXRCubeLayer";
    }

    // Method to create the WebXR layer
    createLayer(texture = this.Cube_Texture) {
        // Logic to create the WebXR layer using this.active_Cube_Texture
        console.log("Creating WebXR layer with texture:", texture);


        this.cubeLayer = this.glBinding.createCubeLayer({
            space: this.xrSpace,
            viewPixelWidth: texture.source.data[0].width,
            viewPixelHeight: texture.source.data[0].height,
            layout: this.stereo? "stereo" : "mono",
            colorFormat: this.format,
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

    
    constructor(equirectangularLayer, Equirectangular_Texture, Equirectangular_Texture_Right, stereo, xrSpace, glBinding, format, radius) {
        this.equirectangularLayer = equirectangularLayer;
        this.Equirectangular_Texture = Equirectangular_Texture;
        this.Equirectangular_Texture_Right = Equirectangular_Texture_Right;
        this.stereo = stereo;
        this.xrSpace = xrSpace;
        this.glBinding = glBinding;
        this.format = format;
        this.radius = radius;
        this.type = "WebXREquirectangularLayer";
        

    }

    // Method to create the WebXR layer
    createLayer(texture = this.Equirectangular_Texture) {
        // Logic to create the WebXR layer using this.active_Cube_Texture
        console.log("Creating WebXR layer with texture:", texture);


        this.equirectangularLayer = this.glBinding.createEquirectLayer({
            space: this.xrSpace,
            viewPixelWidth: texture.mipmaps[0].width,
            viewPixelHeight: texture.mipmaps[0].height / (this.stereo ? 2 : 1),
            layout: this.stereo ? "stereo-top-bottom" : "mono",
            colorFormat: this.format,
            isStatic: "true",
    
    
        });

        this.equirectangularLayer.centralHorizontalAngle = Math.PI * 2;
        this.equirectangularLayer.upperVerticalAngle = -Math.PI / 2.0;
        this.equirectangularLayer.lowerVerticalAngle = Math.PI / 2.0;
        this.equirectangularLayer.radius = this.radius;


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
