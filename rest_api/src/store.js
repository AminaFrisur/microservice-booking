class UserCache {
    cachedUser;
    constructor() {
        this.cachedUser = {};
    }

    updateOrInsertCachedUser(login_name, auth_token, auth_token_timestamp, isAdmin) {
        if(this.cachedUser[login_name]) {
            // update Nutzer
            this.cachedUser[login_name].auth_token = auth_token;
            this.cachedUser[login_name].auth_token_timestamp = auth_token_timestamp;
        } else {
            // Füge User neu im Cache hinzu
            this.cachedUser[login_name] = {"auth_token": auth_token, "auth_token_timestamp": auth_token_timestamp, "isAdmin": isAdmin};
        }

    }

    checkToken(login_name, auth_token, isAdmin) {
        let user = this.cachedUser[login_name];
        // User wurde gefunden, prüfe nun token und Timestamp vom token
        if(user) {
            if(auth_token != user.auth_token) {console.log("Auth Token ist falsch"); return false};
            if(user.isAdmin != true && isAdmin == true) {console.log("isAdmin ist false"); return false};
            let currentTimeStamp = new Date();
            let authTokenTimestamp = new Date(user.auth_token_timestamp);
            // Rechne von Millisekunden auf Stunden um
            let timeDiff = (currentTimeStamp - authTokenTimestamp) / 3600000;
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