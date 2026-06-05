import { clamp } from "../common/math.js";
import { Vector } from "../common/vector.js";
import { Sprite } from "../renderer/sprite.js";
import { ExistingObject, next } from "./existingobject.js";
import { GameObject } from "./gameobject.js";
export const DEATH_TIME = 60;
class Dust extends ExistingObject {
    constructor() {
        super(...arguments);
        this.timer = 0.0;
        this.x = 0;
        this.y = 0;
    }
    spawn(x, y) {
        this.x = x;
        this.y = y;
        this.timer = 1.0;
        this.exist = true;
    }
    update(globalSpeed, event) {
        if (!this.exist)
            return;
        if ((this.timer -= 1.0 / 30.0 * event.tick) <= 0) {
            this.exist = false;
            return;
        }
        this.x -= globalSpeed * event.tick;
    }
    draw(canvas, bmp) {
        if (!this.exist)
            return;
        const px = Math.round(this.x);
        const py = Math.round(this.y);
        const frame = Math.round((1.0 - this.timer) * 3.0);
        canvas.drawBitmap(bmp, px - 4, py - 4, 32 + frame * 8, 72, 8, 8);
    }
}
export class Player extends GameObject {
    constructor(x, y) {
        super(x, y);
        // private initialPos : Vector;
        this.jumpTimer = 0;
        this.ledgeTimer = 0;
        this.propelling = false;
        this.propellerTimer = 0;
        this.propellerRelease = false;
        this.canFly = true;
        this.deathTimer = 0;
        this.throwTimer = 0;
        this.dustTimer = 10;
        this.fuel = 1.0;
        // Yes, we store this here, I don't have room for another
        // class
        this.score = 0;
        this.scoreTimer = 0;
        this.orbs = 0;
        this.doesOverlaySpear = (o) => o.doesOverlayRect(this.spearPos, new Vector(), new Vector(16, 8));
        this.getDeathTimer = () => this.deathTimer;
        this.getFuel = () => this.fuel;
        this.getScore = () => this.score;
        this.getOrbs = () => this.orbs;
        this.friction = new Vector(0.15, 0.15);
        this.hitbox = new Vector(12, 12);
        this.center = new Vector(0, 2);
        this.spr = new Sprite();
        this.propeller = new Sprite();
        this.exist = true;
        this.spearPos = new Vector();
        this.computeSpearPos();
        this.dust = new Array();
        // this.initialPos = new Vector(x, y);
    }
    computeSpearPos() {
        const TIP_DISTANCE = 24;
        const THROW_DISTANCE = 64;
        const throwPos = Math.sin((1.0 - this.throwTimer) * Math.PI) * THROW_DISTANCE;
        this.spearPos.x = this.pos.x + TIP_DISTANCE + throwPos;
        this.spearPos.y = this.pos.y + 3;
    }
    control(event) {
        const BASE_SPEED = 1.5;
        const BASE_GRAVITY = 4.0;
        const JUMP_TIME = 20;
        const PROPELLER_FALL_SPEED = 0.75;
        const FLY_DELTA = 0.30;
        const FLY_SPEED_MAX = -1.5;
        const FLY_SPEED_LOW = 2.0;
        const FLY_TIME = 60;
        const FUEL_CONSUMPTION = 1.0 / 180.0;
        let dir = 0;
        if ((event.input.getAction("r") & 1 /* InputState.DownOrPressed */) != 0) {
            dir = 1;
        }
        else if ((event.input.getAction("l") & 1 /* InputState.DownOrPressed */) != 0) {
            dir = -1;
        }
        this.target.x = BASE_SPEED * dir;
        this.target.y = BASE_GRAVITY;
        const jumpButtonState = event.input.getAction("j");
        const jumpButtonDown = (jumpButtonState & 1 /* InputState.DownOrPressed */) != 0;
        if (this.propellerRelease && !jumpButtonDown) {
            this.propellerRelease = false;
        }
        this.propelling = this.fuel > 0 && !this.propellerRelease && jumpButtonDown;
        // Jump
        if (this.ledgeTimer > 0 && jumpButtonState == 3 /* InputState.Pressed */) {
            this.jumpTimer = JUMP_TIME;
            this.touchSurface = false;
            this.ledgeTimer = 0;
            event.audio.playSample(event.assets.getSample("aj"), 0.60);
        }
        else if ((jumpButtonState & 1 /* InputState.DownOrPressed */) == 0) {
            this.jumpTimer = 0;
        }
        // Propelling
        if (this.propelling) {
            this.fuel = Math.max(0, this.fuel - FUEL_CONSUMPTION * event.tick);
            if (this.propellerTimer > 0) {
                this.propellerTimer -= event.tick;
                this.speed.y = clamp(this.speed.y - FLY_DELTA * event.tick, FLY_SPEED_MAX, FLY_SPEED_LOW);
            }
            else if (!this.canFly && this.speed.y >= PROPELLER_FALL_SPEED) {
                this.speed.y = PROPELLER_FALL_SPEED;
                this.target.y = this.speed.y;
            }
            else if (this.canFly) {
                this.propellerTimer = FLY_TIME;
                this.canFly = false;
            }
        }
        else {
            this.propellerTimer = 0;
        }
        const throwState = event.input.getAction("t");
        if (this.throwTimer <= 0 && throwState == 3 /* InputState.Pressed */) {
            this.throwTimer = 1.0;
            event.audio.playSample(event.assets.getSample("aa"), 0.60);
        }
        else if (this.throwTimer > 0.5 && (throwState & 1 /* InputState.DownOrPressed */) == 0) {
            this.throwTimer = 1.0 - this.throwTimer;
        }
    }
    updateTimers(event) {
        const JUMP_SPEED = 2.75;
        const THROW_SPEED = 1.0 / 60.0;
        if (this.jumpTimer > 0) {
            this.speed.y = -JUMP_SPEED;
            this.jumpTimer -= event.tick;
        }
        if (this.ledgeTimer > 0) {
            this.ledgeTimer -= event.tick;
        }
        if (this.throwTimer > 0.0) {
            this.throwTimer -= THROW_SPEED * event.tick;
        }
    }
    checkScreenCollisions(event) {
        if (this.speed.x < 0 && this.pos.x - this.hitbox.x / 2 <= 0) {
            this.pos.x = this.hitbox.x / 2;
            this.speed.x = 0;
        }
        else if (this.speed.x > 0 && this.pos.x + this.hitbox.x / 2 >= event.screenWidth) {
            this.pos.x = event.screenWidth - this.hitbox.x / 2;
            this.speed.x = 0;
        }
        if (this.pos.y > event.screenHeight) {
            this.kill(event);
            this.pos.y = event.screenHeight;
        }
    }
    animate(globalSpeed, event) {
        const JUMP_EPS = 0.5;
        const PROPELLER_SPEED = 2;
        let frame;
        if (this.touchSurface) {
            this.spr.animate(0, 3, 8 - globalSpeed * 2, event.tick);
        }
        else {
            frame = 5;
            if (this.speed.y < -JUMP_EPS)
                frame = 4;
            else if (this.speed.y > JUMP_EPS)
                frame = 6;
            this.spr.setFrame(frame);
        }
        const lastFrame = this.propeller.getFrame();
        if (this.propelling) {
            this.propeller.animate(0, 3, PROPELLER_SPEED, event.tick);
            if (this.propeller.getFrame() != lastFrame &&
                lastFrame == 0) {
                event.audio.playSample(event.assets.getSample("ap"), 0.60);
            }
        }
    }
    updateDust(globalSpeed, event) {
        const dustTime = this.propelling ? 6 : 8;
        const speed = this.propelling ? 1 : globalSpeed;
        if ((this.touchSurface || this.propelling) &&
            (this.dustTimer -= speed * event.tick) <= 0) {
            this.dustTimer += dustTime;
            next(Dust, this.dust).spawn(this.pos.x - 4, this.pos.y + 7);
        }
        for (let d of this.dust) {
            d.update(globalSpeed, event);
        }
    }
    // Wait draw *what* now?
    drawDeathBalls(canvas) {
        const MAX_DISTANCE = 64;
        const COLORS = ["#5555aa", "#aaaaff", "#ffffff"];
        const RADIUS = [7, 5, 3];
        // const shift = (((this.deathTimer / 3) | 0)) % 3;
        // const angleShift = Math.PI*2/8;
        const distance = this.deathTimer / DEATH_TIME * MAX_DISTANCE;
        let dx;
        let dy;
        let angle;
        for (let i = 0; i < 8; ++i) {
            angle = Math.PI * 2 / 8 * i;
            dx = this.pos.x + Math.cos(angle) * distance;
            dy = this.pos.y + Math.sin(angle) * distance;
            for (let j = 0; j < 3; ++j) {
                canvas.fillColor(COLORS[(j + ((((this.deathTimer / 3) | 0)) % 3)) % 3]);
                canvas.fillCircle(dx, dy, RADIUS[j]);
            }
        }
    }
    drawSpear(canvas, bmp) {
        // Need to re-compute this for reasons
        this.computeSpearPos();
        const px = Math.round(this.pos.x);
        const dx = Math.round(this.spearPos.x);
        const dy = Math.round(this.spearPos.y);
        const w = dx - px;
        canvas.fillColor("#000000");
        canvas.fillRect(px, dy - 1, w, 3);
        canvas.fillColor("#aa5500");
        canvas.fillRect(px, dy, w, 1);
        // Spear tip
        canvas.drawBitmap(bmp, dx - 8, dy - 3, 0, 112, 16, 8);
    }
    updateEvent(globalSpeed, event) {
        const SCORE_TIME = 6;
        this.control(event);
        this.updateTimers(event);
        this.checkScreenCollisions(event);
        this.animate(globalSpeed, event);
        this.updateDust(globalSpeed, event);
        this.touchSurface = false;
        if ((this.scoreTimer += globalSpeed * event.tick) >= SCORE_TIME) {
            this.scoreTimer -= SCORE_TIME;
            this.addScore(1);
        }
        this.computeSpearPos();
    }
    die(globalSpeed, event) {
        for (let d of this.dust) {
            d.update(globalSpeed, event);
        }
        return (this.deathTimer += event.tick) >= DEATH_TIME;
    }
    floorCollisionEvent(event) {
        const LEDGE_TIME = 8;
        this.touchSurface = true;
        this.ledgeTimer = LEDGE_TIME;
        this.propellerRelease = true;
        this.propelling = false;
        this.canFly = true;
    }
    draw(canvas, assets) {
        if (!this.exist)
            return;
        const dx = Math.round(this.pos.x) - 16;
        const dy = Math.round(this.pos.y) - 16;
        const bmpHD = assets.getBitmap("player_hd");
        for (let d of this.dust) {
            d.draw(canvas, assets.getBitmap("b"));
        }
        if (this.dying) {
            this.drawDeathBalls(canvas);
            return;
        }
        // We use the same frame index mapping
        // Idle frames: 0-5
        // Walk frames: 6-13
        // Attack frames: 14-17
        let frameIndex = 0;
        let flip = 0 /* Flip.None */;
        // Hacky way to get direction
        if (this.target.x < 0)
            flip = 1 /* Flip.Horizontal */;
        if (this.throwTimer > 0) {
            frameIndex = 14 + (Math.round((1.0 - this.throwTimer) * 3) % 4);
        }
        else if (this.touchSurface) {
            if (Math.abs(this.target.x) > 0.1) {
                frameIndex = 6 + (this.spr.getFrame() % 8);
            }
            else {
                frameIndex = this.spr.getFrame() % 6;
            }
        }
        else {
            // Jumping
            frameIndex = 14 + (Math.abs(Math.round(this.speed.y)) % 4);
        }
        const cellW = 196;
        const cellH = 209;
        // Target draw size: since 196x209 is mostly padding, drawing it at 48x48 
        // will make the character about 16-24px tall, fitting the game's scale.
        const drawW = 48;
        const drawH = 48;
        canvas.drawBitmapScaled(bmpHD, dx, dy - 8, drawW, drawH, frameIndex * cellW, 0, cellW, cellH, flip);
    }
    hurtCollision(x, y, w, h, event) {
        if (!this.exist || this.dying)
            return false;
        if (this.doesOverlayRect(new Vector(x + w / 2, y + h / 2), new Vector(), new Vector(w, h))) {
            this.kill(event);
        }
    }
    // This is more memory friendly, but wastes too many bytes...
    /*
    public recreate() : void {

        this.pos = this.initialPos.clone();
        this.speed.zero();
        this.target.zero();

        this.canFly = false;
        this.touchSurface = true;
        this.propelling = false;
        this.propellerTimer = 0;
        this.propellerRelease = false;
        this.ledgeTimer = 0;
        this.jumpTimer = 0;
        this.deathTimer = 0;
        this.fuel = 1.0;

        this.score = 0;
        this.scoreTimer = 0;
        this.orbs = 0;

        this.spr.setFrame(0);
        this.propeller.setFrame(0);
        
        this.dying = false;
        this.exist = true;
    }
    */
    // Good naming here, congrats
    touchTouchableEvent(isGem, event) {
        const FUEL_BONUS = 0.15;
        if (isGem) {
            ++this.orbs;
            this.fuel = Math.min(1.0, this.fuel + FUEL_BONUS);
            event.audio.playSample(event.assets.getSample("ag"), 0.60);
            return;
        }
        this.kill(event);
    }
    kill(event) {
        this.dying = true;
        event.audio.playSample(event.assets.getSample("ad"), 0.60);
    }
    stompJump() {
        const STOMP_SPEED = -3.0;
        // To avoid getting killed when trying to stomp
        // two enemies...
        const SAFE_SHIFT = -2.0;
        this.speed.y = STOMP_SPEED;
        this.canFly = true;
        this.pos.y += SAFE_SHIFT;
    }
    addScore(count) {
        this.score += (count * (1.0 + this.orbs / 10.0)) | 0;
    }
}
