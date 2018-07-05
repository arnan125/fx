const request = require('request')
require('console.table')

async function getInstantPrice (currency, interval = 'M1') {
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
  return {
    currency,
    price,
  }
}

async function start () {
  let currencies = process.argv.slice(2) // ['USD/JPY', 'CHF/JPY']
  let prices = await Promise.all(currencies.map(c => getInstantPrice(c)))
  console.table(prices)
}

start()
