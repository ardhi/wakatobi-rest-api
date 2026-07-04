/**
 * @typedef {Object} TConfig
 * @property {Object} [waibu={}] - Waibu configuration
 * @property {string} [waibu.prefix='api'] - Prefix for the Waibu REST API routes
 * @property {boolean} [mountMainAsRoot=true] - Whether to mount the main route as root
 * @property {boolean} [exposeHead=true] - Whether to expose the HEAD method
 * @property {boolean} [enablePatch=false] - Whether to enable the PATCH method
 * @property {number} [bodyLimit=1048576] - Maximum size of the request body in bytes
 * @property {Object} [intl={}] - Internationalization configuration
 * @property {Array<string>} [intl.detectors=['qs', 'header']] - List of detectors for internationalization
 * @property {Object} [format={}] - Format configuration
 * @property {Array<string>} [format.supported=['json', 'xml']] - List of supported formats (e.g., 'json', 'xml')
 * @property {boolean} [format.asExt=false] - Whether to use file extensions for format detection
 * @property {Object} [format.xml={}] - XML format configuration
 * @property {Object} [format.xml.bodyParser={}] - XML body parser configuration
 * @property {Array<string>} [format.xml.bodyParser.contentTypes=['text/xml', 'application/xml', 'application/rss+xml']] - List of content types for XML body parsing
 * @property {boolean} [format.xml.bodyParser.validate=false] - Whether to validate XML body
 * @property {Object} [format.xml.response={}] - XML response configuration
 * @property {string} [format.xml.response.wrapper='doc'] - Wrapper element for XML response
 * @property {boolean} [format.xml.response.declaration=true] - Whether to include XML declaration in response
 * @property {boolean} [format.xml.response.valueAsAttributes=true] - Whether to treat values as attributes in XML response
 * @property {Object} [responseKey={}] - Response key mapping configuration
 * @property {string} [responseKey.data='data'] - Key for data in the response
 * @property {string} [responseKey.oldData='oldData'] - Key for old data in the response
 * @property {string} [responseKey.page='page'] - Key for page number in the response
 * @property {string} [responseKey.count='count'] - Key for count
 * @property {string} [responseKey.pages='pages'] - Key for total pages
 * @property {string} [responseKey.success='success'] - Key for success status
 * @property {string} [responseKey.statusCode='code'] - Key for status code
 * @property {string} [responseKey.error='error'] - Key for error message
 * @property {string} [responseKey.cached='cached'] - Key for cached status
 * @property {string} [responseKey.hardCapped='hardCapped'] - Key for hard capped status
 * @property {string} [responseKey.message='message'] - Key for message
 * @property {string} [responseKey.warnings='warnings'] - Key for warnings
 * @property {string} [responseKey.details='details'] - Key for details
 */
const config = {
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

export default config
