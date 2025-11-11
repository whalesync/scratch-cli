FROM python:3.14.0-slim-trixie

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV RUNNING_IN_CLOUD=false
ENV APP_ENV=test

CMD [ "python", "./main.py" ]