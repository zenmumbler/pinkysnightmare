export const KEY_UP = 38, KEY_DOWN = 40, KEY_LEFT = 37, KEY_RIGHT = 39,
	KEY_W = "W".charCodeAt(0), KEY_A = "A".charCodeAt(0), KEY_S = "S".charCodeAt(0), KEY_D = "D".charCodeAt(0);

class InputHandler {
	constructor() {
		window.onkeydown = (evt: KeyboardEvent) => {
			const kc = evt.keyCode;
			this.keys[kc] = true;
			if (! evt.metaKey) {
				evt.preventDefault();
			}
		};
		window.onkeyup = (evt: KeyboardEvent) => {
			const kc = evt.keyCode;
			this.keys[kc] = false;
			if (! evt.metaKey) {
				evt.preventDefault();
			}
		};
		window.onblur = () => {
			this.active = false; this.keys = [];
			if (this.onActiveChange) {
				this.onActiveChange(this.active);
			}
		};
		window.onfocus = () => {
			this.active = true;
			if (this.onActiveChange) {
				this.onActiveChange(this.active);
			}
		};
	}

	onActiveChange: ((active: boolean) => void) | undefined;
	active = true;
	keys: boolean[] = [];
}

export const Input = new InputHandler();
