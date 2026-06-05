import { Sample } from "./sample.js";
export class AudioPlayer {
    constructor() {
        this.createSample = (sequence, baseVolume = 1.0, type = "square", ramp = 2 /* Ramp.Exponential */, attackTime = 2) => new Sample(this.ctx, sequence, baseVolume, type, ramp, attackTime);
        this.toggle = (state = !this.enabled) => (this.enabled = state);
        this.isEnabled = () => this.enabled;
        this.ctx = new AudioContext();
        this.enabled = true;
        // this.globalVolume = globalVolume;
    }
    playSample(s, volume = 1.0) {
        // Let's pretend that it's never undefined
        if (!this.enabled) // || s === undefined)
            return;
        try {
            s.play(volume * this.globalVolume);
        }
        catch (e) { }
    }
    setGlobalVolume(vol) {
        this.globalVolume = vol;
    }
}
