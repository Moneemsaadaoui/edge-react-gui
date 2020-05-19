// @flow

import React, { Component } from 'react'
import { connect } from 'react-redux'

import { selectWalletFromModal } from '../../actions/WalletActions.js'
import { type WalletListResult, WalletListModal } from '../../components/modals/WalletListModal.js'
import s from '../../locales/strings.js'
import WalletSelector from '../../modules/UI/components/Header/Component/WalletSelectorConnector'
import type { Dispatch } from '../../types/reduxTypes.js'
import { Airship } from '../services/AirshipInstance.js'

type DispatchProps = {
  onSelectWallet(string, string): void,
}

class HeaderWalletSelectorConnected extends Component<DispatchProps> {
  onPress = () => {
    Airship.show((bridge) => <WalletListModal bridge={bridge} headerTitle={s.strings.select_wallet} />).then((response: WalletListResult) => {
      if (response.walletToSelect) {
        this.props.onSelectWallet(response.walletToSelect.walletId, response.walletToSelect.currencyCode)
      }
    })
    return null
  }

  render() {
    return <WalletSelector onPress={this.onPress} />
  }
}

const HeaderWalletSelector = connect(null, (dispatch: Dispatch): DispatchProps => ({
  onSelectWallet: (walletId: string, currencyCode: string) => dispatch(selectWalletFromModal(walletId, currencyCode)),
}))(HeaderWalletSelectorConnected)
export { HeaderWalletSelector }
