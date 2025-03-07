import {pathToFileURL} from 'node:url'

import * as App from '@roots/bud-dashboard/app'
import type {Bud} from '@roots/bud-framework/bud'
import {Service} from '@roots/bud-framework/service'
import type {Compiler as Contract} from '@roots/bud-framework/services'
import {bind} from '@roots/bud-support/decorators'
import {duration} from '@roots/bud-support/human-readable'
import type {
  ErrorWithSourceFile,
  SourceFile,
} from '@roots/bud-support/open'
import React from '@roots/bud-support/react'
import stripAnsi from '@roots/bud-support/strip-ansi'
import type webpack from '@roots/bud-support/webpack'
import type {
  MultiCompiler,
  MultiStats,
  StatsCompilation,
  StatsError,
} from '@roots/bud-support/webpack'

/**
 * Wepback compilation controller class
 */
export class Compiler extends Service implements Contract.Service {
  /**
   * Compiler implementation
   */
  public implementation: typeof webpack

  /**
   * Compiler instance
   */
  public instance: Contract.Service[`instance`]

  /**
   * Compilation stats
   */
  public stats: Contract.Service[`stats`]

  /**
   * Configuration
   */
  public config: Contract.Service[`config`] = []

  /**
   * Initiates compilation
   */
  @bind
  public async compile(): Promise<MultiCompiler> {
    this.implementation = await this.app.module.import(`webpack`)
    this.logger.log(`imported webpack`, this.implementation.version)

    this.config = !this.app.hasChildren
      ? [await this.app.build.make()]
      : await Promise.all(
          Object.values(this.app.children).map(async (child: Bud) => {
            try {
              return await child.build.make()
            } catch (error) {
              throw error
            }
          }),
        )

    await this.app.hooks.fire(`compiler.before`, this.app)

    if (this.app.isCLI() && this.app.context.args.dry) {
      this.app.context.logger.timeEnd(`initialize`)
      this.logger.log(`running in dry mode. exiting early.`)
      return
    }

    this.app.context.logger.timeEnd(`initialize`)

    this.instance = this.implementation(this.config)

    this.instance.hooks.done.tap(this.app.label, async (stats: any) => {
      await this.onStats(stats)
      await this.app.hooks.fire(`compiler.close`, this.app)
    })

    await this.app.hooks.fire(`compiler.after`, this.app)

    return this.instance
  }

  /**
   * Stats handler
   */
  @bind
  public async onStats(stats: MultiStats) {
    const makeNoticeTitle = (child: StatsCompilation) =>
      this.app.label !== child.name
        ? `${this.app.label} (${child.name})`
        : child.name

    this.stats = stats.toJson(this.app.hooks.filter(`build.stats`))

    await this.app.hooks.fire(`compiler.stats`, stats)

    const statsUpdate = this.app.dashboard.update(stats)

    if (stats.hasErrors()) {
      process.exitCode = 1

      this.stats.children = this.stats.children?.map(child => ({
        ...child,
        errors: this.sourceErrors(child.errors),
      }))

      this.stats.children
        ?.filter(child => child.errorsCount > 0)
        .forEach(child => {
          const error = child.errors?.shift()
          if (!error) return
          this.app.notifier.notify({
            title: makeNoticeTitle(child),
            subtitle: error.file ? `Error in ${error.name}` : error.name,
            message: stripAnsi(error.message),
            open: error.file ? pathToFileURL(error.file) : ``,
            group: `${this.app.label}-${child.name}`,
          })
          this.app.notifier.openEditor(error.file)
        })
    }

    this.stats.children
      ?.filter(child => child.errorsCount === 0)
      .forEach(child => {
        this.app.notifier.notify({
          title: makeNoticeTitle(child),
          subtitle: `Build successful`,
          message: child.modules
            ? `${child.modules.length} modules compiled in ${duration(
                child.time,
              )}`
            : `Compiled in ${duration(child.time)}`,
          group: `${this.app.label}-${child.name}`,
          open: this.app.server?.publicUrl.href,
        })
        this.app.notifier.openBrowser(this.app.server?.publicUrl.href)
      })

    await statsUpdate
  }

  /**
   * Compiler error event
   */
  @bind
  public async onError(error: Error) {
    process.exitCode = 1

    await this.app.hooks.fire(`compiler.error`, error)

    this.app.isDevelopment &&
      this.app.server.appliedMiddleware?.hot?.publish({error})

    this.app.notifier.notify({
      subtitle: error.name,
      message: error.message,
      group: this.app.label,
    })

    await this.app.dashboard.renderer.once(
      <App.Error
        name="Compiler error"
        message={error.message}
        stack={error.stack}
      />,
    )
  }

  /**
   * Parse errors from webpack stats
   */
  @bind
  public sourceErrors(
    errors: Array<StatsError>,
  ): Array<ErrorWithSourceFile | StatsError> {
    if (!errors || !errors.length) return []

    try {
      const parseError = (
        error: StatsError,
      ): ErrorWithSourceFile | StatsError => {
        let file: SourceFile[`file`] | undefined

        const modules = this.stats.children.flatMap(child => child.modules)
        const moduleIdent = error.moduleId ?? error.moduleName

        const module = modules.find(
          module =>
            module?.id === moduleIdent || module?.name === moduleIdent,
        )

        if (!module) {
          return error
        }

        if (module.nameForCondition) {
          file = module.nameForCondition
        } else if (module.name) {
          file = this.app.path(`@src`, module.name)
        }

        if (!file) {
          return error
        }

        return {...error, name: module.name ?? error.name, file}
      }

      return errors?.map(parseError).filter(Boolean)
    } catch (error) {
      this.app.warn(`error parsing errors`, error)
      return []
    }
  }
}
