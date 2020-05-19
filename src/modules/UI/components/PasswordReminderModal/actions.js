// @flow

import { showError, showToast } from '../../../../components/services/AirshipInstance.js'
import s from '../../../../locales/strings.js'
import type { Dispatch, GetState } from '../../../../types/reduxTypes.js'
import * as SETTINGS_API from '../../../Core/Account/settings.js'

export const checkPasswordStart = () => ({
  type: 'PASSWORD_REMINDER_MODAL/CHECK_PASSWORD_START',
})

export const checkPasswordSuccess = () => ({
  type: 'PASSWORD_REMINDER_MODAL/CHECK_PASSWORD_SUCCESS',
})

export const checkPasswordFail = () => ({
  type: 'PASSWORD_REMINDER_MODAL/CHECK_PASSWORD_FAIL',
})

export const requestChangePassword = () => ({
  type: 'PASSWORD_REMINDER_MODAL/REQUEST_CHANGE_PASSWORD',
})

export const postponePasswordReminder = () => ({
  type: 'PASSWORD_REMINDER_MODAL/PASSWORD_REMINDER_POSTPONED',
})

export const checkPassword = (password: string) => (dispatch: Dispatch, getState: GetState) => {
  const state = getState()
  const account = state.core.account

  dispatch(checkPasswordStart())
  account.checkPassword(password).then((isValidPassword) => {
    if (isValidPassword) {
      dispatch(checkPasswordSuccess())
      showToast(s.strings.password_reminder_great_job)
    } else {
      dispatch(checkPasswordFail())
    }
  })
}

// Saving data to account local folder
export const setPasswordReminder = (passwordReminder: Object) => (dispatch: Dispatch, getState: GetState) => {
  const state = getState()
  const account = state.core.account
  SETTINGS_API.setPasswordReminderRequest(account, passwordReminder).catch(showError)
}
