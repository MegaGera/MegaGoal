# From the base image node
# fastmcp → undici 7 needs Node 20.18+ (global File)
FROM node:20-alpine
WORKDIR /usr/src/app

# Copy all the files from your file system to the container file system
COPY package*.json ./

# Install all dependencies
RUN npm install
RUN npm install supervisor -g

# Copy other files as well
COPY . .

# Expose API (Express) and MCP (FastMCP httpStream, default MCP_PORT=3151)
EXPOSE 3150 3151

# Command to execute when the image is instantiated
CMD ["npm","start"]