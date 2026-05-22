import { existsSync, mkdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'cypress'
import installTerminalReporter from 'cypress-terminal-report/src/installLogsPrinter'
import { getVitePrebuilder } from 'cypress-vite'

import { checkUserMode } from './cypress/support/utils/test-runner'

try {
  process.loadEnvFile('.env.local')
} catch {
  // file is optional; missing is fine
}

const { vitePrebuild, vitePreprocessor } = getVitePrebuilder({})

const processResultsDir = (resultsDir: string) =>
  process.cwd().endsWith('cypress') && resultsDir.startsWith('cypress')
    ? path.relative('cypress', resultsDir)
    : resultsDir

export default defineConfig({
  video: false,
  screenshotOnRunFailure: true,
  fixturesFolder: false,
  animationDistanceThreshold: 3,
  e2e: {
    baseUrl:
      process.env.CYPRESS_BASE_URL ??
      (process.env.REPLIT_DEV_DOMAIN
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : 'http://localhost:5000'),
    specPattern: [
      'cypress/e2e/create-task.cy.ts',
      'cypress/e2e/create-subtasks.cy.ts',
      'cypress/e2e/assign-subtasks.cy.ts',
      'cypress/e2e/cancel-task-form.cy.ts',
      'cypress/e2e/completed-tasks.cy.ts',
      'cypress/e2e/completed-subtasks.cy.ts',
    ],
    setupNodeEvents(on, config) {
      const userMode = checkUserMode(config.env.userMode)

      const resultsDirRaw = `cypress/results/${userMode}_mode`
      config.screenshotsFolder = `${resultsDirRaw}/screenshots`
      config.videosFolder = `${resultsDirRaw}/videos`
      const resultsDir = processResultsDir(resultsDirRaw)

      // delete previous run folders
      if (config.trashAssetsBeforeRuns && existsSync(resultsDir)) {
        console.log(`Clearing previous test run folder ${resultsDir}`)
        rmSync(resultsDir, { recursive: true, force: true })
        mkdirSync(resultsDir, { recursive: true })
      }

      on('before:run', (details) => vitePrebuild(details, config))
      on('file:preprocessor', vitePreprocessor)

      installTerminalReporter(on, {
        outputVerbose: false,
        compactLogs: 50,
        outputCompactLogs: false, // print all logs to file
        routeTrimLength: 1000, // don't print all GET data
        printLogsToConsole: 'onFail',
        printLogsToFile: 'always',
        outputRoot: resultsDir,
        specRoot: 'cypress/e2e',
        outputTarget: { 'logs|html': 'html' },
      })

      return config
    },
  },
})
