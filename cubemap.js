/* global AFRAME, THREE */
if (typeof AFRAME === "undefined") {
    throw new Error(
      "Component attempted to register before AFRAME was available."
    );
  }
  
  /**
  * Cubemap component for A-Frame.
  *
  * Adapted from "Skybox and environment map in Three.js" by Roman Liutikov
  * https://web.archive.org/web/20160206163422/https://blog.romanliutikov.com/post/58705840698/skybox-and-environment-map-in-threejs
  *
  */
  AFRAME.registerComponent("cubemap", {
    schema: {
      edgeLength: {
        type: 'int',
        default: 5000,
      },
      material: {
        type: 'selector',
      },
    },
  
    /**
    * Called once when the component is initialized.
    * Used to set up initial state and instantiate variables.
    */
    init: function () {
      // console.log(this.data.material)
      this.cubeTexture = window.cubeTexture;
      // Check if the texture is loaded correctly
      if (!this.cubeTexture) {
        console.error("Cube texture is undefined.");
        return;
      }
  
      // Check the type of the texture
      console.log("Texture type:", this.cubeTexture.constructor.name);
  
      // Ensure the texture is a CubeTexture
      if (!(this.cubeTexture instanceof THREE.CubeTexture)) {
        console.error("The provided texture is not a CubeTexture.");
        // return;
      }
      console.log(this.cubeTexture);
  
      // entity data
      const el = this.el;
      const data = this.data;
  
      // A Cubemap can be rendered as a mesh composed of a BoxBufferGeometry and
      // ShaderMaterial. EdgeLength will scale the mesh
      this.geometry = new THREE.BoxGeometry(1, 1, 1);
  
      // Now for the ShaderMaterial.
      const shader = THREE.ShaderLib["cube"];
  
      // Check if shader.uniforms is defined
      if (!shader.uniforms) {
        console.error("Shader uniforms are undefined. Check if the shader is properly loaded.");
        return;
      }
  
      // Log the shader uniforms to see what properties are available
      console.log("Shader uniforms:", shader.uniforms);
  
      // Note: cloning the material is necessary to prevent the cube shader's
      // uniforms from being mutated. If the material was not cloned, all cubemaps
      // in the scene would share the same uniforms (and look identical).
      this.material = new THREE.ShaderMaterial({
        fragmentShader: shader.fragmentShader,
        vertexShader: shader.vertexShader,
        uniforms: shader.uniforms,
        depthWrite: false,
        side: THREE.BackSide,
        transparent: true
      }).clone();
  
      // Additional check to ensure uniforms are properly cloned
      if (!this.material.uniforms) {
        console.error("Material uniforms are undefined after cloning. Check the ShaderMaterial initialization.");
        return;
      }
  
      // Log the uniforms to see what properties are available
      console.log("Uniforms after cloning:", this.material.uniforms);
      // Directly set the envMap uniform if it exists
      if (this.material.uniforms.envMap) {
        this.material.uniforms.envMap.value = this.cubeTexture;
      } else if (this.material.uniforms.tCube) {
        this.material.uniforms.tCube.value = this.cubeTexture;
      } else {
        console.error("envMap or tCube uniform is undefined.");
        return;
      }
      // Threejs seems to have removed the 'tCube' uniform.
      // Workaround from: https://stackoverflow.com/a/59454999/6591491
      Object.defineProperty(this.material, "envMap", {
        get: function () {
          return this.uniforms.envMap ? this.uniforms.envMap.value : this.uniforms.tCube.value;
        },
      });
  
      // Log the material to check if envMap is defined
      console.log("Material after defining envMap:", this.material);
  
      // Assume a valid cube texture is provided as `cubeTexture`
  
      console.log(this.material.uniforms["tCube"]); // This should not be undefined
  
      if (this.material.uniforms["envMap"]) {
        this.material.uniforms["envMap"].value = this.cubeTexture;
      } else {
        console.error("envMap uniform is undefined.");
        // return;
      }
  
      // We can create the mesh now
      this.mesh = new THREE.Mesh(this.geometry, this.material);
      this.mesh.scale.set(data.edgeLength, data.edgeLength, data.edgeLength);
      el.setObject3D("cubemap", this.mesh);
    },
  
    /**
    * Called when component is attached and when component data changes.
    * Generally modifies the entity based on the data.
    */
    update: function (oldData) {
      // entity data
      const data = this.data;
  
      if (data.edgeLength !== oldData.edgeLength) {
        // Update the size of the skybox.
        this.mesh.scale.set(data.edgeLength, data.edgeLength, data.edgeLength);
      }
    },
  
    /**
    * Called when a component is removed (e.g., via removeAttribute).
    * Generally undoes all modifications to the entity.
    */
    remove: function () {
      this.geometry.dispose();
      this.material.uniforms["envMap"].value.dispose();
      this.material.dispose();
      this.el.removeObject3D("cubemap");
    },
  });