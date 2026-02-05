
/**
 * Client
**/

import * as runtime from './runtime/library.js';
import $Types = runtime.Types // general types
import $Public = runtime.Types.Public
import $Utils = runtime.Types.Utils
import $Extensions = runtime.Types.Extensions
import $Result = runtime.Types.Result

export type PrismaPromise<T> = $Public.PrismaPromise<T>


/**
 * Model Ride
 * 
 */
export type Ride = $Result.DefaultSelection<Prisma.$RidePayload>
/**
 * Model RideStateTransition
 * 
 */
export type RideStateTransition = $Result.DefaultSelection<Prisma.$RideStateTransitionPayload>

/**
 * Enums
 */
export namespace $Enums {
  export const RideStatus: {
  CREATED: 'CREATED',
  FINDING_DRIVER: 'FINDING_DRIVER',
  OFFERED: 'OFFERED',
  ASSIGNED: 'ASSIGNED',
  ACCEPTED: 'ACCEPTED',
  PICKING_UP: 'PICKING_UP',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED'
};

export type RideStatus = (typeof RideStatus)[keyof typeof RideStatus]

}

export type RideStatus = $Enums.RideStatus

export const RideStatus: typeof $Enums.RideStatus

/**
 * ##  Prisma Client ʲˢ
 * 
 * Type-safe database client for TypeScript & Node.js
 * @example
 * ```
 * const prisma = new PrismaClient()
 * // Fetch zero or more Rides
 * const rides = await prisma.ride.findMany()
 * ```
 *
 * 
 * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
 */
export class PrismaClient<
  ClientOptions extends Prisma.PrismaClientOptions = Prisma.PrismaClientOptions,
  U = 'log' extends keyof ClientOptions ? ClientOptions['log'] extends Array<Prisma.LogLevel | Prisma.LogDefinition> ? Prisma.GetEvents<ClientOptions['log']> : never : never,
  ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs
> {
  [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['other'] }

    /**
   * ##  Prisma Client ʲˢ
   * 
   * Type-safe database client for TypeScript & Node.js
   * @example
   * ```
   * const prisma = new PrismaClient()
   * // Fetch zero or more Rides
   * const rides = await prisma.ride.findMany()
   * ```
   *
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
   */

  constructor(optionsArg ?: Prisma.Subset<ClientOptions, Prisma.PrismaClientOptions>);
  $on<V extends U>(eventType: V, callback: (event: V extends 'query' ? Prisma.QueryEvent : Prisma.LogEvent) => void): void;

  /**
   * Connect with the database
   */
  $connect(): $Utils.JsPromise<void>;

  /**
   * Disconnect from the database
   */
  $disconnect(): $Utils.JsPromise<void>;

  /**
   * Add a middleware
   * @deprecated since 4.16.0. For new code, prefer client extensions instead.
   * @see https://pris.ly/d/extensions
   */
  $use(cb: Prisma.Middleware): void

/**
   * Executes a prepared raw query and returns the number of affected rows.
   * @example
   * ```
   * const result = await prisma.$executeRaw`UPDATE User SET cool = ${true} WHERE email = ${'user@email.com'};`
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Executes a raw query and returns the number of affected rows.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$executeRawUnsafe('UPDATE User SET cool = $1 WHERE email = $2 ;', true, 'user@email.com')
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Performs a prepared raw query and returns the `SELECT` data.
   * @example
   * ```
   * const result = await prisma.$queryRaw`SELECT * FROM User WHERE id = ${1} OR email = ${'user@email.com'};`
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<T>;

  /**
   * Performs a raw query and returns the `SELECT` data.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$queryRawUnsafe('SELECT * FROM User WHERE id = $1 OR email = $2;', 1, 'user@email.com')
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<T>;


  /**
   * Allows the running of a sequence of read/write operations that are guaranteed to either succeed or fail as a whole.
   * @example
   * ```
   * const [george, bob, alice] = await prisma.$transaction([
   *   prisma.user.create({ data: { name: 'George' } }),
   *   prisma.user.create({ data: { name: 'Bob' } }),
   *   prisma.user.create({ data: { name: 'Alice' } }),
   * ])
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/concepts/components/prisma-client/transactions).
   */
  $transaction<P extends Prisma.PrismaPromise<any>[]>(arg: [...P], options?: { isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<runtime.Types.Utils.UnwrapTuple<P>>

  $transaction<R>(fn: (prisma: Omit<PrismaClient, runtime.ITXClientDenyList>) => $Utils.JsPromise<R>, options?: { maxWait?: number, timeout?: number, isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<R>


  $extends: $Extensions.ExtendsHook<"extends", Prisma.TypeMapCb, ExtArgs>

      /**
   * `prisma.ride`: Exposes CRUD operations for the **Ride** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Rides
    * const rides = await prisma.ride.findMany()
    * ```
    */
  get ride(): Prisma.RideDelegate<ExtArgs>;

  /**
   * `prisma.rideStateTransition`: Exposes CRUD operations for the **RideStateTransition** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more RideStateTransitions
    * const rideStateTransitions = await prisma.rideStateTransition.findMany()
    * ```
    */
  get rideStateTransition(): Prisma.RideStateTransitionDelegate<ExtArgs>;
}

export namespace Prisma {
  export import DMMF = runtime.DMMF

  export type PrismaPromise<T> = $Public.PrismaPromise<T>

  /**
   * Validator
   */
  export import validator = runtime.Public.validator

  /**
   * Prisma Errors
   */
  export import PrismaClientKnownRequestError = runtime.PrismaClientKnownRequestError
  export import PrismaClientUnknownRequestError = runtime.PrismaClientUnknownRequestError
  export import PrismaClientRustPanicError = runtime.PrismaClientRustPanicError
  export import PrismaClientInitializationError = runtime.PrismaClientInitializationError
  export import PrismaClientValidationError = runtime.PrismaClientValidationError
  export import NotFoundError = runtime.NotFoundError

  /**
   * Re-export of sql-template-tag
   */
  export import sql = runtime.sqltag
  export import empty = runtime.empty
  export import join = runtime.join
  export import raw = runtime.raw
  export import Sql = runtime.Sql



  /**
   * Decimal.js
   */
  export import Decimal = runtime.Decimal

  export type DecimalJsLike = runtime.DecimalJsLike

  /**
   * Metrics 
   */
  export type Metrics = runtime.Metrics
  export type Metric<T> = runtime.Metric<T>
  export type MetricHistogram = runtime.MetricHistogram
  export type MetricHistogramBucket = runtime.MetricHistogramBucket

  /**
  * Extensions
  */
  export import Extension = $Extensions.UserArgs
  export import getExtensionContext = runtime.Extensions.getExtensionContext
  export import Args = $Public.Args
  export import Payload = $Public.Payload
  export import Result = $Public.Result
  export import Exact = $Public.Exact

  /**
   * Prisma Client JS version: 5.22.0
   * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
   */
  export type PrismaVersion = {
    client: string
  }

  export const prismaVersion: PrismaVersion 

  /**
   * Utility Types
   */


  export import JsonObject = runtime.JsonObject
  export import JsonArray = runtime.JsonArray
  export import JsonValue = runtime.JsonValue
  export import InputJsonObject = runtime.InputJsonObject
  export import InputJsonArray = runtime.InputJsonArray
  export import InputJsonValue = runtime.InputJsonValue

  /**
   * Types of the values used to represent different kinds of `null` values when working with JSON fields.
   * 
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  namespace NullTypes {
    /**
    * Type of `Prisma.DbNull`.
    * 
    * You cannot use other instances of this class. Please use the `Prisma.DbNull` value.
    * 
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class DbNull {
      private DbNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.JsonNull`.
    * 
    * You cannot use other instances of this class. Please use the `Prisma.JsonNull` value.
    * 
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class JsonNull {
      private JsonNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.AnyNull`.
    * 
    * You cannot use other instances of this class. Please use the `Prisma.AnyNull` value.
    * 
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class AnyNull {
      private AnyNull: never
      private constructor()
    }
  }

  /**
   * Helper for filtering JSON entries that have `null` on the database (empty on the db)
   * 
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const DbNull: NullTypes.DbNull

  /**
   * Helper for filtering JSON entries that have JSON `null` values (not empty on the db)
   * 
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const JsonNull: NullTypes.JsonNull

  /**
   * Helper for filtering JSON entries that are `Prisma.DbNull` or `Prisma.JsonNull`
   * 
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const AnyNull: NullTypes.AnyNull

  type SelectAndInclude = {
    select: any
    include: any
  }

  type SelectAndOmit = {
    select: any
    omit: any
  }

  /**
   * Get the type of the value, that the Promise holds.
   */
  export type PromiseType<T extends PromiseLike<any>> = T extends PromiseLike<infer U> ? U : T;

  /**
   * Get the return type of a function which returns a Promise.
   */
  export type PromiseReturnType<T extends (...args: any) => $Utils.JsPromise<any>> = PromiseType<ReturnType<T>>

  /**
   * From T, pick a set of properties whose keys are in the union K
   */
  type Prisma__Pick<T, K extends keyof T> = {
      [P in K]: T[P];
  };


  export type Enumerable<T> = T | Array<T>;

  export type RequiredKeys<T> = {
    [K in keyof T]-?: {} extends Prisma__Pick<T, K> ? never : K
  }[keyof T]

  export type TruthyKeys<T> = keyof {
    [K in keyof T as T[K] extends false | undefined | null ? never : K]: K
  }

  export type TrueKeys<T> = TruthyKeys<Prisma__Pick<T, RequiredKeys<T>>>

  /**
   * Subset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection
   */
  export type Subset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
  };

  /**
   * SelectSubset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection.
   * Additionally, it validates, if both select and include are present. If the case, it errors.
   */
  export type SelectSubset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    (T extends SelectAndInclude
      ? 'Please either choose `select` or `include`.'
      : T extends SelectAndOmit
        ? 'Please either choose `select` or `omit`.'
        : {})

  /**
   * Subset + Intersection
   * @desc From `T` pick properties that exist in `U` and intersect `K`
   */
  export type SubsetIntersection<T, U, K> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    K

  type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };

  /**
   * XOR is needed to have a real mutually exclusive union type
   * https://stackoverflow.com/questions/42123407/does-typescript-support-mutually-exclusive-types
   */
  type XOR<T, U> =
    T extends object ?
    U extends object ?
      (Without<T, U> & U) | (Without<U, T> & T)
    : U : T


  /**
   * Is T a Record?
   */
  type IsObject<T extends any> = T extends Array<any>
  ? False
  : T extends Date
  ? False
  : T extends Uint8Array
  ? False
  : T extends BigInt
  ? False
  : T extends object
  ? True
  : False


  /**
   * If it's T[], return T
   */
  export type UnEnumerate<T extends unknown> = T extends Array<infer U> ? U : T

  /**
   * From ts-toolbelt
   */

  type __Either<O extends object, K extends Key> = Omit<O, K> &
    {
      // Merge all but K
      [P in K]: Prisma__Pick<O, P & keyof O> // With K possibilities
    }[K]

  type EitherStrict<O extends object, K extends Key> = Strict<__Either<O, K>>

  type EitherLoose<O extends object, K extends Key> = ComputeRaw<__Either<O, K>>

  type _Either<
    O extends object,
    K extends Key,
    strict extends Boolean
  > = {
    1: EitherStrict<O, K>
    0: EitherLoose<O, K>
  }[strict]

  type Either<
    O extends object,
    K extends Key,
    strict extends Boolean = 1
  > = O extends unknown ? _Either<O, K, strict> : never

  export type Union = any

  type PatchUndefined<O extends object, O1 extends object> = {
    [K in keyof O]: O[K] extends undefined ? At<O1, K> : O[K]
  } & {}

  /** Helper Types for "Merge" **/
  export type IntersectOf<U extends Union> = (
    U extends unknown ? (k: U) => void : never
  ) extends (k: infer I) => void
    ? I
    : never

  export type Overwrite<O extends object, O1 extends object> = {
      [K in keyof O]: K extends keyof O1 ? O1[K] : O[K];
  } & {};

  type _Merge<U extends object> = IntersectOf<Overwrite<U, {
      [K in keyof U]-?: At<U, K>;
  }>>;

  type Key = string | number | symbol;
  type AtBasic<O extends object, K extends Key> = K extends keyof O ? O[K] : never;
  type AtStrict<O extends object, K extends Key> = O[K & keyof O];
  type AtLoose<O extends object, K extends Key> = O extends unknown ? AtStrict<O, K> : never;
  export type At<O extends object, K extends Key, strict extends Boolean = 1> = {
      1: AtStrict<O, K>;
      0: AtLoose<O, K>;
  }[strict];

  export type ComputeRaw<A extends any> = A extends Function ? A : {
    [K in keyof A]: A[K];
  } & {};

  export type OptionalFlat<O> = {
    [K in keyof O]?: O[K];
  } & {};

  type _Record<K extends keyof any, T> = {
    [P in K]: T;
  };

  // cause typescript not to expand types and preserve names
  type NoExpand<T> = T extends unknown ? T : never;

  // this type assumes the passed object is entirely optional
  type AtLeast<O extends object, K extends string> = NoExpand<
    O extends unknown
    ? | (K extends keyof O ? { [P in K]: O[P] } & O : O)
      | {[P in keyof O as P extends K ? K : never]-?: O[P]} & O
    : never>;

  type _Strict<U, _U = U> = U extends unknown ? U & OptionalFlat<_Record<Exclude<Keys<_U>, keyof U>, never>> : never;

  export type Strict<U extends object> = ComputeRaw<_Strict<U>>;
  /** End Helper Types for "Merge" **/

  export type Merge<U extends object> = ComputeRaw<_Merge<Strict<U>>>;

  /**
  A [[Boolean]]
  */
  export type Boolean = True | False

  // /**
  // 1
  // */
  export type True = 1

  /**
  0
  */
  export type False = 0

  export type Not<B extends Boolean> = {
    0: 1
    1: 0
  }[B]

  export type Extends<A1 extends any, A2 extends any> = [A1] extends [never]
    ? 0 // anything `never` is false
    : A1 extends A2
    ? 1
    : 0

  export type Has<U extends Union, U1 extends Union> = Not<
    Extends<Exclude<U1, U>, U1>
  >

  export type Or<B1 extends Boolean, B2 extends Boolean> = {
    0: {
      0: 0
      1: 1
    }
    1: {
      0: 1
      1: 1
    }
  }[B1][B2]

  export type Keys<U extends Union> = U extends unknown ? keyof U : never

  type Cast<A, B> = A extends B ? A : B;

  export const type: unique symbol;



  /**
   * Used by group by
   */

  export type GetScalarType<T, O> = O extends object ? {
    [P in keyof T]: P extends keyof O
      ? O[P]
      : never
  } : never

  type FieldPaths<
    T,
    U = Omit<T, '_avg' | '_sum' | '_count' | '_min' | '_max'>
  > = IsObject<T> extends True ? U : T

  type GetHavingFields<T> = {
    [K in keyof T]: Or<
      Or<Extends<'OR', K>, Extends<'AND', K>>,
      Extends<'NOT', K>
    > extends True
      ? // infer is only needed to not hit TS limit
        // based on the brilliant idea of Pierre-Antoine Mills
        // https://github.com/microsoft/TypeScript/issues/30188#issuecomment-478938437
        T[K] extends infer TK
        ? GetHavingFields<UnEnumerate<TK> extends object ? Merge<UnEnumerate<TK>> : never>
        : never
      : {} extends FieldPaths<T[K]>
      ? never
      : K
  }[keyof T]

  /**
   * Convert tuple to union
   */
  type _TupleToUnion<T> = T extends (infer E)[] ? E : never
  type TupleToUnion<K extends readonly any[]> = _TupleToUnion<K>
  type MaybeTupleToUnion<T> = T extends any[] ? TupleToUnion<T> : T

  /**
   * Like `Pick`, but additionally can also accept an array of keys
   */
  type PickEnumerable<T, K extends Enumerable<keyof T> | keyof T> = Prisma__Pick<T, MaybeTupleToUnion<K>>

  /**
   * Exclude all keys with underscores
   */
  type ExcludeUnderscoreKeys<T extends string> = T extends `_${string}` ? never : T


  export type FieldRef<Model, FieldType> = runtime.FieldRef<Model, FieldType>

  type FieldRefInputType<Model, FieldType> = Model extends never ? never : FieldRef<Model, FieldType>


  export const ModelName: {
    Ride: 'Ride',
    RideStateTransition: 'RideStateTransition'
  };

  export type ModelName = (typeof ModelName)[keyof typeof ModelName]


  export type Datasources = {
    db?: Datasource
  }

  interface TypeMapCb extends $Utils.Fn<{extArgs: $Extensions.InternalArgs, clientOptions: PrismaClientOptions }, $Utils.Record<string, any>> {
    returns: Prisma.TypeMap<this['params']['extArgs'], this['params']['clientOptions']>
  }

  export type TypeMap<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, ClientOptions = {}> = {
    meta: {
      modelProps: "ride" | "rideStateTransition"
      txIsolationLevel: Prisma.TransactionIsolationLevel
    }
    model: {
      Ride: {
        payload: Prisma.$RidePayload<ExtArgs>
        fields: Prisma.RideFieldRefs
        operations: {
          findUnique: {
            args: Prisma.RideFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RidePayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.RideFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RidePayload>
          }
          findFirst: {
            args: Prisma.RideFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RidePayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.RideFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RidePayload>
          }
          findMany: {
            args: Prisma.RideFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RidePayload>[]
          }
          create: {
            args: Prisma.RideCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RidePayload>
          }
          createMany: {
            args: Prisma.RideCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.RideCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RidePayload>[]
          }
          delete: {
            args: Prisma.RideDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RidePayload>
          }
          update: {
            args: Prisma.RideUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RidePayload>
          }
          deleteMany: {
            args: Prisma.RideDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.RideUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.RideUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RidePayload>
          }
          aggregate: {
            args: Prisma.RideAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateRide>
          }
          groupBy: {
            args: Prisma.RideGroupByArgs<ExtArgs>
            result: $Utils.Optional<RideGroupByOutputType>[]
          }
          count: {
            args: Prisma.RideCountArgs<ExtArgs>
            result: $Utils.Optional<RideCountAggregateOutputType> | number
          }
        }
      }
      RideStateTransition: {
        payload: Prisma.$RideStateTransitionPayload<ExtArgs>
        fields: Prisma.RideStateTransitionFieldRefs
        operations: {
          findUnique: {
            args: Prisma.RideStateTransitionFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RideStateTransitionPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.RideStateTransitionFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RideStateTransitionPayload>
          }
          findFirst: {
            args: Prisma.RideStateTransitionFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RideStateTransitionPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.RideStateTransitionFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RideStateTransitionPayload>
          }
          findMany: {
            args: Prisma.RideStateTransitionFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RideStateTransitionPayload>[]
          }
          create: {
            args: Prisma.RideStateTransitionCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RideStateTransitionPayload>
          }
          createMany: {
            args: Prisma.RideStateTransitionCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.RideStateTransitionCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RideStateTransitionPayload>[]
          }
          delete: {
            args: Prisma.RideStateTransitionDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RideStateTransitionPayload>
          }
          update: {
            args: Prisma.RideStateTransitionUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RideStateTransitionPayload>
          }
          deleteMany: {
            args: Prisma.RideStateTransitionDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.RideStateTransitionUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.RideStateTransitionUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RideStateTransitionPayload>
          }
          aggregate: {
            args: Prisma.RideStateTransitionAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateRideStateTransition>
          }
          groupBy: {
            args: Prisma.RideStateTransitionGroupByArgs<ExtArgs>
            result: $Utils.Optional<RideStateTransitionGroupByOutputType>[]
          }
          count: {
            args: Prisma.RideStateTransitionCountArgs<ExtArgs>
            result: $Utils.Optional<RideStateTransitionCountAggregateOutputType> | number
          }
        }
      }
    }
  } & {
    other: {
      payload: any
      operations: {
        $executeRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $executeRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
        $queryRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $queryRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
      }
    }
  }
  export const defineExtension: $Extensions.ExtendsHook<"define", Prisma.TypeMapCb, $Extensions.DefaultArgs>
  export type DefaultPrismaClient = PrismaClient
  export type ErrorFormat = 'pretty' | 'colorless' | 'minimal'
  export interface PrismaClientOptions {
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasources?: Datasources
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasourceUrl?: string
    /**
     * @default "colorless"
     */
    errorFormat?: ErrorFormat
    /**
     * @example
     * ```
     * // Defaults to stdout
     * log: ['query', 'info', 'warn', 'error']
     * 
     * // Emit as events
     * log: [
     *   { emit: 'stdout', level: 'query' },
     *   { emit: 'stdout', level: 'info' },
     *   { emit: 'stdout', level: 'warn' }
     *   { emit: 'stdout', level: 'error' }
     * ]
     * ```
     * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/logging#the-log-option).
     */
    log?: (LogLevel | LogDefinition)[]
    /**
     * The default values for transactionOptions
     * maxWait ?= 2000
     * timeout ?= 5000
     */
    transactionOptions?: {
      maxWait?: number
      timeout?: number
      isolationLevel?: Prisma.TransactionIsolationLevel
    }
  }


  /* Types for Logging */
  export type LogLevel = 'info' | 'query' | 'warn' | 'error'
  export type LogDefinition = {
    level: LogLevel
    emit: 'stdout' | 'event'
  }

  export type GetLogType<T extends LogLevel | LogDefinition> = T extends LogDefinition ? T['emit'] extends 'event' ? T['level'] : never : never
  export type GetEvents<T extends any> = T extends Array<LogLevel | LogDefinition> ?
    GetLogType<T[0]> | GetLogType<T[1]> | GetLogType<T[2]> | GetLogType<T[3]>
    : never

  export type QueryEvent = {
    timestamp: Date
    query: string
    params: string
    duration: number
    target: string
  }

  export type LogEvent = {
    timestamp: Date
    message: string
    target: string
  }
  /* End Types for Logging */


  export type PrismaAction =
    | 'findUnique'
    | 'findUniqueOrThrow'
    | 'findMany'
    | 'findFirst'
    | 'findFirstOrThrow'
    | 'create'
    | 'createMany'
    | 'createManyAndReturn'
    | 'update'
    | 'updateMany'
    | 'upsert'
    | 'delete'
    | 'deleteMany'
    | 'executeRaw'
    | 'queryRaw'
    | 'aggregate'
    | 'count'
    | 'runCommandRaw'
    | 'findRaw'
    | 'groupBy'

  /**
   * These options are being passed into the middleware as "params"
   */
  export type MiddlewareParams = {
    model?: ModelName
    action: PrismaAction
    args: any
    dataPath: string[]
    runInTransaction: boolean
  }

  /**
   * The `T` type makes sure, that the `return proceed` is not forgotten in the middleware implementation
   */
  export type Middleware<T = any> = (
    params: MiddlewareParams,
    next: (params: MiddlewareParams) => $Utils.JsPromise<T>,
  ) => $Utils.JsPromise<T>

  // tested in getLogLevel.test.ts
  export function getLogLevel(log: Array<LogLevel | LogDefinition>): LogLevel | undefined;

  /**
   * `PrismaClient` proxy available in interactive transactions.
   */
  export type TransactionClient = Omit<Prisma.DefaultPrismaClient, runtime.ITXClientDenyList>

  export type Datasource = {
    url?: string
  }

  /**
   * Count Types
   */


  /**
   * Count Type RideCountOutputType
   */

  export type RideCountOutputType = {
    transitions: number
  }

  export type RideCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    transitions?: boolean | RideCountOutputTypeCountTransitionsArgs
  }

  // Custom InputTypes
  /**
   * RideCountOutputType without action
   */
  export type RideCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RideCountOutputType
     */
    select?: RideCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * RideCountOutputType without action
   */
  export type RideCountOutputTypeCountTransitionsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: RideStateTransitionWhereInput
  }


  /**
   * Models
   */

  /**
   * Model Ride
   */

  export type AggregateRide = {
    _count: RideCountAggregateOutputType | null
    _avg: RideAvgAggregateOutputType | null
    _sum: RideSumAggregateOutputType | null
    _min: RideMinAggregateOutputType | null
    _max: RideMaxAggregateOutputType | null
  }

  export type RideAvgAggregateOutputType = {
    pickupLat: number | null
    pickupLng: number | null
    dropoffLat: number | null
    dropoffLng: number | null
    distance: number | null
    duration: number | null
    fare: number | null
    surgeMultiplier: number | null
    reassignAttempts: number | null
  }

  export type RideSumAggregateOutputType = {
    pickupLat: number | null
    pickupLng: number | null
    dropoffLat: number | null
    dropoffLng: number | null
    distance: number | null
    duration: number | null
    fare: number | null
    surgeMultiplier: number | null
    reassignAttempts: number | null
  }

  export type RideMinAggregateOutputType = {
    id: string | null
    customerId: string | null
    driverId: string | null
    status: $Enums.RideStatus | null
    vehicleType: string | null
    paymentMethod: string | null
    pickupAddress: string | null
    pickupLat: number | null
    pickupLng: number | null
    dropoffAddress: string | null
    dropoffLat: number | null
    dropoffLng: number | null
    distance: number | null
    duration: number | null
    fare: number | null
    surgeMultiplier: number | null
    reassignAttempts: number | null
    acceptedDriverId: string | null
    requestedAt: Date | null
    pickupAt: Date | null
    offeredAt: Date | null
    assignedAt: Date | null
    acceptedAt: Date | null
    startedAt: Date | null
    completedAt: Date | null
    cancelledAt: Date | null
    cancelReason: string | null
    cancelledBy: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type RideMaxAggregateOutputType = {
    id: string | null
    customerId: string | null
    driverId: string | null
    status: $Enums.RideStatus | null
    vehicleType: string | null
    paymentMethod: string | null
    pickupAddress: string | null
    pickupLat: number | null
    pickupLng: number | null
    dropoffAddress: string | null
    dropoffLat: number | null
    dropoffLng: number | null
    distance: number | null
    duration: number | null
    fare: number | null
    surgeMultiplier: number | null
    reassignAttempts: number | null
    acceptedDriverId: string | null
    requestedAt: Date | null
    pickupAt: Date | null
    offeredAt: Date | null
    assignedAt: Date | null
    acceptedAt: Date | null
    startedAt: Date | null
    completedAt: Date | null
    cancelledAt: Date | null
    cancelReason: string | null
    cancelledBy: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type RideCountAggregateOutputType = {
    id: number
    customerId: number
    driverId: number
    status: number
    vehicleType: number
    paymentMethod: number
    pickupAddress: number
    pickupLat: number
    pickupLng: number
    dropoffAddress: number
    dropoffLat: number
    dropoffLng: number
    distance: number
    duration: number
    fare: number
    surgeMultiplier: number
    suggestedDriverIds: number
    offeredDriverIds: number
    rejectedDriverIds: number
    reassignAttempts: number
    acceptedDriverId: number
    requestedAt: number
    pickupAt: number
    offeredAt: number
    assignedAt: number
    acceptedAt: number
    startedAt: number
    completedAt: number
    cancelledAt: number
    cancelReason: number
    cancelledBy: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type RideAvgAggregateInputType = {
    pickupLat?: true
    pickupLng?: true
    dropoffLat?: true
    dropoffLng?: true
    distance?: true
    duration?: true
    fare?: true
    surgeMultiplier?: true
    reassignAttempts?: true
  }

  export type RideSumAggregateInputType = {
    pickupLat?: true
    pickupLng?: true
    dropoffLat?: true
    dropoffLng?: true
    distance?: true
    duration?: true
    fare?: true
    surgeMultiplier?: true
    reassignAttempts?: true
  }

  export type RideMinAggregateInputType = {
    id?: true
    customerId?: true
    driverId?: true
    status?: true
    vehicleType?: true
    paymentMethod?: true
    pickupAddress?: true
    pickupLat?: true
    pickupLng?: true
    dropoffAddress?: true
    dropoffLat?: true
    dropoffLng?: true
    distance?: true
    duration?: true
    fare?: true
    surgeMultiplier?: true
    reassignAttempts?: true
    acceptedDriverId?: true
    requestedAt?: true
    pickupAt?: true
    offeredAt?: true
    assignedAt?: true
    acceptedAt?: true
    startedAt?: true
    completedAt?: true
    cancelledAt?: true
    cancelReason?: true
    cancelledBy?: true
    createdAt?: true
    updatedAt?: true
  }

  export type RideMaxAggregateInputType = {
    id?: true
    customerId?: true
    driverId?: true
    status?: true
    vehicleType?: true
    paymentMethod?: true
    pickupAddress?: true
    pickupLat?: true
    pickupLng?: true
    dropoffAddress?: true
    dropoffLat?: true
    dropoffLng?: true
    distance?: true
    duration?: true
    fare?: true
    surgeMultiplier?: true
    reassignAttempts?: true
    acceptedDriverId?: true
    requestedAt?: true
    pickupAt?: true
    offeredAt?: true
    assignedAt?: true
    acceptedAt?: true
    startedAt?: true
    completedAt?: true
    cancelledAt?: true
    cancelReason?: true
    cancelledBy?: true
    createdAt?: true
    updatedAt?: true
  }

  export type RideCountAggregateInputType = {
    id?: true
    customerId?: true
    driverId?: true
    status?: true
    vehicleType?: true
    paymentMethod?: true
    pickupAddress?: true
    pickupLat?: true
    pickupLng?: true
    dropoffAddress?: true
    dropoffLat?: true
    dropoffLng?: true
    distance?: true
    duration?: true
    fare?: true
    surgeMultiplier?: true
    suggestedDriverIds?: true
    offeredDriverIds?: true
    rejectedDriverIds?: true
    reassignAttempts?: true
    acceptedDriverId?: true
    requestedAt?: true
    pickupAt?: true
    offeredAt?: true
    assignedAt?: true
    acceptedAt?: true
    startedAt?: true
    completedAt?: true
    cancelledAt?: true
    cancelReason?: true
    cancelledBy?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type RideAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Ride to aggregate.
     */
    where?: RideWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Rides to fetch.
     */
    orderBy?: RideOrderByWithRelationInput | RideOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: RideWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Rides from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Rides.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Rides
    **/
    _count?: true | RideCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: RideAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: RideSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: RideMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: RideMaxAggregateInputType
  }

  export type GetRideAggregateType<T extends RideAggregateArgs> = {
        [P in keyof T & keyof AggregateRide]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateRide[P]>
      : GetScalarType<T[P], AggregateRide[P]>
  }




  export type RideGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: RideWhereInput
    orderBy?: RideOrderByWithAggregationInput | RideOrderByWithAggregationInput[]
    by: RideScalarFieldEnum[] | RideScalarFieldEnum
    having?: RideScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: RideCountAggregateInputType | true
    _avg?: RideAvgAggregateInputType
    _sum?: RideSumAggregateInputType
    _min?: RideMinAggregateInputType
    _max?: RideMaxAggregateInputType
  }

  export type RideGroupByOutputType = {
    id: string
    customerId: string
    driverId: string | null
    status: $Enums.RideStatus
    vehicleType: string
    paymentMethod: string
    pickupAddress: string
    pickupLat: number
    pickupLng: number
    dropoffAddress: string
    dropoffLat: number
    dropoffLng: number
    distance: number | null
    duration: number | null
    fare: number | null
    surgeMultiplier: number
    suggestedDriverIds: string[]
    offeredDriverIds: string[]
    rejectedDriverIds: string[]
    reassignAttempts: number
    acceptedDriverId: string | null
    requestedAt: Date
    pickupAt: Date | null
    offeredAt: Date | null
    assignedAt: Date | null
    acceptedAt: Date | null
    startedAt: Date | null
    completedAt: Date | null
    cancelledAt: Date | null
    cancelReason: string | null
    cancelledBy: string | null
    createdAt: Date
    updatedAt: Date
    _count: RideCountAggregateOutputType | null
    _avg: RideAvgAggregateOutputType | null
    _sum: RideSumAggregateOutputType | null
    _min: RideMinAggregateOutputType | null
    _max: RideMaxAggregateOutputType | null
  }

  type GetRideGroupByPayload<T extends RideGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<RideGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof RideGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], RideGroupByOutputType[P]>
            : GetScalarType<T[P], RideGroupByOutputType[P]>
        }
      >
    >


  export type RideSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    customerId?: boolean
    driverId?: boolean
    status?: boolean
    vehicleType?: boolean
    paymentMethod?: boolean
    pickupAddress?: boolean
    pickupLat?: boolean
    pickupLng?: boolean
    dropoffAddress?: boolean
    dropoffLat?: boolean
    dropoffLng?: boolean
    distance?: boolean
    duration?: boolean
    fare?: boolean
    surgeMultiplier?: boolean
    suggestedDriverIds?: boolean
    offeredDriverIds?: boolean
    rejectedDriverIds?: boolean
    reassignAttempts?: boolean
    acceptedDriverId?: boolean
    requestedAt?: boolean
    pickupAt?: boolean
    offeredAt?: boolean
    assignedAt?: boolean
    acceptedAt?: boolean
    startedAt?: boolean
    completedAt?: boolean
    cancelledAt?: boolean
    cancelReason?: boolean
    cancelledBy?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    transitions?: boolean | Ride$transitionsArgs<ExtArgs>
    _count?: boolean | RideCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["ride"]>

  export type RideSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    customerId?: boolean
    driverId?: boolean
    status?: boolean
    vehicleType?: boolean
    paymentMethod?: boolean
    pickupAddress?: boolean
    pickupLat?: boolean
    pickupLng?: boolean
    dropoffAddress?: boolean
    dropoffLat?: boolean
    dropoffLng?: boolean
    distance?: boolean
    duration?: boolean
    fare?: boolean
    surgeMultiplier?: boolean
    suggestedDriverIds?: boolean
    offeredDriverIds?: boolean
    rejectedDriverIds?: boolean
    reassignAttempts?: boolean
    acceptedDriverId?: boolean
    requestedAt?: boolean
    pickupAt?: boolean
    offeredAt?: boolean
    assignedAt?: boolean
    acceptedAt?: boolean
    startedAt?: boolean
    completedAt?: boolean
    cancelledAt?: boolean
    cancelReason?: boolean
    cancelledBy?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["ride"]>

  export type RideSelectScalar = {
    id?: boolean
    customerId?: boolean
    driverId?: boolean
    status?: boolean
    vehicleType?: boolean
    paymentMethod?: boolean
    pickupAddress?: boolean
    pickupLat?: boolean
    pickupLng?: boolean
    dropoffAddress?: boolean
    dropoffLat?: boolean
    dropoffLng?: boolean
    distance?: boolean
    duration?: boolean
    fare?: boolean
    surgeMultiplier?: boolean
    suggestedDriverIds?: boolean
    offeredDriverIds?: boolean
    rejectedDriverIds?: boolean
    reassignAttempts?: boolean
    acceptedDriverId?: boolean
    requestedAt?: boolean
    pickupAt?: boolean
    offeredAt?: boolean
    assignedAt?: boolean
    acceptedAt?: boolean
    startedAt?: boolean
    completedAt?: boolean
    cancelledAt?: boolean
    cancelReason?: boolean
    cancelledBy?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type RideInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    transitions?: boolean | Ride$transitionsArgs<ExtArgs>
    _count?: boolean | RideCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type RideIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}

  export type $RidePayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Ride"
    objects: {
      transitions: Prisma.$RideStateTransitionPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      customerId: string
      driverId: string | null
      status: $Enums.RideStatus
      vehicleType: string
      paymentMethod: string
      pickupAddress: string
      pickupLat: number
      pickupLng: number
      dropoffAddress: string
      dropoffLat: number
      dropoffLng: number
      distance: number | null
      duration: number | null
      fare: number | null
      surgeMultiplier: number
      suggestedDriverIds: string[]
      offeredDriverIds: string[]
      rejectedDriverIds: string[]
      reassignAttempts: number
      acceptedDriverId: string | null
      requestedAt: Date
      pickupAt: Date | null
      offeredAt: Date | null
      assignedAt: Date | null
      acceptedAt: Date | null
      startedAt: Date | null
      completedAt: Date | null
      cancelledAt: Date | null
      cancelReason: string | null
      cancelledBy: string | null
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["ride"]>
    composites: {}
  }

  type RideGetPayload<S extends boolean | null | undefined | RideDefaultArgs> = $Result.GetResult<Prisma.$RidePayload, S>

  type RideCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<RideFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: RideCountAggregateInputType | true
    }

  export interface RideDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Ride'], meta: { name: 'Ride' } }
    /**
     * Find zero or one Ride that matches the filter.
     * @param {RideFindUniqueArgs} args - Arguments to find a Ride
     * @example
     * // Get one Ride
     * const ride = await prisma.ride.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends RideFindUniqueArgs>(args: SelectSubset<T, RideFindUniqueArgs<ExtArgs>>): Prisma__RideClient<$Result.GetResult<Prisma.$RidePayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one Ride that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {RideFindUniqueOrThrowArgs} args - Arguments to find a Ride
     * @example
     * // Get one Ride
     * const ride = await prisma.ride.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends RideFindUniqueOrThrowArgs>(args: SelectSubset<T, RideFindUniqueOrThrowArgs<ExtArgs>>): Prisma__RideClient<$Result.GetResult<Prisma.$RidePayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first Ride that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RideFindFirstArgs} args - Arguments to find a Ride
     * @example
     * // Get one Ride
     * const ride = await prisma.ride.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends RideFindFirstArgs>(args?: SelectSubset<T, RideFindFirstArgs<ExtArgs>>): Prisma__RideClient<$Result.GetResult<Prisma.$RidePayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first Ride that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RideFindFirstOrThrowArgs} args - Arguments to find a Ride
     * @example
     * // Get one Ride
     * const ride = await prisma.ride.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends RideFindFirstOrThrowArgs>(args?: SelectSubset<T, RideFindFirstOrThrowArgs<ExtArgs>>): Prisma__RideClient<$Result.GetResult<Prisma.$RidePayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more Rides that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RideFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Rides
     * const rides = await prisma.ride.findMany()
     * 
     * // Get first 10 Rides
     * const rides = await prisma.ride.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const rideWithIdOnly = await prisma.ride.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends RideFindManyArgs>(args?: SelectSubset<T, RideFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$RidePayload<ExtArgs>, T, "findMany">>

    /**
     * Create a Ride.
     * @param {RideCreateArgs} args - Arguments to create a Ride.
     * @example
     * // Create one Ride
     * const Ride = await prisma.ride.create({
     *   data: {
     *     // ... data to create a Ride
     *   }
     * })
     * 
     */
    create<T extends RideCreateArgs>(args: SelectSubset<T, RideCreateArgs<ExtArgs>>): Prisma__RideClient<$Result.GetResult<Prisma.$RidePayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many Rides.
     * @param {RideCreateManyArgs} args - Arguments to create many Rides.
     * @example
     * // Create many Rides
     * const ride = await prisma.ride.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends RideCreateManyArgs>(args?: SelectSubset<T, RideCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Rides and returns the data saved in the database.
     * @param {RideCreateManyAndReturnArgs} args - Arguments to create many Rides.
     * @example
     * // Create many Rides
     * const ride = await prisma.ride.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Rides and only return the `id`
     * const rideWithIdOnly = await prisma.ride.createManyAndReturn({ 
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends RideCreateManyAndReturnArgs>(args?: SelectSubset<T, RideCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$RidePayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a Ride.
     * @param {RideDeleteArgs} args - Arguments to delete one Ride.
     * @example
     * // Delete one Ride
     * const Ride = await prisma.ride.delete({
     *   where: {
     *     // ... filter to delete one Ride
     *   }
     * })
     * 
     */
    delete<T extends RideDeleteArgs>(args: SelectSubset<T, RideDeleteArgs<ExtArgs>>): Prisma__RideClient<$Result.GetResult<Prisma.$RidePayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one Ride.
     * @param {RideUpdateArgs} args - Arguments to update one Ride.
     * @example
     * // Update one Ride
     * const ride = await prisma.ride.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends RideUpdateArgs>(args: SelectSubset<T, RideUpdateArgs<ExtArgs>>): Prisma__RideClient<$Result.GetResult<Prisma.$RidePayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more Rides.
     * @param {RideDeleteManyArgs} args - Arguments to filter Rides to delete.
     * @example
     * // Delete a few Rides
     * const { count } = await prisma.ride.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends RideDeleteManyArgs>(args?: SelectSubset<T, RideDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Rides.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RideUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Rides
     * const ride = await prisma.ride.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends RideUpdateManyArgs>(args: SelectSubset<T, RideUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one Ride.
     * @param {RideUpsertArgs} args - Arguments to update or create a Ride.
     * @example
     * // Update or create a Ride
     * const ride = await prisma.ride.upsert({
     *   create: {
     *     // ... data to create a Ride
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Ride we want to update
     *   }
     * })
     */
    upsert<T extends RideUpsertArgs>(args: SelectSubset<T, RideUpsertArgs<ExtArgs>>): Prisma__RideClient<$Result.GetResult<Prisma.$RidePayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of Rides.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RideCountArgs} args - Arguments to filter Rides to count.
     * @example
     * // Count the number of Rides
     * const count = await prisma.ride.count({
     *   where: {
     *     // ... the filter for the Rides we want to count
     *   }
     * })
    **/
    count<T extends RideCountArgs>(
      args?: Subset<T, RideCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], RideCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Ride.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RideAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends RideAggregateArgs>(args: Subset<T, RideAggregateArgs>): Prisma.PrismaPromise<GetRideAggregateType<T>>

    /**
     * Group by Ride.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RideGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends RideGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: RideGroupByArgs['orderBy'] }
        : { orderBy?: RideGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, RideGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetRideGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Ride model
   */
  readonly fields: RideFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Ride.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__RideClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    transitions<T extends Ride$transitionsArgs<ExtArgs> = {}>(args?: Subset<T, Ride$transitionsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$RideStateTransitionPayload<ExtArgs>, T, "findMany"> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Ride model
   */ 
  interface RideFieldRefs {
    readonly id: FieldRef<"Ride", 'String'>
    readonly customerId: FieldRef<"Ride", 'String'>
    readonly driverId: FieldRef<"Ride", 'String'>
    readonly status: FieldRef<"Ride", 'RideStatus'>
    readonly vehicleType: FieldRef<"Ride", 'String'>
    readonly paymentMethod: FieldRef<"Ride", 'String'>
    readonly pickupAddress: FieldRef<"Ride", 'String'>
    readonly pickupLat: FieldRef<"Ride", 'Float'>
    readonly pickupLng: FieldRef<"Ride", 'Float'>
    readonly dropoffAddress: FieldRef<"Ride", 'String'>
    readonly dropoffLat: FieldRef<"Ride", 'Float'>
    readonly dropoffLng: FieldRef<"Ride", 'Float'>
    readonly distance: FieldRef<"Ride", 'Float'>
    readonly duration: FieldRef<"Ride", 'Int'>
    readonly fare: FieldRef<"Ride", 'Float'>
    readonly surgeMultiplier: FieldRef<"Ride", 'Float'>
    readonly suggestedDriverIds: FieldRef<"Ride", 'String[]'>
    readonly offeredDriverIds: FieldRef<"Ride", 'String[]'>
    readonly rejectedDriverIds: FieldRef<"Ride", 'String[]'>
    readonly reassignAttempts: FieldRef<"Ride", 'Int'>
    readonly acceptedDriverId: FieldRef<"Ride", 'String'>
    readonly requestedAt: FieldRef<"Ride", 'DateTime'>
    readonly pickupAt: FieldRef<"Ride", 'DateTime'>
    readonly offeredAt: FieldRef<"Ride", 'DateTime'>
    readonly assignedAt: FieldRef<"Ride", 'DateTime'>
    readonly acceptedAt: FieldRef<"Ride", 'DateTime'>
    readonly startedAt: FieldRef<"Ride", 'DateTime'>
    readonly completedAt: FieldRef<"Ride", 'DateTime'>
    readonly cancelledAt: FieldRef<"Ride", 'DateTime'>
    readonly cancelReason: FieldRef<"Ride", 'String'>
    readonly cancelledBy: FieldRef<"Ride", 'String'>
    readonly createdAt: FieldRef<"Ride", 'DateTime'>
    readonly updatedAt: FieldRef<"Ride", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * Ride findUnique
   */
  export type RideFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Ride
     */
    select?: RideSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RideInclude<ExtArgs> | null
    /**
     * Filter, which Ride to fetch.
     */
    where: RideWhereUniqueInput
  }

  /**
   * Ride findUniqueOrThrow
   */
  export type RideFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Ride
     */
    select?: RideSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RideInclude<ExtArgs> | null
    /**
     * Filter, which Ride to fetch.
     */
    where: RideWhereUniqueInput
  }

  /**
   * Ride findFirst
   */
  export type RideFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Ride
     */
    select?: RideSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RideInclude<ExtArgs> | null
    /**
     * Filter, which Ride to fetch.
     */
    where?: RideWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Rides to fetch.
     */
    orderBy?: RideOrderByWithRelationInput | RideOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Rides.
     */
    cursor?: RideWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Rides from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Rides.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Rides.
     */
    distinct?: RideScalarFieldEnum | RideScalarFieldEnum[]
  }

  /**
   * Ride findFirstOrThrow
   */
  export type RideFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Ride
     */
    select?: RideSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RideInclude<ExtArgs> | null
    /**
     * Filter, which Ride to fetch.
     */
    where?: RideWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Rides to fetch.
     */
    orderBy?: RideOrderByWithRelationInput | RideOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Rides.
     */
    cursor?: RideWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Rides from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Rides.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Rides.
     */
    distinct?: RideScalarFieldEnum | RideScalarFieldEnum[]
  }

  /**
   * Ride findMany
   */
  export type RideFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Ride
     */
    select?: RideSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RideInclude<ExtArgs> | null
    /**
     * Filter, which Rides to fetch.
     */
    where?: RideWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Rides to fetch.
     */
    orderBy?: RideOrderByWithRelationInput | RideOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Rides.
     */
    cursor?: RideWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Rides from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Rides.
     */
    skip?: number
    distinct?: RideScalarFieldEnum | RideScalarFieldEnum[]
  }

  /**
   * Ride create
   */
  export type RideCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Ride
     */
    select?: RideSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RideInclude<ExtArgs> | null
    /**
     * The data needed to create a Ride.
     */
    data: XOR<RideCreateInput, RideUncheckedCreateInput>
  }

  /**
   * Ride createMany
   */
  export type RideCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Rides.
     */
    data: RideCreateManyInput | RideCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Ride createManyAndReturn
   */
  export type RideCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Ride
     */
    select?: RideSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many Rides.
     */
    data: RideCreateManyInput | RideCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Ride update
   */
  export type RideUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Ride
     */
    select?: RideSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RideInclude<ExtArgs> | null
    /**
     * The data needed to update a Ride.
     */
    data: XOR<RideUpdateInput, RideUncheckedUpdateInput>
    /**
     * Choose, which Ride to update.
     */
    where: RideWhereUniqueInput
  }

  /**
   * Ride updateMany
   */
  export type RideUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Rides.
     */
    data: XOR<RideUpdateManyMutationInput, RideUncheckedUpdateManyInput>
    /**
     * Filter which Rides to update
     */
    where?: RideWhereInput
  }

  /**
   * Ride upsert
   */
  export type RideUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Ride
     */
    select?: RideSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RideInclude<ExtArgs> | null
    /**
     * The filter to search for the Ride to update in case it exists.
     */
    where: RideWhereUniqueInput
    /**
     * In case the Ride found by the `where` argument doesn't exist, create a new Ride with this data.
     */
    create: XOR<RideCreateInput, RideUncheckedCreateInput>
    /**
     * In case the Ride was found with the provided `where` argument, update it with this data.
     */
    update: XOR<RideUpdateInput, RideUncheckedUpdateInput>
  }

  /**
   * Ride delete
   */
  export type RideDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Ride
     */
    select?: RideSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RideInclude<ExtArgs> | null
    /**
     * Filter which Ride to delete.
     */
    where: RideWhereUniqueInput
  }

  /**
   * Ride deleteMany
   */
  export type RideDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Rides to delete
     */
    where?: RideWhereInput
  }

  /**
   * Ride.transitions
   */
  export type Ride$transitionsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RideStateTransition
     */
    select?: RideStateTransitionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RideStateTransitionInclude<ExtArgs> | null
    where?: RideStateTransitionWhereInput
    orderBy?: RideStateTransitionOrderByWithRelationInput | RideStateTransitionOrderByWithRelationInput[]
    cursor?: RideStateTransitionWhereUniqueInput
    take?: number
    skip?: number
    distinct?: RideStateTransitionScalarFieldEnum | RideStateTransitionScalarFieldEnum[]
  }

  /**
   * Ride without action
   */
  export type RideDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Ride
     */
    select?: RideSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RideInclude<ExtArgs> | null
  }


  /**
   * Model RideStateTransition
   */

  export type AggregateRideStateTransition = {
    _count: RideStateTransitionCountAggregateOutputType | null
    _min: RideStateTransitionMinAggregateOutputType | null
    _max: RideStateTransitionMaxAggregateOutputType | null
  }

  export type RideStateTransitionMinAggregateOutputType = {
    id: string | null
    rideId: string | null
    fromStatus: $Enums.RideStatus | null
    toStatus: $Enums.RideStatus | null
    actorId: string | null
    actorType: string | null
    reason: string | null
    occurredAt: Date | null
  }

  export type RideStateTransitionMaxAggregateOutputType = {
    id: string | null
    rideId: string | null
    fromStatus: $Enums.RideStatus | null
    toStatus: $Enums.RideStatus | null
    actorId: string | null
    actorType: string | null
    reason: string | null
    occurredAt: Date | null
  }

  export type RideStateTransitionCountAggregateOutputType = {
    id: number
    rideId: number
    fromStatus: number
    toStatus: number
    actorId: number
    actorType: number
    reason: number
    occurredAt: number
    _all: number
  }


  export type RideStateTransitionMinAggregateInputType = {
    id?: true
    rideId?: true
    fromStatus?: true
    toStatus?: true
    actorId?: true
    actorType?: true
    reason?: true
    occurredAt?: true
  }

  export type RideStateTransitionMaxAggregateInputType = {
    id?: true
    rideId?: true
    fromStatus?: true
    toStatus?: true
    actorId?: true
    actorType?: true
    reason?: true
    occurredAt?: true
  }

  export type RideStateTransitionCountAggregateInputType = {
    id?: true
    rideId?: true
    fromStatus?: true
    toStatus?: true
    actorId?: true
    actorType?: true
    reason?: true
    occurredAt?: true
    _all?: true
  }

  export type RideStateTransitionAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which RideStateTransition to aggregate.
     */
    where?: RideStateTransitionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of RideStateTransitions to fetch.
     */
    orderBy?: RideStateTransitionOrderByWithRelationInput | RideStateTransitionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: RideStateTransitionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` RideStateTransitions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` RideStateTransitions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned RideStateTransitions
    **/
    _count?: true | RideStateTransitionCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: RideStateTransitionMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: RideStateTransitionMaxAggregateInputType
  }

  export type GetRideStateTransitionAggregateType<T extends RideStateTransitionAggregateArgs> = {
        [P in keyof T & keyof AggregateRideStateTransition]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateRideStateTransition[P]>
      : GetScalarType<T[P], AggregateRideStateTransition[P]>
  }




  export type RideStateTransitionGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: RideStateTransitionWhereInput
    orderBy?: RideStateTransitionOrderByWithAggregationInput | RideStateTransitionOrderByWithAggregationInput[]
    by: RideStateTransitionScalarFieldEnum[] | RideStateTransitionScalarFieldEnum
    having?: RideStateTransitionScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: RideStateTransitionCountAggregateInputType | true
    _min?: RideStateTransitionMinAggregateInputType
    _max?: RideStateTransitionMaxAggregateInputType
  }

  export type RideStateTransitionGroupByOutputType = {
    id: string
    rideId: string
    fromStatus: $Enums.RideStatus | null
    toStatus: $Enums.RideStatus
    actorId: string | null
    actorType: string | null
    reason: string | null
    occurredAt: Date
    _count: RideStateTransitionCountAggregateOutputType | null
    _min: RideStateTransitionMinAggregateOutputType | null
    _max: RideStateTransitionMaxAggregateOutputType | null
  }

  type GetRideStateTransitionGroupByPayload<T extends RideStateTransitionGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<RideStateTransitionGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof RideStateTransitionGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], RideStateTransitionGroupByOutputType[P]>
            : GetScalarType<T[P], RideStateTransitionGroupByOutputType[P]>
        }
      >
    >


  export type RideStateTransitionSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    rideId?: boolean
    fromStatus?: boolean
    toStatus?: boolean
    actorId?: boolean
    actorType?: boolean
    reason?: boolean
    occurredAt?: boolean
    ride?: boolean | RideDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["rideStateTransition"]>

  export type RideStateTransitionSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    rideId?: boolean
    fromStatus?: boolean
    toStatus?: boolean
    actorId?: boolean
    actorType?: boolean
    reason?: boolean
    occurredAt?: boolean
    ride?: boolean | RideDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["rideStateTransition"]>

  export type RideStateTransitionSelectScalar = {
    id?: boolean
    rideId?: boolean
    fromStatus?: boolean
    toStatus?: boolean
    actorId?: boolean
    actorType?: boolean
    reason?: boolean
    occurredAt?: boolean
  }

  export type RideStateTransitionInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    ride?: boolean | RideDefaultArgs<ExtArgs>
  }
  export type RideStateTransitionIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    ride?: boolean | RideDefaultArgs<ExtArgs>
  }

  export type $RideStateTransitionPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "RideStateTransition"
    objects: {
      ride: Prisma.$RidePayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      rideId: string
      fromStatus: $Enums.RideStatus | null
      toStatus: $Enums.RideStatus
      actorId: string | null
      actorType: string | null
      reason: string | null
      occurredAt: Date
    }, ExtArgs["result"]["rideStateTransition"]>
    composites: {}
  }

  type RideStateTransitionGetPayload<S extends boolean | null | undefined | RideStateTransitionDefaultArgs> = $Result.GetResult<Prisma.$RideStateTransitionPayload, S>

  type RideStateTransitionCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<RideStateTransitionFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: RideStateTransitionCountAggregateInputType | true
    }

  export interface RideStateTransitionDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['RideStateTransition'], meta: { name: 'RideStateTransition' } }
    /**
     * Find zero or one RideStateTransition that matches the filter.
     * @param {RideStateTransitionFindUniqueArgs} args - Arguments to find a RideStateTransition
     * @example
     * // Get one RideStateTransition
     * const rideStateTransition = await prisma.rideStateTransition.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends RideStateTransitionFindUniqueArgs>(args: SelectSubset<T, RideStateTransitionFindUniqueArgs<ExtArgs>>): Prisma__RideStateTransitionClient<$Result.GetResult<Prisma.$RideStateTransitionPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one RideStateTransition that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {RideStateTransitionFindUniqueOrThrowArgs} args - Arguments to find a RideStateTransition
     * @example
     * // Get one RideStateTransition
     * const rideStateTransition = await prisma.rideStateTransition.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends RideStateTransitionFindUniqueOrThrowArgs>(args: SelectSubset<T, RideStateTransitionFindUniqueOrThrowArgs<ExtArgs>>): Prisma__RideStateTransitionClient<$Result.GetResult<Prisma.$RideStateTransitionPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first RideStateTransition that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RideStateTransitionFindFirstArgs} args - Arguments to find a RideStateTransition
     * @example
     * // Get one RideStateTransition
     * const rideStateTransition = await prisma.rideStateTransition.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends RideStateTransitionFindFirstArgs>(args?: SelectSubset<T, RideStateTransitionFindFirstArgs<ExtArgs>>): Prisma__RideStateTransitionClient<$Result.GetResult<Prisma.$RideStateTransitionPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first RideStateTransition that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RideStateTransitionFindFirstOrThrowArgs} args - Arguments to find a RideStateTransition
     * @example
     * // Get one RideStateTransition
     * const rideStateTransition = await prisma.rideStateTransition.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends RideStateTransitionFindFirstOrThrowArgs>(args?: SelectSubset<T, RideStateTransitionFindFirstOrThrowArgs<ExtArgs>>): Prisma__RideStateTransitionClient<$Result.GetResult<Prisma.$RideStateTransitionPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more RideStateTransitions that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RideStateTransitionFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all RideStateTransitions
     * const rideStateTransitions = await prisma.rideStateTransition.findMany()
     * 
     * // Get first 10 RideStateTransitions
     * const rideStateTransitions = await prisma.rideStateTransition.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const rideStateTransitionWithIdOnly = await prisma.rideStateTransition.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends RideStateTransitionFindManyArgs>(args?: SelectSubset<T, RideStateTransitionFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$RideStateTransitionPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a RideStateTransition.
     * @param {RideStateTransitionCreateArgs} args - Arguments to create a RideStateTransition.
     * @example
     * // Create one RideStateTransition
     * const RideStateTransition = await prisma.rideStateTransition.create({
     *   data: {
     *     // ... data to create a RideStateTransition
     *   }
     * })
     * 
     */
    create<T extends RideStateTransitionCreateArgs>(args: SelectSubset<T, RideStateTransitionCreateArgs<ExtArgs>>): Prisma__RideStateTransitionClient<$Result.GetResult<Prisma.$RideStateTransitionPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many RideStateTransitions.
     * @param {RideStateTransitionCreateManyArgs} args - Arguments to create many RideStateTransitions.
     * @example
     * // Create many RideStateTransitions
     * const rideStateTransition = await prisma.rideStateTransition.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends RideStateTransitionCreateManyArgs>(args?: SelectSubset<T, RideStateTransitionCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many RideStateTransitions and returns the data saved in the database.
     * @param {RideStateTransitionCreateManyAndReturnArgs} args - Arguments to create many RideStateTransitions.
     * @example
     * // Create many RideStateTransitions
     * const rideStateTransition = await prisma.rideStateTransition.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many RideStateTransitions and only return the `id`
     * const rideStateTransitionWithIdOnly = await prisma.rideStateTransition.createManyAndReturn({ 
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends RideStateTransitionCreateManyAndReturnArgs>(args?: SelectSubset<T, RideStateTransitionCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$RideStateTransitionPayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a RideStateTransition.
     * @param {RideStateTransitionDeleteArgs} args - Arguments to delete one RideStateTransition.
     * @example
     * // Delete one RideStateTransition
     * const RideStateTransition = await prisma.rideStateTransition.delete({
     *   where: {
     *     // ... filter to delete one RideStateTransition
     *   }
     * })
     * 
     */
    delete<T extends RideStateTransitionDeleteArgs>(args: SelectSubset<T, RideStateTransitionDeleteArgs<ExtArgs>>): Prisma__RideStateTransitionClient<$Result.GetResult<Prisma.$RideStateTransitionPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one RideStateTransition.
     * @param {RideStateTransitionUpdateArgs} args - Arguments to update one RideStateTransition.
     * @example
     * // Update one RideStateTransition
     * const rideStateTransition = await prisma.rideStateTransition.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends RideStateTransitionUpdateArgs>(args: SelectSubset<T, RideStateTransitionUpdateArgs<ExtArgs>>): Prisma__RideStateTransitionClient<$Result.GetResult<Prisma.$RideStateTransitionPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more RideStateTransitions.
     * @param {RideStateTransitionDeleteManyArgs} args - Arguments to filter RideStateTransitions to delete.
     * @example
     * // Delete a few RideStateTransitions
     * const { count } = await prisma.rideStateTransition.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends RideStateTransitionDeleteManyArgs>(args?: SelectSubset<T, RideStateTransitionDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more RideStateTransitions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RideStateTransitionUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many RideStateTransitions
     * const rideStateTransition = await prisma.rideStateTransition.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends RideStateTransitionUpdateManyArgs>(args: SelectSubset<T, RideStateTransitionUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one RideStateTransition.
     * @param {RideStateTransitionUpsertArgs} args - Arguments to update or create a RideStateTransition.
     * @example
     * // Update or create a RideStateTransition
     * const rideStateTransition = await prisma.rideStateTransition.upsert({
     *   create: {
     *     // ... data to create a RideStateTransition
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the RideStateTransition we want to update
     *   }
     * })
     */
    upsert<T extends RideStateTransitionUpsertArgs>(args: SelectSubset<T, RideStateTransitionUpsertArgs<ExtArgs>>): Prisma__RideStateTransitionClient<$Result.GetResult<Prisma.$RideStateTransitionPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of RideStateTransitions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RideStateTransitionCountArgs} args - Arguments to filter RideStateTransitions to count.
     * @example
     * // Count the number of RideStateTransitions
     * const count = await prisma.rideStateTransition.count({
     *   where: {
     *     // ... the filter for the RideStateTransitions we want to count
     *   }
     * })
    **/
    count<T extends RideStateTransitionCountArgs>(
      args?: Subset<T, RideStateTransitionCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], RideStateTransitionCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a RideStateTransition.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RideStateTransitionAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends RideStateTransitionAggregateArgs>(args: Subset<T, RideStateTransitionAggregateArgs>): Prisma.PrismaPromise<GetRideStateTransitionAggregateType<T>>

    /**
     * Group by RideStateTransition.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RideStateTransitionGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends RideStateTransitionGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: RideStateTransitionGroupByArgs['orderBy'] }
        : { orderBy?: RideStateTransitionGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, RideStateTransitionGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetRideStateTransitionGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the RideStateTransition model
   */
  readonly fields: RideStateTransitionFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for RideStateTransition.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__RideStateTransitionClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    ride<T extends RideDefaultArgs<ExtArgs> = {}>(args?: Subset<T, RideDefaultArgs<ExtArgs>>): Prisma__RideClient<$Result.GetResult<Prisma.$RidePayload<ExtArgs>, T, "findUniqueOrThrow"> | Null, Null, ExtArgs>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the RideStateTransition model
   */ 
  interface RideStateTransitionFieldRefs {
    readonly id: FieldRef<"RideStateTransition", 'String'>
    readonly rideId: FieldRef<"RideStateTransition", 'String'>
    readonly fromStatus: FieldRef<"RideStateTransition", 'RideStatus'>
    readonly toStatus: FieldRef<"RideStateTransition", 'RideStatus'>
    readonly actorId: FieldRef<"RideStateTransition", 'String'>
    readonly actorType: FieldRef<"RideStateTransition", 'String'>
    readonly reason: FieldRef<"RideStateTransition", 'String'>
    readonly occurredAt: FieldRef<"RideStateTransition", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * RideStateTransition findUnique
   */
  export type RideStateTransitionFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RideStateTransition
     */
    select?: RideStateTransitionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RideStateTransitionInclude<ExtArgs> | null
    /**
     * Filter, which RideStateTransition to fetch.
     */
    where: RideStateTransitionWhereUniqueInput
  }

  /**
   * RideStateTransition findUniqueOrThrow
   */
  export type RideStateTransitionFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RideStateTransition
     */
    select?: RideStateTransitionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RideStateTransitionInclude<ExtArgs> | null
    /**
     * Filter, which RideStateTransition to fetch.
     */
    where: RideStateTransitionWhereUniqueInput
  }

  /**
   * RideStateTransition findFirst
   */
  export type RideStateTransitionFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RideStateTransition
     */
    select?: RideStateTransitionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RideStateTransitionInclude<ExtArgs> | null
    /**
     * Filter, which RideStateTransition to fetch.
     */
    where?: RideStateTransitionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of RideStateTransitions to fetch.
     */
    orderBy?: RideStateTransitionOrderByWithRelationInput | RideStateTransitionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for RideStateTransitions.
     */
    cursor?: RideStateTransitionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` RideStateTransitions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` RideStateTransitions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of RideStateTransitions.
     */
    distinct?: RideStateTransitionScalarFieldEnum | RideStateTransitionScalarFieldEnum[]
  }

  /**
   * RideStateTransition findFirstOrThrow
   */
  export type RideStateTransitionFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RideStateTransition
     */
    select?: RideStateTransitionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RideStateTransitionInclude<ExtArgs> | null
    /**
     * Filter, which RideStateTransition to fetch.
     */
    where?: RideStateTransitionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of RideStateTransitions to fetch.
     */
    orderBy?: RideStateTransitionOrderByWithRelationInput | RideStateTransitionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for RideStateTransitions.
     */
    cursor?: RideStateTransitionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` RideStateTransitions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` RideStateTransitions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of RideStateTransitions.
     */
    distinct?: RideStateTransitionScalarFieldEnum | RideStateTransitionScalarFieldEnum[]
  }

  /**
   * RideStateTransition findMany
   */
  export type RideStateTransitionFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RideStateTransition
     */
    select?: RideStateTransitionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RideStateTransitionInclude<ExtArgs> | null
    /**
     * Filter, which RideStateTransitions to fetch.
     */
    where?: RideStateTransitionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of RideStateTransitions to fetch.
     */
    orderBy?: RideStateTransitionOrderByWithRelationInput | RideStateTransitionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing RideStateTransitions.
     */
    cursor?: RideStateTransitionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` RideStateTransitions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` RideStateTransitions.
     */
    skip?: number
    distinct?: RideStateTransitionScalarFieldEnum | RideStateTransitionScalarFieldEnum[]
  }

  /**
   * RideStateTransition create
   */
  export type RideStateTransitionCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RideStateTransition
     */
    select?: RideStateTransitionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RideStateTransitionInclude<ExtArgs> | null
    /**
     * The data needed to create a RideStateTransition.
     */
    data: XOR<RideStateTransitionCreateInput, RideStateTransitionUncheckedCreateInput>
  }

  /**
   * RideStateTransition createMany
   */
  export type RideStateTransitionCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many RideStateTransitions.
     */
    data: RideStateTransitionCreateManyInput | RideStateTransitionCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * RideStateTransition createManyAndReturn
   */
  export type RideStateTransitionCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RideStateTransition
     */
    select?: RideStateTransitionSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many RideStateTransitions.
     */
    data: RideStateTransitionCreateManyInput | RideStateTransitionCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RideStateTransitionIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * RideStateTransition update
   */
  export type RideStateTransitionUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RideStateTransition
     */
    select?: RideStateTransitionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RideStateTransitionInclude<ExtArgs> | null
    /**
     * The data needed to update a RideStateTransition.
     */
    data: XOR<RideStateTransitionUpdateInput, RideStateTransitionUncheckedUpdateInput>
    /**
     * Choose, which RideStateTransition to update.
     */
    where: RideStateTransitionWhereUniqueInput
  }

  /**
   * RideStateTransition updateMany
   */
  export type RideStateTransitionUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update RideStateTransitions.
     */
    data: XOR<RideStateTransitionUpdateManyMutationInput, RideStateTransitionUncheckedUpdateManyInput>
    /**
     * Filter which RideStateTransitions to update
     */
    where?: RideStateTransitionWhereInput
  }

  /**
   * RideStateTransition upsert
   */
  export type RideStateTransitionUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RideStateTransition
     */
    select?: RideStateTransitionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RideStateTransitionInclude<ExtArgs> | null
    /**
     * The filter to search for the RideStateTransition to update in case it exists.
     */
    where: RideStateTransitionWhereUniqueInput
    /**
     * In case the RideStateTransition found by the `where` argument doesn't exist, create a new RideStateTransition with this data.
     */
    create: XOR<RideStateTransitionCreateInput, RideStateTransitionUncheckedCreateInput>
    /**
     * In case the RideStateTransition was found with the provided `where` argument, update it with this data.
     */
    update: XOR<RideStateTransitionUpdateInput, RideStateTransitionUncheckedUpdateInput>
  }

  /**
   * RideStateTransition delete
   */
  export type RideStateTransitionDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RideStateTransition
     */
    select?: RideStateTransitionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RideStateTransitionInclude<ExtArgs> | null
    /**
     * Filter which RideStateTransition to delete.
     */
    where: RideStateTransitionWhereUniqueInput
  }

  /**
   * RideStateTransition deleteMany
   */
  export type RideStateTransitionDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which RideStateTransitions to delete
     */
    where?: RideStateTransitionWhereInput
  }

  /**
   * RideStateTransition without action
   */
  export type RideStateTransitionDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RideStateTransition
     */
    select?: RideStateTransitionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RideStateTransitionInclude<ExtArgs> | null
  }


  /**
   * Enums
   */

  export const TransactionIsolationLevel: {
    ReadUncommitted: 'ReadUncommitted',
    ReadCommitted: 'ReadCommitted',
    RepeatableRead: 'RepeatableRead',
    Serializable: 'Serializable'
  };

  export type TransactionIsolationLevel = (typeof TransactionIsolationLevel)[keyof typeof TransactionIsolationLevel]


  export const RideScalarFieldEnum: {
    id: 'id',
    customerId: 'customerId',
    driverId: 'driverId',
    status: 'status',
    vehicleType: 'vehicleType',
    paymentMethod: 'paymentMethod',
    pickupAddress: 'pickupAddress',
    pickupLat: 'pickupLat',
    pickupLng: 'pickupLng',
    dropoffAddress: 'dropoffAddress',
    dropoffLat: 'dropoffLat',
    dropoffLng: 'dropoffLng',
    distance: 'distance',
    duration: 'duration',
    fare: 'fare',
    surgeMultiplier: 'surgeMultiplier',
    suggestedDriverIds: 'suggestedDriverIds',
    offeredDriverIds: 'offeredDriverIds',
    rejectedDriverIds: 'rejectedDriverIds',
    reassignAttempts: 'reassignAttempts',
    acceptedDriverId: 'acceptedDriverId',
    requestedAt: 'requestedAt',
    pickupAt: 'pickupAt',
    offeredAt: 'offeredAt',
    assignedAt: 'assignedAt',
    acceptedAt: 'acceptedAt',
    startedAt: 'startedAt',
    completedAt: 'completedAt',
    cancelledAt: 'cancelledAt',
    cancelReason: 'cancelReason',
    cancelledBy: 'cancelledBy',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type RideScalarFieldEnum = (typeof RideScalarFieldEnum)[keyof typeof RideScalarFieldEnum]


  export const RideStateTransitionScalarFieldEnum: {
    id: 'id',
    rideId: 'rideId',
    fromStatus: 'fromStatus',
    toStatus: 'toStatus',
    actorId: 'actorId',
    actorType: 'actorType',
    reason: 'reason',
    occurredAt: 'occurredAt'
  };

  export type RideStateTransitionScalarFieldEnum = (typeof RideStateTransitionScalarFieldEnum)[keyof typeof RideStateTransitionScalarFieldEnum]


  export const SortOrder: {
    asc: 'asc',
    desc: 'desc'
  };

  export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder]


  export const QueryMode: {
    default: 'default',
    insensitive: 'insensitive'
  };

  export type QueryMode = (typeof QueryMode)[keyof typeof QueryMode]


  export const NullsOrder: {
    first: 'first',
    last: 'last'
  };

  export type NullsOrder = (typeof NullsOrder)[keyof typeof NullsOrder]


  /**
   * Field references 
   */


  /**
   * Reference to a field of type 'String'
   */
  export type StringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String'>
    


  /**
   * Reference to a field of type 'String[]'
   */
  export type ListStringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String[]'>
    


  /**
   * Reference to a field of type 'RideStatus'
   */
  export type EnumRideStatusFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'RideStatus'>
    


  /**
   * Reference to a field of type 'RideStatus[]'
   */
  export type ListEnumRideStatusFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'RideStatus[]'>
    


  /**
   * Reference to a field of type 'Float'
   */
  export type FloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float'>
    


  /**
   * Reference to a field of type 'Float[]'
   */
  export type ListFloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float[]'>
    


  /**
   * Reference to a field of type 'Int'
   */
  export type IntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int'>
    


  /**
   * Reference to a field of type 'Int[]'
   */
  export type ListIntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int[]'>
    


  /**
   * Reference to a field of type 'DateTime'
   */
  export type DateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime'>
    


  /**
   * Reference to a field of type 'DateTime[]'
   */
  export type ListDateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime[]'>
    
  /**
   * Deep Input Types
   */


  export type RideWhereInput = {
    AND?: RideWhereInput | RideWhereInput[]
    OR?: RideWhereInput[]
    NOT?: RideWhereInput | RideWhereInput[]
    id?: StringFilter<"Ride"> | string
    customerId?: StringFilter<"Ride"> | string
    driverId?: StringNullableFilter<"Ride"> | string | null
    status?: EnumRideStatusFilter<"Ride"> | $Enums.RideStatus
    vehicleType?: StringFilter<"Ride"> | string
    paymentMethod?: StringFilter<"Ride"> | string
    pickupAddress?: StringFilter<"Ride"> | string
    pickupLat?: FloatFilter<"Ride"> | number
    pickupLng?: FloatFilter<"Ride"> | number
    dropoffAddress?: StringFilter<"Ride"> | string
    dropoffLat?: FloatFilter<"Ride"> | number
    dropoffLng?: FloatFilter<"Ride"> | number
    distance?: FloatNullableFilter<"Ride"> | number | null
    duration?: IntNullableFilter<"Ride"> | number | null
    fare?: FloatNullableFilter<"Ride"> | number | null
    surgeMultiplier?: FloatFilter<"Ride"> | number
    suggestedDriverIds?: StringNullableListFilter<"Ride">
    offeredDriverIds?: StringNullableListFilter<"Ride">
    rejectedDriverIds?: StringNullableListFilter<"Ride">
    reassignAttempts?: IntFilter<"Ride"> | number
    acceptedDriverId?: StringNullableFilter<"Ride"> | string | null
    requestedAt?: DateTimeFilter<"Ride"> | Date | string
    pickupAt?: DateTimeNullableFilter<"Ride"> | Date | string | null
    offeredAt?: DateTimeNullableFilter<"Ride"> | Date | string | null
    assignedAt?: DateTimeNullableFilter<"Ride"> | Date | string | null
    acceptedAt?: DateTimeNullableFilter<"Ride"> | Date | string | null
    startedAt?: DateTimeNullableFilter<"Ride"> | Date | string | null
    completedAt?: DateTimeNullableFilter<"Ride"> | Date | string | null
    cancelledAt?: DateTimeNullableFilter<"Ride"> | Date | string | null
    cancelReason?: StringNullableFilter<"Ride"> | string | null
    cancelledBy?: StringNullableFilter<"Ride"> | string | null
    createdAt?: DateTimeFilter<"Ride"> | Date | string
    updatedAt?: DateTimeFilter<"Ride"> | Date | string
    transitions?: RideStateTransitionListRelationFilter
  }

  export type RideOrderByWithRelationInput = {
    id?: SortOrder
    customerId?: SortOrder
    driverId?: SortOrderInput | SortOrder
    status?: SortOrder
    vehicleType?: SortOrder
    paymentMethod?: SortOrder
    pickupAddress?: SortOrder
    pickupLat?: SortOrder
    pickupLng?: SortOrder
    dropoffAddress?: SortOrder
    dropoffLat?: SortOrder
    dropoffLng?: SortOrder
    distance?: SortOrderInput | SortOrder
    duration?: SortOrderInput | SortOrder
    fare?: SortOrderInput | SortOrder
    surgeMultiplier?: SortOrder
    suggestedDriverIds?: SortOrder
    offeredDriverIds?: SortOrder
    rejectedDriverIds?: SortOrder
    reassignAttempts?: SortOrder
    acceptedDriverId?: SortOrderInput | SortOrder
    requestedAt?: SortOrder
    pickupAt?: SortOrderInput | SortOrder
    offeredAt?: SortOrderInput | SortOrder
    assignedAt?: SortOrderInput | SortOrder
    acceptedAt?: SortOrderInput | SortOrder
    startedAt?: SortOrderInput | SortOrder
    completedAt?: SortOrderInput | SortOrder
    cancelledAt?: SortOrderInput | SortOrder
    cancelReason?: SortOrderInput | SortOrder
    cancelledBy?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    transitions?: RideStateTransitionOrderByRelationAggregateInput
  }

  export type RideWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: RideWhereInput | RideWhereInput[]
    OR?: RideWhereInput[]
    NOT?: RideWhereInput | RideWhereInput[]
    customerId?: StringFilter<"Ride"> | string
    driverId?: StringNullableFilter<"Ride"> | string | null
    status?: EnumRideStatusFilter<"Ride"> | $Enums.RideStatus
    vehicleType?: StringFilter<"Ride"> | string
    paymentMethod?: StringFilter<"Ride"> | string
    pickupAddress?: StringFilter<"Ride"> | string
    pickupLat?: FloatFilter<"Ride"> | number
    pickupLng?: FloatFilter<"Ride"> | number
    dropoffAddress?: StringFilter<"Ride"> | string
    dropoffLat?: FloatFilter<"Ride"> | number
    dropoffLng?: FloatFilter<"Ride"> | number
    distance?: FloatNullableFilter<"Ride"> | number | null
    duration?: IntNullableFilter<"Ride"> | number | null
    fare?: FloatNullableFilter<"Ride"> | number | null
    surgeMultiplier?: FloatFilter<"Ride"> | number
    suggestedDriverIds?: StringNullableListFilter<"Ride">
    offeredDriverIds?: StringNullableListFilter<"Ride">
    rejectedDriverIds?: StringNullableListFilter<"Ride">
    reassignAttempts?: IntFilter<"Ride"> | number
    acceptedDriverId?: StringNullableFilter<"Ride"> | string | null
    requestedAt?: DateTimeFilter<"Ride"> | Date | string
    pickupAt?: DateTimeNullableFilter<"Ride"> | Date | string | null
    offeredAt?: DateTimeNullableFilter<"Ride"> | Date | string | null
    assignedAt?: DateTimeNullableFilter<"Ride"> | Date | string | null
    acceptedAt?: DateTimeNullableFilter<"Ride"> | Date | string | null
    startedAt?: DateTimeNullableFilter<"Ride"> | Date | string | null
    completedAt?: DateTimeNullableFilter<"Ride"> | Date | string | null
    cancelledAt?: DateTimeNullableFilter<"Ride"> | Date | string | null
    cancelReason?: StringNullableFilter<"Ride"> | string | null
    cancelledBy?: StringNullableFilter<"Ride"> | string | null
    createdAt?: DateTimeFilter<"Ride"> | Date | string
    updatedAt?: DateTimeFilter<"Ride"> | Date | string
    transitions?: RideStateTransitionListRelationFilter
  }, "id">

  export type RideOrderByWithAggregationInput = {
    id?: SortOrder
    customerId?: SortOrder
    driverId?: SortOrderInput | SortOrder
    status?: SortOrder
    vehicleType?: SortOrder
    paymentMethod?: SortOrder
    pickupAddress?: SortOrder
    pickupLat?: SortOrder
    pickupLng?: SortOrder
    dropoffAddress?: SortOrder
    dropoffLat?: SortOrder
    dropoffLng?: SortOrder
    distance?: SortOrderInput | SortOrder
    duration?: SortOrderInput | SortOrder
    fare?: SortOrderInput | SortOrder
    surgeMultiplier?: SortOrder
    suggestedDriverIds?: SortOrder
    offeredDriverIds?: SortOrder
    rejectedDriverIds?: SortOrder
    reassignAttempts?: SortOrder
    acceptedDriverId?: SortOrderInput | SortOrder
    requestedAt?: SortOrder
    pickupAt?: SortOrderInput | SortOrder
    offeredAt?: SortOrderInput | SortOrder
    assignedAt?: SortOrderInput | SortOrder
    acceptedAt?: SortOrderInput | SortOrder
    startedAt?: SortOrderInput | SortOrder
    completedAt?: SortOrderInput | SortOrder
    cancelledAt?: SortOrderInput | SortOrder
    cancelReason?: SortOrderInput | SortOrder
    cancelledBy?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: RideCountOrderByAggregateInput
    _avg?: RideAvgOrderByAggregateInput
    _max?: RideMaxOrderByAggregateInput
    _min?: RideMinOrderByAggregateInput
    _sum?: RideSumOrderByAggregateInput
  }

  export type RideScalarWhereWithAggregatesInput = {
    AND?: RideScalarWhereWithAggregatesInput | RideScalarWhereWithAggregatesInput[]
    OR?: RideScalarWhereWithAggregatesInput[]
    NOT?: RideScalarWhereWithAggregatesInput | RideScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"Ride"> | string
    customerId?: StringWithAggregatesFilter<"Ride"> | string
    driverId?: StringNullableWithAggregatesFilter<"Ride"> | string | null
    status?: EnumRideStatusWithAggregatesFilter<"Ride"> | $Enums.RideStatus
    vehicleType?: StringWithAggregatesFilter<"Ride"> | string
    paymentMethod?: StringWithAggregatesFilter<"Ride"> | string
    pickupAddress?: StringWithAggregatesFilter<"Ride"> | string
    pickupLat?: FloatWithAggregatesFilter<"Ride"> | number
    pickupLng?: FloatWithAggregatesFilter<"Ride"> | number
    dropoffAddress?: StringWithAggregatesFilter<"Ride"> | string
    dropoffLat?: FloatWithAggregatesFilter<"Ride"> | number
    dropoffLng?: FloatWithAggregatesFilter<"Ride"> | number
    distance?: FloatNullableWithAggregatesFilter<"Ride"> | number | null
    duration?: IntNullableWithAggregatesFilter<"Ride"> | number | null
    fare?: FloatNullableWithAggregatesFilter<"Ride"> | number | null
    surgeMultiplier?: FloatWithAggregatesFilter<"Ride"> | number
    suggestedDriverIds?: StringNullableListFilter<"Ride">
    offeredDriverIds?: StringNullableListFilter<"Ride">
    rejectedDriverIds?: StringNullableListFilter<"Ride">
    reassignAttempts?: IntWithAggregatesFilter<"Ride"> | number
    acceptedDriverId?: StringNullableWithAggregatesFilter<"Ride"> | string | null
    requestedAt?: DateTimeWithAggregatesFilter<"Ride"> | Date | string
    pickupAt?: DateTimeNullableWithAggregatesFilter<"Ride"> | Date | string | null
    offeredAt?: DateTimeNullableWithAggregatesFilter<"Ride"> | Date | string | null
    assignedAt?: DateTimeNullableWithAggregatesFilter<"Ride"> | Date | string | null
    acceptedAt?: DateTimeNullableWithAggregatesFilter<"Ride"> | Date | string | null
    startedAt?: DateTimeNullableWithAggregatesFilter<"Ride"> | Date | string | null
    completedAt?: DateTimeNullableWithAggregatesFilter<"Ride"> | Date | string | null
    cancelledAt?: DateTimeNullableWithAggregatesFilter<"Ride"> | Date | string | null
    cancelReason?: StringNullableWithAggregatesFilter<"Ride"> | string | null
    cancelledBy?: StringNullableWithAggregatesFilter<"Ride"> | string | null
    createdAt?: DateTimeWithAggregatesFilter<"Ride"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"Ride"> | Date | string
  }

  export type RideStateTransitionWhereInput = {
    AND?: RideStateTransitionWhereInput | RideStateTransitionWhereInput[]
    OR?: RideStateTransitionWhereInput[]
    NOT?: RideStateTransitionWhereInput | RideStateTransitionWhereInput[]
    id?: StringFilter<"RideStateTransition"> | string
    rideId?: StringFilter<"RideStateTransition"> | string
    fromStatus?: EnumRideStatusNullableFilter<"RideStateTransition"> | $Enums.RideStatus | null
    toStatus?: EnumRideStatusFilter<"RideStateTransition"> | $Enums.RideStatus
    actorId?: StringNullableFilter<"RideStateTransition"> | string | null
    actorType?: StringNullableFilter<"RideStateTransition"> | string | null
    reason?: StringNullableFilter<"RideStateTransition"> | string | null
    occurredAt?: DateTimeFilter<"RideStateTransition"> | Date | string
    ride?: XOR<RideRelationFilter, RideWhereInput>
  }

  export type RideStateTransitionOrderByWithRelationInput = {
    id?: SortOrder
    rideId?: SortOrder
    fromStatus?: SortOrderInput | SortOrder
    toStatus?: SortOrder
    actorId?: SortOrderInput | SortOrder
    actorType?: SortOrderInput | SortOrder
    reason?: SortOrderInput | SortOrder
    occurredAt?: SortOrder
    ride?: RideOrderByWithRelationInput
  }

  export type RideStateTransitionWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: RideStateTransitionWhereInput | RideStateTransitionWhereInput[]
    OR?: RideStateTransitionWhereInput[]
    NOT?: RideStateTransitionWhereInput | RideStateTransitionWhereInput[]
    rideId?: StringFilter<"RideStateTransition"> | string
    fromStatus?: EnumRideStatusNullableFilter<"RideStateTransition"> | $Enums.RideStatus | null
    toStatus?: EnumRideStatusFilter<"RideStateTransition"> | $Enums.RideStatus
    actorId?: StringNullableFilter<"RideStateTransition"> | string | null
    actorType?: StringNullableFilter<"RideStateTransition"> | string | null
    reason?: StringNullableFilter<"RideStateTransition"> | string | null
    occurredAt?: DateTimeFilter<"RideStateTransition"> | Date | string
    ride?: XOR<RideRelationFilter, RideWhereInput>
  }, "id">

  export type RideStateTransitionOrderByWithAggregationInput = {
    id?: SortOrder
    rideId?: SortOrder
    fromStatus?: SortOrderInput | SortOrder
    toStatus?: SortOrder
    actorId?: SortOrderInput | SortOrder
    actorType?: SortOrderInput | SortOrder
    reason?: SortOrderInput | SortOrder
    occurredAt?: SortOrder
    _count?: RideStateTransitionCountOrderByAggregateInput
    _max?: RideStateTransitionMaxOrderByAggregateInput
    _min?: RideStateTransitionMinOrderByAggregateInput
  }

  export type RideStateTransitionScalarWhereWithAggregatesInput = {
    AND?: RideStateTransitionScalarWhereWithAggregatesInput | RideStateTransitionScalarWhereWithAggregatesInput[]
    OR?: RideStateTransitionScalarWhereWithAggregatesInput[]
    NOT?: RideStateTransitionScalarWhereWithAggregatesInput | RideStateTransitionScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"RideStateTransition"> | string
    rideId?: StringWithAggregatesFilter<"RideStateTransition"> | string
    fromStatus?: EnumRideStatusNullableWithAggregatesFilter<"RideStateTransition"> | $Enums.RideStatus | null
    toStatus?: EnumRideStatusWithAggregatesFilter<"RideStateTransition"> | $Enums.RideStatus
    actorId?: StringNullableWithAggregatesFilter<"RideStateTransition"> | string | null
    actorType?: StringNullableWithAggregatesFilter<"RideStateTransition"> | string | null
    reason?: StringNullableWithAggregatesFilter<"RideStateTransition"> | string | null
    occurredAt?: DateTimeWithAggregatesFilter<"RideStateTransition"> | Date | string
  }

  export type RideCreateInput = {
    id?: string
    customerId: string
    driverId?: string | null
    status?: $Enums.RideStatus
    vehicleType?: string
    paymentMethod?: string
    pickupAddress: string
    pickupLat: number
    pickupLng: number
    dropoffAddress: string
    dropoffLat: number
    dropoffLng: number
    distance?: number | null
    duration?: number | null
    fare?: number | null
    surgeMultiplier?: number
    suggestedDriverIds?: RideCreatesuggestedDriverIdsInput | string[]
    offeredDriverIds?: RideCreateofferedDriverIdsInput | string[]
    rejectedDriverIds?: RideCreaterejectedDriverIdsInput | string[]
    reassignAttempts?: number
    acceptedDriverId?: string | null
    requestedAt?: Date | string
    pickupAt?: Date | string | null
    offeredAt?: Date | string | null
    assignedAt?: Date | string | null
    acceptedAt?: Date | string | null
    startedAt?: Date | string | null
    completedAt?: Date | string | null
    cancelledAt?: Date | string | null
    cancelReason?: string | null
    cancelledBy?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    transitions?: RideStateTransitionCreateNestedManyWithoutRideInput
  }

  export type RideUncheckedCreateInput = {
    id?: string
    customerId: string
    driverId?: string | null
    status?: $Enums.RideStatus
    vehicleType?: string
    paymentMethod?: string
    pickupAddress: string
    pickupLat: number
    pickupLng: number
    dropoffAddress: string
    dropoffLat: number
    dropoffLng: number
    distance?: number | null
    duration?: number | null
    fare?: number | null
    surgeMultiplier?: number
    suggestedDriverIds?: RideCreatesuggestedDriverIdsInput | string[]
    offeredDriverIds?: RideCreateofferedDriverIdsInput | string[]
    rejectedDriverIds?: RideCreaterejectedDriverIdsInput | string[]
    reassignAttempts?: number
    acceptedDriverId?: string | null
    requestedAt?: Date | string
    pickupAt?: Date | string | null
    offeredAt?: Date | string | null
    assignedAt?: Date | string | null
    acceptedAt?: Date | string | null
    startedAt?: Date | string | null
    completedAt?: Date | string | null
    cancelledAt?: Date | string | null
    cancelReason?: string | null
    cancelledBy?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    transitions?: RideStateTransitionUncheckedCreateNestedManyWithoutRideInput
  }

  export type RideUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    customerId?: StringFieldUpdateOperationsInput | string
    driverId?: NullableStringFieldUpdateOperationsInput | string | null
    status?: EnumRideStatusFieldUpdateOperationsInput | $Enums.RideStatus
    vehicleType?: StringFieldUpdateOperationsInput | string
    paymentMethod?: StringFieldUpdateOperationsInput | string
    pickupAddress?: StringFieldUpdateOperationsInput | string
    pickupLat?: FloatFieldUpdateOperationsInput | number
    pickupLng?: FloatFieldUpdateOperationsInput | number
    dropoffAddress?: StringFieldUpdateOperationsInput | string
    dropoffLat?: FloatFieldUpdateOperationsInput | number
    dropoffLng?: FloatFieldUpdateOperationsInput | number
    distance?: NullableFloatFieldUpdateOperationsInput | number | null
    duration?: NullableIntFieldUpdateOperationsInput | number | null
    fare?: NullableFloatFieldUpdateOperationsInput | number | null
    surgeMultiplier?: FloatFieldUpdateOperationsInput | number
    suggestedDriverIds?: RideUpdatesuggestedDriverIdsInput | string[]
    offeredDriverIds?: RideUpdateofferedDriverIdsInput | string[]
    rejectedDriverIds?: RideUpdaterejectedDriverIdsInput | string[]
    reassignAttempts?: IntFieldUpdateOperationsInput | number
    acceptedDriverId?: NullableStringFieldUpdateOperationsInput | string | null
    requestedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    pickupAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    offeredAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    assignedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    acceptedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    startedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    completedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    cancelledAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    cancelReason?: NullableStringFieldUpdateOperationsInput | string | null
    cancelledBy?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    transitions?: RideStateTransitionUpdateManyWithoutRideNestedInput
  }

  export type RideUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    customerId?: StringFieldUpdateOperationsInput | string
    driverId?: NullableStringFieldUpdateOperationsInput | string | null
    status?: EnumRideStatusFieldUpdateOperationsInput | $Enums.RideStatus
    vehicleType?: StringFieldUpdateOperationsInput | string
    paymentMethod?: StringFieldUpdateOperationsInput | string
    pickupAddress?: StringFieldUpdateOperationsInput | string
    pickupLat?: FloatFieldUpdateOperationsInput | number
    pickupLng?: FloatFieldUpdateOperationsInput | number
    dropoffAddress?: StringFieldUpdateOperationsInput | string
    dropoffLat?: FloatFieldUpdateOperationsInput | number
    dropoffLng?: FloatFieldUpdateOperationsInput | number
    distance?: NullableFloatFieldUpdateOperationsInput | number | null
    duration?: NullableIntFieldUpdateOperationsInput | number | null
    fare?: NullableFloatFieldUpdateOperationsInput | number | null
    surgeMultiplier?: FloatFieldUpdateOperationsInput | number
    suggestedDriverIds?: RideUpdatesuggestedDriverIdsInput | string[]
    offeredDriverIds?: RideUpdateofferedDriverIdsInput | string[]
    rejectedDriverIds?: RideUpdaterejectedDriverIdsInput | string[]
    reassignAttempts?: IntFieldUpdateOperationsInput | number
    acceptedDriverId?: NullableStringFieldUpdateOperationsInput | string | null
    requestedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    pickupAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    offeredAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    assignedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    acceptedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    startedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    completedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    cancelledAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    cancelReason?: NullableStringFieldUpdateOperationsInput | string | null
    cancelledBy?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    transitions?: RideStateTransitionUncheckedUpdateManyWithoutRideNestedInput
  }

  export type RideCreateManyInput = {
    id?: string
    customerId: string
    driverId?: string | null
    status?: $Enums.RideStatus
    vehicleType?: string
    paymentMethod?: string
    pickupAddress: string
    pickupLat: number
    pickupLng: number
    dropoffAddress: string
    dropoffLat: number
    dropoffLng: number
    distance?: number | null
    duration?: number | null
    fare?: number | null
    surgeMultiplier?: number
    suggestedDriverIds?: RideCreatesuggestedDriverIdsInput | string[]
    offeredDriverIds?: RideCreateofferedDriverIdsInput | string[]
    rejectedDriverIds?: RideCreaterejectedDriverIdsInput | string[]
    reassignAttempts?: number
    acceptedDriverId?: string | null
    requestedAt?: Date | string
    pickupAt?: Date | string | null
    offeredAt?: Date | string | null
    assignedAt?: Date | string | null
    acceptedAt?: Date | string | null
    startedAt?: Date | string | null
    completedAt?: Date | string | null
    cancelledAt?: Date | string | null
    cancelReason?: string | null
    cancelledBy?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type RideUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    customerId?: StringFieldUpdateOperationsInput | string
    driverId?: NullableStringFieldUpdateOperationsInput | string | null
    status?: EnumRideStatusFieldUpdateOperationsInput | $Enums.RideStatus
    vehicleType?: StringFieldUpdateOperationsInput | string
    paymentMethod?: StringFieldUpdateOperationsInput | string
    pickupAddress?: StringFieldUpdateOperationsInput | string
    pickupLat?: FloatFieldUpdateOperationsInput | number
    pickupLng?: FloatFieldUpdateOperationsInput | number
    dropoffAddress?: StringFieldUpdateOperationsInput | string
    dropoffLat?: FloatFieldUpdateOperationsInput | number
    dropoffLng?: FloatFieldUpdateOperationsInput | number
    distance?: NullableFloatFieldUpdateOperationsInput | number | null
    duration?: NullableIntFieldUpdateOperationsInput | number | null
    fare?: NullableFloatFieldUpdateOperationsInput | number | null
    surgeMultiplier?: FloatFieldUpdateOperationsInput | number
    suggestedDriverIds?: RideUpdatesuggestedDriverIdsInput | string[]
    offeredDriverIds?: RideUpdateofferedDriverIdsInput | string[]
    rejectedDriverIds?: RideUpdaterejectedDriverIdsInput | string[]
    reassignAttempts?: IntFieldUpdateOperationsInput | number
    acceptedDriverId?: NullableStringFieldUpdateOperationsInput | string | null
    requestedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    pickupAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    offeredAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    assignedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    acceptedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    startedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    completedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    cancelledAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    cancelReason?: NullableStringFieldUpdateOperationsInput | string | null
    cancelledBy?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type RideUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    customerId?: StringFieldUpdateOperationsInput | string
    driverId?: NullableStringFieldUpdateOperationsInput | string | null
    status?: EnumRideStatusFieldUpdateOperationsInput | $Enums.RideStatus
    vehicleType?: StringFieldUpdateOperationsInput | string
    paymentMethod?: StringFieldUpdateOperationsInput | string
    pickupAddress?: StringFieldUpdateOperationsInput | string
    pickupLat?: FloatFieldUpdateOperationsInput | number
    pickupLng?: FloatFieldUpdateOperationsInput | number
    dropoffAddress?: StringFieldUpdateOperationsInput | string
    dropoffLat?: FloatFieldUpdateOperationsInput | number
    dropoffLng?: FloatFieldUpdateOperationsInput | number
    distance?: NullableFloatFieldUpdateOperationsInput | number | null
    duration?: NullableIntFieldUpdateOperationsInput | number | null
    fare?: NullableFloatFieldUpdateOperationsInput | number | null
    surgeMultiplier?: FloatFieldUpdateOperationsInput | number
    suggestedDriverIds?: RideUpdatesuggestedDriverIdsInput | string[]
    offeredDriverIds?: RideUpdateofferedDriverIdsInput | string[]
    rejectedDriverIds?: RideUpdaterejectedDriverIdsInput | string[]
    reassignAttempts?: IntFieldUpdateOperationsInput | number
    acceptedDriverId?: NullableStringFieldUpdateOperationsInput | string | null
    requestedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    pickupAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    offeredAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    assignedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    acceptedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    startedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    completedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    cancelledAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    cancelReason?: NullableStringFieldUpdateOperationsInput | string | null
    cancelledBy?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type RideStateTransitionCreateInput = {
    id?: string
    fromStatus?: $Enums.RideStatus | null
    toStatus: $Enums.RideStatus
    actorId?: string | null
    actorType?: string | null
    reason?: string | null
    occurredAt?: Date | string
    ride: RideCreateNestedOneWithoutTransitionsInput
  }

  export type RideStateTransitionUncheckedCreateInput = {
    id?: string
    rideId: string
    fromStatus?: $Enums.RideStatus | null
    toStatus: $Enums.RideStatus
    actorId?: string | null
    actorType?: string | null
    reason?: string | null
    occurredAt?: Date | string
  }

  export type RideStateTransitionUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    fromStatus?: NullableEnumRideStatusFieldUpdateOperationsInput | $Enums.RideStatus | null
    toStatus?: EnumRideStatusFieldUpdateOperationsInput | $Enums.RideStatus
    actorId?: NullableStringFieldUpdateOperationsInput | string | null
    actorType?: NullableStringFieldUpdateOperationsInput | string | null
    reason?: NullableStringFieldUpdateOperationsInput | string | null
    occurredAt?: DateTimeFieldUpdateOperationsInput | Date | string
    ride?: RideUpdateOneRequiredWithoutTransitionsNestedInput
  }

  export type RideStateTransitionUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    rideId?: StringFieldUpdateOperationsInput | string
    fromStatus?: NullableEnumRideStatusFieldUpdateOperationsInput | $Enums.RideStatus | null
    toStatus?: EnumRideStatusFieldUpdateOperationsInput | $Enums.RideStatus
    actorId?: NullableStringFieldUpdateOperationsInput | string | null
    actorType?: NullableStringFieldUpdateOperationsInput | string | null
    reason?: NullableStringFieldUpdateOperationsInput | string | null
    occurredAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type RideStateTransitionCreateManyInput = {
    id?: string
    rideId: string
    fromStatus?: $Enums.RideStatus | null
    toStatus: $Enums.RideStatus
    actorId?: string | null
    actorType?: string | null
    reason?: string | null
    occurredAt?: Date | string
  }

  export type RideStateTransitionUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    fromStatus?: NullableEnumRideStatusFieldUpdateOperationsInput | $Enums.RideStatus | null
    toStatus?: EnumRideStatusFieldUpdateOperationsInput | $Enums.RideStatus
    actorId?: NullableStringFieldUpdateOperationsInput | string | null
    actorType?: NullableStringFieldUpdateOperationsInput | string | null
    reason?: NullableStringFieldUpdateOperationsInput | string | null
    occurredAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type RideStateTransitionUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    rideId?: StringFieldUpdateOperationsInput | string
    fromStatus?: NullableEnumRideStatusFieldUpdateOperationsInput | $Enums.RideStatus | null
    toStatus?: EnumRideStatusFieldUpdateOperationsInput | $Enums.RideStatus
    actorId?: NullableStringFieldUpdateOperationsInput | string | null
    actorType?: NullableStringFieldUpdateOperationsInput | string | null
    reason?: NullableStringFieldUpdateOperationsInput | string | null
    occurredAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type StringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type StringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type EnumRideStatusFilter<$PrismaModel = never> = {
    equals?: $Enums.RideStatus | EnumRideStatusFieldRefInput<$PrismaModel>
    in?: $Enums.RideStatus[] | ListEnumRideStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.RideStatus[] | ListEnumRideStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumRideStatusFilter<$PrismaModel> | $Enums.RideStatus
  }

  export type FloatFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatFilter<$PrismaModel> | number
  }

  export type FloatNullableFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null
    in?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatNullableFilter<$PrismaModel> | number | null
  }

  export type IntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }

  export type StringNullableListFilter<$PrismaModel = never> = {
    equals?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    has?: string | StringFieldRefInput<$PrismaModel> | null
    hasEvery?: string[] | ListStringFieldRefInput<$PrismaModel>
    hasSome?: string[] | ListStringFieldRefInput<$PrismaModel>
    isEmpty?: boolean
  }

  export type IntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type DateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type DateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
  }

  export type RideStateTransitionListRelationFilter = {
    every?: RideStateTransitionWhereInput
    some?: RideStateTransitionWhereInput
    none?: RideStateTransitionWhereInput
  }

  export type SortOrderInput = {
    sort: SortOrder
    nulls?: NullsOrder
  }

  export type RideStateTransitionOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type RideCountOrderByAggregateInput = {
    id?: SortOrder
    customerId?: SortOrder
    driverId?: SortOrder
    status?: SortOrder
    vehicleType?: SortOrder
    paymentMethod?: SortOrder
    pickupAddress?: SortOrder
    pickupLat?: SortOrder
    pickupLng?: SortOrder
    dropoffAddress?: SortOrder
    dropoffLat?: SortOrder
    dropoffLng?: SortOrder
    distance?: SortOrder
    duration?: SortOrder
    fare?: SortOrder
    surgeMultiplier?: SortOrder
    suggestedDriverIds?: SortOrder
    offeredDriverIds?: SortOrder
    rejectedDriverIds?: SortOrder
    reassignAttempts?: SortOrder
    acceptedDriverId?: SortOrder
    requestedAt?: SortOrder
    pickupAt?: SortOrder
    offeredAt?: SortOrder
    assignedAt?: SortOrder
    acceptedAt?: SortOrder
    startedAt?: SortOrder
    completedAt?: SortOrder
    cancelledAt?: SortOrder
    cancelReason?: SortOrder
    cancelledBy?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type RideAvgOrderByAggregateInput = {
    pickupLat?: SortOrder
    pickupLng?: SortOrder
    dropoffLat?: SortOrder
    dropoffLng?: SortOrder
    distance?: SortOrder
    duration?: SortOrder
    fare?: SortOrder
    surgeMultiplier?: SortOrder
    reassignAttempts?: SortOrder
  }

  export type RideMaxOrderByAggregateInput = {
    id?: SortOrder
    customerId?: SortOrder
    driverId?: SortOrder
    status?: SortOrder
    vehicleType?: SortOrder
    paymentMethod?: SortOrder
    pickupAddress?: SortOrder
    pickupLat?: SortOrder
    pickupLng?: SortOrder
    dropoffAddress?: SortOrder
    dropoffLat?: SortOrder
    dropoffLng?: SortOrder
    distance?: SortOrder
    duration?: SortOrder
    fare?: SortOrder
    surgeMultiplier?: SortOrder
    reassignAttempts?: SortOrder
    acceptedDriverId?: SortOrder
    requestedAt?: SortOrder
    pickupAt?: SortOrder
    offeredAt?: SortOrder
    assignedAt?: SortOrder
    acceptedAt?: SortOrder
    startedAt?: SortOrder
    completedAt?: SortOrder
    cancelledAt?: SortOrder
    cancelReason?: SortOrder
    cancelledBy?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type RideMinOrderByAggregateInput = {
    id?: SortOrder
    customerId?: SortOrder
    driverId?: SortOrder
    status?: SortOrder
    vehicleType?: SortOrder
    paymentMethod?: SortOrder
    pickupAddress?: SortOrder
    pickupLat?: SortOrder
    pickupLng?: SortOrder
    dropoffAddress?: SortOrder
    dropoffLat?: SortOrder
    dropoffLng?: SortOrder
    distance?: SortOrder
    duration?: SortOrder
    fare?: SortOrder
    surgeMultiplier?: SortOrder
    reassignAttempts?: SortOrder
    acceptedDriverId?: SortOrder
    requestedAt?: SortOrder
    pickupAt?: SortOrder
    offeredAt?: SortOrder
    assignedAt?: SortOrder
    acceptedAt?: SortOrder
    startedAt?: SortOrder
    completedAt?: SortOrder
    cancelledAt?: SortOrder
    cancelReason?: SortOrder
    cancelledBy?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type RideSumOrderByAggregateInput = {
    pickupLat?: SortOrder
    pickupLng?: SortOrder
    dropoffLat?: SortOrder
    dropoffLng?: SortOrder
    distance?: SortOrder
    duration?: SortOrder
    fare?: SortOrder
    surgeMultiplier?: SortOrder
    reassignAttempts?: SortOrder
  }

  export type StringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type StringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type EnumRideStatusWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.RideStatus | EnumRideStatusFieldRefInput<$PrismaModel>
    in?: $Enums.RideStatus[] | ListEnumRideStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.RideStatus[] | ListEnumRideStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumRideStatusWithAggregatesFilter<$PrismaModel> | $Enums.RideStatus
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumRideStatusFilter<$PrismaModel>
    _max?: NestedEnumRideStatusFilter<$PrismaModel>
  }

  export type FloatWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedFloatFilter<$PrismaModel>
    _min?: NestedFloatFilter<$PrismaModel>
    _max?: NestedFloatFilter<$PrismaModel>
  }

  export type FloatNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null
    in?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedFloatNullableFilter<$PrismaModel>
    _min?: NestedFloatNullableFilter<$PrismaModel>
    _max?: NestedFloatNullableFilter<$PrismaModel>
  }

  export type IntNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedIntNullableFilter<$PrismaModel>
    _max?: NestedIntNullableFilter<$PrismaModel>
  }

  export type IntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }

  export type DateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type DateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
  }

  export type EnumRideStatusNullableFilter<$PrismaModel = never> = {
    equals?: $Enums.RideStatus | EnumRideStatusFieldRefInput<$PrismaModel> | null
    in?: $Enums.RideStatus[] | ListEnumRideStatusFieldRefInput<$PrismaModel> | null
    notIn?: $Enums.RideStatus[] | ListEnumRideStatusFieldRefInput<$PrismaModel> | null
    not?: NestedEnumRideStatusNullableFilter<$PrismaModel> | $Enums.RideStatus | null
  }

  export type RideRelationFilter = {
    is?: RideWhereInput
    isNot?: RideWhereInput
  }

  export type RideStateTransitionCountOrderByAggregateInput = {
    id?: SortOrder
    rideId?: SortOrder
    fromStatus?: SortOrder
    toStatus?: SortOrder
    actorId?: SortOrder
    actorType?: SortOrder
    reason?: SortOrder
    occurredAt?: SortOrder
  }

  export type RideStateTransitionMaxOrderByAggregateInput = {
    id?: SortOrder
    rideId?: SortOrder
    fromStatus?: SortOrder
    toStatus?: SortOrder
    actorId?: SortOrder
    actorType?: SortOrder
    reason?: SortOrder
    occurredAt?: SortOrder
  }

  export type RideStateTransitionMinOrderByAggregateInput = {
    id?: SortOrder
    rideId?: SortOrder
    fromStatus?: SortOrder
    toStatus?: SortOrder
    actorId?: SortOrder
    actorType?: SortOrder
    reason?: SortOrder
    occurredAt?: SortOrder
  }

  export type EnumRideStatusNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.RideStatus | EnumRideStatusFieldRefInput<$PrismaModel> | null
    in?: $Enums.RideStatus[] | ListEnumRideStatusFieldRefInput<$PrismaModel> | null
    notIn?: $Enums.RideStatus[] | ListEnumRideStatusFieldRefInput<$PrismaModel> | null
    not?: NestedEnumRideStatusNullableWithAggregatesFilter<$PrismaModel> | $Enums.RideStatus | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedEnumRideStatusNullableFilter<$PrismaModel>
    _max?: NestedEnumRideStatusNullableFilter<$PrismaModel>
  }

  export type RideCreatesuggestedDriverIdsInput = {
    set: string[]
  }

  export type RideCreateofferedDriverIdsInput = {
    set: string[]
  }

  export type RideCreaterejectedDriverIdsInput = {
    set: string[]
  }

  export type RideStateTransitionCreateNestedManyWithoutRideInput = {
    create?: XOR<RideStateTransitionCreateWithoutRideInput, RideStateTransitionUncheckedCreateWithoutRideInput> | RideStateTransitionCreateWithoutRideInput[] | RideStateTransitionUncheckedCreateWithoutRideInput[]
    connectOrCreate?: RideStateTransitionCreateOrConnectWithoutRideInput | RideStateTransitionCreateOrConnectWithoutRideInput[]
    createMany?: RideStateTransitionCreateManyRideInputEnvelope
    connect?: RideStateTransitionWhereUniqueInput | RideStateTransitionWhereUniqueInput[]
  }

  export type RideStateTransitionUncheckedCreateNestedManyWithoutRideInput = {
    create?: XOR<RideStateTransitionCreateWithoutRideInput, RideStateTransitionUncheckedCreateWithoutRideInput> | RideStateTransitionCreateWithoutRideInput[] | RideStateTransitionUncheckedCreateWithoutRideInput[]
    connectOrCreate?: RideStateTransitionCreateOrConnectWithoutRideInput | RideStateTransitionCreateOrConnectWithoutRideInput[]
    createMany?: RideStateTransitionCreateManyRideInputEnvelope
    connect?: RideStateTransitionWhereUniqueInput | RideStateTransitionWhereUniqueInput[]
  }

  export type StringFieldUpdateOperationsInput = {
    set?: string
  }

  export type NullableStringFieldUpdateOperationsInput = {
    set?: string | null
  }

  export type EnumRideStatusFieldUpdateOperationsInput = {
    set?: $Enums.RideStatus
  }

  export type FloatFieldUpdateOperationsInput = {
    set?: number
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type NullableFloatFieldUpdateOperationsInput = {
    set?: number | null
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type NullableIntFieldUpdateOperationsInput = {
    set?: number | null
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type RideUpdatesuggestedDriverIdsInput = {
    set?: string[]
    push?: string | string[]
  }

  export type RideUpdateofferedDriverIdsInput = {
    set?: string[]
    push?: string | string[]
  }

  export type RideUpdaterejectedDriverIdsInput = {
    set?: string[]
    push?: string | string[]
  }

  export type IntFieldUpdateOperationsInput = {
    set?: number
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type DateTimeFieldUpdateOperationsInput = {
    set?: Date | string
  }

  export type NullableDateTimeFieldUpdateOperationsInput = {
    set?: Date | string | null
  }

  export type RideStateTransitionUpdateManyWithoutRideNestedInput = {
    create?: XOR<RideStateTransitionCreateWithoutRideInput, RideStateTransitionUncheckedCreateWithoutRideInput> | RideStateTransitionCreateWithoutRideInput[] | RideStateTransitionUncheckedCreateWithoutRideInput[]
    connectOrCreate?: RideStateTransitionCreateOrConnectWithoutRideInput | RideStateTransitionCreateOrConnectWithoutRideInput[]
    upsert?: RideStateTransitionUpsertWithWhereUniqueWithoutRideInput | RideStateTransitionUpsertWithWhereUniqueWithoutRideInput[]
    createMany?: RideStateTransitionCreateManyRideInputEnvelope
    set?: RideStateTransitionWhereUniqueInput | RideStateTransitionWhereUniqueInput[]
    disconnect?: RideStateTransitionWhereUniqueInput | RideStateTransitionWhereUniqueInput[]
    delete?: RideStateTransitionWhereUniqueInput | RideStateTransitionWhereUniqueInput[]
    connect?: RideStateTransitionWhereUniqueInput | RideStateTransitionWhereUniqueInput[]
    update?: RideStateTransitionUpdateWithWhereUniqueWithoutRideInput | RideStateTransitionUpdateWithWhereUniqueWithoutRideInput[]
    updateMany?: RideStateTransitionUpdateManyWithWhereWithoutRideInput | RideStateTransitionUpdateManyWithWhereWithoutRideInput[]
    deleteMany?: RideStateTransitionScalarWhereInput | RideStateTransitionScalarWhereInput[]
  }

  export type RideStateTransitionUncheckedUpdateManyWithoutRideNestedInput = {
    create?: XOR<RideStateTransitionCreateWithoutRideInput, RideStateTransitionUncheckedCreateWithoutRideInput> | RideStateTransitionCreateWithoutRideInput[] | RideStateTransitionUncheckedCreateWithoutRideInput[]
    connectOrCreate?: RideStateTransitionCreateOrConnectWithoutRideInput | RideStateTransitionCreateOrConnectWithoutRideInput[]
    upsert?: RideStateTransitionUpsertWithWhereUniqueWithoutRideInput | RideStateTransitionUpsertWithWhereUniqueWithoutRideInput[]
    createMany?: RideStateTransitionCreateManyRideInputEnvelope
    set?: RideStateTransitionWhereUniqueInput | RideStateTransitionWhereUniqueInput[]
    disconnect?: RideStateTransitionWhereUniqueInput | RideStateTransitionWhereUniqueInput[]
    delete?: RideStateTransitionWhereUniqueInput | RideStateTransitionWhereUniqueInput[]
    connect?: RideStateTransitionWhereUniqueInput | RideStateTransitionWhereUniqueInput[]
    update?: RideStateTransitionUpdateWithWhereUniqueWithoutRideInput | RideStateTransitionUpdateWithWhereUniqueWithoutRideInput[]
    updateMany?: RideStateTransitionUpdateManyWithWhereWithoutRideInput | RideStateTransitionUpdateManyWithWhereWithoutRideInput[]
    deleteMany?: RideStateTransitionScalarWhereInput | RideStateTransitionScalarWhereInput[]
  }

  export type RideCreateNestedOneWithoutTransitionsInput = {
    create?: XOR<RideCreateWithoutTransitionsInput, RideUncheckedCreateWithoutTransitionsInput>
    connectOrCreate?: RideCreateOrConnectWithoutTransitionsInput
    connect?: RideWhereUniqueInput
  }

  export type NullableEnumRideStatusFieldUpdateOperationsInput = {
    set?: $Enums.RideStatus | null
  }

  export type RideUpdateOneRequiredWithoutTransitionsNestedInput = {
    create?: XOR<RideCreateWithoutTransitionsInput, RideUncheckedCreateWithoutTransitionsInput>
    connectOrCreate?: RideCreateOrConnectWithoutTransitionsInput
    upsert?: RideUpsertWithoutTransitionsInput
    connect?: RideWhereUniqueInput
    update?: XOR<XOR<RideUpdateToOneWithWhereWithoutTransitionsInput, RideUpdateWithoutTransitionsInput>, RideUncheckedUpdateWithoutTransitionsInput>
  }

  export type NestedStringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type NestedStringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type NestedEnumRideStatusFilter<$PrismaModel = never> = {
    equals?: $Enums.RideStatus | EnumRideStatusFieldRefInput<$PrismaModel>
    in?: $Enums.RideStatus[] | ListEnumRideStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.RideStatus[] | ListEnumRideStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumRideStatusFilter<$PrismaModel> | $Enums.RideStatus
  }

  export type NestedFloatFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatFilter<$PrismaModel> | number
  }

  export type NestedFloatNullableFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null
    in?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatNullableFilter<$PrismaModel> | number | null
  }

  export type NestedIntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }

  export type NestedIntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type NestedDateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type NestedDateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
  }

  export type NestedStringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type NestedStringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type NestedEnumRideStatusWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.RideStatus | EnumRideStatusFieldRefInput<$PrismaModel>
    in?: $Enums.RideStatus[] | ListEnumRideStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.RideStatus[] | ListEnumRideStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumRideStatusWithAggregatesFilter<$PrismaModel> | $Enums.RideStatus
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumRideStatusFilter<$PrismaModel>
    _max?: NestedEnumRideStatusFilter<$PrismaModel>
  }

  export type NestedFloatWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedFloatFilter<$PrismaModel>
    _min?: NestedFloatFilter<$PrismaModel>
    _max?: NestedFloatFilter<$PrismaModel>
  }

  export type NestedFloatNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null
    in?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedFloatNullableFilter<$PrismaModel>
    _min?: NestedFloatNullableFilter<$PrismaModel>
    _max?: NestedFloatNullableFilter<$PrismaModel>
  }

  export type NestedIntNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedIntNullableFilter<$PrismaModel>
    _max?: NestedIntNullableFilter<$PrismaModel>
  }

  export type NestedIntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }

  export type NestedDateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type NestedDateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
  }

  export type NestedEnumRideStatusNullableFilter<$PrismaModel = never> = {
    equals?: $Enums.RideStatus | EnumRideStatusFieldRefInput<$PrismaModel> | null
    in?: $Enums.RideStatus[] | ListEnumRideStatusFieldRefInput<$PrismaModel> | null
    notIn?: $Enums.RideStatus[] | ListEnumRideStatusFieldRefInput<$PrismaModel> | null
    not?: NestedEnumRideStatusNullableFilter<$PrismaModel> | $Enums.RideStatus | null
  }

  export type NestedEnumRideStatusNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.RideStatus | EnumRideStatusFieldRefInput<$PrismaModel> | null
    in?: $Enums.RideStatus[] | ListEnumRideStatusFieldRefInput<$PrismaModel> | null
    notIn?: $Enums.RideStatus[] | ListEnumRideStatusFieldRefInput<$PrismaModel> | null
    not?: NestedEnumRideStatusNullableWithAggregatesFilter<$PrismaModel> | $Enums.RideStatus | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedEnumRideStatusNullableFilter<$PrismaModel>
    _max?: NestedEnumRideStatusNullableFilter<$PrismaModel>
  }

  export type RideStateTransitionCreateWithoutRideInput = {
    id?: string
    fromStatus?: $Enums.RideStatus | null
    toStatus: $Enums.RideStatus
    actorId?: string | null
    actorType?: string | null
    reason?: string | null
    occurredAt?: Date | string
  }

  export type RideStateTransitionUncheckedCreateWithoutRideInput = {
    id?: string
    fromStatus?: $Enums.RideStatus | null
    toStatus: $Enums.RideStatus
    actorId?: string | null
    actorType?: string | null
    reason?: string | null
    occurredAt?: Date | string
  }

  export type RideStateTransitionCreateOrConnectWithoutRideInput = {
    where: RideStateTransitionWhereUniqueInput
    create: XOR<RideStateTransitionCreateWithoutRideInput, RideStateTransitionUncheckedCreateWithoutRideInput>
  }

  export type RideStateTransitionCreateManyRideInputEnvelope = {
    data: RideStateTransitionCreateManyRideInput | RideStateTransitionCreateManyRideInput[]
    skipDuplicates?: boolean
  }

  export type RideStateTransitionUpsertWithWhereUniqueWithoutRideInput = {
    where: RideStateTransitionWhereUniqueInput
    update: XOR<RideStateTransitionUpdateWithoutRideInput, RideStateTransitionUncheckedUpdateWithoutRideInput>
    create: XOR<RideStateTransitionCreateWithoutRideInput, RideStateTransitionUncheckedCreateWithoutRideInput>
  }

  export type RideStateTransitionUpdateWithWhereUniqueWithoutRideInput = {
    where: RideStateTransitionWhereUniqueInput
    data: XOR<RideStateTransitionUpdateWithoutRideInput, RideStateTransitionUncheckedUpdateWithoutRideInput>
  }

  export type RideStateTransitionUpdateManyWithWhereWithoutRideInput = {
    where: RideStateTransitionScalarWhereInput
    data: XOR<RideStateTransitionUpdateManyMutationInput, RideStateTransitionUncheckedUpdateManyWithoutRideInput>
  }

  export type RideStateTransitionScalarWhereInput = {
    AND?: RideStateTransitionScalarWhereInput | RideStateTransitionScalarWhereInput[]
    OR?: RideStateTransitionScalarWhereInput[]
    NOT?: RideStateTransitionScalarWhereInput | RideStateTransitionScalarWhereInput[]
    id?: StringFilter<"RideStateTransition"> | string
    rideId?: StringFilter<"RideStateTransition"> | string
    fromStatus?: EnumRideStatusNullableFilter<"RideStateTransition"> | $Enums.RideStatus | null
    toStatus?: EnumRideStatusFilter<"RideStateTransition"> | $Enums.RideStatus
    actorId?: StringNullableFilter<"RideStateTransition"> | string | null
    actorType?: StringNullableFilter<"RideStateTransition"> | string | null
    reason?: StringNullableFilter<"RideStateTransition"> | string | null
    occurredAt?: DateTimeFilter<"RideStateTransition"> | Date | string
  }

  export type RideCreateWithoutTransitionsInput = {
    id?: string
    customerId: string
    driverId?: string | null
    status?: $Enums.RideStatus
    vehicleType?: string
    paymentMethod?: string
    pickupAddress: string
    pickupLat: number
    pickupLng: number
    dropoffAddress: string
    dropoffLat: number
    dropoffLng: number
    distance?: number | null
    duration?: number | null
    fare?: number | null
    surgeMultiplier?: number
    suggestedDriverIds?: RideCreatesuggestedDriverIdsInput | string[]
    offeredDriverIds?: RideCreateofferedDriverIdsInput | string[]
    rejectedDriverIds?: RideCreaterejectedDriverIdsInput | string[]
    reassignAttempts?: number
    acceptedDriverId?: string | null
    requestedAt?: Date | string
    pickupAt?: Date | string | null
    offeredAt?: Date | string | null
    assignedAt?: Date | string | null
    acceptedAt?: Date | string | null
    startedAt?: Date | string | null
    completedAt?: Date | string | null
    cancelledAt?: Date | string | null
    cancelReason?: string | null
    cancelledBy?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type RideUncheckedCreateWithoutTransitionsInput = {
    id?: string
    customerId: string
    driverId?: string | null
    status?: $Enums.RideStatus
    vehicleType?: string
    paymentMethod?: string
    pickupAddress: string
    pickupLat: number
    pickupLng: number
    dropoffAddress: string
    dropoffLat: number
    dropoffLng: number
    distance?: number | null
    duration?: number | null
    fare?: number | null
    surgeMultiplier?: number
    suggestedDriverIds?: RideCreatesuggestedDriverIdsInput | string[]
    offeredDriverIds?: RideCreateofferedDriverIdsInput | string[]
    rejectedDriverIds?: RideCreaterejectedDriverIdsInput | string[]
    reassignAttempts?: number
    acceptedDriverId?: string | null
    requestedAt?: Date | string
    pickupAt?: Date | string | null
    offeredAt?: Date | string | null
    assignedAt?: Date | string | null
    acceptedAt?: Date | string | null
    startedAt?: Date | string | null
    completedAt?: Date | string | null
    cancelledAt?: Date | string | null
    cancelReason?: string | null
    cancelledBy?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type RideCreateOrConnectWithoutTransitionsInput = {
    where: RideWhereUniqueInput
    create: XOR<RideCreateWithoutTransitionsInput, RideUncheckedCreateWithoutTransitionsInput>
  }

  export type RideUpsertWithoutTransitionsInput = {
    update: XOR<RideUpdateWithoutTransitionsInput, RideUncheckedUpdateWithoutTransitionsInput>
    create: XOR<RideCreateWithoutTransitionsInput, RideUncheckedCreateWithoutTransitionsInput>
    where?: RideWhereInput
  }

  export type RideUpdateToOneWithWhereWithoutTransitionsInput = {
    where?: RideWhereInput
    data: XOR<RideUpdateWithoutTransitionsInput, RideUncheckedUpdateWithoutTransitionsInput>
  }

  export type RideUpdateWithoutTransitionsInput = {
    id?: StringFieldUpdateOperationsInput | string
    customerId?: StringFieldUpdateOperationsInput | string
    driverId?: NullableStringFieldUpdateOperationsInput | string | null
    status?: EnumRideStatusFieldUpdateOperationsInput | $Enums.RideStatus
    vehicleType?: StringFieldUpdateOperationsInput | string
    paymentMethod?: StringFieldUpdateOperationsInput | string
    pickupAddress?: StringFieldUpdateOperationsInput | string
    pickupLat?: FloatFieldUpdateOperationsInput | number
    pickupLng?: FloatFieldUpdateOperationsInput | number
    dropoffAddress?: StringFieldUpdateOperationsInput | string
    dropoffLat?: FloatFieldUpdateOperationsInput | number
    dropoffLng?: FloatFieldUpdateOperationsInput | number
    distance?: NullableFloatFieldUpdateOperationsInput | number | null
    duration?: NullableIntFieldUpdateOperationsInput | number | null
    fare?: NullableFloatFieldUpdateOperationsInput | number | null
    surgeMultiplier?: FloatFieldUpdateOperationsInput | number
    suggestedDriverIds?: RideUpdatesuggestedDriverIdsInput | string[]
    offeredDriverIds?: RideUpdateofferedDriverIdsInput | string[]
    rejectedDriverIds?: RideUpdaterejectedDriverIdsInput | string[]
    reassignAttempts?: IntFieldUpdateOperationsInput | number
    acceptedDriverId?: NullableStringFieldUpdateOperationsInput | string | null
    requestedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    pickupAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    offeredAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    assignedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    acceptedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    startedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    completedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    cancelledAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    cancelReason?: NullableStringFieldUpdateOperationsInput | string | null
    cancelledBy?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type RideUncheckedUpdateWithoutTransitionsInput = {
    id?: StringFieldUpdateOperationsInput | string
    customerId?: StringFieldUpdateOperationsInput | string
    driverId?: NullableStringFieldUpdateOperationsInput | string | null
    status?: EnumRideStatusFieldUpdateOperationsInput | $Enums.RideStatus
    vehicleType?: StringFieldUpdateOperationsInput | string
    paymentMethod?: StringFieldUpdateOperationsInput | string
    pickupAddress?: StringFieldUpdateOperationsInput | string
    pickupLat?: FloatFieldUpdateOperationsInput | number
    pickupLng?: FloatFieldUpdateOperationsInput | number
    dropoffAddress?: StringFieldUpdateOperationsInput | string
    dropoffLat?: FloatFieldUpdateOperationsInput | number
    dropoffLng?: FloatFieldUpdateOperationsInput | number
    distance?: NullableFloatFieldUpdateOperationsInput | number | null
    duration?: NullableIntFieldUpdateOperationsInput | number | null
    fare?: NullableFloatFieldUpdateOperationsInput | number | null
    surgeMultiplier?: FloatFieldUpdateOperationsInput | number
    suggestedDriverIds?: RideUpdatesuggestedDriverIdsInput | string[]
    offeredDriverIds?: RideUpdateofferedDriverIdsInput | string[]
    rejectedDriverIds?: RideUpdaterejectedDriverIdsInput | string[]
    reassignAttempts?: IntFieldUpdateOperationsInput | number
    acceptedDriverId?: NullableStringFieldUpdateOperationsInput | string | null
    requestedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    pickupAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    offeredAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    assignedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    acceptedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    startedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    completedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    cancelledAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    cancelReason?: NullableStringFieldUpdateOperationsInput | string | null
    cancelledBy?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type RideStateTransitionCreateManyRideInput = {
    id?: string
    fromStatus?: $Enums.RideStatus | null
    toStatus: $Enums.RideStatus
    actorId?: string | null
    actorType?: string | null
    reason?: string | null
    occurredAt?: Date | string
  }

  export type RideStateTransitionUpdateWithoutRideInput = {
    id?: StringFieldUpdateOperationsInput | string
    fromStatus?: NullableEnumRideStatusFieldUpdateOperationsInput | $Enums.RideStatus | null
    toStatus?: EnumRideStatusFieldUpdateOperationsInput | $Enums.RideStatus
    actorId?: NullableStringFieldUpdateOperationsInput | string | null
    actorType?: NullableStringFieldUpdateOperationsInput | string | null
    reason?: NullableStringFieldUpdateOperationsInput | string | null
    occurredAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type RideStateTransitionUncheckedUpdateWithoutRideInput = {
    id?: StringFieldUpdateOperationsInput | string
    fromStatus?: NullableEnumRideStatusFieldUpdateOperationsInput | $Enums.RideStatus | null
    toStatus?: EnumRideStatusFieldUpdateOperationsInput | $Enums.RideStatus
    actorId?: NullableStringFieldUpdateOperationsInput | string | null
    actorType?: NullableStringFieldUpdateOperationsInput | string | null
    reason?: NullableStringFieldUpdateOperationsInput | string | null
    occurredAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type RideStateTransitionUncheckedUpdateManyWithoutRideInput = {
    id?: StringFieldUpdateOperationsInput | string
    fromStatus?: NullableEnumRideStatusFieldUpdateOperationsInput | $Enums.RideStatus | null
    toStatus?: EnumRideStatusFieldUpdateOperationsInput | $Enums.RideStatus
    actorId?: NullableStringFieldUpdateOperationsInput | string | null
    actorType?: NullableStringFieldUpdateOperationsInput | string | null
    reason?: NullableStringFieldUpdateOperationsInput | string | null
    occurredAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }



  /**
   * Aliases for legacy arg types
   */
    /**
     * @deprecated Use RideCountOutputTypeDefaultArgs instead
     */
    export type RideCountOutputTypeArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = RideCountOutputTypeDefaultArgs<ExtArgs>
    /**
     * @deprecated Use RideDefaultArgs instead
     */
    export type RideArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = RideDefaultArgs<ExtArgs>
    /**
     * @deprecated Use RideStateTransitionDefaultArgs instead
     */
    export type RideStateTransitionArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = RideStateTransitionDefaultArgs<ExtArgs>

  /**
   * Batch Payload for updateMany & deleteMany & createMany
   */

  export type BatchPayload = {
    count: number
  }

  /**
   * DMMF
   */
  export const dmmf: runtime.BaseDMMF
}