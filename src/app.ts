import { Scene, SceneRenderer } from "./scene";
import { Renderer } from "./render";
import { Input } from "./input";

export class Application {
	scenes: Record<string, Scene> = {};
	curScene: Scene | undefined;
	t0 = 0;
	tLast = 0;
	tCur = 0;
	renderer!: SceneRenderer;
	loadPromises: Promise<void>[] = [];

	init(renderer: Renderer) {
		this.renderer = renderer as any;
		this.renderer.modelProgram = this.renderer.createProgram("standard");
		this.renderer.texturedProgream = this.renderer.createProgram("texturedProgram");

		Input.onActiveChange = (active) => {
			if (active) {
				this.tLast = (Date.now() / 1000.0) - this.t0;
				this.nextFrame();
			}
		};
	}

	get ready() {
		return Promise.all(this.loadPromises);
	}

	addScene(named: string, scene: Scene) {
		this.scenes[named] = scene;
		this.loadPromises.push(scene.load(this.renderer));
	}

	setScene(newSceneName: string | undefined) {
		const newScene: Scene | undefined = this.scenes[newSceneName || ""];
		if (newScene === this.curScene) {
			return;
		}
		if (this.curScene) {
			this.curScene.hide();
		}
		if (newScene) {
			this.t0 = Date.now() / 1000;
			this.tLast = this.t0;
			this.tCur = this.t0;

			newScene.show();
		}
		this.curScene = newScene;
	}

	nextFrame() {
		if (this.curScene) {
			App.tCur = (Date.now() / 1000.0) - this.t0;
			const dt = this.tCur - this.tLast;
			this.curScene.update(dt);
			this.curScene.draw(this.renderer);
			this.tLast = this.tCur;
		}

		if (Input.active) {
			requestAnimationFrame(() => this.nextFrame());
		}
	}
}

export const App = new Application();
