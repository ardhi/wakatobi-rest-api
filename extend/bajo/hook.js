async function hook () {
  return [{
    level: 9,
    name: 'waibuRestApi:preParsing',
    handler: async function (req, reply) {
      const { importModule } = this.app.bajo
      const attachIntl = await importModule('waibu:/lib/webapp-scope/attach-intl.js')
      await attachIntl.call(this, this.config.intl.detectors, req, reply)
      reply.header('Content-Language', req.lang)
      if (this.config.format.asExt && req.params.format) {
        if (!this.config.format.supported.includes(req.params.format)) {
          throw this.error('unsupportedFormat%s', req.params.format, { statusCode: 406 })
        }
      }
    }
  }, {
    name: 'waibu:afterInit',
    handler: async function () {
      this.app.waibu.config.paramsCharMap[this.config.mapSlash] = '/'
      // this.app.waibu.config.paramsCharMap[this.config.mapDot] = '.'
    }
  }]
}

export default hook
