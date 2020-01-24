import { mat4, vec2, vec3, quat } from "stardazed/vector";
import { RenderMesh, RenderProgram, RenderTexture, Renderer } from "./render";
import { deg2rad } from "stardazed/core";

export interface TransformDescriptor {
	readonly position: NumArray;
	readonly rotation: NumArray;
	readonly scale: NumArray;
	modelMatrix?: Float32Array;
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

export interface Drawable {
	mesh: RenderMesh;
	program: RenderProgram;
	texture?: RenderTexture;
}

export interface ColliderDescriptor {
	readonly radius: number;
	readonly collisionType: number;
	readonly collisionMask: number;
	// onCollide?(other: ColliderDescriptor & Transformable): void;
}

export interface EntityBase {
	transform?: Transform;
	collider?: ColliderDescriptor;
	camera?: Camera;
	drawable?: Drawable;
}

export interface Entity extends EntityBase {
	awaken?(): void;
	update(dt: number): void;
	onCollide?(other: any): void;
}

export interface EntityDescriptor {
	name?: string;
	transform?: TransformDescriptor;
	camera?: CameraDescriptor;
	drawable?: Drawable;
	collider?: ColliderDescriptor;
	behaviour?: Entity;
}

export type SceneRenderer = Renderer & {
	modelProgram: RenderProgram;
	texturedProgream: RenderProgram;
};


export class Scene {
	entities: EntityDescriptor[] = [];
	updatables: Entity[] = [];
	drawables: (Drawable & TransformDescriptor)[] = [];
	collidables: (ColliderDescriptor & TransformDescriptor)[] = [];
	cameras: Camera[] = [];
	matrices: Float32Array[] = [];
	curCamera: Camera | undefined;

	createEntities(canvas: HTMLCanvasElement, entityDescs: EntityDescriptor[]) {
		for (const ed of entityDescs) {
			const e: EntityBase = {};
			if (ed.transform) {
				e.transform = new Transform(ed.transform);
			}
			if (ed.collider) {
				e.collider = ed.collider;
			}
			if (ed.camera) {
				const pos = (ed.transform) ? ed.transform.position : [0, 0, 0];
				e.camera = new Camera(ed.camera, pos, canvas.width, canvas.height);
			}
			if (ed.drawable) {
				e.drawable = ed.drawable;
			}
			if (ed.behaviour) {
				// make behaviour
			}
		}
	}

	update(dt: number) {
		for (const u of this.updatables) {
			u.update(dt);
		}

		// handle collisions (N log N - I think)
		const collCount = this.collidables.length;
		for (let ca = 0; ca < collCount; ++ca) {
			const colliderA = this.collidables[ca];
			const posA = [colliderA.position[0], colliderA.position[2]];
			for (let cb = ca + 1; cb < collCount; ++cb) {
				const colliderB = this.collidables[cb];
				const a2b = (colliderB.collisionType & colliderA.collisionMask);
				const b2a = (colliderA.collisionType & colliderB.collisionMask);
				if (a2b || b2a) {
					const posB = [colliderB.position[0], colliderB.position[2]];
					const maxRadius = Math.max(colliderA.radius, colliderB.radius);
					if (vec2.distance(posA, posB) < maxRadius) {
						if (a2b) {
							// colliderA.onCollide!(colliderB);
						}
						if (b2a) {
							// colliderB.onCollide!(colliderA);
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

		for (const d of this.drawables) {
			pass.draw({
				modelMatrix: mat4.fromRotationTranslationScale(d.modelMatrix!, d.rotation, d.position, d.scale),
				mesh: d.mesh,
				program: d.program,
				texture: d.texture
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
