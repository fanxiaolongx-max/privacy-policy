export const negMod = (m, n) => ((m % n) + n) % n;
export const clamp = (x, min, max) => Math.max(Math.min(x, max), min);
export const sampleUniform = (min, max) => min + ((Math.random() * (max - min + 1)) | 0);
export const sampleUniformInterpolate = (t, min, max) => {
    const imin = ((1 - t) * min[0] + t * min[1]) | 0;
    const imax = ((1 - t) * max[0] + t * max[1]) | 0;
    return imin + ((Math.random() * (imax - imin + 1)) | 0);
};
export const weightedProbability = (weights) => weightedProbabilityInterpolate(weights, weights, 1.0);
export const weightedProbabilityInterpolate = (weights1, weights2, t) => {
    let p = Math.random();
    let v1 = weights1[0];
    let v2 = weights2[0];
    let i;
    let len = Math.min(weights1.length, weights2.length);
    let v = (1.0 - t) * v1 + t * v2;
    for (i = 0; i < len; ++i) {
        if (p < v)
            break;
        if (i < len - 1) {
            v1 = weights1[i + 1];
            v2 = weights2[i + 1];
            v += (1.0 - t) * v1 + t * v2;
        }
    }
    return i;
};
