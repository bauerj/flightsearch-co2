import browser from 'webextension-polyfill'
import {AtmosfairAPI, Flight} from './lib/api.js'
import {sanitisePlaneName} from "./lib/utils"

let api = new AtmosfairAPI()

browser.runtime.onMessage.addListener(processRequest);

async function processRequest(msg) {
    let airports = msg.airports, aircrafts = msg.aircrafts, travelClass = msg.travelClass
    let flightNumbers = msg.flightNumbers, flightDates = msg.flightDates
    let emissionData = []

    for (let position = 0; position + 1 < airports.length; position++) {
        let from = airports[position]
        let to = airports[position+1]
        let aircraft = await api.getAircraftByName(aircrafts[position])
        let flightNumber = flightNumbers[position]
        let flightDate = flightDates[position]
        aircraft = aircraft ? aircraft.iataCode : sanitisePlaneName(aircrafts[position])
        
        emissionData.push(api.getEmission(new Flight(from, to, aircraft, flightNumber, flightDate, travelClass)))
    }

    try {
        emissionData = await Promise.all(emissionData)
    }
    catch (e){
        console.error(e, e.stack)
        return []
    }

    return emissionData
}