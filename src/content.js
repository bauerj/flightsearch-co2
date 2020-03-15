import browser from 'webextension-polyfill'
import {sanitiseTravelClass} from "./lib/utils"
import styleDefinition from "./style.css"
import {translate, setLanguage} from "./lib/i18n"

function getUserLanguage() {
    if (window.location.search.indexOf("hl=en") > 0)
        return "en";
    if (window.location.search.indexOf("hl=de") > 0)
        return "de";
    return navigator.language;
}

function getTravelClassText() {
    let selectors = document.querySelectorAll(".gws-flights__seating_class_dropdown span")
    let travelClassText = ""
    for (let s of selectors) {
        if (s.style[0] === undefined) {
            travelClassText = s.innerText
            break
        }
    }
    return travelClassText
}

function getTravelClass(travelClassText) {
    if (getUserLanguage() == "de")
        return {
            "Economy Class": "Y",
            "Premium Economy": "W",
            "Business Class": "B",
            "First Class": "F"
        }[travelClassText]
    if (getUserLanguage() == "en")
        return {
            "Economy": "Y",
            "Premium Economy": "W",
            "Business": "B",
            "First Class": "F"
        }[travelClassText]

    return "Y" // Todo: Warnung anzeigen
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

function getFlightBaseDate() {
    // Extract flight date from the URL
    // The localised date on the website is harder to parse
    let baseDates = window.location.hash.match(/([0-9]{4}-[0-9]{2}-[0-9]{2})/gm)
    let legNumber = Math.max(document.querySelectorAll('ol[role=navigation] li').length - 1, 0)

    return new Date(baseDates[legNumber])
}

async function getAirports(element) {
    let airports = []
    let _lastAirport = null
    for (let airport of element.querySelectorAll(".gws-flights-results__iata-code")) {
        let a = airport.innerHTML
        if (a != _lastAirport)
            airports.push(a)
        _lastAirport = a
    }
    return airports
}

function getAircrafts(element) {
    let aircrafts = []
    for (let aircraft of element.querySelectorAll(".gws-flights-results__aircraft-type span")) {
        if (aircraft.innerHTML)
            aircrafts.push(aircraft.innerHTML)
    }
    return aircrafts
}

async function getFlightNumbers(element) {
    let flightNumbers = []
    for (let flightNumber of element.querySelectorAll(".gws-flights-results__other-leg-info span+span:not([class])")) {
        flightNumber = flightNumber.parentNode;
        if (flightNumber.innerText)
            flightNumbers.push(flightNumber.innerText.replace(/[^A-Za-z0-9]/g, ""))
    }
    return flightNumbers
}

async function getFlightDates(element) {
    let flightDates = []
    let baseDate = getFlightBaseDate() // this is the date of the _first_ flight

    for (let flightDeparture of element.querySelectorAll(".gws-flights-results__leg-departure")) {
        // all other flights may be days later. Find out whether this is the case
        let flightDate = new Date(baseDate)
        let offset = flightDeparture.querySelector(".gws-flights__offset-days")
        if (offset) {
            flightDate.setDate(new Date().getDate() + Number(offset.innerHTML))
        }
        flightDates.push(flightDate)
    }
    return flightDates
}

async function getCo2Info(flightsWithEmissions) {
    let co2 = 0
        let linkTarget = "https://co2offset.atmosfair.de/co2offset?p=1000013619#/flight?f_r=o"
        let counter = -1
        let _lastFlight
        
        for (let f of flightsWithEmissions) {
            if (f) {
                co2 += f.co2
                linkTarget += addFlightLinkText(f, counter++)
                _lastFlight = f
            }
            else
                return newElement.querySelector("._co2-amount").innerHTML = `X`
        }

        if (_lastFlight && _lastFlight.arrival)
        linkTarget += "&f_a=" + _lastFlight.arrival

        let co2Text = ("" + (co2).toFixed(0)).replace(".", ",")
        return {
            "co2Text": co2Text,
            "linkTarget": linkTarget
        }
}

async function processFlight(flight) {
    if (!flight.querySelector("._co2-amount")) { // this is a result row
        let beforeElement = flight.querySelector(".gws-flights-results__itinerary-price")
        let newElement = document.createElement('div')
        // Add CO2 row
        newElement.innerHTML = '<div data-animation-fadeout style><div class="flt-subhead1Normal _co2-amount"></div></div>'
    
        beforeElement.parentNode.insertBefore(newElement, beforeElement)

        let airports = await getAirports(flight)
        
        if (airports.length === 0) {
            // This is a train ride.
            return
        }
    
        let msg = {
            "airports": airports,
            "aircrafts": getAircrafts(flight),
            "travelClass": getTravelClass(getTravelClassText()),
            "flightNumbers": await getFlightNumbers(flight),
            "flightDates": await getFlightDates(flight)
        }
        
        let flightsWithEmissions = await browser.runtime.sendMessage(msg)

        let co2info = await getCo2Info(flightsWithEmissions)
        newElement.querySelector("._co2-amount").innerHTML = `<div>ca. <b>${co2info["co2Text"]}kg</b> CO<sub>2</sub></div><div><a class="_co2-link" href="${co2info["linkTarget"]}" target="_blank"><small><small>${translate("Compensate now")}!</small></small></a></div>`
    }
}

async function processSummary(summary) {
    let beforeElement = summary.querySelectorAll(".gws-flights-book__booking-options-heading")[1]
    let newElement = document.createElement('div')
    newElement.className = "_co2-info"
    let heading = document.createElement("h2")
    heading.className = "flt-headline6"
    heading.innerText = translate("CO₂ Information")
    let description = document.createElement("div")
    description.className = "flt-body2"
    newElement.appendChild(heading)
    newElement.appendChild(description)

    beforeElement.parentNode.insertBefore(newElement, beforeElement)
    
    let airports = await getAirports(summary)

    if (airports.length === 0) {
        // This is a train ride.
        description.innerText = translate("For train journeys, the CO₂ output cannot be calculated yet.")
        return
    }

    console.log(airports)

    let travelClassText = summary.querySelector(".gws-flights-results__seating-class").innerText

    let msg = {
        "airports": airports,
        "aircrafts": getAircrafts(summary),
        "travelClass": getTravelClass(travelClassText),
        "flightNumbers": await getFlightNumbers(summary),
        "flightDates": await getFlightDates(summary)
    }
    
    let flightsWithEmissions = await browser.runtime.sendMessage(msg)

    let co2info = await getCo2Info(flightsWithEmissions)
    description.innerHTML = translate('For this journey, about {co2Text}kg CO₂ are released per passenger. <a href="{linkTarget}">Compensate now!</a>', co2info)
}

function processNode(node) {
    let flightNodes = node.querySelectorAll ? node.querySelectorAll(".gws-flights-results__itinerary-card") : []
    for (let f of flightNodes) {
        if (!f.querySelector("._co2-price"))
            processFlight(f)
    }
    let summaryNode = node.querySelector ? node.querySelector(".gws-flights-book__trip-summary") : []
    if (!summaryNode.querySelector("._co2-info"))
        processSummary(summaryNode)
    
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

// add CSS
let style = document.createElement('style')
style.type = 'text/css'
style.innerHTML = styleDefinition
document.getElementsByTagName('head')[0].appendChild(style)

setLanguage(getUserLanguage())