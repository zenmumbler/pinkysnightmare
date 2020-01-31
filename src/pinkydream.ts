// Pinky's Nightmare
// An entry for LD33 Game Jampo — You are the Monster
// (c) 2015-2020 by Arthur Langereis — @zenmumbler

import { on, show, hide } from "./util.js";
import { WebGLRenderer, WebGPURenderer } from "./render";
import { Scene } from "./scene";
import { GameScene } from "./gamescene";
import { App } from "./app";

class TitleScreen extends Scene {
	constructor() {
		super();
		on("#run", "click", function() {
			App.setScene("game");
		});
	}

	show() {
		show("#run");
	}

	hide() {
		hide("#run");
	}
}

class VictoryScreen extends Scene {
	constructor() {
		super();
		on("#victory", "click", function() {
			location.reload();
		});
	}

	show() {
		show("#victory");
	}

	hide() {
		hide("#victory");
	}
}

// ---------

async function init() {
	const canvas = document.querySelector("canvas")!;
	// const renderer = new WebGLRenderer();
	const renderer = new WebGPURenderer();
	await renderer.setup(canvas);

	App.init(renderer);
	App.addScene("game", new GameScene());
	App.addScene("title", new TitleScreen());
	App.addScene("victory", new VictoryScreen());

	await App.ready;

	App.setScene("title");
	App.nextFrame();
}

on(window, "load", init);
