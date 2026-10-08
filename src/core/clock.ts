// Wall time is used only for timestamps. Active durations use performance.now().
export class ActiveClock {
  private base: number;
  private start: number | null;
  constructor(
    elapsed = 0,
    private now: () => number = () => performance.now(),
  ) {
    this.base = elapsed;
    this.start = now();
  }
  read() {
    return this.base + (this.start === null ? 0 : Math.max(0, this.now() - this.start));
  }
  pause() {
    this.base = this.read();
    this.start = null;
  }
  resume() {
    if (this.start === null) this.start = this.now();
  }
}
