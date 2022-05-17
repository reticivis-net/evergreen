//TODO: make extra weather info nicer?

let blur = 0;

let timeformat = "12";
let dateformat = "md";
let searchtags = "nature,architecture";
let refreshtime = 0;

let promotional = false; // use the same BG for promotional purposes
let development = true; // enables debug prints

let version = chrome.runtime.getManifest().version;

const qs = document.querySelector.bind(document);

console.debug("Evergreen New Tab for chrome");

function sethtmlifneeded(object, html) {
    if (object && "innerHTML" in object && object.innerHTML !== html) {
        object.innerHTML = html;
    }
}

function round(value, decimals) {
    return Number(`${Math.round(`${value}e${decimals}`)}e-${decimals}`);
}

function preloadImage(url, callback) {
    let img = new Image();
    img.setAttribute("crossorigin", "anonymous")
    img.src = url;
    img.onload = function () {
        callback()
    };
}

/*
function followredirects(url, callback) {
    let theUrl = `https://reticivis.net/follow-redirect.php?url=${encodeURIComponent(url)}`;
    httpGetAsync(theUrl, callback);
}*/
function followredirects(url, callback) {
    let xhr = new XMLHttpRequest();
    xhr.onload = function () {
        callback(this.responseURL); //cant fucking believe i was using a web server to do this for like a year
    }
    xhr.open('HEAD', url, true);
    xhr.send();
}

function datetime() {
    let date = new Date();
    let h = date.getHours(); // 0 - 23
    let m = date.getMinutes(); // 0 - 59
    let s = date.getSeconds(); // 0 - 59
    let time;
    // i think i stole this code lol
    if (timeformat === "12") {
        let session = "AM";
        if (h === 0) {
            h = 12;
        }
        if (h === 12) {
            session = "PM";
        }
        if (h > 12) {
            h = h - 12;
            session = "PM";
        }
        m = (m < 10) ? "0" + m : m;
        s = (s < 10) ? "0" + s : s;
        time = h + ":" + m + ":" + s + " " + session;

    } else {
        h = (h < 10) ? "0" + h : h;
        m = (m < 10) ? "0" + m : m;
        s = (s < 10) ? "0" + s : s;
        time = h + ":" + m + ":" + s;
    }

    // h = (h < 10) ? "0" + h : h;

    sethtmlifneeded(qs(".clock"), time);
    let d = date.getDate();
    let mo = date.getMonth() + 1;
    let y = date.getFullYear();
    let da;
    if (dateformat === "md") {
        da = `${mo}/${d}/${y}`;
    } else {
        da = `${d}/${mo}/${y}`;
    }
    sethtmlifneeded(qs(".date"), da);
}

function localeHourString(epoch) {
    let d = new Date(0);
    d.setUTCSeconds(epoch);
    let h = d.getHours(); // 0 - 23
    let time;
    if (timeformat === "12") {
        let session = "AM";
        if (h === 0) {
            h = 12;
        }
        if (h === 12) {
            session = "PM";
        }
        if (h > 12) {
            h = h - 12;
            session = "PM";
        }

        time = h + " " + session;

    } else {
        h = (h < 10) ? "0" + h : h;

        time = h + ":00";
    }
    return time;
}

function dayofepoch(epoch) {
    let weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    let d = new Date(0);
    d.setUTCSeconds(epoch);
    return weekdays[d.getDay()]
}

function tunit(temp) { //for general use to have one function for every temperature
    if (tempunit === "c") {
        temp = ftoc(temp);
    }
    return Math.round(temp);
}

function sunit(speed) { // cleaner to define it here
    if (tempunit === "c") {
        speed = speed * 1.609344;
    }
    return Math.round(speed);
}

function climacon(prop) {
    if (iconset === "climacons") {
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
        if (climacons[prop] !== undefined) return `<span aria-hidden="true" class="climacon ${climacons[prop]}"></span>`;
        else return `<span aria-hidden="true" class="climacon cloud"></span>`;
    } else {
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
        if (climacons[prop] !== undefined) return `<i class="fas fa-${climacons[prop]}"></i>`;
        else return `<i class="fas fa-cloud"></i>`;
    }

}

function devmode(callback) {
    chrome.management.getSelf(function (result) {
        callback(result.installType === "development");
    });
}

function updateweather() {
    bootstrap.Popover.getOrCreateInstance(qs("#weatherpopover")).dispose();
    qs("#weatherpopover").setAttribute("data-bs-content", qs(".weatherdiv").innerHTML);
    bootstrap.Popover.getOrCreateInstance(qs("#weatherpopover"));
}

function weather(response, offline = false) {
    //for some god forsaken reason, i have to get lastweather before anything else or fontawesome breaks. yeah idk.
    chrome.storage.local.get(["lastweather"], function (resp) {

        console.debug(response);
        chrome.storage.local.set({
            "weather": response
        });
        let temp = response.currently.temperature;
        qs(".wdaily").innerHTML = "<i class=\"fas fa-calendar-week\"></i> " + response.daily.summary;
        qs(".whourly").innerHTML = "<i class=\"fas fa-calendar-day\"></i> " + response.hourly.summary;
        if (response.minutely) { // not all regions have minutely
            qs(".wminutely").innerHTML = "<i class=\"fas fa-clock\"></i> " + response.minutely.summary;
        } else {
            qs(".wminutely").innerHTML = "<i class=\"fas fa-clock\"></i> " + response.currently.summary;
        }
        qs(".whourlycontent").innerHTML = "";
        qs(".wdailycontent").innerHTML = "";
        qs(".walerts").innerHTML = "";

        // weatherpage * 7, 7 + weatherpage * 7
        let todaydate = new Date().getDate();
        let nextday = false;
        response.hourly.data.slice().forEach(function (hour, i) {
            let paginationtime = "";
            if (new Date(hour.time * 1000).getDate() !== todaydate || nextday) {
                nextday = true;
                paginationtime = "<p class=\"pfix\">" + dayofepoch(hour.time) + " " + localeHourString(hour.time) + "</p>";
            }
            qs(".whourlycontent").insertAdjacentHTML('beforeend', `
        <div class="weatherblock popovertt" data-bs-content="test123">
            <span class="data">hour-${i}</span>
            <span class="data ttcontent">${paginationtime}<p class="pfix">${hour.summary}</p><p class="pfix">Feels like ${tunit(hour.apparentTemperature)}°</p></span>
            <h6 class="pfix">${localeHourString(hour.time)} ${climacon(hour.icon)}</h6>
            <p>${tunit(hour.temperature)}°</p>
            <p class="rainp">${Math.round(hour.precipProbability * 100)}%</p>
        </div>
        `);
        });
        response.daily.data.slice().forEach(function (day, i) {
            let accum = "";
            if (day.precipAccumulation) {
                accum = day.precipAccumulation;
                if (accum > 0.05) {
                    if (tempunit === "f") accum += "in";
                    else accum = round(accum * 2.54, 2) + "cm";
                    accum = `<p class="rainp pfix">${accum} of ${day.precipType}</p>`;
                } else {
                    accum = "";
                }
            }
            qs(".wdailycontent").insertAdjacentHTML('beforeend', `
        <div class="weatherblock popovertt">
            <span class="data">day-${i}</span>
            <span class="data ttcontent"><p class="pfix">${day.summary}</p>${accum}</span>
            <h6 class="pfix">${dayofepoch(day.time)} ${climacon(day.icon)}</h6>
            <p><span class="low">${tunit(day.temperatureLow)}°</span> <span class="high">${tunit(day.temperatureHigh)}°</span> </p>
            <p class="rainp">${Math.round(day.precipProbability * 100)}%</p>
        </div>
        `);
        });
        let cur = response.currently;
        qs(".wminutelycontent").innerHTML = `
    <h5 class="pfix"><i class="fas fa-thermometer-half"></i> Feels like: ${tunit(cur.apparentTemperature)}°</h5>
    <h5 class="pfix"><i class="fas fa-sun"></i> UV Index: ${Math.round(cur.uvIndex)}</h5>
    <h5 class="pfix"><i class="fas fa-wind"></i> Wind Speed: ${sunit(cur.windSpeed)} ${tempunit === "c" ? "km/h" : "mph"}</h5>
    <h5 class="pfix"><i class="fas fa-tint"></i> Humidity: ${Math.round(cur.humidity * 100)}%</h5>
    `;

        if (response.alerts) {
            response.alerts.forEach(function (alert) {
                let regionstring = "";
                alert.regions.forEach(function (region) {
                    regionstring = regionstring.concat(`<p class="pfix">${region}</p>`);
                });
                qs(".walerts").append(`
        <h6 class="pfix">
            <a href="${alert.uri}" class="text-danger">
                <span class="popovertt">
                    <i class="fas fa-exclamation-triangle"></i> WEATHER ${alert.severity.toUpperCase()}. EXPIRES ${dayofepoch(alert.expires).toUpperCase()} ${localeHourString(alert.expires)}. 
                    <span class="data ttcontent"><div class="text-left"><p class="pfix">${alert.description.replace(/\*/g, "</p><p class='pfix' style=\"margin-top:3px;\">")}</p></div></span>
                </span>
            </a>
            <a href="${alert.uri}" class="text-danger">
                <span class="popovertt">
                    AFFECTS ${alert.regions.length} REGIONS
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
            qs("#weatherimage").innerHTML = `${climacon(response.currently.icon)}`;
            let weatherh3 = bootstrap.Tooltip.getOrCreateInstance(qs("#weatherh3"), {html: true});
            weatherh3.hide();
            qs("#weatherh3").setAttribute('data-bs-original-title', response.currently.summary);
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
    datetime();
    let now = new Date();
    let weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    let months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    let date = `<h4 style="margin:0;">${weekdays[now.getDay()]} ${months[now.getMonth()]} ${("0" + now.getDate()).slice(-2)} ${now.getFullYear()} ${now.toLocaleTimeString()}</h4>`;
    qs("#timepopover").setAttribute("data-bs-content", `<div id="tpop">${date}</div>`);
    sethtmlifneeded(qs("#tpop"), date);
}

function sliderblur() {
    sblur(this.value);
    chstorage();
}

function tempunithandler() {
    if (this.id === "farradio") {
        tempunit = "f";
    } else {
        tempunit = "c";
    }
    console.debug("reloading weather div with cached info");
    chrome.storage.local.get(["weather"], function (resp) {
        weather(resp["weather"]);
    });
    chstorage();
}

function iconsethandler() {
    if (this.id === "cradio") {
        iconset = "climacons";
    } else {
        iconset = "fontawesome";
    }
    console.debug("reloading weather div with cached info");
    chrome.storage.local.get(["weather"], function (resp) {
        weather(resp["weather"]);
    });
    chstorage();
}

function timeformathandler() {
    if (this.id === "12radio") {
        timeformat = "12";
    } else {
        timeformat = "24";
    }
    console.debug("reloading weather div with cached info");
    chrome.storage.local.get(["weather"], function (resp) {
        weather(resp["weather"]);
    }); // i have to do this since the weather popup uses the time format
    chstorage();
}

function dateformathandler() {
    if (this.id === "mdradio") {
        dateformat = "md";
    } else {
        dateformat = "dm";
    }
    chstorage();
}

function searchtaghandler() {
    searchtags = this.value;
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
    blur = val;
}

function refreshinphandler() {
    refreshtime = this.value;
    chstorage();
}

function chstorage() {
    chrome.storage.local.set({
        blurval: blur,
        tempunit: tempunit,
        timeformat: timeformat,
        dateformat: dateformat,
        searchtags: searchtags,
        refreshtime: refreshtime,
        iconset: iconset
    });
    qs("#savetext").innerHTML = "Saved.";

}

function backgroundhandler() {
    if (!promotional) {
        console.debug("changing BG...");
        followredirects(`https://source.unsplash.com/${window.screen.width}x${window.screen.height}/?${searchtags}`, function (response) {
            console.debug("redirect followed");
            preloadImage(response, function () {
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
        blur = result["blurval"];
        sblurmain(result["blurval"], false);
        qs("#blurslider").setAttribute("value", result["blurval"]);
        //blur handler
        let slider = document.getElementById('blurslider');
        slider.addEventListener('input', sliderblur);
    });
    //temperature unit handler

    chrome.storage.local.get(['tempunit', 'lastweather', 'iconset', 'weather'], function (result) {
        tempunit = result["tempunit"];
        if (tempunit === undefined) {
            tempunit = "f";
        }
        //weather routine
        if (tempunit === "f") {
            qs("#farradio").setAttribute("checked", "checked");
        } else {
            qs("#celradio").setAttribute("checked", "checked");
        }
        iconset = result['iconset'];
        if (iconset === undefined) {
            iconset = "climacons";
        }
        if (iconset === "climacons") {
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
    //timeformat handler

    chrome.storage.local.get(['timeformat'], function (result) {
        timeformat = result["timeformat"];
        if (timeformat === undefined) {
            timeformat = "12";
        }
        //weather routine
        if (timeformat === "12") {
            qs("#12radio").setAttribute("checked", "checked");
        } else {
            qs("#24radio").setAttribute("checked", "checked");
        }
        document.getElementById('12radio').addEventListener('input', timeformathandler);
        document.getElementById('24radio').addEventListener('input', timeformathandler);
    });
    //dateformat handler

    chrome.storage.local.get(['dateformat'], function (result) {
        dateformat = result["dateformat"];
        if (dateformat === undefined) {
            dateformat = "md";
        }
        //weather routine
        if (dateformat === "md") {
            qs("#mdradio").setAttribute("checked", "checked");
        } else {
            qs("#dmradio").setAttribute("checked", "checked");
        }
        document.getElementById('mdradio').addEventListener('input', dateformathandler);
        document.getElementById('dmradio').addEventListener('input', dateformathandler);
    });

    chrome.storage.local.get(['searchtags', "lastbgrefresh", "refreshtime"], function (result) {
        searchtags = result["searchtags"];
        if (searchtags === undefined) {
            searchtags = "nature,ocean,city,space";
        }
        refreshtime = result["refreshtime"];
        if (refreshtime === undefined) {
            refreshtime = 0;
        }
        qs("#bgrefresh").setAttribute("value", refreshtime);
        qs("#bgtags").setAttribute("value", searchtags);
        if (refreshtime !== 0) {
            let sincelastdownload = (new Date().getTime() / 1000) - result["lastbgrefresh"];
            let timetowait = refreshtime * 60;
            if (sincelastdownload > timetowait) {
                backgroundhandler();
            } else {
                console.debug(`been less than ${refreshtime} mins, using same BG`);
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
    document.querySelectorAll(".htmlinclude").forEach(function (obj, i) {
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
        qs("#evergreenpopover").setAttribute("data-bs-content", `<h2 class="display-4"><img class="logoimg" src="icons/evergreen${dev ? "dev" : ""}128.png"/>Evergreen${dev ? " Dev" : ""}</span></h2><h4>New Tab for Chrome</h4><h4>Version ${version}</h4><h5>Created by <a href="https://reticivis.net/">Reticivis</a></h5>`);
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
