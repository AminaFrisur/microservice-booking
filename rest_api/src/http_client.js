const http = require("http");
module.exports = function() {
    const http = require('http');
    var module = {};

    // TODO: Hier dann den Key Value Store implementieren

    module.makePostRequest = async function (hostname, port, path, bodyData) {
        // TODO: Implementierung eines Circuit Breakers

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


    return module;
}