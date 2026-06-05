import { clamp } from "../common/math.js";
;
export class Sample {
    constructor(ctx, sequence, baseVolume, type, ramp, attackTime) {
        this.oscillator = undefined;
        this.ctx = ctx;
        this.baseSequence = Array.from(sequence);
        this.baseVolume = baseVolume;
        this.type = type;
        this.ramp = ramp;
        this.attackTime = attackTime;
    }
    play(volume) {
        const INITIAL_VOLUME = 0.20;
        const FUNC = ["setValueAtTime", "linearRampToValueAtTime", "exponentialRampToValueAtTime"];
        const time = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = this.type;
        volume *= this.baseVolume;
        osc.frequency.setValueAtTime(this.baseSequence[0], time);
        gain.gain.setValueAtTime(INITIAL_VOLUME * volume, time);
        gain.gain.exponentialRampToValueAtTime(clamp(volume, 0.01, 1.0), time + this.attackTime / 60.0);
        let timer = 0.0;
        let freq;
        let len;
        for (let i = 0; i < this.baseSequence.length; i += 2) {
            freq = this.baseSequence[i];
            len = this.baseSequence[i + 1];
            /*
                        switch (this.ramp) {
                        
                        case Ramp.Instant:
                            osc.frequency.setValueAtTime(freq, time + timer);
                            break;
            
                        case Ramp.Linear:
                            osc.frequency.linearRampToValueAtTime(freq, time + timer);
                            break;
            
                        case Ramp.Exponential:
                            osc.frequency.exponentialRampToValueAtTime(freq, time + timer);
                            break;
            
                        default:
                            break;
                        }
                        */
            osc.frequency[FUNC[this.ramp]](freq, time + timer);
            timer += 1.0 / 60.0 * len;
        }
        gain.gain.exponentialRampToValueAtTime(volume * 0.50, time + timer);
        osc.connect(gain).connect(this.ctx.destination);
        osc.start(time);
        osc.stop(time + timer);
        osc.onended = () => osc.disconnect();
        this.oscillator?.disconnect();
        this.oscillator = osc;
    }
}
