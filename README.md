# PDFify

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/jurgelenas/pdfify-server)

Create beautiful PDF documents using familiar HTML, CSS and JavaScript.
This open source project is direct replacement for services like
[HyPDF](https://www.hypdf.com/) and [DocRaptor](https://docraptor.com).

This service can be used to generate PDF invoices, legal documents, etc.

Requirements:
```
Node 4+
PhantomJs 2.1+
```

# Usage

## Setup

Deploy PDFify server to Heroku, as a Docker container or to your own
server. Locally you can just start a development server with 
```npm start```.

More on [Deployment](#deployment) section.

## Post request to server

This can be done with our 
[Node.js client library](https://github.com/jurgelenas/node-pdfify-client):

```javascript
const PDFifyClient = require('pdfify-client');
const fs = require('fs');

let client = new PDFifyClient({
  baseUrl: 'http://localhost:3000'
});

client.convert({
  url: 'https://news.ycombinator.com'
}).then((body) => {
  console.log(body);
  fs.writeFile('hn.pdf', body, 'binary', () => {});
}).catch((err) => {
  console.log(err);
});
```

or you can use query PDFify [HTTP API](#http-api) with your own favourite language.

# Client libraries

* [Node.js PDFify client](https://www.github.com/jurgelenas/node-pdfify-client)

# Configuration

Project configuration is done through environment variables.

| Name            | Default value       | Description  |
|-----------------|---------------------|--------------|
| PORT            | 3000                | PDFify server port |
| HTML_SIZE_LIMIT | 2mb                 | Controls the maximum request body size e.g. 100kB, 2mb. |
| WORKER_COUNT    | 2                   | Number of workers to maintain. One or two per CPU core is recommended. |
| WORKER_DEATH    | 20                  | Number of items to process before restarting a worker to prevent phantomjs memory leaks. |
| PAGE_DEATH      | 8000                | Number of milliseconds to wait before before requeuing an item. |


# Deployment

This project was developed under assumption it will be deployed inside the
Docker container or in PaaS like Heroku. But you can still deploy it easily
in more traditional environments.

## Heroku

Deployment to heroku is easiest and the most straightforward deployment option.

You can do that by using Heroku Button below:

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/jurgelenas/pdfify-server)

## Docker

There is [Dockerfile](Dockerfile) in this repository. You can pull image from
[Docker Hub](https://hub.docker.com/juliuj/pdfify) with 
```docker pull juliusj/pdfify```.

## Your own server

You will start PDFify server with ```npm start``` command. It is alias to 
```node ./node_modules/.bin/forever -m 5 server.js```


# HTTP API

API is very simple. There is only one endpoint ```/convert``` which
accepts GET and POST requests.

## POST /convert

Example:
```
{
  "format": "binary",
  "orientation": "portrait",
  "zoomFactor": 0.825,
  "html": "<h1>Test</h1>",
  "paperSize": "A4",
  "paperMargin": {
    "left": "1cm",
    "right": "1cm",
    "top": "1cm",
    "bottom": "1cm"
  },
  "javascriptEnabled": true,
  "loadImages": true,
  "resourceTimeout": 8000,
  "userAgent": "PDFify 1.0"
}
```

## GET /convert

This method is sometimes useful for testing purposes. Parameters are passed
through the query string. Field names are exactly the same except for paperMargin:

```
paperMargin.left -> paperMarginLeft
paperMargin.right -> paperMarginRight
paperMargin.top -> paperMarginTop
paperMargin.bottom -> paperMarginBottom
```

Example:
```
http://localhost:3000/convert?paperMarginLeft=4cm&zoomFactor=1&url=https://news.ycombinator.com
```

## Response

On successful HTML -> PDF request server always responds
with status code ```200```. On error it will be ```400```.

If ```format``` is set to ```binary``` response will return PDF file in binary.

If ```format``` is set to ```base64``` PDF will be returned encoded in base64,
for example:
```json
{
  "success": true,
  "pdf": "AsMazasDebeselisVisaiAsNeLokys="
}
```


Error responses are encoded in JSON, for example:
```json
{
  "error": true,
  "message": "Failed to load the given URL."
}
```

## Parameters

### format
PDF output format. Can be ```binary``` or ```base64```. Default 
is ```binary```.

### orientation

PDF document orientation. Can be ```'portrait'```  or ```'landscape'```. Default is
 ```'portrait'```.

### zoomFactor

**You will often adjust this parameter to make your HTML design fit better
into the PDF document. The sweet spot is between ```0.7``` and ```0.8```.**

Page zoom. Does not work when javascript is disabled. Default zoom is ```1```.

Additionally it can be set via css:
```css
body {
  zoom: 0.85;
}
```

### html

HTML to load inside PhantomJs headless browser.

### url

Opens the url and loads it to the page.

### paperSize

Supported formats are:
```'A3', 'A4', 'A5', 'Legal', 'Letter', 'Tabloid'```.

### paperWidth and paperHeight

Supported dimension units are:
```'mm', 'cm', 'in', 'px'```. No unit means ```'px'```.

Supply only ```paperSize``` or ```paperWidth``` and 
```paperHeight``` only.

### paperMargin

Borders around PDF page. Supported dimension units are:
```'mm', 'cm', 'in', 'px'```. No unit means ```'px'```.

For example:
```json
"paperMargin": {
   "left": "1cm",
   "right": "1cm",
   "top": "1cm",
   "bottom": "1cm"
}
```

### javascriptEnabled

Defines whether to execute the javascript code in the page or not. 
Defaults to ```true```.

### loadImages

Defines whether to load the inlined images or not. Defaults 
to ```true```.

### resourceTimeout

Defines the timeout after which any resource requested will stop
trying and proceed with other parts of the page.

Default is 8000 (in milliseconds).

### userAgent

Defines PhantomJs user agent. This could be useful, because some websites
does features detection based on browser user agent.

Default user agent is:
```
Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/54.0.2840.71 Safari/537.36
```
