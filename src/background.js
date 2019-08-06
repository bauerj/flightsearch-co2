import browser from 'webextension-polyfill'
import {AtmosfairAPI, Leg, Trip} from './lib/api.js'

let api = new AtmosfairAPI()

browser.runtime.onMessage.addListener(processRequest);

async function processRequest(msg) {
    let airports = msg.airports, aircrafts = msg.aircrafts
    let trip = new Trip()
    
    for (let i=0; i<airports.length; i++) {
        trip.addLeg(new Leg(await api.getAirportByIATA(airports[i]), aircrafts[i] ? await api.getAircraftByName(aircrafts[i]) : undefined))
    }

    return await api.getEmission(trip)
}