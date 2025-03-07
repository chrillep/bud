/* eslint-disable no-console */
import {paths} from '@repo/constants'
import {CommandClass} from 'clipanion'
import {ensureDir, pathExists, readJson, rm, writeJson} from 'fs-extra'
import {join} from 'path'

import {Command} from '../base.command'

/**
 * bud registry clean command class
 */
export class RegistryClean extends Command {
  /**
   * Command name
   */
  public static label = `@bud registry clean`

  /**
   * Command paths
   */
  public static paths: CommandClass['paths'] = [
    [`@bud`, `registry`, `clean`],
  ]

  /**
   * Command usage
   */
  public static usage: CommandClass['usage'] = {
    category: `@bud`,
    description: `clean previously published packages`,
    examples: [
      [`clean previously published packages`, `yarn @bud registry clean`],
    ],
  }

  public async execute() {
      try {
        await ensureDir(join(paths.root, `storage/mocks`))
      } catch (e) {}

      try {
        await rm(join(paths.root, `storage/mocks`), {recursive: true})
      } catch (e) {}

      await ensureDir(join(paths.root, `storage`, `packages`))
      await rm(join(paths.root, `storage`, `packages`), {recursive: true})

      const verdaccioDbExists = await pathExists(
        join(paths.root, `storage`, `.verdaccio-db.json`),
      )

      if (verdaccioDbExists) {
        const verdaccioDb = await readJson(
          join(paths.root, `storage`, `.verdaccio-db.json`),
        )
        verdaccioDb.list = []

        await writeJson(
          `${paths.root}/storage/.verdaccio-db.json`,
          verdaccioDb,
        )
      }
  }
}
