var http_client = require('./http_client.js')();
module.exports = function() {
    var module = {};
    var http_client = require('./http_client.js')();
    // mache ein Post Request und Frage login Token ab
    // Falls nicht vorhanden kann die Buchung nicht vorgenommen werden
    // Bei jedem Zugriff auf Booking muss über den HTTP Header ein Auth Token zurückgegeben werden
    // Anschließend erfolgt eine Abfrage an MS Benutzerverwaltung
    // Booking MS speichert bei erfolg diesen zwischen (Key Value Store) mit den Parametern auth Token, Datum, Login Name

     module.checkAuth = async function(req, res, isAdmin, cache, next) {
        let auth_token = req.headers.auth_token;
        let login_name = req.headers.login_name;

        // Schritt 1: Prüfe ob auth Token im cache und valide ist
        let check = cache.checkToken(login_name, auth_token, isAdmin);
        if(check == false) {
            // Schritt 2: Token ist nicht valide, Timestamp zu alt oder Auth Daten sind nicht im cache
            let bodyData = {"login_name":login_name, "auth_token": auth_token, "isAdmin": isAdmin};
            try {
                let result = await http_client.makePostRequest("rest-api-benutzerverwaltung1", "8000", "/checkAuthUser", bodyData);
                let login_data = JSON.parse(result);
                if(login_data[0].auth_token && login_data[0].auth_token_timestamp) {
                    cache.updateOrInsertCachedUser(login_name, login_data[0].auth_token, login_data[0].auth_token_timestamp, isAdmin);
                    next();
                } else {
                    res.status(401).send("token and/or login name are missing or are not valid");
                }
            } catch(e) {
                res.status(401).send("token and/or login name are missing or are not valid");
            }
        } else {
            console.log("Nutzer ist noch zwischengespeichert");
            next();
        }

    }
    return module;
}
