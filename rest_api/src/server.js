'use strict';
// TODO: GENERELL -> Authentifizierung zwischen Microservices muss noch umgesetzt werden
// TODO: Umgebungsvariablen beim Start des Containers mit einfügen -> Umgebungsvariable für Router MongoDB
// TODO: Prüfen des Auth Tokens ! -> Statt in der DB einfach hier über einen simplen Zwischenspeicher lösen -> bei späteren Lösungen vorsicht ! Mutex einfügen -> bei Javascript nicht nötig
// TODO: Benutzerverwaltung muss auth Token checken
// TODO: Für die Fahrzeugverwaltung fehlt noch die Standort Lokalisierung -> muss gemacht werden, weil es ja sein kann das eine solche Trip komponente abstürzt
// TODO: Wenn Buchung == Paid -> Gutschrift -> extra Call im Rechnungsverwaltungs Microservice

const express = require('express');
const bodyParser = require('body-parser');
var jsonBodyParser = bodyParser.json({ type: 'application/json' });
// Constants
const PORT = 8000;
const HOST = '0.0.0.0';
const mongoose = require('mongoose');

mongoose.Promise = global.Promise;
const dbconfig = {
    url: 'mongodb://router-01-buchungsverwaltung/backend',
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

// HTTP Requests für Rechnungsverwaltung und Payment
const http = require('http');

async function makePostRequest(hostname, port, path, bodyData) {
    // Hier gibt es übrigens ein Problem
    // Wie soll der Workflow aussehen wenn dies hier fehlschlägt ?
    // Stichwort Verteilte Transaktionen !!!

    return new Promise((resolve,reject) => {

        const options = {
            hostname: hostname,
            port: port,
            path: path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const postData = JSON.stringify(bodyData);

        const req = http.request({
            method: 'POST',
            ...options,
        }, res => {
            const chunks = [];
            res.on('data', data => chunks.push(data))
            res.on('end', () => {
                let resBody = Buffer.concat(chunks);
                switch(res.headers['content-type']) {
                    case 'application/json':
                        resBody = JSON.parse(resBody);
                        break;
                }
                resolve(resBody)
            })
        })
        req.on('error',reject);
        if(postData) {
            req.write(postData);
        }
        req.end();
    })
}

// App
const app = express();

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
        console.log(buchungen);
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
        let params = checkParams(req, res,["buchungsDatum", "loginName", "fahrzeugId", "fahrzeugTyp",
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
        console.log(aktuelleBuchungsNummer);
        let preisNetto = params.dauerDerBuchung * preisTabelle["Kombi"];


        // Schritt 1: Erstelle Buchung
        await buchungenDB.create({
            buchungsDatum: new Date(params.buchungsDatum).toISOString(),
            buchungsNummer: aktuelleBuchungsNummer,
            loginName: params.loginName,
            fahrzeugId: params.fahrzeugId,
            dauerDerBuchung: params.dauerDerBuchung,
            preisNetto: preisNetto,
            status: "created"
        });
        console.log("Buchung wurde erfolgreich erstellt");
        res.status(200).send(aktuelleBuchungsNummer.toString());

    } catch(err){
        console.log(err);
        res.status(401).send(err);
    }

});

app.post('/createInvoiceForNewBooking', [jsonBodyParser], async function (req, res) {
    try {
        let params = checkParams(req, res,["buchungsNummer", "buchungsDatum", "loginName", "fahrzeugId",
                                           "fahrzeugTyp", "fahrzeugModel", "dauerDerBuchung",
                                           "nachname", "vorname", "straße", "hausnummer", "plz"]);
        let preisNetto = preisTabelle[params.fahrzeugTyp];                                  

        let buchung = await buchungenDB.find({"buchungsNummer": params.buchungsNummer});

        if(buchung && buchung[0] && buchung[0].status == "created") {
            console.log("Erstelle Rechnung mithilfe dem MS Rechnungsverwaltung")
            // Schritt 2: Erstelle Rechnung
            let bodyData = {"loginName":params.loginName, "vorname": params.vorname,
                "nachname": params.nachname, "straße": params.straße,
                "hausnummer": params.hausnummer, "plz": params.plz,
                "fahrzeugId": params.fahrzeugId, "fahrzeugTyp": params.fahrzeugTyp,
                "fahrzeugModel": params.fahrzeugModel, "dauerDerBuchung": params.dauerDerBuchung,
                "preisNetto": preisNetto, "buchungsNummer": params.buchungsNummer};

            // TODO: dynamsich an Loadbalancer sollte die Anfrage geleitet werden ! -> Dieser Loadbalancer nimmt die Anfrage an und weißt sie dynamsich an die jeweilige Geschäftslogik Instanz
            await makePostRequest("rest-api-rechnungsverwaltung1", 8000, "/createInvoice", bodyData );
            buchung[0].status = "open";
            buchung[0].save();
            res.status(200).send("Rechung wurde erfolgreich erstellt");
        } else  {
            res.status(401).send("Rechnung konnte nicht erstellt werden, da keine Buchung vorhanden ist oder Buchung sich nicht im Status Created befindet");
        }
    } catch(err){
        console.log(err);
        res.status(401).send(err);
    }
});

app.post('/payOpenBooking/:buchungsNummer',  async function (req, res) {
    try {
        await mongoose.connect(dbconfig.url);
        let params = checkParams(req, res,["buchungsNummer"]);
        const buchung = await buchungenDB.find({"buchungsNummer": params.buchungsNummer});
        if(buchung && buchung[0] && buchung[0].status == "open"){
            // Schritt 3: Führe Bezahlung durch
            // TODO: Payment noch hier einfügen
            buchung[0].status = "paid";
            buchung[0].save();
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

app.post('/cancelBooking/:buchungsNummer',  async function (req, res) {
    try {
        await mongoose.connect(dbconfig.url);
        let params = checkParams(req, res,["buchungsNummer"]);

	    const buchung = await buchungenDB.find({"buchungsNummer": params.buchungsNummer});
	    if(buchung && buchung[0] && buchung[0].status != "started" && buchung[0].status != "finished"){

            if(buchung[0].status == "paid") {
                // TODO: Direkt eine Gutschrift als Rechnung erstellen und Payment in Auftrag geben -> ebenfalls schauen wie dann gutschrift überwiesen wird
            }

            buchung[0].status = "cancelled";
            buchung[0].save();
            res.status(200).send("Buchung wurde erfolgeich storniert");
        }  else  {
            res.status(401).send("Buchung konnte nicht storniert werden, da keine Buchung vorhanden ist oder Buchung sich nicht im Status Paid befindet");
        }
    } catch(err){
        console.log(err);
        res.status(401).send(err);
    }
});

app.post('/startTrip/:buchungsNummer',  async function (req, res) {
    try {
        await mongoose.connect(dbconfig.url);
        let params = checkParams(req, res,["buchungsNummer"]);
        const buchung = await buchungenDB.find({"buchungsNummer": params.buchungsNummer});
        console.log(buchung);
        if(buchung && buchung[0] && buchung[0].status == "paid") {
            buchung[0].status = "started";
            buchung[0].save();
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

app.post('/endTrip/:buchungsNummer',  async function (req, res) {
    try {
        await mongoose.connect(dbconfig.url);
        let params = checkParams(req, res,["buchungsNummer"]);
        const buchung = await buchungenDB.find({"buchungsNummer": params.buchungsNummer});
        if(buchung && buchung[0] && buchung[0].status == "started") {
            buchung[0].status = "finished";
            buchung[0].save();
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
