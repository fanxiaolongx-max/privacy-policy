export class ProgramEvent {
    get screenWidth() {
        return this.canvas.width;
    }
    get screenHeight() {
        return this.canvas.height;
    }
    constructor(canvas, scenes, input, audio, 
    // transition : TransitionManager, 
    assets) {
        this.tick = 1.0;
        this.canvas = canvas;
        this.scenes = scenes;
        this.input = input;
        this.audio = audio;
        // this.transition = transition;
        this.assets = assets;
    }
}
