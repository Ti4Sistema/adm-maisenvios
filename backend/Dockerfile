FROM node:24-alpine AS build
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile
COPY . .
RUN yarn build

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production && yarn cache clean
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3100
CMD ["sh", "-c", "node node_modules/typeorm/cli.js -d dist/database/data-source.js migration:run && node dist/main.js"]
