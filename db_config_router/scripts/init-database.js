sh.enableSharding('backend');
db.createCollection('backend.bookings');
db.invoices.createIndex( { loginName: "text" });
db.invoices.createIndex( { "buchungsNummer": 1 }, { unique: true } );
db.adminCommand( { shardCollection: 'backend.bookings', key: { 'loginName': 'hashed' } } );