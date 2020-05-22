// @flow
class InfoServer {
  constructor (version) {
    this.uri = __DEV__ ? 'http://192.168.1.186:8087' : 'https://info1.edgesecure.co:8444'
    this.version = version
  }

  async get (path) {
    const response = await fetch(`${this.uri}/v${this.version}/${path}`)
    if (response != null) {
      const result = await response.json()
      return result
    }
  }

  async post (path, body) {
    const response = await fetch(`${this.uri}/v${this.version}/${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })
    if (response != null) {
      const result = await response.json()
      return result
    }
  }
}

export const info1 = new InfoServer(1)
