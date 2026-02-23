/**
 * ObjectPool — Generic utility for recycling game objects to minimize garbage collection.
 */
export class ObjectPool<T> {
  private pool: T[] = [];
  private factory: () => T;
  private resetFn?: (item: T) => void;

  constructor(factory: () => T, resetFn?: (item: T) => void, initialSize: number = 0) {
    this.factory = factory;
    this.resetFn = resetFn;

    for (let i = 0; i < initialSize; i++) {
      this.pool.push(this.factory());
    }
  }

  /** Get an object from the pool (or create a new one if empty). */
  get(): T {
    if (this.pool.length > 0) {
      const item = this.pool.pop()!;
      if (this.resetFn) this.resetFn(item);
      return item;
    }
    return this.factory();
  }

  /** Return an object to the pool. */
  release(item: T): void {
    this.pool.push(item);
  }

  /** Pre-allocate more objects. */
  allocate(count: number): void {
    for (let i = 0; i < count; i++) {
      this.pool.push(this.factory());
    }
  }

  /** Clear the pool to free memory. */
  clear(): void {
    this.pool = [];
  }
  
  /** Current size of the pool. */
  size(): number {
    return this.pool.length;
  }
}
