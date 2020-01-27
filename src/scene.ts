import { deg2rad } from "stardazed/core";
import { mat4, vec2, vec3, quat } from "stardazed/vector";
import { RenderMesh, RenderProgram, RenderTexture, Renderer } from "./render";
import { Assets } from "./asset";

export interface TransformDescriptor {
	readonly position: NumArray;
	readonly rotation: NumArray;
	readonly scale: NumArray;
}

class Transform {
	readonly position = vec3.create();
	readonly rotation = quat.create();
	readonly scale = vec3.create();
	readonly modelMatrix = mat4.create();

	constructor(desc: TransformDescriptor) {
		vec3.copy(this.position, desc.position);
		quat.copy(this.rotation, desc.rotation);
		vec3.copy(this.scale, desc.scale);
		this.updateMM();
	}

	setPosition(x: number, y: number, z: number) {
		vec3.set(this.position, x, y, z);
		this.updateMM();
	}
	setPosition3(v3: NumArray) {
		vec3.copy(this.position, v3);
		this.updateMM();
	}
	setRotation(axis: NumArray, angle: number) {
		quat.setAxisAngle(this.rotation, axis, angle);
		this.updateMM();
	}
	setScale3(v3: NumArray) {
		vec3.copy(this.scale, v3);
		this.updateMM();
	}
	setUniformScale(s: number) {
		vec3.set(this.scale, s, s, s);
		this.updateMM();
	}

	private updateMM() {
		mat4.fromRotationTranslationScale(this.modelMatrix, this.rotation, this.position, this.scale);
	}
}

export interface CameraDescriptor {
	fovy: number;
	zNear: number;
	zFar: number;
	fogNear: number;
	fogFar: number;
}

export class Camera {
	readonly projectionMatrix = mat4.create();
	readonly viewMatrix = mat4.create();
	readonly fogLimits = new Float32Array(2);

	constructor(cd: CameraDescriptor, origin: NumArray, vpWidth: number, vpHeight: number) {
		mat4.perspective(this.projectionMatrix, deg2rad(cd.fovy), vpWidth / vpHeight, cd.zNear, cd.zFar);
		this.fogLimits[0] = cd.fogNear;
		this.fogLimits[1] = cd.fogFar;

		const target = vec3.add([0, 0, 0], origin, [0, 0, 1]);
		mat4.lookAt(this.viewMatrix, origin, target, [0, 1, 0]);
	}
}

export interface MeshRendererDescriptor {
	meshName: string;
	textureName?: string;
}

export class MeshRenderer {
	mesh: RenderMesh;
	program: RenderProgram;
	texture?: RenderTexture;

	constructor(mrd: MeshRendererDescriptor, assets: Assets) {
		this.mesh = assets.meshes[mrd.meshName];
		if (mrd.textureName) {
			this.texture = assets.textures[mrd.textureName];
			this.program = assets.texturedProgram;
		}
		else {
			this.program = assets.modelProgram;
		}
	}
}

export interface ColliderDescriptor {
	radius: number;
	collisionType: number;
	collisionMask: number;
}

export interface Entity {
	name: string;
	transform: Transform;
	camera?: Camera;
	meshRenderer?: MeshRenderer;
	collider?: ColliderDescriptor;
	behaviour?: EntityBehaviour;
}

export class EntityBehaviour {
	readonly scene: Scene;
	readonly entity: Entity;

	constructor(scene: Scene, ent: Entity) {
		this.scene = scene;
		this.entity = ent;
	}

	awaken() {}
	update(_dt: number) {}
	onCollide(_other: Entity) {}
}

export interface EntityBehaviourConstructor {
	new(scene: Scene, ent: Entity): EntityBehaviour;
}

export interface EntityDescriptor {
	name?: string;
	transform: TransformDescriptor;
	camera?: CameraDescriptor;
	meshRenderer?: MeshRendererDescriptor;
	collider?: ColliderDescriptor;
	behaviour?: EntityBehaviourConstructor;
}

export type SceneRenderer = Renderer & {
	modelProgram: RenderProgram;
	texturedProgream: RenderProgram;
};


export class Scene {
	entities: Entity[] = [];
	updatables: Entity[] = [];
	renderers: Entity[] = [];
	colliders: Entity[] = [];
	cameras: Entity[] = [];
	curCamera: Camera | undefined;

	findEntityByName(name: string): Entity | undefined {
		for (const e of this.entities) {
			if (e.name === name) {
				return e;
			}
		}
		return undefined;
	}

	createEntities(canvas: HTMLCanvasElement, assets: Assets, entityDescs: EntityDescriptor[]) {
		for (const ed of entityDescs) {
			const e: Entity = {
				name: ed.name || "",
				transform: new Transform(ed.transform)
			};
			if (ed.collider) {
				e.collider = ed.collider;
				this.colliders.push(e);
			}
			if (ed.camera) {
				const pos = (ed.transform) ? ed.transform.position : [0, 0, 0];
				e.camera = new Camera(ed.camera, pos, canvas.width, canvas.height);
				this.cameras.push(e);
			}
			if (ed.meshRenderer) {
				e.meshRenderer = new MeshRenderer(ed.meshRenderer, assets);
				this.renderers.push(e);
			}
			if (ed.behaviour) {
				// make behaviour
				e.behaviour = new ed.behaviour(this, e);
				this.updatables.push(e);
			}
			this.entities.push(e);
		}

		for (const e of this.updatables) {
			if (e.behaviour && e.behaviour.awaken) {
				e.behaviour.awaken();
			}
		}

		this.curCamera = this.cameras.length ? this.cameras[0].camera : undefined;
	}

	update(dt: number) {
		for (const e of this.updatables) {
			if (e.behaviour && e.behaviour.update) {
				e.behaviour.update(dt);
			}
		}

		// handle collisions (N log N - I think)
		const collCount = this.colliders.length;
		for (let ca = 0; ca < collCount; ++ca) {
			const collEntA = this.colliders[ca];
			const colliderA = collEntA.collider;
			const txA = collEntA.transform;
			if (! (colliderA && txA)) {
				continue;
			}
			const posA = [txA.position[0], txA.position[2]];
			for (let cb = ca + 1; cb < collCount; ++cb) {
				const collEntB = this.colliders[cb];
				const colliderB = collEntB.collider;
				const txB = collEntB.transform;
				if (! (colliderB && txB)) {
					continue;
				}
				const a2b = (colliderB.collisionType & colliderA.collisionMask);
				const b2a = (colliderA.collisionType & colliderB.collisionMask);
				if (a2b || b2a) {
					const posB = [txB.position[0], txB.position[2]];
					const maxRadius = Math.max(colliderA.radius, colliderB.radius);
					if (vec2.distance(posA, posB) < maxRadius) {
						if (a2b) {
							collEntA.behaviour?.onCollide?.(collEntB);
						}
						if (b2a) {
							collEntB.behaviour?.onCollide?.(collEntA);
						}
					}
				}
			}
		}
	}

	draw(renderer: SceneRenderer) {
		const { curCamera } = this;
		if (!curCamera) {
			return;
		}
		const pass = renderer.createPass(curCamera.projectionMatrix, curCamera.viewMatrix, curCamera.fogLimits);

		for (const d of this.renderers) {
			const dd = d.meshRenderer!;
			const dtx = d.transform;
			if (! dtx) {
				continue;
			}
			pass.draw({
				modelMatrix: mat4.fromRotationTranslationScale(dtx.modelMatrix!, dtx.rotation, dtx.position, dtx.scale),
				mesh: dd.mesh,
				program: dd.program,
				texture: dd.texture
			});
		}

		pass.finish();
	}

	show() {
		// show this scene
	}

	hide() {
		// hide this scene
	}

	load(_renderer: SceneRenderer): Promise<void> {
		return Promise.resolve();
	}
}
