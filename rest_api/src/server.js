'use strict';
const express = require('express');
const bodyParser = require('body-parser');
var jsonBodyParser = bodyParser.json({ type: 'application/json' });
const JWT_SECRET = "goK!pusp6ThEdURUtRenOwUhAsWUCLheasfr43qrf43rttq3";

// Constants
const PORT = 8000;
const HOST = '0.0.0.0';
const mongoose = require('mongoose');

// Microservice Credentials:
var root = "root";
var password = process.env.ROOTPW;

var rootRechnungsverwaltung = "root";
var passwordRechnungsverwaltung = process.env.PWRECHNUNGSVERWALTUNG;


const middlerwareCheckAuthMicroservice = () => {
    return (req, res, next) => {
        Auth.checkAuthMicroservice(req, res, root, password,  next);
    }
}

const middlerwareCheckAuth = (isAdmin) => {
    return (req, res, next) => {
        Auth.checkAuth(req, res, isAdmin, JWT_SECRET,  next);
    }
}



var Auth = require('./auth.js')();
var CircuitBreaker = require('./circuitBreaker.js');
var circuitBreakerRechnungsverwaltung = new CircuitBreaker(150, 30, 0, -3, 10, 3,
                                        process.env.RECHNUNGSVERWALTUNG, 8000);
mongoose.Promise = global.Promise;
const dbconfig = {
    url: process.env.MONGODBROUTER,
    user: process.env.DBUSER,
    pwd: process.env.DBPWD
}

const preisTabelle = {
  "SUV": 80,
  "Kleinwagen": 60,
  "Coupe": 70,
  "Transporter": 100,
  "Kombi": 80
};

// definiere ein Schema
const Schema = mongoose.Schema;
const ObjectId = Schema.ObjectId;

const buchung = new Schema({
    id: ObjectId,
    buchungsNummer: Number,
    buchungsDatum: String,
    // Ebenfalls auch hier vorsicht wegen verteilten Transaktionenen !
    loginName: String,
    // Hier vorsicht: theoretisch eine verteile DB Transaktion
    // Da aber keine Fahrzeuge gelöscht werden, kann hier nichts passieren deshalb OK !
    fahrzeugId: Number,
    dauerDerBuchung: String,
    preisNetto: Number,
    // Einfügen von Status für eine Buchung: Created, Open, Paid, Started, Closed, cancelled, error -> Started und Closed ist später sehr wichtig für Trip
    status: String
});

const buchungenDB = mongoose.model('Booking', buchung);

function checkParams(req, res, requiredParams) {
    console.log("checkParams", requiredParams);
    let paramsToReturn = {};
    for (let i = 0; i < requiredParams.length; i++) {
            let param = requiredParams[i];
            
        if (!(req.query && param in req.query)
            && !(req.body && param in req.body)
            && !(req.params && param in req.params)) {
            let error = "error parameter " + param + " is missing";
            console.log(error);
            throw error;
            return;
        }

        if (req.query && param in req.query) {
            paramsToReturn[param] = req.query[param];
        }
        if (req.body && param in req.body) {
            paramsToReturn[param] = req.body[param];
        }
        if (req.params && param in req.params) {
            paramsToReturn[param] = req.params[param];
        }
    }
    return  paramsToReturn;
}

// App
const app = express();

app.post('/getCurrentBookings', [middlerwareCheckAuth(true), jsonBodyParser], async function (req, res) {
    try {
        let params = checkParams(req, res,["von", "bis"]);
        await mongoose.connect(dbconfig.url);
        const buchungen = await buchungenDB.find({"buchungsDatum": {$gte:params.von, $lt:params.bis}});
        res.status(200).send(buchungen);
    } catch(err){
        console.log(err);
        res.status(401).send(err);
    }
});

// api call für eventuelle Statistiken
// nur für Admin
app.get('/getAllBookings', [middlerwareCheckAuth(true)], async function (req, res) {
    try {
        await mongoose.connect(dbconfig.url);
        const buchungen = await buchungenDB.find({});
        res.status(200).send(buchungen);
    } catch(err){
        console.log(err);
        res.status(401).send(err);
    }
});

app.get('/getBooking/:buchungsNummer',[middlerwareCheckAuth(false)], async function (req, res) {
    try {
        let params = checkParams(req, res,["buchungsNummer"]);
        await mongoose.connect(dbconfig.url)
        const buchung = await buchungenDB.find({"buchungsNummer": params.buchungsNummer, "loginName": req.headers.login_name});
        res.status(200).send(buchung);
    } catch(err){
        console.log(err);
        res.status(401).send(err);
    }

});

app.get('/getBookings',[middlerwareCheckAuth(false)], async function (req, res) {
    try {
        await mongoose.connect(dbconfig.url)
        const buchung = await buchungenDB.find({"loginName": req.headers.login_name});
        res.status(200).send(buchung);
    } catch(err){
        console.log(err);
        res.status(401).send(err);
    }

});

app.post('/createBooking', [middlerwareCheckAuth(false), jsonBodyParser], async function (req, res) {
    try {
        await mongoose.connect(dbconfig.url);
        let params = checkParams(req, res,["buchungsDatum", "fahrzeugId", "fahrzeugTyp",
                                                        "fahrzeugModel", "dauerDerBuchung",
                                                        "name", "vorname", "straße", "hausnummer", "plz"]);

        // frage die aktuellste Buchungsnummer ab
        let aktuelleBuchung = await buchungenDB.findOne({}, null, {sort: {buchungsNummer: -1}});
        let aktuelleBuchungsNummer = 0;

        // Wenn keine Buchungen vorhanden sind
        if(aktuelleBuchung) {
            aktuelleBuchungsNummer = aktuelleBuchung.buchungsNummer;
        }
        aktuelleBuchungsNummer = aktuelleBuchungsNummer + 1;
        let preisNetto = preisTabelle[params.fahrzeugTyp];

        console.log("Erstelle Buchung");

        // Schritt 1: Erstelle Buchung
        await buchungenDB.create({
            buchungsDatum: new Date(params.buchungsDatum).toISOString(),
            buchungsNummer: aktuelleBuchungsNummer,
            loginName: req.headers.login_name,
            fahrzeugId: params.fahrzeugId,
            dauerDerBuchung: params.dauerDerBuchung,
            preisNetto: preisNetto,
            status: "created"
        });
        res.status(200).send(aktuelleBuchungsNummer.toString());

    } catch(err){
        console.log(err);
        res.status(401).send(err);
    }

});

app.post('/createInvoiceForNewBooking/:buchungsNummer', [middlerwareCheckAuth(false)], async function (req, res) {
    try {
        let params = checkParams(req, res,["buchungsNummer"]);
        await mongoose.connect(dbconfig.url)
        const buchungDbResult = await buchungenDB.find({"buchungsNummer": params.buchungsNummer, "loginName": req.headers.login_name});
        if(buchungDbResult && buchungDbResult[0] && buchungDbResult[0].status == "created") {
            // Schritt 2: Erstelle Rechnung
            const buchung = buchungDbResult[0];
            let preisNetto = preisTabelle[buchung.fahrzeugTyp];
            let bodyData = {"loginName": buchung.login_name, "vorname": buchung.vorname,
                "nachname": buchung.nachname, "straße": buchung.straße,
                "hausnummer": buchung.hausnummer, "plz": buchung.plz,
                "fahrzeugId": buchung.fahrzeugId, "fahrzeugTyp": buchung.fahrzeugTyp,
                "fahrzeugModel": buchung.fahrzeugModel, "dauerDerBuchung": buchung.dauerDerBuchung,
                "preisNetto": preisNetto, "buchungsNummer": buchung.buchungsNummer, "gutschrift": false};

            buchung.status = "open";
            buchung.save();

            let headerData = { 'Content-Type': 'application/json', "login_name": rootRechnungsverwaltung, "password": passwordRechnungsverwaltung };
            await circuitBreakerRechnungsverwaltung.circuitBreakerPostRequest("/createInvoice", bodyData, headerData );

            res.status(200).send(`Rechnung zur Buchung ${buchung.buchungsNummer} wurde erfolgreich erstellt.`);
        } else  {
            res.status(401).send("Rechnung konnte nicht erstellt werden, da keine Buchung vorhanden ist oder Buchung sich nicht im Status Created befindet");
        }
    } catch(err){
        console.log(err);
        res.status(401).send(err);
    }
});

app.post('/payOpenBooking/:buchungsNummer', [middlerwareCheckAuth(false)],  async function (req, res) {
    try {
        await mongoose.connect(dbconfig.url);
        let params = checkParams(req, res,["buchungsNummer"]);
        const buchungDbResult = await buchungenDB.find({"buchungsNummer": params.buchungsNummer, "loginName": req.headers.login_name});
        if(buchungDbResult && buchungDbResult[0] && buchungDbResult[0].status == "open"){
            const buchung = buchungDbResult[0];
            // Schritt 3: Führe Bezahlung durch
            // TODO: Payment noch hier einfügen
            buchung.status = "paid";
            buchung.save();

            // Schritt 4: Rechnung auf Bezahlt markieren
            // TODO: HIER DAS PROBLEM MIT VERTEILTEN TRANSAKTIONEN -> Loesung: einzelner Batch Job der schaut ob Buchungen und Rechnungen jeweils dann auf Paid sind oder nicht
            let bodyData = {};
            let promise = circuitBreakerRechnungsverwaltung.circuitBreakerPostRequest("/markInvoiceAsPaid/" + buchung.buchungsNummer, bodyData);
            await promise;
            res.status(200).send("Buchung wurde erfolgreich bezahlt");
        }
        else  {
            res.status(401).send("Buchung konnte nicht bezahlt werden, da keine Buchung vorhanden ist oder Buchung sich nicht im Status Open befindet");
        }
    } catch(err){
        console.log(err);
        res.status(401).send(err);
    }
});

app.post('/cancelBooking/:buchungsNummer', [middlerwareCheckAuth(false)], async function (req, res) {
    try {
        await mongoose.connect(dbconfig.url);
        let params = checkParams(req, res,["buchungsNummer"]);

	    const buchungDBResult = await buchungenDB.find({"buchungsNummer": params.buchungsNummer, "loginName": req.headers.login_name});
	    if(buchungDBResult && buchungDBResult[0] && buchungDBResult[0].status != "started" && buchungDBResult[0].status != "finished"){
                const buchung = buchungDBResult[0];
            if(buchung.status == "paid") {
                let preisNetto = preisTabelle[buchung.fahrzeugTyp];
                let bodyData = {"loginName": buchung.login_name, "vorname": buchung.vorname,
                    "nachname": buchung.nachname, "straße": buchung.straße,
                    "hausnummer": buchung.hausnummer, "plz": buchung.plz,
                    "fahrzeugId": buchung.fahrzeugId, "fahrzeugTyp": buchung.fahrzeugTyp,
                    "fahrzeugModel": buchung.fahrzeugModel, "dauerDerBuchung": buchung.dauerDerBuchung,
                    // TODO: Eventuell noch mahn gebühren hier einfügen -> Also für das Stornieren -> Zudem auch Zeitintervall prüfen -> Falls 1 Stunde vor Buchung -> kein Stornieren mehr möglich
                    "preisNetto": preisNetto, "buchungsNummer": buchung.buchungsNummer, "gutschrift": true};

                    let headerData = { 'Content-Type': 'application/json'};
                    let promise = circuitBreakerRechnungsverwaltung.circuitBreakerPostRequest("/createInvoice", bodyData, headerData );
                    await promise;

            } else if (buchung.status == "open") {
                // Storniere die unbezahlte Rechnung
                // /markInvoiceAsCancelled/:buchungsNummer
                let bodyData = {};
                let promise = circuitBreakerRechnungsverwaltung.circuitBreakerPostRequest( "/markInvoiceAsCancelled/" + params.buchungsNummer, bodyData );
                await promise;
            }
            buchung.status = "cancelled";
            buchung.save();
            res.status(200).send("Buchung wurde erfolgeich storniert");
        }  else  {
            res.status(401).send("Buchung konnte nicht storniert werden, da keine Buchung vorhanden ist oder Buchung sich nicht im Status Paid befindet");
        }
    } catch(err){
        console.log(err);
        res.status(401).send(err);
    }
});


app.post('/startTrip/:buchungsNummer',[middlerwareCheckAuth(false)], async function (req, res) {
    try {
        await mongoose.connect(dbconfig.url);
        let params = checkParams(req, res,["buchungsNummer"]);
        const buchungDBResult = await buchungenDB.find({"buchungsNummer": params.buchungsNummer});
        if(buchungDBResult && buchungDBResult[0] && buchungDBResult[0].status == "paid") {
            const buchung = buchungDBResult[0];
            buchung.status = "started";
            buchung.save();
            res.status(200).send( "Trip wurde gestartet");
        }
        else {
            res.status(401).send("Buchung konnte nicht gestartet werden, da keine Buchung vorhanden ist oder Buchung sich nicht im Status Paid befindet");
        }
    } catch(err){
        console.log(err);
        res.status(401).send(err);
    }
});

app.post('/endTrip/:buchungsNummer',[middlerwareCheckAuth(false)],  async function (req, res) {
    try {
        await mongoose.connect(dbconfig.url);
        let params = checkParams(req, res,["buchungsNummer"]);
        const buchungDBResult = await buchungenDB.find({"buchungsNummer": params.buchungsNummer});
        if(buchungDBResult && buchungDBResult[0] && buchungDBResult[0].status == "started") {
            const buchung = buchungDBResult[0];
            buchung.status = "finished";
            buchung.save();
            res.status(200).send("Trip wurde beendet");
        } else {
            res.status(401).send("Trip konnte nicht beendet werden, da keine Buchung vorhanden ist oder Buchung sich nicht im Status Started befindet");
        }
    } catch(err){
        console.log(err);
        res.status(401).send(err);
    }
});

app.listen(PORT, HOST, () => {
    console.log(`Running on http://${HOST}:${PORT}`);
});
