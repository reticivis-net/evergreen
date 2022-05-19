const apikey = "9b844f9ec461fb26f16bb808550c5aca";

function fetch_json(url, callback) {
    fetch(url).then(r => r.json()).then(callback)
}

function geolocate(callback) {
    if (navigator.geolocation) {
        return navigator.geolocation.getCurrentPosition(callback);
    } else {
        console.debug("no geolocation available")
        return false;
    }
}

function get_weather_at_current_pos(callback) {
    geolocate(position => {
        get_weather_from_latlong(position.coords.latitude, position.coords.longitude, callback);
    });
}

function f_to_c(f) {
    return (f - 32) * (5 / 9);
}

function get_weather_from_latlong(lat, long, callback) {
    // TODO: replace with updated API methinks
    const url = `https://api.darksky.net/forecast/${encodeURIComponent(apikey)}/${encodeURIComponent(lat)},${encodeURIComponent(long)}?units=us`;
    fetch_json(url, callback);
}

