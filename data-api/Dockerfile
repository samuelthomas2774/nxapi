FROM node:17 as build

WORKDIR /app

ADD package.json /app
ADD package-lock.json /app

RUN npm install

COPY src /app/src
COPY bin /app/bin
ADD tsconfig.json /app

RUN npx tsc

RUN ln -s /app/bin/nxapi.js /usr/local/bin/nxapi
ENV NXAPI_DATA_PATH=/data
ENV NODE_ENV=development

COPY data-api/public /public
WORKDIR /public

RUN mkdir -p data && \
    echo "Exporting Discord title configuration as JSON" && \
    DEBUG=* nxapi util export-discord-titles --format json > data/discord-titles.json && \
    echo "Exporting Discord title configuration as JSON without Discord activity configuration" && \
    DEBUG=* nxapi util export-discord-titles --format json --exclude-discord-configuration > data/discord-titles-compact.json && \
    # echo "Exporting Discord title configuration as JSON with Nintendo eShop contents" && \
    # DEBUG=* nxapi util export-discord-titles --format json --include-title-contents > data/discord-titles-with-contents.json && \
    echo "Exporting Discord title configuration as JSON with Discord applications" && \
    DEBUG=* nxapi util export-discord-titles --format json --group-discord-clients > data/discord-clients.json && \
    # echo "Exporting Discord title configuration as JSON with Discord applications and Nintendo eShop contents" && \
    # DEBUG=* nxapi util export-discord-titles --format json --group-discord-clients --include-title-contents > data/discord-clients-with-contents.json && \
    echo "Exporting Discord title configuration as CSV" && \
    DEBUG=* nxapi util export-discord-titles --format csv > data/discord-titles.csv && \
    echo "Exporting Discord title configuration as CSV without Discord activity configuration" && \
    DEBUG=* nxapi util export-discord-titles --format csv --exclude-discord-configuration > data/discord-titles-compact.csv

FROM nginx:alpine

COPY --from=build /public /usr/share/nginx/html
