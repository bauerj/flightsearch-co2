import browser from 'webextension-polyfill'
import {sanitiseTravelClass} from "./lib/utils";

function getTravelClass() {
    let selectors = document.querySelectorAll(".gws-flights__seating_class_dropdown span")
    let travelClassText = ""
    for (let s of selectors) {
        if (s.style[0] === undefined) {
            travelClassText = s.innerText
            break
        }
    }
    return {
        "Economy Class": "Y",
        "Premium Economy": "W",
        "Business Class": "B",
        "First Class": "F"
    }[travelClassText]
}

function addFlightLinkText(flight, counter){
    let cT
    if ( counter<0 )
        cT = "d="
    else
        cT = "v" + counter + "="

    let linkPartText = ""
    linkPartText += addFlightLinkPartText("&f_", cT, flight.departure)
    linkPartText += addFlightLinkPartText("&f_c", cT, flight.travelClass)
    linkPartText += addFlightLinkPartText("&f_m", cT, flight.aircraftType)
    linkPartText += addFlightLinkPartText("&f_t", cT, "l")
    return linkPartText
}

function addFlightLinkPartText(prefix, mid, suffix){
    if (!suffix)
        return ""
    return prefix + mid + sanitiseTravelClass(suffix)
}

async function processFlight(flight) {
    if (!flight.querySelector("._co2-amount")) { // this is a result row
        let beforeElement = flight.querySelector(".gws-flights-results__itinerary-price")
        let newElement = document.createElement('div')
        // Add CO2 row
        newElement.innerHTML = '<div data-animation-fadeout style><div class="flt-subhead1Normal _co2-amount"></div></div>'
    
        beforeElement.parentNode.insertBefore(newElement, beforeElement)
        
        let airports = []
        let aircrafts = []
    
        let _lastAirport = null
        for (let airport of flight.querySelectorAll(".gws-flights-results__iata-code")) {
            let a = airport.innerHTML
            if (a != _lastAirport)
                airports.push(a)
            _lastAirport = a
        }
    
        for (let aircraft of flight.querySelectorAll(".gws-flights-results__aircraft-type span:not(.gws-flights__separator)")) {
            if (aircraft.innerHTML)
                aircrafts.push(aircraft.innerHTML)
        }

        if (airports.length === 0) {
            // This is a train ride.
            return
        }
    
        let msg = {
            "airports": airports,
            "aircrafts": aircrafts,
            "travelClass": getTravelClass()
        }
        
        let flightsWithEmissions = await browser.runtime.sendMessage(msg)

        let co2 = 0

        let linkText = "https://co2offset.atmosfair.de/co2offset?p=1000013619#/flight?f_r=o"
        let counter = -1
        let _lastFlight
        for (let f of flightsWithEmissions) {
            if (f) {
                co2 += f.co2
                linkText += addFlightLinkText(f, counter++)
                _lastFlight = f
            }
            else
                return newElement.querySelector("._co2-amount").innerHTML = `X`
        }
        linkText += "&f_a=" + _lastFlight.arrival

        let co2Text = ("" + (co2).toFixed(0)).replace(".", ",")
        newElement.querySelector("._co2-amount").innerHTML = `ca. <a href="${linkText}"><b>${co2Text}kg</b> CO<sub>2</sub></a>`
    }
   
}

function processNode(node) {
    let flightNodes = node.querySelectorAll ? node.querySelectorAll(".gws-flights-results__itinerary-card") : []
    for (let f of flightNodes) {
        if (!f.querySelector("._co2-price"))
            processFlight(f)
    }
}

//chrome.tabs.onUpdated.addListener(processFlights)
const observer = new MutationObserver(function(mutationRecord) {
    for (let m of mutationRecord) {
        if (m.type != 'childList' || m.addedNodes.length < 1) {
            return
        }
        for (let node of m.addedNodes) {
            processNode(node)
        }
    }
    
})
observer.observe(document.body, { attributes: false, childList: true, subtree: true })

setInterval(() => processNode(document), 1000)