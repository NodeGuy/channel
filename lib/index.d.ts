type MapFn<T, R> = (value: T) => R;

type FlatChannel<T, Depth extends number> = {
  "done": T,
  "recur": T extends ReadChannel<infer InnerT>
      ? FlatChannel<InnerT, [-1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20][Depth]>
      : T
}[Depth extends -1 ? "done" : "recur"];

interface CancelablePromise<T> extends Promise<T> {
  cancel(): void;
}

interface OrderPromise<C, T> extends CancelablePromise<T> {
  channel: C;
  prethen(onFulfilled: (value: T) => void): void;
}
type UnwrapOrderPromise<A> = A extends OrderPromise<any, infer T> ? T : never 

export interface ReadChannel<T> {
  concat<C extends ReadChannel<T>>(...values: (T | C)[]): C;
  every(callback: (value: T) => boolean, thisArg?: any): Promise<boolean>;
  filter(callback: (value: T) => boolean, thisArg?: any): ReadWriteChannel<T>;
  flat<D extends number = 1>(depth?: D): ReadWriteChannel<FlatChannel<T, D>>;
  flatMap<R>(mapperFunction: MapFn<T, R | R[]>, thisArg?: any): ReadWriteChannel<R>;
  forEach(callbackfn: (value: T) => void, thisArg?: any): Promise<void>;
  join(separator?: string): Promise<string>;
  map<R>(mapperFunction: MapFn<T, R>, thisArg?: any): ReadWriteChannel<R>;
  readOnly(): ReadChannel<T>;
  reduce(callbackfn: (prev: any, next: T) => any, initialValue?: any): Promise<any>;
  shift(): OrderPromise<this, T>;
  slice(start?: number, end?: number): ReadWriteChannel<T>;
  some(callbackfn: (value: T) => boolean, thisArg?: any): Promise<boolean>;
  toString(): string;
  value(): T;
  values(): Promise<T[]>;
}

export interface WriteChannel<T> {
  close(): void;
  length(): number;
  push(value: T): OrderPromise<this, number>;
  writeOnly(): WriteChannel<T>;
}

export type ReadWriteChannel<T> = ReadChannel<T> & WriteChannel<T>;

import { Functionalify, Typify } from './functional';
// Ideally these would not be channels of `any`, but I couldn't find a way to pass on the generic arguments
type FunctionalInterface =
  Functionalify<Typify<ReadChannel<any>>, ReadChannel<any>> & Functionalify<Typify<WriteChannel<any>>, WriteChannel<any>>

export type ChannelConstructor = {
  <T>(length?: number): ReadWriteChannel<T>;
  new <T>(length?: number): ReadWriteChannel<T>;
  all<T>(...values: T[]): ReadWriteChannel<T>;
  from<T, R = T>(iterable: Iterable<T>, mapfn?: MapFn<T, R>, thisArg?: any): ReadChannel<R>;
  from<T>(callback: () => T): ReadChannel<T>;
  of<T extends unknown[]>(...values: T): ReadChannel<T[number]>;
  isChannel<T extends ReadChannel<any> | WriteChannel<any>>(channel: T): channel is T;
  select<T extends OrderPromise<any, any>[]>(promises: T): CancelablePromise<ReadChannel<UnwrapOrderPromise<T[number]>>>;
} & FunctionalInterface

declare const Channel: ChannelConstructor;

export default Channel;