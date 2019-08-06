import browser from 'webextension-polyfill'
import { AxiosThrottled } from './utils'
const axios = new AxiosThrottled(500)

const alreadyDeleted = []

export class Leg {
    constructor(airport, aircraft) {
        this.airport = airport
        this.aircraft = aircraft;
    }
}

export class Trip {
    constructor() {
        this.legs = [];
    }

    addLeg(leg) {
        this.legs.push(leg);
    }
}

export class AtmosfairAPI {
    constructor() {
        AtmosfairAPI.BASE_URL = this.BASE_URL = "https://co2offset.atmosfair.de/api/";
    }
    

    async getEmission(trip) {
        const url = this.BASE_URL + "flight/activity";
        let payload = {
            "amount":0,
            "returnFlight":false,
            "flightCount":1,
            "passengerCount":1,
            "entireAircraft":false,
            "legs":[
            ],
            "proportion":1
        };
        for (let l of trip.legs) {
            payload["legs"].push({
                "airport": l.airport,
                "travelClass": 3,
                "charter": false,
                "aircraft": l.aircraft ? l.aircraft.id : null
            })
        }
        let emission = (await axios.post(url, payload)).data

        // TODO find a better way to keep this from getting added to the cart immediately
        if (alreadyDeleted[emission.id] === undefined) {
            alreadyDeleted[emission.id] = true
            await axios._axios.delete(this.BASE_URL + `payment/cart/activity/${emission.id}`)
        }
        return emission
    }

    async getAirportByIATA(code) {
        let airport = await browser.storage.local.get("airports/" + code)

        if (airport && airport[`airports/${code}`] && airport[`airports/${code}`].iataCode) {
            console.log(`Returning airport ${JSON.stringify(airport[`airports/${code}`])} from cache for ${code}`)
            return airport[`airports/${code}`]
        }

        const url = this.BASE_URL + "airport?query=" + code
        let airports = (await axios.get(url)).data
        let toStore = {}

        for (let a of airports) {
            toStore["airports/" + a.iataCode] = a
            if (a.iataCode == code)
                airport = a
        }

        await browser.storage.local.set(toStore)
        console.log(`Returning airport ${airport} from web for ${code}`, airport)
        return airport
    }

    async getAircraftByName(name) {
        let aircrafts = await browser.storage.local.get("aircrafts")

        if (!aircrafts || aircrafts.length == 0) {
            console.log("Requesting aircrafts from web")
            const url = this.BASE_URL + "flight/aircraft"
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