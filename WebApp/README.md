# MegaGoal - WebApp

WebApp microservice built with [Angular v17](https://angular.io/) (TypeScript) for *MegaGoal*.

## Table of Contents

- [Service Description](#service-description)
  - [Features](#features)
- [Project Composition](#project-composition)
- [Dependencies](#dependencies)
- [Environment Variables](#environment-variables)
- [Development Server](#development-server)
- [Build & Deploy](#build--deploy)

## Service Description

Web Application microservice for *MegaGoal* where mark the viewed football matches, navigate through the different football leagues and teams and see their information and matches played for each season in different competitions.

UI responsive design. The design is adapted to be opened with big screens and mobile screens.

All the images are from *MegaMedia* service.

The application is already deployed and available at: [https://megagoal.megagera.com](https://megagoal.megagera.com)

The deployment in production is done with [Nginx](https://nginx.org/en/) and [Docker](https://www.docker.com/).

### Features

Refer to [Features section in general README.md](../README.md#features) of the *MegaGoal* service.

## Project composition

This project contains: **Components**, **Services** and **Models**.

- **Components**:
  - The components render the view of the web application.
  - Standalone components where each one imports the neccesary modules and services.
  - App Component is the parent component of the web application.
  - With the Router Module is possible to navigate through the different components of the application.

- **Services**:
  - **Megagoal** Service provides the connection to the API where the data is stored. Is imported directly in the App Component to create just one instance of the Service and mantain the state across the components.
  - **Images** Service get the source of an image. It's only imported in the components where it's necessary.

- **Models**:
  - Validate the data models of the data retrieved from the API.

The source code is under the src folder.

## Dependencies

The dependencies and the scripts are defined in the file [`package.json`](package.json) and managed with [npm](https://www.npmjs.com/).

To install the dependencies run the command: `npm install`.

## Environment Variables

In: `src/app/environments/environment.ts` || `src/app/environments/environment.development.ts`

```javascript
export const environment = {
    production: boolean,
    serverURL: string,
    serverStatsURL: string,
    serverImagesURL: string,
};
```

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The application will automatically reload if detects any change of the source files.

## Build & Deploy

[`nginx.conf`](nginx.conf) generates the server to deploy the app in production.

[`Dockerfile`](Dockerfile) file builds the app for production and generates de Docker container.

[`docker-compose.yml`](docker-compose.yml) file manages the image and handle it easily within the *Mega* network.