import { defineUntypedSchema } from 'untyped'

export default defineUntypedSchema({
  /** @private */
  _majorVersion: 3,
  /** @private */
  _legacyGenerate: false,
  /** @private */
  _start: false,
  /** @private */
  _build: false,
  /** @private */
  _generate: false,
  /** @private */
  _prepare: {
    $resolve: val => val ?? false
  },
  _layers: {
    $resolve: val => val ?? []
  },
  /** @private */
  _cli: false,
  /** @private */
  _requiredModules: {},
  /** @private */
  _nuxtConfigFile: undefined,
  /** @private */
  _nuxtConfigFiles: [],
  /** @private */
  appDir: '',
  /** @private */
  _installedModules: [],
  /** @private */
  _modules: [],
})
