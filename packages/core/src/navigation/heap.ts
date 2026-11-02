/** Binary min-heap keyed by numeric priority. Duplicate pushes are allowed (lazy deletion). */
export class MinHeap<T> {
  private items: { v: T; p: number }[] = [];

  get size(): number {
    return this.items.length;
  }

  push(v: T, p: number): void {
    const a = this.items;
    a.push({ v, p });
    let i = a.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (a[parent]!.p <= a[i]!.p) break;
      [a[parent], a[i]] = [a[i]!, a[parent]!];
      i = parent;
    }
  }

  pop(): T | undefined {
    const a = this.items;
    if (a.length === 0) return undefined;
    const top = a[0]!;
    const last = a.pop()!;
    if (a.length > 0) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l]!.p < a[m]!.p) m = l;
        if (r < a.length && a[r]!.p < a[m]!.p) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i]!, a[m]!];
        i = m;
      }
    }
    return top.v;
  }
}
