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

function openweathermap_api_request(lat, long) {
    return fetch_json(`https://api.openweathermap.org/data/3.0/onecall?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(long)}&appid=74b014b3526434e435b0b553d9f673e1&units=metric`)
}

function nws_api_forecast(lat, long) {
    return fetch_json(`https://api.weather.gov/points/${encodeURIComponent(lat)},${encodeURIComponent(long)}`).then(points => {
        return fetch_json(points["properties"]["forecastGridData"])
    })
}

function nws_api_request(lat, long) {
    // nws is weird so this has to be done weirdly
    return Promise.all([
        nws_api_forecast(lat, long),
        fetch_json(`https://api.weather.gov/alerts/active?status=actual&message_type=alert,update,cancel&point=${encodeURIComponent(lat)},${encodeURIComponent(long)}`)
    ]).then(resp => {
        return {
            "forecast": resp[0],
            "alerts": resp[1]
        }
    })
}


function parse_iso8601_date(date) {
    if (date === "NOW") {
        return new Date();
    } else {
        return date.parse(date)
    }
}

function parse_iso8601_duration(duration) {
    let match = iso8601_duration_regex.exec(duration);
    let years = match[1] || 0;
    let months = match[2] || 0;
    let days = match[3] || 0;
    let hours = match[4] || 0;
    let minutes = match[5] || 0;
    let seconds = match[6] || 0;
    return years * (1000 * 60 * 60 * 24 * 365) +
        months * (1000 * 60 * 60 * 24 * 30) +
        days * (1000 * 60 * 60 * 24) +
        hours * (1000 * 60 * 60) +
        minutes * (1000 * 60) +
        seconds * 1000;
}

// lightly modified from nws docs
const iso8601_start_and_end_regex = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:?\d{2}?)|NOW)\/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:?\d{2}?)|NOW)$/
const iso8601_start_and_duration_regex = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:?\d{2}?)|NOW)\/(P(\d+Y)?(\d+M)?(\d+D)?(?:T(\d+H)?(\d+M)?(\d+S)?)?)$/;
const iso8601_duration_and_end_regex = /^(P(\d+Y)?(\d+M)?(\d+D)?(?:T(\d+H)?(\d+M)?(\d+S)?)?)\/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:?\d{2}?)|NOW)$/
const iso8601_duration_regex = /P(?<years>\d+Y)?(\d+M)?(\d+D)?(?:T(\d+H)?(\d+M)?(\d+S)?)?/;

function parse_iso8601_interval(interval) {
    // nws only appears to use start + duration but docs say it can be any of these 3 so
    if (iso8601_start_and_end_regex.test(interval)) {
        let match = iso8601_start_and_end_regex.exec(interval);
        let start = parse_iso8601_date(match[1]);
        let end = parse_iso8601_date(match[2]);
        return [start, end - start];
    } else if (iso8601_start_and_duration_regex.test(interval)) {
        let match = iso8601_start_and_duration_regex.exec(interval);
        let start = parse_iso8601_date(match[1]);
        let duration = parse_iso8601_duration(match[2]);
        return [start, duration];
    }
    if (iso8601_duration_and_end_regex.test(interval)) {
        let match = iso8601_duration_and_end_regex.exec(interval);
        let duration = parse_iso8601_duration(match[1]);
        let end = parse_iso8601_date(match[2]);
        let start = new Date(end.getTime() - duration);
        return [start, duration];
    } else {
        throw new Error("Unable to parse " + interval);
    }
}

const generic_template = {
    "currently": {
        "summary": "Lorem ipsum",
        "temperature": 0,
        "apparent_temperature": 0,
        "humidity": 0,
        "cloud_cover": 0,
        "precipitation": 0
    },
    "hourly": {
        "summary": "Lorem ipsum",
        "temperature": [{x: 0, y: 0}/*, ...*/],
        "apparent_temperature": [{x: 0, y: 0}/*, ...*/],
        "humidity": [{x: 0, y: 0}/*, ...*/],
        "cloud_cover": [{x: 0, y: 0}/*, ...*/],
        "precipitation": [{x: 0, y: 0}/*, ...*/],
    },
    "daily": {
        "summary": "Lorem ipsum",
        "high": [{x: 0, y: 0}/*, ...*/],
        "apparent_high": [{x: 0, y: 0}/*, ...*/],
        "low": [{x: 0, y: 0}/*, ...*/],
        "apparent_low": [{x: 0, y: 0}/*, ...*/],
        "feels_like": [{x: 0, y: 0}/*, ...*/],
        "humidity": [{x: 0, y: 0}/*, ...*/],
        "cloud_cover": [{x: 0, y: 0}/*, ...*/],
        "precipitation": [{x: 0, y: 0}/*, ...*/],
    },
    "alerts": [
        {
            "severity": "advisory", // advisory, watch, warning
            "url": "https://example.com",
            "title": "Lorem ipsum",
            "expires": 0,
        }//, ...
    ],
    "source": "openweathermap", // openweathermap, etc
}


function zip_openweathermap(data, property, multiply_y_by = 1) {
    return data.map(data_point => {
        let y = data_point[property] ?? 0;
        y *= multiply_y_by
        return {x: data_point["dt"] * 1000, y: y}
    })
}


const openweathermap_icons = {
    // clear sky
    "01d": {"climacon": "sun", "fontawesome": "sun"},
    "01n": {"climacon": "moon", "fontawesome": "moon"},
    // few clouds
    "02d": {"climacon": "sun cloud", "fontawesome": "cloud-sun"},
    "02n": {"climacon": "moon cloud", "fontawesome": "cloud-moon"},
    // scattered clouds
    "03d": {"climacon": "cloud", "fontawesome": "cloud"},
    "03n": {"climacon": "cloud", "fontawesome": "cloud"},
    // broken clouds
    "04d": {"climacon": "cloud", "fontawesome": "clouds"},
    "04n": {"climacon": "cloud", "fontawesome": "clouds"},
    // shower rain
    "09d": {"climacon": "drizzle", "fontawesome": "cloud-showers"},
    "09n": {"climacon": "drizzle", "fontawesome": "cloud-showers"},
    // rain
    "10d": {"climacon": "rain", "fontawesome": "cloud-showers-heavy"},
    "10n": {"climacon": "rain", "fontawesome": "cloud-showers-heavy"},
    // thunderstorm
    "11d": {"climacon": "lightning", "fontawesome": "cloud-bolt"},
    "11n": {"climacon": "lightning", "fontawesome": "cloud-bolt"},
    // snow
    "13d": {"climacon": "snowflake", "fontawesome": "snowflake"},
    "13n": {"climacon": "snowflake", "fontawesome": "snowflake"},
    // mist
    "50d": {"climacon": "fog", "fontawesome": "cloud-fog"},
    "50n": {"climacon": "fog", "fontawesome": "cloud-fog"},
}

function openweathermap_sum_precip_over_hour(hour) {
    return (hour["rain"] ? hour["rain"]["1h"] : 0) +
        (hour["snow"] ? hour["snow"]["1h"] : 0)
}

function parse_openweathermap(data) {
    return {
        "currently": {
            "summary": data["current"]["weather"][0]["description"],
            "temperature": data["current"]["temp"],
            "apparent_temperature": data["current"]["feels_like"],
            "humidity": data["current"]["humidity"],
            "cloud_cover": data["current"]["clouds"],
            "precipitation_intensity": openweathermap_sum_precip_over_hour(data["current"]),
            "icon": openweathermap_icons[data["current"]["weather"][0]["icon"]]
        },
        "hourly": {
            "summary": data["daily"][0]["weather"][0]["description"],
            "temperature": zip_openweathermap(data["hourly"], "temp"),
            "apparent_temperature": zip_openweathermap(data["hourly"], "feels_like"),
            "humidity": zip_openweathermap(data["hourly"], "humidity"),
            "cloud_cover": zip_openweathermap(data["hourly"], "clouds"),
            "precipitation_probability": zip_openweathermap(data["hourly"], "pop", 100),
            "precipitation_intensity": data["hourly"].map(hour => {
                return {x: hour["dt"] * 1000, y: openweathermap_sum_precip_over_hour(hour)}
            }),
        },
        "daily": {
            "summary": "",
            "high": data["daily"].map(data_point => {
                return {x: data_point["dt"] * 1000, y: data_point["temp"]["max"]}
            }),
            "apparent_high": data["daily"].map(data_point => {
                // ugh why
                return {x: data_point["dt"] * 1000, y: Math.max(...Object.values(data_point["feels_like"]))}
            }),
            "low": data["daily"].map(data_point => {
                return {x: data_point["dt"] * 1000, y: data_point["temp"]["min"]}
            }),
            "apparent_low": data["daily"].map(data_point => {
                return {x: data_point["dt"] * 1000, y: Math.min(...Object.values(data_point["feels_like"]))}
            }),
            "humidity": zip_openweathermap(data["daily"], "humidity"),
            "cloud_cover": zip_openweathermap(data["daily"], "clouds"),
            "precipitation_probability": zip_openweathermap(data["daily"], "pop", 100),
            "precipitation_intensity": zip_openweathermap(data["daily"], "rain"),
        },
        "alerts": (data["alerts"] ?? []).map(alert => {
            return {
                "severity": alert["severity"], // advisory, watch, warning
                "url": "",
                "title": alert["event"],
                "description": alert["description"],
                "expires": alert["end"],
            }
        }),
        "source": "openweathermap", // darksky,openweathermap,openmeteo, etc
    }
}


function parse_nws(data) {
    return {
        "currently": {
            "summary": "Lorem ipsum",
            "temperature": 0,
            "apparent_temperature": 0,
            "humidity": 0,
            "cloud_cover": 0,
            "precipitation": 0
        },
        "hourly": {
            "summary": "Lorem ipsum",
            "temperature": [{x: 0, y: 0}/*, ...*/],
            "apparent_temperature": [{x: 0, y: 0}/*, ...*/],
            "humidity": [{x: 0, y: 0}/*, ...*/],
            "cloud_cover": [{x: 0, y: 0}/*, ...*/],
            "precipitation": [{x: 0, y: 0}/*, ...*/],
        },
        "daily": {
            "summary": "Lorem ipsum",
            "high": [{x: 0, y: 0}/*, ...*/],
            "apparent_high": [{x: 0, y: 0}/*, ...*/],
            "low": [{x: 0, y: 0}/*, ...*/],
            "apparent_low": [{x: 0, y: 0}/*, ...*/],
            "feels_like": [{x: 0, y: 0}/*, ...*/],
            "humidity": [{x: 0, y: 0}/*, ...*/],
            "cloud_cover": [{x: 0, y: 0}/*, ...*/],
            "precipitation": [{x: 0, y: 0}/*, ...*/],
        },
        "alerts": [
            {
                "severity": "advisory", // advisory, watch, warning
                "url": "https://example.com",
                "title": "Lorem ipsum",
                "expires": 0,
            }//, ...
        ],
        "source": "nws", // darksky,openweathermap, etc
    }
}

function get_weather_from_latlong(lat, long, provider) {
    switch (provider) {
        case "openweathermap":
            return openweathermap_api_request(lat, long).then(parse_openweathermap)
        case "nws":
            return nws_api_request(lat, long).then(parse_nws)
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

