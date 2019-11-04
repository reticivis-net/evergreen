var blur = 0;

var timeformat = "12";
var dateformat = "md";
var searchtags = "nature,ocean,city";

function round(value, decimals) {
    return Number(Math.round(value + 'e' + decimals) + 'e-' + decimals);
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
    xmlHttp.open("GET", theUrl, true); // true for asynchronous
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

function weatherRoutine() {
    if (navigator.geolocation) {
        return navigator.geolocation.getCurrentPosition(weather);
    } else {
        return false;
    }
}

function weather(response) { //TODO: add openweatherapi HOURLY/WEEKLY thing, youre gonna have to add beyond the weather.min.js thing using _getJson or something like that
    //var wimg = `<img class=\"weatherimg\" src=\"https://openweathermap.org/img/wn/${current.data.list[0].weather[0].icon}.png\"/>`;
    //$(".wimgcontainer").html(wimg);
    console.log(response);
    var skycons = new Skycons({"color": "white"});
    skycons.add("weatherimage", response.currently.icon);
    skycons.play();
    $(".weather").html(`${Math.round(response.currently.temperature)}°`);
}

function regularinterval() {
    datetime();
    var now = new Date();
    var date = `<h4>${now}</h4>`; //TODO: maybe make this your own instead of the ISO or whatever thing
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
    weatherRoutine();
    $("#autosave").html("Settings will autosave to Chrome...");
}

function timeformathandler() {
    if (this.id === "12radio") {
        timeformat = "12";
    } else {
        timeformat = "24";
    }
    $("#autosave").html("Settings will autosave to Chrome...");
}

function dateformathandler() {
    if (this.id === "mdradio") {
        dateformat = "md";
    } else {
        dateformat = "dm";
    }
    $("#autosave").html("Settings will autosave to Chrome...");

}

function searchtaghandler() {
    searchtags = $(this).val();
    $("#autosave").html("Settings will autosave to Chrome...");
}

function sblur(val) {
    if (val == 0) {
        $(".bg").css("transform", "initial");
        $(".bg").css("filter", "initial");
    } else {
        $(".bg").css("transform", `scale(${1 + 0.1 * (val / 15)})`);
        $(".bg").css("filter", `blur(${val}px)`);
    }
    $("#blurval").html(`Background blur: ${val}px`);
    blur = val;
    $("#autosave").html("Settings will autosave to Chrome...");
}

function chstorage() {
    chrome.storage.local.set({blurval: blur});
    chrome.storage.local.set({tempunit: tempunit});
    chrome.storage.local.set({timeformat: timeformat});
    chrome.storage.local.set({dateformat: dateformat});
    chrome.storage.local.set({searchtags: searchtags});
    $("#autosave").html("Settings autosaved to Chrome.");

}

function backgroundhandler() {
    followredirects(`https://source.unsplash.com/${window.screen.width}x${window.screen.height}/?${searchtags}`, function (response) {
        preloadImage(response, function () {
            $(".bg").css("background-image", `url(${response})`);
        });

        //$(".bg").css("background-image", `url(${response})`);
        chrome.storage.local.set({bgimage: response});
        //TODO: add option to only refresh every x minutes
    });
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
    chrome.storage.local.get(['tempunit'], function (result) {
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
        weatherpos(weathercurrent, weather);
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
    chrome.storage.local.get(['searchtags'], function (result) {
        searchtags = result["searchtags"];
        if (searchtags == undefined) {
            searchtags = "nature,ocean,city,space";
        }
        $("#bgtags").attr("value", searchtags);
        backgroundhandler();
    });
}

$(document).ready(function () {

    //imghandler
    chrome.storage.local.get(['bgimage'], function (result) {
        var bgimage = result["bgimage"];
        $(".bg").css("background-image", `url(${bgimage})`);
    });
    //popovers
    $("#weatherpopover").attr("data-content", `
    
    `);
    $("#evergreenpopover").attr("data-content", `<h2><img class="logoimg" src="evergreen128.png"/>Evergreen</h2><h4>New Tab for Chrome</h4><h5>Created by Reticivis</h5>`);
    $("#timepopover").attr("data-content", `<div id="tpop"></div>`);
    //calendar
    caleandar(document.getElementById('caltemp'));
    var caltemp = $("#caltemp").html();
    $("#datepopover").attr("data-content", `<div id="caltemp">${caltemp}</div>`);
    $("#caltemp").remove();

    $('[data-toggle="popover"]').popover({html: true});
    $('[data-toggle="tooltip"]').tooltip();
    //other stuff
    optionsinit(); //load shit from chrome (also weather)
    setInterval(regularinterval, 100);
    setInterval(chstorage, 10000);
    setTimeout(function () {
        $("#autosave").html("Settings autosaved to Chrome.");
    }, 100);


});

