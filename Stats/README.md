# MegaGoal - Stats

Stats microservice built with [Django](https://www.djangoproject.com/) (Python) for *MegaGoal*. 

## Table of Contents

- [Service Description](#service-description)
  - [Features](#features)
- [Project Composition](#project-composition)
- [Dependencies](#dependencies)
- [Environment Variables](#environment-variables)
- [Development Server](#development-server)
- [Build & Deploy](#build--deploy)

## Service Description

Generate statistics of the matches and leagues viewed by an user to be displayed in the WebApp.

It provides an API  Based on the search of a user data of the viewed matches, *Stats* service generates stats

The validation of the user who does the request is needed by the *MegaAuth* microservice. This is done by forwarding the JWT token stored in the user's browser to *MegaAuth*. 

Use of other **services**: It is used by *WebApp* and it uses *Database*.

It's deployed by a Docker container.

### Features

- Get total of matches viewed and goals from different teams by a user search with: team selection, league and season.
- Get leagues viewed by a user.

## Project Composition

This project contains [mysite](mysite) folder where the initial configuration is set, including a middleware configuration for authentication with the *MegaAuth* service. In the [api](api) folder are saved the functions that provides the functionality of this Stats microservice.

The API is accesible by HTTPS Requests.

## Dependencies

The dependencies and the scripts are defined in the file `requeriments.txt`:

- Django>=4.0,<5.0            # The core Django framework
- djangorestframework         # Django REST Framework for building APIs
- pymongo                     # MongoDB driver for - Python
- pandas                      # Pandas for data - manipulation and analysis
- python-dotenv               # For loading environment variables from .env files
- django-cors-headers         # For http headers
- gunicorn                    # For deploying Django applications
- requests                    # Handle HTTP requests

To install the dependencies run the command: `pip install -r requirements.txt`.

## Environment Variables

In: `.env.development` || `.env.production`

```javascript
MONGO_DB_NAME=string
MONGO_DB_USER=string
MONGO_DB_PASSWORD=string
MONGO_DB_HOST=string
MONGO_DB_PORT=number
VALIDATE_URI=string
USERNAME_DEV=string
```

## Development Server

First is recomendable create a virtual environment running:

`python -m venv venv`

Then access to the venv and install the dependencies:

`source venv/bin/activate`

`pip install -r requirements.txt`

Once everything is installed, run:

`python manage.py runserver`

## Build & Deploy

[`Dockerfile`](Dockerfile) file builds the app for production and generates de Docker container.

[`docker-compose.yaml`](docker-compose.yaml) file manages the image and handle it easily within the *Mega* network.