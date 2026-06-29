const { Client } = require("pg");

const client = new Client({
  host: "localhost",
  port: 5432,
  user: "postgres",
  password: "Tarun@0045",
  database: "railway_db",
});

client.connect()
  .then(() => {
    console.log("✅ Connected Successfully!");
    return client.end();
  })
  .catch(err => {
    console.error("❌ Connection Failed:");
    console.error(err);
  });