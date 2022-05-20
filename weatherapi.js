const apikey = "9b844f9ec461fb26f16bb808550c5aca";

async function fetch_json(url) {
    const response = await fetch(url)
    return await response.json()
}

function geolocate() {
    return new Promise((resolve, reject) => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(resolve, reject);
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

function get_weather_from_latlong(lat, long) {
    // TODO: replace with updated API methinks
    const url = `https://api.darksky.net/forecast/${encodeURIComponent(apikey)}/${encodeURIComponent(lat)},${encodeURIComponent(long)}?units=us`;
    return fetch_json(url);
}

