rs.initiate({_id: "shard-01-db-buchungsverwaltung",
    version: 1, members: [
        { _id: 0, host : "shard01buchungsverwaltung1:27017" },
        { _id: 1, host : "shard01buchungsverwaltung2:27017" },
        { _id: 2, host : "shard01buchungsverwaltung3:27017" }, ] });
