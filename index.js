import docSchemaDescription from './lib/doc-schema/description.js'
import docSchemaForFind from './lib/doc-schema/for-find.js'
import docSchemaGeneral from './lib/doc-schema/general.js'
import docSchemaLib from './lib/doc-schema/lib.js'
import docSchemaModel from './lib/doc-schema/model.js'
import docSchemaParams from './lib/doc-schema/params.js'
import docSchemaQs from './lib/doc-schema/qs.js'

/**
 * Plugin factory
 *
 * @param {string} pkgName - NPM package name
 * @returns {class}
 */
async function factory (pkgName) {
  const me = this

  /**
   * WaibuRestApi class
   *
   * @class
   */
  class WaibuRestApi extends this.app.baseClass.Base {
    constructor () {
      super(pkgName, me.app)
      this.routePathHandlers = ['restapi']
      this.config = {
        waibu: {
          prefix: 'api'
        },
        mountMainAsRoot: true,
        exposeHead: true,
        enablePatch: false,
        bodyLimit: 1048576,
        intl: {
          detectors: ['qs', 'header']
        },
        format: {
          supported: ['json', 'xml'],
          asExt: false,
          xml: {
            bodyParser: {
              contentTypes: ['text/xml', 'application/xml', 'application/rss+xml'],
              validate: false
            },
            response: {
              wrapper: 'doc',
              declaration: true,
              valueAsAttributes: true
            }
          }
        },
        responseKey: {
          data: 'data',
          oldData: 'oldData',
          page: 'page',
          count: 'count',
          pages: 'pages',
          success: 'success',
          statusCode: 'code',
          error: 'error',
          cached: 'cached',
          hardCapped: 'hardCapped',
          message: 'message',
          warnings: 'warnings',
          details: 'details'
        },
        mapSlash: '~',
        mapDot: ',',
        multipart: {
        },
        cors: {},
        helmet: {},
        compress: false,
        rateLimit: false,
        disabled: [],
        rerouted: {}
      }

      this.selfBind([
        'docSchemaDescription',
        'docSchemaForFind',
        'docSchemaGeneral',
        'docSchemaLib',
        'docSchemaModel',
        'docSchemaParams',
        'docSchemaQs'
      ])
    }

    init = async () => {
      const { uniq } = this.app.lib._
      this.config.format.supported.push('json')
      this.config.format.supported = uniq(this.config.format.supported)
    }

    routePath = (name, { defFormat = '.json', uriEncoded = true } = {}) => {
      const { get, trimStart } = this.app.lib._
      const { fullPath, ns } = this.app.bajo.breakNsPath(name)
      const prefix = get(this.app[ns], 'config.waibu.prefix', this.app[ns].alias)
      const format = defFormat === false ? '' : (this.config.format.asExt ? defFormat : '')
      let path = `/${this.config.waibu.prefix}/${prefix}${fullPath}${format}`
      if (uriEncoded) path = path.split('/').map(p => encodeURI(p)).join('/')
      return '/' + trimStart(path, '/')
    }

    transformResult = ({ data, req, reply, options = {} }) => {
      const reformat = ({ data, req, reply, options = {} }) => {
        const { forOwn, get } = this.app.lib._
        const newData = {}
        forOwn(data, (v, k) => {
          let key = get(this.config, `responseKey.${k}`)
          if (options.forFind && k === 'data') key = get(this.config, 'responseKey.data')
          if (!key) return undefined
          newData[key] = v
        })
        return newData
      }

      const returnError = ({ data, req, reply, options = {} }) => {
        const { pascalCase } = this.app.lib.aneka
        const { last, map, kebabCase, upperFirst, keys, each, get, isEmpty } = this.app.lib._
        const cfg = this.config
        const cfgWdb = this.app.waibuDb.config
        const errNames = kebabCase(data.constructor.name).split('-')
        if (last(errNames) === 'error') errNames.pop()
        data.error = this.t(map(errNames, s => upperFirst(s)).join(' '))
        data.success = false
        data.statusCode = data.statusCode ?? 500
        if (reply && cfgWdb.dbModel.dataOnly) {
          each(keys(data), k => {
            const key = get(cfg, `responseKey.${k}`, k)
            if (k === 'details' && !isEmpty(data[k])) data[k] = JSON.stringify(data[k])
            reply.header(`X-${pascalCase(this.alias)}-${pascalCase(key)}`, data[k])
          })
        }
        reply.code(data.statusCode)
        const result = cfgWdb.dbModel.dataOnly ? { error: data.message } : data
        return reformat.call(this, { data: result, req, reply, options })
      }

      const returnSuccess = ({ data, req, reply, options = {} }) => {
        const { pascalCase } = this.app.lib.aneka
        const { each, keys, omit, get } = this.app.lib._
        const cfg = this.config
        const cfgWdb = this.app.waibuDb.config
        if (!options.showWarnings) delete data.warnings
        if (reply) {
          reply.code(req.method.toUpperCase() === 'POST' ? 201 : 200)
          if (cfgWdb.dbModel.dataOnly) {
            each(keys(omit(data, ['data'])), k => {
              const key = get(cfg, `responseKey.${k}`, k)
              reply.header(`X-${pascalCase(this.alias)}-${pascalCase(key)}`, data[k])
            })
            return data.data
          }
        }
        return reformat({ data, req, reply, options })
      }

      const isError = data instanceof Error
      if (isError) return returnError({ data, req, reply, options })
      return returnSuccess({ data, req, reply, options })
    }

    docSchemaDescription = docSchemaDescription
    docSchemaForFind = docSchemaForFind
    docSchemaGeneral = docSchemaGeneral
    docSchemaLib = docSchemaLib
    docSchemaModel = docSchemaModel
    docSchemaParams = docSchemaParams
    docSchemaQs = docSchemaQs
  }

  return WaibuRestApi
}

export default factory
