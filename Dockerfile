FROM node:20 as build

WORKDIR /app

ADD package.json /app
ADD package-lock.json /app

RUN npm install

COPY src /app/src
COPY bin /app/bin
ADD tsconfig.json /app

RUN npx tsc

FROM node:20

WORKDIR /app

ADD package.json /app
ADD package-lock.json /app

RUN npm ci --production

COPY bin /app/bin
COPY resources /app/resources
COPY --from=build /app/dist /app/dist

RUN ln -s /app/bin/nxapi.js /usr/local/bin/nxapi
ENV NXAPI_DATA_PATH=/data
ENV NODE_ENV=production

VOLUME [ "/data" ]

ENTRYPOINT [ "/app/resources/docker-entrypoint.sh" ]
CMD [ "--help" ]
