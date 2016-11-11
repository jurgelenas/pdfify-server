'use strict';

const ghostTown = require('ghost-town');
const phantomjs = require('phantomjs-prebuilt');

let config = {
  port: process.env.PORT || 3000,
  htmlSizeLimit: process.env.HTML_SIZE_LIMIT || '2mb',
  workerCount: process.env.WORKER_COUNT || 2,
  workerDeath: process.env.WORKER_DEATH || 20,
  pageDeath: process.env.PAGE_DEATH || 8000
};

let town = ghostTown({
  workerCount: config.workerCount,
  workerDeath: config.workerDeath,
  pageDeath: config.pageDeath,
  phantomBinary: phantomjs.path
});

if (town.isMaster) {
  const express = require('express');
  const logger = require('morgan');
  const bodyParser = require('body-parser');
  const http = require('http');

  let app = express();
  app.use(logger('dev'));
  app.set('port', config.port);
  app.use(bodyParser.json({ limit: config.htmlSizeLimit }));
  app.use(bodyParser.urlencoded({
    extended: true,
    limit: config.htmlSizeLimit
  }));

  app.get('/', (req, res) => {
    res.json({
      message: 'HTML to PDF service.'
    });
  });

  let fillMissingFields = (data) => {
    data.format = data.format || 'binary'; // or base64
    if (! (data.paperWidth && data.paperHeight) && ! data.paperSize) {
      data.paperSize = 'A4'; // 'A3', 'A4', 'A5', 'Legal', 'Letter', 'Tabloid'
    }
    data.orientation = data.orientation || 'portrait'; // or horizontal
    data.zoomFactor = data.zoomFactor || 1;
    let defaultMargin = '0';
    let defaultPaperMargin = {
      left: defaultMargin,
      right: defaultMargin,
      top: defaultMargin,
      bottom: defaultMargin
    };
    data.paperMargin = data.paperMargin || defaultPaperMargin;
    data.paperMargin.left = data.paperMargin.left || defaultMargin;
    data.paperMargin.right = data.paperMargin.right || defaultMargin;
    data.paperMargin.top = data.paperMargin.top || defaultMargin;
    data.paperMargin.bottom = data.paperMargin.bottom || defaultMargin;
    data.javascriptEnabled = data.javascriptEnabled || true;
    data.loadImages = data.loadImages || true;
    data.resourceTimeout = data.resourceTimeout || 10000; // in ms
    let defaultUA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/54.0.2840.71 Safari/537.36';
    data.userAgent = data.userAgent || defaultUA;

    return data;
  };

  let queuePdf = (req, res) => {
    let data = {};
    if (req.is('application/json')) {
      data = req.body || {};
    } else {
      data = {
        format: req.query.format,
        orientation: req.query.orientation,
        zoomFactor: req.query.zoomFactor,
        html: req.query.html,
        url: req.query.url,
        paperSize: req.query.paperSize,
        paperWidth: req.query.paperWidth,
        paperHeight: req.query.paperHeight,
        userAgent: req.query.userAgent,
        paperMargin: {
          left: req.query.paperMarginLeft,
          right: req.query.paperMarginRight,
          top: req.query.paperMarginTop,
          bottom: req.query.paperMarginBottom
        },
        javascriptEnabled: req.query.javascriptEnabled,
        loadImages: req.query.loadImages,
        resourceTimeout: req.query.resourceTimeout,
      };
    }

    data = fillMissingFields(data);

    town.queue(data, (err, pdf) => {
      if (err) {
        return res.status(400).json({
          message: err,
          error: true
        });
      }

      if (data.format === 'base64') {
        res.status(200).json({
          success: true,
          pdf: new Buffer(pdf, 'base64').toString('base64')
        });
      } else if (data.format === 'binary') {
        pdf = new Buffer(pdf);
        res.writeHead(200, {
          'Content-Type': 'application/pdf',
          'Content-Length': pdf.length
        });
        res.end(pdf);
      }
    });
  };

  /*
    URL for testing:

    http://localhost:3000/convert?format=binary&html=%3C!DOCTYPE%20html%3E%3Chtml%20lang=%22en%22%3E%3Chead%3E%3Ctitle%3Etest%3C/title%3E%3C/head%3E%3Cbody%3E%3Ch1%20style=%22text-align:center;%22%3EHtml%20to%20PDF%3C/h1%3E%3C/body%3E%3C/html%3E
  */
  app.get('/convert', queuePdf);
  app.post('/convert', queuePdf);

  // catch 404 and forward to error handler
  app.use((req, res, next) => {
    let err = new Error('Not Found');
    err.status = 404;
    next(err);
  });

  // error handler
  app.use((err, req, res) => {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    let status = err.status || 500;
    res.status(status).json({
      error: status,
      message: err.message
    });
  });

  // Create server
  var server = http.createServer(app);
  server.listen(config.port);
  server.on('error', onError);
  server.on('listening', onListening);
} else {
  const uuid = require('node-uuid');
  const fs = require('fs');

  town.on('queue', (page, data, next) => {
    let tmpFile = '/tmp/' + uuid.v4();

    page.setting('javascriptEnabled', data.javascriptEnabled).then(() => {
      return page.setting('loadImages', data.loadImages);
    }).then(() => {
      return page.setting('userAgent', data.userAgent);
    }).then(() => {
      return page.setting('resourceTimeout', data.resourceTimeout);
    }).then(() => {
      let paperProperties = {
        orientation: data.orientation,
        margin: data.paperMargin
      };

      if (data.paperSize) {
        paperProperties.format = data.paperSize;
      } else if (data.paperWidth && data.paperHeight) {
        paperProperties.width = data.paperWidth;
        paperProperties.height = data.paperHeight;
      }

      return page.property('paperSize', paperProperties);
    }).then(() => {
      if (data.url && data.url.length) {
        return page.open(data.url);
      } else {
        return page.property('content', data.html);
      }
    }).then((status) => {
      if (status === 'fail') {
        return Promise.reject('Failed to load the given URL.');
      }
      // We can use here only ES5 since.
      // page.evaluate passes function to PhantomJs.
      return page.evaluate(function(zoomFactor) {
        var sheet = window.document.styleSheets[0];
        var rule = 'body { -webkit-print-color-adjust: exact !important; zoom: ' + zoomFactor + '; }'
        var index = 0;
        if (sheet.cssRules && sheet.cssRules.length) {
          index = sheet.cssRules.length;
        }
        sheet.insertRule(rule, index);
      }, data.zoomFactor);
    }).then(() => {
      return page.render(tmpFile, {
        format: 'pdf'
      });
    }).then(() => {
      fs.readFile(tmpFile, (err, pdf) => {
        fs.unlink(tmpFile, () => {});

        if (err) {
          return next(err, null);
        }

        next(null, pdf);
      });
    }).catch((err) => {
      next(err, null);
    });
  });
}

// Event listener for HTTP server "error" event.
function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  let bind = typeof port === 'string'
    ? 'Pipe ' + port
    : 'Port ' + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
}

// Event listener for HTTP server "listening" event.
function onListening() {
  let addr = server.address();
  let bind = typeof addr === 'string'
    ? 'pipe ' + addr
    : 'port ' + addr.port;
  console.log('Listening on ' + bind);
}
