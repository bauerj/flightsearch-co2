let translation = {
    "de": {
        "Compensate now": "Jetzt kompensieren",
        "CO₂ Information": "CO₂-Informationen",
        "For train journeys, the CO₂ output cannot be calculated yet.": "Für Zugreisen kann der CO₂-Ausstoß aktuell noch nicht angegeben werden.",
        "Loading CO₂ information": "CO₂-Informationen werden geladen",
        'For this journey, about {co2Text}kg CO₂ are released per passenger. <a href="{linkTarget}">Compensate now!</a>': 'Für diese Reise werden etwa {co2Text}kg CO₂ pro Passagier freigesetzt. <a href="{linkTarget}">Jetzt kompensieren!</a>'
    }
}

let language = "";

export function translate(text, placeholders={}) {
    let out
    if (translation[language]) {
        out = translation[language][text]
    }
    else {
        out = text
    }
    for (let item in placeholders) {
        out = out.replace("{" + item + "}", placeholders[item])
    }
    return out
}

export function setLanguage(lang) {
    language = lang;
}
