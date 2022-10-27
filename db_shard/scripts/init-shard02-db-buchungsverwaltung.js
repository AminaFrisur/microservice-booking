rs.initiate({_id: "shard-02-db-buchungsverwaltung",
    version: 1, members: [
        { _id: 0, host : "shard-02-buchungsverwaltung1:27017" },
        { _id: 1, host : "shard-02-buchungsverwaltung2:27017" },
        { _id: 2, host : "shard-02-buchungsverwaltung3:27017" }, ] });