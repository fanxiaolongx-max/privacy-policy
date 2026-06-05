class InputAction {
    // gamepadButtons : number[]
    constructor(keys) {
        this.keys = Array.from(keys);
    }
}
export class InputManager {
    get anyPressed() {
        return this.anyKeyPressed; // || this.anyGamepadButtonPressed;
    }
    constructor() {
        this.anyKeyPressed = false;
        this.keys = new Map();
        this.prevent = new Array();
        this.actions = new Map();
        window.addEventListener("keydown", (e) => {
            if (this.prevent.includes(e.code)) {
                e.preventDefault();
            }
            this.keyEvent(e.code, 3 /* InputState.Pressed */);
        });
        window.addEventListener("keyup", (e) => {
            if (this.prevent.includes(e.code)) {
                e.preventDefault();
            }
            this.keyEvent(e.code, 2 /* InputState.Released */);
        });
        window.addEventListener("contextmenu", (e) => e.preventDefault());
        // The bottom two are mostly needed if this game is ever being
        // run inside an iframe
        window.addEventListener("mousemove", () => window.focus());
        window.addEventListener("mousedown", () => window.focus());
    }
    keyEvent(key, state) {
        if (this.keys.get(key) === state - 2)
            return;
        this.keys.set(key, state);
        this.anyKeyPressed || (this.anyKeyPressed = Boolean(state & 1));
    }
    update() {
        let v;
        for (let k of this.keys.keys()) {
            if ((v = this.keys.get(k)) > 1) {
                this.keys.set(k, v - 2);
            }
        }
        this.anyKeyPressed = false;
    }
    addAction(name, keys) {
        this.actions.set(name, new InputAction(keys));
    }
    getAction(name) {
        const a = this.actions.get(name);
        if (a === undefined)
            return 0 /* InputState.Up */;
        let state = 0 /* InputState.Up */;
        for (let k of a.keys) {
            if ((state = (this.keys.get(k) ?? 0 /* InputState.Up */)) != 0 /* InputState.Up */)
                break;
        }
        return state;
    }
}
