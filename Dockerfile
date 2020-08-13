FROM node:alpine3.12

WORKDIR /usr/src/p-to-z

copy package*.json ./

ENV NPM_CONFIG_LOGLEVEL warn
RUN npm ci --only=production

copy . .

CMD [ "npm", "start" ]