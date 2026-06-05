export class Vector {
    constructor(x = 0, y = 0) {
        this.clone = () => new Vector(this.x, this.y);
        this.x = x;
        this.y = y;
    }
    zero() {
        this.x = 0;
        this.y = 0;
    }
}
