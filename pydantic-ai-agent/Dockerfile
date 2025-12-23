FROM python:3.14.0-slim-trixie
COPY --from=ghcr.io/astral-sh/uv:0.9.18 /uv /uvx /bin/

WORKDIR /app

# Disable development dependencies
ENV UV_NO_DEV=1

COPY ./pyproject.toml ./uv.lock ./
RUN uv sync --locked

COPY . .

ENV PATH="/app/.venv/bin:$PATH"
ENV RUNNING_IN_CLOUD=false
ENV APP_ENV=test

CMD [ "python", "./main.py" ]
