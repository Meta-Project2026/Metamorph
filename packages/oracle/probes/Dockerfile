ARG PHP_IMAGE
FROM ${PHP_IMAGE}
# Trusted runtime preparation only. No candidate source enters the build context.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libsqlite3-dev coreutils \
    && docker-php-ext-install pdo_sqlite \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /work
