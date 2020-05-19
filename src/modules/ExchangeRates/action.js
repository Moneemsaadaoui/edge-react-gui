// @flow

import { type Dispatch, type GetState, type State } from '../../types/reduxTypes.js'
import { getYesterdayDateRoundDownHour } from '../../util/utils.js'
import { getDefaultIsoFiat } from '../Settings/selectors.js'

export const updateExchangeRates = () => async (dispatch: Dispatch, getState: GetState) => {
  const state = getState()
  const exchangeRates = await buildExchangeRates(state)
  dispatch({
    type: 'EXCHANGE_RATES/UPDATE_EXCHANGE_RATES',
    data: { exchangeRates },
  })
}

async function buildExchangeRates(state: State) {
  const { account } = state.core
  const { currencyWallets = {}, exchangeCache } = account
  const accountIsoFiat = getDefaultIsoFiat(state)

  const exchangeRates: { [pair: string]: Promise<number> } = {}
  const finalExchangeRates = {}
  const yesterdayDate = getYesterdayDateRoundDownHour()
  if (accountIsoFiat !== 'iso:USD') {
    exchangeRates[`iso:USD_${accountIsoFiat}`] = exchangeCache.convertCurrency('iso:USD', accountIsoFiat)
  }
  for (const id of Object.keys(currencyWallets)) {
    const wallet = currencyWallets[id]
    const walletIsoFiat = wallet.fiatCurrencyCode
    const currencyCode = wallet.currencyInfo.currencyCode // should get GUI or core versions?
    // need to get both forward and backwards exchange rates for wallets & account fiats, for each parent currency AND each token
    exchangeRates[`${currencyCode}_${walletIsoFiat}`] = exchangeCache.convertCurrency(currencyCode, walletIsoFiat)
    exchangeRates[`${currencyCode}_${accountIsoFiat}`] = exchangeCache.convertCurrency(currencyCode, accountIsoFiat)
    exchangeRates[`${currencyCode}_iso:USD_${yesterdayDate}`] = fetchExchangeRateHistory(currencyCode, yesterdayDate)
    // add them to the list of promises to resolve
    // keep track of the exchange rates
    // now add tokens, if they exist
    if (walletIsoFiat !== 'iso:USD') {
      exchangeRates[`iso:USD_${walletIsoFiat}`] = exchangeCache.convertCurrency('iso:USD', walletIsoFiat)
    }
    for (const tokenCode in wallet.balances) {
      if (tokenCode !== currencyCode) {
        exchangeRates[`${tokenCode}_${walletIsoFiat}`] = exchangeCache.convertCurrency(tokenCode, walletIsoFiat)
        exchangeRates[`${tokenCode}_${accountIsoFiat}`] = exchangeCache.convertCurrency(tokenCode, accountIsoFiat)
        exchangeRates[`${tokenCode}_iso:USD_${yesterdayDate}`] = fetchExchangeRateHistory(tokenCode, yesterdayDate)
      }
    }
  }
  const exchangeRateKeys = Object.keys(exchangeRates)
  const exchangeRatePromises = Object.values(exchangeRates)
  const rates = await Promise.all(exchangeRatePromises)
  for (let i = 0; i < exchangeRateKeys.length; i++) {
    const key = exchangeRateKeys[i]
    const codes = key.split('_')
    const rate = rates[i]
    const reverseExchangeRateKey = `${codes[1]}_${codes[0]}${codes[2] ? '_' + codes[2] : ''}`
    if (isNaN(rate)) {
      finalExchangeRates[key] = 0
      finalExchangeRates[reverseExchangeRateKey] = 0
    } else {
      finalExchangeRates[key] = rate
      if (rate !== 0) {
        // if it's a real rate and can be multiplicatively inverted
        finalExchangeRates[reverseExchangeRateKey] = 1 / parseFloat(rate)
      } else {
        finalExchangeRates[reverseExchangeRateKey] = 0
      }
    }
  }
  return finalExchangeRates
}

async function fetchExchangeRateHistory(currency: string, date: string): Promise<number> {
  const currencyHistory = await fetch(`https://info1.edgesecure.co:8444/v1/exchangeRate?currency_pair=${currency}_USD&date=${date}`).catch((e) => {
    console.log('Error fetching fetchExchangeRateHistory', e)
  })
  if (currencyHistory != null) {
    const result = await currencyHistory.json()
    return parseFloat(result.exchangeRate)
  }
  return 0
}
