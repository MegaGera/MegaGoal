# MegaGoal - Server

API Server built with [Node.js](https://nodejs.org/en) and [Express.js](https://expressjs.com/) (JavaScript) for *MegaGoal*.

## Table of Contents

- [Service Description](#service-description)
- [Project Composition](#project-composition)
- [Dependencies](#dependencies)
- [Environment Variables](#environment-variables)
- [Development Server](#development-server)
- [Build & Deploy](#build--deploy)

## Service Description

API Server to load the data required by *MegaGoal WebApp*. It searchs the leagues, teams, matches, locations and viewed matches of the user.

API accesible by HTTP requests, protected by CORS and validation of the user is done forwarding the JWT to *MegaAuth*. Some routes are Admin protected and also validated.

Use of other **services**: It is used by *WebApp* and it uses *Database*. It's also used by *MegaMedia* to load the metadata of the static files of the images of the leagues and teams.

It's deployed by a Docker container.

## Project composition

This project contains an [`index.js`](index.js) file that creates the API with `express.js` to connect with the MongoDB database.

The folder [`routes`](routes) route the traffic to the different [`controllers`](controllers) where the Server functions are stored.

## Dependencies

The dependencies and the scripts are defined in the file `package.json` and managed with [npm](https://www.npmjs.com/).

To install the dependencies run the command: `npm install`.

## Environment Variables

In: `.env.development` || `.env.production`

```javascript
MONGO_URI=string
DB_NAME=string
VALIDATE_URI=string
VALIDATE_URI_ADMIN=string
PORT=number
WEB_USERNAME=string
```

## Development server

Run `npm start` for a dev server. The API will be accesible in `http://localhost:3150/`.

## Build & Deploy

[`Dockerfile`](Dockerfile) file builds the app for production and generates de Docker container.

[`docker-compose.yml`](docker-compose.yml) file manages the image and handle it easily within the *Mega* network.