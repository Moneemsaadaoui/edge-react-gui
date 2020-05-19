// @flow

import { bns } from 'biggystring'
import type { EdgeCurrencyWallet, EdgeDenomination, EdgeTransaction } from 'edge-core-js'
import React, { Component } from 'react'
import { View } from 'react-native'
import { Actions } from 'react-native-router-flux'

import { type WalletListResult, WalletListModal } from '../../components/modals/WalletListModal.js'
import * as Constants from '../../constants/indexConstants'
import { intl } from '../../locales/intl'
import s from '../../locales/strings.js'
import type { ExchangeRatesState } from '../../modules/ExchangeRates/reducer'
import { PrimaryButton } from '../../modules/UI/components/Buttons/PrimaryButton.ui.js'
import { TextAndIconButton } from '../../modules/UI/components/Buttons/TextAndIconButton.ui.js'
import T from '../../modules/UI/components/FormattedText/index'
import SafeAreaView from '../../modules/UI/components/SafeAreaView/SafeAreaView.ui.js'
import { MaterialInput } from '../../styles/components/FormFieldStyles.js'
import { styles as CryptoExchangeSceneStyle } from '../../styles/scenes/CryptoExchangeSceneStyles.js'
import { styles } from '../../styles/scenes/FioPendingRequestDetailsStyle.js'
import THEME from '../../theme/variables/airbitz'
import type { FioRequest, GuiWallet } from '../../types/types'
import { FormField } from '../common/FormField'
import { SceneWrapper } from '../common/SceneWrapper'
import { Airship, showError } from '../services/AirshipInstance'

export type NavigationProps = {
  selectedFioPendingRequest: FioRequest
}

export type FioPendingRequestDetailsStateProps = {
  fromCurrencyCode: string,
  wallets: { [string]: GuiWallet },
  exchangeRates: ExchangeRatesState,
  selectedWallet: GuiWallet | null,
  fioWalletByAddress: EdgeCurrencyWallet | null,
  exchangeDenomination: EdgeDenomination,
  isoFiatCurrencyCode: string,
  fiatSymbol: string
}

export type FioPendingRequestDetailsDispatchProps = {
  onSelectWallet: (walletId: string, currencyCode: string) => void,
  openModal(data: 'from' | 'to'): mixed
}

type Props = FioPendingRequestDetailsStateProps & FioPendingRequestDetailsDispatchProps & NavigationProps

type LocalState = {
  memo: string,
  memoError: string
}

export class FioPendingRequestDetailsComponent extends Component<Props, LocalState> {
  constructor (props: Props) {
    super(props)
    const newState: LocalState = {
      memo: this.props.selectedFioPendingRequest.content.memo,
      memoError: ''
    }
    this.state = newState
  }

  componentDidMount (): void {
    this.setDefaultWallet()
  }

  setDefaultWallet (): void {
    const { onSelectWallet, wallets, selectedFioPendingRequest } = this.props
    const { chain_code, token_code } = selectedFioPendingRequest.content
    const confirmTokenCode = token_code && token_code !== chain_code ? token_code : null
    const walletKeys = Object.keys(wallets)
    for (const walletKey of walletKeys) {
      const wallet = wallets[walletKey]
      if (chain_code.toUpperCase() === wallet.currencyCode) {
        if (confirmTokenCode && wallet.enabledTokens.find(token => token === token_code.toUpperCase())) {
          onSelectWallet(wallet.id, wallet.currencyCode)
          return
        } else if (!confirmTokenCode) {
          onSelectWallet(wallet.id, wallet.currencyCode)
          return
        }
      }
    }
    showError(s.strings.fio_request_default_wallet_error)
  }

  memoChanged = (text: string): void => {
    this.setState({ memo: text }, this.validateMemo)
  }

  validateMemo = () => {
    const { memo } = this.state
    let memoError = ''
    if (memo.length > 64) {
      memoError = s.strings.send_fio_request_error_memo_inline
    }
    if (memo && !/^[\x20-\x7E]*$/.test(memo)) {
      memoError = s.strings.send_fio_request_error_memo_invalid_character
    }

    this.setState({
      memoError
    })
  }

  fiatAmount = (currencyCode: string, amount: string): string => {
    const { exchangeRates, isoFiatCurrencyCode } = this.props
    const rateKey = `${currencyCode}_${isoFiatCurrencyCode}`
    const fiatPerCrypto = exchangeRates[rateKey] ? exchangeRates[rateKey] : 0
    const amountToMultiply = parseFloat(amount)

    return intl.formatNumber(fiatPerCrypto * amountToMultiply, { toFixed: 2 }) || '0'
  }

  amountField = () => {
    return (
      <View style={styles.row}>
        <T style={styles.title}>
          {s.strings.fio_request_amount} {this.props.selectedFioPendingRequest.content.amount} {this.props.selectedFioPendingRequest.content.token_code} (
          {this.props.fiatSymbol}
          {this.fiatAmount(this.props.selectedFioPendingRequest.content.token_code, this.props.selectedFioPendingRequest.content.amount)})
        </T>
      </View>
    )
  }

  requestedField = (payee: string) => {
    return (
      <View style={styles.row}>
        <T style={styles.title}>{s.strings.fio_request_from_label}</T>
        <T style={styles.value}>{payee}</T>
      </View>
    )
  }

  dateField = (date: Date) => {
    return (
      <View style={styles.row}>
        <T style={styles.title}>{s.strings.fio_date_label}</T>
        <T style={styles.value}>{intl.formatExpDate(date, true)}</T>
      </View>
    )
  }

  launchFromWalletSelector = () => {
    this.props.openModal('from')
    this.renderDropUp()
  }

  sendCrypto = async () => {
    const { fioWalletByAddress, selectedFioPendingRequest: pendingRequest, exchangeDenomination } = this.props
    if (!fioWalletByAddress) return
    let nativeAmount = bns.mul(pendingRequest.content.amount, exchangeDenomination.multiplier)
    nativeAmount = bns.toFixed(nativeAmount, 0, 0)
    const guiMakeSpendInfo = {
      memo: this.state.memo,
      fioAddress: pendingRequest.payee_fio_address,
      currencyCode: pendingRequest.content.token_code,
      nativeAmount: nativeAmount,
      publicAddress: pendingRequest.content.payee_public_address,
      lockInputs: true,
      beforeTransaction: async () => {
        try {
          const getFeeResult = await fioWalletByAddress.otherMethods.fioAction('getFee', {
            endPoint: 'record_obt_data',
            fioAddress: pendingRequest.payer_fio_address
          })
          if (getFeeResult.fee) {
            showError(s.strings.fio_no_bundled_err_msg)
            throw new Error(s.strings.fio_no_bundled_err_msg)
          }
        } catch (e) {
          showError(s.strings.fio_get_fee_err_msg)
          throw e
        }
      },
      onDone: (error: Error | null, edgeTransaction?: EdgeTransaction) => {
        if (error) {
          setTimeout(() => {
            showError(s.strings.create_wallet_account_error_sending_transaction)
          }, 750)
        } else if (edgeTransaction) {
          this.fioAcceptRequest(edgeTransaction, this.state.memo)
        }
      }
    }

    Actions[Constants.SEND_CONFIRMATION]({ guiMakeSpendInfo })
  }

  fioAcceptRequest = async (edgeTransaction: EdgeTransaction, memo: string) => {
    const { fioWalletByAddress, selectedFioPendingRequest: pendingRequest } = this.props
    if (!fioWalletByAddress) return showError(s.strings.fio_confirm_request_error)

    try {
      await fioWalletByAddress.otherMethods.fioAction('recordObtData', {
        fioRequestId: pendingRequest.fio_request_id,
        payerFioAddress: pendingRequest.payer_fio_address,
        payeeFioAddress: pendingRequest.payee_fio_address,
        payerPublicAddress: pendingRequest.payer_fio_public_key,
        payeePublicAddress: pendingRequest.content.payee_public_address,
        amount: pendingRequest.content.amount,
        tokenCode: pendingRequest.content.token_code,
        chainCode: pendingRequest.content.chain_code,
        obtId: edgeTransaction.txid,
        memo,
        tpid: '',
        status: 'sent_to_blockchain'
      })
    } catch (e) {
      showError(s.strings.fio_confirm_request_error)
    }
    Actions.popTo(Constants.FIO_REQUEST_LIST)
    Actions.replace(Constants.TRANSACTION_DETAILS, { edgeTransaction: edgeTransaction })
  }

  renderButton = () => {
    if (this.props.fromCurrencyCode !== '' && !this.state.memoError) {
      return (
        <PrimaryButton onPress={this.sendCrypto}>
          <PrimaryButton.Text>{s.strings.string_next_capitalized}</PrimaryButton.Text>
        </PrimaryButton>
      )
    }
    return null
  }

  renderDropUp = () => {
    const { onSelectWallet, selectedFioPendingRequest } = this.props
    const { chain_code, token_code } = selectedFioPendingRequest.content
    const allowedFullCurrencyCode = chain_code !== token_code && token_code && token_code !== '' ? [`${chain_code}:${token_code}`] : [chain_code]

    Airship.show(bridge => <WalletListModal bridge={bridge} headerTitle={s.strings.fio_src_wallet} allowedCurrencyCodes={allowedFullCurrencyCode} />).then(
      (response: WalletListResult) => {
        if (response.walletToSelect) {
          onSelectWallet(response.walletToSelect.walletId, response.walletToSelect.currencyCode)
        }
      }
    )
  }

  render () {
    const materialStyle = MaterialInput
    materialStyle.tintColor = THEME.COLORS.WHITE
    materialStyle.baseColor = THEME.COLORS.WHITE

    return (
      <SceneWrapper>
        <SafeAreaView>
          <View>{this.amountField()}</View>
          <View>{this.requestedField(this.props.selectedFioPendingRequest.payee_fio_address)}</View>
          <View>{this.dateField(new Date(this.props.selectedFioPendingRequest.time_stamp))}</View>
          <View style={styles.memo}>
            <FormField
              style={materialStyle}
              label={s.strings.unique_identifier_memo}
              onChangeText={this.memoChanged}
              value={this.state.memo}
              placeholder={s.strings.unique_identifier_memo}
              error={this.state.memoError}
            />
          </View>
          <View style={styles.lineRow}>
            <View style={styles.line} />
          </View>
          <View style={CryptoExchangeSceneStyle.shim} />
          <View style={styles.buttonRow}>
            <TextAndIconButton
              style={{ ...CryptoExchangeSceneStyle.flipWrapper.walletSelector, container: styles.selectWalletBtn }}
              onPress={this.launchFromWalletSelector}
              icon={Constants.KEYBOARD_ARROW_DOWN}
              title={this.props.selectedWallet ? this.props.selectedWallet.name : s.strings.fio_src_wallet}
            />
          </View>
          <View style={CryptoExchangeSceneStyle.shim} />
          <View style={styles.buttonRow}>{this.renderButton()}</View>
          <View style={CryptoExchangeSceneStyle.shim} />
        </SafeAreaView>
      </SceneWrapper>
    )
  }
}
