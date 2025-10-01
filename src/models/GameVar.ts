export type GameVarScope = 'global' | 'local' | 'unique';

export class GameVar<T = unknown> {
  public readonly id: number;
  public readonly scope: GameVarScope;
  private value: T;

  constructor(id: number, scope: GameVarScope, initial: T) {
    this.id = id;
    this.scope = scope;
    this.value = initial;
  }

  get(): T {
    return this.value;
  }

  set(value: T): void {
    this.value = value;
  }
}
