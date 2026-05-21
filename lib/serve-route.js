async function serveRoute ({ mod, ns, parent }) {
  const { defaultsDeep } = this.app.lib.aneka
  const { importModule } = this.app.bajo
  const { getPluginPrefix } = this.app.waibu
  const { pick } = this.app.lib._
  const mergeRouteHooks = await importModule('waibu:/lib/webapp-scope/merge-route-hooks.js')
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

export default serveRoute
