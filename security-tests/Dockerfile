FROM node:20-alpine

WORKDIR /app

# Dependencies installieren
COPY package*.json ./
RUN npm install

# Source kopieren
COPY . .

# Tests ausführen
CMD ["npm", "test"]
