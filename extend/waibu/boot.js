import path from 'path'
import decorate from '../../lib/decorate.js'
import routeByModelBuilder from '../../lib/route-by-model-builder.js'
import routeByVerb from '../../lib/route-by-verb.js'
import notFoundHandler from '../../lib/not-found.js'
import errorHandler from '../../lib/error.js'
import subApp from '../../lib/sub-app.js'
import handleResponse from '../../lib/handle-response.js'

const routeActions = { routeByModelBuilder, routeByVerb }

function formatExt (item) {
  return item + '.:format'
}

const boot = {
  level: 10,
  notFoundHandler,
  errorHandler,
  handler: async function (prefix) {
    const { importPkg, eachPlugins, importModule, runHook } = this.app.bajo
    const { fastGlob } = this.app.lib
    const { getPluginPrefix, isRouteDisabled } = this.app.waibu
    const [bodyParser, accepts] = await importPkg('waibu:@fastify/formbody', 'waibu:@fastify/accepts')
    const routeHook = await importModule('waibu:/lib/webapp-scope/route-hook.js')
    const handleMultipart = await importModule('waibu:/lib/webapp-scope/handle-multipart-body.js')
    const handleXmlBody = await importModule('waibu:/lib/handle-xml-body.js')
    const handleCors = await importModule('waibu:/lib/webapp-scope/handle-cors.js')
    const handleHelmet = await importModule('waibu:/lib/webapp-scope/handle-helmet.js')
    const handleCompress = await importModule('waibu:/lib/webapp-scope/handle-compress.js')
    const handleRateLimit = await importModule('waibu:/lib/webapp-scope/handle-rate-limit.js')
    const reroutedPath = await importModule('waibu:/lib/webapp-scope/rerouted-path.js')

    const pathPrefix = `${this.ns}/route`
    await this.docSchemaGeneral()
    await routeHook.call(this, this.ns)
    await decorate.call(this)
    if (this.config.format.supported.includes('xml')) {
      await handleXmlBody.call(this, this.config.format.xml.bodyParser)
    }
    await this.webAppCtx.register(accepts)
    await this.webAppCtx.register(bodyParser)
    await handleRateLimit.call(this, this.config.rateLimit)
    await handleCors.call(this, this.config.cors)
    await handleHelmet.call(this, this.config.helmet)
    await handleMultipart.call(this, this.config.multipart)
    await handleCompress.call(this, this.config.compress)
    await handleResponse.call(this)
    await runHook(`${this.ns}:beforeCreateRoutes`, this.webAppCtx)
    const actions = ['find', 'get', 'create', 'update', 'remove']
    if (this.config.enablePatch) actions.push('replace')
    const me = this

    await eachPlugins(async function ({ dir }) {
      const { ns, alias } = this
      const appPrefix = '/' + (ns === me.app.mainNs ? '' : getPluginPrefix(ns, 'waibuRestApi'))
      const pattern = [
        `${dir}/extend/${pathPrefix}/**/{${actions.join(',')}}.js`,
        `${dir}/extend/${pathPrefix}/**/model-builder.*`
      ]
      const files = await fastGlob(pattern)
      if (files.length === 0) return undefined
      await me.webAppCtx.register(async (appCtx) => {
        for (const file of files) {
          const base = path.basename(file, path.extname(file))
          const action = base === 'model-builder' ? 'routeByModelBuilder' : 'routeByVerb'
          let mods = await routeActions[action].call(me, { file, appCtx, dir, pathPrefix, ns, alias, parent: me.ns })
          if (!Array.isArray(mods)) mods = [mods]
          for (const mod of mods) {
            const fullPath = appPrefix === '/' ? mod.url : (appPrefix + mod.url)
            if (isRouteDisabled(`${prefix === '' ? '' : `/${prefix}`}${fullPath}`)) continue
            const rpath = await reroutedPath.call(this, fullPath, me.config.rerouted)
            if (me.config.format.asExt) mod.url = formatExt(mod.url)
            if (rpath) {
              mod.config.pathReroutedTo = rpath
              this.log.warn('rerouted%s%s', `${prefix}${fullPath}`, `${prefix}${rpath}`)
              mod.url = me.config.format.asExt ? formatExt(rpath) : rpath
              me.webAppCtx.route(mod)
            } else appCtx.route(mod)
          }
        }
      }, { prefix: appPrefix })
    })
    await runHook(`${this.ns}:afterCreateRoutes`, this.webAppCtx)
    await subApp.call(this)
  }
}

export default boot
