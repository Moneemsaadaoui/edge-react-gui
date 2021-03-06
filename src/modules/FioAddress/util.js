// @flow

import type { EdgeAccount, EdgeCurrencyConfig, EdgeCurrencyWallet } from 'edge-core-js'

import { FIO_WALLET_TYPE } from '../../constants/WalletAndCurrencyConstants'
import s from '../../locales/strings'
import type { CcWalletMap } from '../../reducers/FioReducer'
import type { FioConnectionWalletItem, FioObtRecord, GuiWallet } from '../../types/types'

const CONNECTED_WALLETS = 'ConnectedWallets.json'
const FIO_ADDRESS_CACHE = 'FioAddressCache.json'

type DiskletConnectedWallets = {
  [fullCurrencyCode: string]: {
    walletId: string,
    publicAddress: string
  }
}

export type FioAddresses = {
  addresses: {
    [address: string]: boolean
  }
}

/**
 * Get connected wallets from disklet
 *
 * @param fioWallet
 * @returns {Promise<*>}
 */
const getConnectedWalletsFromFile = async (fioWallet: EdgeCurrencyWallet): Promise<{ [fioAddress: string]: DiskletConnectedWallets }> => {
  try {
    const savedConnectedWalletsText = await fioWallet.disklet.getText(CONNECTED_WALLETS)
    return JSON.parse(savedConnectedWalletsText)
  } catch (e) {
    return {}
  }
}

/**
 * Get connected wallets for FIO Address from disklet
 *
 * @param fioWallet
 * @param fioAddress
 * @returns {Promise<*>}
 */
const getConnectedWalletsForFioAddress = async (fioWallet: EdgeCurrencyWallet, fioAddress: string): Promise<DiskletConnectedWallets> => {
  const savedConnectedWallets = await getConnectedWalletsFromFile(fioWallet)
  return savedConnectedWallets[fioAddress] || {}
}

/**
 * Set connected wallets to disklet
 *
 * @param fioWallet
 * @param fioAddress
 * @param connectedWallets
 * @returns {Promise<void>}
 */
const setConnectedWalletsFromFile = async (fioWallet: EdgeCurrencyWallet, fioAddress: string, connectedWallets: DiskletConnectedWallets): Promise<void> => {
  try {
    const savedConnectedWallets = await getConnectedWalletsFromFile(fioWallet)
    savedConnectedWallets[fioAddress] = connectedWallets
    await fioWallet.disklet.setText(CONNECTED_WALLETS, JSON.stringify(savedConnectedWallets))
  } catch (e) {
    console.log('setConnectedWalletsFromFile error - ', e)
  }
}

/**
 * Check if wallet is connected to FIO Address
 *
 * @param fioWallet
 * @param fioAddress
 * @param wallet
 * @param tokenCode
 * @param chainCode
 * @param connectedWalletsFromDisklet
 * @returns {Promise<string>}
 */
const isWalletConnected = async (
  fioWallet: EdgeCurrencyWallet,
  fioAddress: string,
  wallet: EdgeCurrencyWallet,
  tokenCode: string,
  chainCode: string,
  connectedWalletsFromDisklet: DiskletConnectedWallets
): Promise<boolean> => {
  try {
    const { public_address: publicAddress } = await fioWallet.otherMethods.fioAction('getPublicAddress', {
      fioAddress,
      tokenCode,
      chainCode
    })

    if (publicAddress === '0') return false

    const receiveAddress = await wallet.getReceiveAddress()
    if (publicAddress === receiveAddress.publicAddress) return true

    const fullCurrencyCode = `${chainCode}:${tokenCode}`
    if (connectedWalletsFromDisklet[fullCurrencyCode]) {
      const { walletId, publicAddress: pubAddressFromDisklet } = connectedWalletsFromDisklet[fullCurrencyCode]
      if (walletId === wallet.id && publicAddress === pubAddressFromDisklet) {
        return true
      }
    }
  } catch (e) {
    //
  }
  return false
}

/**
 * Set connected public addresses with FIO Address for all wallets in account
 *
 * @param fioAddress
 * @param fioWallet
 * @param wallets
 * @returns {Promise<CcWalletMap>}
 */
export const refreshConnectedWalletsForFioAddress = async (
  fioAddress: string,
  fioWallet: EdgeCurrencyWallet,
  wallets: EdgeCurrencyWallet[]
): Promise<CcWalletMap> => {
  const connectedWallets = {}
  const connectedWalletsFromDisklet = await getConnectedWalletsForFioAddress(fioWallet, fioAddress)
  for (const wallet of wallets) {
    const enabledTokens = await wallet.getEnabledTokens()
    if (!enabledTokens.find((enabledToken: string) => enabledToken === wallet.currencyInfo.currencyCode)) {
      enabledTokens.push(wallet.currencyInfo.currencyCode)
    }
    for (const enabledToken: string of enabledTokens) {
      const fullCurrencyCode = `${wallet.currencyInfo.currencyCode}:${enabledToken}`
      if (connectedWallets[fullCurrencyCode]) continue
      if (await isWalletConnected(fioWallet, fioAddress, wallet, enabledToken, wallet.currencyInfo.currencyCode, connectedWalletsFromDisklet)) {
        connectedWallets[fullCurrencyCode] = wallet.id
      }
    }
  }
  return connectedWallets
}

/**
 * Update public addresses for FIO Address
 *
 * @param fioWallet
 * @param fioAddress
 * @param publicAddresses
 * @returns {Promise<void>}
 */
export const updatePubAddressesForFioAddress = async (
  fioWallet: EdgeCurrencyWallet | null,
  fioAddress: string,
  publicAddresses: { walletId: string, chainCode: string, tokenCode: string, publicAddress: string }[]
) => {
  if (!fioWallet) throw new Error(s.strings.fio_connect_wallets_err)
  const connectedWalletsFromDisklet = await getConnectedWalletsForFioAddress(fioWallet, fioAddress)
  let publicAddressesToConnect = []
  const limitPerCall = 5
  for (const { walletId, chainCode, tokenCode, publicAddress } of publicAddresses) {
    const fullCurrencyCode = `${chainCode}:${tokenCode}`
    connectedWalletsFromDisklet[fullCurrencyCode] = { walletId, publicAddress }
    publicAddressesToConnect.push({
      token_code: tokenCode,
      chain_code: chainCode,
      public_address: publicAddress
    })
    if (publicAddressesToConnect.length === limitPerCall) {
      await addPublicAddresses(fioWallet, fioAddress, publicAddressesToConnect)
      await setConnectedWalletsFromFile(fioWallet, fioAddress, connectedWalletsFromDisklet)
      publicAddressesToConnect = []
    }
  }

  if (publicAddressesToConnect.length) {
    await addPublicAddresses(fioWallet, fioAddress, publicAddressesToConnect)
    await setConnectedWalletsFromFile(fioWallet, fioAddress, connectedWalletsFromDisklet)
  }
}

/**
 * Add public addresses for FIO Address API call method
 *
 * @param fioWallet
 * @param fioAddress
 * @param publicAddresses
 * @returns {Promise<void>}
 */
export const addPublicAddresses = async (
  fioWallet: EdgeCurrencyWallet,
  fioAddress: string,
  publicAddresses: { token_code: string, chain_code: string, public_address: string }[]
) => {
  let maxFee: number
  try {
    const { fee } = await fioWallet.otherMethods.fioAction('getFeeForAddPublicAddress', {
      fioAddress
    })
    maxFee = fee
  } catch (e) {
    throw new Error(s.strings.fio_get_fee_err_msg)
  }
  try {
    await fioWallet.otherMethods.fioAction('addPublicAddresses', {
      fioAddress,
      publicAddresses,
      maxFee
    })
  } catch (e) {
    throw new Error(s.strings.fio_connect_wallets_err)
  }
}

/**
 * Search for FIO Wallet that has FIO Address
 *
 * @param fioWallets
 * @param fioAddress
 * @returns {Promise<*>}
 */
export const findWalletByFioAddress = async (fioWallets: EdgeCurrencyWallet[], fioAddress: string): Promise<EdgeCurrencyWallet | null> => {
  if (fioWallets) {
    for (const wallet: EdgeCurrencyWallet of fioWallets) {
      const fioAddresses: string[] = await wallet.otherMethods.getFioAddressNames()
      for (const address of fioAddresses) {
        if (address.toLowerCase() === fioAddress.toLowerCase()) {
          return wallet
        }
      }
    }
  }

  return null
}

export const makeNotConnectedWallets = (wallets: { [walletId: string]: GuiWallet }, ccWalletMap: CcWalletMap): { [key: string]: FioConnectionWalletItem } => {
  const notConnectedWallets = {}
  for (const walletKey: string in wallets) {
    if (wallets[walletKey].type === FIO_WALLET_TYPE) continue
    const publicAddress = wallets[walletKey].receiveAddress.publicAddress
    const fullCurrencyCode = `${wallets[walletKey].currencyCode}:${wallets[walletKey].currencyCode}`
    if (!ccWalletMap[fullCurrencyCode]) {
      notConnectedWallets[`${wallets[walletKey].id}-${wallets[walletKey].currencyCode}`] = {
        key: `${wallets[walletKey].id}-${wallets[walletKey].currencyCode}`,
        id: wallets[walletKey].id,
        publicAddress,
        symbolImage: wallets[walletKey].symbolImage,
        name: wallets[walletKey].name,
        currencyCode: wallets[walletKey].currencyCode,
        chainCode: wallets[walletKey].currencyCode,
        fullCurrencyCode
      }
    }
    if (wallets[walletKey].enabledTokens && wallets[walletKey].enabledTokens.length) {
      for (const enabledToken: string of wallets[walletKey].enabledTokens) {
        let tokenData = wallets[walletKey].metaTokens.find(metaToken => metaToken.currencyCode === enabledToken)
        if (!tokenData) {
          tokenData = {
            currencyCode: enabledToken,
            symbolImage: ''
          }
        }
        const fullCurrencyCode = `${wallets[walletKey].currencyCode}:${tokenData.currencyCode}`
        if (!ccWalletMap[fullCurrencyCode]) {
          notConnectedWallets[`${wallets[walletKey].id}-${tokenData.currencyCode}`] = {
            key: `${wallets[walletKey].id}-${tokenData.currencyCode}`,
            id: wallets[walletKey].id,
            publicAddress,
            symbolImage: tokenData.symbolImage,
            name: wallets[walletKey].name,
            currencyCode: tokenData.currencyCode,
            chainCode: wallets[walletKey].currencyCode,
            fullCurrencyCode
          }
        }
      }
    }
  }

  return notConnectedWallets
}

export const makeConnectedWallets = (wallets: { [walletId: string]: GuiWallet }, ccWalletMap: CcWalletMap): { [key: string]: FioConnectionWalletItem } => {
  const connectedWallets = {}
  for (const walletKey: string in wallets) {
    if (wallets[walletKey].type === FIO_WALLET_TYPE) continue
    const publicAddress = wallets[walletKey].receiveAddress.publicAddress
    const fullCurrencyCode = `${wallets[walletKey].currencyCode}:${wallets[walletKey].currencyCode}`
    if (ccWalletMap[fullCurrencyCode] === wallets[walletKey].id) {
      connectedWallets[`${wallets[walletKey].id}-${wallets[walletKey].currencyCode}`] = {
        key: `${wallets[walletKey].id}-${wallets[walletKey].currencyCode}`,
        id: wallets[walletKey].id,
        publicAddress,
        symbolImage: wallets[walletKey].symbolImage,
        name: wallets[walletKey].name,
        currencyCode: wallets[walletKey].currencyCode,
        chainCode: wallets[walletKey].currencyCode,
        fullCurrencyCode
      }
    }
    if (wallets[walletKey].enabledTokens && wallets[walletKey].enabledTokens.length) {
      for (const enabledToken: string of wallets[walletKey].enabledTokens) {
        let tokenData = wallets[walletKey].metaTokens.find(metaToken => metaToken.currencyCode === enabledToken)
        if (!tokenData) {
          tokenData = {
            currencyCode: enabledToken,
            symbolImage: ''
          }
        }
        const fullCurrencyCode = `${wallets[walletKey].currencyCode}:${tokenData.currencyCode}`
        if (ccWalletMap[fullCurrencyCode] === wallets[walletKey].id) {
          connectedWallets[`${wallets[walletKey].id}-${tokenData.currencyCode}`] = {
            key: `${wallets[walletKey].id}-${tokenData.currencyCode}`,
            id: wallets[walletKey].id,
            publicAddress,
            symbolImage: tokenData.symbolImage,
            name: wallets[walletKey].name,
            currencyCode: tokenData.currencyCode,
            chainCode: wallets[walletKey].currencyCode,
            fullCurrencyCode
          }
        }
      }
    }
  }

  return connectedWallets
}

export const checkPubAddress = async (fioPlugin: EdgeCurrencyConfig, fioAddress: string, chainCode: string, tokenCode: string): Promise<string> => {
  const isFioAddress = await fioPlugin.otherMethods.isFioAddressValid(fioAddress)
  try {
    if (isFioAddress) {
      const { public_address: publicAddress } = await fioPlugin.otherMethods.getConnectedPublicAddress(fioAddress.toLowerCase(), chainCode, tokenCode)
      if (publicAddress && publicAddress.length > 1) {
        return publicAddress
      }
    }
  } catch (e) {
    throw new Error(s.strings.err_no_address_title)
  }

  return ''
}

export const addToFioAddressCache = async (account: EdgeAccount, fioAddressesToAdd: string[]): Promise<FioAddresses> => {
  const fioAddressesObject = await getFioAddressCache(account)
  let writeToDisklet = false

  for (const fioAddressToAdd of fioAddressesToAdd) {
    if (!fioAddressesObject.addresses[fioAddressToAdd]) {
      fioAddressesObject['addresses'][fioAddressToAdd] = true
      writeToDisklet = true
    }
  }

  if (writeToDisklet) {
    await account.disklet.setText(FIO_ADDRESS_CACHE, JSON.stringify(fioAddressesObject))
  }
  return fioAddressesObject
}

export const getFioAddressCache = async (account: EdgeAccount): Promise<FioAddresses> => {
  try {
    const fioAddressObject = await account.disklet.getText(FIO_ADDRESS_CACHE)
    return JSON.parse(fioAddressObject)
  } catch (e) {
    return { addresses: {} }
  }
}

export const checkRecordSendFee = async (fioWallet: EdgeCurrencyWallet, fioAddress: string) => {
  try {
    const getFeeResult = await fioWallet.otherMethods.fioAction('getFee', {
      endPoint: 'record_obt_data',
      fioAddress: fioAddress
    })
    if (getFeeResult.fee) {
      throw new Error(s.strings.fio_no_bundled_err_msg)
    }
  } catch (e) {
    throw new Error(s.strings.fio_get_fee_err_msg)
  }
}

export const recordSend = async (
  senderWallet: EdgeCurrencyWallet,
  senderFioAddress: string,
  params: {
    payeeFioAddress: string,
    payerPublicAddress: string,
    payeePublicAddress: string,
    amount: string,
    currencyCode: string,
    chainCode: string,
    txid: string,
    memo: string
  }
) => {
  if (senderFioAddress && senderWallet) {
    const { payeeFioAddress, payerPublicAddress, payeePublicAddress, amount, currencyCode, chainCode, txid, memo } = params
    try {
      await senderWallet.otherMethods.fioAction('recordObtData', {
        payerFioAddress: senderFioAddress,
        payeeFioAddress,
        payerPublicAddress,
        payeePublicAddress,
        amount,
        tokenCode: currencyCode,
        chainCode,
        obtId: txid,
        memo,
        maxFee: 0,
        tpid: '',
        status: 'sent_to_blockchain'
      })
    } catch (e) {
      //
      throw new Error(e.message)
    }
  }
}

export const getFioObtData = async (fioWallets: EdgeCurrencyWallet[]): Promise<FioObtRecord[]> => {
  let obtDataRecords = []
  for (const fioWallet: EdgeCurrencyWallet of fioWallets) {
    try {
      const { obt_data_records } = await fioWallet.otherMethods.fioAction('getObtData', {})
      obtDataRecords = [...obtDataRecords, ...obt_data_records]
    } catch (e) {
      //
    }
  }

  return obtDataRecords
}
