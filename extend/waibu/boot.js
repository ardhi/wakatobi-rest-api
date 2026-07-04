import path from 'path'

function formatExt (item) {
  return item + '.:format'
}

const boot = {
  level: 10,
  handler: async function (prefix) {
    const { importPkg, eachPlugins, importModule, runHook } = this.app.bajo
    const { fastGlob } = this.app.lib
    const { getPluginPrefix, isRouteDisabled } = this.app.waibu
    const [bodyParser, accepts] = await importPkg('waibu:@fastify/formbody', 'waibu:@fastify/accepts')
    const {
      routeHook, handleMultipartBody, handleXmlBody, handleCors, handleHelmet, handleCompress,
      handleRateLimit, reroutedPath
    } = await importModule('waibu:/lib/webapp.js', { asDefaultImport: false })

    const pathPrefix = `${this.ns}/route`
    await this.docSchemaGeneral()
    await routeHook.call(this, this.ns)
    if (this.config.format.supported.includes('xml')) {
      await handleXmlBody.call(this, this.config.format.xml.bodyParser)
    }
    await this.webAppCtx.register(accepts)
    await this.webAppCtx.register(bodyParser)
    await handleRateLimit.call(this, this.config.rateLimit)
    await handleCors.call(this, this.config.cors)
    await handleHelmet.call(this, this.config.helmet)
    await handleMultipartBody.call(this, this.config.multipart)
    await handleCompress.call(this, this.config.compress)
    await this._handleResponse()
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
          let mods
          if (base === 'model-builder') mods = await me._routeByModelBuilder({ file, dir, pathPrefix, ns, parent: me.ns })
          else mods = await me._routeByVerb({ file, appCtx, dir, pathPrefix, ns, alias, parent: me.ns })

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
    await this._handleSubApp()
  }
}

export default boot
