const request = require('request')
const fs = require('fs-extra')
const path = require('path')
const os = require('os')
const chalk = require('chalk')
const readline = require('readline')
const getTable = require('console.table').getTable

const CACHE_PATH = path.resolve(os.homedir(), '.fx')
let timestamp

async function getInstantPrice (currency, interval = 'M1') {
  if (!currency) return
  var base = currency[2] || 'N/A'
  var delta = 'N/A'
  var state = 'N/A'
  var speed = 'N/A'
  var op = currency[0]
  currency = currency[1]
  var options = {
    method: 'GET',
    url: 'https://mds-api.forexfactory.com/bars',
    qs: {
      instrument: currency,
      per_page: 1,
      interval: interval
    },
    headers: {
      'cache-control': 'no-cache',
      cookie: '_ga=GA1.2.1577976563.1482399066 _gid=GA1.2.391229358.1530781081',
      authority: 'mds-api.forexfactory.com',
      referer: 'https://www.forexfactory.com/',
      accept: 'application/json, text/javascript, */* q=0.01',
      'user-agent': 'Mozilla/5.0 (Linux Android 8.0.0 Pixel 2 XL Build/OPD1.170816.004) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/67.0.3396.99 Mobile Safari/537.36',
    }
  }

  let price = await new Promise((resolve, reject) => {
    request(options, function (error, response, body) {
      if (error) return reject(error)
      body = JSON.parse(body)
      body = body.data[0] || {}
      resolve(body.close || 'N/A')
    })
  })

  var scale = currency.indexOf('JPY') >= 0 ? 1e2 : 1e4

  if (base && price && base != 'N/A' && price != 'N/A') {
    delta = +((price - base) * (op === '-' ? -1 : 1) * scale).toFixed(1)
    state = delta > 0 ? chalk.bgGreen(' ↑ ') : chalk.bgRed(' ↓ ')
  }
  timestamp = Date.now()
  if (getInstantPrice[currency] && getInstantPrice['timestamp'] && price != 'N/A') {
    speed = (price - getInstantPrice[currency]) * scale * 10 / (timestamp - getInstantPrice['timestamp']) * 1000
    speed = `${speed > 0 ? '+' : speed == 0 ? ' ' : ''}${speed.toFixed(2)}`
    speed = Math.abs(+speed) >= 2 ? chalk.red(speed) : speed
    // console.log(currency,
    //   getInstantPrice[currency] - price,
    //   (timestamp - getInstantPrice['timestamp']) / 1000,
    //   speed
    // )
  }
  getInstantPrice[currency] = price
  return {
    currency,
    op,
    price,
    entry: base,
    pips: delta,
    state,
    speed,
  }
}

async function readCache () {
  var cache
  try {
    cache = await fs.readJson(CACHE_PATH, 'utf-8')
  } catch (e) {
    cache = {}
  }
  return cache
}

async function writeCache (obj) {
  var cache = {}
  try {
    cache = await fs.readJson(CACHE_PATH, 'utf-8')
  } catch (e) {}
  cache = Object.assign(cache, obj)
  try {
    await fs.writeJson(CACHE_PATH, cache, 'utf-8')
  } catch (e) {
    console.log(e)
  }
}

async function sleep (ts) {
  return new Promise(resolve => setTimeout(resolve, ts))
}

async function cout (msg) {
  let rl
  if (cout.rl) rl = cout.rl
  else {
    cout.rl = rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })
  }
  readline.cursorTo(process.stdout, 0, 0)
  readline.clearScreenDown(process.stdout)
  rl.write(msg.replace(/[\n\r]+$/m, '\n') + '\n' + new Date())
}

async function start () {
  // let currencies = ['chfjpy']
  let currencies = process.argv.slice(2)
  let basePrices = {}
  let cached = await readCache()
  if (currencies.length <= 0) currencies = ['AUD/USD', 'EUR/USD', 'GBP/USD', 'USD/CAD', 'USD/CHF', 'EUR/JPY', 'USD/JPY', 'CHF/JPY', 'AUD/JPY']
  currencies = currencies.map(c => {
    var matched = String(c).toUpperCase().match(/^([-+])([A-Z]{3})(?:\/?)([A-Z]{3})(?:\:([\d.]+))?$/)
    var currency = matched && [matched[2], matched[3]].join('/')
    if (!/^([A-Z]{3})\/([A-Z]{3})/.test(currency)) return [null, 'N/A']
    var cachedBase = parseFloat(cached[currency])
    var base = matched && matched[4] || cachedBase ||  'N/A'
    var op = matched && matched[1] || (isNaN(cachedBase) ? false : cachedBase > 0 ? '+' : '-') || 'N/A'
    if (base && base != 'N/A') cached[currency] = '' + op + base
    return [op, currency, base]
  })

  let prices
  await writeCache(cached)
  while (1) {
    try {
      prices = await Promise.all(currencies.filter(c => Boolean(c)).map(c => getInstantPrice(c)))
      getInstantPrice['timestamp'] = timestamp
    } catch (e) {
      console.error('出错了', e)
      await sleep(60 * 1000)
      continue
    }
    cout(getTable(prices))
    await sleep(2500)
  }
}

start()
