FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY . .

EXPOSE 4000

USER node

CMD ["node", "src/server.js"]
