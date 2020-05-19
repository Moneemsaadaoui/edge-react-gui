// @flow

import { StyleSheet } from 'react-native'

import { THEME } from '../../theme/variables/airbitz.js'
import { scale } from '../../util/scaling.js'

export const rawStyles = {
  mainScrollView: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
  },
  exchangeRateContainer: {
    alignItems: 'center',
    marginVertical: scale(12),
  },

  main: {
    alignItems: 'center',
    width: '100%',
  },
  feeArea: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: THEME.COLORS.TRANSPARENT,
  },
  feeAreaText: {
    fontSize: scale(16),
    color: THEME.COLORS.WHITE,
    backgroundColor: THEME.COLORS.TRANSPARENT,
  },

  pendingSymbolArea: {
    height: scale(12),
  },
  slider: {
    backgroundColor: THEME.COLORS.TRANSPARENT,
  },
  sliderWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sliderStyle: {
    width: scale(270),
  },
  error: {
    marginHorizontal: scale(10),
    backgroundColor: THEME.COLORS.TRANSPARENT,
  },
  errorText: {
    textAlign: 'center',
    color: THEME.COLORS.ACCENT_RED,
  },
  menuTrigger: {
    paddingHorizontal: scale(8),
    paddingVertical: scale(4),
  },
  trigger: {
    fontFamily: THEME.FONTS.BOLD,
    fontSize: scale(18),
    color: THEME.COLORS.WHITE,
    paddingHorizontal: scale(8),
  },
  optionContainer: {
    width: scale(165),
  },
  optionRow: {
    paddingVertical: scale(7),
    borderBottomColor: THEME.COLORS.GRAY_3,
    borderBottomWidth: scale(1),
  },
  optionText: {
    fontSize: scale(16),
    color: THEME.COLORS.GRAY_1,
  },
  maxSpend: {
    color: THEME.COLORS.ACCENT_ORANGE,
  },
  balanceText: {
    color: THEME.COLORS.WHITE,
    fontSize: scale(16),
  },
  balanceContainer: {
    alignItems: 'center',
    marginTop: scale(10),
  },
  row: {
    alignItems: 'center',
    width: '100%',
  },
  rowText: {
    backgroundColor: THEME.COLORS.TRANSPARENT,
    color: THEME.COLORS.WHITE,
  },
  pinInputContainer: {
    width: scale(60),
    height: scale(50),
  },
  pinInputSpacer: {
    width: scale(10),
  },
  activityIndicatorSpace: {
    height: scale(54),
    paddingVertical: scale(18),
  },
  addUniqueIDButton: {
    backgroundColor: THEME.COLORS.TRANSPARENT,
    padding: scale(14),
    alignItems: 'center',
    justifyContent: 'center',
  },
  addUniqueIDButtonText: {
    color: THEME.COLORS.WHITE,
  },
  activeOpacity: THEME.OPACITY.ACTIVE,
  footer: {
    marginTop: scale(12),
  },
  footerWithPaymentId: {
    marginTop: scale(0),
  },
  feeWarning: {
    color: THEME.COLORS.ACCENT_ORANGE,
  },
  feeDanger: {
    color: THEME.COLORS.ACCENT_RED,
  },
}

export const styles = StyleSheet.create(rawStyles)
