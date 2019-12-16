import browser from 'webextension-polyfill'

export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const googleToAtmosfair = require("./planesGoogleToAtmosfair.json")
 
export function sanitisePlaneName(name) {
    // Some planes have different names for Google and Atmosfair. Let's change that.
    if (googleToAtmosfair[name] !== undefined)
        return googleToAtmosfair[name]
    return name
}

function getExtensionVersion() {
    return browser.runtime.getManifest().version
}

export class Cache {
    constructor(maxAge) {
        this.maxAge = maxAge
        this.type = "?"
    }

    async get(key) {
        key = this._getFullKey(key)

        if (await this._isExpired(key)) {
            console.log(`Cache for ${key} is expired (max_age=${this.maxAge})`)
            return
        }

        let result = await browser.storage.local.get(key)
        if (result)
            console.log(`Got result ${key} from cache.`, result)
        return result[key]
    }

    async set(key, value) {
        key = this._getFullKey(key)
        console.log(`Saving value for ${key}=${value} in cache.`)
        await browser.storage.local.set({[key]: value, [`${key}/created`]: + new Date()})
    }

    async _isExpired(fullKey) {
        let created = await browser.storage.local.get(`${fullKey}/created`)
        let now = + new Date()
        return now > created + this.maxAge * 1000
    }

    _getFullKey(key) {
        key = key.replace("/", "_")
        return `/${getExtensionVersion()}/${this.type}/${key}`
    }
}

export class FlightCache extends Cache {
    constructor() {
        super(60*60*24*7 /* seconds = 1 week */)
        this.type = "flight"
    }
}

export class AirplaneCache extends Cache {
    constructor() {
        super(60*60*24*30 /* 1 month */)
        this.type = "airplane"
    }
}