## Build #########################################
FROM node:lts as build

WORKDIR /app
COPY package*.json /app/
RUN npm install
COPY ./ /app
RUN npm run build:prod

## Deploy #########################################
# Use a stable nginx image
FROM nginx:stable-alpine

# Copy what we've installed/built from build
COPY --from=build /app/dist/web-app/browser /usr/share/nginx/html
COPY ./nginx.conf /etc/nginx/conf.d/default.conf