// @flow
import { Platform } from 'react-native'
import DeviceInfo from 'react-native-device-info'

const { info1 } = require('../infoServer')

const deviceId = DeviceInfo.getUniqueID()

export async function register () {
  const tokenId = await firebase.iid().getToken()
  const deviceDescription = await DeviceInfo.getUserAgent()
  const osType = Platform.OS
  const edgeVersion = DeviceInfo.getVersion()
  const edgeBuildNum = DeviceInfo.getBuildNumber()

  return info1.post(`device/${deviceId}`, {
    tokenId,
    deviceDescription,
    osType,
    edgeVersion,
    edgeBuildNum
  })
}
