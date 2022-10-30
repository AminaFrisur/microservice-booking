module.exports = function() {
    var module = {};
    var http_client = require('./http_client.js')();
    // mache ein Post Request und Frage login Token ab
    // Falls nicht vorhanden kann die Buchung nicht vorgenommen werden
    // Bei jedem Zugriff auf Booking muss über den HTTP Header ein Auth Token zurückgegeben werden
    // Anschließend erfolgt eine Abfrage an MS Benutzerverwaltung
    // Booking MS speichert bei erfolg diesen zwischen (Key Value Store) mit den Parametern auth Token, Datum, Login Name

    module.checkAuthAdmin = function (req, res, next){
        checkAuth(req, res, true, next);
    };

    module.checkAuthUser = function (req, res, next) {
        checkAuth(req, res, false, next);
    }

    async function checkAuth(req, res, isAdmin, next) {
        let auth_token = req.headers.auth_token;
        let login_name = req.headers.login_name;
        let bodyData = {"login_name":login_name, "auth_token": auth_token, "isAdmin": isAdmin};
        try {
            let result = await http_client.makePostRequest("rest-api-benutzerverwaltung1", "8000", "/checkAuthUser", bodyData);
            let login_data = JSON.parse(result);
            console.log(login_data);
            if(login_data[0].auth_token && login_data[0].auth_token_timestamp) {
                next();
            } else {
                res.status(401).send("token and/or login name are missing or are not valid");
            }
        } catch(e) {
            console.log(e);
            res.status(401).send("token and/or login name are missing or are not valid");
        }
    }
    return module;
}
