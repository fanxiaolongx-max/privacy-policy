import { AudioPlayer } from "../audio/audioplayer.js";
import { Canvas } from "../renderer/canvas.js";
import { AssetManager } from "./assets.js";
import { ProgramEvent } from "./event.js";
import { InputManager } from "./input.js";
import { SceneManager } from "./scenemanager.js";
// import { TransitionManager } from "./transition.js";
export class Program {
    constructor(canvasWidth, canvasHeight) {
        this.timeSum = 0.0;
        this.oldTime = 0.0;
        this.initialized = false;
        this.onloadEvent = undefined;
        this.canvas = new Canvas(canvasWidth, canvasHeight);
        this.audio = new AudioPlayer();
        this.input = new InputManager();
        this.assets = new AssetManager();
        // this.transition = new TransitionManager();
        this.scenes = new SceneManager();
        this.event = new ProgramEvent(this.canvas, this.scenes, this.input, this.audio, 
        // this.transition, 
        this.assets);
    }
    loop(ts) {
        const MAX_REFRESH_COUNT = 5; // Needed in the case that window gets deactivated and reactivated much later
        const FRAME_TIME = 16.66667;
        const delta = ts - this.oldTime;
        const loaded = this.assets.hasLoaded();
        this.timeSum = Math.min(this.timeSum + delta, MAX_REFRESH_COUNT * FRAME_TIME);
        this.oldTime = ts;
        if (loaded && !this.initialized) {
            this.onloadEvent?.(this.event);
            // this.scenes.init(this.event);
            this.initialized = true;
        }
        let firstFrame = true;
        for (; this.timeSum >= FRAME_TIME; this.timeSum -= FRAME_TIME) {
            if (loaded) {
                this.scenes.update(this.event);
                // this.transition.update(this.event);
            }
            if (firstFrame) {
                this.event.input.update();
                firstFrame = false;
            }
        }
        if (loaded) {
            this.scenes.redraw(this.canvas, this.assets);
            // this.transition.draw(this.canvas);
        }
        else {
            // TODO: Loading text?
            this.canvas.clear("#0055aa");
        }
        window.requestAnimationFrame(ts => this.loop(ts));
    }
    run(initialEvent, onload) {
        initialEvent?.(this.event);
        this.onloadEvent = onload;
        this.loop(0.0);
    }
}
