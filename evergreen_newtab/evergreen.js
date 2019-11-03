var blur = 0;
var tempunit = "f";

function round(value, decimals) {
    return Number(Math.round(value + 'e' + decimals) + 'e-' + decimals);
}

function datetime() {
    var date = new Date();
    var h = date.getHours(); // 0 - 23
    var m = date.getMinutes(); // 0 - 59
    var s = date.getSeconds(); // 0 - 59
    var session = "AM";
    if (h === 0) {
        h = 12;
    }
    if (h > 12) {
        h = h - 12;
        session = "PM";
    }
    // h = (h < 10) ? "0" + h : h;
    m = (m < 10) ? "0" + m : m;
    s = (s < 10) ? "0" + s : s;
    var time = h + ":" + m + ":" + s + " " + session;
    $(".clock").html(time);
    var d = date.getDate();
    var mo = date.getMonth() + 1;
    var y = date.getFullYear();
    var da = `${mo}/${d}/${y}`;
    $(".date").html(da);

}

function weatherRoutine() {
    if (navigator.geolocation) {
        return navigator.geolocation.getCurrentPosition(weather);
    } else {
        return false;
    }
}

function weather(position) {
    Weather.getCurrentLatLong(position.coords.latitude, position.coords.longitude, function (current) {
        if (tempunit == "f") {
            var weather = Math.round(Weather.kelvinToFahrenheit(current.temperature()));
        } else {
            var weather = Math.round(Weather.kelvinToCelsius(current.temperature()));
        }

        $(".weather").html(`${weather}°`);
        console.log(current.conditions());
        var wimg = `<img class=\"weatherimg\" src=\"https://openweathermap.org/img/wn/${current.data.list[0].weather[0].icon}.png\"/>`;
        $(".wimgcontainer").html(wimg);
    });
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

function unitchange() {
    if (this.id === "farradio") {
        tempunit = "f";
    } else {
        tempunit = "c";
    }
    weatherRoutine();
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
}

function chstorage() {
    chrome.storage.sync.set({blurval: blur}, function () {
    });
    chrome.storage.sync.set({tempunit: tempunit}, function () {
    });
}

$(document).ready(function () {
    Weather.APIKEY = "5b01b9ed56e3751931257dde5e952fae";

    //popovers
    $("#weatherpopover").attr("data-content", `<b>test123</b><img src="evergreen128.png"/>`);
    $("#evergreenpopover").attr("data-content", `<h2><img class="logoimg" src="evergreen128.png"/>Evergreen</h2><h4>New Tab for Chrome</h4><h5>Created by Reticivis</h5>`);
    $("#timepopover").attr("data-content", `<div id="tpop"></div>`);
    caleandar(document.getElementById('caltemp'));
    var caltemp = $("#caltemp").html();
    $("#datepopover").attr("data-content", `<div id="caltemp">${caltemp}</div>`);
    $("#caltemp").remove();
    $('[data-toggle="popover"]').popover({html: true});
    //blur handler
    var slider = document.getElementById('blurslider');
    slider.addEventListener('input', sliderblur);
    document.getElementById('farradio').addEventListener('input', unitchange);
    document.getElementById('celradio').addEventListener('input', unitchange);
    chrome.storage.sync.get(['blurval'], function (result) {
        sblur(result["blurval"]);
        $("#blurslider").attr("value", result["blurval"])
    });
    chrome.storage.sync.get(['tempunit'], function (result) {
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
        weatherRoutine();
    });
    setInterval(regularinterval, 100);
    setInterval(chstorage, 3000);

});


