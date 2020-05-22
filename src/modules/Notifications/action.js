// @flow
import DeviceInfo from 'react-native-device-info'

const { info1 } = require('../infoServer')

const deviceId = DeviceInfo.getUniqueID()

export async function register (userId, currencies) {
  return info1.post(`notifications`, {
    userId,
    deviceId,
    currencies
  })
}
