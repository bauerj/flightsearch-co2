import {sleep, FlightCache} from './utils'
import axios from 'axios'

export class Flight {
    constructor(from, to, aircraftType, flightNumber, flightDate, travelClass) {
        this.from = from
        this.to = to
        this.aircraftType = aircraftType
        this.travelClass = travelClass
        this.flightDate = flightDate
        this.flightNumber = flightNumber === undefined ? null : flightNumber
    }

    toString() {
        return `${this.flightNumber}:${this.from}->${this.to}(${this.aircraftType}):${this.travelClass}`
    }
}

export class AtmosfairAPI {
    constructor() {
        AtmosfairAPI.API_BASE = this.API_BASE = "https://api.atmosfair.de/api/";
        AtmosfairAPI.WEB_BASE = this.WEB_BASE = "https://co2offset.atmosfair.de/api/";
        this.flightsToRequest = {}
        this.requestWaiting = false
        this.flightCache = new FlightCache()
        // aircraft type will be missing in response if flight number is set
        this.flightNumbersToAircrafts = {}
    }
    

    async getEmission(flight) {
        if (await this.flightCache.get(flight.toString()))
            return await this.flightCache.get(flight.toString())

        this.flightNumbersToAircrafts[flight.flightNumber] = flight.aircraftType

        if (this.flightsToRequest[flight.toString()] === undefined) {
            this.flightsToRequest[flight.toString()] = []
        }

        // A request will be sent in a bit. Let's just queue this flight for that request.
        if (this.requestWaiting) {
            console.debug(`Queueing flight ${flight.toString()}`)
            return await new Promise(promise => this.flightsToRequest[flight.toString()].push({promise, flight}))
        }


        // Wait for more flights to appear, then request all at once
        this.requestWaiting = true
        this.flightsToRequest[flight.toString()].push({promise: () => {}, flight})
        
        console.debug(`Defering load for ${flight.toString()}`)
        await sleep(100)

        this.requestWaiting = false
        let flightsToRequest = this.flightsToRequest
        this.flightsToRequest = []

        let allFlights = Object.values(flightsToRequest).map((i) => i[0].flight)

        let emissions = await this._getEmissionForFlights(allFlights.reverse())

        if (emissions.status != "SUCCESS") {
            console.error(`Atmosfair API request failed while getting ${allFlights.length} flights.`, emissions.errors)
        }

        let ourFlight = undefined // For this instance

        for (let f of emissions.flights) {
            let aircraftType = f.aircraftType

            if (!aircraftType)
                aircraftType = this.flightNumbersToAircrafts[f.flightNumber]

            let repr = new Flight(f.departure, f.arrival, aircraftType, f.flightNumber, f.departureDate, f.travelClass).toString()

            if (flight.toString() == repr)
                ourFlight = f

            if (!f || !f.co2) {
                if (f.flightNumber) {
                    // Maybe it works if we request it without a flight number 🤔
                    console.debug(`Retrying without flight number ${f.flightNumber}`)
                    let newRequest = this.getEmission(new Flight(f.departure, f.arrival, this.flightNumbersToAircrafts[f.flightNumber], null, null, f.travelClass))
                    
                    for (let {promise, flight} of flightsToRequest[repr]) {
                        newRequest.then(promise)
                    }
                }
                continue
            }
                
            this.flightCache.set(repr, f)

            for (let {promise, flight} of flightsToRequest[repr]) {
                promise(f)
            }
        }

        if (flight.flightNumber && (!ourFlight || !ourFlight.co2)) {
            return await this.getEmission(new Flight(ourFlight.departure, ourFlight.arrival, this.flightNumbersToAircrafts[flight.flightNumber], null, null, flight.travelClass))
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
            let flightData = {
                "passengerCount": 1,
                "flightCount": 1,
                "departure": f.from,
                "arrival": f.to,
                "travelClass": f.travelClass,
                "charter": false,
                "aircraftType": f.aircraftType ? f.aircraftType : null
            }

            if (f.flightNumber && f.flightDate) {
                flightData["departureDate"] = f.flightDate.toISOString().slice(0, 10);
                flightData["flightNumber"] = f.flightNumber
            }

            payload["flights"].push(flightData)
        }

        let emission = (await axios.post(url, payload)).data
        return emission
    }
}