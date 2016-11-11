FROM node:7.1.0
MAINTAINER Julius Jurgelenas <julius@jurgelenas.lt>

# More dependencies for PhantomJs
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        libsqlite3-dev \
        libfontconfig1-dev \
        libicu-dev \
        libfreetype6 \
        libssl-dev \
        libpng-dev \
        libjpeg-dev \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

RUN set -x  \
    # Install official PhantomJS release
 && apt-get update \
 && apt-get install -y --no-install-recommends \
        curl \
 && mkdir /tmp/phantomjs \
 && curl -L https://github.com/Medium/phantomjs/releases/download/v2.1.1/phantomjs-2.1.1-linux-x86_64.tar.bz2 \
        | tar -xj --strip-components=1 -C /tmp/phantomjs \
 && mv /tmp/phantomjs/bin/phantomjs /usr/local/bin \
    # Install dumb-init (to handle PID 1 correctly).
    # https://github.com/Yelp/dumb-init
 && curl -Lo /tmp/dumb-init.deb https://github.com/Yelp/dumb-init/releases/download/v1.2.0/dumb-init_1.2.0_amd64.deb \
 && dpkg -i /tmp/dumb-init.deb \
    # Clean up
 && apt-get purge --auto-remove -y \
        curl \
 && apt-get clean \
 && rm -rf /tmp/* /var/lib/apt/lists/* \

# Non root user
RUN su node

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

ENV NODE_ENV production
ENV PORT 3000
ENV HTML_SIZE_LIMIT 2mb
ENV WORKER_COUNT 2
ENV WORKER_DEATH 20
ENV PAGE_DEATH 8000

COPY server.js package.json /usr/src/app/
RUN npm install
EXPOSE $PORT

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["npm", "start"]
