import {join} from 'node:path'

import type {Bud} from '@roots/bud-framework'
import type {EntryObject, Optimization} from '@roots/bud-support/webpack'

export type Parameters = [
  | undefined
  | Optimization.RuntimeChunk
  | ((
      runtime: Optimization.RuntimeChunk | undefined,
    ) => Optimization.RuntimeChunk),
]

export interface runtime {
  (...parameters: Parameters): Promise<Bud>
}

/**
 * Default options for runtime if no options are passed as parameters.
 */
const DEFAULT_RUNTIME: Optimization.RuntimeChunk = {
  name: (entrypoint: EntryObject) => join(`runtime`, `${entrypoint.name}`),
}

export const runtime: runtime = async function (
  this: Bud,
  runtime = DEFAULT_RUNTIME,
) {
  return this.hooks.on(
    `build.optimization.runtimeChunk`,
    runtime === true ? DEFAULT_RUNTIME : runtime,
  )
}
