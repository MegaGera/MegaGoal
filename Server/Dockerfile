# From the base image node
FROM node:hydrogen-alpine3.20
WORKDIR /usr/src/app

# Copy all the files from your file system to the container file system
COPY package*.json ./

# Install all dependencies
RUN npm install
RUN npm install supervisor -g

# Copy other files as well
COPY . .

# Expose the port
EXPOSE 3150

# Command to execute when the image is instantiated
CMD ["npm","start"]