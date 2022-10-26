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
// TODO: Hier nochmal schauen wenn skaliert wird
// TODO LÖSUNG: Frage ab welche Buchungsnummer aktuell die höchste ist ODER Trigger erstellen in MongoDB
let aktuelleBuchungsNummer = 0;

// definiere ein Schema
const Schema = mongoose.Schema;
const ObjectId = Schema.ObjectId;

const buchung = new Schema({
    id: ObjectId,
    buchungsNummer: Number,
    buchungsDatum: Date,
    // Ebenfalls auch hier Vorsicht wegen verteilten Transaktionenen !
    loginName: String,
    // Hier vorsicht: theoretisch eine verteile DB Transaktion
    // Da aber keine Fahrzeuge gelöscht werden, kann hier nichts passieren deshalb OK !
    fahrzeugId: Number,
    dauerDerBuchung: String,
    preisNetto: Number,
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

// TODO: erstelle einen API Call der verfügbare Buchungszeiten und Fahrzeuge fuer einen Standort zurückgibt

// api call für eventuelle Statistiken
app.get('/getBookings', [jsonBodyParser], async function (req, res) {
    try {
        // await mongoose.connect(dbconfig.url, {useNewUrlParser: true, user: dbconfig.user, pass: dbconfig.pwd});
        await mongoose.connect(dbconfig.url);
        const buchungen = await buchungenDB.find({});
        res.status(200).send(buchungen);
    } catch(err){
        console.log(err);
        res.status(401).send(err);
    }
});

app.get('/getBooking/:buchungsNummer', [jsonBodyParser], async function (req, res) {
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

app.get('/getBookingByUser/:loginName', [jsonBodyParser], async function (req, res) {
    try {
        let params = checkParams(req, res,["loginName"]);
        await mongoose.connect(dbconfig.url)
        const buchung = await buchungenDB.find({"loginName": params.loginName});
        res.status(200).send(buchung);
    } catch(err){
        console.log('db error');
        res.status(401).send(err);
    }

});

app.post('/createBooking', [jsonBodyParser], async function (req, res) {
    try {
        await mongoose.connect(dbconfig.url);
        let params = checkParams(req, res,["buchungsDatum","loginName", "fahrzeugId", "dauerDerBuchung", "preisNetto"]);

        aktuelleBuchungsNummer = aktuelleBuchungsNummer + 1;
        await buchungenDB.create({
            buchungsDatum: params.buchungsDatum,
            buchungsNummer: aktuelleBuchungsNummer,
            loginName: params.loginName,
            fahrzeugId: params.fahrzeugId,
            dauerDerBuchung: params.dauerDerBuchung,
            preisNetto: params.preisNetto,
            bezahlt: false,
            storniert: false
        });
        res.send(200, "Buchung wurde erfolgeich erstellt");
    } catch(err){
        console.log('db error');
        res.status(401).send(err);
    }
});

app.post('/cancelBooking', [jsonBodyParser], async function (req, res) {
    try {
        await mongoose.connect(dbconfig.url);
        let params = checkParams(req, res,["buchungsNummer"]);

        aktuelleBuchungsNummer = aktuelleBuchungsNummer + 1;
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