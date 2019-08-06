import axios from 'axios'

const cache = {}
const requestsFor = {}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
 

export class AxiosThrottled {
    constructor(cooldown) {
        this.nextRequest = 0
        this.cooldown = cooldown
        this._axios = axios
        this.get = this.getWrapper("get")
        this.post = this.getWrapper("post")
        this.delete = this.getWrapper("delete")
        this.put = this.getWrapper("put")
        this.patch = this.getWrapper("patch")
    }

    getWrapper(method) {
        return async function m() {
            let cacheString = `${method}:${JSON.stringify(arguments)}`
            return await this.cacheOrDefer(cacheString, async () => await axios[method].apply(this, arguments))
        }
    }

    async cacheOrDefer(cacheString, getter) {
        /*
        Check if this request has already been made. If so, return previous
        values once the response is there.

        Otherwise, wait cooldown ms between each request in order not to overload the API
        */
        if (cache[cacheString]) {
            console.log(`${cacheString} was in cache already`)
            return cache[cacheString]
        }

        if (requestsFor[cacheString] === undefined) {
            // This is the first request for cacheString, defer if necessary
            requestsFor[cacheString] = []

            let nextTS = this.nextRequest + this.cooldown
            if (nextTS < +new Date())
                nextTS = +new Date()
            this.nextRequest = nextTS

            let toSleep = Math.max(0, nextTS - new Date())
            console.log(`Sleeping ${toSleep}ms before getting API access for requesting ${cacheString}`)
            await sleep(toSleep)

            let value = await getter()
            cache[cacheString] = value
            for (let resolve of requestsFor[cacheString]) {
                resolve(value)
            }
            console.log(`Returned ${requestsFor[cacheString].length} times for ${cacheString}`)
            value.data["_originalRequest"] = true
            return value
        }
        else {
            // This is already being requested. Just wait.
            return await new Promise(promise => requestsFor[cacheString].push(promise))
        }
    }

}