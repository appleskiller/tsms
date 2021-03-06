const fs = require('fs-extra');
const path = require('path');
const zlib = require('zlib');
const logger = require('terminal-log');
const uglify = require('uglify-js');
const rollup = require('rollup');
const replace = require('rollup-plugin-replace');
const html = require('rollup-plugin-html');
const typescript = require('rollup-plugin-typescript2');
const pkg = require('../package.json');
const version = process.env.VERSION || pkg.version
const banner =
`/**
  * ${pkg.name} v${version}
  * (c) 2017-${new Date().getFullYear()} ${pkg.author}
  * @license ${pkg.license}
  */`

if (!fs.existsSync('dist')) {
    fs.mkdirSync('dist')
}

const resolve = _path => path.resolve(__dirname, '../', _path)

build([
    {
        file: resolve(`dist/${pkg.name}.js`),
        format: 'umd',
        env: 'development'
    },
    {
        file: resolve(`dist/${pkg.name}.min.js`),
        format: 'umd',
        env: 'production'
    },
    {
        file: resolve(`dist/${pkg.name}.common.js`),
        format: 'cjs'
    }
].map(genConfig))

function genConfig(opts) {
    const config = {
        input: {
            input: resolve('src/index.ts'),
            plugins: [
                html(),
                typescript()
            ]
        },
        output: {
            file: opts.file,
            format: opts.format,
            banner,
            name: `${pkg.name}`,
            exports: 'named'
        }
    }

    if (opts.env) {
        config.input.plugins.unshift(replace({
            'process.env.NODE_ENV': JSON.stringify(opts.env)
        }))
    }

    return config
}

function build(builds) {
    let built = 0
    const total = builds.length
    const next = () => {
        buildEntry(builds[built]).then(() => {
            built++
            if (built < total) {
                next()
            }
        }).catch(logError)
    }

    next()
}

function buildEntry({ input, output }) {
    const isProd = /min\.js$/.test(output.file)
    return rollup.rollup(input)
        .then(bundle => bundle.generate(output))
        .then(({ code }) => {
            if (isProd) {
                var minified = uglify.minify(code, {
                    output: {
                        preamble: output.banner,
                        ascii_only: true
                    }
                }).code
                return write(output.file, minified, true)
            } else {
                return write(output.file, code)
            }
        })
}

function write(dest, code, zip) {
    return new Promise((resolve, reject) => {
        function report(extra) {
            logger.info(blue(path.relative(process.cwd(), dest)) + ' ' + getSize(code) + (extra || ''))
            resolve()
        }

        fs.writeFile(dest, code, err => {
            if (err) return reject(err)
            if (zip) {
                zlib.gzip(code, (err, zipped) => {
                    if (err) return reject(err)
                    report(' (gzipped: ' + getSize(zipped) + ')')
                })
            } else {
                report()
            }
        })
    })
}

function getSize(code) {
    return (code.length / 1024).toFixed(2) + 'kb'
}

function logError(e) {
    logger.error(e)
}

function blue(str) {
    return '\x1b[1m\x1b[34m' + str + '\x1b[39m\x1b[22m'
}