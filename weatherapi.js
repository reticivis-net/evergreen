const apikey = "9b844f9ec461fb26f16bb808550c5aca";

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

async function get_weather_at_current_pos() {
    const position = await geolocate();
    return await get_weather_from_latlong(position.coords.latitude, position.coords.longitude);
}

function f_to_c(f) {
    return (f - 32) * (5 / 9);
}

function c_to_f(c) {
    return (c * (9 / 5)) + 32
}

function get_weather_from_latlong(lat, long) {
    // TODO: replace with openweathermap by March 31st, 2023
    return fetch_json(`https://api.darksky.net/forecast/${encodeURIComponent(apikey)}/${encodeURIComponent(lat)},${encodeURIComponent(long)}?units=us`)
}

function geocode(addr) {
    return fetch_json(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(addr)}&format=json&addressdetails=1&limit=1`).then(r => {
        return {
            "latitude": r[0]["lat"],
            "longitude": r[0]["long"]
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

