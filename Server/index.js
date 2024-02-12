/* 
  API file
  Exposes endpoints to get data from the MongoDB database 
*/

const { MongoClient } = require("mongodb");
var express = require("express");
var cors = require("cors");
var app = express();

// Use CORS library for all the routes
app.use(cors())

// URI
const uri = "mongodb://root:mongodb775@localhost:27017";

const client = new MongoClient(uri);

const database = client.db('megagoal');

app.listen(3150, () => {
  console.log("Server running on port 3150");
});

// Get all the matches
app.get("/matches", async (req, res, next) => {
  res.set('Content-Type', 'text/html');
  const matchesCollection = database.collection('matches');

  const cursor = await matchesCollection.find();

  let json = [];
  for await (const match of cursor) {
    json.push(match);
  }

  console.log("Matches Getted");
  res.send(JSON.stringify(json));
});

// Get all the leagues
app.get("/leagues", async (req, res, next) => {
  res.set('Content-Type', 'text/html');
  const leaguesCollection = database.collection('leagues');

  const cursor = await leaguesCollection.find();

  let json = [];
  for await (const match of cursor) {
    json.push(match);
  }

  console.log("Leagues Getted");
  res.send(JSON.stringify(json));
});

// Get leagues by country_name
app.get("/leagues/:country_name", async (req, res, next) => {
  var countryName = req.params.country_name;
  console.log("Getting leagues from " + countryName);

  const leaguesCollection = database.collection('leagues');

  const cursor = await leaguesCollection.find({ "country.name": countryName });

  let json = [];
  for await (const match of cursor) {
    json.push(match);
  }

  console.log("Leagues Getted from " + countryName);
  res.send(JSON.stringify(json));
});

// Get top leagues
app.get("/leaguestop/", async (req, res, next) => {
  console.log("Getting TOP leagues");

  const leaguesCollection = database.collection('leagues');

  const cursor = await leaguesCollection.find({
    $or: [
      { "league.id": 2 }, { "league.id": 3 }, { "league.id": 39 }, { "league.id": 140 }, { "league.id": 143 },
      { "league.id": 45 }, { "league.id": 141 }, { "league.id": 135 }, { "league.id": 78 }, { "league.id": 61 }
    ]
  });

  let json = [];
  for await (const match of cursor) {
    json.push(match);
  }

  res.send(JSON.stringify(json));
});

// Get leagues by league_id
app.get("/leagues/:country_name", async (req, res, next) => {
  var countryName = req.params.country_name;
  console.log("Getting leagues from " + countryName);

  const leaguesCollection = database.collection('leagues');

  const cursor = await leaguesCollection.find({ "country.name": countryName });

  let json = [];
  for await (const match of cursor) {
    json.push(match);
  }

  console.log("Leagues Getted from " + countryName);
  res.send(JSON.stringify(json));
});

// Get teams by league_id and year
app.get("/teams/", async (req, res, next) => {
  var league_id = req.query.league_id;
  var season = req.query.season;
  
  console.log("Getting teams from league " + league_id + " " + season);

  const leaguesCollection = database.collection('teams');
  const cursor = await leaguesCollection.find({  $and: [ {"seasons.league": league_id, "seasons.season": season } ] });

  let json = [];
  for await (const match of cursor) {
    json.push(match);
  }

  console.log("Teams Getted from league " + league_id + " " + season);
  res.send(JSON.stringify(json));
});