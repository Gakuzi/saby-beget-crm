FROM node:20-alpine
WORKDIR /app

# Install build tools for sqlite3 if needed (since current app uses sqlite locally)
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm install --production

COPY . .

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000
CMD ["node", "server.js"]
