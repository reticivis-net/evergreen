//the weather.js is shit and the api is shit and im mad so here's my own library lol
var apikey = "9b844f9ec461fb26f16bb808550c5aca";

function jsonp(url, callback) {
    $.ajax({
        url: url,
        type: "POST",
        dataType: 'jsonp',
        success: callback
    });
}

function geoloc(callback) {
    if (navigator.geolocation) {
        return navigator.geolocation.getCurrentPosition(callback);
    } else {
        return false;
    }
}

function weatherpos(weatherfunc, callback) {
    geoloc(function (position) {
        weatherfunc(position.coords.latitude, position.coords.longitude, callback);
    });
}

function weathercurrent(lat, long, callback) {
    var url = `https://api.darksky.net/forecast/${encodeURIComponent(apikey)}/${encodeURIComponent(lat)},${encodeURIComponent(long)}`;
    jsonp(url, callback);
}

weatherpos(weathercurrent, function (weather) {
    console.log(weather);
});
