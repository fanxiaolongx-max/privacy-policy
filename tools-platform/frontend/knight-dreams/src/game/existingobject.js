export class ExistingObject {
    constructor() {
        this.exist = false;
        this.doesExist = () => this.exist;
    }
    forceKill() {
        this.exist = false;
    }
}
export function next(type, arr) {
    for (let o of arr) {
        if (!o.doesExist())
            return o;
    }
    let o = new type.prototype.constructor();
    arr.push(o);
    return o;
}
