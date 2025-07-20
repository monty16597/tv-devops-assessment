FROM node:24-alpine AS builder
LABEL maintainer="Manjeetsinh Alonja <alonjamohit77@gmail.com>"
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npx tsc --project tsconfig.json

FROM node:24-alpine
LABEL maintainer="Manjeetsinh Alonja <alonjamohit77@gmail.com>"
WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000
CMD ["node", "dist/server.js"]