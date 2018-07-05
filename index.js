const request = require('request')
const fs = require('fs-extra')
const path = require('path')
const os = require('os')
const chalk = require('chalk')
const readline = require('readline')
const getTable = require('console.table').getTable

const CACHE_PATH = path.resolve(os.homedir(), '.fx')

async function getInstantPrice (currency, interval = 'M1') {
  if (!currency) return
  var base = currency[1] || 'N/A'
  var delta = 'N/A'
  var direction = 'N/A'
  currency = currency[0]
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
      if (error) throw new Error(error)
      body = JSON.parse(body)
      body = body.data[0] || {}
      resolve(body.close || 'N/A')
    })
  })
  if (base && price && base != 'N/A' && price != 'N/A') {
    delta = +(price - base).toFixed(4)
    direction = delta > 0 ? chalk.bgGreen(' ↑ ') : chalk.bgRed(' ↓ ')
  }
  return {
    currency,
    price,
    base,
    delta,
    direction
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
  readline.cursorTo(process.stdout, 0, -1)
  rl.write(msg.replace(/[\n\r]+$/m, '\n'))
}

async function start () {
  // let currencies = ['chfjpy', 'usdcad', 'usdjpy']
  let currencies = process.argv.slice(2)
  let basePrices = {}
  let cached = await readCache()
  if (currencies.length <= 0) currencies = ['AUD/USD', 'EUR/USD', 'GBP/USD', 'USD/CAD', 'USD/CHF', 'EUR/JPY', 'USD/JPY', 'CHF/JPY', 'AUD/JPY']
  currencies = currencies.map(c => {
    var matched = String(c).toUpperCase().match(/^([A-Z]{3})(?:\/?)([A-Z]{3})(?:\:([\d.]+))?$/)
    var currency = matched && [matched[1], matched[2]].join('/')
    if (!/^([A-Z]{3})\/([A-Z]{3})/.test(currency)) return [null, 'N/A']
    var base = matched && matched[3] || cached[currency] ||  'N/A'
    if (base && base != 'N/A') cached[currency] = base
    return [currency, base]
  })

  let prices
  var count = 0
  while (1) {
    prices = await Promise.all(currencies.filter(c => Boolean(c)).map(c => getInstantPrice(c)))
    cout(getTable(prices))
    await sleep(5000)
  }
  await writeCache(cached)
}

start()
