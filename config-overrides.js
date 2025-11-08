const path = require('path')
const os = require('os')
const {
  override,
  adjustStyleLoaders,
  addWebpackAlias,
  addWebpackPlugin
} = require('customize-cra')
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer')
// scope hosting
const ModuleConcatenationPlugin = require('webpack/lib/optimize/ModuleConcatenationPlugin')
// 打包加进度条
const ProgressBarPlugin = require('progress-bar-webpack-plugin')
// 打包速度分析
const SpeedMeasureWebpackPlugin = require('speed-measure-webpack-plugin')

// 获取 CPU 核心数，用于 thread-loader 配置
const cpuCount = os.cpus().length

const smp = new SpeedMeasureWebpackPlugin()

/**
 * @param target: 要遍历的对象
 * @param name: 插件名
 * @param callback: 回调函数，第一个参数为该插件对象
 * @return null
 */
function invade(target, name, callback) {
  target.forEach((item) => {
    if (item.constructor.name === name) {
      // eslint-disable-next-line callback-return
      callback(item)
    }
  })
}

module.exports = override(
  // 配置c
  adjustStyleLoaders((rule) => {
    if (rule.test.toString().includes('scss')) {
      rule.use.push({
        loader: require.resolve('sass-resources-loader'),
        options: {
          resources: path.resolve(__dirname, './src/assets/scss/index.scss')
        }
      })
    }
  }),
  // 路径别名
  addWebpackAlias({
    '@src': path.resolve(__dirname, 'src'),
    '@assets': path.resolve(__dirname, 'src/assets'),
    '@utils': path.resolve(__dirname, 'src/utils'),
    '@pages': path.resolve(__dirname, 'src/pages'),
    '@service': path.resolve(__dirname, 'src/service'),
    '@components': path.resolve(__dirname, 'src/components'),
    '@types': path.resolve(__dirname, 'src/types'),
    '@store': path.resolve(__dirname, 'src/store')
  }),
  process.env.NODE_ENV !== 'development' &&
    addWebpackPlugin(
      new ProgressBarPlugin(),
      new ModuleConcatenationPlugin(),
      new BundleAnalyzerPlugin({ analyzerPort: 8919 })
    ),
  // 配置其他选项
  (config) => {
    config.resolve.plugins = []

    // 模块解析优化
    config.resolve.modules = [
      path.resolve(__dirname, 'node_modules'),
      'node_modules'
    ]

    // 文件扩展名解析优化
    config.resolve.extensions = ['.tsx', '.ts', '.jsx', '.js', '.json']

    // 开发环境文件系统监控优化
    if (process.env.NODE_ENV === 'development') {
      config.watchOptions = {
        aggregateTimeout: 500, // 延迟500ms重新构建
        poll: 1000, // 每秒检查一次变化
        ignored: /node_modules/ // 忽略node_modules变化
      }
    }

    // 添加 thread-loader 配置
    const threadLoaderOptions = {
      workers: cpuCount > 4 ? cpuCount - 1 : cpuCount, // 保留一个 CPU 核心给系统
      workerParallelJobs: 50,
      poolTimeout: process.env.NODE_ENV === 'development' ? Infinity : 2000, // 开发环境不超时
      poolParallelJobs: 50,
      name: 'my-pool'
    }

    // 为 JavaScript/TypeScript 文件添加 thread-loader 和 babel 缓存
    const jsRule = config.module.rules.find(
      (rule) =>
        rule.oneOf &&
        rule.oneOf.some(
          (oneOfRule) =>
            oneOfRule.test &&
            oneOfRule.test.toString().includes('js|jsx|ts|tsx')
        )
    )

    if (jsRule && jsRule.oneOf) {
      jsRule.oneOf.forEach((rule) => {
        if (rule.test && rule.test.toString().includes('js|jsx|ts|tsx')) {
          // 在 babel-loader 之前插入 thread-loader
          if (rule.use && Array.isArray(rule.use)) {
            const babelLoaderIndex = rule.use.findIndex(
              (loader) =>
                typeof loader === 'object' &&
                loader.loader &&
                loader.loader.includes('babel-loader')
            )

            if (babelLoaderIndex !== -1) {
              // 配置 babel-loader 缓存
              const babelLoader = rule.use[babelLoaderIndex]
              if (babelLoader.options) {
                babelLoader.options.cacheDirectory = true
                babelLoader.options.cacheCompression = false // 禁用压缩以提升速度
              }

              // 插入 thread-loader
              rule.use.splice(babelLoaderIndex, 0, {
                loader: 'thread-loader',
                options: threadLoaderOptions
              })
            }
          }
        }
      })
    }

    // 为 CSS 文件添加 thread-loader
    const cssRule = config.module.rules.find(
      (rule) => rule.test && rule.test.toString().includes('css')
    )

    if (cssRule && cssRule.oneOf) {
      cssRule.oneOf.forEach((rule) => {
        if (rule.use && Array.isArray(rule.use)) {
          // 在 css-loader 之前插入 thread-loader
          const cssLoaderIndex = rule.use.findIndex(
            (loader) =>
              typeof loader === 'object' &&
              loader.loader &&
              loader.loader.includes('css-loader')
          )

          if (cssLoaderIndex !== -1) {
            rule.use.splice(cssLoaderIndex, 0, {
              loader: 'thread-loader',
              options: threadLoaderOptions
            })
          }
        }
      })
    }

    if (process.env.NODE_ENV === 'development') {
      // 开发环境优化配置

      // 启用 webpack 5 内置缓存提升构建速度
      config.cache = {
        type: 'filesystem',
        buildDependencies: {
          config: [__filename]
        },
        // 缓存目录配置
        cacheDirectory: path.resolve(__dirname, 'node_modules/.cache/webpack'),
        // 缓存版本，当配置变化时自动失效
        version: '1.0'
      }

      // 禁用生产环境优化，提升开发构建速度
      config.optimization = {
        ...config.optimization,
        removeAvailableModules: false,
        removeEmptyChunks: false,
        splitChunks: false, // 开发环境禁用代码分割
        minimize: false, // 开发环境禁用压缩
        usedExports: false, // 禁用tree shaking
        sideEffects: false // 禁用side effects优化
      }

      // 开发环境source map配置，平衡构建速度和调试体验
      config.devtool = 'eval-cheap-module-source-map'

      // 禁用性能提示，减少构建时的警告
      config.performance = {
        hints: false
      }
    }

    if (process.env.NODE_ENV !== 'development') {
      config.devtool = false
      // 针对npm第三方包采用jsnext：main中只想es6模块化的语法文件
      config.resolve.mainFields = ['jsnext:main', 'browser', 'main']

      // 配置代码分割，将第三方库分离成单独的chunk
      // 这样可以实现更好的缓存策略和并行加载，提升页面性能
      config.optimization.splitChunks = {
        // 对所有类型的chunk进行分割（同步和异步）
        chunks: 'all',
        // 缓存组配置，按优先级分组
        cacheGroups: {
          // React 相关库 - 最高优先级
          react: {
            name: 'chunk-react',
            // 匹配 React 相关库
            test: /[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom)[\\/]/,
            priority: 30, // 最高优先级，确保 React 库优先被分割
            chunks: 'all', // 对所有类型的chunk生效
            enforce: true // 强制创建这个chunk，即使小于默认大小限制
          },
          // Ant Design 相关库 - 次高优先级
          antd: {
            name: 'chunk-antd',
            // 匹配 Ant Design 相关库
            test: /[\\/]node_modules[\\/](antd|@ant-design)[\\/]/,
            priority: 25, // 较高优先级
            chunks: 'all',
            enforce: true
          },
          // ECharts 相关库 - 中等优先级
          echarts: {
            name: 'chunk-echarts',
            // 匹配 ECharts 及其依赖库 zrender
            test: /[\\/]node_modules[\\/](echarts|zrender)[\\/]/,
            priority: 20, // 中等优先级
            chunks: 'all',
            enforce: true
          },
          // 其他第三方库 - 较低优先级
          vendors: {
            name: 'chunk-vendors',
            // 匹配所有 node_modules 中的库
            test: /[\\/]node_modules[\\/]/,
            priority: 10, // 较低优先级，避免与特定库冲突
            chunks: 'all',
            enforce: true
          },
          // 公共代码 - 最低优先级
          common: {
            name: 'chunk-common',
            minChunks: 2, // 至少被2个chunk引用的代码才会被分割
            priority: 5, // 最低优先级
            chunks: 'all',
            enforce: true
          }
        }
      }

      // 删除打包后的所有console
      invade(config.optimization.minimizer, 'TerserPlugin', (e) => {
        e.options.parallel = cpuCount > 4 ? cpuCount - 1 : cpuCount
        e.options.extractComments = false
        // 删除console
        e.options.minimizer.options.compress.drop_console = true
        // 删除debugger
        e.options.minimizer.options.compress.drop_debugger = true
        e.options.minimizer.options.compress.pure_funcs = ['config.log']
      })

      // 配置输出文件名，为chunk添加hash以实现更好的缓存策略
      // 使用contenthash:8生成8位hash值，确保内容变化时文件名变化
      config.output.filename = 'static/js/[name].[contenthash:8].js'
      config.output.chunkFilename = 'static/js/[name].[contenthash:8].js'

      // 配置CSS文件输出，同样添加hash
      invade(config.plugins, 'MiniCssExtractPlugin', (e) => {
        e.options.filename = 'static/css/[name].[contenthash:8].css'
        e.options.chunkFilename = 'static/css/[name].[contenthash:8].css'
      })
    }

    // return smp.wrap(config)
    return config
  }
)
