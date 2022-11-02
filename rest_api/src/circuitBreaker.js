const http = require("http");

class CircuitBreaker {
    // Open, Half, Closed
    CircuitBreakerState;
    successCount;
    failCount;

    // Timeout für den Reset von successCount und failCount im Status CLOSED
    timeoutReset;

    // Timeout für die Circuit Breaker soll bei 30 Sekunden liegen
    timeoutOpenState;

    // Verhältnis successCount und failCount:
    // Verhältnis wann Half State ausgelöst werden soll
    triggerHalfState;
    // Verhältnis wann Open State ausgelöst werden soll
    triggerOpenState;
    // Verhältnis wann Closed State ausgelöst werden soll
    triggerClosedState;

    timestamp;

    // Nur benötigt im Zustand HALF
    permittedRequestsInStateHalf;
    requestCount;

    constructor(timeoutReset, timeoutOpenState, triggerHalfState,
                triggerOpenState, permittedRequestsInStateHalf, triggerClosedState) {
        this.failCount = 0;
        this.successCount = 0;
        this.requestCount = 0;
        this.timeoutReset = timeoutReset;
        this.timeoutOpenState = timeoutOpenState;
        this.triggerHalfState = triggerHalfState;
        this.triggerOpenState = triggerOpenState;
        this.triggerClosedState = triggerClosedState;
        this.permittedRequestsInStateHalf = permittedRequestsInStateHalf;
        this.CircuitBreakerState = "CLOSED";
        this.timestamp = new Date();
    }


    checkReset(timeDiff) {
        console.log("Circuit Breaker: Prüfe ob Circuit Breaker Status resetet werden soll");
        if(timeDiff > this.timeoutReset &&
            (this.CircuitBreakerState == "CLOSED" || this.CircuitBreakerState == "HALF")) {
            console.log("Circuit Breaker: Kompletter Status wird zurückgesetzt!");
            this.failCount = 0;
            this.successCount = 0;
            this.timestamp = new Date();
            this.requestCount = 0;
        }
    }

    // hostname = Loadbalancer der an die entsprechenden Microservices innerhalb der Fachlichkeit weiterleiten
    async circuitBreakerPostRequest(hostname, port, path, bodyData) {

        // Schritt 1: Berechne Abstand zwischen gespeicherten timeStamp und aktuellen timeStamp in Sekunden
         let timeDiff = ( new Date() - this.timestamp) / 1000;

         // Schritt 2: Wenn der Timestamp älter ist als 5 Minuten -> setze alles auf Anfang
         this.checkReset(timeDiff);

         //Schritt 3: Prüfe ob timeout für Zustand Open abgelaufen ist
        if(this.CircuitBreakerState == "OPEN") {

            if(timeDiff >= this.timeoutOpenState) {
                // Wenn timeout abgelaufen setze den Circuit Breaker wieder auf HALF
                console.log("Circuit Breaker: Wechsel Circuit Breaker Status von OPEN auf HALF");
                this.CircuitBreakerState = "HALF";

            } else {
                console.log("Circuit Breaker: immer noch auf Zustand OPEN");
                console.log("Circuit Breaker ist "+ (this.timeoutOpenState - timeDiff)  + " noch offen");
                throw "Request fehlgeschlagen: Circuit Breaker ist im Zustand offen. Keine Requests zu Service Benutzerverwaltung erlaubt";
            }

        }

        // Schritt 4: Prüfe ob Circuit Breaker im Zustand HALF ist -> Wenn Ja dann prüfe ob das Limit an Requests erreicht ist
        if(this.CircuitBreakerState == "HALF" && this.requestCount > this.permittedRequestsInStateHalf) {
            console.log("Request fehlgeschlagen: Circuit Breaker ist auf Zustand HALF aber der erlaubte RequestCount ist erreicht")
            throw "Request fehlgeschlagen: Circuit Breaker ist auf Zustand HALF aber der erlaubte RequestCount ist erreicht";
        }

        // Schritt 5: Prüfe ob wieder auf Closed gesetzt werden kann
        if(this.CircuitBreakerState == "HALF" && (this.successCount - this.failCount > this.triggerClosedState)) {
            this.checkReset(timeDiff)
            console.log("Circuit Breaker: Wechsel Circuit Breaker Status von HALF auf CLOSED")
            this.CircuitBreakerState = "CLOSED";
        }


        try {
            // Schritt 6: Falls die Bedingungen von Schritt 1 - Schritt 4 nicht erfüllt sind -> führe den Request durch
            console.log("Circuit Breaker: Führe HTTP Request im Circuit Breaker durch");
            let result = await this.makePostRequest(hostname, port, path, bodyData);
            this.successCount++;
            console.log("Circuit Breaker: Request war erfolgreich. Success Count ist jetzt bei " + this.successCount);
            return result;
        } catch (err) {
            this.failCount++;

            // Schritt 7: Prüfe das Verhältnis zwischen successCount und failCount
            // Schritt 7b: Prüfe ob auf HALF gesetzt werden muss
            if(this.CircuitBreakerState == "CLOSED" && this.successCount - this.failCount < this.triggerHalfState) {
                console.log("Circuit Breaker: Wechsel Circuit Breaker Status von CLOSED auf HALF");
                this.CircuitBreakerState = "HALF";
                this.timestamp = new Date();
            }

            // Schritt 7c: Prüfe ob auf Open gesetzt werden muss
            if(this.CircuitBreakerState == "HALF" && (this.successCount - this.failCount < this.triggerOpenState)) {
                console.log("Circuit Breaker: Wechsel Circuit Breaker Status von HALF auf OPEN");
                this.CircuitBreakerState = "OPEN";
                this.timestamp = new Date();
            }
            console.log("Circuit Breaker: Request ist fehlgeschlagen. Fail Count ist jetzt bei " + this.failCount);
            throw err;
        }
    }

    // Gibt entweder ein richtiges Ergebnis zurück
    // oder Boolean False falls http Code nicht 200
    // oder schmeißt eine Exception, falls Timeout beispielsweise erreicht
    async makePostRequest(hostname, port, path, bodyData) {

        // TODO: HIER NOCH EINEN TIMEOUT FÜR DEN REQUEST SETZEN

        // Wenn auf HALF gesetzt dann zähle die Anzahl der Requests mit
        // Deshalb so gelöst, da requestCount nur im Zustand HALF benötigt wird
        if(this.CircuitBreakerState == "HALF") {
            this.requestCount++;
        }

        return new Promise((resolve,reject) => {

            const options = {
                hostname: hostname,
                port: port,
                path: path,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 3000
            };

            const postData = JSON.stringify(bodyData);

            const req = http.request({
                ...options,
            }, res => {
                const chunks = [];
                res.on('data', data => chunks.push(data))
                res.on('end', () => {
                    let resBody = Buffer.concat(chunks);

                    if(res.statusCode != 200 ) {
                        console.log("Circuit Breaker: HTTP Status Code ist " +  res.statusCode);
                        resolve(false);
                    }

                    switch(res.headers['content-type']) {
                        // TODO: Was tun wenn der reponse text ist ?
                        case 'application/json; charset=utf-8':
                            console.log("Circuit Breaker: Parse JSON Response");
                            resBody = JSON.parse(resBody);
                            break;
                    }
                    console.log("Circuit Breaker: Post Request war erfolgreich!");
                    resolve(resBody);
                })
            })

            req.on('error',reject);
            if(postData) {
                req.write(postData);
            }
            req.end();
        })
    }

}

module.exports = CircuitBreaker