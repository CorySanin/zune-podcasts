FROM node:lts-alpine3.18 AS install

WORKDIR /usr/src/app

COPY package*.json ./

ENV NPM_CONFIG_LOGLEVEL warn
RUN npm ci --only=production || (\
  apk add --no-cache make g++ && \
  apk add --no-cache vips-cpp vips-dev --repository https://dl-cdn.alpinelinux.org/alpine/edge/community/ && \
  npm install -g node-gyp && \
  npm ci --only=production --build-from-source )

COPY . .

FROM node:lts-alpine3.18 AS deploy

HEALTHCHECK  --timeout=3s \
  CMD curl --fail http://localhost:8081/healthcheck || exit 1

WORKDIR /usr/src/app

RUN apk add --no-cache curl && \
  apk add --no-cache vips --repository https://dl-cdn.alpinelinux.org/alpine/edge/community/

COPY --from=install /usr/src/app /usr/src/app/

USER node

CMD [ "node", "index" ]

EXPOSE 8080