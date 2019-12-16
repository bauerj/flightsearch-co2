import {sleep, sanitisePlaneName, FlightCache, AirplaneCache} from './utils'
import axios from 'axios'

export class Flight {
    constructor(from, to, aircraftType) {
        this.from = from
        this.to = to
        this.aircraftType = aircraftType
    }

    toString() {
        return `${this.from}->${this.to}(${this.aircraftType})`
    }
}

export class AtmosfairAPI {
    constructor() {
        AtmosfairAPI.API_BASE = this.API_BASE = "https://api.atmosfair.de/api/";
        AtmosfairAPI.WEB_BASE = this.WEB_BASE = "https://co2offset.atmosfair.de/api/";
        this.flightsToRequest = {}
        this.requestWaiting = false
        this.flightCache = new FlightCache()
        this.airplaneCache = new AirplaneCache()
    }
    

    async getEmission(flight) {
        if (await this.flightCache.get(flight.toString()))
            return await this.flightCache.get(flight.toString())


        if (this.flightsToRequest[flight.toString()] === undefined) {
            this.flightsToRequest[flight.toString()] = []
        }

        // A request will be sent in a bit. Let's just queue this flight for that request.
        if (this.requestWaiting) {
            console.log(`Queueing flight ${flight.toString()}`)
            return await new Promise(promise => this.flightsToRequest[flight.toString()].push({promise, flight}))
        }

        // Wait for more flights to appear, then request all at once
        this.requestWaiting = true
        this.flightsToRequest[flight.toString()].push({promise: () => {}, flight})
        
        console.log(`Defering load for ${flight.toString()}`)
        await sleep(100)

        this.requestWaiting = false
        let flightsToRequest = this.flightsToRequest
        this.flightsToRequest = []

        let allFlights = Object.values(flightsToRequest).map((i) => i[0].flight)

        let emissions = await this._getEmissionForFlights(allFlights.reverse())

        if (emissions.status != "SUCCESS") {
            console.log(`ERROR: Atmosfair API request failed while getting ${allFlights.length} flights.`, emissions.errors)
        }

        let ourFlight = undefined // For this instance

        for (let f of emissions.flights) {
            if (!f || f.co2 === undefined || f.co2 == 0)
                continue
            let repr = new Flight(f.departure, f.arrival, f.aircraftType).toString()
            this.flightCache.set(repr, f)

            if (flight.toString() == repr)
                ourFlight = f

            for (let {promise, flight} of flightsToRequest[repr]) {
                promise(f)
            }
        }
        return ourFlight
    }

    async _getEmissionForFlights(flights) {
        const url = this.API_BASE + "emission/flight"
        let payload = {
            "accountId": API_CONFIG.username,
            "password": API_CONFIG.password,
            "flights": [],
        }
        
        for (let f of flights) {
            payload["flights"].push({
                "passengerCount": 1,
                "flightCount": 1,
                "departure": f.from,
                "arrival": f.to,
                "travelClass": "W",
                "charter": false,
                "aircraftType": f.aircraftType ? f.aircraftType : null
            })
        }

        let emission = (await axios.post(url, payload)).data
        return emission
    }

    async getAircraftByName(name) {
        name = sanitisePlaneName(name)
        let aircrafts = await this.airplaneCache.get("aircrafts")

        if (!aircrafts || aircrafts.length == 0) {
            console.log("Requesting aircrafts from web")
            const url = this.WEB_BASE + "flight/aircraft"
            aircrafts = (await axios.get(url)).data
            await this.airplaneCache.set("aircrafts", aircrafts)
        }
        
        for (let a of aircrafts) {
            if (a.name == name)
                return a
        }
        console.log(`No aircraft found for ${name}`)
    }
}