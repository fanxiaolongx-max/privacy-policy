export class Sprite {
    constructor() {
        this.frame = 0;
        this.timer = 0.0;
        this.getFrame = () => this.frame;
    }
    nextFrame(dir, startFrame, endFrame) {
        this.frame += dir;
        const min = Math.min(startFrame, endFrame);
        const max = Math.max(startFrame, endFrame);
        if (this.frame < min)
            this.frame = max;
        else if (this.frame > max)
            this.frame = min;
    }
    animate(startFrame, endFrame, frameTime, step) {
        const dir = Math.sign(endFrame - startFrame);
        if (frameTime <= 0) {
            this.nextFrame(dir, startFrame, endFrame);
            return;
        }
        this.timer += step;
        while (this.timer >= frameTime) {
            this.timer -= frameTime;
            this.nextFrame(dir, startFrame, endFrame);
        }
    }
    setFrame(frame) {
        this.frame = frame;
    }
}
