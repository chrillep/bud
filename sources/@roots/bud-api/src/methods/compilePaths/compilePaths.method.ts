import type {Bud, Rule} from '@roots/bud-framework'
import isArray from '@roots/bud-support/lodash/isArray'
import isUndefined from '@roots/bud-support/lodash/isUndefined'

import type {Parameters} from './compilePaths.types.js'

export interface compilePaths {
  (this: Bud, ...value: Parameters): Bud
}

export const compilePaths: compilePaths = function (
  this: Bud,
  sources,
  rules,
) {
  this.hooks.action(`build.before`, async bud => {
    if (isUndefined(bud)) return

    const matches: Array<Rule> = !isUndefined(rules)
      ? rules.map(rule => {
          const match = bud.build.getRule(rule)
          if (!match) {
            const error = new Error(
              `\`${rule}\` is not a valid rule name. Valid rule names include: ${Object.keys(
                bud.build.rules,
              ).join(`, `)}`,
            )
            error.name = `bud.compilePaths: invalid rule name`
            throw error
          }
          return match
        })
      : Object.values(bud.build.rules)

    matches.map(rule =>
      rule.setInclude(isArray(sources) ? sources : [sources]),
    )
  })

  return this
}
