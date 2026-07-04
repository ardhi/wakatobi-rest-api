import path from 'path'
import config from './lib/config.js'
import {
  handleResponseXml, extractHeaders, buildPropsReqsForSchema, buildResponseForSchema
} from './lib/helper.js'

/**
 * Plugin factory.
 *
 * **Never** call this function directly!!! It's only-meant to be called by the {@link https://ardhi.github.io/bajo|Bajo framework} during plugin initialization.
 *
 * @param {string} pkgName - NPM package name
 * @returns {WaibuRestApi} WaibuRestApi class
 */
async function factory (pkgName) {
  const me = this
  const { defaultsDeep } = this.app.lib.aneka
  const { importModule, runHook } = this.app.bajo
  const { getPluginPrefix } = this.app.waibu
  const { methodMap, getParams } = this.app.waibuDb
  const { pick, isFunction, merge, cloneDeep, each, get } = this.app.lib._

  /**
   * WaibuRestApi class defniton. This class is used to create a REST API services for Waibu.
   *
   * @class
   */
  class WaibuRestApi extends this.app.baseClass.Base {
    /**
     * Constructor
     */
    constructor () {
      super(pkgName, me.app)
      this.routePathHandlers = ['restapi']
      this.config = config
    }

    /**
     * Initialize the plugin.
     *
     * @async
     * @method
     */
    init = async () => {
      const { uniq } = this.app.lib._
      this.config.format.supported.push('json')
      this.config.format.supported = uniq(this.config.format.supported)
    }

    /**
     * Generate the route path for a given name.
     *
     * @param {string} name - The name of the route
     * @param {Object} [options={}] - Options for route path generation
     * @param {string|boolean} [options.defFormat='.json'] - Default format for the route
     * @param {boolean} [options.uriEncoded=true] - Whether to URI encode the path
     * @returns {string} The generated route path
     */
    routePath = (name, { defFormat = '.json', uriEncoded = true } = {}) => {
      const { get, trimStart } = this.app.lib._
      const { fullPath, ns } = this.app.bajo.breakNsPath(name)
      const prefix = get(this.app[ns], 'config.waibu.prefix', this.app[ns].alias)
      const format = defFormat === false ? '' : (this.config.format.asExt ? defFormat : '')
      let path = `/${this.config.waibu.prefix}/${prefix}${fullPath}${format}`
      if (uriEncoded) path = path.split('/').map(p => encodeURI(p)).join('/')
      return '/' + trimStart(path, '/')
    }

    /**
     * Transform the result before sending the response.
     *
     * @param {Object} param0 - The parameters for transforming the result
     * @param {Object} param0.data - The data to be transformed
     * @param {Object} param0.req - The request object
     * @param {Object} param0.reply - The reply object
     * @param {Object} [param0.options={}] - Additional options for transformation
     * @returns {Object} The transformed result
     */
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

    /**
     * Generate the schema description for a given method.
     *
     * @method
     * @param {string} method - The method name
     * @returns {string} The schema description
     */
    docSchemaDescription = (method) => {
      const desc = {
        create: 'postRecordWithBody',
        find: 'findRecordsWithFilter',
        get: 'getRecordById',
        update: 'updateRecordByIdWithBody',
        remove: 'removeRecordById'
      }
      return this.t(desc[method])
    }

    /**
     * Generate the schema for the "find" operation.
     *
     * @async
     * @method
     * @param {Object} items - The items schema
     * @returns {Object} The schema for the "find" operation
     */
    docSchemaForFind = async (items) => {
      return {
        data: {
          type: 'array',
          items
        },
        limit: { type: 'integer' },
        page: { type: 'integer' },
        pages: { type: 'integer' },
        count: { type: 'integer' },
        success: { type: 'boolean', default: true },
        statusCode: { type: 'integer', default: 200 },
        warnings: { type: 'array' }
      }
    }

    /**
     * Generate the general schema for the API responses.
     *
     * @async
     * @method
     * @returns {Object} The general schema for API responses
     */
    docSchemaGeneral = async () => {
      const cfg = this.config
      const cfgWdb = this.app.waibuDb.config
      const def = {
        type: 'object',
        properties: {
          error: { type: 'string' },
          message: { type: 'string' }
        }
      }
      for (const type of ['4xx', '5xx']) {
        const item = cloneDeep(def)
        if (type === '4xx') {
          merge(item, {
            properties: {
              details: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    field: { type: 'string' },
                    error: { type: 'string' }
                  }
                }
              },
              success: { type: 'boolean', default: false },
              statusCode: { type: 'integer', default: 400 }
            }
          })
        } else {
          merge(item, {
            properties: {
              success: { type: 'boolean', default: false },
              statusCode: { type: 'integer', default: 500 }
            }
          })
        }
        if (cfgWdb.dbModel.dataOnly) item.properties = { error: item.properties.message }
        const props = {}
        each(item.properties, (v, k) => {
          const key = get(cfg, `responseKey.${k}`, k)
          props[key] = item.properties[k]
        })
        item.properties = props
        await this.docSchemaLib(type + 'Resp', item)
      }
      await this.docSchemaParams('qsFilter',
        'query||NQL/Mongo Query. Leave empty to disable query',
        'limit|integer|Number of records per page. Must be >= 1|' + this.app.dobo.config.default.filter.limit,
        'page|integer|Desired page number. Must be >= 1|1',
        'sort||Order of records, format: &lt;field&gt;:&lt;dir&gt;[,&lt;field&gt;:&lt;dir&gt;,[...]]',
        'fields||Comma delimited fields to show. Leave empty to show all fields',
        true
      )
      await this.docSchemaParams('paramsId', 'id||Record ID')
      await this.docSchemaParams('qsFields',
        'fields||Comma delimited fields to show. Leave empty to show all fields',
        true
      )
    }

    /**
     * Add a schema to the library.
     *
     * @async
     * @method
     * @param {string} name - The name of the schema
     * @param {Object} obj - The schema object
     */
    docSchemaLib = async (name, obj) => {
      const { merge } = this.app.lib._
      if (this.webAppCtx.getSchema(name)) return
      const value = merge({}, obj, { $id: name })
      this.webAppCtx.addSchema(value)
    }

    /**
     * Generate the schema for a model method.
     *
     * @async
     * @method
     * @param {Object} param0 - The parameters for generating the schema
     * @param {string} param0.model - The model name
     * @param {string} param0.method - The method name
     * @param {Object} [param0.options={}] - Additional options for schema generation
     * @returns {Object} The generated schema
     */
    docSchemaModel = async ({ model, method, options = {} }) => {
      const mdl = this.app.dobo.getModel(model)
      const { omit } = this.app.lib._
      const out = {
        description: options.description ?? this.docSchemaDescription(method),
        tags: [this.alias.toUpperCase(), ...(options.alias ?? [])]
      }
      if (['find'].includes(method)) {
        out.querystring = { $ref: 'qsFilter#' }
      }
      if (['get', 'update', 'replace', 'remove'].includes(method)) {
        out.querystring = { $ref: 'qsFields#' }
        if (!options.noId) out.params = { $ref: 'paramsId#' }
      }
      if (['update'].includes(method)) {
        const { properties } = await buildPropsReqsForSchema.call(this, { model: mdl, method, options })
        const name = 'model' + mdl.name + 'Update'
        delete properties._ref
        await this.docSchemaLib(name, {
          type: 'object',
          properties: omit(properties, ['id'])
        })
        out.body = { $ref: name + '#' }
      }
      if (['replace'].includes(method)) {
        const { properties, required } = await buildPropsReqsForSchema.call(this, { model: mdl, method, options })
        const name = 'model' + model.name + 'Replace'
        delete properties._ref
        await this.docSchemaLib(name, {
          type: 'object',
          properties: omit(properties, ['id']),
          required
        })
        out.body = { $ref: name + '#' }
      }
      if (['create'].includes(method)) {
        const { properties, required } = await buildPropsReqsForSchema.call(this, { model: mdl, method, options })
        const name = 'model' + model.name + 'Create'
        delete properties._ref
        await this.docSchemaLib(name, {
          type: 'object',
          properties,
          required
        })
        out.body = { $ref: name + '#' }
        out.querystring = { $ref: 'qsFields#' }
      }
      out.response = await buildResponseForSchema.call(this, { model: mdl, method, options })
      return out
    }

    /**
     * Generate the schema for query parameters.
     *
     * @async
     * @method
     * @param {string} paramName - The name of the parameter
     * @param {...string} args - The arguments for the parameter schema
     * @returns {void}
     */
    docSchemaParams = async (paramName, ...args) => {
      const { each, isEmpty, keys, last, isBoolean } = this.app.lib._
      const cfgWeb = this.app.waibu.getConfig()
      let transform = false
      if (isBoolean(last(args))) {
        transform = args.pop()
      }
      const item = {
        type: 'object',
        properties: {}
      }
      each(args, a => {
        let [name, type, description, def] = a.split('|')
        if (isEmpty(type)) type = 'string'
        item.properties[name] = { type, description: this.t(description), default: def }
      })
      if (transform) {
        each(keys(cfgWeb.qsKey), k => {
          const v = cfgWeb.qsKey[k]
          if (k === v || !item.properties[k]) return undefined
          item.properties[v] = item.properties[k]
          delete item.properties[k]
        })
      }
      if (!isEmpty(args)) await this.docSchemaLib(paramName, item)
    }

    /**
     * Generate the schema for query string parameters.
     *
     * @async
     * @method
     * @param {string} paramName - The name of the parameter
     * @param {...string} args - The arguments for the parameter schema
     * @returns {void}
     */
    docSchemaQs = async (paramName, ...args) => {
      const { each, isEmpty } = this.app.lib._
      const item = {
        type: 'object',
        properties: {}
      }
      each(args, a => {
        let [name, type, description] = a.split(':')
        if (isEmpty(type)) type = 'string'
        item.properties[name] = { type, description: this.t(description) }
      })
      if (!isEmpty(args)) await this.docSchemaLib(paramName, item)
    }

    /**
     * Handle not found errors.
     *
     * @async
     * @method
     * @param {Object} [err={}] - The error object
     * @param {Object} req - The request object
     * @param {Object} reply - The reply object
     * @returns {Object} The transformed result
     */
    _handleNotFound = async (err = {}, req, reply) => {
      const msg = this.t('routeNotFound%s%s', req.url, req.method)
      const data = this.webAppCtx.httpErrors.createError(404, msg)
      return this.transformResult({ data, req, reply })
    }

    /**
     * Handle general errors.
     *
     * @async
     * @method
     * @param {Object} err - The error object
     * @param {Object} req - The request object
     * @param {Object} reply - The reply object
     * @returns {Object} The transformed result
     */
    _handleError = async (err, req, reply) => {
      err.statusCode = err.statusCode ?? 500
      const msg = err.message
      if (msg === '_notFound' || err.statusCode === 404) {
        return this._handleNotFound(err, req, reply)
      }
      const data = this.webAppCtx.httpErrors.createError(err.statusCode, msg)
      data.statusCode = err.statusCode
      data.details = err.details
      return this.transformResult({ data, req, reply })
    }

    /**
     * Handle the response.
     *
     * @async
     * @method
     * @returns {void}
     */
    _handleResponse = async () => {
      const me = this

      this.webAppCtx.addHook('onSend', async function (req, reply, payload) {
        let type = req.params.format
        if (!type) {
          const types = req.accepts().types()
          if (me.config.format.supported.includes('xml') && types[0] === 'application/xml') type = 'xml'
          else type = 'json'
        }
        let result = payload
        switch (type) {
          case 'xml': result = await handleResponseXml.call(me, req, reply, payload); break
        }
        return result
      })
    }

    /**
     * Serve a route.
     *
     * @async
     * @method
     * @param {Object} options - The options for serving the route
     * @param {Object} options.mod - The module object
     * @param {string} options.ns - The namespace
     * @param {string} [options.parent] - The parent namespace
     * @returns {Object} The served route
     */
    _serveRoute = async (options) => {
      let { mod, ns, parent } = options
      const { mergeRouteHooks } = await importModule('waibu:/lib/webapp.js', { asDefaultImport: false })
      const cfgWdb = this.app.waibuDb.config
      mod.config = mod.config ?? {}
      mod.config.prefix = getPluginPrefix(ns, 'waibuRestApi')
      mod.config.pathSrc = mod.url
      mod.config.webApp = parent ?? ns
      mod.config.ns = ns
      mod.config.subNs = 'restapi'
      mod.config.xSite = mod.xSite
      mod.config.title = mod.title
      delete mod.title
      if (mod.method === 'PUT' && cfgWdb.dbModel.patchEnabled) mod.method = [mod.method, 'PATCH']
      mod = defaultsDeep(pick(this.config, ['exposeHeadRoute', 'bodyLimit']), mod)
      await mergeRouteHooks.call(this, mod, false) // Don't include handler, hence 'false'
      return mod
    }

    /**
     * Build a route based on the model configuration.
     *
     * @async
     * @method
     * @param {Object} options - The options for building the route
     * @param {string} options.file - The file path of the model configuration
     * @param {string} options.dir - The directory of the model configuration
     * @param {string} options.pathPrefix - The path prefix for the route
     * @param {string} options.ns - The namespace
     * @param {string} [options.parent] - The parent namespace
     * @returns {Object} The built route
     */
    _routeByModelBuilder = async (options) => {
      const { file, dir, pathPrefix, ns, parent } = options
      const { readConfig } = this.app.bajo
      const { pascalCase } = this.app.lib.aneka
      const { methodMap, getParams } = this.app.waibuDb
      const { isFunction, camelCase, omit, merge, keys, filter } = this.app.lib._
      const builder = await readConfig(file, { ns, ignoreError: true })
      builder.disabled = builder.disabled ?? []
      let url = path.dirname(file).replace(`${dir}/extend/${pathPrefix}`, '').replaceAll('@', ':')
      if (isFunction(builder.url)) url = await builder.url.call(this)
      const methods = keys(methodMap)
      if (this.config.enablePatch) methods.push('replace')
      const me = this
      const mods = []
      let model = {}
      if (!builder.model.startsWith(':')) model = this.app.dobo.getModel(builder.model)
      for (const method of methods) {
        let disabled = (model.disabled ?? []).includes(method) || builder.disabled.includes(method)
        if (method === 'replace' && ((model.disabled ?? []).includes('update') || (builder.disabled ?? []).includes('update'))) disabled = true
        if (disabled) continue
        const mod = omit(builder, ['model', 'url', 'method', 'handler', 'hidden', ...methods])
        const customMod = builder[method] ?? {}
        customMod.schema = customMod.schema ?? false
        if (customMod.schema === true && !builder.model.startsWith(':')) customMod.schema = await this.docSchemaModel({ model: builder.model, method, options: { hidden: builder.hidden } })
        let mapmethod = methodMap[method]
        if (this.config.enablePatch) {
          if (method === 'replace') mapmethod = 'PUT'
          else if (method === 'update') mapmethod = 'PATCH'
        }
        merge(mod, customMod, {
          url: ['get', 'update', 'replace', 'remove'].includes(method) ? `${url}/:id` : url,
          method: mapmethod,
          handler: async function (req, reply) {
            const helper = me.app.waibuDb[`${method === 'replace' ? 'update' : method}Record`]
            const { fields } = getParams(req)
            const options = { fields, dynHooks: builder.hooks ?? [] }
            extractHeaders.call(me, req, options)
            options.hidden = builder.hidden ?? []
            options.queryHandler = builder.queryHandler
            if (method === 'replace') options.partial = false
            if (['get', 'remove', 'update'].includes(method)) options.throwNotFound = true
            const model = builder.model.startsWith(':') ? pascalCase(req.params[builder.model.slice(1)]) : builder.model
            const data = await helper({ model, req, reply, options, transaction: builder.transaction })
            data.success = true
            data.statusCode = method === 'create' ? 201 : 200
            if (method === 'find') options.forFind = true
            return me.transformResult({ data, req, reply, options })
          }
        })
        if (mod.schema === false) delete mod.schema
        mod.config = mod.config ?? {}
        mod.config.pathSrc = url
        mods.push(await me._serveRoute({ mod, ns, parent }))
      }
      // stats
      const supported = ['aggregate', 'histogram']
      builder.stat = filter(builder.stat ?? supported, item => supported.includes(item))
      const method = 'GET'
      const disabled = (model.disabled ?? []).includes(method) || builder.disabled.includes(method)
      if (disabled) return mods
      const mod = {
        schema: false,
        method,
        url: `${url}/stat/:stat`,
        handler: async function (req, reply) {
          if (!supported.includes(req.params.stat)) throw me.error('_notFound')
          const helper = me.app.waibuDb[camelCase(`create ${req.params.stat}`)]
          if (!helper) throw me.error('_notFound')
          const options = { queryHandler: builder.queryHandler }
          const model = builder.model.startsWith(':') ? pascalCase(req.params[builder.model.slice(1)]) : builder.model
          const data = await helper({ model, req, reply, options })
          data.success = true
          data.statusCode = method === 'create' ? 201 : 200
          options.forFind = true
          return me.transformResult({ data, req, reply, options })
        }
      }
      mod.config = builder.config ?? {}
      mod.config.pathSrc = url
      mods.push(await me._serveRoute({ mod, ns, parent }))
      return mods
    }

    /**
     * Build a route based on the HTTP verb.
     *
     * @async
     * @method
     * @param {Object} options - The options for building the route
     * @param {string} options.file - The file path of the route configuration
     * @param {Object} options.appCtx - The application context
     * @param {string} options.dir - The directory of the route configuration
     * @param {string} options.pathPrefix - The path prefix for the route
     * @param {string} options.ns - The namespace
     * @param {string} options.alias - The alias for the route
     * @param {string} [options.parent] - The parent namespace
     * @returns {Object} The built route
     */
    _routeByVerb = async (options) => {
      const { file, appCtx, dir, pathPrefix, ns, alias, parent } = options
      const me = this
      const url = path.dirname(file).replace(`${dir}/extend/${pathPrefix}`, '')
        .replaceAll('@@', '*').replaceAll('@', ':')
      const action = path.basename(file, '.js')
      let method = methodMap[action]
      if (this.enablePatch) {
        if (action === 'update') method = 'PATCH'
        else if (action === 'replace') method = 'PUT'
      }
      let mod = await importModule(file)
      if (isFunction(mod)) {
        if (mod.length <= 1) mod = await mod.call(this)
        else mod = { handler: mod }
      }
      mod.url = mod.url ?? url
      if (isFunction(mod.url)) mod.url = await mod.url.call(this)
      mod.method = method
      const defSchema = {
        description: this.docSchemaDescription(action),
        tags: [alias.toUpperCase()],
        response: {}
      }
      if (['create', 'update', 'replace'].includes(action)) {
        defSchema.response['4xx'] = {
          description: this.t('docErrorResponse'),
          $ref: '4xxResp#'
        }
      }
      defSchema.response['5xx'] = {
        description: this.t('generalErrorResponse'),
        $ref: '5xxResp#'
      }
      if (action === 'find') defSchema.querystring = { $ref: 'qsFilter#' }
      if (isFunction(mod.schema)) mod.schema = await mod.schema.call(this, appCtx)
      mod.schema = merge({}, defSchema, mod.schema ?? {})
      const oldHandler = mod.handler
      mod.handler = async function (req, reply) {
        const { fields } = getParams(req)
        const options = { fields, dynHooks: mod.hooks ?? [] }
        extractHeaders.call(me, req, options)
        if (method === 'find') options.forFind = true
        if (method === 'replace') options.partial = false
        const data = await oldHandler.call(me.app[ns], req, reply, options, this)
        if (!data) return
        data.success = true
        data.statusCode = method === 'create' ? 201 : 200
        return me.transformResult({ data, req, reply, options })
      }
      if (mod.schema === false) delete mod.schema
      mod.config = mod.config ?? {}
      mod.config.pathSrc = url
      return me._serveRoute({ mod, ns, parent })
    }

    /**
     * Handle sub-applications by collecting and registering their routes.
     *
     * @async
     * @method
     */
    _handleSubApp = async () => {
      const { collectWebApps } = await importModule('waibu:/lib/helper.js', { asDefaultImport: false })
      const mods = await collectWebApps.call(this.app[this.ns], 'boot.js', 'waibuRestApi')
      for (const m of mods) {
        this.log.debug('bootSubApp%s', m.ns)
        await this.webAppCtx.register(async (subCtx) => {
          this.app[m.ns].instance = subCtx
          await runHook(`${this.ns}.${m.alias}:afterCreateContext`, subCtx)
          await m.handler.call(this.app[m.ns], subCtx, m.prefix)
        }, { prefix: m.prefix })
      }
    }
  }

  return WaibuRestApi
}

export default factory
