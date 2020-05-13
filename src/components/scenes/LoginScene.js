// @flow

import { Disklet } from 'disklet'
import type { EdgeAccount, EdgeContext } from 'edge-core-js'
import { LoginScreen } from 'edge-login-ui-rn'
import React, { Component } from 'react'
import { Keyboard, Linking, Platform, StatusBar, StyleSheet, View } from 'react-native'
import { checkVersion } from 'react-native-check-version'
import DeviceInfo from 'react-native-device-info'
import slowlog from 'react-native-slowlog'
import { connect } from 'react-redux'

import ENV from '../../../env.json'
import { showSendLogsModal } from '../../actions/SettingsActions'
import edgeBackgroundImage from '../../assets/images/edgeBackground/login_bg.jpg'
import edgeLogo from '../../assets/images/edgeLogo/Edge_logo_L.png'
import s from '../../locales/strings.js'
import { initializeAccount, logoutRequest } from '../../modules/Login/action.js'
import THEME from '../../theme/variables/airbitz.js'
import { type DeepLink } from '../../types/DeepLink.js'
import { type Dispatch, type State as ReduxState } from '../../types/reduxTypes.js'
import { showHelpModal } from '../modals/HelpModal.js'
import { UpdateModal } from '../modals/UpdateModal.js'
import { Airship, showError } from '../services/AirshipInstance.js'
import { LoadingScene } from './LoadingScene.js'

type StateProps = {
  account: EdgeAccount,
  context: EdgeContext,
  disklet: Disklet,
  pendingDeepLink: DeepLink | null,
  username: string,
}
type DispatchProps = {
  deepLinkHandled(): void,
  initializeAccount(account: EdgeAccount, touchIdInfo: Object): void,
  logout(): void,
  showSendLogsModal(): void,
}
type Props = StateProps & DispatchProps

type State = {
  counter: number,
  passwordRecoveryKey?: string,
}

let firstRun = true

class LoginSceneComponent extends Component<Props, State> {
  constructor(props: Props) {
    super(props)

    this.state = {
      counter: 0,
      needsUpdate: false,
    }

    slowlog(this, /.*/, global.slowlogOptions)
  }

  getSkipUpdate() {
    return this.props.disklet.getText('ignoreUpdate.json').catch(() => '')
  }

  async componentDidMount() {
    const { YOLO_USERNAME, YOLO_PASSWORD } = ENV
    if (YOLO_USERNAME != null && YOLO_PASSWORD != null && firstRun) {
      const { context, initializeAccount } = this.props
      firstRun = false
      setTimeout(() => {
        context
          .loginWithPassword(YOLO_USERNAME, YOLO_PASSWORD)
          .then((account) => initializeAccount(account, {}))
          .catch(showError)
      }, 500)
    }

    const response = await checkVersion()
    const skipUpdate = (await this.getSkipUpdate()) === response.version
    if (response.needsUpdate && !skipUpdate) {
      Airship.show((bridge) => (
        <UpdateModal
          bridge={bridge}
          newVersion={response.version}
          released={response.released}
          onUpdate={() => {
            const bundleId = DeviceInfo.getBundleId()
            const url =
              Platform.OS === 'android'
                ? `http://play.app.goo.gl/?link=http://play.google.com/store/apps/details?id=${bundleId}`
                : `https://itunes.apple.com/app/id1344400091`
            Linking.openURL(url)
            bridge.resolve()
          }}
          onSkip={() => {
            this.props.disklet.setText('ignoreUpdate.json', response.version)
            bridge.resolve()
          }}
        />
      ))
    }
  }

  componentDidUpdate(oldProps: Props) {
    const { account, pendingDeepLink } = this.props

    // Did we get a new recovery link?
    if (pendingDeepLink !== oldProps.pendingDeepLink && pendingDeepLink != null && pendingDeepLink.type === 'passwordRecovery') {
      // Log out if necessary:
      if (account.username !== null) this.props.logout()

      // Pass the link to our component:
      const { passwordRecoveryKey } = pendingDeepLink
      this.setState((state) => ({ passwordRecoveryKey, counter: state.counter + 1 }))
      this.props.deepLinkHandled()
    }
  }

  onClickHelp() {
    Keyboard.dismiss()
    showHelpModal()
  }

  onLogin = (error: Error | null, account: EdgeAccount | null, touchIdInfo: Object) => {
    if (error != null) return
    this.setState({ passwordRecoveryKey: undefined })
    if (account != null) this.props.initializeAccount(account, touchIdInfo)
  }

  render() {
    const { counter, passwordRecoveryKey } = this.state

    return this.props.account.username == null ? (
      <View style={styles.container} testID="edge: login-scene">
        <LoginScreen
          username={this.props.username}
          accountOptions={null}
          context={this.props.context}
          recoveryLogin={passwordRecoveryKey}
          onLogin={this.onLogin}
          fontDescription={{ regularFontFamily: THEME.FONTS.DEFAULT }}
          key={String(counter)}
          appName={s.strings.app_name_short}
          backgroundImage={edgeBackgroundImage}
          primaryLogo={edgeLogo}
          primaryLogoCallback={this.props.showSendLogsModal}
          parentButton={{ text: s.strings.string_help, callback: this.onClickHelp }}
        />
      </View>
    ) : (
      <LoadingScene />
    )
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
    paddingTop: StatusBar.currentHeight,
    backgroundColor: THEME.COLORS.PRIMARY,
  },
})

export const LoginScene = connect(
  (state: ReduxState): StateProps => ({
    account: state.core.account,
    context: state.core.context,
    disklet: state.core.disklet,
    pendingDeepLink: state.pendingDeepLink,
    username: state.nextUsername == null ? '' : state.nextUsername,
  }),

  (dispatch: Dispatch): DispatchProps => ({
    deepLinkHandled() {
      dispatch({ type: 'DEEP_LINK_HANDLED' })
    },
    initializeAccount(account, touchIdInfo) {
      dispatch(initializeAccount(account, touchIdInfo))
    },
    logout() {
      dispatch(logoutRequest())
    },
    showSendLogsModal() {
      dispatch(showSendLogsModal())
    },
  })
)(LoginSceneComponent)
