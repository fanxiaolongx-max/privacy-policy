export class Camera {
    constructor(y = 0) {
        this.speed = 1.0;
        this.getPosition = () => this.y;
        this.y = y;
    }
    reachInitialPoint(event) {
        const DELTA = 0.1;
        const MAX_SPEED = 4.0;
        this.speed = Math.min(MAX_SPEED, this.speed + DELTA * event.tick);
        if ((this.y += this.speed * event.tick) >= 0) {
            this.y = 0;
            return true;
        }
        return false;
    }
    followObject(o, event) {
        const VERTICAL_DEADZONE = 16;
        const RANGE_OFFSET = 24;
        const py = o.getPosition().y - event.screenHeight / 2 + RANGE_OFFSET;
        // TEMP (or not?)
        let d = this.y - py;
        if (Math.abs(d) >= VERTICAL_DEADZONE) {
            this.y = py + VERTICAL_DEADZONE * Math.sign(d);
        }
        this.y = Math.min(0, this.y);
    }
    use(canvas) {
        canvas.moveTo(0, -Math.round(this.y));
    }
    reset() {
        this.y = 0;
    }
}
