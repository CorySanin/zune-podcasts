FROM keymetrics/pm2:latest-alpine

WORKDIR /usr/src/p-to-z

copy package*.json ./

ENV NPM_CONFIG_LOGLEVEL warn
RUN npm ci --only=production

copy . .

CMD [ "pm2-runtime", "start", "pm2.json" ]
