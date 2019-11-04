var apikey = "5b01b9ed56e3751931257dde5e952fae";

function httpGetAsync(url, callback) {
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.onreadystatechange = function () {
        if (xmlHttp.readyState == 4 && xmlHttp.status == 200)
            callback(xmlHttp.responseText);
    };
    xmlHttp.open("GET", url, true); // true for asynchronous
    xmlHttp.send(null);
}

function jsonrequest(url, callback) {
    httpGetAsync(url, function (response) {
        var json = JSON.parse(response);
        callback(json);
    });
}

function weathercurrent(lat, long, callback) {
    var url = `https://api.openweathermap.org/data/2.5/weather?lat=${encodeURIComponent(lat)}&long=${encodeURIComponent(long)}&appid=${encodeURIComponent(apikey)}`;
    jsonrequest(url, callback);
}