import { sampleUniform, sampleUniformInterpolate, weightedProbability, weightedProbabilityInterpolate } from "../common/math.js";
import { next } from "./existingobject.js";
import { BASE_SHIFT_X, GroundLayer } from "./groundlayer.js";
import { SpecialPlatform } from "./specialplatform.js";
import { TouchableObject } from "./touchableobject.js";
const SPECIAL_WAIT_MIN = 4;
const SPECIAL_WAIT_MAX = 16;
const TOUCHABLE_TIMER_MIN = [4, 1];
const TOUCHABLE_TIMER_MAX = [12, 6];
const FLYING_ENEMY_TIMER_MIN = [16, 6];
const FLYING_ENEMY_TIMER_MAX = [32, 12];
const REPEAT_WEIGHT = [[0.50, 0.30, 0.20], [0.10, 0.50, 0.40]];
const ENEMY_WEIGHTS = [[0.40, 0.30, 0.20, 0.10], [0.25, 0.25, 0.25, 0.25]];
const GEM_OFF_Y = -10;
export class Terrain {
    constructor(event) {
        this.tilePointer = 0;
        this.tileOffset = 0;
        this.specialWait = 0;
        this.touchableRepeat = 0;
        this.touchableLayer = 0;
        this.touchableType = 1 /* TouchableType.Gem */;
        this.flyingEnemyTimer = 0;
        this.getObjectPos = () => this.width * 16 - BASE_SHIFT_X * 16 + (this.tileOffset % 16);
        const EXTRA_MARGIN = 5;
        this.width = ((event.screenWidth / 16) | 0) + EXTRA_MARGIN;
        this.layers = new Array(2);
        this.layers[0] = new GroundLayer(this.width, 0 /* GroundLayerType.Foreground */);
        this.layers[1] = new GroundLayer(this.width, 1 /* GroundLayerType.Background */, 8);
        this.layers[0].setReferenceLayer(this.layers[1]);
        this.layers[1].setReferenceLayer(this.layers[0]);
        this.specialWait = sampleUniform(SPECIAL_WAIT_MIN, SPECIAL_WAIT_MAX);
        this.specialPlatforms = new Array();
        this.touchableTimer = sampleUniform(TOUCHABLE_TIMER_MIN[0], TOUCHABLE_TIMER_MAX[0]);
        this.flyingEnemyTimer = sampleUniform(FLYING_ENEMY_TIMER_MIN[0], FLYING_ENEMY_TIMER_MAX[0]);
        this.touchables = new Array();
    }
    spawnSpecialPlatform(event) {
        const MIN_HEIGHT = 3;
        const MAX_HEIGHT = 5;
        const MIN_WIDTH = 1;
        const MAX_WIDTH = 5;
        const MUSHROOM_MAX_HEIGHT = 6;
        const TYPE_PROB = [0.75, 0.25];
        const OBJECT_PROB = 0.5;
        if ((--this.specialWait) > 0)
            return;
        let width = sampleUniform(MIN_WIDTH, MAX_WIDTH);
        if (this.layers[1].getDistanceFromPlatform() <= width / 2 + 1) {
            return;
        }
        let groundHeight = this.layers[0].getHeight();
        if (!this.layers[1].hasGap()) {
            // this.layers[1].getGapTimer() <= width/2 ???
            groundHeight = this.layers[1].getHeight();
        }
        const height = groundHeight + sampleUniform(MIN_HEIGHT, MAX_HEIGHT);
        // Determine type
        let type = weightedProbability(TYPE_PROB);
        if (width == MAX_WIDTH) {
            type = 0 /* SpecialPlatformType.Mushroom */;
        }
        else if (height >= this.layers[0].getHeight() + MUSHROOM_MAX_HEIGHT ||
            width <= 2) {
            type = 1 /* SpecialPlatformType.FloatingPlatform */;
        }
        const opos = this.getObjectPos();
        next(SpecialPlatform, this.specialPlatforms)
            .spawn(opos, height * 16, width, type);
        this.specialWait = sampleUniform(width + 2, SPECIAL_WAIT_MAX);
        let x;
        let y;
        let count;
        if (Math.random() < OBJECT_PROB) {
            count = Math.min(3, sampleUniform(1, width));
            x = opos + 8 - width * 16 / 2 + ((Math.random() * (width - count + 1)) | 0) * 16;
            y = event.screenHeight - height * 16 + (this.touchableType == 1 /* TouchableType.Gem */ ? GEM_OFF_Y : -8);
            for (let i = 0; i < count; ++i) {
                next(TouchableObject, this.touchables).spawn(x + i * 16, y, this.touchableType);
            }
        }
    }
    spawnTouchableObject(event) {
        const yoff = this.touchableType == 1 /* TouchableType.Gem */ ? GEM_OFF_Y : -8;
        const layer = this.touchableLayer;
        next(TouchableObject, this.touchables)
            .spawn(this.getObjectPos() + 8 - 16 * (1 - layer) - 8 * layer, event.screenHeight - this.layers[layer].getHeight() * 16 + yoff, this.touchableType);
    }
    layerCheck() {
        return (!this.layers[this.touchableLayer].isFlatSurfaceOrBridge() &&
            !this.layers[this.touchableLayer = 1 - this.touchableLayer].isFlatSurfaceOrBridge());
    }
    spawnTouchables(t, event) {
        if (this.touchableRepeat > 0) {
            if (this.layerCheck()) {
                return false;
            }
            --this.touchableRepeat;
            this.spawnTouchableObject(event);
            return true;
        }
        if ((--this.touchableTimer) > 0)
            return false;
        this.touchableLayer = 1 - this.touchableLayer;
        if (this.layerCheck()) {
            return false;
        }
        this.touchableType = this.touchableType == 1 /* TouchableType.Gem */ ?
            2 + weightedProbabilityInterpolate(ENEMY_WEIGHTS[0], ENEMY_WEIGHTS[1], t) :
            1 /* TouchableType.Gem */;
        this.touchableRepeat = weightedProbabilityInterpolate(REPEAT_WEIGHT[0], REPEAT_WEIGHT[1], t); // + 1?
        this.touchableTimer = this.touchableRepeat + sampleUniformInterpolate(t, TOUCHABLE_TIMER_MIN, TOUCHABLE_TIMER_MAX);
        this.spawnTouchableObject(event);
        return true;
    }
    spawnFlyingEnemies(t, event) {
        const OFFSET_Y = 32;
        if ((--this.flyingEnemyTimer) > 0)
            return;
        const layer = Math.random() < 0.5 ? 0 : 1;
        const y = event.screenHeight - this.layers[layer].getHeight() * 16 - OFFSET_Y;
        const repeat = weightedProbabilityInterpolate(REPEAT_WEIGHT[0], REPEAT_WEIGHT[1], t);
        this.flyingEnemyTimer = sampleUniformInterpolate(t, FLYING_ENEMY_TIMER_MIN, FLYING_ENEMY_TIMER_MAX);
        for (let i = 0; i < repeat; ++i) {
            next(TouchableObject, this.touchables)
                .spawn(this.getObjectPos() + 8 - 16 * (1 - layer) - 8 * layer + i * 16, y, 6 /* TouchableType.FlyingBall */);
        }
    }
    update(player, playTimeFactor, globalSpeed, event) {
        for (let p of this.specialPlatforms) {
            p.update(globalSpeed, event);
        }
        for (let o of this.touchables) {
            o.update(globalSpeed, event);
            o.playerCollision(globalSpeed, player, event);
            this.objectCollision(o, globalSpeed, event);
        }
        if ((this.tileOffset += globalSpeed * event.tick) >= 16) {
            // TODO: In the old code tileOffset was updated accidentally
            // *afterwards*. See that this does not break anything.
            this.tileOffset -= 16;
            for (let l of this.layers) {
                l.update(this.tilePointer, playTimeFactor);
            }
            this.spawnSpecialPlatform(event);
            if (!this.spawnTouchables(playTimeFactor, event)) {
                this.spawnFlyingEnemies(playTimeFactor, event);
            }
            this.tilePointer = (this.tilePointer + 1) % this.width;
        }
    }
    draw(canvas, assets) {
        const bmpTerrain = assets.getBitmap("t");
        for (let p of this.specialPlatforms) {
            p.draw(canvas, bmpTerrain);
        }
        for (let i = 1; i >= 0; --i) {
            this.layers[i].draw(canvas, bmpTerrain, this.tilePointer, this.tileOffset);
        }
        for (let o of this.touchables) {
            o.draw(canvas, assets);
        }
    }
    objectCollision(o, globalSpeed, event) {
        if (!o.doesExist() || o.isDying())
            return;
        for (let l of this.layers) {
            l.objectCollision(o, globalSpeed, this.tilePointer, this.tileOffset, event);
        }
        for (let p of this.specialPlatforms) {
            p.objectCollision(o, globalSpeed, event);
        }
    }
}
