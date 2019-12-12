import browser from 'webextension-polyfill'
import { AxiosThrottled } from './utils'
const axios = new AxiosThrottled(500)

export class Flight {
    constructor(from, to, aircraftType) {
        this.from = from;
        this.to = to;
        this.aircraftType = aircraftType;
    }

}

export class AtmosfairAPI {
    constructor() {
        AtmosfairAPI.API_BASE = this.API_BASE = "https://api.atmosfair.de/api/";
        AtmosfairAPI.WEB_BASE = this.WEB_BASE = "https://co2offset.atmosfair.de/api/";
    }
    

    async getEmission(flights) {
        const url = this.API_BASE + "emission/flight"
        let payload = {
            "accountId": API_CONFIG.username,
            "password": API_CONFIG.password,
            "flights": [],
        }
        console.log(flights)
        for (let f of flights) {
            payload["flights"].push({
                "passengerCount": 1,
                "flightCount": 1,
                "departure": f.from,
                "arrival": f.to,
                "travelClass": "W",
                "charter": false,
                "aircraftType": f.aircraftType ? f.aircraftType.iataCode : null
            })
        }
        let emission = (await axios.post(url, payload)).data

        return emission
    }

    async getAircraftByName(name) {
        let aircrafts = await browser.storage.local.get("aircrafts")

        if (!aircrafts || aircrafts.length == 0) {
            console.log("Requesting aircrafts from web")
            const url = this.WEB_BASE + "flight/aircraft"
            let aircrafts = (await axios.get(url)).data
            await browser.storage.local.set({aircrafts: aircrafts})
            console.log(aircrafts)
        }
        
        for (let a of aircrafts.aircrafts) {
            if (a.name.includes(name))
                return a
        }
        console.log(`No aircraft found for ${name}`)
    }
}