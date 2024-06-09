/* 
  API file
  Exposes endpoints to get data from the MongoDB database 
*/

const { MongoClient } = require("mongodb");
var express = require("express");
var cors = require("cors");
var app = express();

// Parses incoming requests with JSON payloads 
app.use(express.json())

// Use CORS library for all the routes
app.use(cors())

// URI
const uri = "mongodb://root:mongodb775@localhost:27017";

const client = new MongoClient(uri);

const database = client.db('megagoal');

app.listen(3150, () => {
  console.log("Server running on port 3150");
});

// Get matches
app.get("/matches", async (req, res, next) => {
  res.set('Content-Type', 'text/html');
  var {team_id, season} = req.query;

  const filters = [];
  if (team_id) {
    filters.push({
        $or: [
            { 'teams.home.id': +team_id },
            { 'teams.away.id': +team_id }
        ]
    });
  }
  if (season) filters.push({ 'league.season': +season });

  const query = filters.length > 0 ? { $and: filters } : {};
  const matchesCollection = database.collection('matches');
  const json = await matchesCollection.find(query).toArray();

  console.log("Matches Getted");
  res.send(JSON.stringify(json));
});

// Get all the leagues
app.get("/leagues", async (req, res, next) => {
  res.set('Content-Type', 'text/html');
  const leaguesCollection = database.collection('leagues');

  const json = await leaguesCollection.find().toArray();

  console.log("Leagues Getted");
  res.send(JSON.stringify(json));
});

// Get leagues by country_name
app.get("/leagues/:country_name", async (req, res, next) => {
  var countryName = req.params.country_name;
  console.log("Getting leagues from " + countryName);

  const leaguesCollection = database.collection('leagues');

  const json = await leaguesCollection.find({ "country.name": countryName }).toArray();

  console.log("Leagues Getted from " + countryName);
  res.send(JSON.stringify(json));
});

// Get top leagues
app.get("/leaguestop/", async (req, res, next) => {
  console.log("Getting TOP leagues");

  const leaguesCollection = database.collection('leagues');

  const json = await leaguesCollection.find({
    $or: [
      { "league.id": 2 }, { "league.id": 3 }, { "league.id": 39 }, { "league.id": 140 }, { "league.id": 143 },
      { "league.id": 45 }, { "league.id": 141 }, { "league.id": 135 }, { "league.id": 78 }, { "league.id": 61 },
      { "league.id": 556 } , { "league.id": 531 } , { "league.id": 848 }, { "league.id": 4 }, { "league.id": 1 }
    ]
  }).toArray();

  res.send(JSON.stringify(json));
});

// Get leagues by league_id
app.get("/leagues/:country_name", async (req, res, next) => {
  var countryName = req.params.country_name;
  console.log("Getting leagues from " + countryName);

  const leaguesCollection = database.collection('leagues');

  const json = await leaguesCollection.find({ "country.name": countryName }).toArray();

  console.log("Leagues Getted from " + countryName);
  res.send(JSON.stringify(json));
});

// Get teams by league_id and year
app.get("/team/", async (req, res, next) => {
  var league_id = req.query.league_id;
  var season = req.query.season;
  
  console.log("Getting teams from league " + league_id + " " + season);

  const teamsCollection = database.collection('teams');
  const json = await teamsCollection.find({
    "seasons": 
      { "$elemMatch": { "league": league_id, "season": season } } 
  }).toArray();

  console.log("Teams Getted from league " + league_id + " " + season);
  res.send(JSON.stringify(json));
});

// Get a team by its id
app.get("/team/:team_id", async (req, res, next) => {
  var team_id = req.params.team_id;
  
  console.log("Getting the team " + team_id);

  const teamsCollection = database.collection('teams');
  const match = await teamsCollection.findOne({ "team.id": +team_id }) || undefined;

  console.log("Team getted " + team_id);
  res.send(JSON.stringify(match));
});


// Get real matches by team ID and season
app.get("/real_matches/", async (req, res, next) => {
  var team_id = req.query.team_id;
  var season = req.query.season;
  console.log("Getting real matches from team " + team_id + " and season " + season);

  const realMatchesCollection = database.collection('real_matches');

  const json = await realMatchesCollection.find({
    $and:[
      {$or: [ 
        { "teams.home.id": +team_id } ,
        { "teams.away.id": +team_id }]},
      {"league.season": +season}]
  }).toArray();

  console.log("Real matches getted from team " + team_id + " and season " + season);
  res.send(JSON.stringify(json));
});

// Post create a Match
app.post("/matches/", async (req, res, next) => {
  var match = req.body;

  const realMatchesCollection = database.collection('matches');
  let matchInserted = realMatchesCollection.insertOne(match);

  console.log("Match insertes for fixture " + match.fixture.id);
  res.send(JSON.stringify(matchInserted));
});

// Get locations
app.get("/location/", async (req, res, next) => {
  console.log("Getting locations");

  const locationsCollection = database.collection('locations');

  const json = await locationsCollection.find().toArray();
  
  console.log("Locations getted");
  res.send(JSON.stringify(json));
});

// Change location to a match
app.post("/location/set_location", async (req, res, next) => {
  var fixtureId = req.body.fixtureId;
  var location = req.body.location;
  console.log("Changing match " + fixtureId + " to location " + location);

  const locationsCollection = database.collection('matches');

  const filter = { "fixture.id": +fixtureId };
  const update = { $set: { "location": location} };

  const result = await locationsCollection.updateOne(filter, update);

  if (result == 1) {
    console.log("Location updated");
    res.sendStatus(200);
  } else {
    console.log("Match not found");
    res.sendStatus(400);
  }
  
});