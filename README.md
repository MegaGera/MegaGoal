# MegaGoal

Welcome to MegaGoal application.

MegaGoal allows you to get information of football teams and save your favourite matches. 

*In development*

## Project composition

There are four Services in this application:

- **WebApp**: Web application built with [Angular v17](https://angular.io/). With the application you can navigate through the different football leagues and teams and see their information. It is the entry point for the user. More information and source code under the `WebApp` folder.
- **API Server**: API Server built in JavaScript with `express.js` to access to the resources of the database from the WebApp client. More information and source code under the `Server` folder.
- **MondoDB Database**: Database that stores document information of the football leagues, teams and matches. It is deployed by a docker container in a docker-compose file. More information under the `MongoDB` section of this README.
- **Data Parser Service**: Jupyter Notebook file that includes python functions to get the football data needed by the application, parse, and store in the MongoDB database with the proper structure. The data is retrieved from the open API [API-FOOTBALL](https://www.api-football.com/). More information and source code in the `data_paser.ipynb` file.

## MongoDB Database

The MongoDB is built and launched within a docker container with the `mongo` image. The configuration of the container is in the `docker-compose.yaml` file. It runs an instance of a MongoDB database accessible in the port 27017.

For an easier visualization of the data stored in the database, there is another optional docker container that can be launched with an image of `mongo-express`, a MongoDB database admin interface. The configuration of this container is in the file `docker-compose_mongo-express.yaml`. The application is open in the port 8081 and accesible in the url: `http://localhost:8081/`.

## Run the application

You can run directly the `WebApp` application to have access to the user interface, but it will be empty. To have data to see in this web application, it's neccesary to run the `MongoDB` and the `API Server` applications, and execute the functions that you prefer in the `data_parser.ipynb` notebook to fill the database. For that, you will need a key to use the [API-FOOTBALL](https://www.api-football.com/), you can get access from their website or with the [rapidapi](https://rapidapi.com/api-sports/api/api-football/) provider.

The information to run the `WebApp` and ` API Server` applications is in under their folders of this repository. 