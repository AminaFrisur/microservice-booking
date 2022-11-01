import http from "http";

class CircuitBreaker {

    http = require('http');

    CircuitBreakerState;
    successCount;
    failCount;

    // Timeout für den Reset von successCount und failCount im Status CLOSED
    timeoutReset;

    // Timeout für die Circuit Breaker soll bei 30 Sekunden liegen
    timeoutOpenState;

    // Verhältnis successCount und failCount
    // Wenn -1 dann wechsel in HALF
    triggerHalfState;
    // Wenn -10 dann wechsel in OPEN
    triggerOpenState;
    // Wenn 8 dann wechsel in Status Closed
    triggerClosedState;

    timestamp;

    // Nur benötigt im Zustand HALF
    permittedRequestsInStateHalf;
    requestCount;

    // Meine Implementierung: Setze nach Fünf Minuten failCount und successCount auf 0

    constructor() {
        this.failCount = 0;
        this.successCount = 0;
        this.requestCount = 0;
        this.timeoutReset = 150;
        this.timeoutOpenState = 30;
        this.triggerHalfState = 0;
        this.triggerOpenState = -15;
        this.triggerClosedState = 8;
        this.permittedRequestsInStateHalf = 15;
        this.CircuitBreakerState = "CLOSED";
        this.timestamp = new Date();
    }

    // Falls man den Circuit Breaker selbst konfigurieren möchte
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
        if(timeDiff > this.timeoutReset &&
            (this.CircuitBreakerState == "CLOSED" || this.CircuitBreakerState == "HALF")) {
            this.failCount = 0;
            this.successCount = 0;
            this.timestamp = new Date();
            this.requestCount = 0;
        }
    }

    // hostname = Loadbalancer der an die entsprechenden Microservices innerhalb der Fachlichkeit weiterleiten
    async wrapPostRequest(hostname, port, path, bodyData) {

        // Schritt 1: Berechne Abstand zwischen gespeicherten timeStamp und aktuellen timeStamp in Sekunden
         let timeDiff = (this.timestamp - new Date()) / 1000;

         // Schritt 2: Wenn der Timestamp älter ist als 5 Minuten -> setze alles auf Anfang
         this.checkReset(timeDiff);

         //Schritt 3: Prüfe ob timeout für Zustand Open abgelaufen ist
        if(this.CircuitBreakerState == "OPEN") {

            if(timeDiff >= this.timeoutOpenState) {
                // Wenn timeout abgelaufen setze den Circuit Breaker wieder auf HALF
                this.CircuitBreakerState = "HALF";

            } else {
                return {"result": "Circuit Breaker is Open", "success": false};
            }

        }

        // Schritt 4: Prüfe ob Circuit Breaker im Zustand HALF ist -> Wenn Ja dann prüfe ob das Limit an Requests erreicht ist
        if(this.CircuitBreakerState == "HALF" && this.requestCount > this.permittedRequestsInStateHalf) {
            return {"result": "CircuitBreaker is on state HALF and permitted Requests are reached!", "success": false};
        }

        // Schritt 5: Prüfe ob wieder auf Closed gesetzt werden kann
        if(this.CircuitBreakerState == "HALF" && (this.successCount - this.failCount >= this.triggerClosedState)) {
            this.checkReset(timeDiff)
            this.CircuitBreakerState = "CLOSED";
        }


        try {
            // Schritt 6: Falls die Bedingungen von Schritt 1 - Schritt 4 nicht erfüllt sind -> führe den Request durch
            let result = await this.makePostRequest(hostname, port, path, bodyData);
            this.successCount++;
            return {"result": result, "success": true};
        } catch (e) {
            this.failCount++;

            // Schritt 7: Prüfe das Verhältnis zwischen successCount und failCount
            // Schritt 7a: Prüfe ob auf HALF gesetzt werden muss
            if(this.successCount - this.failCount < this.triggerHalfState) {
                this.CircuitBreakerState = "HALF";
                this.timestamp = new Date();
            }

            // Schritt 7b: Prüfe ob auf Open gesetzt werden muss
            if(this.successCount - this.failCount < this.triggerOpenState) {
                this.CircuitBreakerState = "OPEN";
                this.timestamp = new Date();
            }

            return {"result": e, "success": false};
        }
    }


    async makePostRequest(hostname, port, path, bodyData) {

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
                    // TODO: DAS FUNKTIONIERT HIER NOCH NICHT
                    // WARUM AUCH IMMER !
                    switch(res.headers['content-type']) {
                        case 'application/json':
                            resBody = JSON.parse(resBody);
                            console.log("glkedrgjkjrde");
                            console.log(resBody);
                            break;
                    }
                    console.log("Post Request war erfolgreich!");
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