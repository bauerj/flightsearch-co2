import browser from 'webextension-polyfill'
import {AtmosfairAPI, Flight} from './lib/api.js'

let api = new AtmosfairAPI()

browser.runtime.onMessage.addListener(processRequest);

async function processRequest(msg) {
    let airports = msg.airports, aircrafts = msg.aircrafts
    let flights = []

    for (let position = 0; position + 1 < airports.length; position++) {
        flights.push(new Flight(airports[position], airports[position+1], aircrafts[position]))
    }
    
    return await api.getEmission(flights)
}