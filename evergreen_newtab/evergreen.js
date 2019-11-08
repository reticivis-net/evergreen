var blur = 0;

var timeformat = "12";
var dateformat = "md";
var searchtags = "nature,ocean,city";
var refreshtime = 0;

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
    if (climacons[prop] !== undefined) return climacons[prop];
    else return "cloud";
}

function weather(response) {
    //var wimg = `<img class=\"weatherimg\" src=\"https://openweathermap.org/img/wn/${current.data.list[0].weather[0].icon}.png\"/>`;
    //$(".wimgcontainer").html(wimg);
    chrome.storage.local.set({
        "weather": response
    });
    var temp = response.currently.temperature;
    $(".wdaily").html(response.daily.summary);
    $(".whourly").html(response.hourly.summary);
    $(".wminutely").html(response.minutely.summary);
    $(".whourlycontent").html("");
    $(".wdailycontent").html("");
    $("#weatherimage").html(`<span aria-hidden="true" class="climacon ${climacon(response.currently.icon)}"></span>`);
    response.hourly.data.slice(0, 7).forEach(function (hour, i) {
        $(".whourlycontent").append(`
        <div class="weatherblock">
            <h6 class="pfix">${localeHourString(hour.time)} <span aria-hidden="true" class="popover-climacon climacon ${climacon(hour.icon)}"></span></h6>
            <p>${tunit(hour.temperature)}°</p>
            <p class="rainp">${Math.round(hour.precipProbability * 100)}%</p>
        </div>
        `);

    });
    response.daily.data.slice(0, 7).forEach(function (day) {
        $(".wdailycontent").append(`
        <div class="weatherblock">
            <h6 class="pfix">${dayofepoch(day.time)} <span aria-hidden="true" class="popover-climacon climacon ${climacon(day.icon)}"></span></h6>
            <p><span class="low">${tunit(day.temperatureLow)}°</span> <span class="high">${tunit(day.temperatureHigh)}°</span> </p>
            <p class="rainp">${Math.round(day.precipProbability * 100)}%</p>
        </div>
        `);
    });
    $("#weatherpopover").popover("hide");
    $("#weatherpopover").attr("data-content", $(".weatherdiv").html());
    $('#weatherpopover').popover({
        html: true
    });
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
    sblur(this.value);
}

function tempunithandler() {
    if (this.id === "farradio") {
        tempunit = "f";
    } else {
        tempunit = "c";
    }
    chrome.storage.local.get(["weather"], function (resp) {
        weather(resp["weather"]);
    });
}

function timeformathandler() {
    if (this.id === "12radio") {
        timeformat = "12";
    } else {
        timeformat = "24";
    }
    chrome.storage.local.get(["weather"], function (resp) {
        weather(resp["weather"]);
    }); // i have to do this since the weather popup uses the time format
}

function dateformathandler() {
    if (this.id === "mdradio") {
        dateformat = "md";
    } else {
        dateformat = "dm";
    }

}

function searchtaghandler() {
    searchtags = $(this).val();
}

function sblur(val) {
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

function chstorage() {
    chrome.storage.local.set({
        blurval: blur,
        tempunit: tempunit,
        timeformat: timeformat,
        dateformat: dateformat,
        searchtags: searchtags,
        refreshtime: refreshtime
    });
    $("#savetext").html("Saved.");

}

function backgroundhandler() {
    followredirects(`https://source.unsplash.com/${window.screen.width}x${window.screen.height}/?${searchtags}`, function (response) {
        preloadImage(response, function () {
            $(".bg").css("background-image", `url(${response})`);
        });

        //$(".bg").css("background-image", `url(${response})`);
        chrome.storage.local.set({
            bgimage: response,
            lastbgrefresh: new Date().getTime() / 1000
        });
    });
}

function refreshinphandler() {
    refreshtime = $(this).val();
}

function optionsinit() {
    //blur handler
    var slider = document.getElementById('blurslider');
    slider.addEventListener('input', sliderblur);
    chrome.storage.local.get(['blurval'], function (result) {
        if (result["blurval"] == undefined) {
            result["blurval"] = "0";
        }
        blur = result["blurval"];
        sblur(result["blurval"]);
        $("#blurslider").attr("value", result["blurval"])
    });
    //temperature unit handler
    document.getElementById('farradio').addEventListener('input', tempunithandler);
    document.getElementById('celradio').addEventListener('input', tempunithandler);
    chrome.storage.local.get(['tempunit', 'lastweather'], function (result) {
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

        if (result["lastweather"] == undefined) { // most likely happens on first install
            console.log("getting new weather info");
            weatherpos(weathercurrent, weather);
            chrome.storage.local.set({
                lastweather: new Date().getTime() / 1000
            });
        } else { // there is a date of the last time we got the weather
            var sincelastdownload = (new Date().getTime() / 1000) - result["lastweather"];
            var timetowait = 60 * 10; // only get weather every 10 mins
            if (sincelastdownload > timetowait) { // if its been longer than 10 mins, get the weather again
                console.log("getting new weather info");
                weatherpos(weathercurrent, weather);
                chrome.storage.local.set({
                    lastweather: new Date().getTime() / 1000
                });
            } else { // otherwise, use the saved info to possibly prevent the weather api limit
                console.log("using saved weather info");

                chrome.storage.local.get(["weather"], function (resp) {
                    weather(resp["weather"]);
                });
            }
        }
        console.log(sincelastdownload, timetowait);

    });
    //timeformat handler
    document.getElementById('12radio').addEventListener('input', timeformathandler);
    document.getElementById('24radio').addEventListener('input', timeformathandler);
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
    });
    //dateformat handler
    document.getElementById('mdradio').addEventListener('input', dateformathandler);
    document.getElementById('dmradio').addEventListener('input', dateformathandler);
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
    });
    document.getElementById('bgtags').addEventListener('change', searchtaghandler);
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
            }
        } else {
            backgroundhandler();
        }

    });
    document.getElementById('bgrefresh').addEventListener('change', refreshinphandler);
}

$(document).ready(function () {
    //imghandler
    chrome.storage.local.get(['bgimage', "lastbgrefresh"], function (result) {
        var bgimage = result["bgimage"];
        $(".bg").css("background-image", `url(${bgimage})`);
    });
    //popovers
    document.getElementById("bg-change").onclick = backgroundhandler;
    document.getElementById("save").onclick = chstorage;
    $("#evergreenpopover").attr("data-content", `<h2 class="display-4"><img class="logoimg" src="evergreen128.png"/>Evergreen</h2><h4>New Tab for Chrome</h4><h5>Created by Reticivis</h5>`);
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
    setInterval(regularinterval, 100);
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
});