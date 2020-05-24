var blur = 0;

var timeformat = "12";
var dateformat = "md";
var searchtags = "nature,ocean,city";
var refreshtime = 0;

var promotional = false; // use the same BG for promotionial purposes
var development = false; // enables debug prints

var version = chrome.runtime.getManifest().version;

var weatherpage = 0;
debugp("Evergreen in development mode");

function debugp(string) {
    if (development) {
        console.log(string);
    }
}

function round(value, decimals) {
    return Number(Math.round(value + 'e' + decimals) + 'e-' + decimals);
}

function getDataUri(url, callback) {
    var image = new Image();

    image.onload = function () {
        var canvas = document.createElement('canvas');
        canvas.width = this.naturalWidth; // or 'width' if you want a special/scaled size
        canvas.height = this.naturalHeight; // or 'height' if you want a special/scaled size

        canvas.getContext('2d').drawImage(this, 0, 0);

        // ... or get as Data URI
        callback(canvas.toDataURL('image/png'));
        canvas.remove();
    };

    image.src = url;
}

function preloadImage(url, callback) {
    var img = new Image();
    img.src = url;
    img.onload = callback;
}

function httpGetAsync(theUrl, callback) {
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.onreadystatechange = function () {
        if (xmlHttp.readyState == 4 && xmlHttp.status == 200)
            callback(xmlHttp.responseText);
    };
    xmlHttp.open("GET", theUrl, true); // true for alocalhronous
    xmlHttp.send(null);
}

function followredirects(url, callback) {
    var theUrl = `https://reticivis.net/follow-redirect.php?url=${encodeURIComponent(url)}`;
    httpGetAsync(theUrl, callback);
}

function datetime() {
    var date = new Date();
    var h = date.getHours(); // 0 - 23
    var m = date.getMinutes(); // 0 - 59
    var s = date.getSeconds(); // 0 - 59
    if (timeformat === "12") {
        var session = "AM";
        if (h === 0) {
            h = 12;
        }
        if (h == 12) {
            session = "PM";
        }
        if (h > 12) {
            h = h - 12;
            session = "PM";
        }
        m = (m < 10) ? "0" + m : m;
        s = (s < 10) ? "0" + s : s;
        var time = h + ":" + m + ":" + s + " " + session;

    } else {
        h = (h < 10) ? "0" + h : h;
        m = (m < 10) ? "0" + m : m;
        s = (s < 10) ? "0" + s : s;
        var time = h + ":" + m + ":" + s;
    }

    // h = (h < 10) ? "0" + h : h;

    $(".clock").html(time);
    var d = date.getDate();
    var mo = date.getMonth() + 1;
    var y = date.getFullYear();
    if (dateformat === "md") {
        var da = `${mo}/${d}/${y}`;
    } else {
        var da = `${d}/${mo}/${y}`;
    }

    $(".date").html(da);

}

function localeHourString(epoch) {
    var d = new Date(0);
    d.setUTCSeconds(epoch);
    var date = d;
    var h = date.getHours(); // 0 - 23
    if (timeformat === "12") {
        var session = "AM";
        if (h === 0) {
            h = 12;
        }
        if (h == 12) {
            session = "PM";
        }
        if (h > 12) {
            h = h - 12;
            session = "PM";
        }

        var time = h + " " + session;

    } else {
        h = (h < 10) ? "0" + h : h;

        var time = h + ":00";
    }
    return time;
}

function dayofepoch(epoch) {
    var weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    var d = new Date(0);
    d.setUTCSeconds(epoch);
    return weekdays[d.getDay()]
}

function tunit(temp) { //for general use to have one function for every temperature
    if (tempunit === "c") {
        temp = ftoc(temp);
    }
    return Math.round(temp);
}

function climacon(prop) {
    if (iconset === "climacons") {
        var climacons = {
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
        var climacons = {
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

function updateweather(showafter) {
    $("#weatherpopover").popover("hide");
    $("#weatherpopover").attr("data-content", $(".weatherdiv").html());
    $('#weatherpopover').popover({
        html: true,
        trigger: "click"
    });
    if (showafter) {
        //$("#weatherpopover")[0].focus();
        $("#weatherpopover").popover("show");

    }
}

function weather(response, showafter = false) {
    debugp(response);
    chrome.storage.local.set({
        "weather": response
    });
    debugp(`Weather page ${weatherpage}`);
    var temp = response.currently.temperature;
    $(".wdaily").html(response.daily.summary);
    $(".whourly").html(response.hourly.summary);
    if (response.minutely) { // not all regions have minutely
        $(".wminutely").html(response.minutely.summary);
    } else {
        $(".wminutely").html(response.currently.summary);
    }
    $(".whourlycontent").html("");
    $(".wdailycontent").html("");
    $(".walerts").html("");
    $("#weatherimage").html(`${climacon(response.currently.icon)}`);
    response.hourly.data.slice(weatherpage * 7, 7 + weatherpage * 7).forEach(function (hour, i) {
        var paginationtime = "";
        if (weatherpage > 0) {
            paginationtime = "<p class=\"pfix\">" + dayofepoch(hour.time) + " " + localeHourString(hour.time) + "</p>";
        }
        $(".whourlycontent").append(`
        <div class="weatherblock popovertt" data-content="test123">
            <span class="data">hour-${i}</span>
            <span class="data ttcontent">${paginationtime}<p class="pfix">${hour.summary}</p><p class="pfix">Feels like ${tunit(hour.apparentTemperature)}°</p></span>
            <h6 class="pfix">${localeHourString(hour.time)} ${climacon(hour.icon)}</h6>
            <p>${tunit(hour.temperature)}°</p>
            <p class="rainp">${Math.round(hour.precipProbability * 100)}%</p>
        </div>
        `);
    });
    if (weatherpage > 0) {
        $(".whourlycontent").append("<a class=\"btn btn-sm btn-primary btn-circle weather-pagination-left\"><i class=\"fas fa-chevron-left\"></i></a>");
    }
    if (weatherpage < 6) {
        $(".whourlycontent").append("<a class=\"btn btn-sm btn-primary btn-circle weather-pagination-right\"><i class=\"fas fa-chevron-right\"></i></a>");
    }
    response.daily.data.slice(0, 7).forEach(function (day, i) {
        var accum = "";
        if (day.precipAccumulation) {
            accum = day.precipAccumulation;
            if (accum > 0.05) {
                if (tempunit == "f") accum += "in";
                else accum = round(accum * 2.54, 2) + "cm";
                accum = `<p class="rainp pfix">${accum} of ${day.precipType}</p>`;
            } else {
                accum = "";
            }
        }
        $(".wdailycontent").append(`
        <div class="weatherblock popovertt">
            <span class="data">day-${i}</span>
            <span class="data ttcontent"><p class="pfix">${day.summary}</p>${accum}</span>
            <h6 class="pfix">${dayofepoch(day.time)} ${climacon(day.icon)}</h6>
            <p><span class="low">${tunit(day.temperatureLow)}°</span> <span class="high">${tunit(day.temperatureHigh)}°</span> </p>
            <p class="rainp">${Math.round(day.precipProbability * 100)}%</p>
        </div>
        `);
    });

    if (response.alerts) {
        response.alerts.forEach(function (alert, i) {
            var regionstring = "";
            alert.regions.forEach(function (region) {
                regionstring = regionstring.concat(`<p class="pfix">${region}</p>`);
            });
            $(".walerts").append(`
        <h6 class="pfix">
            <a href="${alert.uri}">
                <span class="popovertt">
                    WEATHER ${alert.severity.toUpperCase()}. EXPIRES ${dayofepoch(alert.expires).toUpperCase()} ${localeHourString(alert.expires)}. 
                    <span class="data ttcontent"><div class="text-left"><p class="pfix">${alert.description.replace(/\*/g, "</p><p class='pfix' style=\"margin-top:3px;\">")}</p></div></span>
                </span>
            </a>
            <a href="${alert.uri}">
                <span class="popovertt">
                    AFFECTS ${alert.regions.length} REGIONS
                    <span class="data ttcontent">${regionstring}</span>
                </span>
            </a>
        </h6>
        `);
        });
    }
    $("#weatherpopover").on('shown.bs.popover', function () {
        $("body").tooltip({
            selector: '.popovertt',
            html: true,
            title: function () {
                return $($(this).find(".ttcontent")[0]).html();
            },
            trigger: "hover"
        });
        //weather pagination
        $(".weather-pagination-left").on('click', function (event) {
            event.stopPropagation();
            event.stopImmediatePropagation();
            if (weatherpage > 0) {
                weatherpage = weatherpage - 1;
                $(".popover").css("transition-duration", "0");
                chrome.storage.local.get(["weather"], function (resp) {
                    weather(resp["weather"], true);
                });
            }
        });
        $(".weather-pagination-right").on('click', function (event) {
            event.stopPropagation();
            event.stopImmediatePropagation();

            if (weatherpage < 6) {
                weatherpage = weatherpage + 1;
                $(".popover").css("transition-duration", "0");
                chrome.storage.local.get(["weather"], function (resp) {

                    weather(resp["weather"], true);
                });
            }
        });
    });
    $("#weatherpopover").on("hidden.bs.popover", function () {
        $(".tooltip").tooltip("hide");
        $(".weather-pagination-right").unbind();
        $(".weather-pagination-left").unbind();
    });
    updateweather(showafter);
    $(".weather").html(`${tunit(temp)}°`);
    //$("#weatherpopover").popover("hide");
    $("#weatherh3").tooltip('hide')
        .attr('data-original-title', response.currently.summary);
    $(document).tooltip({
        selector: '.tt'
    });
}

function regularinterval() {
    datetime();
    var now = new Date();
    var weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    var months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    var date = `<h4 style="margin:0;">${weekdays[now.getDay()]} ${months[now.getMonth()]} ${("0" + now.getDate()).slice(-2)} ${now.getFullYear()} ${now.toLocaleTimeString()}</h4>`;
    $("#timepopover").attr("data-content", `<div id="tpop">${date}</div>`);
    $("#tpop").html(date);
}

function sliderblur() {
    $("#savereminder").removeClass("nodisplay");
    sblur(this.value);
}

function tempunithandler() {
    $("#savereminder").removeClass("nodisplay");
    if (this.id === "farradio") {
        tempunit = "f";
    } else {
        tempunit = "c";
    }
    debugp("reloading weather div with cached info");
    chrome.storage.local.get(["weather"], function (resp) {
        weather(resp["weather"]);
    });
}

function iconsethandler() {
    $("#savereminder").removeClass("nodisplay");
    if (this.id === "cradio") {
        iconset = "climacons";
    } else {
        iconset = "fontawesome";
    }
    debugp("reloading weather div with cached info");
    chrome.storage.local.get(["weather"], function (resp) {
        weather(resp["weather"]);
    });
}

function timeformathandler() {
    $("#savereminder").removeClass("nodisplay");
    if (this.id === "12radio") {
        timeformat = "12";
    } else {
        timeformat = "24";
    }
    debugp("reloading weather div with cached info");
    chrome.storage.local.get(["weather"], function (resp) {
        weather(resp["weather"]);
    }); // i have to do this since the weather popup uses the time format
}

function dateformathandler() {
    $("#savereminder").removeClass("nodisplay");
    if (this.id === "mdradio") {
        dateformat = "md";
    } else {
        dateformat = "dm";
    }

}

function searchtaghandler() {
    $("#savereminder").removeClass("nodisplay");
    searchtags = $(this).val();
}

function sblur(val) {
    $("#savereminder").removeClass("nodisplay");
    sblurmain(val);

}

function sblurmain(val) {
    if (val == 0) {
        $(".bg").css("transform", "initial");
        $(".bg").css("filter", "initial");
    } else {
        $(".bg").css("transform", `scale(${1 + 0.1 * (val / 15)})`);
        $(".bg").css("filter", `blur(${val}px)`);
    }
    $("#blurval").html(`<i class="fas fa-image"></i> Background blur: ${val}px`);
    blur = val;
}

function refreshinphandler() {
    $("#savereminder").removeClass("nodisplay");
    refreshtime = $(this).val();
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
    $("#savereminder").addClass("nodisplay");
    $("#savetext").html("Saved.");

}

function backgroundhandler() {
    if (!promotional) {
        debugp("changing BG...");
        followredirects(`https://source.unsplash.com/${window.screen.width}x${window.screen.height}/?${searchtags}`, function (response) {
            debugp("redirect followed");
            preloadImage(response, function () {
                $(".bg").css("background-image", `url(${response})`);
            });

            //$(".bg").css("background-image", `url(${response})`);
            chrome.storage.local.set({
                bgimage: response,
                lastbgrefresh: new Date().getTime() / 1000
            });
            debugp("BG changed");
        });
    }
}

function downloadbg() {
    chrome.storage.local.get(['bgimage'], function (response) {
        let url = response['bgimage'].split("?")[0];
        debugp(url);
        window.location = url;
    });
}

function optionsinit() {


    chrome.storage.local.get(['blurval'], function (result) {
        if (result["blurval"] == undefined) {
            result["blurval"] = "0";
        }
        blur = result["blurval"];
        sblurmain(result["blurval"], false);
        $("#blurslider").attr("value", result["blurval"]);
        //blur handler
        var slider = document.getElementById('blurslider');
        slider.addEventListener('input', sliderblur);
    });
    //temperature unit handler

    chrome.storage.local.get(['tempunit', 'lastweather', 'iconset'], function (result) {
        tempunit = result["tempunit"];
        if (tempunit == undefined) {
            tempunit = "f";
        }
        //weather routine
        if (tempunit == "f") {
            $("#farradio").attr("checked", "checked");
        } else {
            $("#celradio").attr("checked", "checked");
        }
        iconset = result['iconset'];
        if (iconset == undefined) {
            iconset = "climacons";
        }
        if (iconset == "climacons") {
            $("#cradio").attr("checked", "checked");
        } else {
            $("#faradio").attr("checked", "checked");
        }
        if (result["lastweather"] == undefined) { // most likely happens on first install
            weatherpos(weathercurrent, weather);
            chrome.storage.local.set({
                lastweather: new Date().getTime() / 1000
            });
        } else { // there is a date of the last time we got the weather
            var sincelastdownload = (new Date().getTime() / 1000) - result["lastweather"];
            var timetowait = 10 * 60; // only get weather every 10 mins
            if (sincelastdownload > timetowait && navigator.onLine) { // if its been longer than 10 mins, get the weather again
                weatherpos(weathercurrent, weather);
                debugp("downloading new weather info");
                chrome.storage.local.set({
                    lastweather: new Date().getTime() / 1000
                });
            } else { // otherwise, use the saved info to possibly prevent the weather api limit
                chrome.storage.local.get(["weather"], function (resp) {
                    weather(resp["weather"]);
                });
                debugp("using cached weather info");
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
        if (timeformat == undefined) {
            timeformat = "12";
        }
        //weather routine
        if (timeformat == "12") {
            $("#12radio").attr("checked", "checked");
        } else {
            $("#24radio").attr("checked", "checked");
        }
        document.getElementById('12radio').addEventListener('input', timeformathandler);
        document.getElementById('24radio').addEventListener('input', timeformathandler);
    });
    //dateformat handler

    chrome.storage.local.get(['dateformat'], function (result) {
        dateformat = result["dateformat"];
        if (dateformat == undefined) {
            dateformat = "md";
        }
        //weather routine
        if (dateformat == "md") {
            $("#mdradio").attr("checked", "checked");
        } else {
            $("#dmradio").attr("checked", "checked");
        }
        document.getElementById('mdradio').addEventListener('input', dateformathandler);
        document.getElementById('dmradio').addEventListener('input', dateformathandler);
    });

    chrome.storage.local.get(['searchtags', "lastbgrefresh", "refreshtime"], function (result) {
        searchtags = result["searchtags"];
        if (searchtags == undefined) {
            searchtags = "nature,ocean,city,space";
        }
        refreshtime = result["refreshtime"];
        if (refreshtime == undefined) {
            refreshtime = 0;
        }
        $("#bgrefresh").attr("value", refreshtime);
        $("#bgtags").attr("value", searchtags);
        if (refreshtime != 0) {
            var sincelastdownload = (new Date().getTime() / 1000) - result["lastbgrefresh"];
            var timetowait = refreshtime * 60;
            if (sincelastdownload > timetowait) {
                backgroundhandler();
            } else {
                debugp(`been less than ${refreshtime} mins, using same BG`);
            }
        } else {
            backgroundhandler();
        }
        document.getElementById('bgtags').addEventListener('change', searchtaghandler);
        document.getElementById('bgrefresh').addEventListener('change', refreshinphandler);

    });
    $("#savereminder").addClass("nodisplay");
}

$(document).ready(function () {
    //htmlinclude
    $(".htmlinclude").each(function (i, obj) {
        obj = $(obj);
        var include = obj.attr("html-include");
        $(obj).load(include);
        debugp(`included ${include}`)
    });
    //imghandler
    if (promotional) {
        $(".bg").css("background-image", `url(https://images.unsplash.com/photo-1440558929809-1412944a6225?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=1920&q=80)`);
    } else {
        chrome.storage.local.get(['bgimage', "lastbgrefresh"], function (result) {
            var bgimage = result["bgimage"];
            $(".bg").css("background-image", `url(${bgimage})`);
        });
    }

    //popovers
    document.getElementById("bg-change").onclick = backgroundhandler;
    document.getElementById("bg-download").onclick = downloadbg;
    document.getElementById("save").onclick = chstorage;
    $("#changelog-button")[0].onclick = function () {
        $("#changelog").modal();
    };
    $("#evergreenpopover").attr("data-content", `<h2 class="display-4"><img class="logoimg" src="evergreen128.png"/>Evergreen</h2><h4>New Tab for Chrome</h4><h5>Created by <a href="https://reticivis.net/">Reticivis</a></h5>`);
    $("#timepopover").attr("data-content", `<div id="tpop"></div>`);
    //calendar
    caleandar(document.getElementById('caltemp'));
    var caltemp = $("#caltemp").html();
    $("#datepopover").attr("data-content", `<div id="caltemp">${caltemp}</div>`);
    $("#caltemp").remove();

    $('[data-toggle="popover"]').popover({
        html: true
    });
    $('[data-toggle="tooltip"]').tooltip();
    $('#weatherh3').tooltip();
    //other stuff
    optionsinit(); //load shit from chrome (also weather)
    if (promotional) {
        regularinterval();
    } else {
        setInterval(regularinterval, 100);
    }

    $('#menu').on('hidden.bs.modal', function () {
        $("#savetext").html("");
    });
    // FIRST INSTALL
    chrome.storage.local.get(['firstinstall'], function (result) {
        result = result["firstinstall"];
        if (result == undefined || result === true) {
            $("#welcome").modal();
        }
        chrome.storage.local.set({
            firstinstall: false
        });
    });
    // changelog showing
    chrome.storage.local.get(['version'], function (result) {
        result = result["version"];
        if (result == undefined) {
            result = version;
        }
        if (result != version) {
            $("#changelog").modal();
        }
        chrome.storage.local.set({
            version: version
        });
    });
    $(document).on('click', function (e) {
        $('[data-toggle="popover"],[data-original-title]').each(function () {
            //the 'is' for buttons that trigger popups
            //the 'has' for icons within a button that triggers a popup
            if (!$(this).is(e.target) && $(this).has(e.target).length === 0 && $('.popover').has(e.target).length === 0) {
                (($(this).popover('hide').data('bs.popover') || {}).inState || {}).click = false  // fix for BS 3.3.6
            }

        });
    });
    debugp("evergreen fully initiated");
});
