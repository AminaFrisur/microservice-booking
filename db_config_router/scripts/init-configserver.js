rs.initiate({_id: "buchungsverwaltung-mongodb-config-server", configsvr: true,
    version: 1, members: [
        { _id: 0, host : 'dbBuchungConfig1:27017' },
        { _id: 1, host : 'dbBuchungConfig2:27017' },
        { _id: 2, host : 'dbBuchungConfig3:27017' }
    ] })