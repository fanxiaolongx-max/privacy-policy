import { Vector } from "../common/vector.js";
import { ExistingObject } from "./existingobject.js";
export const updateSpeedAxis = (speed, target, step) => {
    if (speed < target) {
        return Math.min(target, speed + step);
    }
    return Math.max(target, speed - step);
};
export class GameObject extends ExistingObject {
    constructor(x = 0, y = 0) {
        super();
        this.dying = false;
        this.touchSurface = false;
        this.getCollision = true;
        this.isDying = () => this.dying;
        this.getPosition = () => this.pos.clone();
        this.doesOverlayRect = (pos, center, hitbox) => this.pos.x + this.center.x + this.hitbox.x / 2 >= pos.x + center.x - hitbox.x / 2 &&
            this.pos.x + this.center.x - this.hitbox.x / 2 <= pos.x + center.x + hitbox.x / 2 &&
            this.pos.y + this.center.y + this.hitbox.y / 2 >= pos.y + center.y - hitbox.y / 2 &&
            this.pos.y + this.center.y - this.hitbox.y / 2 <= pos.y + center.y + hitbox.y / 2;
        this.doesOverlay = (o) => this.doesOverlayRect(o.pos, o.center, o.hitbox);
        this.pos = new Vector(x, y);
        this.speed = new Vector();
        this.target = new Vector();
        this.friction = new Vector(1, 1);
        this.hitbox = new Vector();
        this.center = new Vector();
    }
    die(globalSpeed, event) { return true; }
    move(event) {
        this.speed.x = updateSpeedAxis(this.speed.x, this.target.x, this.friction.x * event.tick);
        this.speed.y = updateSpeedAxis(this.speed.y, this.target.y, this.friction.y * event.tick);
        this.pos.x += this.speed.x * event.tick;
        this.pos.y += this.speed.y * event.tick;
    }
    floorCollisionEvent(event) { }
    update(globalSpeed, event) {
        if (!this.exist)
            return;
        if (this.dying) {
            if (this.die(globalSpeed, event)) {
                this.dying = false;
                this.exist = false;
            }
            return;
        }
        this.updateEvent?.(globalSpeed, event);
        this.move(event);
        this.touchSurface = false;
    }
    forceKill() {
        this.exist = false;
        this.dying = false;
    }
    floorCollision(x1, y1, x2, y2, globalSpeed, event, leftMargin = 1, rightMargin = 1, speedCheckLimit = 0.0, topMargin = 2, bottomMargin = 8) {
        // The case x1 > x2 can be ignored since it never happens anyway
        // But to save bytes, let's just pretend it never happens anyway!
        // if (x1 >= x2)
        //    return false;
        if (!this.getCollision ||
            !this.exist || this.dying ||
            this.speed.y <= speedCheckLimit ||
            this.pos.x + this.center.x + this.hitbox.x / 2 * leftMargin < x1 ||
            this.pos.x + this.center.x - this.hitbox.x / 2 * rightMargin > x2)
            return false;
        const k = (y2 - y1) / (x2 - x1);
        const b = y1 - k * x1;
        const y0 = this.pos.x * k + b;
        const bottom = this.pos.y + this.center.y + this.hitbox.y / 2;
        const hmod = Math.abs(k * (this.speed.x + globalSpeed)) * event.tick;
        const vmod = Math.abs(this.speed.y) * event.tick;
        if (bottom < y0 + bottomMargin + vmod + hmod &&
            bottom >= y0 - topMargin - hmod) {
            this.pos.y = y0 - this.center.y - this.hitbox.y / 2;
            this.speed.y = 0;
            this.touchSurface = true;
            this.floorCollisionEvent(event);
            return true;
        }
        return false;
    }
}
