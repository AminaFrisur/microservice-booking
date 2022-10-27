rs.initiate({_id: "buchungsverwaltung-mongodb-config-server", configsvr: true,
    version: 1, members: [
        { _id: 0, host : 'db-buchung-config1:27017' },
        { _id: 1, host : 'db-buchung-config2:27017' },
        { _id: 2, host : 'db-buchung-config3:27017' }
    ] })