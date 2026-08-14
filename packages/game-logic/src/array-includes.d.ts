interface Array<T> {
  includes(searchElement: T, fromIndex?: number): boolean;
}
interface ReadonlyArray<T> {
  includes(searchElement: T, fromIndex?: number): boolean;
}
interface Int32Array {
  includes(searchElement: number, fromIndex?: number): boolean;
}
