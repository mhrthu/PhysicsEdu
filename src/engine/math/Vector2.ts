export class Vector2 {
  constructor(public x: number = 0, public y: number = 0) {}

  add(v: Vector2): Vector2 { return new Vector2(this.x + v.x, this.y + v.y); }
  sub(v: Vector2): Vector2 { return new Vector2(this.x - v.x, this.y - v.y); }
  scale(s: number): Vector2 { return new Vector2(this.x * s, this.y * s); }
  dot(v: Vector2): number { return this.x * v.x + this.y * v.y; }
  length(): number { return Math.sqrt(this.x * this.x + this.y * this.y); }
  normalize(): Vector2 {
    const len = this.length();
    return len > 0 ? this.scale(1 / len) : new Vector2();
  }
  rotate(angle: number): Vector2 {
    const c = Math.cos(angle), s = Math.sin(angle);
    return new Vector2(this.x * c - this.y * s, this.x * s + this.y * c);
  }
  clone(): Vector2 { return new Vector2(this.x, this.y); }
  distanceTo(v: Vector2): number { return this.sub(v).length(); }

  static fromAngle(angle: number, magnitude = 1): Vector2 {
    return new Vector2(Math.cos(angle) * magnitude, Math.sin(angle) * magnitude);
  }
}
