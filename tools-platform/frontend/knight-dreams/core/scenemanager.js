export class SceneManager {
    constructor() {
        this.activeScene = undefined;
        this.scenes = new Map();
    }
    addScene(name, scene) {
        this.scenes.set(name, scene);
        this.activeScene = scene;
    }
    /*
        public init(event : ProgramEvent) : void {
    
            this.activeScene?.init?.(undefined, event);
        }
    */
    update(event) {
        this.activeScene?.update(event);
    }
    redraw(canvas, assets) {
        this.activeScene?.redraw(canvas, assets);
    }
    changeScene(name) {
        // const s = this.scenes.get(name);
        // const param = s?.dispose();
        this.activeScene = this.scenes.get(name);
        // this.activeScene.init?.(param, event)
    }
}
