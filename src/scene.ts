import { Vector3, Matrix, Quaternion } from "stardazed/vector";
import { RenderMesh, RenderProgram, RenderTexture, Renderer } from "./render";
import { Assets } from "./asset";

const MAX_ENTITIES = 64;

export interface TransformDescriptor {
	readonly position: Vector3;
	readonly rotation?: Quaternion;
	readonly scale?: Vector3;
}

export type TXID = number & {
	__TX__?: never;
};

export class Tx {
	private readonly positions = new Float32Array(MAX_ENTITIES * 3);
	private readonly rotations = new Float32Array(MAX_ENTITIES * 4);
	private readonly scales = new Float32Array(MAX_ENTITIES * 3);
	private readonly modelMatrices = new Float32Array(MAX_ENTITIES * 16);

	private readonly p3 = Vector3.zero;
	private readonly s3 = Vector3.one;
	private readonly q4 = Quaternion.identity;
	private readonly m44 = Matrix.identity;

	private next_ = 0;

	create(desc: TransformDescriptor): TXID {
		const id = this.next_++;
		desc.position.writeToArray(this.positions, id * 3);
		(desc.rotation || Quaternion.identity).writeToArray(this.rotations, id * 4);
		(desc.scale || Vector3.one).writeToArray(this.scales, id * 3);
		this.updateMM(id);
		return id;
	}

	setPosition(id: TXID, x: number, y: number, z: number) {
		this.p3.x = x;
		this.p3.y = y;
		this.p3.z = z;
		this.p3.writeToArray(this.positions, id * 3);
		this.updateMM(id);
	}
	setPosition3(id: TXID, v3: Vector3) {
		v3.writeToArray(this.positions, id * 3);
		this.updateMM(id);
	}
	setRotation(id: TXID, q: Quaternion) {
		q.writeToArray(this.rotations, id * 4);
		this.updateMM(id);
	}
	setScale3(id: TXID, v3: Vector3) {
		v3.writeToArray(this.scales, id * 3);
		this.updateMM(id);
	}
	setUniformScale(id: TXID, s: number) {
		this.s3.x = s;
		this.s3.y = s;
		this.s3.z = s;
		this.s3.writeToArray(this.positions, id * 3);
		this.updateMM(id);
	}

	position(id: number) {
		return this.positions.subarray(id * 3, (id + 1) * 3);
	}

	rotation(id: number) {
		return this.rotations.subarray(id * 4, (id + 1) * 4);
	}

	scale(id: number) {
		return this.scales.subarray(id * 3, (id + 1) * 3);
	}

	modelMatrix(id: number) {
		return this.modelMatrices.subarray(id * 16, (id + 1) * 16);
	}

	lookAt(id: number, target: Vector3, worldUp: Vector3) {
		this.p3.setFromArray(this.positions, id * 3);
		const m = Matrix.lookAt(this.p3, target, worldUp);
		const q = m.rotation;
		q.writeToArray(this.rotations, id * 4);
		m.writeToArray(this.modelMatrices, id * 16);
	}

	private updateMM(id: TXID) {
		this.p3.setFromArray(this.positions, id * 3);
		this.q4.setFromArray(this.rotations, id * 4);
		this.s3.setFromArray(this.scales, id * 3);
		this.m44.setTRS(this.p3, this.q4, this.s3);
		this.m44.writeToArray(this.modelMatrices, id * 16);
	}
}

const TransformComponent = new Tx();

export class Transform {
	private readonly id: TXID;
	private posRef: Float32Array | undefined;
	private rotRef: Float32Array | undefined;
	private scaleRef: Float32Array | undefined;
	private modelRef: Float32Array | undefined;

	constructor(id: TXID) {
		this.id = id;
	}

	get position() {
		if (this.posRef === undefined) {
			this.posRef = TransformComponent.position(this.id);
		}
		return Vector3.fromArray(this.posRef);
	}
	set position(p: Vector3) {
		TransformComponent.setPosition3(this.id, p);
	}

	get rotation() {
		if (this.rotRef === undefined) {
			this.rotRef = TransformComponent.rotation(this.id);
		}
		return Quaternion.fromArray(this.rotRef);
	}
	set rotation(q: Quaternion) {
		TransformComponent.setRotation(this.id, q);
	}

	get scale() {
		if (this.scaleRef === undefined) {
			this.scaleRef = TransformComponent.scale(this.id);
		}
		return Vector3.fromArray(this.scaleRef);
	}
	set scale(s: Vector3) {
		TransformComponent.setScale3(this.id, s);
	}

	get modelMatrix() {
		if (this.modelRef === undefined) {
			this.modelRef = TransformComponent.modelMatrix(this.id);
		}
		return Matrix.fromArray(this.modelRef);
	}

	lookAt(target: Vector3, worldUp = Vector3.up) {
		TransformComponent.lookAt(this.id, target, worldUp);
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
	projectionMatrix: Matrix;
	readonly fogLimits = new Float32Array(2);

	constructor(cd: CameraDescriptor, vpWidth: number, vpHeight: number) {
		this.projectionMatrix = Matrix.perspective(cd.fovy, vpWidth / vpHeight, cd.zNear, cd.zFar);
		this.fogLimits[0] = cd.fogNear;
		this.fogLimits[1] = cd.fogFar;
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
	curCamera: Entity | undefined;

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
				e.camera = new Camera(ed.camera, canvas.width, canvas.height);
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

		this.curCamera = this.cameras.length ? this.cameras[0] : undefined;
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
			const posA2D = posA.xz;
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
					const posB2D = posB.xz;
					const maxRadius = Math.max(colliderA.radius, colliderB.radius);
					if (posA2D.distance(posB2D) < maxRadius) {
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
		const pass = renderer.createPass(curCamera.camera!.projectionMatrix, curCamera.transform.modelMatrix, curCamera.camera!.fogLimits);

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
