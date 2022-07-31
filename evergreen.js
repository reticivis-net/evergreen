// initialize config to sensible defaults before it properly loads
// TODO: make this a dict you fucking maniac 😭
let config = {
    blur: 0,
    timeformat: "12",
    dateformat: "md",
    searchtags: "nature,architecture",
    refreshtime: 0,
    tempunit: "f",
    iconset: "climacons"
}

let promotional = false; // use the same BG for promotional purposes

let version = chrome.runtime.getManifest().version;
let devmode = undefined;

let weather_info;
let weather_reverse_geocode_info;
let last_weather_get;

chrome.management.getSelf(function (result) {
    devmode = result.installType === "development";
});

const qs = document.querySelector.bind(document);

console.debug("Evergreen New Tab for chrome");

function set_html_if_needed(object, html) {
    // sets the innerHTML of an object if possible and different
    if (object && "innerHTML" in object && object.innerHTML !== html) {
        object.innerHTML = html;
    }
}

function preload_image(url, callback) {
    let img = new Image();
    img.setAttribute("crossorigin", "anonymous")
    img.src = url;
    img.onload = function () {
        callback()
    };
}


function follow_redirects(url, callback) {
    // finds where URL redirects to
    fetch(url, {method: 'HEAD'}).then(r => callback(r.url))
}

function update_newtab_datetime() {
    // updates the date and time at the top and top right of the newtab respectively
    let date = new Date();

    // time
    let h = date.getHours(); // 0 - 23
    let m = String(date.getMinutes()).padStart(2, '0'); // 0 - 59
    let s = String(date.getSeconds()).padStart(2, '0'); // 0 - 59
    let time;
    // i think i stole this code lol
    if (config["timeformat"] === "12") {
        let session = "AM";
        if (h === 0) {
            h = 12;
        } else if (h === 12) {
            session = "PM";
        } else if (h > 12) {
            h = h - 12;
            session = "PM";
        }
        time = `${h}:${m}:${s} ${session}`;
    } else {
        time = `${String(h).padStart(2, '0')}:${m}:${s}`;
    }
    set_html_if_needed(qs("#clock"), time);

    // date
    let d = date.getDate();
    let mo = date.getMonth() + 1; // 0 indexed
    let y = date.getFullYear();
    let da;
    if (config["dateformat"] === "md") {
        da = `${mo}/${d}/${y}`;
    } else {
        da = `${d}/${mo}/${y}`;
    }
    set_html_if_needed(qs("#date"), da);
}

function epoch_to_date(epoch) {
    // convert UNIX epoch to js date object
    return new Date(epoch / 1000);
}

function epoch_to_locale_hour_string(epoch) {
    // represents an epoch number as a "hour string"
    // for 12h time examples are 1 AM, 2 PM, etc.
    // for 24h time examples are 01:00, 13:00, etc.
    let d = epoch_to_date(epoch);
    let h = d.getHours(); // 0 - 23
    let time;
    if (config["timeformat"] === "12") {
        let session = "AM";
        if (h === 0) {
            h = 12;
        } else if (h === 12) {
            session = "PM";
        } else if (h > 12) {
            h = h - 12;
            session = "PM";
        }
        time = `${h} ${session}`;
    } else {
        time = `${String(h).padStart(2, '0')}:00`;
    }
    return time;
}

function dayofepoch(epoch) {
    // gets weekday of epoch
    const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    let d = epoch_to_date(epoch);
    return weekdays[d.getDay()]
}

function roundton(num, n) {
    if (num === 0) {
        return 0
    }
    return +(Math.round((num + Number.EPSILON) + "e+" + n) + "e-" + n);
}

function tunit(temp, round = false) {
    // converts temperature unit if needed
    if (config["tempunit"] === "c") {
        temp = f_to_c(temp);
    }
    return round ? Math.round(temp) : temp;
}

function sunit(speed) {
    // converts speed unit if needed
    if (config["tempunit"] === "c") {
        // meters per second
        speed = speed * 0.44704;
    }
    return speed;
}

function ssunit(size) {
    // converts size units if needed
    if (config["tempunit"] === "c") {
        // inch to mm
        size = roundton(size * 25.4, 5);
    }
    return size;
}

function stripzeropoint(val) {
    val = `${val}`
    if (val.startsWith("0.")) val = val.substring(1)
    return val
}

function climacon(prop) {
    // converts DarkSky icon prop to HTML icon based on user settings
    if (config["iconset"] === "climacons") {
        // conversion from darksky to climacon
        let climacons = {
            "clear-day": "sun",
            "clear-night": "moon",
            "rain": "rain",
            "snow": "snow",
            "sleet": "sleet",
            "wind": "wind",
            "cloudy": "cloud",
            "partly-cloudy-day": "cloud sun",
            "partly-cloudy-night": "cloud moon"
        };
        if (climacons[prop] !== undefined) {
            return `<span aria-hidden="true" class="climacon ${climacons[prop]}"></span>`;
        } else {
            // sensible default
            return `<span aria-hidden="true" class="climacon cloud"></span>`
        }
    } else {
        // conversions from darksky to fontawesome icons
        let climacons = {
            "clear-day": "sun",
            "clear-night": "moon",
            "rain": "cloud-rain",
            "snow": "snowflake",
            "sleet": "cloud-meatball",
            "wind": "wind",
            "cloudy": "cloud",
            "partly-cloudy-day": "cloud-sun",
            "partly-cloudy-night": "cloud-moon"
        };
        if (climacons[prop] !== undefined) {
            return `<i class="fas fa-${climacons[prop]}"></i>`
        } else {
            // sensible default
            return `<i class="fas fa-cloud"></i>`
        }
    }

}


function every_100ms() {
    // ran every 100ms
    update_newtab_datetime();
    // qs("#clockpopover").setAttribute("data-bs-content", `<div id="tpop">${clock_datetime()}</div>`);
    let tpop = qs("#tpop");
    if (tpop) {
        set_html_if_needed(tpop, clock_datetime());
    }

}

const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function clock_datetime() {
    const now = new Date();

    return `
        <div id="tpop">
            <h4 style="margin:0;">
                ${weekdays[now.getDay()]} ${months[now.getMonth()]} ${("0" + now.getDate()).slice(-2)} ${now.getFullYear()}
                ${now.toLocaleTimeString()}
            </h4>
        </div>
        `;
}

// called by settings menu
function settings_set_tempunit() {
    if (this.id === "farradio") {
        config["tempunit"] = "f";
    } else {
        config["tempunit"] = "c";
    }
    console.debug("reloading weather div with cached info");
    construct_weather_popover()
    save_settings();
}

function settings_set_iconset() {
    if (this.id === "cradio") {
        config["iconset"] = "climacons";
    } else {
        config["iconset"] = "fontawesome";
    }
    console.debug("reloading weather div with cached info");
    construct_weather_popover();

    save_settings();
}

function settings_set_timeformat() {
    if (this.id === "12radio") {
        config["timeformat"] = "12";
    } else {
        config["timeformat"] = "24";
    }
    console.debug("reloading weather div with cached info");

    construct_weather_popover();
    // i have to do this since the weather popup uses the time format
    save_settings();
}

function settings_set_dateformat() {
    if (this.id === "mdradio") {
        config["dateformat"] = "md";
    } else {
        config["dateformat"] = "dm";
    }
    save_settings();
}

function settings_set_searchtags() {
    config["searchtags"] = this.value;
    save_settings();
}

function settings_set_blur() {
    set_blur(this.value);
    save_settings();
}

function set_blur(val) {
    // sets blur
    if (val === 0) {
        qs("#bg").style["transform"] = "initial";
        qs("#bg").style["filter"] = "initial";
    } else {
        qs("#bg").style["transform"] = `scale(${1 + 0.1 * (val / 15)})`;
        qs("#bg").style["filter"] = `blur(${val}px)`;
    }
    qs("#blurval").innerHTML = `<i class="fas fa-image"></i> Background blur: ${val}px`;
    config["blur"] = val;
}

function settings_set_refreshtime() {
    config["refreshtime"] = this.value;
    save_settings();
}

function save_settings() {
    chrome.storage.local.set({
        blurval: config["blur"],
        tempunit: config["tempunit"],
        timeformat: config["timeformat"],
        dateformat: config["dateformat"],
        searchtags: config["searchtags"],
        refreshtime: config["refreshtime"],
        iconset: config["iconset"]
    });
    qs("#savetext").innerHTML = "Saved.";

}

function change_background() {
    if (!promotional) {
        console.debug("changing BG...");
        follow_redirects(`https://source.unsplash.com/${window.screen.width}x${window.screen.height}/?${config["searchtags"]}`, function (response) {
            preload_image(response, function () {
                qs("#bg").style["background-image"] = `url(${response})`;
            });
            chrome.storage.local.set({
                bgimage: response, lastbgrefresh: new Date().getTime() / 1000
            });
            console.debug("BG changed");
        });
    }
}

function settings_download_background() {
    chrome.storage.local.get(['bgimage'], response => {
        let url = response['bgimage'].split("?")[0];
        console.debug(url);
        window.location = url;
    });
}


function init_background_blur() {// background blur
    chrome.storage.local.get(['blurval'], result => {
        // sensible default
        if (result["blurval"] === undefined) {
            result["blurval"] = "0";
        }
        config["blur"] = result["blurval"];
        // set blur on load
        set_blur(result["blurval"], false);
        qs("#blurslider").setAttribute("value", result["blurval"]);
        // add listener to settings
        qs('#blurslider').addEventListener('input', settings_set_blur);
    });
}

function fetch_weather() {
    console.debug("downloading new weather info");
    let weatherprom = get_weather_at_current_pos()
    // let weatherprom = get_weather_from_latlong(39.7645187,-104.9951955)
    weatherprom.then(([weather_response, geocoderesponse]) => {
        console.log(geocoderesponse)
        chrome.storage.local.set({
            lastweather: new Date().getTime() / 1000, weather: weather_response, geocode: geocoderesponse
        });
        last_weather_get = new Date();
        weather_info = weather_response;
        weather_reverse_geocode_info = geocoderesponse;
        console.debug(weather_info)
        construct_weather_popover()
    });
    weatherprom.catch((reason) => {
        console.error("weather fetching failed due to ", reason)
        set_html_if_needed(qs("#weather"), "")
    })

}

function init_weather() {
    // temperature unit handler AND iconset AND weather
    chrome.storage.local.get(['tempunit', 'lastweather', 'iconset', 'weather', "geocode"], function (result) {
        // init temp unit settings options
        config["tempunit"] = result["tempunit"];
        if (config["tempunit"] === undefined) {
            config["tempunit"] = "f";
        }
        if (config["tempunit"] === "f") {
            qs("#farradio").setAttribute("checked", "checked");
        } else {
            qs("#celradio").setAttribute("checked", "checked");
        }
        qs('#farradio').addEventListener('input', settings_set_tempunit);
        qs('#celradio').addEventListener('input', settings_set_tempunit);

        // init icon set settings options
        config["iconset"] = result['iconset'];
        if (config["iconset"] === undefined) {
            config["iconset"] = "climacons";
        }
        if (config["iconset"] === "climacons") {
            qs("#cradio").setAttribute("checked", "checked");
        } else {
            qs("#faradio").setAttribute("checked", "checked");
        }
        qs('#cradio').addEventListener('input', settings_set_iconset);
        qs('#faradio').addEventListener('input', settings_set_iconset);

        // load weather
        if (!result["lastweather"] || !result['weather']) {
            // if no previous weather data, get weather
            fetch_weather()
        } else {
            // there is a date of the last time we got the weather, check if we can use cached data

            // seconds since last time we got the weather
            let sincelastdownload = (new Date().getTime() / 1000) - result["lastweather"];
            // only get weather every 10 mins
            let timetowait = 10 * 60;
            // if its been longer than 10 mins and we are online, get the weather again
            if (navigator.onLine && sincelastdownload > timetowait) {
                fetch_weather()
            } else {
                // we have fresh cached data that we can use for the weather info!
                weather_info = result["weather"]
                weather_reverse_geocode_info = result["geocode"]
                last_weather_get = new Date(result["lastweather"] * 1000)
                console.debug(weather_info)
                construct_weather_popover();
                console.debug("using cached weather info");
            }
        }
    });
}

function init_timeformat() {
    // initialize time format options
    chrome.storage.local.get(['config["timeformat"]'], function (result) {
        config["timeformat"] = result["timeformat"];
        if (config["timeformat"] === undefined) {
            config["timeformat"] = "12";
        }
        if (config["timeformat"] === "12") {
            document.getElementById("12radio").setAttribute("checked", "checked");
        } else {
            document.getElementById("24radio").setAttribute("checked", "checked");
        }
        document.getElementById('12radio').addEventListener('input', settings_set_timeformat);
        document.getElementById('24radio').addEventListener('input', settings_set_timeformat);
    });
}

function init_background(lastbgrefresh) {
    // set the actual background
    if (promotional) {
        qs("#bg").style["background-image"] = `url(https://images.unsplash.com/photo-1440558929809-1412944a6225?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=1920&q=80)`;
    } else {
        // set background to cached image (well the browser should have cached it lol)
        chrome.storage.local.get(['bgimage'], function (result) {
            let bgimage = result["bgimage"];
            if (bgimage) {
                qs("#bg").style["background-image"] = `url(${bgimage})`;
            }
        });
        // handle BG based on refreshtime
        if (config["refreshtime"] !== 0) {
            // config to not refresh everytime is set

            // check if it's been long enough to get a new bg
            let sincelastdownload = (new Date().getTime() / 1000) - lastbgrefresh;
            let timetowait = config["refreshtime"] * 60;

            if (sincelastdownload > timetowait) {
                change_background();
            } else {
                // no action needed since cached bg was set
                console.debug(`been less than ${config["refreshtime"]} mins, using same BG`);
            }
        } else {
            change_background();
        }
    }

}

function init_background_settings() {
    // initialize background settings
    chrome.storage.local.get(['searchtags', "lastbgrefresh", "refreshtime"], function (result) {
        // search tags options
        config["searchtags"] = result["searchtags"];
        if (config["searchtags"] === undefined) {
            config["searchtags"] = "nature,ocean,city,space";
        }
        qs("#bgrefresh").setAttribute("value", config["refreshtime"]);
        qs('#bgrefresh').addEventListener('change', settings_set_refreshtime);

        // refreshtime options
        config["refreshtime"] = result["refreshtime"];
        if (config["refreshtime"] === undefined) {
            config["refreshtime"] = 0;
        }
        qs("#bgtags").setAttribute("value", config["searchtags"]);
        qs('#bgtags').addEventListener('change', settings_set_searchtags);

        init_background(result["lastbgrefresh"])
    });
}

function init_dateformat() {
    // initialize date format options
    chrome.storage.local.get(['dateformat'], function (result) {
        config["dateformat"] = result["dateformat"];
        if (config["dateformat"] === undefined) {
            config["dateformat"] = "md";
        }
        if (config["dateformat"] === "md") {
            qs("#mdradio").setAttribute("checked", "checked");
        } else {
            qs("#dmradio").setAttribute("checked", "checked");
        }
        qs('#mdradio').addEventListener('input', settings_set_dateformat);
        qs('#dmradio').addEventListener('input', settings_set_dateformat);
    });
}

function initialize_settings_menu() {
    // initializes settings menu from saved config options and runs routines that require them (weather, background)

    // all functions are async calls to chrome.storage.get
    // only separate functions for organization
    init_background_blur()
    init_weather()
    init_timeformat()
    init_background_settings()
    init_dateformat()

    // remove "saved" text when closing settings
    qs('#settings_modal').addEventListener('hidden.bs.modal', () => {
        qs("#savetext").innerHTML = "";
    });
}

document.addEventListener("DOMContentLoaded", on_doc_load);

function show_changelog_if_needed() {
    chrome.storage.local.get(['version'], result => {
        result = result["version"];
        if (result === undefined) {
            result = version;
        }
        if (result !== version) {
            new bootstrap.Modal(qs("#changelog")).show()
        }
        chrome.storage.local.set({
            version: version
        });
    });
}

function show_welcome_if_needed() {
    // FIRST INSTALL
    chrome.storage.local.get(['firstinstall'], result => {
        result = result["firstinstall"];
        if (result === undefined || result === true) {
            new bootstrap.Modal(qs("#welcome")).show()
        }
        chrome.storage.local.set({
            firstinstall: false
        });
    });
}

function dates_same_day(d1, d2) {
    return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

function string_if_condition(cond, string) {
    if (cond) {
        return string
    } else {
        return ""
    }
}

function calendar_html() {
    const now = new Date();
    let calday1 = new Date();

    // debug
    // now.setDate(-4253)
    // calday1.setDate(-4253)

    // day 1 of month should be in first row
    calday1.setDate(1);
    // move back to first day of that week
    // yes setDate can take negatives and it rolls over to the previous month
    calday1.setDate(1 - calday1.getDay())

    let tbody = "";

    // for 6 weeks in cal
    for (let week = 0; week < 6; week++) {
        // break if entire week is greyed out (next month)
        let weeksun = new Date(calday1.valueOf())
        weeksun.setDate(calday1.getDate() + (week * 7));
        if (weeksun.getTime() > now.getTime() && now.getMonth() !== weeksun.getMonth()) {
            break
        }

        tbody += "<tr>"
        // for 7 days of week
        for (let day = 0; day < 7; day++) {
            // clone calday1
            let thisday = new Date(calday1.valueOf())
            // get the date in question based on the loop offset
            thisday.setDate(calday1.getDate() + ((week * 7) + day));
            // get simple info
            const today = dates_same_day(now, thisday);
            // yes theoretically years apart can be the same month but that shouldn't actually happen
            const othermonth = now.getMonth() !== thisday.getMonth();
            // othermonth and today cant both happen
            tbody += `
                <td ${string_if_condition(today, "class='today'")}${string_if_condition(othermonth, "class='text-muted'")}>
                    <div>${thisday.getDate()}</div>
                </td>`
        }
        tbody += "</tr>"
    }

    return `
        <table class="calendar">
            <thead>
            <tr>
                <th colspan="7" class="month">${months[now.getMonth()]} ${now.getFullYear()}</th>
            </tr>
            <tr>
                <th scope="col">Sun</th>
                <th scope="col">Mon</th>
                <th scope="col">Tue</th>
                <th scope="col">Wed</th>
                <th scope="col">Thu</th>
                <th scope="col">Fri</th>
                <th scope="col">Sat</th>
            </tr>
            </thead>
            <tbody>
                ${tbody}
            </tbody>
        </table>`;
}


function construct_weather_popover() {
    if (!(weather_info && last_weather_get && weather_reverse_geocode_info)) {
        // nothing we can do if there is no weather info
        // shouldn't happen but just in case
        console.warn("asked to construct weather popup without proper data", weather_info, last_weather_get, weather_reverse_geocode_info)
        return
    }
    const weatherpopover = qs("#weatherpopover")
    let existing_popover = bootstrap.Popover.getInstance(weatherpopover);
    if (existing_popover) {
        existing_popover.dispose()
    }

    // deconstruct the info into better objects
    const {currently, daily, hourly, minutely, alerts} = weather_info;

    const tempnow = currently["temperature"]
    const hightoday = Math.max(daily["data"][0]["temperatureHigh"], tempnow)
    const lowtoday = Math.min(daily["data"][0]["temperatureLow"], tempnow)

    //TODO: details on hover, make sure to respect newlines this time
    let alerttext = "";
    if (alerts) {
        alerttext += `<div class="d-grid gap-1 mt-3 h5" id="alerts">`;
        alerts.forEach(function (alert, i) {
            let classes = "";
            let icon = "";
            switch (alert["severity"]) {
                case "advisory":
                    classes = "text-info"
                    icon = '<i class="fa-solid fa-circle-info"></i>'
                    break
                case "watch":
                    classes = "text-warning"
                    icon = '<i class="fa-solid fa-circle-exclamation"></i>'
                    break
                case "warning":
                    classes = "text-danger fw-bolder h4"
                    icon = '<i class="fa-solid fa-triangle-exclamation"></i>'
                    break
            }
            alerttext += `<p class="${classes}"><a href="${alert["uri"]}">${icon} ${alert["title"]} until ${dayofepoch(alert["expires"])} ${epoch_to_locale_hour_string(alert["expires"])}</a></p>`
        });
        alerttext += `</div>`;
    }

    let weather_popover_content = `
<!-- TODO: i wanted to put this to the right of the text at the bottom but for whatever reason its mere existance expands the popover and causes weird glitches -->
        <div style="width: 100%; text-align: right">
            <a href="https://darksky.net/poweredby/" >
                <img src="darksky-poweredby.png" alt="Powered by Dark Sky" style="display:inline-block;height: 1rem;">
            </a>
        </div>
        <canvas id="weather_chart_daily" width="600" height="250"></canvas>
        <canvas id="weather_chart_hourly" width="600" height="250"></canvas>
        <h5 class="text-center"><i class="fa-solid fa-cloud-sun-rain"></i> Current Conditions</h5>
        <div class="row mb-2" style="align-items: stretch;">
            <div class="col-auto" style="color:${coloroftemp(lowtoday)}">
            ${tunit(lowtoday, true)}°
            </div>
            <div class="col">
                <div class="progress" style="height: 100%; position:relative">
                    <div class="progress-bar" 
                    role="progressbar" 
                    style="width: ${Math.max(((tempnow - lowtoday) / (hightoday - lowtoday)) * 100, 1)}%;
                    background: ${temps_to_css_gradient(lowtoday, tempnow)};
                    " 
                    aria-valuenow="${tunit(tempnow)}" 
                    aria-valuemin="${tunit(lowtoday)}" 
                    aria-valuemax="${tunit(hightoday)}">
                    </div>
                    <div class="progress-text-center"><span>${tunit(tempnow, true)}°</span></div>
                </div>
            </div>
            <div class="col-auto" style="color:${coloroftemp(hightoday)}">
            ${tunit(hightoday, true)}°
            </div>
        </div>
        <div class="row">
            <div class="col">
                <h6 class="text-center"><i class="fa-solid fa-droplet-percent"></i> Humidity</h6>
                <div class="progress" style=" position:relative">
                    <div class="progress-bar bg-info" 
                    role="progressbar" 
                    style="width: ${Math.max(currently["humidity"] * 100, 1)}%;" 
                    aria-valuenow="${Math.round(currently["humidity"] * 100)}" 
                    aria-valuemin="0" 
                    aria-valuemax="100">
                    </div>
                    <div class="progress-text-center"><span>${Math.round(currently["humidity"] * 100)}%</span></div>
                </div>
            </div>
            <div class="col">
                <h6 class="text-center"><i class="fa-solid fa-clouds-sun"></i> Cloud Cover</h6>
                <div class="progress" style=" position:relative">
                    <div class="progress-bar bg-light" 
                    role="progressbar" 
                    style="width: ${Math.max(currently["cloudCover"] * 100, 1)}%;" 
                    aria-valuenow="${Math.round(currently["cloudCover"] * 100)}" 
                    aria-valuemin="0" 
                    aria-valuemax="100">
                    </div>
                    <div class="progress-text-center"><span>${Math.round(currently["cloudCover"] * 100)}%</span></div>
                </div>
            </div>
            <div class="col">
                <h6 class="text-center"><i class="fa-solid fa-sun"></i> UV Index</h6>
                <div class="progress" style=" position:relative">
                    <div class="progress-bar" 
                    role="progressbar" 
                    style="width: ${Math.max(currently["uvIndex"] * 10, 1)}%;
                    background-color: var(--bs-purple)" 
                    aria-valuenow="${Math.round(currently["uvIndex"])}" 
                    aria-valuemin="0" 
                    aria-valuemax="${Math.max(10, currently["uvIndex"] * 10)}">
                    </div>
                    <div class="progress-text-center"><span>${currently["uvIndex"]}</span></div>
                </div>
            </div>
        </div>
        ${alerttext}
        <p class="text-muted mb-0 mt-2">
            Last fetched at ${Chart._adapters._date.prototype.format(last_weather_get, config["timeformat"] === "12" ? 'h:mm a LLL do' : "HH:mm LLL do")}
            for ${weather_reverse_geocode_info["locality"]}, ${weather_reverse_geocode_info["principalSubdivision"]}
        </p>
    `;

    // make the popover!
    bootstrap.Popover.getOrCreateInstance(qs("#weatherpopover"), {
        html: true, sanitize: false, placement: "top", // https://github.com/twbs/bootstrap/discussions/36562
        trigger: "click", content: weather_popover_content
    })

    // set the visible icon in the bottom left
    set_html_if_needed(qs("#weather"), `${tunit(currently["temperature"], true)}°`)
    set_html_if_needed(qs("#weatherimage"), climacon(currently["icon"]))
}


const CHART_COLORS = {
    red: 'rgb(255, 99, 132)',
    orange: 'rgb(255, 159, 64)',
    yellow: 'rgb(255, 205, 86)',
    green: 'rgb(75, 192, 192)',
    blue: 'rgb(54, 162, 235)',
    purple: 'rgb(153, 102, 255)',
    grey: 'rgb(201, 203, 207)',
    white: 'rgb(255, 255, 255)',
};

let weather_chart_daily;
let weather_chart_hourly;


// temperature in fahrenheit because easier for me
let tempcolors = [{temp: 0, color: CHART_COLORS.purple}, {temp: 32, color: CHART_COLORS.blue}, {
    temp: 60, color: CHART_COLORS.green
}, {temp: 70, color: 'rgb(75,192,122)'}, {temp: 80, color: CHART_COLORS.yellow}, {temp: 100, color: CHART_COLORS.red}]

function coloroftemp(temp) {
    let grad = chroma
        .scale(tempcolors.map(({temp, color}) => color))
        .domain(tempcolors.map(({temp, color}) => temp));
    return grad(temp)
}

function tempgradient(gradient) {
    const temps = tempcolors.map(({temp, color}) => temp)
    const min = Math.min(...temps)
    const max = Math.max(...temps)
    tempcolors.forEach(({temp, color}) => {
        gradient.addColorStop((temp - min) / (max - min), color)
    })
}

function temps_to_css_gradient(low, high) {
    let stops = []
    tempcolors.forEach(({temp, color}) => {
        if (low <= temp && temp <= high) {
            stops.push(`${color} ${100 * ((temp - low) / (high - low))}%`)
        }
    })
    stops.unshift(`${coloroftemp(low)} 0%`)
    stops.push(`${coloroftemp(high)} 100%`)
    return `linear-gradient(90deg,${stops.join(",")})`
}

function context_to_gradient(context) {
    if (!context.chart.chartArea) {
        // This case happens on initial chart load
        return;
    }

    const {bottom, top, height} = context.chart.chartArea;
    const value_at_bottom = context.chart.scales.temperature.getValueForPixel(bottom)
    const value_at_top = context.chart.scales.temperature.getValueForPixel(top)

    // map the pixels of the chart to the absolute temperature values
    const temps = tempcolors.map(({temp, color}) => temp)
    const min = Math.min(...temps)
    const max = Math.max(...temps)
    const true0 = tunit(min);
    const true1 = tunit(max);
    // canvas pixels start at 0,0 in top left and y increases as it goes down, values work opposite so its weird
    const ratio = -(height) / (value_at_top - value_at_bottom)
    const gradient_bottom = bottom - (ratio * (value_at_bottom - true0));
    const gradient_top = top - (ratio * (value_at_top - true1));
    // debugger
    // make the pure js gradient
    let gradient = context.chart.ctx.createLinearGradient(0, gradient_bottom, 0, gradient_top);
    // this is totally subjective
    // TODO: make this configurable
    tempgradient(gradient)
    return gradient
}

function findPos(obj) {
    var curleft = 0, curtop = 0;
    if (obj.offsetParent) {
        do {
            curleft += obj.offsetLeft;
            curtop += obj.offsetTop;
        } while (obj = obj.offsetParent);
        return {x: curleft, y: curtop};
    }
    return undefined;
}

function invtunit(temp) {
    if (config["tempunit"] === "c") {
        return c_to_f(temp)
    } else {
        return temp
    }
}

function initweatherchart() {
    let chart_daily = qs("#weather_chart_daily");
    let chart_hourly = qs("#weather_chart_hourly");
    if (!chart_daily || !chart_hourly) {
        console.debug("initweatherchart() called but chart not found.")
        return
    }

    const {currently, daily, hourly, minutely, alerts} = weather_info;
    let data = [];

    // https://www.chartjs.org/docs/latest/developers/api.html#setdatasetvisibility-datasetindex-visibility

    let hourly_chart_gradient, daily_chart_gradient;

    function gen_hourly_chart_gradient(context) {
        if (hourly_chart_gradient) {
            return hourly_chart_gradient
        } else {
            hourly_chart_gradient = context_to_gradient(context)
            return hourly_chart_gradient
        }
    }

    weather_chart_hourly = new Chart(chart_hourly.getContext('2d'), {
        type: 'line', data: {
            datasets: [{
                parsing: false,
                data: hourly["data"].map(hour => {
                    return {x: hour["time"] * 1000, y: tunit(hour["temperature"])}
                }), // data: [...Array.from({length: 100}, (x, i) => i).map(val => {
                //     return {x: val * 1000 * 60 * 60 * 24, y: tunit(val)}
                // }), {x: 1000 * 60 * 60 * 24 * 10000, y: tunit(100)}],
                label: "Temperature",
                borderColor: gen_hourly_chart_gradient,
                backgroundColor: gen_hourly_chart_gradient,
                yAxisID: 'temperature',
                cubicInterpolationMode: 'monotone',
                tooltip: {
                    callbacks: {
                        label: (context) => `${context.dataset.label}: ${roundton(context.parsed.y, 2)}°${config["tempunit"].toUpperCase()}`,
                        labelColor: function (context) {

                            const col = coloroftemp(invtunit(context.parsed.y))
                            return {
                                borderColor: col, backgroundColor: col,
                            }
                        },
                    }
                }
            },

                {
                    parsing: false,
                    data: hourly["data"].map(hour => {
                        return {x: hour["time"] * 1000, y: Math.round(hour["precipProbability"] * 100)}
                    }),
                    label: "Precip %",
                    borderColor: 'rgba(54, 162, 235, 0.5)',
                    backgroundColor: 'rgba(54, 162, 235, 0.5)',
                    pointBorderColor: 'rgba(0, 0, 0, 0)',
                    cubicInterpolationMode: 'monotone',
                    yAxisID: 'percent',
                    tooltip: {
                        callbacks: {
                            label: (context) => `${context.dataset.label}: ${context.parsed.y}%`
                        }
                    }
                    // borderDash: [5, 15],
                }, {
                    parsing: false,
                    data: hourly["data"].map(hour => {
                        return {x: hour["time"] * 1000, y: tunit(hour["apparentTemperature"])}
                    }),
                    label: "Feels Like",
                    borderColor: gen_hourly_chart_gradient,
                    backgroundColor: gen_hourly_chart_gradient,
                    cubicInterpolationMode: 'monotone',
                    yAxisID: 'temperature',
                    hidden: true,
                    tooltip: {
                        callbacks: {
                            label: (context) => `${context.dataset.label}: ${roundton(context.parsed.y, 2)}°${config["tempunit"].toUpperCase()}`,
                            labelColor: function (context) {
                                const col = coloroftemp(invtunit(context.parsed.y))
                                return {
                                    borderColor: col, backgroundColor: col,
                                }
                            },
                        }
                    }
                }, {
                    data: hourly["data"].map(hour => {
                        return {x: hour["time"] * 1000, y: hour["uvIndex"]}
                    }),
                    label: "UV Index",
                    borderColor: CHART_COLORS.purple,
                    backgroundColor: CHART_COLORS.purple,
                    cubicInterpolationMode: 'monotone',
                    hidden: true,
                    yAxisID: "uv"
                }, {
                    parsing: false,
                    data: hourly["data"].map(hour => {
                        return {x: hour["time"] * 1000, y: Math.round(hour["humidity"] * 100)}
                    }),
                    label: "Humidity %",
                    borderColor: CHART_COLORS.blue,
                    backgroundColor: CHART_COLORS.blue,
                    pointBorderColor: 'rgba(0, 0, 0, 0)',
                    cubicInterpolationMode: 'monotone',
                    yAxisID: 'percent',
                    tooltip: {
                        callbacks: {
                            label: (context) => `${context.dataset.label}: ${context.parsed.y}%`
                        }
                    },
                    hidden: true
                    // borderDash: [5, 15],
                }, {
                    parsing: false,
                    data: hourly["data"].map(hour => {
                        return {x: hour["time"] * 1000, y: Math.round(hour["cloudCover"] * 100)}
                    }),
                    label: "Cloud Cover %",
                    borderColor: CHART_COLORS.white,
                    backgroundColor: CHART_COLORS.white,
                    pointBorderColor: 'rgba(0, 0, 0, 0)',
                    cubicInterpolationMode: 'monotone',
                    yAxisID: 'percent',
                    tooltip: {
                        callbacks: {
                            label: (context) => `${context.dataset.label}: ${context.parsed.y}%`
                        }
                    },
                    hidden: true
                    // borderDash: [5, 15],
                },/* {
                    parsing: false,
                    data: hourly["data"].map(hour => {
                        return {x: hour["time"] * 1000, y: roundton(sunit(hour["windSpeed"]), 2)}
                    }),
                    label: "Wind Speed",
                    borderColor: CHART_COLORS.grey,
                    backgroundColor: CHART_COLORS.grey,
                    pointBorderColor: 'rgba(0, 0, 0, 0)',
                    cubicInterpolationMode: 'monotone',
                    yAxisID: 'speed',
                    tooltip: {
                        callbacks: {
                            label: (context) => `${context.dataset.label}: ${context.parsed.y} ${config["tempunit"] === "c" ? "m/s" : "mph"}`
                        }
                    },
                    hidden: true
                    // borderDash: [5, 15],
                },*/{
                    parsing: false,
                    data: hourly["data"].map(day => {
                        return {x: day["time"] * 1000, y: ssunit(day["precipIntensity"])}
                    }),
                    label: "Precip Intensity",
                    borderColor: "rgb(54,69,235)",
                    backgroundColor: "rgb(54,69,235)",
                    pointBorderColor: 'rgba(0, 0, 0, 0)',
                    cubicInterpolationMode: 'monotone',
                    yAxisID: 'precipintensity',
                    tooltip: {
                        callbacks: {
                            label: (context) => `${context.dataset.label}: ${context.parsed.y} ${config["tempunit"] === "c" ? "mm/h" : "in/h"}`
                        }
                    },
                    hidden: true
                    // borderDash: [5, 15],
                },]
        }, options: {
            scales: {
                x: {
                    type: 'time', time: {
                        displayFormats: {
                            hour: config["timeformat"] === "12" ? 'h a' : "HH:00", day: 'LLL do'
                        }, tooltipFormat: config["timeformat"] === "12" ? 'h a EEE LLL do' : "HH:00 EEE LLL do"
                    }, ticks: {
                        // autoSkip: false,
                        maxRotation: 0, major: {
                            enabled: true
                        }, font: function (context) {
                            if (context.tick && context.tick.major) {
                                return {
                                    weight: 'bold',
                                };
                            }
                        }
                    },
                }, temperature: {
                    ticks: {
                        callback: (value) => `${value}°${config["tempunit"].toUpperCase()}`
                    }, position: 'left', display: 'auto'
                }, percent: {
                    ticks: {
                        callback: (value) => `${value}%`
                    }, position: 'right', min: 0, max: 100, display: 'auto'
                }, uv: {
                    position: 'right', min: 0, suggestedMax: 10, display: 'auto'
                }, speed: {
                    position: 'right', min: 0, display: 'auto', suggestedMax: 7, ticks: {
                        callback: (value) => `${value} ${config["tempunit"] === "c" ? "m/s" : "mph"}`
                    }
                }, precipintensity: {
                    position: 'right', min: 0, display: 'auto', suggestedMin: 0, suggestedMax: ssunit(0.098), ticks: {
                        callback: (value) => `${stripzeropoint(value)}${config["tempunit"] === "c" ? "mm/h" : "in/h"}`, // without this it cuts off on the right side idfk
                        padding: 0
                    }
                }
            }, color: "#fff", interaction: {
                intersect: false, mode: 'index', axis: 'x'
            }, plugins: {
                legend: {
                    onClick: (event, legendItem, legend) => {
                        // reimplimenting default behavior that gets overridden
                        // toggle visibility of clicked item
                        legend.chart.data.datasets[legendItem.datasetIndex].hidden ^= true;
                        // update chart
                        legend.chart.update();
                        // if color is function (likely gradient)
                        if (typeof legend.chart.data.datasets[legendItem.datasetIndex].borderColor === "function") {
                            // reset gradient to recalculate from new scale
                            hourly_chart_gradient = undefined;
                            // update chart
                            legend.chart.update();
                        }
                    },

                }, title: {
                    display: true, text: "Weather Over 48 Hours", color: "#fff"
                }
            }, responsive: false
        }, plugins: [{
            id: "fixlegend", beforeDraw: function (chart) {
                chart.config.data.datasets.forEach((dataset, i) => {
                    if (dataset.yAxisID === "temperature") {
                        const hb = chart.legend.legendHitBoxes[i];
                        // console.debug(chart.legend.legendHitBoxes[i], dataset, chart);
                        let gradient = chart.ctx.createLinearGradient(hb.left, 0, hb.left + chart.legend.options.labels.boxWidth, 0);
                        tempgradient(gradient);
                        chart.legend.legendItems[i].fillStyle = gradient;
                        chart.legend.legendItems[i].strokeStyle = gradient;
                    }
                });
            }
        }]
    });

    function gen_daily_chart_gradient(context) {
        if (daily_chart_gradient) {
            return daily_chart_gradient
        } else {
            daily_chart_gradient = context_to_gradient(context)
            return hourly_chart_gradient
        }
    }

    weather_chart_daily = new Chart(chart_daily.getContext('2d'), {
        type: 'line', data: {
            datasets: [{
                parsing: false,
                data: daily["data"].map(day => {
                    return {x: day["time"] * 1000, y: tunit(day["temperatureHigh"])}
                }),
                label: "High",
                backgroundColor: CHART_COLORS.red,
                pointBorderColor: CHART_COLORS.red,
                borderColor: gen_daily_chart_gradient,
                yAxisID: 'temperature',
                cubicInterpolationMode: 'monotone',
                tooltip: {
                    callbacks: {
                        label: (context) => `${context.dataset.label}: ${roundton(context.parsed.y, 2)}°${config["tempunit"].toUpperCase()}`,
                        labelColor: function (context) {
                            return {
                                borderColor: CHART_COLORS.red, backgroundColor: coloroftemp(invtunit(context.parsed.y)),
                            }
                        },
                    },

                }
            }, {
                parsing: false,
                data: daily["data"].map(day => {
                    return {x: day["time"] * 1000, y: tunit(day["apparentTemperatureHigh"])}
                }),
                label: "High Feels Like",
                backgroundColor: CHART_COLORS.red,
                pointBorderColor: CHART_COLORS.red,
                borderColor: gen_daily_chart_gradient,
                yAxisID: 'temperature',
                cubicInterpolationMode: 'monotone',
                hidden: true,
                tooltip: {
                    callbacks: {
                        label: (context) => `${context.dataset.label}: ${roundton(context.parsed.y, 2)}°${config["tempunit"].toUpperCase()}`,
                        labelColor: function (context) {
                            return {
                                borderColor: CHART_COLORS.red, backgroundColor: coloroftemp(invtunit(context.parsed.y)),
                            }
                        },
                    },

                }
            }, {
                parsing: false,
                data: daily["data"].map(day => {
                    return {x: day["time"] * 1000, y: tunit(day["temperatureLow"])}
                }),
                label: "Low",
                backgroundColor: CHART_COLORS.blue,
                pointBorderColor: CHART_COLORS.blue,
                borderColor: gen_daily_chart_gradient,
                yAxisID: 'temperature',
                cubicInterpolationMode: 'monotone',
                tooltip: {
                    callbacks: {
                        label: (context) => `${context.dataset.label}: ${roundton(context.parsed.y, 2)}°${config["tempunit"].toUpperCase()}`,
                        labelColor: function (context) {
                            return {
                                borderColor: CHART_COLORS.blue,
                                backgroundColor: coloroftemp(invtunit(context.parsed.y)),
                            }
                        },
                    }
                }
            }, {
                parsing: false,
                data: daily["data"].map(day => {
                    return {x: day["time"] * 1000, y: tunit(day["apparentTemperatureLow"])}
                }),
                label: "Low Feels Like",
                backgroundColor: CHART_COLORS.blue,
                pointBorderColor: CHART_COLORS.blue,
                borderColor: gen_daily_chart_gradient,
                yAxisID: 'temperature',
                cubicInterpolationMode: 'monotone',
                hidden: true,
                tooltip: {
                    callbacks: {
                        label: (context) => `${context.dataset.label}: ${roundton(context.parsed.y, 2)}°${config["tempunit"].toUpperCase()}`,
                        labelColor: function (context) {
                            return {
                                borderColor: CHART_COLORS.blue,
                                backgroundColor: coloroftemp(invtunit(context.parsed.y)),
                            }
                        },
                    }
                }
            }, {
                parsing: false,
                data: daily["data"].map(day => {
                    return {x: day["time"] * 1000, y: Math.round(day["precipProbability"] * 100)}
                }),
                label: "Precip %",
                borderColor: 'rgba(54, 162, 235, 0.5)',
                backgroundColor: 'rgba(54, 162, 235, 0.5)',
                pointBorderColor: 'rgba(0, 0, 0, 0)',
                cubicInterpolationMode: 'monotone',
                yAxisID: 'percent',
                tooltip: {
                    callbacks: {
                        label: (context) => `${context.dataset.label}: ${context.parsed.y}%`
                    }
                }
                // borderDash: [5, 15],
            }, {
                data: daily["data"].map(hour => {
                    return {x: hour["time"] * 1000, y: hour["uvIndex"]}
                }),
                label: "UV Index",
                borderColor: CHART_COLORS.purple,
                backgroundColor: CHART_COLORS.purple,
                cubicInterpolationMode: 'monotone',
                hidden: true,
                yAxisID: "uv"
            }, {
                parsing: false,
                data: daily["data"].map(hour => {
                    return {x: hour["time"] * 1000, y: Math.round(hour["humidity"] * 100)}
                }),
                label: "Humidity %",
                borderColor: CHART_COLORS.blue,
                backgroundColor: CHART_COLORS.blue,
                pointBorderColor: 'rgba(0, 0, 0, 0)',
                cubicInterpolationMode: 'monotone',
                yAxisID: 'percent',
                tooltip: {
                    callbacks: {
                        label: (context) => `${context.dataset.label}: ${context.parsed.y}%`
                    }
                },
                hidden: true
                // borderDash: [5, 15],
            }, {
                parsing: false,
                data: daily["data"].map(hour => {
                    return {x: hour["time"] * 1000, y: Math.round(hour["cloudCover"] * 100)}
                }),
                label: "Cloud Cover %",
                borderColor: CHART_COLORS.white,
                backgroundColor: CHART_COLORS.white,
                pointBorderColor: 'rgba(0, 0, 0, 0)',
                cubicInterpolationMode: 'monotone',
                yAxisID: 'percent',
                tooltip: {
                    callbacks: {
                        label: (context) => `${context.dataset.label}: ${context.parsed.y}%`
                    }
                },
                hidden: true
                // borderDash: [5, 15],
            }, /*{
                parsing: false,
                data: daily["data"].map(hour => {
                    return {x: hour["time"] * 1000, y: roundton(sunit(hour["windSpeed"]), 2)}
                }),
                label: "Wind Speed",
                borderColor: CHART_COLORS.grey,
                backgroundColor: CHART_COLORS.grey,
                pointBorderColor: 'rgba(0, 0, 0, 0)',
                cubicInterpolationMode: 'monotone',
                yAxisID: 'speed',
                tooltip: {
                    callbacks: {
                        label: (context) => `${context.dataset.label}: ${context.parsed.y} ${config["tempunit"] === "c" ? "m/s" : "mph"}`
                    }
                },
                hidden: true
                // borderDash: [5, 15],
            },*/ {
                parsing: false,
                data: daily["data"].map(day => {
                    return {x: day["time"] * 1000, y: ssunit(day["precipIntensity"])}
                }),
                label: "Precip Intensity",
                borderColor: "rgb(54,69,235)",
                backgroundColor: "rgb(54,69,235)",
                pointBorderColor: 'rgba(0, 0, 0, 0)',
                cubicInterpolationMode: 'monotone',
                yAxisID: 'precipintensity',
                tooltip: {
                    callbacks: {
                        label: (context) => `${context.dataset.label}: ${context.parsed.y} ${config["tempunit"] === "c" ? "mm/h" : "in/h"}`
                    }
                },
                hidden: true
                // borderDash: [5, 15],
            },]
        }, options: {
            scales: {
                x: {
                    type: 'time', time: {
                        displayFormats: {
                            hour: config["timeformat"] === "12" ? 'EEE h a' : "EEE HH:00", day: 'LLL do'
                        }, tooltipFormat: "EEE LLL do uuuu"
                    }, ticks: {
                        maxRotation: 0,
                    }
                }, temperature: {
                    ticks: {
                        callback: value => `${value}°${config["tempunit"].toUpperCase()}`
                    }, display: 'auto', position: 'left'
                }, percent: {
                    ticks: {
                        callback: (value) => `${value}%`
                    }, position: 'right', min: 0, max: 100, display: 'auto'
                }, uv: {
                    position: 'right', min: 0, suggestedMax: 10, display: 'auto'
                }, speed: {
                    position: 'right', min: 0, display: 'auto', suggestedMax: 7, ticks: {
                        callback: (value) => `${value} ${config["tempunit"] === "c" ? "m/s" : "mph"}`
                    }
                }, precipintensity: {
                    position: 'right', min: 0, display: 'auto', suggestedMax: ssunit(0.098), ticks: {
                        callback: (value) => `${stripzeropoint(value)}${config["tempunit"] === "c" ? "mm/h" : "in/h"}`
                    }, padding: 0
                }
            }, color: "#fff", interaction: {
                intersect: false, mode: 'index', axis: 'x'
            }, plugins: {
                title: {
                    display: true, text: "Weather This Week", color: "#fff"
                }, legend: {
                    onClick: (event, legendItem, legend) => {
                        // reimplimenting default behavior that gets overridden
                        // toggle visibility of clicked item
                        legend.chart.data.datasets[legendItem.datasetIndex].hidden ^= true;
                        // update chart
                        legend.chart.update();
                        // if color is function (likely gradient)
                        if (typeof legend.chart.data.datasets[legendItem.datasetIndex].borderColor === "function") {
                            // reset gradient to recalculate from new scale
                            daily_chart_gradient = undefined;
                            // update chart
                            legend.chart.update();
                        }
                    }
                }
            }, responsive: false
        }, plugins: [{
            id: "fixlegend", beforeDraw: function (chart) {
                chart.config.data.datasets.forEach((dataset, i) => {
                    if (dataset.yAxisID === "temperature") {
                        const hb = chart.legend.legendHitBoxes[i];
                        let gradient = chart.ctx.createLinearGradient(hb.left, 0, hb.left + chart.legend.options.labels.boxWidth, 0);
                        tempgradient(gradient);
                        chart.legend.legendItems[i].strokeStyle = dataset.backgroundColor;
                        chart.legend.legendItems[i].fillStyle = gradient;
                    }
                });

            }
        }]
    });
    // console.debug(weather_chart_hourly, weather_chart_daily)
}

function initialize_popovers_and_modals() {
    // top left ("Evergreen")
    bootstrap.Popover.getOrCreateInstance(qs("#evergreenpopover"), {
        html: true, placement: "bottom", trigger: "focus", content: `
            <h2 class="display-4">
                <img class="logoimg" alt="" src="icons/evergreen${devmode ? "dev" : ""}128.png"/>
                Evergreen${devmode ? " Dev" : ""}
            </h2>
            <h4>New Tab for Chrome</h4>
            <h4>Version ${version}</h4>
            <h5>Created by <a href="https://reticivis.net/">Reticivis</a></h5>`
    })

    // top middle (clock)
    bootstrap.Popover.getOrCreateInstance(qs("#clockpopover"), {
        html: true, placement: "bottom", trigger: "focus", content: clock_datetime
    })

    // top right (calendar)
    bootstrap.Popover.getOrCreateInstance(qs("#datepopover"), {
        html: true, sanitize: false,  // why aren't tables in the default allow list
        placement: "bottom", trigger: "focus", content: calendar_html
    })

    // bottom left (weather) is handled in construct_weather_popover() since it needs to wait for weather settings & data

    // init js chart on show
    qs("#weatherpopover").addEventListener('inserted.bs.popover', initweatherchart)
    // destroy js chart element on hide
    qs("#weatherpopover").addEventListener('hidden.bs.popover', () => {
        if (weather_chart_daily) {
            weather_chart_daily.destroy()
            weather_chart_daily = undefined;
        }
        if (weather_chart_hourly) {
            weather_chart_hourly.destroy()
            weather_chart_hourly = undefined;
        }
    })

    // bottom middle (search) requires no popoverweather_chart

    // bottom right (menu)
    bootstrap.Modal.getOrCreateInstance(qs("#menu-button"), {
        // redundant properties actually specified in HTML, only here for clarity
        target: "#settings_modal", toggle: "modal"
    })
}

function on_doc_load() {
    //popovers
    qs("#bg-change").onclick = change_background;
    qs("#bg-download").onclick = settings_download_background;
    qs("#save").onclick = save_settings;
    qs("#changelog-button").onclick = function () {
        bootstrap.Modal.getOrCreateInstance(qs("#changelog")).show();
    };

    // [...document.querySelectorAll('[data-bs-toggle="popover"]')].map(popoverTriggerEl => bootstrap.Popover.getOrCreateInstance(popoverTriggerEl));
    // [...document.querySelectorAll('[data-bs-toggle="modal"]')].map(modalTriggerEl => new bootstrap.Modal(modalTriggerEl))

    initialize_popovers_and_modals();

    //other stuff
    initialize_settings_menu(); //load shit from chrome (also weather)

    if (promotional) {
        every_100ms();
    } else {
        setInterval(every_100ms, 100);
    }

    show_welcome_if_needed()
    show_changelog_if_needed()

    console.debug("evergreen fully initiated");
}
