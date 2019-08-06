import browser from 'webextension-polyfill'

async function processFlight(flight) {
    if (!flight.querySelector("._co2-amount")) { // this is a result row
        let beforeElement = flight.querySelector(".gws-flights-results__itinerary-price")
        let newElement = document.createElement('div')
        // Add CO2 row
        newElement.innerHTML = '<div><div class="flt-subhead1Normal _co2-amount"></div></div>'
    
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
    
        for (let aircraft of flight.querySelectorAll(".gws-flights-results__aircraft-type span")) {
            if (aircraft.innerHTML)
                aircrafts.push(aircraft.innerHTML)
        }
    
        let msg = {
            "airports": airports,
            "aircrafts": aircrafts
        }
        
        let emissionData = await browser.runtime.sendMessage(msg)
        let co2t = ("" + (emissionData.co2).toFixed(0)).replace(".", ",")
        newElement.querySelector("._co2-amount").innerHTML = `ca. <b>${co2t}kg</b> CO<sub>2</sub>`
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