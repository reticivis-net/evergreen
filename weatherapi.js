async function fetch_json(url) {
    const response = await fetch(url)
    return await response.json()
}

function geolocate() {
    return new Promise((resolve, reject) => {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true
            });
        } else {
            console.debug("no geolocation available")
            reject("no geolocation available")
        }
    })
}

function f_to_c(f) {
    return (f - 32) * (5 / 9);
}

function c_to_f(c) {
    return (c * (9 / 5)) + 32
}

function darksky_api_request(lat,long) {
    return fetch_json(`https://api.darksky.net/forecast/9b844f9ec461fb26f16bb808550c5aca/${encodeURIComponent(lat)},${encodeURIComponent(long)}?units=si`)
}
function openweathermap_api_request(lat,long) {
    return fetch_json(`https://api.openweathermap.org/data/3.0/onecall?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(long)}&appid=74b014b3526434e435b0b553d9f673e1`)
}
function openmeteo_api_request(lat,long) {
    return fetch_json(`https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(long)}&hourly=temperature_2m,relativehumidity_2m,apparent_temperature,precipitation,cloudcover&current_weather=true&timeformat=unixtime`)
}

function get_weather_from_latlong(lat, long, provider) {
    switch(provider) {
        case "darksky":
            return darksky_api_request(lat,long)
        case "openweathermap":
            return openweathermap_api_request(lat,long)
        case "openmeteo":
            return openmeteo_api_request(lat,long)
    }

}

function geocode(addr) {
    return fetch_json(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(addr)}&format=json&addressdetails=1&limit=1`).then(r => {
        if (r && r.length) {
            return {
                "latitude": r[0]["lat"],
                "longitude": r[0]["lon"]
            }
        } else {
            return null
        }

    })
}

function reverse_geocode(lat, long, accuracy) {
    // accuracy of GPS is in meters, need to convert to OSM tiles https://wiki.openstreetmap.org/wiki/Zoom_levels
    accuracy = Math.min(Math.ceil(-Math.log2((accuracy * 2) / 40075017)), 12)

    return fetch_json(`https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(long)}&format=json&zoom=${encodeURIComponent(accuracy)}`).then(r => {
        return r["display_name"]
    })
}

