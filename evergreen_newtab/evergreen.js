setInterval(datetime, 100);

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

function getLocation() {
    if (navigator.geolocation) {
        return navigator.geolocation.getCurrentPosition(weather);
    } else {
        return false;
    }
}

function weather(position) {
    Weather.getCurrentLatLong(position.coords.latitude, position.coords.longitude, function (current) {
        var weather = Math.round(Weather.kelvinToFahrenheit(current.temperature()));
        $(".weather").html(`${weather}°`);
    });
}

$(document).ready(function () {
    Weather.APIKEY = "5b01b9ed56e3751931257dde5e952fae";
    getLocation();
});