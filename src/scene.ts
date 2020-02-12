import { deg2rad } from "stardazed/core";
import { mat4, vec2, vec3, quat, setIndexedMat4, setIndexedVec3, setIndexedVec4, copyIndexedVec3Into, copyIndexedVec4Into } from "stardazed/vector";
import { RenderMesh, RenderProgram, RenderTexture, Renderer } from "./render";
import { Assets } from "./asset";

const MAX_ENTITIES = 64;

export interface TransformDescriptor {
	readonly position: NumArray;
	readonly rotation: NumArray;
	readonly scale: NumArray;
}

export type TXID = number & {
	__TX__?: never;
};

export class Tx {
	private readonly positions = new Float32Array(MAX_ENTITIES * 3);
	private readonly rotations = new Float32Array(MAX_ENTITIES * 4);
	private readonly scales = new Float32Array(MAX_ENTITIES * 3);
	private readonly modelMatrices = new Float32Array(MAX_ENTITIES * 16);

	private readonly p3 = vec3.fromValues(0, 0, 0);
	private readonly s3 = vec3.fromValues(1, 1, 1);
	private readonly q4 = quat.create();
	private readonly m44 = mat4.create();

	private next_ = 0;

	create(desc: TransformDescriptor): TXID {
		const id = this.next_++;
		setIndexedVec3(this.positions, id, desc.position);
		setIndexedVec4(this.rotations, id, desc.rotation);
		setIndexedVec3(this.scales, id, desc.scale);
		this.updateMM(id);
		return id;
	}

	setPosition(id: TXID, x: number, y: number, z: number) {
		this.p3[0] = x;
		this.p3[1] = y;
		this.p3[2] = z;
		setIndexedVec3(this.positions, id, this.p3);
		this.updateMM(id);
	}
	setPosition3(id: TXID, v3: NumArray) {
		setIndexedVec3(this.positions, id, v3);
		this.updateMM(id);
	}
	setRotation(id: TXID, axis: NumArray, angle: number) {
		const q = quat.setAxisAngle(this.q4, axis, angle);
		setIndexedVec4(this.rotations, id, q);
		this.updateMM(id);
	}
	setScale3(id: TXID, v3: NumArray) {
		setIndexedVec3(this.scales, id, v3);
		this.updateMM(id);
	}
	setUniformScale(id: TXID, s: number) {
		this.s3[0] = s;
		this.s3[1] = s;
		this.s3[2] = s;
		setIndexedVec3(this.positions, id, this.s3);
		this.updateMM(id);
	}

	position(id: number) {
		return this.positions.subarray(id * 3, (id + 1) * 3);
	}

	scale(id: number) {
		return this.scales.subarray(id * 3, (id + 1) * 3);
	}

	modelMatrix(id: number) {
		return this.modelMatrices.subarray(id * 16, (id + 1) * 16);
	}

	private updateMM(id: TXID) {
		copyIndexedVec3Into(this.p3, this.positions, id);
		copyIndexedVec4Into(this.q4, this.rotations, id);
		copyIndexedVec3Into(this.s3, this.scales, id);
		mat4.fromRotationTranslationScale(this.m44, this.q4, this.p3, this.s3);
		setIndexedMat4(this.modelMatrices, id, this.m44);
	}
}

const TransformComponent = new Tx();

export class Transform {
	private readonly id: TXID;
	private posRef: Float32Array | undefined;
	private scaleRef: Float32Array | undefined;
	private modelRef: Float32Array | undefined;

	constructor(id: TXID) {
		this.id = id;
	}

	get position() {
		if (this.posRef === undefined) {
			this.posRef = TransformComponent.position(this.id);
		}
		return this.posRef;
	}

	get scale() {
		if (this.scaleRef === undefined) {
			this.scaleRef = TransformComponent.scale(this.id);
		}
		return this.scaleRef;
	}

	get modelMatrix() {
		if (this.modelRef === undefined) {
			this.modelRef = TransformComponent.modelMatrix(this.id);
		}
		return this.modelRef;
	}

	setPosition(x: number, y: number, z: number) {
		TransformComponent.setPosition(this.id, x, y, z);
	}
	setPosition3(v3: NumArray) {
		TransformComponent.setPosition3(this.id, v3);
	}
	setRotation(axis: NumArray, angle: number) {
		TransformComponent.setRotation(this.id, axis, angle);
	}
	setScale3(v3: NumArray) {
		TransformComponent.setScale3(this.id, v3);
	}
	setUniformScale(s: number) {
		TransformComponent.setUniformScale(this.id, s);
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
	txid: TXID;
	transform: Transform;
	camera?: Camera;
	meshRenderer?: MeshRenderer;
	collider?: ColliderDescriptor;
	behaviour?: EntityBehaviour;
}

export class EntityBehaviour {
	readonly scene: Scene;
	readonly entity: Entity;
	readonly transform: Transform;

	constructor(scene: Scene, ent: Entity) {
		this.scene = scene;
		this.entity = ent;
		this.transform = ent.transform;
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
			const txid = TransformComponent.create(ed.transform);
			const e: Entity = {
				name: ed.name || "",
				txid,
				transform: new Transform(txid)
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
			const posA = collEntA.transform.position;
			if (! colliderA) {
				continue;
			}
			const posA2D = [posA[0], posA[2]];
			for (let cb = ca + 1; cb < collCount; ++cb) {
				const collEntB = this.colliders[cb];
				const colliderB = collEntB.collider;
				const posB = collEntB.transform.position;
				if (! colliderB) {
					continue;
				}
				const a2b = (colliderB.collisionType & colliderA.collisionMask);
				const b2a = (colliderA.collisionType & colliderB.collisionMask);
				if (a2b || b2a) {
					const posB2D = [posB[0], posB[2]];
					const maxRadius = Math.max(colliderA.radius, colliderB.radius);
					if (vec2.distance(posA2D, posB2D) < maxRadius) {
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
				modelMatrix: dtx.modelMatrix,
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
