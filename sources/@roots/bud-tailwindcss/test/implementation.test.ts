import {join} from 'node:path'
import {paths} from '@repo/constants'
import execa, {ExecaReturnValue} from '@roots/bud-support/execa'
import {beforeAll, describe, expect, it} from 'vitest'
import fs from '@roots/bud-support/fs-jetpack'

describe(`@tests/tailwind-implementation`, () => {
  let child: ExecaReturnValue

  beforeAll(async () => {
    await execa(`yarn`, [
      `bud`,
      `clean`,
      `--cwd`,
      `sources/@roots/bud-tailwindcss/test/implementation`,
    ])

    try {
      child = await execa(`yarn`, [
        `bud`,
        `build`,
        `--no-cache`,
        `--debug`,
        `--cwd`,
        `sources/@roots/bud-tailwindcss/test/implementation`,
      ])
    } catch (error) {}
  }, 30000)

  it(`should generate bg-primary class`, async () => {
    expect(
      await fs.existsAsync(
        join(
          paths.sources,
          `@roots`,
          `bud-tailwindcss`,
          `test`,
          `implementation`,
          `dist`,
          `css`,
          `main.css`,
        ),
      ),
    ).toBe(`file`)
    expect(
      await fs.readAsync(
        join(
          paths.sources,
          `@roots`,
          `bud-tailwindcss`,
          `test`,
          `implementation`,
          `dist`,
          `css`,
          `main.css`,
        ),
      ),
    ).toEqual(expect.stringContaining(`.bg-primary{`))
  })
})
