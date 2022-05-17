//TODO: make extra weather info nicer?

// initialize config to sensible defaults before it properly loads
let config_blur = 0;
let config_timeformat = "12";
let config_dateformat = "md";
let config_searchtags = "nature,architecture";
let config_refreshtime = 0;
let config_tempunit = "f";
let config_iconset = "climacons"

let promotional = false; // use the same BG for promotional purposes

let version = chrome.runtime.getManifest().version;

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
    if (config_timeformat === "12") {
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
    set_html_if_needed(qs(".clock"), time);

    // date
    let d = date.getDate();
    let mo = date.getMonth() + 1; // 0 indexed
    let y = date.getFullYear();
    let da;
    if (config_dateformat === "md") {
        da = `${mo}/${d}/${y}`;
    } else {
        da = `${d}/${mo}/${y}`;
    }
    set_html_if_needed(qs(".date"), da);
}

function epoch_to_date(epoch) {
    // convert UNIX epoch to js date object
    return new Date(0).setUTCSeconds(epoch);
}

function epoch_to_locale_hour_string(epoch) {
    // represents an epoch number as a "hour string"
    // for 12h time examples are 1 AM, 2 PM, etc.
    // for 24h time examples are 01:00, 13:00, etc.
    let d = epoch_to_date(epoch);
    let h = d.getHours(); // 0 - 23
    let time;
    if (config_timeformat === "12") {
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

function tunit(temp) {
    // converts temperature unit if needed
    if (config_tempunit === "c") {
        temp = ftoc(temp);
    }
    return Math.round(temp);
}

function sunit(speed) {
    // converts speed unit if needed
    if (config_tempunit === "c") {
        speed = speed * 1.609344;
    }
    return Math.round(speed);
}

function climacon(prop) {
    // converts DarkSky icon prop to HTML icon based on user settings
    if (config_iconset === "climacons") {
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

function devmode(callback) {
    // check if extension was loaded from disk/dev mode
    chrome.management.getSelf(function (result) {
        callback(result.installType === "development");
    });
}

function updateweather() {
    // update weather popover
    bootstrap.Popover.getOrCreateInstance(qs("#weatherpopover")).dispose();
    qs("#weatherpopover").setAttribute("data-bs-content", qs(".weatherdiv").innerHTML);
    bootstrap.Popover.getOrCreateInstance(qs("#weatherpopover"));
}

function weather(response) {
    // takes a JSON response from darksky, creates and updates the weather popover
    // for some god forsaken reason, i have to get lastweather before anything else or fontawesome breaks. yeah idk.
    chrome.storage.local.get(["lastweather"], function (resp) {
        console.debug(response);
        chrome.storage.local.set({
            "weather": response
        });
        const {currently, daily, hourly, minutely, alerts} = response;
        let temp = currently["temperature"];
        qs(".wdaily").innerHTML = "<i class=\"fas fa-calendar-week\"></i> " + daily["summary"];
        qs(".whourly").innerHTML = "<i class=\"fas fa-calendar-day\"></i> " + hourly["summary"];
        if (minutely) { // not all regions have minutely
            qs(".wminutely").innerHTML = "<i class=\"fas fa-clock\"></i> " + minutely["summary"];
        } else {
            qs(".wminutely").innerHTML = "<i class=\"fas fa-clock\"></i> " + currently["summary"];
        }
        qs(".whourlycontent").innerHTML = "";
        qs(".wdailycontent").innerHTML = "";
        qs(".walerts").innerHTML = "";

        // weatherpage * 7, 7 + weatherpage * 7
        let todaydate = new Date().getDate();
        let nextday = false;
        hourly.data.slice().forEach(function (hour, i) {
            let paginationtime = "";
            const {precipProbability, summary, icon, apparentTemperature, temperature, time} = hour;
            if (new Date(time * 1000).getDate() !== todaydate || nextday) {
                nextday = true;
                paginationtime = "<p class=\"pfix\">" + dayofepoch(time) + " " + epoch_to_locale_hour_string(time) + "</p>";
            }
            qs(".whourlycontent").insertAdjacentHTML('beforeend', `
        <div class="weatherblock popovertt" data-bs-content="test123">
            <span class="data">hour-${i}</span>
            <span class="data ttcontent">${paginationtime}<p class="pfix">${summary}</p><p class="pfix">Feels like ${tunit(apparentTemperature)}°</p></span>
            <h6 class="pfix">${epoch_to_locale_hour_string(time)} ${climacon(icon)}</h6>
            <p>${tunit(temperature)}°</p>
            <p class="rainp">${Math.round(precipProbability * 100)}%</p>
        </div>
        `);
        });
        daily.data.slice().forEach(function (day, i) {
            let accum = "";
            const {
                precipProbability,
                precipType,
                summary,
                icon,
                precipAccumulation,
                temperatureLow,
                temperatureHigh,
                time
            } = day;
            if (precipAccumulation) {
                accum = precipAccumulation;
                if (accum > 0.05) {
                    if (config_tempunit === "f") accum += "in";
                    else accum = (accum * 2.54).toPrecision(2) + "cm";
                    accum = `<p class="rainp pfix">${accum} of ${precipType}</p>`;
                } else {
                    accum = "";
                }
            }
            qs(".wdailycontent").insertAdjacentHTML('beforeend', `
        <div class="weatherblock popovertt">
            <span class="data">day-${i}</span>
            <span class="data ttcontent"><p class="pfix">${summary}</p>${accum}</span>
            <h6 class="pfix">${dayofepoch(time)} ${climacon(icon)}</h6>
            <p><span class="low">${tunit(temperatureLow)}°</span> <span class="high">${tunit(temperatureHigh)}°</span> </p>
            <p class="rainp">${Math.round(precipProbability * 100)}%</p>
        </div>
        `);
        });
        const {humidity, apparentTemperature: apparentTemperature1, windSpeed, uvIndex} = currently;
        qs(".wminutelycontent").innerHTML = `
    <h5 class="pfix"><i class="fas fa-thermometer-half"></i> Feels like: ${tunit(apparentTemperature1)}°</h5>
    <h5 class="pfix"><i class="fas fa-sun"></i> UV Index: ${Math.round(uvIndex)}</h5>
    <h5 class="pfix"><i class="fas fa-wind"></i> Wind Speed: ${sunit(windSpeed)} ${config_tempunit === "c" ? "km/h" : "mph"}</h5>
    <h5 class="pfix"><i class="fas fa-tint"></i> Humidity: ${Math.round(humidity * 100)}%</h5>
    `;

        if (alerts) {
            alerts.forEach(function (alert) {
                const {regions, uri, severity} = alert;
                let regionstring = "";
                regions.forEach(function (region) {
                    regionstring = regionstring.concat(`<p class="pfix">${region}</p>`);
                });
                qs(".walerts").append(`
        <h6 class="pfix">
            <a href="${uri}" class="text-danger">
                <span class="popovertt">
                    <i class="fas fa-exclamation-triangle"></i> WEATHER ${severity.toUpperCase()}. EXPIRES ${dayofepoch(alert.expires).toUpperCase()} ${epoch_to_locale_hour_string(alert.expires)}. 
                    <span class="data ttcontent"><div class="text-left"><p class="pfix">${alert.description.replace(/\*/g, "</p><p class='pfix' style=\"margin-top:3px;\">")}</p></div></span>
                </span>
            </a>
            <a href="${uri}" class="text-danger">
                <span class="popovertt">
                    AFFECTS ${regions.length} REGIONS
                    <span class="data ttcontent">${regionstring}</span>
                </span>
            </a>
        </h6>
        `);
            });
        }
        qs(".lastcached").innerHTML = "Weather last updated at " + new Date(resp["lastweather"] * 1000).toLocaleString();
        console.debug("Weather last updated at " + new Date(resp["lastweather"] * 1000).toLocaleString());
        // gotta do this after or its busted
        qs("#weatherpopover").addEventListener('shown.bs.popover', function () {
            bootstrap.Tooltip.getOrCreateInstance(qs("body"), {
                selector: '.popovertt',
                html: true,
                title: function () {
                    return this.querySelector(".ttcontent").innerHTML;
                },
                trigger: "hover",
                placement: "top",
                boundary: "window"
            });
        });
        qs("#weatherpopover").addEventListener("hidden.bs.popover", function () {
            [...document.querySelectorAll(".tooltip")].map(tt => {
                bootstrap.Tooltip.getOrCreateInstance(tt).hide();
            })
        });
        updateweather();
        let sincelastdownload = (new Date().getTime() / 1000) - resp["lastweather"];
        let timetowait = 2 * 60 * 60; // if weather hasnt been refreshed for 2 hours
        if (sincelastdownload > timetowait) { // if its been longer than 10 mins, get the weather again
            qs(".weather").innerHTML = "<i class=\"fas fa-exclamation-circle\"></i>"
            let weatherh3 = bootstrap.Tooltip.getOrCreateInstance(qs("#weatherh3"), {html: true});
            weatherh3.hide();
            qs("#weatherh3").setAttribute('data-bs-original-title', "Weather info is outdated.");
        } else {
            qs(".weather").innerHTML = `${tunit(temp)}°`;
            qs("#weatherimage").innerHTML = `${climacon(currently.icon)}`;
            let weatherh3 = bootstrap.Tooltip.getOrCreateInstance(qs("#weatherh3"), {html: true});
            weatherh3.hide();
            qs("#weatherh3").setAttribute('data-bs-original-title', currently["summary"]);
        }

        //("#weatherpopover").popover("hide");
        // enable tooltips everywhere
        let tooltipTriggerList = [].slice.call(document.querySelectorAll('.tt'))
        tooltipTriggerList.map(function (tooltipTriggerEl) {
            return bootstrap.Tooltip.getOrCreateInstance(tooltipTriggerEl, {html: true})
        })
    });

}

function regularinterval() {
    update_newtab_datetime();
    let now = new Date();
    let weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    let months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    let date = `<h4 style="margin:0;">${weekdays[now.getDay()]} ${months[now.getMonth()]} ${("0" + now.getDate()).slice(-2)} ${now.getFullYear()} ${now.toLocaleTimeString()}</h4>`;
    qs("#timepopover").setAttribute("data-bs-content", `<div id="tpop">${date}</div>`);
    set_html_if_needed(qs("#tpop"), date);
}

function sliderblur() {
    sblur(this.value);
    chstorage();
}

function tempunithandler() {
    if (this.id === "farradio") {
        config_tempunit = "f";
    } else {
        config_tempunit = "c";
    }
    console.debug("reloading weather div with cached info");
    chrome.storage.local.get(["weather"], function (resp) {
        weather(resp["weather"]);
    });
    chstorage();
}

function iconsethandler() {
    if (this.id === "cradio") {
        config_iconset = "climacons";
    } else {
        config_iconset = "fontawesome";
    }
    console.debug("reloading weather div with cached info");
    chrome.storage.local.get(["weather"], function (resp) {
        weather(resp["weather"]);
    });
    chstorage();
}

function timeformathandler() {
    if (this.id === "12radio") {
        config_timeformat = "12";
    } else {
        config_timeformat = "24";
    }
    console.debug("reloading weather div with cached info");
    chrome.storage.local.get(["weather"], function (resp) {
        weather(resp["weather"]);
    }); // i have to do this since the weather popup uses the time format
    chstorage();
}

function dateformathandler() {
    if (this.id === "mdradio") {
        config_dateformat = "md";
    } else {
        config_dateformat = "dm";
    }
    chstorage();
}

function searchtaghandler() {
    config_searchtags = this.value;
    chstorage();
}

function sblur(val) {
    sblurmain(val);
    chstorage();
}

function sblurmain(val) {
    if (val === 0) {
        qs(".bg").style["transform"] = "initial";
        qs(".bg").style["filter"] = "initial";
    } else {
        qs(".bg").style["transform"] = `scale(${1 + 0.1 * (val / 15)})`;
        qs(".bg").style["filter"] = `blur(${val}px)`;
    }
    qs("#blurval").innerHTML = `<i class="fas fa-image"></i> Background blur: ${val}px`;
    config_blur = val;
}

function refreshinphandler() {
    config_refreshtime = this.value;
    chstorage();
}

function chstorage() {
    chrome.storage.local.set({
        blurval: config_blur,
        tempunit: config_tempunit,
        timeformat: config_timeformat,
        dateformat: config_dateformat,
        searchtags: config_searchtags,
        refreshtime: config_refreshtime,
        iconset: config_iconset
    });
    qs("#savetext").innerHTML = "Saved.";

}

function backgroundhandler() {
    if (!promotional) {
        console.debug("changing BG...");
        follow_redirects(`https://source.unsplash.com/${window.screen.width}x${window.screen.height}/?${config_searchtags}`, function (response) {
            console.debug("redirect followed");
            preload_image(response, function () {
                qs(".bg").style["background-image"] = `url(${response})`;

            });

            //qs(".bg").style["background-image"] =  `url(${response})`;
            chrome.storage.local.set({
                bgimage: response,
                lastbgrefresh: new Date().getTime() / 1000
            });
            console.debug("BG changed");
        });
    }
}

function downloadbg() {
    chrome.storage.local.get(['bgimage'], function (response) {
        let url = response['bgimage'].split("?")[0];
        console.debug(url);
        window.location = url;
    });
}

function optionsinit() {


    chrome.storage.local.get(['blurval'], function (result) {
        if (result["blurval"] === undefined) {
            result["blurval"] = "0";
        }
        config_blur = result["blurval"];
        sblurmain(result["blurval"], false);
        qs("#blurslider").setAttribute("value", result["blurval"]);
        //blur handler
        let slider = document.getElementById('blurslider');
        slider.addEventListener('input', sliderblur);
    });
    //temperature unit handler

    chrome.storage.local.get(['tempunit', 'lastweather', 'iconset', 'weather'], function (result) {
        config_tempunit = result["tempunit"];
        if (config_tempunit === undefined) {
            config_tempunit = "f";
        }
        //weather routine
        if (config_tempunit === "f") {
            qs("#farradio").setAttribute("checked", "checked");
        } else {
            qs("#celradio").setAttribute("checked", "checked");
        }
        config_iconset = result['iconset'];
        if (config_iconset === undefined) {
            config_iconset = "climacons";
        }
        if (config_iconset === "climacons") {
            qs("#cradio").setAttribute("checked", "checked");
        } else {
            qs("#faradio").setAttribute("checked", "checked");
        }
        if (!result["lastweather"] || !result['weather']) { // most likely happens on first install
            weatherpos(weathercurrent, weather);
            chrome.storage.local.set({
                lastweather: new Date().getTime() / 1000
            });
        } else { // there is a date of the last time we got the weather
            let sincelastdownload = (new Date().getTime() / 1000) - result["lastweather"];
            let timetowait = 10 * 60; // only get weather every 10 mins
            if (navigator.onLine && sincelastdownload > timetowait) { // if its been longer than 10 mins, get the weather again
                weatherpos(weathercurrent, weather);
                console.debug("downloading new weather info");
                chrome.storage.local.set({
                    lastweather: new Date().getTime() / 1000
                });
            } else { // otherwise, use the saved info to possibly prevent the weather api limit
                weather(result["weather"]);
                console.debug("using cached weather info");
            }
        }
        document.getElementById('farradio').addEventListener('input', tempunithandler);
        document.getElementById('celradio').addEventListener('input', tempunithandler);
        document.getElementById('cradio').addEventListener('input', iconsethandler);
        document.getElementById('faradio').addEventListener('input', iconsethandler);

    });
    //config_timeformat handler

    chrome.storage.local.get(['config_timeformat'], function (result) {
        config_timeformat = result["timeformat"];
        if (config_timeformat === undefined) {
            config_timeformat = "12";
        }
        //weather routine
        if (config_timeformat === "12") {
            qs("#12radio").setAttribute("checked", "checked");
        } else {
            qs("#24radio").setAttribute("checked", "checked");
        }
        document.getElementById('12radio').addEventListener('input', timeformathandler);
        document.getElementById('24radio').addEventListener('input', timeformathandler);
    });
    //dateformat handler

    chrome.storage.local.get(['dateformat'], function (result) {
        config_dateformat = result["dateformat"];
        if (config_dateformat === undefined) {
            config_dateformat = "md";
        }
        //weather routine
        if (config_dateformat === "md") {
            qs("#mdradio").setAttribute("checked", "checked");
        } else {
            qs("#dmradio").setAttribute("checked", "checked");
        }
        document.getElementById('mdradio').addEventListener('input', dateformathandler);
        document.getElementById('dmradio').addEventListener('input', dateformathandler);
    });

    chrome.storage.local.get(['searchtags', "lastbgrefresh", "refreshtime"], function (result) {
        config_searchtags = result["searchtags"];
        if (config_searchtags === undefined) {
            config_searchtags = "nature,ocean,city,space";
        }
        config_refreshtime = result["refreshtime"];
        if (config_refreshtime === undefined) {
            config_refreshtime = 0;
        }
        qs("#bgrefresh").setAttribute("value", config_refreshtime);
        qs("#bgtags").setAttribute("value", config_searchtags);
        if (config_refreshtime !== 0) {
            let sincelastdownload = (new Date().getTime() / 1000) - result["lastbgrefresh"];
            let timetowait = config_refreshtime * 60;
            if (sincelastdownload > timetowait) {
                backgroundhandler();
            } else {
                console.debug(`been less than ${config_refreshtime} mins, using same BG`);
            }
        } else {
            backgroundhandler();
        }
        document.getElementById('bgtags').addEventListener('change', searchtaghandler);
        document.getElementById('bgrefresh').addEventListener('change', refreshinphandler);

    });
}

document.addEventListener("DOMContentLoaded", function () {
    //htmlinclude
    // what the hell is this?
    document.querySelectorAll(".htmlinclude").forEach(function (obj) {
        let include = obj.getAttribute("html-include");
        fetch(include)
            .then(function (response) {
                return response.text();
            })
            .then(function (body) {
                obj.innerHTML = body;
                console.debug(`included ${include}`)
            });

    });
    //imghandler
    if (promotional) {
        qs(".bg").style["background-image"] = `url(https://images.unsplash.com/photo-1440558929809-1412944a6225?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=1920&q=80)`;
    } else {
        chrome.storage.local.get(['bgimage', "lastbgrefresh"], function (result) {
            let bgimage = result["bgimage"];
            qs(".bg").style["background-image"] = `url(${bgimage})`;
        });
    }

    //popovers
    document.getElementById("bg-change").onclick = backgroundhandler;
    document.getElementById("bg-download").onclick = downloadbg;
    document.getElementById("save").onclick = chstorage;
    qs("#changelog-button").onclick = function () {
        new bootstrap.Modal(qs("#changelog"));
    };
    devmode(function (dev) {
        let version = chrome.runtime.getManifest().version;
        qs("#evergreenpopover").setAttribute("data-bs-content", `<h2 class="display-4"><img class="logoimg" alt="" src="icons/evergreen${dev ? "dev" : ""}128.png"/>Evergreen${dev ? " Dev" : ""}</span></h2><h4>New Tab for Chrome</h4><h4>Version ${version}</h4><h5>Created by <a href="https://reticivis.net/">Reticivis</a></h5>`);
        bootstrap.Popover.getOrCreateInstance(qs("#evergreenpopover"), {
            html: true,
            placement: "bottom",
            trigger: "focus"
        })
    });

    qs("#timepopover").setAttribute("data-bs-content", `<div id="tpop"></div>`);
    //calendar
    caleandar(document.getElementById('caltemp'));
    let caltemp = qs("#caltemp").innerHTML;
    qs("#datepopover").setAttribute("data-bs-content", `<div id="caltemp">${caltemp}</div>`);
    qs("#caltemp").remove();
    let popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'))
    popoverTriggerList.map(function (popoverTriggerEl) {
        return bootstrap.Popover.getOrCreateInstance(popoverTriggerEl)
    })

    let modalTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="modal"]'))
    modalTriggerList.map(function (modalTriggerEl) {
        return new bootstrap.Modal(modalTriggerEl)
    })
    bootstrap.Tooltip.getOrCreateInstance(qs('#weatherh3'), {html: true});
    //other stuff
    optionsinit(); //load shit from chrome (also weather)
    if (promotional) {
        regularinterval();
    } else {
        setInterval(regularinterval, 100);
    }

    qs('#menu').addEventListener('hidden.bs.modal', function () {
        qs("#savetext").innerHTML = "";
    });
    // FIRST INSTALL
    chrome.storage.local.get(['firstinstall'], function (result) {
        result = result["firstinstall"];
        if (result === undefined || result === true) {
            new bootstrap.Modal(qs("#welcome")).show()
        }
        chrome.storage.local.set({
            firstinstall: false
        });
    });
    // changelog showing
    chrome.storage.local.get(['version'], function (result) {
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

    console.debug("evergreen fully initiated");
});
