/**
 * Serialises like the value it holds, but is not a plain object or array.
 * nestjs-mvc re-matches the children of an `always()` prop against `only` on
 * a partial reload and drops them (ravenberg/nestjs-mvc#8); wrapped, the
 * value travels whole. Remove once that is fixed.
 */
export class Opaque<T = unknown> {
  constructor(private readonly data: T) {}

  toJSON() {
    return this.data;
  }
}
