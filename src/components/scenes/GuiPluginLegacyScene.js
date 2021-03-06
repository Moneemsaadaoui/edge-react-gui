// @flow

import { type EdgeCurrencyWallet, type EdgeMetadata } from 'edge-core-js'
import React from 'react'
import { BackHandler, View } from 'react-native'
import { Actions } from 'react-native-router-flux'
import { WebView } from 'react-native-webview'
import { connect } from 'react-redux'
import parse from 'url-parse'

import ENV from '../../../env.json'
import { sendConfirmationUpdateTx } from '../../actions/SendConfirmationActions'
import { selectWallet } from '../../actions/WalletActions'
import s from '../../locales/strings.js'
import T from '../../modules/UI/components/FormattedText/index'
import BackButton from '../../modules/UI/components/Header/Component/BackButton.ui'
import { PluginBridge, pop as pluginPop } from '../../modules/UI/scenes/Plugins/api'
import * as UI_SELECTORS from '../../modules/UI/selectors.js'
import type { GuiMakeSpendInfo } from '../../reducers/scenes/SendConfirmationReducer.js'
import styles from '../../styles/scenes/PluginsStyle.js'
import { type GuiPlugin } from '../../types/GuiPluginTypes.js'
import { type GuiWallet } from '../../types/types.js'
import { SceneWrapper } from '../common/SceneWrapper.js'
import { showError } from '../services/AirshipInstance.js'

const BACK = s.strings.title_back

type Props = {
  plugin: GuiPlugin,
  navigation: any,
  account: any,
  guiWallet: GuiWallet,
  coreWallet: any,
  coreWallets: { [id: string]: EdgeCurrencyWallet },
  wallets: { [id: string]: GuiWallet },
  walletName: any,
  walletId: any,
  currentState: any,
  thisDispatch: Function,
  selectWallet(string, string): void,
  sendConfirmationUpdateTx(GuiMakeSpendInfo): void
}

type State = {
  showWalletList: any
}

export function renderLegacyPluginBackButton (label: string = BACK) {
  return <BackButton withArrow onPress={pluginPop} label={label} />
}

const legacyJavascript = `(function() {
  window.originalPostMessage = window.postMessage;
  window.postMessage = function(data) {
    window.ReactNativeWebView.postMessage(data);
  };
})()`

class GuiPluginLegacy extends React.Component<Props, State> {
  bridge: any
  webview: any
  successUrl: ?string
  openingSendConfirmation: boolean

  constructor (props: Props) {
    super(props)
    console.log('pvs: Legacy')
    this.state = {
      showWalletList: false
    }
    this.webview = null

    // This is a gross misuse of the displayName,
    // and the second value is just a dummy, but heh, legacy:
    const apiKey = ENV.PLUGIN_API_KEYS ? ENV.PLUGIN_API_KEYS[props.plugin.displayName] : 'edgeWallet'
    this.bridge = new PluginBridge({
      plugin: {
        ...props.plugin,
        environment: { apiKey }
      },
      account: props.account,
      coreWallets: props.coreWallets,
      wallets: props.wallets,
      walletName: props.walletName,
      walletId: props.walletId,
      navigationState: this.props.navigation.state,
      toggleWalletList: this.toggleWalletList,
      chooseWallet: this.chooseWallet,
      back: this._webviewBack,
      renderTitle: this._renderTitle,
      edgeCallBack: this.edgeCallBack
    })
  }

  chooseWallet = (walletId: string, currencyCode: string) => {
    this.props.selectWallet(walletId, currencyCode)
  }
  toggleWalletList = () => {
    this.setState({ showWalletList: !this.state.showWalletList })
  }

  handleBack = () => {
    pluginPop()
    return true
  }

  componentDidUpdate () {
    this.bridge.context.coreWallets = this.props.coreWallets
    this.bridge.context.wallets = this.props.wallets
    this.bridge.context.walletName = this.props.walletName
    this.bridge.context.walletId = this.props.coreWallet && this.props.coreWallet.id ? this.props.coreWallet.id : null
    this.bridge.context.wallet = this.props.coreWallet
  }

  componentDidMount () {
    this.bridge.componentDidMount()
    BackHandler.addEventListener('hardwareBackPress', this.handleBack)
  }

  componentWillUnmount () {
    BackHandler.removeEventListener('hardwareBackPress', this.handleBack)
  }

  _webviewBack = () => {
    if (!this.webview) return
    this.webview.injectJavaScript('window.history.back()')
  }
  _webviewOpenUrl = (url: string) => {
    if (!this.webview) return
    this.webview.injectJavaScript("window.open('" + url + "', '_self')")
  }

  _renderTitle = title => {
    Actions.refresh({
      renderTitle: (
        <View style={styles.titleWrapper}>
          <T style={styles.titleStyle}>{title}</T>
        </View>
      )
    })
  }

  _pluginReturn = data => {
    if (!this.webview) return
    this.webview.injectJavaScript(`window.PLUGIN_RETURN('${JSON.stringify(data)}')`)
  }

  _nextMessage = datastr => {
    if (!this.webview) return
    this.webview.injectJavaScript(`window.PLUGIN_NEXT('${datastr}')`)
  }

  _onMessage = event => {
    if (!this.webview) {
      return
    }
    let data = null
    try {
      data = JSON.parse(event.nativeEvent.data)
    } catch (e) {
      console.log(`Got bad json ${event.nativeEvent.data}`)
      return
    }
    const { cbid, func } = data
    if (!cbid && !func) {
      return
    }

    this._nextMessage(cbid)
    if (this.bridge[func]) {
      this.bridge[func](data)
        .then(res => {
          this._pluginReturn({ cbid, func, err: null, res })
        })
        .catch(err => {
          this._pluginReturn({ cbid, func, err, res: null })
        })
    } else if (func === 'edgeCallBack') {
      // this is if we are taking what used to be a callback url. There is no promise to return.
      this.edgeCallBack(data)
    } else {
      this._pluginReturn({ cbid, func, err: 'invalid function' })
    }
  }

  _setWebview = webview => {
    this.webview = webview
  }
  // This is the preferred method for calling back . it does not return any promise like other bridge calls.
  edgeCallBack = data => {
    switch (data['edge-callback']) {
      case 'paymentUri':
        if (this.openingSendConfirmation) {
          return
        }
        this.openingSendConfirmation = true
        this.props.coreWallet.parseUri(data['edge-uri']).then(result => {
          if (typeof result.currencyCode === 'string' && typeof result.nativeAmount === 'string' && typeof result.publicAddress === 'string') {
            let metadata: ?EdgeMetadata = {
              name: data['edge-source'] || (result.metadata ? result.metadata.name : undefined),
              category: result.metadata ? result.metadata.category : undefined,
              notes: result.metadata ? result.metadata.notes : undefined
            }
            if (metadata && !metadata.name && !metadata.category && !metadata.notes) {
              metadata = undefined
            }
            const info: GuiMakeSpendInfo = {
              currencyCode: result.currencyCode,
              nativeAmount: result.nativeAmount,
              publicAddress: result.publicAddress,
              metadata,
              onBack: () => {
                this.openingSendConfirmation = false
              }
            }
            this.successUrl = data['x-success']
            this.bridge
              .makeSpendRequest(info)
              .then(tr => {
                this.openingSendConfirmation = false
                Actions.pop()
                if (this.successUrl) {
                  this._webviewOpenUrl(this.successUrl)
                }
              })
              .catch(showError)
          }
        })
        break
    }
  }

  _onNavigationStateChange = navState => {
    if (navState.loading) {
      return
    }
    const parsedUrl = parse(navState.url, {}, true)

    // TODO: if no partners are using this we should delete
    if (parsedUrl.protocol === 'edge:' && parsedUrl.hostname === 'x-callback-url') {
      switch (parsedUrl.pathname) {
        case '/paymentUri':
          if (this.openingSendConfirmation) {
            return
          }

          this.openingSendConfirmation = true
          this.props.coreWallet.parseUri(parsedUrl.query.uri).then(result => {
            const info: GuiMakeSpendInfo = {
              currencyCode: result.currencyCode,
              nativeAmount: result.nativeAmount,
              publicAddress: result.publicAddress
            }
            this.successUrl = parsedUrl.query['x-success'] ? parsedUrl.query['x-success'] : null
            this.bridge
              .makeSpendRequest(info)
              .then(tr => {
                this.openingSendConfirmation = false
                Actions.pop()
                if (this.successUrl) {
                  this._webviewOpenUrl(this.successUrl)
                }
              })
              .catch(showError)
          })
          break
        default:
          console.log('nothing yet')
      }

      return
    }
    if (parsedUrl.protocol === 'edge-ret:') {
      Actions.pop()
      return
    }
    if (parsedUrl.origin === this.successUrl) {
      this.bridge.navStackClear()
      return
    }

    if (!navState.canGoForward) {
      this.bridge.navStackPush(navState.url)
    } else if (!navState.canGoBack) {
      this.bridge.navStackClear()
    }
  }

  render () {
    const { baseUri } = this.props.plugin

    // We don't support deep linking or custom query parameters,
    // but they would go here if we needed that:
    const uri = baseUri

    return (
      <SceneWrapper background="body" hasTabs={false}>
        <WebView
          allowFileAccess
          allowUniversalAccessFromFileURLs
          onMessage={this._onMessage}
          onNavigationStateChange={this._onNavigationStateChange}
          originWhitelist={['file://*', 'https://*', 'http://*', 'edge://*']}
          ref={this._setWebview}
          injectedJavaScript={legacyJavascript}
          javaScriptEnabled={true}
          source={{ uri }}
          userAgent={
            'Mozilla/5.0 (Linux; Android 6.0.1; SM-G532G Build/MMB29T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/63.0.3239.83 Mobile Safari/537.36'
          }
          setWebContentsDebuggingEnabled={true}
          useWebKit
        />
      </SceneWrapper>
    )
  }
}

const mapStateToProps = state => {
  const { account } = state.core
  const { currencyWallets = {} } = account
  const guiWallet = UI_SELECTORS.getSelectedWallet(state)
  const coreWallet = guiWallet && guiWallet.id ? currencyWallets[guiWallet.id] : null
  const wallets = state.ui.wallets.byId
  const walletName = coreWallet ? coreWallet.name : null
  const walletId = coreWallet ? coreWallet.id : null
  const currentState = state
  return {
    account,
    guiWallet,
    coreWallet,
    coreWallets: currencyWallets,
    wallets,
    walletName,
    walletId,
    currentState
  }
}

const mapDispatchToProps = dispatch => ({
  selectWallet: (walletId: string, currencyCode: string) => dispatch(selectWallet(walletId, currencyCode)),
  sendConfirmationUpdateTx: (info: GuiMakeSpendInfo) => dispatch(sendConfirmationUpdateTx(info)),
  thisDispatch: dispatch
})

export const GuiPluginLegacyScene = connect(
  mapStateToProps,
  mapDispatchToProps
)(GuiPluginLegacy)
