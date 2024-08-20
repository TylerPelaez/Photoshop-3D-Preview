import { Mesh, MeshBasicMaterial, MeshStandardMaterial, MeshLambertMaterial, MeshPhongMaterial, BufferGeometry, Scene, Object3D, Texture, Material } from "three";

let useLit = true;

interface TexturedMaterial extends Material {
  // Basic Material
  map?: Texture | null;
  alphaMap?: Texture | null;
  aoMap?: Texture | null;
  envMap?: Texture | null;
  lightMap?: Texture | null;
  specularMap?: Texture | null;

  // Lambert + Phong
  displacementMap?: Texture | null;
  emissiveMap?: Texture | null;
  bumpMap?: Texture | null;
  normalMap?: Texture | null;

  // Standard
  metalnessMap?: Texture | null;

  // PBR
  anisotropyMap?: Texture | null;
  clearcoatMap?: Texture | null;
  clearcoatNormalMap?: Texture | null;
  clearcoatRoughnessMap?: Texture | null;
  iridescenceMap?: Texture | null;
  iridescenceThicknessMap?: Texture | null;
  sheenRoughnessMap?: Texture | null;
  sheenColorMap?: Texture | null;

  specularIntensityMap?: Texture | null;
  specularColorMap?: Texture | null;
  thicknessMap?: Texture | null;
  transmissionMap?: Texture | null;
}

interface MaterialProxy {
  uuid: string,
  litMaterial: TexturedMaterial,
  unlitMaterial: MeshBasicMaterial,
  dispose(): void,
  m(): TexturedMaterial,
}

// For tracking objects, primarily to facilitate disposing of them once they are no longer used.
export default class ResourceManager{
  scene: Scene;
  objects = new Map<string, Object3D>();
  textures = new Map<string, Texture>();
  materials = new Map<string, MaterialProxy>();
  geometries = new Map<string, BufferGeometry>();

  documentIdsToTextureUUID = new Map<number, string>();
  textureUUIDsToMaterialUUIDs = new Map<string, Set<string>>();

  geometryUUIDsToMeshUUIDs = new Map<string, Set<string>>();
  materialUUIDsToMeshUUIDs = new Map<string, Set<string>> ();

  unlitToLitUUIDs = new Map<string, string>();

  defaultMaterial: MaterialProxy;

  constructor(scene: Scene) {
    this.scene = scene;
    this.defaultMaterial = this.createMaterialProxy(new MeshStandardMaterial({color: 0xFFFFFF}));

    this.materials.set(this.defaultMaterial.uuid, this.defaultMaterial);
    this.materialUUIDsToMeshUUIDs.set(this.defaultMaterial.uuid, new Set());
  }


//#region  Getters 
  getMaterialsUsingTexture(uuid: string): MaterialProxy[] {
    let materialUUIDS = this.textureUUIDsToMaterialUUIDs.get(uuid);
    if (!materialUUIDS) return [];
    
    let result = [];
    for (let uuid of materialUUIDS) {
      result.push(this.materials.get(uuid)!);
    }
    return result;
  }

  
  getTextureForDocumentId(documentID: number): Texture | null {
    const textureUUID = this.documentIdsToTextureUUID.get(documentID);
    if (!textureUUID) return null;

    return this.textures.get(textureUUID) ?? null;
  }

  getTexturesUsedByMaterial(uuid: string): Texture[] {
    const material = this.materials.get(uuid);
    if (!material) return [];

    const textures: Texture[] = [];

    // To ensure we don't miss textures, return the base, lit material.
    const texturedMaterial = material.litMaterial as TexturedMaterial;

    if (texturedMaterial.map) textures.push(texturedMaterial.map);
    if (texturedMaterial.alphaMap) textures.push(texturedMaterial.alphaMap);
    if (texturedMaterial.aoMap) textures.push(texturedMaterial.aoMap);
    if (texturedMaterial.envMap) textures.push(texturedMaterial.envMap);
    if (texturedMaterial.lightMap) textures.push(texturedMaterial.lightMap);
    if (texturedMaterial.specularMap) textures.push(texturedMaterial.specularMap);
    if (texturedMaterial.displacementMap) textures.push(texturedMaterial.displacementMap);
    if (texturedMaterial.emissiveMap) textures.push(texturedMaterial.emissiveMap);
    if (texturedMaterial.bumpMap) textures.push(texturedMaterial.bumpMap);
    if (texturedMaterial.normalMap) textures.push(texturedMaterial.normalMap);
    if (texturedMaterial.metalnessMap) textures.push(texturedMaterial.metalnessMap);
    if (texturedMaterial.anisotropyMap) textures.push(texturedMaterial.anisotropyMap);
    if (texturedMaterial.clearcoatMap) textures.push(texturedMaterial.clearcoatMap);
    if (texturedMaterial.clearcoatNormalMap) textures.push(texturedMaterial.clearcoatNormalMap);
    if (texturedMaterial.clearcoatRoughnessMap) textures.push(texturedMaterial.clearcoatRoughnessMap);
    if (texturedMaterial.iridescenceMap) textures.push(texturedMaterial.iridescenceMap);
    if (texturedMaterial.iridescenceThicknessMap) textures.push(texturedMaterial.iridescenceThicknessMap);
    if (texturedMaterial.sheenRoughnessMap) textures.push(texturedMaterial.sheenRoughnessMap);
    if (texturedMaterial.sheenColorMap) textures.push(texturedMaterial.sheenColorMap);
    if (texturedMaterial.specularIntensityMap) textures.push(texturedMaterial.specularIntensityMap);
    if (texturedMaterial.specularColorMap) textures.push(texturedMaterial.specularColorMap);
    if (texturedMaterial.thicknessMap) textures.push(texturedMaterial.thicknessMap);
    if (texturedMaterial.transmissionMap) textures.push(texturedMaterial.transmissionMap);

    return textures;
  }

  getMaterialsUsedByMesh(uuid: string): MaterialProxy[] {
    const materialUUIDs = this.materialUUIDsToMeshUUIDs.get(uuid);
    if (!materialUUIDs) return [];

    return Array.from(materialUUIDs).map(materialUUID => this.materials.get(materialUUID)).filter(val => val != undefined);
  }

  getMaterialByUUID(uuid: string): MaterialProxy | null {
    let proxyUUID = this.unlitToLitUUIDs.get(uuid);
    if (proxyUUID) {
      return this.materials.get(proxyUUID) ?? null;
    }

    return this.materials.get(uuid) ?? null;
  }

//#endregion


//#region Adding To Scene
  toggleLightingMode() {
    useLit = !useLit;

    this.materialUUIDsToMeshUUIDs.forEach((meshes, materialUUID) => {
      let materialProxy = this.materials.get(materialUUID);
      if (!materialProxy) {
        return;
      }

      meshes.forEach(meshUUID => {
        let mesh = this.objects.get(meshUUID);
        if (mesh instanceof Mesh) {
          let currentMaterial = mesh.material as Material | Material[];
          if (currentMaterial instanceof Material) {
            mesh.material = materialProxy.m();
          } else {
            let oldUUID = useLit ? materialProxy.unlitMaterial.uuid : materialProxy.litMaterial.uuid;
            for (let i = 0; i < currentMaterial.length; i++) {
              if (currentMaterial[i].uuid == oldUUID) {
                mesh.material[i] = materialProxy.m();
              }
            }
          }
        }
      })
    });

  }

  createMaterialProxy(material: Material): MaterialProxy {
    const unlitMaterial = new MeshBasicMaterial();
    if (material instanceof MeshBasicMaterial || material instanceof MeshStandardMaterial || material instanceof MeshPhongMaterial || material instanceof MeshLambertMaterial) {
      unlitMaterial.color = material.color;
      unlitMaterial.fog = material.fog;
      unlitMaterial.envMapRotation = material.envMapRotation;


      unlitMaterial.map = material?.map ?? null;
      unlitMaterial.alphaMap = material?.alphaMap ?? null
      unlitMaterial.aoMap = material?.aoMap ?? null;
      unlitMaterial.envMap = material?.envMap ?? null;
      unlitMaterial.lightMap = material?.lightMap ?? null;

      if (!(material instanceof MeshStandardMaterial)) {
        unlitMaterial.specularMap = material?.specularMap ?? null;
      }
    }

    const materialProxy: MaterialProxy = {
      uuid: material.uuid,
      unlitMaterial: unlitMaterial,
      litMaterial: material,
      m() {
        if (useLit) return this.litMaterial;
        return this.unlitMaterial; 
      },
      dispose() {
        this.litMaterial.dispose();
        this.unlitMaterial.dispose();
      }
    }

    this.unlitToLitUUIDs.set(unlitMaterial.uuid, materialProxy.uuid);

    return materialProxy;
  }

  addMaterialTexture(texture: Texture, materialUUID: string) {
    this.textures.set(texture.uuid, texture);

    if (!this.textureUUIDsToMaterialUUIDs.has(texture.uuid)) 
      this.textureUUIDsToMaterialUUIDs.set(texture.uuid, new Set());

    this.textureUUIDsToMaterialUUIDs.get(texture.uuid)!.add(materialUUID);
  }


  addObjectToScene(obj: Object3D): void {
    if (this.objects.has(obj.uuid)) {
      console.error("Duplicate object: " + obj);
      return;
    }

    this.scene.add(obj);

    obj.traverse((instance) => {
      this.objects.set(instance.uuid, instance);
      if (instance instanceof Mesh) {

        // Add Geometry
        this.geometries.set(instance.geometry.uuid, instance.geometry);

        if (!this.geometryUUIDsToMeshUUIDs.has(instance.geometry.uuid))
          this.geometryUUIDsToMeshUUIDs.set(instance.geometry.uuid, new Set());

        this.geometryUUIDsToMeshUUIDs.get(instance.geometry.uuid)!.add(instance.uuid);


        let instanceMaterials: Material | Material[] = instance.material;
        let hasMultipleMaterials = true;

        if (instanceMaterials instanceof Material) {
          hasMultipleMaterials = false;
          instanceMaterials = [instanceMaterials];
        } 

        for (let i = 0; i < instanceMaterials.length; i++) {
          let material = instanceMaterials[i];
          if (!(material instanceof MeshBasicMaterial || material instanceof MeshLambertMaterial || 
            material instanceof MeshPhongMaterial || material instanceof MeshStandardMaterial)) {
              console.error("Unsupported Material Type -- will be replaced with DEFAULT Material");
              if (hasMultipleMaterials) {
                instance.material[i] = this.defaultMaterial.m();
              } else {
                instance.material = this.defaultMaterial.m();
              }

              this.materialUUIDsToMeshUUIDs.get(this.defaultMaterial.uuid)!.add(instance.uuid);
              continue;
          }


          let proxy = this.createMaterialProxy(material);

          // Apply lighting mode
          if (hasMultipleMaterials) {
            instance.material[i] = proxy.m();
          } else {
            instance.material = proxy.m();
          }

          // Add material
          this.materials.set(proxy.uuid, proxy);

          if (!this.materialUUIDsToMeshUUIDs.has(proxy.uuid))
            this.materialUUIDsToMeshUUIDs.set(proxy.uuid, new Set());

          this.materialUUIDsToMeshUUIDs.get(proxy.uuid)!.add(instance.uuid);

          // Add all supported textures

          let texturedMaterial = material as TexturedMaterial;

      
          if (texturedMaterial.map) this.addMaterialTexture(texturedMaterial.map, proxy.uuid);
          if (texturedMaterial.alphaMap) this.addMaterialTexture(texturedMaterial.alphaMap, proxy.uuid);
          if (texturedMaterial.aoMap) this.addMaterialTexture(texturedMaterial.aoMap, proxy.uuid);
          if (texturedMaterial.envMap) this.addMaterialTexture(texturedMaterial.envMap, proxy.uuid);
          if (texturedMaterial.lightMap) this.addMaterialTexture(texturedMaterial.lightMap, proxy.uuid);
          if (texturedMaterial.specularMap) this.addMaterialTexture(texturedMaterial.specularMap, proxy.uuid);
          if (texturedMaterial.displacementMap) this.addMaterialTexture(texturedMaterial.displacementMap, proxy.uuid);
          if (texturedMaterial.emissiveMap) this.addMaterialTexture(texturedMaterial.emissiveMap, proxy.uuid);
          if (texturedMaterial.bumpMap) this.addMaterialTexture(texturedMaterial.bumpMap, proxy.uuid);
          if (texturedMaterial.normalMap) this.addMaterialTexture(texturedMaterial.normalMap, proxy.uuid);
          if (texturedMaterial.metalnessMap) this.addMaterialTexture(texturedMaterial.metalnessMap, proxy.uuid);
          if (texturedMaterial.anisotropyMap) this.addMaterialTexture(texturedMaterial.anisotropyMap, proxy.uuid);
          if (texturedMaterial.clearcoatMap) this.addMaterialTexture(texturedMaterial.clearcoatMap, proxy.uuid);
          if (texturedMaterial.clearcoatNormalMap) this.addMaterialTexture(texturedMaterial.clearcoatNormalMap, proxy.uuid);
          if (texturedMaterial.clearcoatRoughnessMap) this.addMaterialTexture(texturedMaterial.clearcoatRoughnessMap, proxy.uuid);
          if (texturedMaterial.iridescenceMap) this.addMaterialTexture(texturedMaterial.iridescenceMap, proxy.uuid);
          if (texturedMaterial.iridescenceThicknessMap) this.addMaterialTexture(texturedMaterial.iridescenceThicknessMap, proxy.uuid);
          if (texturedMaterial.sheenRoughnessMap) this.addMaterialTexture(texturedMaterial.sheenRoughnessMap, proxy.uuid);
          if (texturedMaterial.sheenColorMap) this.addMaterialTexture(texturedMaterial.sheenColorMap, proxy.uuid);
          if (texturedMaterial.specularIntensityMap) this.addMaterialTexture(texturedMaterial.specularIntensityMap, proxy.uuid);
          if (texturedMaterial.specularColorMap) this.addMaterialTexture(texturedMaterial.specularColorMap, proxy.uuid);
          if (texturedMaterial.thicknessMap) this.addMaterialTexture(texturedMaterial.thicknessMap, proxy.uuid);
          if (texturedMaterial.transmissionMap) this.addMaterialTexture(texturedMaterial.transmissionMap, proxy.uuid);
        
        }
      }
    });
  }


  setMeshMaterial(mesh: Mesh, material: MaterialProxy) {
    let currentMaterials = mesh.material instanceof Material ? [mesh.material] : mesh.material;
    for (let currentMaterial of currentMaterials) {
      let proxy = this.getMaterialByUUID(currentMaterial.uuid);
      if (proxy) {
        this.materialUUIDsToMeshUUIDs.get(proxy.uuid)?.delete(mesh.uuid);
        if (!this.materialUUIDsToMeshUUIDs.get(proxy.uuid)?.size) {
          this.removeMaterial(proxy.uuid);
        }
      }
    }
    
    if (!this.materialUUIDsToMeshUUIDs.has(material.uuid)) 
      this.materialUUIDsToMeshUUIDs.set(material.uuid, new Set());
    
    this.materialUUIDsToMeshUUIDs.get(material.uuid)?.add(mesh.uuid);

    this.materials.set(material.uuid, material);

    mesh.material = material.m();
  }

  setDocumentTexture(documentID: number, newTexture: Texture): void {
    const currentTextureUUID = this.documentIdsToTextureUUID.get(documentID);
    
    if (currentTextureUUID == newTexture.uuid) {
      return;
    }
    
    this.documentIdsToTextureUUID.set(documentID, newTexture.uuid);
    this.textures.set(newTexture.uuid, newTexture);


    if (currentTextureUUID) {
      let affectedMaterials = this.getMaterialsUsingTexture(currentTextureUUID);
      for (let material of affectedMaterials) {
        this.addMaterialTexture(newTexture, material.uuid);
        this.textureUUIDsToMaterialUUIDs.get(currentTextureUUID)?.delete(material.uuid);
        this.replaceMaterialTexture(material.litMaterial, currentTextureUUID, newTexture);
        this.replaceMaterialTexture(material.unlitMaterial, currentTextureUUID, newTexture);
      }

      const currentTexture = this.textures.get(currentTextureUUID);
      currentTexture?.dispose();
      this.textures.delete(currentTextureUUID);
    }
  }

  replaceMaterialTexture(texturedMaterial: TexturedMaterial, oldTextureUUID: string, newTexture: Texture) {
    // Replace old textures with the new texture
    if (texturedMaterial.map?.uuid === oldTextureUUID) texturedMaterial.map = newTexture;
    if (texturedMaterial.alphaMap?.uuid === oldTextureUUID) texturedMaterial.alphaMap = newTexture;
    if (texturedMaterial.aoMap?.uuid === oldTextureUUID) texturedMaterial.aoMap = newTexture;
    if (texturedMaterial.envMap?.uuid === oldTextureUUID) texturedMaterial.envMap = newTexture;
    if (texturedMaterial.lightMap?.uuid === oldTextureUUID) texturedMaterial.lightMap = newTexture;
    if (texturedMaterial.specularMap?.uuid === oldTextureUUID) texturedMaterial.specularMap = newTexture;
    if (texturedMaterial.displacementMap?.uuid === oldTextureUUID) texturedMaterial.displacementMap = newTexture;
    if (texturedMaterial.emissiveMap?.uuid === oldTextureUUID) texturedMaterial.emissiveMap = newTexture;
    if (texturedMaterial.bumpMap?.uuid === oldTextureUUID) texturedMaterial.bumpMap = newTexture;
    if (texturedMaterial.normalMap?.uuid === oldTextureUUID) texturedMaterial.normalMap = newTexture;
    if (texturedMaterial.metalnessMap?.uuid === oldTextureUUID) texturedMaterial.metalnessMap = newTexture;
    if (texturedMaterial.anisotropyMap?.uuid === oldTextureUUID) texturedMaterial.anisotropyMap = newTexture;
    if (texturedMaterial.clearcoatMap?.uuid === oldTextureUUID) texturedMaterial.clearcoatMap = newTexture;
    if (texturedMaterial.clearcoatNormalMap?.uuid === oldTextureUUID) texturedMaterial.clearcoatNormalMap = newTexture;
    if (texturedMaterial.clearcoatRoughnessMap?.uuid === oldTextureUUID) texturedMaterial.clearcoatRoughnessMap = newTexture;
    if (texturedMaterial.iridescenceMap?.uuid === oldTextureUUID) texturedMaterial.iridescenceMap = newTexture;
    if (texturedMaterial.iridescenceThicknessMap?.uuid === oldTextureUUID) texturedMaterial.iridescenceThicknessMap = newTexture;
    if (texturedMaterial.sheenRoughnessMap?.uuid === oldTextureUUID) texturedMaterial.sheenRoughnessMap = newTexture;
    if (texturedMaterial.sheenColorMap?.uuid === oldTextureUUID) texturedMaterial.sheenColorMap = newTexture;
    if (texturedMaterial.specularIntensityMap?.uuid === oldTextureUUID) texturedMaterial.specularIntensityMap = newTexture;
    if (texturedMaterial.specularColorMap?.uuid === oldTextureUUID) texturedMaterial.specularColorMap = newTexture;
    if (texturedMaterial.thicknessMap?.uuid === oldTextureUUID) texturedMaterial.thicknessMap = newTexture;
    if (texturedMaterial.transmissionMap?.uuid === oldTextureUUID) texturedMaterial.transmissionMap = newTexture;
  }


//#endregion

//#region Removing from scene
  removeMaterial(uuid: string): void {
    const material = this.materials.get(uuid);
    if (!material) {
      console.error(`Material with UUID ${uuid} not found.`);
      return;
    }

    // Remove references to this material from the materialUUIDsToMeshUUIDs map
    const meshUUIDs = this.materialUUIDsToMeshUUIDs.get(uuid);
    if (meshUUIDs) {
      for (const meshUUID of meshUUIDs) {
        const mesh = this.objects.get(meshUUID) as Mesh;
        if (mesh && mesh instanceof Mesh) {
          if (mesh.material instanceof Material) {
            mesh.material = this.defaultMaterial.m();
            this.materialUUIDsToMeshUUIDs.get(this.defaultMaterial.uuid)?.add(meshUUID);
          } else {
            for (let i = 0; i < mesh.material.length; i++) {
              mesh.material[i] = this.defaultMaterial.m();
              this.materialUUIDsToMeshUUIDs.get(this.defaultMaterial.uuid)?.add(meshUUID);
            }
          }
        }
      }
      this.materialUUIDsToMeshUUIDs.delete(uuid);
    }

    // Optionally remove textures if they are not used by any other material
    const textureUUIDs = this.textureUUIDsToMaterialUUIDs.get(uuid);
    if (textureUUIDs) {
      let textures = this.getTexturesUsedByMaterial(uuid);

      for (const texture of textures) {
        // Remove associate b/w this deleted material and texture
        this.textureUUIDsToMaterialUUIDs.get(texture.uuid)?.delete(uuid);
        let materials = this.getMaterialsUsingTexture(texture.uuid);
        
        if (materials.length  == 0) {
          this.textureUUIDsToMaterialUUIDs.delete(texture.uuid);
          this.textures.delete(texture.uuid);
          texture.dispose(); 
        } 
        
      }
    }


    // Remove the material from the materials map
    this.materials.delete(uuid);
    material.dispose();
  }

  // remove object and children, and clean up everything unused that relates to it. (geometry, materials, textures)
  removeObjectFromScene(uuid: string): void {
    let object = this.objects.get(uuid);
    if (!object) return;

    let affectedMaterials = new Set<string>();
    let affectedGeometries = new Set<string>();

    object.traverse((instance) => {   
      this.objects.delete(instance.uuid);
      if (instance instanceof Mesh) {
        // remove geometry entries, and mark them as affect to potentially delete them after the object has been fully traversed
        this.geometryUUIDsToMeshUUIDs.get(instance.geometry.uuid)?.delete(instance.uuid);
        affectedGeometries.add(instance.geometry.uuid);


        // Do the same for Materials
        let materials = instance.material instanceof Material ? [instance.material] : instance.material;
        for (let material of materials) {
          let proxy = this.getMaterialByUUID(material.uuid);
          if (proxy) {
            this.materialUUIDsToMeshUUIDs.get(proxy.uuid)?.delete(instance.uuid);
            affectedMaterials.add(proxy.uuid);
          }
        }
      }
    });


    for (let materialUUID of affectedMaterials) {
      if (!this.materialUUIDsToMeshUUIDs.get(materialUUID)?.size) {
        this.removeMaterial(materialUUID);
      }
    }

    for (let geometryUUID of affectedGeometries) {
      if (!this.geometryUUIDsToMeshUUIDs.get(geometryUUID)?.size) {
        this.geometries.get(geometryUUID)?.dispose();
        this.geometries.delete(geometryUUID);
        this.geometryUUIDsToMeshUUIDs.delete(geometryUUID);
      }
    }


    this.scene.remove(object);
  }

  removeDocument(documentID: number): void {
    const textureUUID = this.documentIdsToTextureUUID.get(documentID);
    if (!textureUUID) return;

    this.documentIdsToTextureUUID.delete(documentID);

    // Iterate through materials, delete all of them which are unused by meshes.
    let allMaterialsAreUnused = true;
    const materialUUIDs = this.textureUUIDsToMaterialUUIDs.get(textureUUID) ?? [];
    for (let uuid of materialUUIDs) {
      // If this material has no entry in material:mesh map, or the size of that map is 0, then remove the material
      if (! (this.materialUUIDsToMeshUUIDs.get(uuid)?.size)) {
        this.removeMaterial(uuid);
      } else {
        allMaterialsAreUnused = false;
      }
    }
    let texture = this.textures.get(textureUUID);

    if (texture && allMaterialsAreUnused) {
      this.textureUUIDsToMaterialUUIDs.delete(textureUUID);
      this.textures.delete(textureUUID);
      texture.dispose(); 
    }
  }

//#endregion
};