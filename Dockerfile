FROM node:20-alpine

WORKDIR /app

# Install server deps
COPY server/package.json ./server/package.json
RUN cd server && npm install --omit=dev

# Copy entire app (frontend static + server)
COPY . .

EXPOSE 8080
CMD ["node", "server/server.js"]