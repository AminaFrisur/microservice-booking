'use strict';
// TODO: GENERELL -> Authentifizierung zwischen Microservices muss noch umgesetzt werden
// TODO: Umgebungsvariablen beim Start des Containers mit einfügen -> Umgebungsvariable für Router MongoDB
const express = require('express');
const bodyParser = require('body-parser');
var jsonBodyParser = bodyParser.json({ type: 'application/json' });
// Constants
const PORT = 8000;
const HOST = '0.0.0.0';
const mongoose = require('mongoose');

mongoose.Promise = global.Promise;
const dbconfig = {
    url: 'mongodb://router01buchungsverwaltung/backend',
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
    preisBrutto: Number,
    storniert: Boolean,
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

// TODO: Hole dir Buchungen von Datum bis Datum
app.post('/getCurrentBookings', [jsonBodyParser], async function (req, res) {
    try {
        let params = checkParams(req, res,["von", "bis"]);
        await mongoose.connect(dbconfig.url);
        const buchungen = await buchungenDB.find({"buchungsDatum": {$gte:params.von,$lt:params.bis}});
        res.status(200).send(buchungen);
    } catch(err){
        console.log(err);
        res.status(401).send(err);
    }
});

// api call für eventuelle Statistiken
// nur für Admin
app.get('/getAllBookings', async function (req, res) {
    try {
        await mongoose.connect(dbconfig.url);
        const buchungen = await buchungenDB.find({});
        res.status(200).send(buchungen);
    } catch(err){
        console.log(err);
        res.status(401).send(err);
    }
});

app.get('/getBooking/:buchungsNummer', async function (req, res) {
    try {
        let params = checkParams(req, res,["buchungsNummer"]);
        await mongoose.connect(dbconfig.url)
        const buchung = await buchungenDB.find({"buchungsNummer": params.buchungsNummer });
        res.status(200).send(buchung);
    } catch(err){
        console.log('db error');
        res.status(401).send(err);
    }

});

app.get('/getBookingByUser/:loginName', async function (req, res) {
    try {
        let params = checkParams(req, res,["loginName"]);
        await mongoose.connect(dbconfig.url)
        const buchung = await buchungenDB.find({"loginName": params.loginName});
        res.status(200).send(buchung);
    } catch(err){
        console.log(err);
        res.status(401).send(err);
    }

});

app.post('/createBooking', [jsonBodyParser], async function (req, res) {
    try {
        await mongoose.connect(dbconfig.url);
        let params = checkParams(req, res,["buchungsDatum", "loginName", "fahrzeugId", "fahrzeugTyp", "dauerDerBuchung"]);

        // frage die aktuellste Buchungsnummer ab
        let aktuelleBuchung = await buchungenDB.findOne({}, null, {sort: {buchungsNummer: 1}});
        let aktuelleBuchungsNummer = 1;

        // Wenn keine Buchungen vorhanden sind
        if(aktuelleBuchung) {
            aktuelleBuchungsNummer = aktuelleBuchung.buchungsNummer + 1;
        }

        // TODO: Payment und Rechnung hier noch einfügen

        console.log(aktuelleBuchungsNummer);

        // new Date.toISOString()

        aktuelleBuchungsNummer = aktuelleBuchungsNummer + 1;
        // TODO: Prüfe ob Buchungszeitraum verfügbar ist
        let preisNetto = params.dauerDerBuchung * preisTabelle["Kombi"];
        await buchungenDB.create({
            buchungsDatum: new Date(params.buchungsDatum).toISOString(),
            buchungsNummer: aktuelleBuchungsNummer,
            loginName: params.loginName,
            fahrzeugId: params.fahrzeugId,
            dauerDerBuchung: params.dauerDerBuchung,
            preisNetto: preisNetto,
            preisBrutto: preisNetto * 1.19,
            bezahlt: false,
            storniert: false
        });
        res.status(200).send("Buchung wurde erfolgeich erstellt");
    } catch(err){
        console.log(err);
        res.status(401).send(err);
    }
});


app.post('/cancelBooking/:buchungsNummer',  async function (req, res) {
    try {
        await mongoose.connect(dbconfig.url);
        let params = checkParams(req, res,["buchungsNummer"]);

        // TODO: Direkt eine Gutschrift als Rechnung erstellen und PAyment in Auftrag geben

        const buchung = await buchungenDB.find({"buchungsNummer": params.buchungsNummer});
        buchung.storniert = true;
        buchung.save();
        res.send(200, "Buchung wurde erfolgeich storniert");
    } catch(err){
        console.log('db error');
        res.status(401).send(err);
    }
});

app.listen(PORT, HOST, () => {
    console.log(`Running on http://${HOST}:${PORT}`);
});