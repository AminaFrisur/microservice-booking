class UserCache {
    cachedUser;
    timestamp;
    cacheTime;
    maxSize;

    // TODO: nicht das komplette Date speichern
    // TODO: PROBLEM FALL: Was passiert wenn altes Token noch mitgesendet wird ->
    // TODO: Wenn Benutzerverwaltung ein neues Token für den User erstellt, muss es irgendwie auch die Booking Komponente benachrichtigen
    // TODO: DIe weiß sonst nicht ob das Token überhaupt noch valide ist
    // TODO: Lösung: Registriere alle Aufrufe von Buchung auf Benutzerverwaltung
    // TODO: Falls sich bei den Usern dort etwas ändert -> benachrichtige den Booking Service
    // Viel zu speicher Intensiv

    // Cache Strategie:
    // wenn checkToken erfolgreich -> speichere Nutzer, Token, Token Timestamp in cachedUser
    // Problem: Irgendwann läuft der Cache voll bzw. der Service ist mit der Datenmenge einfach überlastet
    // Meine Cache Strategie:
    // Jeder Cache Eintrag hat einen Timestamp
    // Bei jeder Nutzung wird dieser aktualisiert
    // Wenn der Timestamp dann älter ist als 5 Minuten -> schmeiße den Eintrag raus
    // Speicherung des Caches: nach Login Name in geordneter Reihenfolge
    // Ich nutze die Methode slice von Javascript array
    // diese macht eine shallow Copy : Die Referenzen bleiben gleich

    // cacheTime immer in Millisekunden angeben
    constructor(cacheTime, maxSize) {
        this.cachedUser = new Array();
        this.timestamp = new Date();
        this.cacheTime = cacheTime;
        this.maxSize = maxSize;
    }

    clearCache() {
        // Map speichert in Insertion Order
        console.log("clear cache");
        if (this.cachedUser.size > this.maxSize) {
            // kompletter reset des caches
            // sollte aber eigentlich nicht passieren
            this.cachedUser = [];
            return;
        }

        let tempIndex = this.cachedUser.length
        let check = true;

        while (check) {
            tempIndex = tempIndex / 2;
            console.log("TempIndex ist " + tempIndex);
            // Falls im Cache nur ein Element ist
            if (tempIndex >= 1) {

                // Array ist größer als 1 also mache teile und hersche
                let user = this.cachedUser[tempIndex - 1];
                let timeDiff = user.cachedUser - new Date();

                // Wenn für den Eintrag die Cache Time erreicht ist -> lösche die hälfte vom Part des Arrays was betrachtet wird
                // Damit sind dann nicht alle alten Cache einträge gelöscht -> aber das clearen vom Cache sollte schnell gehen
                if (timeDiff >= this.cacheTime) {
                    console.log("Clear Cache");
                    this.cachedUser = [
                        ...this.cachedUser.slice(tempIndex)
                    ]
                    check = false;
                }

                // Wenn timeDiff noch stimmt dann mache weiter

            } else {

                // auch wenn das eine Element im Array ein alter Eintrag ist
                // kann dies vernachlässigt werden bzw. ist nicht so wichtig
                console.log("nichts zu clearen")
                check = false;
            }


        }
    }


    getUserIndex(loginName) {
        // an dieser Stelle erst den Cache leeren
        // wenn clearCache an andere Stelle aufgerufen wird, dann stimmt der Index nicht mehr
        this.clearCache();
        let finalIndex = -1;
        // O(N) -> Aufwand bei jedem cache durchlauf
        for (var i = 0; i < this.cachedUser.length; i++) {
            console.log(this.cachedUser[i].loginName);
            if(this.cachedUser[i].loginName == loginName) {
                finalIndex = i;
                // Auch beim Suchen eines Users -> Timestamp für Cache Eintrag aktualisieren
                console.log("Update Timestamp vom Cache Eintrag");
                this.cachedUser[i].cacheTimestamp = new Date();
                break;
            }
        }
        console.log("User Index ist:" + finalIndex);
        return finalIndex;
    }


    updateOrInsertCachedUser(index, loginName, authToken, authTokenTimestamp, isAdmin) {
        if(index >= 0 ) {
            // update Nutzer
            console.log("mache ein Update zum User");
            let user = this.cachedUser[index];
            user.authToken = authToken;
            user.authTokenTimestamp = authTokenTimestamp;
            user.cacheTimestamp = new Date();
            this.cachedUser = [
                ...this.cachedUser.slice(0, index),
                ...this.cachedUser.slice(index + 1)
            ]
            console.log("ARRAY UPDATE")
            console.log(this.cachedUser);
            this.cachedUser.push(user);
            console.log(this.cachedUser);
        } else {
            // Füge User neu im Cache hinzu, da nicht im cache vorhanden
            console.log("Füge neuen Eintrag in Cache hinzu");
            this.cachedUser.push({"loginName": loginName,"authToken": authToken, "authTokenTimestamp": authTokenTimestamp, "isAdmin": isAdmin, "cacheTimestamp": new Date()});
            console.log(this.cachedUser);
        }
    }

    // prüfe ob das Token noch im Gültigkeitszeitraum liegt
    // wenn nicht dann muss ein neues Token vom Microservice Benutzerverwaltung angefordert werden
    checkToken(index, authToken, isAdmin) {
        // User wurde gefunden, prüfe nun token und Timestamp vom token
        if(index >= 0) {
            if(authToken != this.cachedUser[index].authToken) {console.log("Auth Token ist falsch"); return false};
            if(this.cachedUser[index].isAdmin != true && isAdmin == true) {console.log("isAdmin ist false"); return false};

            // Rechne von Millisekunden auf Stunden um
            let timeDiff = (new Date() - this.cachedUser[index].authTokenTimestamp) / 3600000;
            // Wenn token älter ist als 24 Stunden
            if(timeDiff > 24) {
                return false;
            }
            return true;
        } else {
            return false;
        }
    }

}

module.exports = UserCache